import { test, expect } from '@playwright/test'

// PROJ-26 fügt ein Liniendiagramm zur bestehenden Rentabilitätsreport-Seite hinzu.
// Es wurde KEIN neuer API-Endpunkt eingeführt; die Linien-Auswahl ist rein
// clientseitiger State. Diese Test-Suite verifiziert:
//   1. Auth-Redirect der Seite bleibt korrekt
//   2. Bestehende API-Endpunkte (die das Chart konsumiert) sind weiterhin auth-gated
//   3. Existierende Routen sind weiterhin geschützt (Regression)

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/reporting/rentabilitaet', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Freporting%2Frentabilitaet/)
})

// ─── API Security (kein neuer Endpunkt, aber Re-Verifizierung) ─────────────────
//
// PROJ-26 fügt KEINEN neuen API-Endpunkt hinzu. Das Chart konsumiert ausschließlich
// Daten, die bereits durch use-reporting-rentabilitaet geladen werden. Wir
// re-verifizieren, dass die zugrundeliegenden Endpunkte weiterhin Auth verlangen,
// damit clientseitige Route-Mocks keine Daten leaken können.

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

// ─── Client-side mock bypass check ─────────────────────────────────────────────
//
// Selbst wenn ein Angreifer den API-Endpunkt clientseitig mockt — die Middleware
// leitet bereits den HTML-Request um, bevor JavaScript läuft. Das Chart kann
// nicht auf gemockte Daten zugreifen.

test('client-side API mock does NOT bypass middleware redirect for chart endpoint', async ({ page }) => {
  await page.route('/api/reporting/rentabilitaet*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        perioden: ['2026-01', '2026-02'],
        positionen: [
          {
            id: 'pos-bruttoumsatz',
            name: 'Bruttoumsatz',
            type: 'position',
            sort_order: 1,
            values: { '2026-01': 1000, '2026-02': 1500 },
            kategorien: [
              {
                id: 'kat-umsatz',
                name: 'Umsatz',
                kpi_type: 'umsatz',
                values: { '2026-01': 1000, '2026-02': 1500 },
                gruppen: [],
                sales_plattformen: [],
              },
            ],
          },
          {
            id: 'pos-summe-ebit',
            name: 'EBIT',
            type: 'summe',
            sort_order: 5,
            summe_refs: ['pos-bruttoumsatz'],
            values: { '2026-01': 1000, '2026-02': 1500 },
            kategorien: [],
          },
        ],
      }),
    })
  })

  await page.goto('/dashboard/reporting/rentabilitaet')
  // Middleware-Redirect verhindert dass der Mock überhaupt aufgerufen wird
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works (regression) ──────────────────────────────────────

test('login page still renders correctly after PROJ-26 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing dashboard pages still redirect unauthenticated ──────

test('dashboard page still redirects unauthenticated after PROJ-26 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet (alt) page still redirects unauthenticated after PROJ-26 (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-26 (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-26 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: dependency APIs still require auth ───────────────────────────

test('GET /api/report-positionen redirects unauthenticated to login after PROJ-26', async ({ page }) => {
  await page.goto('/api/report-positionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/produktkosten still redirects unauthenticated after PROJ-26', async ({ page }) => {
  await page.goto('/api/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/bestand-transaktionen still redirects unauthenticated after PROJ-26', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})
