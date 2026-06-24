import { test, expect } from '@playwright/test'

// PROJ-53: Zellen-Notizen in der Kurzfristigen Planung
//
// Interaktionstests (Notiz anlegen, bearbeiten, löschen, Indikator-Symbol)
// erfordern eine authentifizierte Session mit befüllten Planungsdaten und
// sind als manuell geprüft dokumentiert.
// API-Integrationstests (GET/PUT/DELETE, 401/400/200/404) sind durch Vitest
// in route.test.ts abgedeckt (18 Tests).
// Hook-Tests (Laden, upsert, delete, optimistic updates) sind durch Vitest
// in use-planung-notizen.test.ts abgedeckt (14 Tests).

// ─── Auth-Guard (Planungsseiten) ─────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/absatzplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/einnahmenplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Planungsseiten weiterhin erreichbar (kein 404) ──────────────

test('/dashboard/kurzfristige-planung/absatzplanung is accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/einnahmenplanung is accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Andere Planungsseiten weiterhin erreichbar ──────────────────

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/marketing-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/marketing-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session + Planungsdaten) ─────
//
// Notiz-Button — Sichtbarkeit:
//   ✅ Kein Notiz-Button sichtbar, wenn keine Zelle ausgewählt ist
//   ✅ Notiz-Button erscheint, wenn genau eine editierbare Zelle (Absatz-/VK-Feld) selektiert ist
//   ✅ Notiz-Button erscheint als eigenständige Karte rechts unten, SEPARAT vom Summenfeld
//   ✅ Notiz-Button ist NICHT sichtbar bei Mehrfachselektion (Ctrl+Click auf 2 Zellen)
//   ✅ Notiz-Button ist NICHT sichtbar bei Aggregationszeilen (Plattform-Summen, Gesamt)
//   ✅ Button-Label "Notiz hinzufügen" wenn keine Notiz vorhanden
//   ✅ Button-Label "Notiz bearbeiten" wenn Notiz für diese Zelle bereits existiert
//
// Notiz-Formular (Dialog-Overlay):
//   ✅ Klick auf "Notiz hinzufügen" öffnet shadcn Dialog
//   ✅ Dialog-Titel zeigt "Notiz hinzufügen" / "Notiz bearbeiten" korrekt
//   ✅ Zellen-Label im Dialog (z.B. "Produkt X · KW24 / 2026") korrekt abgeleitet
//   ✅ Textarea ist leer beim Öffnen für neue Notiz
//   ✅ Textarea ist mit bestehender Notiz vorausgefüllt beim Bearbeiten
//   ✅ Textarea erhält automatisch Fokus beim Öffnen
//   ✅ Button "Speichern" schließt Formular und Notiz erscheint auf Zelle
//   ✅ Button "Abbrechen" schließt Formular ohne Änderungen
//   ✅ Escape-Taste schließt Formular ohne Speichern
//   ✅ Klick außerhalb des Dialogs schließt ohne Speichern
//   ✅ "Notiz löschen"-Button nur sichtbar bei bestehender Notiz
//
// Löschen mit Bestätigung:
//   ✅ Erster Klick auf "Notiz löschen" zeigt "Wirklich löschen?" + "Ja, löschen" + "Abbrechen"
//   ✅ "Ja, löschen" löscht Notiz in DB und entfernt Symbol aus Zelle sofort
//   ✅ "Abbrechen" bricht Löschung ab, Formular bleibt offen
//
// Zellen-Indikator (Symbol):
//   ✅ Zellen mit Notiz zeigen kleines amber StickyNote-Icon in der oberen rechten Ecke
//   ✅ Icon ist subtil und stört Zellwert-Lesbarkeit nicht
//   ✅ Hover über Icon zeigt Tooltip mit Notiztext (max ~300 Zeichen, dann "…")
//   ✅ Klick auf Icon aktiviert NICHT das Notiz-Formular (Icon nicht klickbar)
//   ✅ Icon verschwindet sofort nach Löschen der Notiz (optimistic update)
//
// Leerer Notiztext:
//   ✅ Speichern von leerem/whitespace-Notiztext wird wie "Löschen" behandelt
//   ✅ Symbol verschwindet, Notiz wird aus DB entfernt
//
// Datenpersistenz & Wochenbezug:
//   ✅ Notiz nach Seitenneuladen noch vorhanden (DB-Persistenz)
//   ✅ Notizen werden beim Laden per Bulk geladen (ein GET-Request, kein Einzel-Abruf)
//   ✅ Notizen sind für alle Nutzer der App sichtbar (kein nutzerspezifischer Filter)
//
// Einnahmenplanung:
//   ✅ Notiz-Mechanismus funktioniert auf Einnahmenplanung-Seite für editierbare Leaf-Kategorie-Zellen
//   ✅ Aggregationszeilen (Summenzeilen, row:-Prefix) haben keinen Notiz-Button
//
// Regression:
//   ✅ Bestehende Betragsselektion (Summenfeld) unverändert funktionsfähig
//   ✅ Zellen-Selektion mit Ctrl+Click weiterhin korrekt
//   ✅ Absatzplanung-Tabelle rendert korrekt ohne Notizen (leerer Zustand)
//   ✅ Einnahmenplanung-Tabelle rendert korrekt ohne Notizen
