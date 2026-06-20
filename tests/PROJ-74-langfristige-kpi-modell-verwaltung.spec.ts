import { test, expect } from '@playwright/test'

// PROJ-74: KPI-Modell Verwaltung — Langfristige Planung
//
// Die Seite ist versionsgebunden: /dashboard/langfristige-planung/[versionId]/kpi-modell-verwaltung
// Sie zeigt vier Reiter (Sales Plattform, Produkte, Marketingkanäle, Investitionen), alle pro
// Planversion isoliert. Interaktionstests (Anlegen/Umbenennen/Löschen/Sortieren, Untergruppen bei
// Investitionen, Versionsisolation) erfordern eine authentifizierte Session + angelegte Planversion
// und sind als manuell/Code-geprüft dokumentiert. Die API ist durch Vitest abgedeckt
// (route.test.ts + [id]/route.test.ts = 23 Tests); Baum-/Tree-Logik durch use-kpi-categories.test.ts.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/kpi-modell-verwaltung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene KPI-Modell-Verwaltung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige KPI-Modell Verwaltung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: alter Slug existiert nicht mehr als echte Seite ─────────────
// Der frühere Slug "plattformen-produkte" wurde umbenannt; er fällt jetzt auf die
// dynamische Platzhalterseite zurück (kein 404) und ist hinter dem Auth-Guard.

test('renamed slug still resolves without 404 (auth-guarded)', async ({ page }) => {
  const response = await page.goto(
    `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/plattformen-produkte`,
  )
  expect(response?.status()).toBeLessThan(400)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: globale KPI-Modell-Verwaltung weiterhin erreichbar ──────────
// Stellt sicher, dass die additiven Änderungen (CategoryType, addPlaceholder)
// die bestehende globale Seite nicht beschädigt haben.

test('/dashboard/kpi-modell is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kpi-modell')
  expect(response?.status()).toBeLessThan(400)
})
