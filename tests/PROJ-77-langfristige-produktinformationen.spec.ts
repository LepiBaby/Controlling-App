import { test, expect } from '@playwright/test'

// PROJ-77: Produktinformationen — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/produktinformationen
// Wiederverwendung der Kurzfristig-Reiter (PROJ-59), gespeist mit den Produkten dieser
// Planversion (art = 'lp_produkt'); MOQ nur auf Produktebene; globale Werte pro Version.
// Interaktionstests (Auto-Save je Tab, Versionsisolation, Cascade-Löschung) erfordern eine
// authentifizierte Session + angelegte Planversion und sind als manuell/Code-/DB-geprüft
// dokumentiert. Die 11 API-Routen sind durch Vitest abgedeckt (61 Tests); FK-Cascade & RLS
// sind per DB-Introspektion verifiziert.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/produktinformationen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Produktinformationen-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Produktinformationen to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: globale Kurzfristig-Produktinformationen weiterhin erreichbar ─
// Stellt sicher, dass die Parametrisierung der Reiter/Hooks (versionId optional)
// die bestehende Kurzfristig-Seite nicht beschädigt hat.

test('/dashboard/kurzfristige-planung/produktinformationen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/produktinformationen')
  expect(response?.status()).toBeLessThan(400)
})
