import { test, expect } from '@playwright/test'

// PROJ-40: Betragsselektion in Transaktionstabellen
// Rein frontend-seitiges Feature — Betragsfelder in Umsatz-, Einnahmen- und
// Ausgaben-Tabellen sind per Klick selektierbar; Summe erscheint rechts unten.
//
// UI-Interaktionstests (Klick, Drag, Badge) erfordern eingeloggten Nutzer
// und werden als manuell geprüft dokumentiert.
// Diese Suite prüft: Auth-Guard für alle drei betroffenen Seiten.

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

// ─── Auth & Access: Bestandsverwaltung-Seite ─────────────────────────────────

test('unauthenticated user is redirected from /dashboard/bestandsverwaltung to /login', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect to /login preserves ?next for /dashboard/bestandsverwaltung', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fbestandsverwaltung/)
})

// ─── Auth & Access: Produktkosten-Seite ──────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/produktkosten to /login', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect to /login preserves ?next for /dashboard/produktkosten', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fproduktkosten/)
})
