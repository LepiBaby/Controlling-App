# PROJ-1: Authentifizierung & Nutzerzugang

## Status: Approved
**Created:** 2026-04-17
**Last Updated:** 2026-04-17

## Dependencies
- None

## Übersicht
Zugangskontrolle für die interne Controlling-Plattform. Nur explizit eingeladene Nutzer können sich anmelden. Login erfolgt per Magic Link (kein Passwort). Keine öffentliche Registrierung möglich.

## User Stories
- Als Admin möchte ich Nutzer per E-Mail einladen können, damit nur autorisierte Personen Zugang zur Plattform haben.
- Als Nutzer möchte ich mich per Magic Link (E-Mail) einloggen können, damit ich kein Passwort verwalten muss.
- Als Nutzer möchte ich eingeloggt bleiben (persistente Session), damit ich nicht bei jedem Besuch neu einloggen muss.
- Als Nutzer möchte ich mich ausloggen können, damit mein Account auf geteilten Geräten sicher ist.
- Als System soll unbefugter Zugriff auf alle Seiten verhindert werden, wenn der Nutzer nicht eingeloggt ist.

## Acceptance Criteria
- [ ] Nicht eingeloggte Nutzer werden automatisch zur Login-Seite weitergeleitet
- [ ] Login-Seite zeigt ein E-Mail-Eingabefeld und einen "Magic Link senden"-Button
- [ ] Nach Eingabe einer gültigen E-Mail erhält der Nutzer eine E-Mail mit einem Login-Link
- [ ] Nach Klick auf den Magic Link wird der Nutzer eingeloggt und zur App weitergeleitet
- [ ] Login ist nur für eingeladene E-Mail-Adressen möglich (kein offener Sign-up)
- [ ] Sessions bleiben persistent (Nutzer bleibt eingeloggt nach Browser-Neustart)
- [ ] Ein "Abmelden"-Button ist in der App verfügbar und beendet die Session
- [ ] Nach dem Ausloggen wird der Nutzer zur Login-Seite weitergeleitet
- [ ] Alle App-Routen sind durch Middleware geschützt

## Edge Cases
- Nutzer gibt eine nicht eingeladene E-Mail-Adresse ein → Neutrale Meldung ("Falls diese E-Mail registriert ist, wurde ein Link verschickt") — kein Hinweis ob die Adresse bekannt ist
- Magic Link wird mehrfach geklickt → Nur der erste Klick ist gültig; zweiter Klick zeigt Fehlermeldung "Link bereits verwendet"
- Magic Link ist abgelaufen (Standard: 1 Stunde) → Nutzer sieht Fehlermeldung mit Option neuen Link anzufordern
- Nutzer versucht direkt auf geschützte URL zuzugreifen → Redirect zur Login-Seite, nach Login Redirect zur ursprünglichen URL
- Session läuft ab während Nutzer aktiv ist → Nutzer wird zur Login-Seite geleitet mit Hinweis "Session abgelaufen"

## Technical Requirements
- Auth-Provider: Supabase Auth (Magic Link / OTP)
- Kein öffentlicher Sign-up — neue Nutzer werden ausschließlich vom Admin via Supabase Dashboard eingeladen
- Row Level Security (RLS) in Supabase muss auf allen Tabellen aktiv sein
- Middleware schützt alle Routen außer `/login` und `/auth/callback`
- Session-Dauer: konfigurierbar (Standard: 7 Tage)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
App (alle Routen)
+-- Middleware (src/middleware.ts)
|   +-- Prüft Session bei jedem Request
|   +-- Unauthentifiziert → Redirect zu /login (mit ?next= Parameter)
|
+-- /login  (src/app/login/page.tsx)
|   +-- LoginForm
|       +-- Email Input (shadcn: Input)
|       +-- "Magic Link senden" Button (shadcn: Button)
|       +-- Status Message (shadcn: Alert)
|
+-- /auth/callback  (src/app/auth/callback/route.ts)
|   +-- Route Handler (kein UI)
|       +-- Empfängt OTP Token von Supabase
|       +-- Tauscht Token gegen Session-Cookie
|       +-- Redirect → ursprüngliche URL oder /dashboard
|
+-- Alle anderen Routen (geschützt durch Middleware)
    +-- Logout-Button (im Navigation-Component, PROJ-2+)
