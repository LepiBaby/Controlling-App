import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/reporting/rentabilitaet', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Freporting%2Frentabilitaet/)
})

// ─── API Security ─────────────────────────────────────────────────────────────
//
// The view-mode switcher is purely client-side state; the API contract did not
// change in PROJ-24. We re-verify that the dependency API endpoints remain
// protected so that no client-side mocking can leak data from a real session.

test('GET /api/reporting/rentabilitaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=monat redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet with quartal granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=quartal')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet with jahr granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2025-01&bis=2026-12&granularitaet=jahr')
  await expect(page).toHaveURL(/\/login/)
})

// PROJ-24 introduces no new URL parameters but the hook does fetch one period
// earlier in Wachstum mode. Verify that even shifted-von ranges still require auth.

test('GET /api/reporting/rentabilitaet with shifted-von (Wachstum-Modus) redirects unauthenticated', async ({ page }) => {
  // Wachstum-Modus mit Von=2026-02 → Hook fetched 2026-01 als Vorperiode
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet with Wachstum-Quartal shifted-von redirects unauthenticated', async ({ page }) => {
  // Wachstum + Quartal mit Von=2026-04 → Hook fetched 2026-01
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=quartal')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet with Wachstum-Jahr shifted-von redirects unauthenticated', async ({ page }) => {
  // Wachstum + Jahr mit Von=2026-01 → Hook fetched 2025-01
  await page.goto('/api/reporting/rentabilitaet?von=2025-01&bis=2026-12&granularitaet=jahr')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Client-side mock: confirm route mocking cannot bypass middleware ─────────
//
// Even if the client mocks /api/reporting/rentabilitaet via page.route, the
// initial server-rendered page request goes through middleware first and the
// user is redirected to /login before any client-side JS executes.

test('client-side API mock does NOT bypass middleware redirect', async ({ page }) => {
  await page.route('/api/reporting/rentabilitaet*', async (route) => {
    // Realistic test fixture: Bruttoumsatz 100 €, Kosten 30 € → 30,0 %
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        perioden: ['2026-04', '2026-05'],
        positionen: [
          {
            id: 'pos-umsatz',
            name: 'Bruttoumsatz',
            type: 'position',
            sort_order: 1,
            values: { '2026-04': 100, '2026-05': 150 },
            kategorien: [
              {
                id: 'kat-umsatz',
                name: 'Umsatz',
                kpi_type: 'umsatz',
                values: { '2026-04': 100, '2026-05': 150 },
                gruppen: [],
                sales_plattformen: [],
              },
            ],
          },
          {
            id: 'pos-kosten',
            name: 'Produktkosten',
            type: 'position',
            sort_order: 2,
            values: { '2026-04': -30, '2026-05': -45 },
            kategorien: [
              {
                id: 'kat-kosten',
                name: 'Kosten',
                kpi_type: 'ausgaben_kosten',
                values: { '2026-04': -30, '2026-05': -45 },
                gruppen: [],
                sales_plattformen: [],
              },
            ],
          },
        ],
      }),
    })
  })

  await page.goto('/dashboard/reporting/rentabilitaet')
  // Middleware redirect to /login takes precedence — client route mock never fires
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works (regression) ──────────────────────────────────────

test('login page still renders correctly after PROJ-24 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing pages still redirect unauthenticated ────────────────

test('dashboard page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet (alt) page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatz page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('einnahmen page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/einnahmen')
  await expect(page).toHaveURL(/\/login/)
})

test('produktkosten page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('bestandsverwaltung page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

test('investitionen page still redirects unauthenticated after PROJ-24 (regression)', async ({ page }) => {
  await page.goto('/dashboard/investitionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: dependency APIs still require auth ───────────────────────────

test('GET /api/bestand-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/produktkosten redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/report-positionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/report-positionen')
  await expect(page).toHaveURL(/\/login/)
})
