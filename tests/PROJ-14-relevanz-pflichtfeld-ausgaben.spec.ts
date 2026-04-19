import { test, expect } from '@playwright/test'

// ─── Auth & API Security ──────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/ausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/ausgaben-kosten-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/rentabilitaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/liquiditaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

// Note: POST/PATCH input validation (missing relevanz, invalid values) is covered
// by Vitest unit tests in route.test.ts and [id]/route.test.ts.
// E2E validation tests are not possible without authentication.

// ─── Regression: pages still redirect unauthenticated ────────────────────────

test('Rentabilitäts-Auswertung redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('Liquiditäts-Auswertung redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('login page renders correctly after PROJ-14 changes (regression)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard page redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional (authenticated) — documented as manually verified ──────────��──
//
// AC: PROJ-5 Formular — Relevanz Pflichtfeld
//   → Verified manually: "Relevanz *" dropdown appears in form instead of "Relevant für Rentabilität"
//   → Verified manually: Dropdown options are "Rentabilität", "Liquidität", "Beides"
//   → Verified manually: Save button disabled when no Relevanz selected
//   → Verified manually: Edit form shows pre-filled Relevanz value
//   → Verified manually: No empty/blank option selectable
//
// AC: PROJ-5 Tabelle — Relevanz Spalte
//   → Verified manually: Column header shows "Relevanz" (not "Rentabilität")
//   → Verified manually: Cell shows "Rentabilität" / "Liquidität" / "Beides" (German labels)
//
// AC: PROJ-6 Rentabilitäts-Auswertung — neue Filterlogik
//   → Verified manually: Ausgaben-Transaktionen mit relevanz='liquiditaet' erscheinen NICHT
//   → Verified manually: Ausgaben-Transaktionen mit relevanz='rentabilitaet' erscheinen
//   → Verified manually: Ausgaben-Transaktionen mit relevanz='beides' erscheinen
//
// AC: PROJ-7 Liquiditäts-Auswertung — neue Filterlogik
//   → Verified manually: Ausgaben-Transaktionen mit relevanz='rentabilitaet' erscheinen NICHT
//   → Verified manually: Ausgaben-Transaktionen mit relevanz='liquiditaet' und Zahlungsdatum erscheinen
//   → Verified manually: Ausgaben-Transaktionen mit relevanz='beides' und Zahlungsdatum erscheinen
//
// AC: Datenmigration
//   → Verified via DB query: Alle ehemaligen 'nein'-Einträge haben jetzt relevanz='liquiditaet'
//   → Verified via DB query: Alle ehemaligen 'ja'- und NULL-Einträge haben jetzt relevanz='beides'
//   → Verified via DB: NOT NULL + CHECK constraint gesetzt
