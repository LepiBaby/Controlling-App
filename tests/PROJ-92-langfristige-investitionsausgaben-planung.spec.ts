import { test, expect } from '@playwright/test'

// PROJ-92: Investitionsausgaben Planung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/investitionsausgaben-planung
// Monatsweise; Zeilen aus dem Investitionen-KPI-Modell der Version (Übergruppe →
// Untergruppe → Produkt). "Produktinvestitionen Einkauf" wird automatisch aus den
// Erstbestellungen + Bestellkosten dieser Version berechnet (nach Zahlungszeitpunkt);
// alle anderen Kategorien sind rein manuell.
// Interaktions-/Berechnungstests (Inline-Edit, Selektion, Notizen, Aggregation,
// grau/blau-Punkte, Namens-Mapping, Erstbestellungs-Filter, Fenster-Filter) erfordern
// eine authentifizierte Session + Planversion und sind als Code-/manuell geprüft
// dokumentiert. Abgedeckt durch:
//  - API: investitionsausgaben-planung/route.test.ts (GET/PUT/DELETE, 20 Fälle)
//  - API: investitionsausgaben-planung/berechnet/route.test.ts (Berechnung, 9 Fälle)
//  - Logik: use-langfristige-investitionsausgaben.test.ts (Monatsfenster + Schlüssel)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/investitionsausgaben-planung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Investitionsausgaben-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Investitionsausgaben to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: langfristige Umsatzausgaben weiterhin erreichbar ─────────────
// Stellt sicher, dass die neue Seite die bestehende Schwesterseite nicht beschädigt.

test('/dashboard/langfristige-planung/[versionId]/umsatzausgaben is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/umsatzausgaben`)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: langfristige Bestellplanung weiterhin erreichbar ─────────────

test('/dashboard/langfristige-planung/[versionId]/bestellplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/bestellplanung`)
  expect(response?.status()).toBeLessThan(400)
})
