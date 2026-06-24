// PROJ-64: Pure calculation logic for auto-generating Bestellkosten entries.
// No DB access — all input is passed as parameters.

export interface BestellungDaten {
  bestelldatum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  anzahl_40hq: number
  anzahl_20dc: number
  container_anteil?: Record<string, number> | null
  produkte: Array<{
    produkt_id: string
    sku_mengen: Array<{ menge_praktisch: number }>
  }>
}

export interface ProduktKosten {
  produkt_id: string
  warenkosten: number | null
  zollsatz_pct: number | null
}

export interface Zahlungskonditionen {
  produkt_id: string
  vor_produktion_pct: number | null
  nach_produktion_pct: number | null
  nach_ankunft_pct: number | null
  zahlungsziel_vor_produktion_tage: number | null
  zahlungsziel_nach_produktion_tage: number | null
  zahlungsziel_nach_ankunft_tage: number | null
}

export interface KostenGlobal {
  shipping_kosten_20dc: number | null
  shipping_kosten_40hq: number | null
  shipping_zahlungsziel_tage: number | null
  inspektion_kosten_20dc: number | null
  inspektion_kosten_40hq: number | null
  inspektion_zahlungsziel_tage: number | null
  einlagerung_kosten_20dc: number | null
  einlagerung_kosten_40hq: number | null
  einlagerung_zahlungsziel_tage: number | null
  zoll_zahlungsziel_tage: number | null
}

export interface KpiKategorie {
  id: string
  name: string
}

export interface GenerierteKostenEintrag {
  kpi_kategorie_id: string | null
  datum: string
  nettobetrag: number
  begruendung: string
  ist_automatisch: true
}

