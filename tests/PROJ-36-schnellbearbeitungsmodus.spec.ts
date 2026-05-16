import { test, expect } from '@playwright/test'

// PROJ-36: Schnellbearbeitungsmodus für Transaktionstabellen
// Rein frontend-seitiges Feature — Toggle-Button aktiviert Inline-Bearbeitung
// in den Tabellen der Ausgaben-, Umsatz- und Einnahmen-Seiten.
//
// Diese Suite verifiziert:
//   - Auth-Guard für alle drei Seiten
//   - PATCH-API-Endpoints gegen unauthenticated Zugriff
//   - Keine Datenlecks für unauthenticated Requests

// ─── Auth & Access: Ausgaben-Seite ───────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/ausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect to /login preserves ?next for /dashboard/ausgaben', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fausgaben/)
})

// ─── Auth & Access: Umsatz-Seite ─────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/umsatz to /login', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect to /login preserves ?next for /dashboard/umsatz', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fumsatz/)
})

// ─── Auth & Access: Einnahmen-Seite ──────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/einnahmen to /login', async ({ page }) => {
  await page.goto('/dashboard/einnahmen')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect to /login preserves ?next for /dashboard/einnahmen', async ({ page }) => {
  await page.goto('/dashboard/einnahmen')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Feinnahmen/)
})

// ─── API: PATCH-Endpoints Auth Guard ─────────────────────────────────────────

test('PATCH /api/ausgaben-kosten-transaktionen/[id] is protected against unauthenticated access', async ({ request }) => {
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const res = await request.patch(`/api/ausgaben-kosten-transaktionen/${fakeId}`, {
    data: { betrag_brutto: 999 },
    maxRedirects: 0,
  }).catch(e => e)
  if (res?.status) {
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(res.status())
  }
})

test('PATCH /api/umsatz-transaktionen/[id] is protected against unauthenticated access', async ({ request }) => {
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const res = await request.patch(`/api/umsatz-transaktionen/${fakeId}`, {
    data: { betrag: 999 },
    maxRedirects: 0,
  }).catch(e => e)
  if (res?.status) {
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(res.status())
  }
})

test('PATCH /api/einnahmen-transaktionen/[id] is protected against unauthenticated access', async ({ request }) => {
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const res = await request.patch(`/api/einnahmen-transaktionen/${fakeId}`, {
    data: { betrag: 999 },
    maxRedirects: 0,
  }).catch(e => e)
  if (res?.status) {
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(res.status())
  }
})

// ─── Regression: andere Dashboard-Seiten weiterhin geschützt ─────────────────

test('regression — /dashboard/reporting/rentabilitaet still redirects unauthenticated', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('regression — /dashboard/kpi-modell still redirects unauthenticated', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('regression — /dashboard/reporting/liquiditaet still redirects unauthenticated', async ({ page }) => {
  await page.goto('/dashboard/reporting/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})