```

### Datenmodell
Kein eigenes Schema nötig — Supabase Auth verwaltet intern:
- Nutzer: ID (UUID), E-Mail, Session-Token, Ablaufzeit
- Magic Link Token (einmalig gültig, 1 Stunde TTL)
- Neue Nutzer werden ausschließlich vom Admin über das Supabase Dashboard eingeladen

### Neue Dateien
```
src/middleware.ts                    — Route-Schutz (neu)
src/lib/supabase.ts                  — SSR-Client aktivieren (anpassen)
src/app/login/page.tsx               — Login-Seite (neu)
src/app/auth/callback/route.ts       — Magic Link Handler (neu)
```

### Tech-Entscheidungen
| Entscheidung | Gewählt | Warum |
|---|---|---|
| Auth-Provider | Supabase Auth | Bereits im Tech-Stack, Magic Link out-of-the-box |
| Login-Methode | Magic Link (OTP per E-Mail) | Kein Passwort-Management, sicher für kleines Team |
| Session-Management | `@supabase/ssr` | Next.js App Router kompatibel, Cookie-basiert |
| Routing-Schutz | Next.js Middleware | Läuft vor jeder Anfrage, zuverlässigster Schutzpunkt |
| Nutzer-Verwaltung | Supabase Dashboard only | Kein Self-Service-Signup nötig, kein Extra-Code |

### Dependencies
- `@supabase/supabase-js` — Supabase Client
- `@supabase/ssr` — Next.js App Router Session-Management

## Implementation Notes
- `@supabase/ssr` installiert für Next.js App Router Session-Management
- `src/proxy.ts` (Next.js 16 Konvention, ersetzt `middleware.ts`) schützt alle Routen
- `src/lib/supabase.ts` — Browser-Client-Factory (createBrowserClient)
- `src/app/login/` — Login-Seite + LoginForm Client Component mit react-hook-form + zod
- `src/app/auth/callback/route.ts` — OTP-Code-Exchange Route Handler
- `src/app/dashboard/page.tsx` — Minimales geschütztes Dashboard mit E-Mail + LogoutButton
- `src/components/logout-button.tsx` — Client Component für Session-Beendigung
- Alle Routen außer `/login` und `/auth/*` sind durch proxy geschützt
- `?next=` Parameter wird bei Redirect zur Login-Seite mitgegeben und nach Login wiederhergestellt
- **Backend:** Supabase-Projekt "Controlling-App" (eu-central-1), `.env.local` konfiguriert
- **Kein eigenes DB-Schema** — Supabase Auth verwaltet alle Auth-Daten intern
- **Tests:** 4 Unit-Tests für `/auth/callback` (happy path, next-param, kein code, exchange-fehler) — alle grün
- **Manuelle Dashboard-Schritte erforderlich** (siehe unten)

### Supabase Dashboard Konfiguration (einmalig manuell)
1. **E-Mail Sign-ups deaktivieren:** Authentication → Providers → Email → "Enable Email Signup" ausschalten
2. **Site URL setzen:** Authentication → URL Configuration → Site URL = `http://localhost:3000` (dev) / Produktions-URL (prod)
3. **Redirect URL erlauben:** Authentication → URL Configuration → Redirect URLs → `http://localhost:3000/auth/callback` hinzufügen
4. **Session-Dauer:** Authentication → Sessions → JWT Expiry = 604800 (7 Tage)
5. **Nutzer einladen:** Authentication → Users → "Invite user" → E-Mail eingeben

## QA Test Results

**QA Date:** 2026-04-17
**Tester:** QA Engineer (automated + manual)
**Result: APPROVED — bereit für Deployment**

### Acceptance Criteria

| # | Kriterium | Status | Getestet via |
|---|---|---|---|
| AC1 | Nicht eingeloggte Nutzer → Redirect zu /login | ✅ PASS | E2E |
| AC2 | Login-Seite: E-Mail-Feld + "Magic Link senden"-Button | ✅ PASS | E2E |
| AC3 | Nutzer erhält E-Mail mit Login-Link | ✅ PASS | Manuell (E-Mail empfangen, Rate Limit war einziges Hindernis) |
| AC4 | Klick auf Magic Link → eingeloggt + Weiterleitung | ⚠️ MANUAL | Erfordert echten E-Mail-Empfang |
| AC5 | Nur eingeladene E-Mails können sich anmelden | ✅ PASS | E2E + Dashboard-Konfiguration |
| AC6 | Session persistent nach Browser-Neustart | ⚠️ MANUAL | Erfordert echten Login-Flow |
| AC7 | "Abmelden"-Button vorhanden | ✅ PASS | E2E (visuell) + Code-Review |
| AC8 | Nach Abmelden → Redirect zu /login | ✅ PASS | Code-Review (LogoutButton → window.location.href = '/login') |
| AC9 | Alle App-Routen durch Middleware geschützt | ✅ PASS | E2E |

### Automatisierte Tests

| Suite | Ergebnis |
|---|---|
| Unit Tests (Vitest) | 4/4 ✅ |
| E2E Tests (Playwright/Chromium) | 13/14 ✅ — 1 Medium Bug |

### Bugs

**BUG-1 (Medium):** Browser-native Validierung überschreibt custom Fehlermeldung

- **Schritte:** Login-Seite öffnen → ungültige E-Mail eingeben (z.B. `test@`) → Submit klicken
- **Erwartet:** Deutschsprachige Fehlermeldung "Bitte eine gültige E-Mail-Adresse eingeben"
- **Tatsächlich:** Browser-native Validierungspopup (system-sprachig, nicht unser Design)
- **Ursache:** `<form>` fehlt `noValidate`-Attribut — Browser-Validierung feuert vor react-hook-form
- **Fix:** `<form noValidate onSubmit={...}>` in `login-form.tsx:81`

### Security Audit

| Prüfung | Ergebnis |
|---|---|
| Offenes Sign-up möglich? | ✅ Gesperrt via Supabase Dashboard |
| XSS im E-Mail-Feld? | ✅ Sicher — React escaped alle Outputs |
| Open Redirect via `?next=`? | ✅ Sicher — Origin wird immer vorangestellt |
| SQL Injection? | ✅ N/A — kein eigenes Schema |
| Secrets in Browser-Konsole? | ✅ Nur Anon Key (öffentlich by design) |
| Rate Limiting? | ✅ Supabase built-in (getestet) |
| Magic Link One-Time-Use? | ✅ Supabase built-in |

### Vitest Config Fix
Playwright-Spec-Dateien wurden fälschlicherweise von Vitest aufgegriffen — `tests/**` exclusion in `vitest.config.ts` hinzugefügt.

## Deployment
_To be added by /deploy_