function addTage(datum: string, tage: number): string {
  const d = new Date(datum + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().split('T')[0]
}

function findKategorie(kategorien: KpiKategorie[], suchname: string): string | null {
  const lower = suchname.toLowerCase().trim()
  return kategorien.find(k => k.name.toLowerCase().trim() === lower)?.id ?? null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function generiereBestellkosten(
  bestellung: BestellungDaten,
  produktkostenListe: ProduktKosten[],
  zahlungskonditionenListe: Zahlungskonditionen[],
  kostenGlobal: KostenGlobal | null,
  produktUnterkategorien: KpiKategorie[],
): GenerierteKostenEintrag[] {
  const eintraege: GenerierteKostenEintrag[] = []

  const pkMap = new Map(produktkostenListe.map(p => [p.produkt_id, p]))
  const zkMap = new Map(zahlungskonditionenListe.map(z => [z.produkt_id, z]))

  // ─── Ware (up to 3 entries per product) ─────────────────────────────────────
  const wareCatId = findKategorie(produktUnterkategorien, 'Ware')

  const wareGesamtProProdukt: Array<{ produkt_id: string; gesamt: number }> = []

  for (const produkt of bestellung.produkte) {
    const pk = pkMap.get(produkt.produkt_id)
    const zk = zkMap.get(produkt.produkt_id)
    if (!pk?.warenkosten || !zk) continue

    const gesamtMenge = produkt.sku_mengen.reduce((s, sm) => s + sm.menge_praktisch, 0)
    if (gesamtMenge <= 0) continue

    const wareGesamt = round2(pk.warenkosten * gesamtMenge)
    wareGesamtProProdukt.push({ produkt_id: produkt.produkt_id, gesamt: wareGesamt })

    const phasen: Array<{
      name: string
      prozent: number | null
      basisdatum: string | null
      zahlungsziel: number | null
    }> = [
      {
        name: 'Vor Produktion',
        prozent: zk.vor_produktion_pct,
        basisdatum: bestellung.bestelldatum,
        zahlungsziel: zk.zahlungsziel_vor_produktion_tage,
      },
      {
        name: 'Nach Produktion',
        prozent: zk.nach_produktion_pct,
        basisdatum: bestellung.shippingdatum,
        zahlungsziel: zk.zahlungsziel_nach_produktion_tage,
      },
      {
        name: 'Nach Ankunft',
        prozent: zk.nach_ankunft_pct,
        basisdatum: bestellung.ankunftsdatum,
        zahlungsziel: zk.zahlungsziel_nach_ankunft_tage,
      },
    ]

    for (const phase of phasen) {
      if (!phase.prozent || phase.prozent <= 0) continue
      if (!phase.basisdatum) continue

      const betrag = round2(wareGesamt * (phase.prozent / 100))
      const datum = addTage(phase.basisdatum, phase.zahlungsziel ?? 0)

      eintraege.push({
        kpi_kategorie_id: wareCatId,
        datum,
        nettobetrag: betrag,
        begruendung: `${gesamtMenge.toLocaleString('de-DE')} Stk. × ${pk.warenkosten.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/Stk. × ${phase.prozent}% (${phase.name})`,
        ist_automatisch: true,
      })
    }
  }

  // Effective container counts: when consolidation is active, read exclusively from container_anteil
  // (missing key means 0, not fallback to old integer count)
  const eff40hq = bestellung.container_anteil != null
    ? (bestellung.container_anteil['40HQ'] ?? 0)
    : bestellung.anzahl_40hq
  const eff20dc = bestellung.container_anteil != null
    ? (bestellung.container_anteil['20DC'] ?? 0)
    : bestellung.anzahl_20dc

  function fmtAnzahl(n: number): string {
    return n % 1 === 0
      ? String(n)
      : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // ─── Inspektion (1 entry) ─────────────────────────────────────────────────
  const inspektionCatId = findKategorie(produktUnterkategorien, 'Inspektion')
  if (kostenGlobal && bestellung.produktionsende_datum) {
    const kosten40hq = kostenGlobal.inspektion_kosten_40hq ?? 0
    const kosten20dc = kostenGlobal.inspektion_kosten_20dc ?? 0
    const betrag = round2(eff40hq * kosten40hq + eff20dc * kosten20dc)
    if (betrag > 0 || (eff40hq + eff20dc > 0 && (kosten40hq > 0 || kosten20dc > 0))) {
      const datum = addTage(bestellung.produktionsende_datum, kostenGlobal.inspektion_zahlungsziel_tage ?? 0)
      const teile: string[] = []
      if (eff40hq > 0) teile.push(`${fmtAnzahl(eff40hq)} × 40HQ (${kosten40hq.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`)
      if (eff20dc > 0) teile.push(`${fmtAnzahl(eff20dc)} × 20DC (${kosten20dc.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`)
      eintraege.push({
        kpi_kategorie_id: inspektionCatId,
        datum,
        nettobetrag: betrag,
        begruendung: `Inspektion: ${teile.join(' + ')}`,
        ist_automatisch: true,
      })
    }
  }

  // ─── Shipping (1 entry) ───────────────────────────────────────────────────
  const shippingCatId = findKategorie(produktUnterkategorien, 'Shipping')
  let shippingBetrag = 0
  if (kostenGlobal && bestellung.ankunftsdatum) {
    const kosten40hq = kostenGlobal.shipping_kosten_40hq ?? 0
    const kosten20dc = kostenGlobal.shipping_kosten_20dc ?? 0
    shippingBetrag = round2(eff40hq * kosten40hq + eff20dc * kosten20dc)
    if (shippingBetrag > 0 || (eff40hq + eff20dc > 0 && (kosten40hq > 0 || kosten20dc > 0))) {
      const datum = addTage(bestellung.ankunftsdatum, kostenGlobal.shipping_zahlungsziel_tage ?? 0)
      const teile: string[] = []
      if (eff40hq > 0) teile.push(`${fmtAnzahl(eff40hq)} × 40HQ (${kosten40hq.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`)
      if (eff20dc > 0) teile.push(`${fmtAnzahl(eff20dc)} × 20DC (${kosten20dc.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`)
      eintraege.push({
        kpi_kategorie_id: shippingCatId,
        datum,
        nettobetrag: shippingBetrag,
        begruendung: `Shipping: ${teile.join(' + ')}`,
        ist_automatisch: true,
      })
    }
  }

  // ─── Zoll (1 entry) ──────────────────────────────────────────────────────
  const zollCatId = findKategorie(produktUnterkategorien, 'Zoll')
  if (kostenGlobal && bestellung.ankunftsdatum && wareGesamtProProdukt.length > 0) {
    const wareTotal = wareGesamtProProdukt.reduce((s, w) => s + w.gesamt, 0)

    let zollBetrag = 0
    for (const { produkt_id, gesamt } of wareGesamtProProdukt) {
      const pk = pkMap.get(produkt_id)
      if (!pk?.zollsatz_pct || pk.zollsatz_pct <= 0) continue
      // Each product's zoll base: its ware + its proportional share of shipping
      const shippingAnteil = wareTotal > 0 ? shippingBetrag * (gesamt / wareTotal) : 0
      zollBetrag += round2((gesamt + shippingAnteil) * (pk.zollsatz_pct / 100))
    }
    zollBetrag = round2(zollBetrag)

    if (zollBetrag > 0) {
      const datum = addTage(bestellung.ankunftsdatum, kostenGlobal.zoll_zahlungsziel_tage ?? 0)
      const zollsatz = wareGesamtProProdukt.length === 1
        ? (pkMap.get(wareGesamtProProdukt[0].produkt_id)?.zollsatz_pct ?? 0)
        : null
      const begruendung = zollsatz !== null
        ? `Zoll ${zollsatz}% auf ${wareTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Ware + ${shippingBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Shipping`
        : `Zoll auf ${wareTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Ware + ${shippingBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Shipping (je Produktzollsatz)`
      eintraege.push({
        kpi_kategorie_id: zollCatId,
        datum,
        nettobetrag: zollBetrag,
        begruendung,
        ist_automatisch: true,
      })
    }
  }

  // ─── Einlagerung (1 entry) ────────────────────────────────────────────────
  const einlagerungCatId = findKategorie(produktUnterkategorien, 'Einlagerung')
  if (kostenGlobal && bestellung.verfuegbarkeitsdatum) {
    const kosten40hq = kostenGlobal.einlagerung_kosten_40hq ?? 0
    const kosten20dc = kostenGlobal.einlagerung_kosten_20dc ?? 0
    const betrag = round2(eff40hq * kosten40hq + eff20dc * kosten20dc)
    if (betrag > 0 || (eff40hq + eff20dc > 0 && (kosten40hq > 0 || kosten20dc > 0))) {
      const datum = addTage(bestellung.verfuegbarkeitsdatum, kostenGlobal.einlagerung_zahlungsziel_tage ?? 0)
      const teile: string[] = []
      if (eff40hq > 0) teile.push(`${fmtAnzahl(eff40hq)} × 40HQ (${kosten40hq.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`)
      if (eff20dc > 0) teile.push(`${fmtAnzahl(eff20dc)} × 20DC (${kosten20dc.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`)
      eintraege.push({
        kpi_kategorie_id: einlagerungCatId,
        datum,
        nettobetrag: betrag,
        begruendung: `Einlagerung: ${teile.join(' + ')}`,
        ist_automatisch: true,
      })
    }
  }

  return eintraege
}
