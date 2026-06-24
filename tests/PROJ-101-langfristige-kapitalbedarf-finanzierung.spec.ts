import { test, expect } from '@playwright/test'

// PROJ-101: Kapitalbedarf & Finanzierung — Langfristige Planung
//
// Versionsgebundene, EDITIERBARE Seite: /dashboard/langfristige-planung/[versionId]/kapitalbedarf-finanzierung
// Interaktionstests (Investitionen-Drill-Down + Obergruppen-Overrides, Betriebsmittelbedarf-Override/Reset,
// manuelle Zeilen anlegen/löschen/verschieben, EK/FK-Positionen inkl. Zinssatz/Laufzeit/Tilgungsfrei,
// Abgleich-Warnung) erfordern eine authentifizierte Session + eine Planversion mit Investitions-/
// Liquiditätsdaten und sind als manuell/code-geprüft dokumentiert. Die Kernlogik ist durch Vitest abgedeckt:
//   - Auto-Werte/Summen/Override-Logik: use-langfristige-kapitalbedarf-finanzierung.test.ts (9)
//   - API-Routen (CRUD, Reorder, Auth/Version/RLS-Pfade): route.test.ts (13) + [id]/route.test.ts (11)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/kapitalbedarf-finanzierung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Kapitalbedarf-&-Finanzierung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from Kapitalbedarf & Finanzierung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Schwesterseiten der Gruppe „Auswertungen" weiterhin erreichbar ──

test('langfristige Investitionsauswertung (PROJ-99) is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/investitionsauswertung`)
  expect(response?.status()).toBeLessThan(400)
})

test('langfristige Liquiditätsauswertung (PROJ-94) is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/liquiditaetsauswertung`)
  expect(response?.status()).toBeLessThan(400)
})

test('langfristige Investitionsausgaben Planung (PROJ-92) is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/investitionsausgaben-planung`)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})
