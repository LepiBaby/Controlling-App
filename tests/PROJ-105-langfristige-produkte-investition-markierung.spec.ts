import { test, expect } from '@playwright/test'

// PROJ-105: Produkte als Investition markieren — Langfristige Planung
//
// Die Markierung wird per PATCH /kpi-kategorien/[id] gepflegt und auf der
// Investitionsausgaben-Planung ausgewertet; manuell ergänzte Produktzeilen liegen
// unter .../investitionsausgaben-planung/produktzeilen (GET/PUT/DELETE).
// Interaktive Flows erfordern eine authentifizierte Session + Daten und sind im
// Feature-Spec über Code-Audit + DB-Verifikation dokumentiert. Die API-/Auswahllogik
// ist durch Vitest abgedeckt:
//   - investitionsausgaben-planung/produktzeilen/route.test.ts (18 Tests)
//   - use-langfristige-investitionsausgaben.produktzeilen.test.ts (4 Tests)
//   - kpi-kategorien/[id]/route.test.ts (ist_investition im PATCH)
// Diese E2E-Datei sichert die Auth-Guards der neuen/erweiterten Endpunkte + Seiten.

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const KATEGORIE_ID = '22222222-2222-4222-8222-222222222222'
const BASE = `/api/langfristige-planung/${VERSION_ID}`
const PRODUKTZEILEN_URL = `${BASE}/investitionsausgaben-planung/produktzeilen`
const KPI_PATCH_URL = `${BASE}/kpi-kategorien/${KATEGORIE_ID}`

// ─── Auth-Guard: Produktzeilen-Endpunkt (neu) ────────────────────────────────

test('unauthenticated GET to produktzeilen is blocked (redirect to /login)', async ({ page }) => {
  const res = await page.request.get(PRODUKTZEILEN_URL)
  expect(res.url()).toMatch(/\/login/)
})

test('unauthenticated PUT to produktzeilen is blocked (redirect to /login)', async ({ page }) => {
  const res = await page.request.put(PRODUKTZEILEN_URL, {
    data: { kategorie_id: KATEGORIE_ID, produkt_id: KATEGORIE_ID },
  })
  expect(res.url()).toMatch(/\/login/)
})

test('unauthenticated DELETE to produktzeilen is blocked (redirect to /login)', async ({ page }) => {
  const res = await page.request.delete(PRODUKTZEILEN_URL, {
    data: { kategorie_id: KATEGORIE_ID, produkt_id: KATEGORIE_ID },
  })
  expect(res.url()).toMatch(/\/login/)
})

// ─── Auth-Guard: KPI-Kategorien PATCH (ist_investition-Markierung) ───────────

test('unauthenticated PATCH to kpi-kategorien (ist_investition) is blocked (redirect to /login)', async ({ page }) => {
  const res = await page.request.patch(KPI_PATCH_URL, { data: { ist_investition: true } })
  expect(res.url()).toMatch(/\/login/)
})

// ─── Auth-Guard: Auswertungs- & Pflegeseiten ────────────────────────────────

test('unauthenticated user is redirected from the investitionsausgaben-planung page to /login', async ({ page }) => {
  await page.goto(`/dashboard/langfristige-planung/${VERSION_ID}/investitionsausgaben-planung`)
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is redirected from the kpi-modell-verwaltung page to /login', async ({ page }) => {
  await page.goto(`/dashboard/langfristige-planung/${VERSION_ID}/kpi-modell-verwaltung`)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: unabhängige Bereiche weiterhin erreichbar ───────────────────

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})
