import { requireAuth } from '@/lib/supabase-server'

// PROJ-74 (Erweiterung): Snapshot-Seeding für den Investitionen-Reiter der
// Langfristigen Planung. Pro Planversion werden EINMALIG drei feste, schreib-
// geschützte Produktinvestitions-Übergruppen angelegt und mit den zum Seeding-
// Zeitpunkt im globalen KPI-Modell vorhandenen Untergruppen befüllt (Snapshot).
// Quelle ist jeweils die GLOBALE ausgaben_kosten-Struktur; gespiegelt werden die
// DIREKTEN Kinder des jeweiligen Quellknotens:
//   • „Produktinvestitionen Operations"        ← „Produktinvestitionen" › „Operations"
//   • „Produktinvestitionen Einkauf"           ← L1-Kategorie „Produkt"
//   • „Produktinvestitionen Sales & Marketing" ← „Produktinvestitionen" › „Sales & Marketing"
// Die erzeugten Datensätze tragen is_system=true und sind read-only.

type AuthedSupabase = Awaited<ReturnType<typeof requireAuth>>['supabase']

// Reihenfolge der festen Übergruppen (sort_order 0,1,2).
const OPERATIONS = 'Produktinvestitionen Operations'
const EINKAUF = 'Produktinvestitionen Einkauf'
const SALES_MARKETING = 'Produktinvestitionen Sales & Marketing'

interface GlobalKat {
  id: string
  name: string
  parent_id: string | null
  level: number
  sort_order: number
}

function bySortOrder(a: GlobalKat, b: GlobalKat) {
  return a.sort_order - b.sort_order
}

function eqName(name: string, soll: string) {
  return name.trim().toLowerCase() === soll.toLowerCase()
}

// Namen der direkten Kinder eines Knotens (nach sort_order).
function childNames(ak: GlobalKat[], parentId: string): string[] {
  return ak
    .filter(c => c.parent_id === parentId)
    .sort(bySortOrder)
    .map(c => c.name)
}

/**
 * Stellt sicher, dass die drei festen Produktinvestitions-Übergruppen (inkl.
 * gespiegelter Untergruppen) für die angegebene Version existieren. Idempotent:
 * existiert bereits mindestens ein System-Investitions-Datensatz, passiert nichts.
 */
export async function ensureInvestitionenSnapshot(
  supabase: AuthedSupabase,
  userId: string,
  versionId: string,
): Promise<void> {
  // Idempotenz: bereits geseedet?
  const { data: existingSystem } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('art', 'lp_investition')
    .eq('is_system', true)
    .limit(1)
  if (existingSystem && existingSystem.length > 0) return

  // Globale ausgaben_kosten-Struktur lesen.
  const { data: akRaw } = await supabase
    .from('kpi_categories')
    .select('id, name, parent_id, level, sort_order')
    .eq('type', 'ausgaben_kosten')
    .limit(2000)

  const ak = (akRaw ?? []) as GlobalKat[]

  const piL1 = ak.find(c => c.level === 1 && eqName(c.name, 'produktinvestitionen'))
  const produktL1 = ak.find(c => c.level === 1 && eqName(c.name, 'produkt'))
  const opNode = piL1 ? ak.find(c => c.level === 2 && c.parent_id === piL1.id && eqName(c.name, 'operations')) : undefined
  const smNode = piL1 ? ak.find(c => c.level === 2 && c.parent_id === piL1.id && eqName(c.name, 'sales & marketing')) : undefined

  const operationsGruppen = opNode ? childNames(ak, opNode.id) : []
  const einkaufGruppen = produktL1 ? childNames(ak, produktL1.id) : []
  const salesMarketingGruppen = smNode ? childNames(ak, smNode.id) : []

  // 1) Feste Übergruppen (Ebene 1, is_system) anlegen.
  const uebergruppen = [OPERATIONS, EINKAUF, SALES_MARKETING]
  const l1Rows = uebergruppen.map((name, i) => ({
    user_id: userId,
    plan_version_id: versionId,
    art: 'lp_investition',
    parent_id: null,
    name,
    level: 1,
    sort_order: i,
    is_system: true,
  }))

  const { data: insertedL1, error: l1Err } = await supabase
    .from('langfristige_kpi_kategorien')
    .insert(l1Rows)
    .select('id, name')
  if (l1Err || !insertedL1) return

  const idByName = new Map<string, string>(insertedL1.map(r => [r.name as string, r.id as string]))

  // 2) Gespiegelte Untergruppen (Ebene 2, is_system) je Übergruppe anlegen.
  const childGroups: Array<{ uebergruppe: string; namen: string[] }> = [
    { uebergruppe: OPERATIONS, namen: operationsGruppen },
    { uebergruppe: EINKAUF, namen: einkaufGruppen },
    { uebergruppe: SALES_MARKETING, namen: salesMarketingGruppen },
  ]

  const l2Rows: Array<Record<string, unknown>> = []
  for (const { uebergruppe, namen } of childGroups) {
    const parentId = idByName.get(uebergruppe)
    if (!parentId) continue
    namen.forEach((name, i) => {
      l2Rows.push({
        user_id: userId,
        plan_version_id: versionId,
        art: 'lp_investition',
        parent_id: parentId,
        name,
        level: 2,
        sort_order: i,
        is_system: true,
      })
    })
  }

  if (l2Rows.length > 0) {
    await supabase.from('langfristige_kpi_kategorien').insert(l2Rows)
  }
}
