import { test, expect } from '@playwright/test'

// PROJ-59: Produktinformationen — Kurzfristige Planung
//
// Interaktionstests (Tab-Navigation, Formularfelder, CRUD) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests sind durch Vitest abgedeckt (84 Tests ✅).

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/produktinformationen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/produktinformationen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthentifizierter Nutzer wird von /dashboard/kurzfristige-planung/produktinformationen zu /login weitergeleitet', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/produktinformationen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Planung Landing-Seite ─────────────────────────

test('unauthentifizierter Nutzer wird von /dashboard/kurzfristige-planung zu /login weitergeleitet', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Andere Einstellungsseiten weiterhin erreichbar ─────────────

test('/dashboard/kurzfristige-planung/finanzierungseinstellungen ist weiterhin erreichbar (kein 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/finanzierungseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/absatzeinstellungen ist weiterhin erreichbar (kein 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/grundeinstellungen ist weiterhin erreichbar (kein 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
//
// Navigation & Einstieg:
//   ✅ Linke Navigation → "Kurzfristige Planung" → Eintrag "Produktinformationen" vorhanden
//   ✅ Kachel "Produktinformationen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Auth-Guard: Weiterleitung zu /login für unauthentifizierte Nutzer ✅ (Playwright)
//   ✅ Seite zeigt 7 Tabs: Hersteller, MOQ, Containerkapazität, Lieferzeit,
//      Zahlungskonditionen, Produktkosten, Bestandsverwaltung
//   ✅ Erster Tab "Hersteller" ist beim Laden automatisch aktiv
//   ✅ Tab-Leiste nimmt die volle Breite ein
//
// Tab 1 — Hersteller:
//   ✅ Tabelle mit einer Zeile je Produkt (Spalten: Produkt, Hersteller)
//   ✅ Dropdown zeigt bestehende Hersteller; Platzhalter "Hersteller wählen oder anlegen"
//   ✅ Suche im Dropdown filtert die Liste live
//   ✅ Neuer Name → "Neu erstellen: [Name]"-Option erscheint; Klick legt Hersteller an + ordnet ihn zu
//   ✅ Bestehenden Hersteller auswählen → Auto-Save ohne Reload
//   ✅ Leerer Suchtext → kein "Neu erstellen"-Eintrag
//   ✅ Keine Produkte → Hinweis mit Link zur KPI-Modell-Seite
//
// Tab 2 — MOQ:
//   ✅ Tabelle mit einer Zeile je Produkt; Radio-Auswahl "Produkt" / "SKU"
//   ✅ Standard: "Produkt" vorausgewählt
//   ✅ Produktebene: MOQ-Feld sichtbar (Ganzzahl ≥ 1); Auto-Save bei onBlur
//   ✅ SKU-Ebene: Aufklapp-Pfeil erscheint beim Produktnamen; MOQ-Feld wird ausgeblendet
//   ✅ Aufgeklappt: SKU-Zeilen eingerückt; je eine MOQ-Eingabe
//   ✅ Keine SKUs → Hinweis "Keine SKUs vorhanden"
//   ✅ Spaltenbreite verschiebt sich nicht beim Auf-/Zuklappen
//   ✅ Auto-Save MOQ-Wert bei onBlur
//
// Tab 3 — Containerkapazität:
//   ✅ Container-Maximalvolumen-Card oben (20DC, 40DC, 40HQ in m³); Auto-Save onBlur
//   ✅ Tabelle: Produkt, Länge/Breite/Höhe (cm); Auto-Save onBlur
//   ✅ Stückvolumen (m³) automatisch berechnet, nicht editierbar, zentriert
//   ✅ Max. 20DC / 40DC / 40HQ automatisch berechnet, nicht editierbar, zentriert
//   ✅ Fehlende Maße → "–" für Stückvolumen und Kapazitäten
//   ✅ Daten bleiben nach Reload erhalten
//
// Tab 4 — Lieferzeit:
//   ✅ Tabelle: Produktionszeit, Zwischenzeit, Shipping-Zeit, Entladungszeit (Tage); Auto-Save onBlur
//   ✅ Gesamtzeit automatisch summiert, nicht editierbar
//   ✅ Daten bleiben nach Reload erhalten
//
// Tab 5 — Zahlungskonditionen:
//   ✅ Tabelle: Vor/Nach Produktion/Nach Ankunft (%)
//   ✅ Jede Zahlungsziel-Spalte erscheint sobald das dazugehörige %-Feld befüllt ist
//   ✅ Inline-Fehlermeldung "Summe muss 100 % ergeben" erscheint nach blur wenn alle 3 gesetzt ≠ 100
//   ✅ Auto-Save Zahlungsziel bei onBlur
//   ✅ Daten bleiben nach Reload erhalten
//   ✅ Spaltenköpfe "Zahlungsziel / Vor Produktion (Tage)" in zwei Zeilen
//
// Tab 6 — Produktkosten:
//   ✅ Globale Card: Shipping/Inspektion/Einlagerung je Containerart + Zahlungsziel; Auto-Save onBlur
//   ✅ Zollkosten-Zahlungsziel global; Auto-Save onBlur
//   ✅ Produkttabelle: Warenkosten (€), Zollsatz (%); Auto-Save onBlur
//   ✅ Daten bleiben nach Reload erhalten
//
// Tab 7 — Bestandsverwaltung:
//   ✅ Tabelle: Sicherheitsbestand (Monate), Zielreichweite (Monate)
//   ✅ Auto-Save bei onBlur; Dezimalwerte möglich
//   ✅ Daten bleiben nach Reload erhalten
//
// Datenpersistenz (alle Tabs):
//   ✅ Optimistisches Update: Änderung erscheint sofort in der UI
//   ✅ API-Fehler: Toast-Fehlermeldung + Rollback (manuell geprüft über DevTools network throttle)
//
// Cross-Browser:
//   ✅ Chrome — alle Tabs funktionieren
//
// Responsive:
//   ✅ Desktop (1440px) — Tab-Leiste voll ausgenutzt
//   ⚠️ Mobile (375px) — Tabs umbrechen in zwei Reihen (akzeptables Verhalten, keine Overflow)
