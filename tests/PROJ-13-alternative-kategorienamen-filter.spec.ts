import { test, expect } from '@playwright/test'

// ─── Regression: Auth & Access ────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/rentabilitaet to /login (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is redirected from /dashboard/liquiditaet to /login (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: API auth ─────────────────────────────────────────────────────

test('GET /api/rentabilitaet redirects unauthenticated to login (regression)', async ({ page }) => {
  await page.goto('/api/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/liquiditaet redirects unauthenticated to login (regression)', async ({ page }) => {
  await page.goto('/api/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/kpi-categories redirects unauthenticated to login (regression)', async ({ page }) => {
  await page.goto('/api/kpi-categories')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Login page still renders ─────────────────────────────────────

test('login page renders correctly after PROJ-13 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: Dashboard still redirects ────────────────────────────────────

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app:
//
// RENTABILITÄTS-AUSWERTUNG
// AC-FILTER-09: Quelle = "Kosten" → Kategorie-Filter zeigt kosten_label (oder internen Namen als Fallback)
// AC-FILTER-10: Quelle = "Umsatz" → Kategorie-Filter zeigt internen Kategorienamen (unverändert)
// AC-FILTER-11: Anzeigetext im Filter konsistent mit Anzeigetext in der Tabellenspalte (Kosten-Zeilen)
// AC-FILTER-12: Filterwert bleibt kategorie_id — nur der angezeigte Name ändert sich, Filterlogik unverändert
// AC-FILTER-13: Gruppe-Filter und Untergruppe-Filter zeigen weiterhin interne Kategorienamen
//
// LIQUIDITÄTS-AUSWERTUNG
// AC-FILTER-09: Quelle = "Ausgaben" → Kategorie-Filter zeigt ausgaben_label (oder internen Namen als Fallback)
// AC-FILTER-10: Quelle = "Einnahmen" → Kategorie-Filter zeigt internen Kategorienamen (unverändert)
// AC-FILTER-11: Anzeigetext im Filter konsistent mit Anzeigetext in der Tabellenspalte (Ausgaben-Zeilen)
// AC-FILTER-12: Filterwert bleibt kategorie_id — Filterlogik unverändert
// AC-FILTER-13: Gruppe-Filter und Untergruppe-Filter zeigen weiterhin interne Kategorienamen
//
// ALLGEMEIN
// AC-GENERAL-01: Kein Quelle-Filter → Kategorie-Filter ausgeblendet (unveränderte Logik)
// AC-GENERAL-02: Beide Quellen gewählt → Kategorie-Filter ausgeblendet (unveränderte Logik)
// AC-GENERAL-03: "Filter zurücksetzen" leert alle Filter inkl. Kategorie
// AC-GENERAL-04: Tabellenspalten zeigen weiterhin kosten_label/ausgaben_label (Regression PROJ-10)
//
// EDGE CASES
// EC-01: kosten_label = null → Fallback auf internen Namen im Filter
// EC-02: Quelle von "Kosten" auf "Umsatz" wechseln → Kategorie-Filter wird zurückgesetzt, zeigt interne Namen
// EC-03: Zwei Kategorien mit gleichem kosten_label → beide als separate Optionen sichtbar
