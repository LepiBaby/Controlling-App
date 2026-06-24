import type { requireAuth } from '@/lib/supabase-server'
import type {
  ProduktInput,
  BestehendeBestellungInput,
} from '@/lib/langfristige-bestelllauf-algorithmus'

type Supabase = Awaited<ReturnType<typeof requireAuth>>['supabase']

// PROJ-86: Gemeinsame Daten-Lade-Logik für den Bestelllauf und das Chart.
// Liest alle versionsgebundenen Quellen (Grundeinstellungen, Absatzplanung,
// Produktinformationen) und baut die Algorithmus-Eingabe rein auf Produktebene.

export interface VersionsDaten {
  startMonat: Date
  horizontMonate: number
  produkte: ProduktInput[]
  bestehende: BestehendeBestellungInput[]
}

interface KategorieRow {
  id: string
  name: string
}

function computeMax(volM3: number | null, stueckCm3: number | null): number | null {
  if (!volM3 || !stueckCm3 || stueckCm3 <= 0) return null
  return Math.floor((volM3 * 1_000_000) / stueckCm3)
}

export async function ladeVersionsDaten(
  supabase: Supabase,
  userId: string,
  versionId: string,
): Promise<VersionsDaten> {
  // Grundeinstellungen (Startmonat + allgemeiner Horizont)
  const { data: grund } = await supabase
    .from('langfristige_grundeinstellungen')
    .select('startmonat_monat, startmonat_jahr, planungshorizont_monate')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .maybeSingle()

  const now = new Date()
  const startMonatNr = grund?.startmonat_monat ?? now.getUTCMonth() + 1
  const startJahr = grund?.startmonat_jahr ?? now.getUTCFullYear()
  const horizontMonate = grund?.planungshorizont_monate ?? 12
  const startMonat = new Date(Date.UTC(startJahr, startMonatNr - 1, 1))

  // Produkte der Version
  const { data: produktRows } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id, name')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('art', 'lp_produkt')
    .eq('level', 1)
    .order('sort_order', { ascending: true })
    .limit(500)

  const produktListe: KategorieRow[] = produktRows ?? []
  const produktIds = produktListe.map((p) => p.id)

  if (produktIds.length === 0) {
    return { startMonat, horizontMonate, produkte: [], bestehende: [] }
  }

  // Parallel: Absatz (Start-Monat), Aktueller Bestand, Lieferzeit, Bestandsverwaltung,
  // MOQ, Container-Paketmaße, Container-Volumina, Hersteller-Zuordnung, bestehende Bestellungen.
  const [
    absatzRes,
    bestandRes,
    lieferzeitRes,
    bestandsvRes,
    moqRes,
    containerRes,
    containerGlobalRes,
    herstellerRes,
    bestellRes,
  ] = await Promise.all([
    supabase
      .from('langfristige_absatz_planung')
      .select('produkt_id, jahr, monat, absatz')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(20000),
    supabase
      .from('langfristige_produktinformationen_aktueller_bestand')
      .select('produkt_id, bestand')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_lieferzeit')
      .select('produkt_id, pufferzeit_tage, produktionszeit_tage, zwischenzeit_tage, shipping_zeit_tage, entladungszeit_tage')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_bestandsverwaltung')
      .select('produkt_id, sicherheitsbestand, zielreichweite_wochen')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_moq')
      .select('produkt_id, moq')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_containerkapazitaet')
      .select('produkt_id, laenge_cm, breite_cm, hoehe_cm')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_container_global')
      .select('volumen_20dc, volumen_40hq')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    supabase
      .from('langfristige_produktinformationen_hersteller_zuordnung')
      .select('produkt_id, hersteller_id')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_bestellungen')
      .select('id, produkt_id, herkunft, manuell_geaendert, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, menge_theoretisch, menge_praktisch, anzahl_20dc, anzahl_40hq')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(2000),
  ])

  // Absatz je Produkt × Monat (Summe über alle Plattformen). Start-Monatswert
  // dient als Fallback; die volle Monats-Map ist Basis für Ø-Sicherheitsbestand
  // und monatsweisen Meldebestand.
  const startKey = `${startJahr}-${startMonatNr}`
  const monatsAbsatzByProdukt = new Map<string, Map<string, number>>()
  for (const r of (absatzRes.data ?? []) as Array<{ produkt_id: string; jahr: number; monat: number; absatz: number | null }>) {
    if (!monatsAbsatzByProdukt.has(r.produkt_id)) monatsAbsatzByProdukt.set(r.produkt_id, new Map())
    const m = monatsAbsatzByProdukt.get(r.produkt_id)!
    const key = `${r.jahr}-${r.monat}`
    m.set(key, (m.get(key) ?? 0) + (r.absatz ?? 0))
  }

  const bestandByProdukt = new Map(
    ((bestandRes.data ?? []) as Array<{ produkt_id: string; bestand: number | null }>).map((r) => [
      r.produkt_id,
      r.bestand ?? 0,
    ]),
  )
  const lieferzeitByProdukt = new Map(
    ((lieferzeitRes.data ?? []) as Array<Record<string, number | null> & { produkt_id: string }>).map(
      (r) => [r.produkt_id, r],
    ),
  )
  const bestandsvByProdukt = new Map(
    ((bestandsvRes.data ?? []) as Array<{ produkt_id: string; sicherheitsbestand: number | null; zielreichweite_wochen: number | null }>).map(
      (r) => [r.produkt_id, r],
    ),
  )
  const moqByProdukt = new Map(
    ((moqRes.data ?? []) as Array<{ produkt_id: string; moq: number | null }>).map((r) => [r.produkt_id, r.moq]),
  )
  const containerByProdukt = new Map(
    ((containerRes.data ?? []) as Array<{ produkt_id: string; laenge_cm: number | null; breite_cm: number | null; hoehe_cm: number | null }>).map(
      (r) => [r.produkt_id, r],
    ),
  )
  const herstellerByProdukt = new Map(
    ((herstellerRes.data ?? []) as Array<{ produkt_id: string; hersteller_id: string | null }>).map(
      (r) => [r.produkt_id, r.hersteller_id],
    ),
  )

  const vol20 = containerGlobalRes.data?.volumen_20dc ?? null
  const vol40 = containerGlobalRes.data?.volumen_40hq ?? null

  const produkte: ProduktInput[] = produktListe.map((p) => {
    const lz = lieferzeitByProdukt.get(p.id)
    const bv = bestandsvByProdukt.get(p.id)
    const cont = containerByProdukt.get(p.id)
    const stueckCm3 =
      cont?.laenge_cm && cont?.breite_cm && cont?.hoehe_cm
        ? cont.laenge_cm * cont.breite_cm * cont.hoehe_cm
        : null

    const monatsMap = monatsAbsatzByProdukt.get(p.id)

    return {
      produkt_id: p.id,
      produkt_name: p.name,
      aktueller_bestand: bestandByProdukt.get(p.id) ?? 0,
      monatsabsatz: monatsMap?.get(startKey) ?? 0,
      monatsabsatz_map: monatsMap,
      pufferzeit_tage: lz?.pufferzeit_tage ?? 0,
      produktionszeit_tage: lz?.produktionszeit_tage ?? 0,
      zwischenzeit_tage: lz?.zwischenzeit_tage ?? 0,
      shipping_zeit_tage: lz?.shipping_zeit_tage ?? 0,
      entladungszeit_tage: lz?.entladungszeit_tage ?? 0,
      // PROJ-77: Sicherheitsbestand & Zielreichweite werden in Monaten geführt.
      sicherheitsbestand_monate: bv?.sicherheitsbestand ?? 0,
      zielreichweite_monate: bv?.zielreichweite_wochen ?? 0,
      moq: moqByProdukt.get(p.id) ?? null,
      hersteller_id: herstellerByProdukt.get(p.id) ?? null,
      stueckvolumen_cm3: stueckCm3,
      max_20dc: computeMax(vol20, stueckCm3),
      max_40hq: computeMax(vol40, stueckCm3),
    }
  })

  const bestehende: BestehendeBestellungInput[] = (
    (bestellRes.data ?? []) as Array<{
      id: string
      produkt_id: string
      herkunft: 'algorithmus' | 'manuell' | null
      manuell_geaendert: boolean
      bestelldatum: string | null
      produktionsstart_datum: string | null
      produktionsende_datum: string | null
      shippingdatum: string | null
      ankunftsdatum: string | null
      verfuegbarkeitsdatum: string | null
      menge_theoretisch: number | null
      menge_praktisch: number
      anzahl_20dc: number | null
      anzahl_40hq: number | null
    }>
  ).map((b) => ({
    bestellung_id: b.id,
    produkt_id: b.produkt_id,
    herkunft: b.herkunft,
    manuell_geaendert: b.manuell_geaendert,
    bestelldatum: b.bestelldatum,
    produktionsstart_datum: b.produktionsstart_datum,
    produktionsende_datum: b.produktionsende_datum,
    shippingdatum: b.shippingdatum,
    ankunftsdatum: b.ankunftsdatum,
    verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
    menge_theoretisch: b.menge_theoretisch,
    menge_praktisch: b.menge_praktisch,
    anzahl_20dc: b.anzahl_20dc ?? 0,
    anzahl_40hq: b.anzahl_40hq ?? 0,
  }))

  return { startMonat, horizontMonate, produkte, bestehende }
}

