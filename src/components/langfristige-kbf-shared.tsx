'use client'

import { useState } from 'react'

// PROJ-101: Gemeinsame Formatierung + Inline-Eingabefelder für die beiden Tabellen
// der Seite „Kapitalbedarf & Finanzierung".

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export function formatBetrag(value: number): string {
  return EUR.format(value)
}

// Wandelt eine Zahl in ein im DE-Format editierbares Roh-String (Komma als Dezimaltrenner).
function toEditable(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return String(value).replace('.', ',')
}

// Parst DE-/EN-Eingaben robust: „1.234,56" → 1234.56, „1234.56" → 1234.56, leer → null.
export function parseBetrag(raw: string): number | null {
  let s = raw.trim().replace(/[€\s ]/g, '')
  if (s === '') return null
  if (s.includes(',')) {
    // Komma = Dezimaltrenner → Tausenderpunkte entfernen, Komma zu Punkt.
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const INPUT_CLASS =
  'w-full bg-transparent text-right tabular-nums outline-none rounded px-1 py-0.5 ' +
  'focus:bg-blue-50 dark:focus:bg-blue-950/30 focus:ring-1 focus:ring-blue-300'

// ── Währungs-Eingabefeld (Betrag) ──
export function BetragInput({
  value,
  onSave,
  placeholder = '–',
  className = '',
}: {
  value: number | null
  onSave: (n: number | null) => void
  placeholder?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  const display = focused ? text : value !== null && value !== undefined ? formatBetrag(value) : ''

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      className={`${INPUT_CLASS} ${className}`}
      onFocus={() => { setFocused(true); setText(toEditable(value)) }}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        const n = parseBetrag(text)
        if (n !== value) onSave(n)
      }}
    />
  )
}

// ── Generisches Zahlen-Eingabefeld (Zinssatz / Laufzeit / Tilgungsfrei) ──
export function ZahlInput({
  value,
  onSave,
  suffix = '',
  integer = false,
  placeholder = '–',
  className = '',
  suffixSingular,
}: {
  value: number | null
  onSave: (n: number | null) => void
  suffix?: string
  // Singularform der Einheit; wird bei Wert genau 1 statt `suffix` verwendet (z.B. „Jahr").
  suffixSingular?: string
  integer?: boolean
  placeholder?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  const einheit = value === 1 && suffixSingular ? suffixSingular : suffix
  const formatted = value !== null && value !== undefined
    ? `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: integer ? 0 : 2 }).format(value)}${einheit ? ' ' + einheit : ''}`
    : ''
  const display = focused ? text : formatted

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      className={`${INPUT_CLASS} ${className}`}
      onFocus={() => { setFocused(true); setText(toEditable(value)) }}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        let n = parseBetrag(text)
        if (n !== null && integer) n = Math.round(n)
        if (n !== value) onSave(n)
      }}
    />
  )
}

// ── Bezeichnungs-Eingabefeld (frei benannte Zeilen) ──
export function BezeichnungInput({
  value,
  onSave,
  className = '',
}: {
  value: string
  onSave: (s: string) => void
  className?: string
}) {
  // Die Tabelle setzt bei externen Änderungen (z.B. Reload) über `key` neu auf.
  const [text, setText] = useState(value)

  return (
    <input
      type="text"
      value={text}
      placeholder="Bezeichnung"
      className={`w-full bg-transparent outline-none rounded px-1 py-0.5 focus:bg-blue-50 dark:focus:bg-blue-950/30 focus:ring-1 focus:ring-blue-300 ${className}`}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim()
        if (trimmed.length > 0 && trimmed !== value) onSave(trimmed)
        else if (trimmed.length === 0) setText(value) // leere Eingabe verwerfen
      }}
    />
  )
}
