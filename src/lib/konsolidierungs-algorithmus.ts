// Pure client-side consolidation calculation — no DB access.
// Mirrors the container-scaling thresholds from planbestelllauf-algorithmus.ts, but operates on m³.

import type { ProduktStammdaten } from '@/hooks/use-planbestelllauf'

export interface KonsolidierungsBestellungInput {
  bestellung_id: string
  produktionsende_datum: string | null
  sku_mengen: Array<{
    sku_id: string
    menge_nach_moq: number
    menge_praktisch: number
    begruendung_anpassung: string | null
  }>
  produkt_ids: string[]
}

export interface KonsolidierungsSkuErgebnis {
  sku_id: string
  neue_menge_praktisch: number
  begruendung_anpassung: string
}

export interface KonsolidierungsBestellungErgebnis {
  bestellung_id: string
  neue_sku_mengen: KonsolidierungsSkuErgebnis[]
  neues_produktionsende_datum: string
  neues_produktionsstart_datum: string | null
  neues_bestelldatum: string | null
  neues_shippingdatum: string | null
  neues_ankunftsdatum: string | null
  neues_verfuegbarkeitsdatum: string | null
  container_anteil: Record<string, number>
  volle_40hq: number
  rest_container: Array<'20DC' | '40HQ'>
}

export interface KonsolidierungsErgebnis {
  bestellungen: KonsolidierungsBestellungErgebnis[]
  hinweis?: string
}

// ─── m³-based container scaling (mirrors planbestelllauf-algorithmus logic) ──

function bestimmeContainerFuerRestvolumen(
  rest_m3: number,
  volumen_20dc_m3: number,
  volumen_40hq_m3: number,
): { container: Array<'20DC' | '40HQ'>; ziel_m3: number } {
  if (rest_m3 <= 0) return { container: [], ziel_m3: 0 }

  const containers: Array<'20DC' | '40HQ'> = []
  let ziel_m3 = 0
  let remaining = rest_m3

  while (remaining > 0) {
    const schwelleHalb = volumen_20dc_m3 / 2
    const schwelleAbrunden = volumen_20dc_m3 * 1.3
    const schwelleMitte = (volumen_20dc_m3 + volumen_40hq_m3) / 2

    // Nach mindestens einem gebuchten Container: Rest unter ½ 20DC wird gestrichen — nicht wirtschaftlich
    if (containers.length > 0 && remaining < schwelleHalb) {
      break
    }

    if (remaining < schwelleHalb) {
      const target = Math.min(remaining * 1.2, volumen_20dc_m3)
      ziel_m3 += target
      containers.push('20DC')
      remaining = 0
    } else if (remaining <= volumen_20dc_m3) {
      ziel_m3 += volumen_20dc_m3
      containers.push('20DC')
      remaining = 0
    } else if (remaining <= schwelleAbrunden) {
      ziel_m3 += volumen_20dc_m3
      containers.push('20DC')
      remaining = 0
    } else if (remaining < schwelleMitte) {
      const target = remaining * 1.2
      const container = target <= volumen_20dc_m3 ? '20DC' : '40HQ'
      ziel_m3 += target
      containers.push(container)
      remaining = 0
    } else {
      // Ab Mittelpunkt: einen vollen 40HQ buchen, Rest in nächster Iteration
      ziel_m3 += volumen_40hq_m3
      containers.push('40HQ')
      remaining -= volumen_40hq_m3
    }
  }

  return { container: containers, ziel_m3 }
}

