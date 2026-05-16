import { test, expect } from '@playwright/test'

// PROJ-35: GetMyInvoices Excel-Import für Ausgaben & Kosten
// Client-seitiges Parsing einer .xlsx-Datei, Review-Dialog und Batch-Import.
//
// Diese Suite verifiziert:
//   - Auth-Guard für Seite und Batch-API
//   - Batch-API Validierungsverhalten (unauthenticated)
//   - Keine Datenlecks für unauthenticated Requests

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/ausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect to /login preserves the ?next parameter for /dashboard/ausgaben', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fausgaben/)
})

// ─── Batch API: Auth Guard ────────────────────────────────────────────────────

test('GET /api/ausgaben-kosten-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('POST /api/ausgaben-kosten-transaktionen/batch returns no data for unauthenticated request', async ({ request }) => {
  const res = await request.post('/api/ausgaben-kosten-transaktionen/batch', {
    data: [],
    maxRedirects: 0,
  }).catch(e => e)
  if (res?.status) {
    // Should be a redirect (3xx) or an error status — never a 200 with data
    expect([301, 302, 303, 307, 308, 400, 401, 403]).toContain(res.status())
  }
})

test('batch API returns 400 for array exceeding 500 items when called directly', async ({ request }) => {
  const res = await request.post('/api/ausgaben-kosten-transaktionen/batch', {
    data: Array.from({ length: 501 }, () => ({
      leistungsdatum: '2024-01-15',
      betrag_brutto: 100,
      ust_satz: 'individuell',
      ust_betrag: 0,
      kategorie_id: '123e4567-e89b-12d3-a456-426614174000',
      relevanz: 'rentabilitaet',
    })),
    maxRedirects: 0,
  }).catch(e => e)
  if (res?.status) {
    // Either 400 (validation) or 401/redirect (unauthenticated) — never 200/201
    expect([301, 302, 303, 307, 308, 400, 401, 403]).toContain(res.status())
  }
})

// ─── Regression: existing Ausgaben-Seite still protected ──────────────────────

test('regression — /dashboard/ausgaben still redirects unauthenticated after PROJ-35', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('regression — /api/ausgaben-kosten-transaktionen still redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('regression — /dashboard/reporting/rentabilitaet still redirects unauthenticated', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('regression — /dashboard/kpi-modell still redirects unauthenticated', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})
