import type { requireAuth } from '@/lib/supabase-server'
import {
  generiereBestellkosten,
  type BestellungDaten,
  type ProduktKosten,
  type Zahlungskonditionen,
  type KostenGlobal,
  type KpiKategorie,
} from '@/lib/bestellkosten-generierung'

type Supabase = Awaited<ReturnType<typeof requireAuth>>['supabase']

// PROJ-86: Auto-Bestellkosten der Langfristigen Planung — wie kurzfristig
// (PROJ-64), aber mit den Einstellungsdaten DIESER Planversion. Wiederverwendung
// der reinen Kalkulationslogik `generiereBestellkosten`. Produktebene: jede
// Bestellung hat genau ein Produkt mit einer Menge. Die Kostenkategorien stammen
// — wie kurzfristig — aus dem globalen ausgaben_kosten-KPI-Modell (Unterkategorien
// von „Produkt").

export interface LangfristBestellungForKosten {
  id: string
  produkt_id: string
  menge_praktisch: number
  bestelldatum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  anzahl_40hq: number
  anzahl_20dc: number
  container_anteil: Record<string, number> | null
}

export async function generiereUndSpeichereLangfristigeBestellkosten(
  supabase: Supabase,
  userId: string,
  versionId: string,
  bestellungen: LangfristBestellungForKosten[],
): Promise<void> {
  if (bestellungen.length === 0) return
  const ids = bestellungen.map((b) => b.id)

  // Vorhandene Auto-Einträge vor der Neugenerierung löschen.
  await supabase
    .from('langfristige_bestellungen_kosten')
    .delete()
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('ist_automatisch', true)
    .in('bestellung_id', ids)

  // Manuelle Einträge belegen ihren (Bestellung, Kategorie, Datum)-Slot, damit die
  // Generierung keinen Auto-Duplikat-Eintrag daneben erzeugt.
  const { data: manuellRows } = await supabase
    .from('langfristige_bestellungen_kosten')
    .select('bestellung_id, kpi_kategorie_id, datum')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('ist_automatisch', false)
    .in('bestellung_id', ids)
  const manuellSlots = new Set(
    ((manuellRows ?? []) as Array<{ bestellung_id: string; kpi_kategorie_id: string | null; datum: string }>).map(
      (e) => `${e.bestellung_id}__${e.kpi_kategorie_id ?? ''}__${e.datum}`,
    ),
  )

  const produktIds = [...new Set(bestellungen.map((b) => b.produkt_id))]

  const [pkRes, zkRes, kgRes, catRes] = await Promise.all([
    supabase
      .from('langfristige_produktinformationen_produktkosten')
      .select('produkt_id, warenkosten, zollsatz_pct')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .in('produkt_id', produktIds),
    supabase
      .from('langfristige_produktinformationen_zahlungskonditionen')
      .select(
        'produkt_id, vor_produktion_pct, nach_produktion_pct, nach_ankunft_pct, zahlungsziel_vor_produktion_tage, zahlungsziel_nach_produktion_tage, zahlungsziel_nach_ankunft_tage',
      )
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .in('produkt_id', produktIds),
    supabase
      .from('langfristige_produktinformationen_kosten_global')
      .select(
        'shipping_kosten_20dc, shipping_kosten_40hq, shipping_zahlungsziel_tage, inspektion_kosten_20dc, inspektion_kosten_40hq, inspektion_zahlungsziel_tage, einlagerung_kosten_20dc, einlagerung_kosten_40hq, einlagerung_zahlungsziel_tage, zoll_zahlungsziel_tage',
      )
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    // Kostenkategorien wie kurzfristig: globales ausgaben_kosten-KPI-Modell,
    // „Produkt"-Elternkategorie + ihre direkten Unterkategorien.
    supabase
      .from('kpi_categories')
      .select('id, name, parent_id, level')
      .eq('type', 'ausgaben_kosten')
      .in('level', [1, 2]),
  ])

  const produktkostenListe = (pkRes.data ?? []) as ProduktKosten[]
  const zahlungskonditionenListe = (zkRes.data ?? []) as Zahlungskonditionen[]
  const kostenGlobal = (kgRes.data ?? null) as KostenGlobal | null

  const allCats = (catRes.data ?? []) as Array<{ id: string; name: string; parent_id: string | null; level: number }>
  const produktParent = allCats.find((c) => c.level === 1 && c.name.toLowerCase().trim() === 'produkt')
  const produktUnterkategorien: KpiKategorie[] = produktParent
    ? allCats.filter((c) => c.parent_id === produktParent.id)
    : []

  const allInserts: Array<{
    bestellung_id: string
    user_id: string
    plan_version_id: string
    kpi_kategorie_id: string | null
    datum: string
    nettobetrag: number
    begruendung: string
    ist_automatisch: boolean
  }> = []

  for (const b of bestellungen) {
    const bestellungDaten: BestellungDaten = {
      bestelldatum: b.bestelldatum,
      produktionsende_datum: b.produktionsende_datum,
      shippingdatum: b.shippingdatum,
      ankunftsdatum: b.ankunftsdatum,
      verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
      anzahl_40hq: b.anzahl_40hq,
      anzahl_20dc: b.anzahl_20dc,
      container_anteil: b.container_anteil,
      produkte: [{ produkt_id: b.produkt_id, sku_mengen: [{ menge_praktisch: b.menge_praktisch }] }],
    }

    const generierte = generiereBestellkosten(
      bestellungDaten,
      produktkostenListe.filter((pk) => pk.produkt_id === b.produkt_id),
      zahlungskonditionenListe.filter((zk) => zk.produkt_id === b.produkt_id),
      kostenGlobal,
      produktUnterkategorien,
    )

    for (const e of generierte) {
      allInserts.push({
        bestellung_id: b.id,
        user_id: userId,
        plan_version_id: versionId,
        kpi_kategorie_id: e.kpi_kategorie_id,
        datum: e.datum,
        nettobetrag: e.nettobetrag,
        begruendung: e.begruendung,
        ist_automatisch: true,
      })
    }
  }

  const filtered = allInserts.filter(
    (ins) => !manuellSlots.has(`${ins.bestellung_id}__${ins.kpi_kategorie_id ?? ''}__${ins.datum}`),
  )
  if (filtered.length > 0) {
    await supabase.from('langfristige_bestellungen_kosten').insert(filtered)
  }
}
