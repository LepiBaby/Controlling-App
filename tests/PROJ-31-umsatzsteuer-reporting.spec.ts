import { test, expect } from '@playwright/test'

// PROJ-31: Umsatzsteuer-Reporting
// Neue Seite /dashboard/reporting/umsatzsteuer mit GET /api/reporting/umsatzsteuer.
// Diese Suite verifiziert:
//   1. Auth-Redirect für Seite und API-Endpunkt
//   2. Alle Granularitäts-Varianten sind auth-gated
//   3. Client-side mock bypass check
//   4. Regression: bestehende Seiten bleiben geschützt

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/umsatzsteuer to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/umsatzsteuer')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/reporting/umsatzsteuer', async ({ page }) => {
  await page.goto('/dashboard/reporting/umsatzsteuer')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Freporting%2Fumsatzsteuer/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/reporting/umsatzsteuer redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/umsatzsteuer')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/umsatzsteuer with monat granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/umsatzsteuer?von=2025-01&bis=2025-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/umsatzsteuer with quartal granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/umsatzsteuer?von=2025-01&bis=2025-12&granularitaet=quartal')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/umsatzsteuer with jahr granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/umsatzsteuer?von=2024-01&bis=2025-12&granularitaet=jahr')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API Input Validation (via fetch — no auth cookie, expects redirect) ─────

test('GET /api/reporting/umsatzsteuer with invalid von format redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/umsatzsteuer?von=2025&bis=2025-12')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/umsatzsteuer with von > bis redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/umsatzsteuer?von=2025-12&bis=2025-01')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Client-side mock bypass check ───────────────────────────────────────────

test('client-side API mock does NOT bypass middleware redirect for umsatzsteuer endpoint', async ({ page }) => {
  await page.route('/api/reporting/umsatzsteuer*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        perioden: ['2025-01'],
        abzufuehrendeUst: { kategorien: [], summe: { '2025-01': 0 } },
        abziehbareVorsteuer: { kategorien: [], summe: { '2025-01': 0 } },
        faelligeUst: { '2025-01': 0 },
      }),
    })
  })

  await page.goto('/dashboard/reporting/umsatzsteuer')
  // Middleware-Redirect verhindert, dass der Mock aufgerufen wird
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works ───────────────────────────────────────────────────

test('login page still renders correctly after PROJ-31 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing reporting pages still redirect unauthenticated ──────

test('dashboard page still redirects unauthenticated after PROJ-31 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet report page still redirects unauthenticated after PROJ-31 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('deckungsbeitrag report page still redirects unauthenticated after PROJ-31 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/deckungsbeitrag')
  await expect(page).toHaveURL(/\/login/)
})

test('break-even report page still redirects unauthenticated after PROJ-31 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/break-even')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet report page still redirects unauthenticated after PROJ-31 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('vorsteuer page still redirects unauthenticated after PROJ-31 (regression)', async ({ page }) => {
  await page.goto('/dashboard/vorsteuer')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: dependency APIs still require auth ───────────────────────────

test('GET /api/reporting/rentabilitaet still redirects unauthenticated after PROJ-31', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2025-01&bis=2025-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/kpi-categories still redirects unauthenticated after PROJ-31', async ({ page }) => {
  await page.goto('/api/kpi-categories')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/umsatz-transaktionen still redirects unauthenticated after PROJ-31', async ({ page }) => {
  await page.goto('/api/umsatz-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/ausgaben-kosten-transaktionen still redirects unauthenticated after PROJ-31', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/vorsteuer still redirects unauthenticated after PROJ-31', async ({ page }) => {
  await page.goto('/api/vorsteuer')
  await expect(page).toHaveURL(/\/login/)
})
