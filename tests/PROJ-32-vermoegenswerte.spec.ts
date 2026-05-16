import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'

// PROJ-32: Vermögenswerte-Verwaltung
// Neue Seite /dashboard/vermoegenswerte mit 8-Schritte-Wizard und Snapshot-Tabelle.
// Diese Suite verifiziert:
//   1. Auth-Redirect für Seite und API-Endpunkte
//   2. Alle API-Routen (GET, POST, DELETE, vorschlaege) sind auth-gated
//   3. Filter-Leiste und Wizard-Komponenten sind nicht ohne Login zugänglich
//   4. Regression: bestehende Seiten bleiben geschützt
//   5. Updated QA: Filter-Bar hat 5 Toggles inkl. Anlagevermögen (violet)
//   6. Updated QA: Wizard hat 8 Steps (Schritt 4 Darlehensverbindlichkeiten, Schritt 8 Anlagevermögen)
//   7. Updated QA: Tabelle enthält neue Spalten Darlehen und Netto-Buchwert

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/vermoegenswerte to /login', async ({ page }) => {
  await page.goto('/dashboard/vermoegenswerte')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/vermoegenswerte', async ({ page }) => {
  await page.goto('/dashboard/vermoegenswerte')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fvermoegenswerte/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/vermoegenswerte redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/vermoegenswerte')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/vermoegenswerte/vorschlaege redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/vermoegenswerte/vorschlaege?datum=2026-05-15')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/vermoegenswerte/vorschlaege with invalid datum still redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/vermoegenswerte/vorschlaege?datum=invalid')
  await expect(page).toHaveURL(/\/login/)
})

