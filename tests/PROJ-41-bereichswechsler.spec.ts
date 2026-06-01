import { test, expect } from '@playwright/test'

// PROJ-41: Bereichswechsler — Plattform-Navigation
//
// Neue Seiten /dashboard/kurzfristige-planung und /dashboard/langfristige-planung
// leiten unauthentifizierte Nutzer wie alle anderen Dashboard-Unterseiten zu /login weiter.
// Interaktionstests (Karten-Switcher, NavSheet-Dropdown, Bereichsnavigation) erfordern
// eine authentifizierte Session und sind als manuell geprüft dokumentiert.

// ─── URL-Struktur: Neue Seiten existieren (kein 404) ─────────────────────────

test('/dashboard/kurzfristige-planung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung')
  // Final response after all redirects (incl. client-side redirect to /login) is HTTP 200
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/langfristige-planung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/langfristige-planung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard: Neue Seiten schützen wie alle anderen Dashboard-Seiten ───────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: /dashboard Auth-Guard unverändert ───────────────────────────

test('unauthenticated user is redirected from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Bestehende Dashboard-Seiten nicht betroffen ─────────────────

test('unauthenticated user is redirected from /dashboard/kpi-modell to /login', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// - BereichsKartenSwitcher zeigt drei große Karten (Reporting aktiv hervorgehoben)
// - NavSheet: Bereichswechsler-Dropdown oben, drei Optionen sichtbar
// - Wechsel zu "Kurzfristige Planung" zeigt Placeholder-Text
// - Wechsel zu "Langfristige Planung" zeigt Placeholder-Text
// - Klick auf inaktive Karte navigiert korrekt zur Ziel-URL
// - Browser-Zurück-Button navigiert zurück zum vorherigen Bereich
// - Nav-Einträge im Sheet verschwinden beim Wechsel zu Nicht-Reporting-Bereichen
