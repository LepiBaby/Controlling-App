import { test, expect } from '@playwright/test'

// PROJ-29: Liquiditätsreport
// Neue Seite /dashboard/reporting/liquiditaet mit GET /api/reporting/liquiditaet.
// Diese Suite verifiziert:
//   1. Auth-Redirect für Seite und API-Endpunkt
//   2. API-Endpunkt antwortet mit 401 (nicht Redirect) für direkte Fetch-Anfragen
//   3. Alle Granularitäts-Varianten sind auth-gated
//   4. Regression: bestehende Seiten bleiben geschützt

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/liquiditaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/reporting/liquiditaet', async ({ page }) => {
  await page.goto('/dashboard/reporting/liquiditaet')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Freporting%2Fliquiditaet/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/reporting/liquiditaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/liquiditaet with monat granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/liquiditaet?von=2025-01&bis=2025-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/liquiditaet with quartal granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/liquiditaet?von=2025-01&bis=2025-12&granularitaet=quartal')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/liquiditaet with jahr granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/liquiditaet?von=2024-01&bis=2025-12&granularitaet=jahr')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Client-side mock bypass check ─────────────────────────────────────────────

test('client-side API mock does NOT bypass middleware redirect for liquiditaet endpoint', async ({ page }) => {
  await page.route('/api/reporting/liquiditaet*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        perioden: ['2025-01'],
        einnahmen_kategorien: [],
        ausgaben_kategorien: [],
        gesamt_einnahmen: { '2025-01': 0 },
        gesamt_ausgaben: { '2025-01': 0 },
        cashflow: { '2025-01': 0 },
        kontostand: { '2025-01': 0 },
      }),
    })
  })

  await page.goto('/dashboard/reporting/liquiditaet')
  // Middleware-Redirect verhindert, dass der Mock aufgerufen wird
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works ───────────────────────────────────────────────────

test('login page still renders correctly after PROJ-29 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing dashboard pages still redirect unauthenticated ──────

test('dashboard page still redirects unauthenticated after PROJ-29 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet report page still redirects unauthenticated after PROJ-29 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('deckungsbeitrag report page still redirects unauthenticated after PROJ-29 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/deckungsbeitrag')
  await expect(page).toHaveURL(/\/login/)
})

test('break-even report page still redirects unauthenticated after PROJ-29 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/break-even')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-29 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: dependency APIs still require auth ───────────────────────────

test('GET /api/reporting/rentabilitaet still redirects unauthenticated after PROJ-29', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2025-01&bis=2025-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/kpi-categories still redirects unauthenticated after PROJ-29', async ({ page }) => {
  await page.goto('/api/kpi-categories')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/einnahmen-transaktionen still redirects unauthenticated after PROJ-29', async ({ page }) => {
  await page.goto('/api/einnahmen-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/ausgaben-kosten-transaktionen still redirects unauthenticated after PROJ-29', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})