// ─── Produkt-Stammdaten + Container-Global (für Wizard Schritt 3 / Konsolidierung) ──
//
// PROJ-86: Spiegel der kurzfristigen `ProduktStammdaten` (siehe
// `src/hooks/use-planbestelllauf.ts`) und `container_global`, damit der
// Konsolidierungs-Schritt der kurzfristigen Wizard-UI 1:1 wiederverwendbar ist.
// Auf Produktebene (keine SKUs).

export interface ProduktStammdaten {
  produkt_id: string
  produkt_name: string
  hersteller_id: string | null
  hersteller_name: string | null
  stueckvolumen_m3: number | null
  max_20dc: number | null
  max_40hq: number | null
  produktionszeit_tage: number
  zwischenzeit_tage: number
  shipping_zeit_tage: number
  entladungszeit_tage: number
  pufferzeit_tage: number
}

export interface ContainerGlobal {
  volumen_20dc: number | null
  volumen_40hq: number | null
}

export interface StammdatenErgebnis {
  produkt_stammdaten: ProduktStammdaten[]
  container_global: ContainerGlobal
}

// Baut produkt_stammdaten + container_global aus den bereits geladenen
// VersionsDaten (rein aus den ProduktInput-Werten ableitbar) plus den
// Hersteller-Namen (separat geladen, da ProduktInput nur die ID kennt).
export async function ladeStammdaten(
  supabase: Supabase,
  userId: string,
  versionId: string,
  produkte: ProduktInput[],
): Promise<StammdatenErgebnis> {
  // Container-Global (Volumina) erneut laden — schlank, eigene Quelle.
  const { data: containerGlobal } = await supabase
    .from('langfristige_produktinformationen_container_global')
    .select('volumen_20dc, volumen_40hq')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .maybeSingle()

  const herstellerIds = [
    ...new Set(produkte.map((p) => p.hersteller_id).filter((id): id is string => !!id)),
  ]

  const herstellerNameById = new Map<string, string>()
  if (herstellerIds.length > 0) {
    const { data: hersteller } = await supabase
      .from('langfristige_produktinformationen_hersteller')
      .select('id, name')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .in('id', herstellerIds)
      .limit(500)
    for (const h of (hersteller ?? []) as Array<{ id: string; name: string }>) {
      herstellerNameById.set(h.id, h.name)
    }
  }

  const produkt_stammdaten: ProduktStammdaten[] = produkte.map((p) => ({
    produkt_id: p.produkt_id,
    produkt_name: p.produkt_name,
    hersteller_id: p.hersteller_id,
    hersteller_name: p.hersteller_id ? herstellerNameById.get(p.hersteller_id) ?? null : null,
    stueckvolumen_m3: p.stueckvolumen_cm3 != null ? p.stueckvolumen_cm3 / 1_000_000 : null,
    max_20dc: p.max_20dc,
    max_40hq: p.max_40hq,
    produktionszeit_tage: p.produktionszeit_tage,
    zwischenzeit_tage: p.zwischenzeit_tage,
    shipping_zeit_tage: p.shipping_zeit_tage,
    entladungszeit_tage: p.entladungszeit_tage,
    pufferzeit_tage: p.pufferzeit_tage,
  }))

  return {
    produkt_stammdaten,
    container_global: {
      volumen_20dc: containerGlobal?.volumen_20dc ?? null,
      volumen_40hq: containerGlobal?.volumen_40hq ?? null,
    },
  }
}