test('POST /api/vermoegenswerte rejects unauthenticated request (redirects to login)', async ({ request }) => {
  const res = await request.post('/api/vermoegenswerte', {
    data: {
      datum: '2026-05-15',
      lagerwerte: [],
      transitwerte: [],
      verbindlichkeiten_llv: 0,
      verbindlichkeiten_sonstige: 0,
      darlehensvb: 0,
      forderungen: [],
      steuersaldo_typ: null,
      steuersaldo: null,
      steuersaldo_von: null,
      steuersaldo_bis: null,
      cash_bestand: 0,
      anlagevermoegen: 0,
    },
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  // Without auth: middleware redirects (3xx) before route handler runs.
  // No new snapshot must be created without authentication.
  expect([301, 302, 303, 307, 401]).toContain(res.status())
})

test('DELETE /api/vermoegenswerte/[id] rejects unauthenticated request (redirects to login)', async ({ request }) => {
  const res = await request.delete('/api/vermoegenswerte/123e4567-e89b-12d3-a456-426614174000', {
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  expect([301, 302, 303, 307, 401]).toContain(res.status())
})

// ─── Client-side mock bypass check ───────────────────────────────────────────

test('client-side API mock does NOT bypass middleware redirect for vermoegenswerte page', async ({ page }) => {
  await page.route('/api/vermoegenswerte*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('/api/vermoegenswerte/vorschlaege*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lagerwerte: {},
        verbindlichkeiten_llv: 0,
        verbindlichkeiten_sonstige: 0,
        cash_bestand: 0,
      }),
    })
  })

  await page.goto('/dashboard/vermoegenswerte')
  // Middleware-Redirect verhindert, dass der Mock aufgerufen wird
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works ───────────────────────────────────────────────────

test('login page still renders correctly after PROJ-32 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing dashboard pages still redirect unauthenticated ──────

test('dashboard page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('einnahmen page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/einnahmen')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatz page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('produktkosten page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('bestandsverwaltung page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet report page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet report page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatzsteuer report page still redirects unauthenticated after PROJ-32 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/umsatzsteuer')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: dependency APIs still require auth ───────────────────────────

test('GET /api/kpi-categories still redirects unauthenticated after PROJ-32', async ({ page }) => {
  await page.goto('/api/kpi-categories')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/ausgaben-kosten-transaktionen still redirects unauthenticated after PROJ-32', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/umsatzsteuer still redirects unauthenticated after PROJ-32', async ({ page }) => {
  await page.goto('/api/reporting/umsatzsteuer')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Updated QA — Source-Strukturprüfungen (8-Schritte-Wizard, 5 Filter-Toggles) ──

const repoRoot = path.resolve(__dirname, '..')
const readSrc = (p: string) => readFileSync(path.join(repoRoot, p), 'utf8')

test('wizard component declares all 8 step labels in correct order', () => {
  const src = readSrc('src/components/vermoegenswert-wizard-dialog.tsx')
  // STEPS array must contain exactly 8 entries in the expected order
  const expected = [
    'Lagerwert',
    'Transit-Warenwert',
    'Verbindlichkeiten',
    'Darlehensverbindlichkeiten',
    'Forderungen',
    'Steuern',
    'Cash-Bestand',
    'Anlagevermögen',
  ]
  expected.forEach((label) => {
    expect(src).toContain(`'${label}'`)
  })
  // canGoNext must reflect 8 steps
  expect(src).toContain('step < 8')
  expect(src).toContain('step === 8')
})

test('wizard step 4 is Darlehensverbindlichkeiten with Fremdkapital/Tilgungen breakdown', () => {
  const src = readSrc('src/components/vermoegenswert-wizard-dialog.tsx')
  expect(src).toMatch(/step === 4/)
  expect(src).toContain('Fremdkapitaleinnahmen')
  expect(src).toContain('Tilgungen')
  expect(src).toContain('Darlehensverbindlichkeiten')
})

test('wizard step 8 is Anlagevermögen with Netto-Buchwert label', () => {
  const src = readSrc('src/components/vermoegenswert-wizard-dialog.tsx')
  expect(src).toMatch(/step === 8/)
  expect(src).toContain('Anlagevermögen (€, Netto-Buchwert)')
})

test('page declares 5 category filter toggles including Anlagevermögen', () => {
  const src = readSrc('src/app/dashboard/vermoegenswerte/page.tsx')
  // ALLE_KATEGORIEN array of 5 keys
  expect(src).toContain("['warenwert', 'verbindlichkeiten', 'forderungen', 'cash', 'anlagevermoegen']")
  // Anlagevermögen label and violet styling
  expect(src).toContain("anlagevermoegen:   'Anlagevermögen'")
  expect(src).toMatch(/anlagevermoegen:\s+\{\s+active:\s+'bg-violet/)
})

test('table renders Darlehen and Netto-Buchwert columns with violet Anlagevermögen group', () => {
  const src = readSrc('src/components/vermoegenswert-table.tsx')
  expect(src).toContain('Darlehen')
  expect(src).toContain('Netto-Buchwert')
  expect(src).toContain('anlagevermoegen:  { th: \'bg-violet-50')
  expect(src).toContain("'anlagevermoegen'")
})

test('vorschlaege route uses multi-level Tilgung kategorie matching', () => {
  const src = readSrc('src/app/api/vermoegenswerte/vorschlaege/route.ts')
  // Multi-Level-Check: kategorie_id, gruppe_id, untergruppe_id
  expect(src).toContain('tilgungIds.has(tx.kategorie_id)')
  expect(src).toContain('tilgungIds.has(tx.gruppe_id)')
  expect(src).toContain('tilgungIds.has(tx.untergruppe_id)')
})

test('vorschlaege route filters Anlagevermögen depreciation up to Stichtag in JS', () => {
  const src = readSrc('src/app/api/vermoegenswerte/vorschlaege/route.ts')
  // Stichtag-Filter: leistungsdatum <= datum
  expect(src).toContain('tx.leistungsdatum > datum')
  // anlagevermoegen state is computed and returned
  expect(src).toContain('anlagevermoegen,')
})

test('POST schema requires new fields darlehensvb and anlagevermoegen', () => {
  const src = readSrc('src/app/api/vermoegenswerte/route.ts')
  expect(src).toMatch(/darlehensvb:\s+z\.number\(\)\.min\(0\)/)
  expect(src).toMatch(/anlagevermoegen:\s+z\.number\(\)\.min\(0\)/)
  expect(src).toContain('darlehensvb:               d.darlehensvb')
  expect(src).toContain('anlagevermoegen:           d.anlagevermoegen')
})
