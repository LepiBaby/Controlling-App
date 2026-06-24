export interface DatumFelder {
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
}

export interface LieferzeitIntervals {
  pufferzeit_tage: number | null
  produktionszeit_tage: number | null
  zwischenzeit_tage: number | null
  shipping_zeit_tage: number | null
  entladungszeit_tage: number | null
}

const DATUM_KETTE: Array<{ feld: keyof DatumFelder; intervall: keyof LieferzeitIntervals | null }> = [
  { feld: 'bestelldatum', intervall: null },
  { feld: 'produktionsstart_datum', intervall: 'pufferzeit_tage' },
  { feld: 'produktionsende_datum', intervall: 'produktionszeit_tage' },
  { feld: 'shippingdatum', intervall: 'zwischenzeit_tage' },
  { feld: 'ankunftsdatum', intervall: 'shipping_zeit_tage' },
  { feld: 'verfuegbarkeitsdatum', intervall: 'entladungszeit_tage' },
]

export const DATUM_KETTEN_FELDER = new Set<string>(DATUM_KETTE.map(k => k.feld))

function addTage(datum: string, tage: number): string {
  const d = new Date(datum + 'T00:00:00')
  d.setDate(d.getDate() + tage)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tageDifferenz(von: string, bis: string): number {
  const a = new Date(von + 'T00:00:00').getTime()
  const b = new Date(bis + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * Berechnet alle nachfolgenden Datumsfelder, wenn ein Datum geändert wird.
 *
 * Verwendet die Stammdaten-Lieferzeiten für die Abstände. Falls kein Stammdaten-
 * Wert für einen Schritt hinterlegt ist, wird das Delta des geänderten Datums
 * als Fallback verwendet (alle Folgedaten verschieben sich um denselben Betrag).
 *
 * Gibt ein Partial zurück, das alle aktualisierten Felder enthält.
 */
export function kaskadiereDaten(
  geaendertesFelder: keyof DatumFelder,
  neuerWert: string | null,
  aktuelleFelder: DatumFelder,
  lieferzeit: LieferzeitIntervals | null,
): Partial<DatumFelder> {
  const aenderungen: Partial<DatumFelder> = { [geaendertesFelder]: neuerWert }

  if (!neuerWert) return aenderungen

  const geaendertIndex = DATUM_KETTE.findIndex(k => k.feld === geaendertesFelder)
  if (geaendertIndex === -1) return aenderungen

  const alterWert = aktuelleFelder[geaendertesFelder]
  const delta = alterWert ? tageDifferenz(alterWert, neuerWert) : null

  for (let i = geaendertIndex + 1; i < DATUM_KETTE.length; i++) {
    const { feld, intervall } = DATUM_KETTE[i]
    const vorheriges = DATUM_KETTE[i - 1].feld
    const vorherigDatum = aenderungen[vorheriges] ?? aktuelleFelder[vorheriges]

    if (!vorherigDatum) break

    const aktuellerFeldWert = aktuelleFelder[feld]

    if (intervall && lieferzeit?.[intervall] != null) {
      aenderungen[feld] = addTage(vorherigDatum, lieferzeit[intervall] as number)
    } else if (delta !== null && aktuellerFeldWert) {
      aenderungen[feld] = addTage(aktuellerFeldWert, delta)
    }
  }

  return aenderungen
}