// Lädt den geplanten Absatz je Monat für EIN Produkt (Summe über alle
// Plattformen) aus der Absatzplanung der Version. Schlüssel: `${jahr}-${monat}`.
export async function ladeMonatsAbsatz(
  supabase: Supabase,
  userId: string,
  versionId: string,
  produktId: string,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('langfristige_absatz_planung')
    .select('jahr, monat, absatz')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('produkt_id', produktId)
    .limit(20000)

  const map = new Map<string, number>()
  for (const r of (data ?? []) as Array<{ jahr: number; monat: number; absatz: number | null }>) {
    const key = `${r.jahr}-${r.monat}`
    map.set(key, (map.get(key) ?? 0) + (r.absatz ?? 0))
  }
  return map
}

// Lädt die Bestellungen einer Version inkl. Produktname & Konsolidierungspartner
// und bringt sie in die vom Frontend erwartete Form.
export async function ladeBestellungen(
  supabase: Supabase,
  userId: string,
  versionId: string,
): Promise<unknown[]> {
  const { data: rows, error } = await supabase
    .from('langfristige_bestellungen')
    .select(
      'id, produkt_id, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, menge_theoretisch, menge_nach_moq, menge_vor_konsolidierung, menge_praktisch, begruendung, herkunft, manuell_geaendert, ist_erstbestellung, anzahl_20dc, anzahl_40hq, container_anteil, notizen, created_at, updated_at',
    )
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .order('bestelldatum', { ascending: true })
    .limit(2000)

  if (error) throw new Error(error.message)
  const bestellungen = (rows ?? []) as Array<Record<string, unknown> & { id: string; produkt_id: string }>

  // Produktnamen
  const produktIds = [...new Set(bestellungen.map((b) => b.produkt_id))]
  const nameById = new Map<string, string>()
  if (produktIds.length > 0) {
    const { data: prods } = await supabase
      .from('langfristige_kpi_kategorien')
      .select('id, name')
      .in('id', produktIds)
    for (const p of (prods ?? []) as KategorieRow[]) nameById.set(p.id, p.name)
  }

  // Konsolidierungen
  const bestellIds = bestellungen.map((b) => b.id)
  const partnerByBestellung = new Map<
    string,
    Array<{
      bestellung_id: string
      produkt_name: string
      containerart: string | null
      bestelldatum: string | null
      anzahl_40hq: number
      anzahl_20dc: number
      container_anteil: Record<string, number> | null
    }>
  >()
  if (bestellIds.length > 0) {
    const { data: kons } = await supabase
      .from('langfristige_bestellungen_konsolidierungen')
      .select('bestellung_id_1, bestellung_id_2, containerart')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .or(`bestellung_id_1.in.(${bestellIds.join(',')}),bestellung_id_2.in.(${bestellIds.join(',')})`)

    const bestellungById = new Map(bestellungen.map((b) => [b.id, b]))
    for (const k of (kons ?? []) as Array<{ bestellung_id_1: string; bestellung_id_2: string; containerart: string | null }>) {
      const addPartner = (self: string, other: string) => {
        if (!partnerByBestellung.has(self)) partnerByBestellung.set(self, [])
        const otherBestellung = bestellungById.get(other)
        partnerByBestellung.get(self)!.push({
          bestellung_id: other,
          produkt_name: otherBestellung ? nameById.get(otherBestellung.produkt_id) ?? '' : '',
          containerart: k.containerart,
          bestelldatum: (otherBestellung?.bestelldatum as string | null) ?? null,
          anzahl_40hq: (otherBestellung?.anzahl_40hq as number | null) ?? 0,
          anzahl_20dc: (otherBestellung?.anzahl_20dc as number | null) ?? 0,
          container_anteil: (otherBestellung?.container_anteil as Record<string, number> | null) ?? null,
        })
      }
      addPartner(k.bestellung_id_1, k.bestellung_id_2)
      addPartner(k.bestellung_id_2, k.bestellung_id_1)
    }
  }

  return bestellungen.map((b) => ({
    ...b,
    produkt_name: nameById.get(b.produkt_id) ?? '',
    konsolidiert_mit: partnerByBestellung.get(b.id) ?? [],
  }))
}