function addTage(isoDate: string, tage: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

export function berechneKonsolidierung(
  bestellungen: KonsolidierungsBestellungInput[],
  stammdatenById: Map<string, ProduktStammdaten>,
  volumen_20dc_m3: number,
  volumen_40hq_m3: number,
): KonsolidierungsErgebnis {
  if (bestellungen.length < 2) {
    return { bestellungen: [], hinweis: 'Mindestens 2 Bestellungen für Konsolidierung erforderlich.' }
  }

  // ── Step 1: compute per-order m³ and full 40HQ count ──────────────────────
  const orderData = bestellungen.map(b => {
    const produktId = b.produkt_ids[0] ?? ''
    const stamm = stammdatenById.get(produktId)
    const stueckvolumen_m3 = stamm?.stueckvolumen_m3 ?? null

    let gesamt_m3 = 0
    if (stueckvolumen_m3 !== null) {
      for (const s of b.sku_mengen) {
        gesamt_m3 += s.menge_nach_moq * stueckvolumen_m3
      }
    }

    const volle_40hq = volumen_40hq_m3 > 0 ? Math.floor(gesamt_m3 / volumen_40hq_m3) : 0
    const rest_m3 = gesamt_m3 - volle_40hq * volumen_40hq_m3

    return { b, stamm, stueckvolumen_m3, gesamt_m3, volle_40hq, rest_m3 }
  })

  // ── Step 2: total rest m³ ─────────────────────────────────────────────────
  const gesamt_rest_m3 = orderData.reduce((sum, d) => sum + d.rest_m3, 0)

  // ── Step 3: determine rest container ─────────────────────────────────────
  const { container: rest_container, ziel_m3: target_rest_m3 } = bestimmeContainerFuerRestvolumen(
    gesamt_rest_m3,
    volumen_20dc_m3,
    volumen_40hq_m3,
  )

  const nurDatumsanpassung = gesamt_rest_m3 === 0

  // ── Step 6: determine target date (earliest produktionsende) ─────────────
  const daten = bestellungen
    .map(b => b.produktionsende_datum)
    .filter(Boolean) as string[]
  if (daten.length === 0) {
    return {
      bestellungen: [],
      hinweis: 'Kein Prod.ende-Datum für die Konsolidierung verfügbar.',
    }
  }
  const ziel_produktionsende = daten.reduce((a, b) => (a < b ? a : b))

  // ── Steps 4 & 5: assign new quantities per order ─────────────────────────
  const ergebnisse: KonsolidierungsBestellungErgebnis[] = orderData.map(({ b, stamm, stueckvolumen_m3, gesamt_m3, volle_40hq, rest_m3 }) => {
    const produktId = b.produkt_ids[0] ?? ''

    // proportional share of the shared rest container
    const volumen_anteil = gesamt_rest_m3 > 0 ? rest_m3 / gesamt_rest_m3 : 0
    const ziel_rest_m3_i = volumen_anteil * target_rest_m3

    // container_anteil: full 40HQs + fractional rest-container share
    const container_anteil: Record<string, number> = {}
    if (volle_40hq > 0) container_anteil['40HQ'] = (container_anteil['40HQ'] ?? 0) + volle_40hq
    if (rest_container.length > 0 && gesamt_rest_m3 > 0) {
      const restContainerArt = rest_container[0] as string
      const anteil = volumen_anteil
      container_anteil[restContainerArt] = (container_anteil[restContainerArt] ?? 0) + anteil
    }

    // compute new sku quantities for the rest portion
    let neue_sku_mengen: KonsolidierungsSkuErgebnis[]

    if (nurDatumsanpassung || stueckvolumen_m3 === null || gesamt_m3 === 0) {
      neue_sku_mengen = b.sku_mengen.map(s => ({
        sku_id: s.sku_id,
        neue_menge_praktisch: s.menge_praktisch,
        begruendung_anpassung: s.begruendung_anpassung ?? '',
      }))
    } else {
      const max_40hq_stueck = stamm?.max_40hq ?? null
      const volle_stueck_gesamt = max_40hq_stueck !== null ? volle_40hq * max_40hq_stueck : 0

      let restSumme = 0
      const raws: { sku_id: string; raw: number; orig: number; begruendung: string }[] = []

      for (const s of b.sku_mengen) {
        const sku_vol_anteil = gesamt_m3 > 0
          ? (s.menge_nach_moq * stueckvolumen_m3) / gesamt_m3
          : 1 / b.sku_mengen.length

        const neue_rest_stueck = stueckvolumen_m3 > 0
          ? Math.round(ziel_rest_m3_i * sku_vol_anteil / stueckvolumen_m3)
          : s.menge_nach_moq

        const volle_anteil = max_40hq_stueck !== null
          ? Math.round(volle_stueck_gesamt * sku_vol_anteil)
          : 0

        const raw = volle_anteil + neue_rest_stueck
        raws.push({ sku_id: s.sku_id, raw, orig: s.menge_praktisch, begruendung: s.begruendung_anpassung ?? '' })
        restSumme += raw
      }

      // Rounding correction: assign diff to largest-menge SKU
      const sollSumme = raws.reduce((a, r) => a + r.raw, 0)
      const diff = sollSumme - restSumme
      if (diff !== 0 && raws.length > 0) {
        const maxIdx = raws.reduce((best, r, i) => (r.raw > raws[best].raw ? i : best), 0)
        raws[maxIdx].raw += diff
      }

      neue_sku_mengen = raws.map(r => {
        const delta = r.raw - r.orig
        const suffix = delta !== 0
          ? `; Konsolidierung: ${delta > 0 ? '+' : ''}${delta} Stk. (Restmengen gemeinsamer Container)`
          : '; Konsolidierung: Keine Mengenänderung (voller Container)'
        return {
          sku_id: r.sku_id,
          neue_menge_praktisch: Math.max(0, r.raw),
          begruendung_anpassung: r.begruendung + suffix,
        }
      })
    }

    // ── Datumskaskade ──────────────────────────────────────────────────────
    const puffer = stamm?.pufferzeit_tage ?? 0
    const prodzeit = stamm?.produktionszeit_tage ?? 0
    const zwischen = stamm?.zwischenzeit_tage ?? 0
    const shipping = stamm?.shipping_zeit_tage ?? 0
    const entladung = stamm?.entladungszeit_tage ?? 0

    const prodStart = addTage(ziel_produktionsende, -prodzeit)
    const bestelldatum = addTage(prodStart, -puffer)
    const shippingdatum = addTage(ziel_produktionsende, zwischen)
    const ankunftsdatum = addTage(shippingdatum, shipping)
    const verfuegbarkeitsdatum = addTage(ankunftsdatum, entladung)

    return {
      bestellung_id: b.bestellung_id,
      neue_sku_mengen,
      neues_produktionsende_datum: ziel_produktionsende,
      neues_produktionsstart_datum: prodzeit > 0 ? prodStart : null,
      neues_bestelldatum: puffer > 0 || prodzeit > 0 ? bestelldatum : null,
      neues_shippingdatum: zwischen > 0 ? shippingdatum : null,
      neues_ankunftsdatum: shipping > 0 ? ankunftsdatum : null,
      neues_verfuegbarkeitsdatum: entladung > 0 ? verfuegbarkeitsdatum : null,
      container_anteil,
      volle_40hq,
      rest_container,
    }
  })

  return {
    bestellungen: ergebnisse,
    hinweis: nurDatumsanpassung
      ? 'Keine Restmengen — alle Bestellungen füllen exakt volle Container. Nur das Datum wird angeglichen.'
      : undefined,
  }
}
