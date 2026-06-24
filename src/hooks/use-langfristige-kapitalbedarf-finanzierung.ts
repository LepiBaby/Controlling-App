'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLangfristigeInvestitionsauswertung } from '@/hooks/use-langfristige-investitionsauswertung'
import { useLangfristigeLiquiditaetsauswertung } from '@/hooks/use-langfristige-liquiditaetsauswertung'
import {
  round2, sumValues, computeBetriebsmittelbedarf, effektiverBetrag,
  type Bereich, type ZeilenArt, type KbfRow, type Obergruppe,
} from '@/hooks/langfristige-kapitalbedarf-finanzierung-utils'

export {
  sumValues, computeBetriebsmittelbedarf, effektiverBetrag,
} from '@/hooks/langfristige-kapitalbedarf-finanzierung-utils'
export type { Bereich, ZeilenArt, KbfRow, Obergruppe } from '@/hooks/langfristige-kapitalbedarf-finanzierung-utils'

// PROJ-101: Kapitalbedarf & Finanzierung (Langfristige Planung).
//
// Verbindet ZWEI Auto-Werte (read-only aus bestehenden Hooks) mit den EIGENEN,
// gespeicherten Zeilen der neuen API:
//   • „Investitionen"        → Summe der Investitionsauswertung (PROJ-99/PROJ-92)
//                              über alle Monate; aufklappbar je Obergruppe
//   • „Betriebsmittelbedarf" → Betrag des negativsten kumulierten Kontostands der
//                              Liquiditätsauswertung (PROJ-94); 0 wenn nie negativ
// Die Auto-Werte werden NICHT gespeichert — `betrag` einer festen Zeile ist ein
// optionaler Override (NULL = Auto-Wert nutzen). Alle übrigen Zeilen sind manuell.

interface ApiRow {
  id: string
  bereich: Bereich
  zeilen_art: ZeilenArt
  bezeichnung: string
  betrag: number | string | null
  zinssatz: number | string | null
  laufzeit_jahre: number | null
  tilgungsfrei_jahre: number | null
  sort_order: number
  is_system: boolean
  quelle_id: string | null
}

function toRow(r: ApiRow): KbfRow {
  const num = (v: number | string | null): number | null =>
    v === null || v === undefined || v === '' ? null : Number(v)
  return {
    id: r.id,
    bereich: r.bereich,
    zeilen_art: r.zeilen_art,
    bezeichnung: r.bezeichnung,
    betrag: num(r.betrag),
    zinssatz: num(r.zinssatz),
    laufzeit_jahre: r.laufzeit_jahre,
    tilgungsfrei_jahre: r.tilgungsfrei_jahre,
    sort_order: r.sort_order,
    is_system: r.is_system,
    quelle_id: r.quelle_id ?? null,
  }
}

export interface KbfModel {
  loading: boolean
  error: string | null
  // Auto-Werte
  autoInvest: number
  autoBetriebsmittel: number
  investObergruppen: Obergruppe[]
  // Zeilen je Bereich (sortiert)
  kapitalbedarfRows: KbfRow[]
  eigenkapitalRows: KbfRow[]
  fremdkapitalRows: KbfRow[]
  // Summen
  gesamtkapitalbedarf: number
  summeEigenkapital: number
  summeFremdkapital: number
  summeEkFk: number
  differenz: number // summeEkFk − gesamtkapitalbedarf
  // Helfer
  effektiv: (row: KbfRow) => number
  // Aktionen
  addRow: (bereich: Bereich) => Promise<void>
  updateBetrag: (id: string, betrag: number | null) => Promise<void>
  rename: (id: string, bezeichnung: string) => Promise<void>
  updateFkDetail: (id: string, field: 'zinssatz' | 'laufzeit_jahre' | 'tilgungsfrei_jahre', value: number | null) => Promise<void>
  removeRow: (id: string) => Promise<void>
  resetOverride: (id: string) => Promise<void>
  moveRow: (id: string, direction: 'up' | 'down') => Promise<void>
  // Unterwert einer Investitionen-Obergruppe überschreiben (null = zurück zum Auto-Wert).
  updateObergruppe: (quelleId: string, label: string, betrag: number | null) => Promise<void>
}

export function useLangfristigeKapitalbedarfFinanzierung(versionId: string): KbfModel {
  const invest = useLangfristigeInvestitionsauswertung(versionId)
  const liqui = useLangfristigeLiquiditaetsauswertung(versionId)

  const [rows, setRows] = useState<KbfRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/kapitalbedarf-finanzierung`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)
    fetch(basePath)
      .then(r => {
        if (!r.ok) throw new Error('load failed')
        return r.json()
      })
      .then((data: ApiRow[]) => {
        if (!aktiv) return
        setRows((Array.isArray(data) ? data : []).map(toRow))
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden von Kapitalbedarf & Finanzierung.')
        setLoading(false)
      })
    return () => { aktiv = false }
  }, [versionId, basePath])

  // ── Override-Werte je Obergruppe (quelle_id → betrag) ──
  const obergruppeOverride = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      if (r.zeilen_art === 'investition_obergruppe' && r.quelle_id !== null && r.betrag !== null) {
        m.set(r.quelle_id, r.betrag)
      }
    }
    return m
  }, [rows])

  // ── Auto-Werte ableiten ──
  // Obergruppen: berechneter Auto-Wert (Summe über alle Monate) + ggf. Override.
  const investObergruppen = useMemo<Obergruppe[]>(
    () => (invest.tree ?? []).map(og => {
      const auto = sumValues(og.values)
      const override = obergruppeOverride.has(og.id) ? obergruppeOverride.get(og.id)! : null
      return { id: og.id, label: og.label, auto, override, betrag: override ?? auto }
    }),
    [invest.tree, obergruppeOverride],
  )
  // Reiner Auto-Gesamtwert (ohne Overrides) — nur informativ.
  const autoInvest = useMemo(() => sumValues(invest.gesamt?.values ?? {}), [invest.gesamt])
  // Effektiver Investitionen-Gesamtwert = Summe der (überschriebenen) Obergruppen.
  const investGesamt = useMemo(
    () => round2(investObergruppen.reduce((s, og) => s + og.betrag, 0)),
    [investObergruppen],
  )
  const autoBetriebsmittel = useMemo(() => {
    const kontostand = (liqui.rows ?? []).find(r => r.kind === 'kontostand')
    return kontostand ? computeBetriebsmittelbedarf(kontostand.cells) : 0
  }, [liqui.rows])

  const effektiv = useCallback(
    (row: KbfRow) => effektiverBetrag(row, investGesamt, autoBetriebsmittel),
    [investGesamt, autoBetriebsmittel],
  )

  // ── Zeilen je Bereich (sortiert) ──
  // Obergruppen-Override-Zeilen erscheinen NICHT als eigenständige Zeilen.
  const kapitalbedarfRows = useMemo(
    () => rows
      .filter(r => r.bereich === 'kapitalbedarf' && r.zeilen_art !== 'investition_obergruppe')
      .sort((a, b) => a.sort_order - b.sort_order),
    [rows],
  )
  const eigenkapitalRows = useMemo(
    () => rows.filter(r => r.bereich === 'eigenkapital').sort((a, b) => a.sort_order - b.sort_order),
    [rows],
  )
  const fremdkapitalRows = useMemo(
    () => rows.filter(r => r.bereich === 'fremdkapital').sort((a, b) => a.sort_order - b.sort_order),
    [rows],
  )

  // ── Summen ──
  const gesamtkapitalbedarf = useMemo(
    () => round2(kapitalbedarfRows.reduce((s, r) => s + effektiv(r), 0)),
    [kapitalbedarfRows, effektiv],
  )
  const summeEigenkapital = useMemo(
    () => round2(eigenkapitalRows.reduce((s, r) => s + (r.betrag ?? 0), 0)),
    [eigenkapitalRows],
  )
  const summeFremdkapital = useMemo(
    () => round2(fremdkapitalRows.reduce((s, r) => s + (r.betrag ?? 0), 0)),
    [fremdkapitalRows],
  )
  const summeEkFk = round2(summeEigenkapital + summeFremdkapital)
  const differenz = round2(summeEkFk - gesamtkapitalbedarf)

  // ── Aktionen ──
  const patch = useCallback(async (id: string, body: Record<string, unknown>) => {
    await fetch(`${basePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }, [basePath])

  const addRow = useCallback(async (bereich: Bereich) => {
    const bezeichnung = bereich === 'eigenkapital' ? 'Neue Eigenkapital-Position'
      : bereich === 'fremdkapital' ? 'Neue Fremdkapital-Position'
      : 'Neue Position'
    const res = await fetch(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bereich, bezeichnung, betrag: null }),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Fehler beim Anlegen.')
      return
    }
    const created: ApiRow = await res.json()
    setRows(prev => [...prev, toRow(created)])
  }, [basePath])

  const updateBetrag = useCallback(async (id: string, betrag: number | null) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, betrag } : r))
    await patch(id, { betrag })
  }, [patch])

  const rename = useCallback(async (id: string, bezeichnung: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, bezeichnung } : r))
    await patch(id, { bezeichnung })
  }, [patch])

  const updateFkDetail = useCallback(async (
    id: string,
    field: 'zinssatz' | 'laufzeit_jahre' | 'tilgungsfrei_jahre',
    value: number | null,
  ) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await patch(id, { [field]: value })
  }, [patch])

  const removeRow = useCallback(async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch(`${basePath}/${id}`, { method: 'DELETE' })
  }, [basePath])

  const resetOverride = useCallback(async (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, betrag: null } : r))
    await patch(id, { betrag: null })
  }, [patch])

  const moveRow = useCallback(async (id: string, direction: 'up' | 'down') => {
    const row = rows.find(r => r.id === id)
    if (!row) return
    const siblings = rows
      .filter(r => r.bereich === row.bereich && r.zeilen_art !== 'investition_obergruppe')
      .sort((a, b) => a.sort_order - b.sort_order)
    const index = siblings.findIndex(r => r.id === id)
    if (direction === 'up' && index <= 0) return
    if (direction === 'down' && index >= siblings.length - 1) return

    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const reordered = [...siblings]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]

    // Lückenlose neue Reihenfolge (0..n) für diesen Bereich.
    const order = reordered.map((r, i) => ({ id: r.id, sort_order: i }))
    const orderMap = new Map(order.map(o => [o.id, o.sort_order]))
    setRows(prev => prev.map(r => orderMap.has(r.id) ? { ...r, sort_order: orderMap.get(r.id)! } : r))

    await fetch(basePath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    })
  }, [rows, basePath])

  // Unterwert einer Investitionen-Obergruppe überschreiben/zurücksetzen.
  const updateObergruppe = useCallback(async (quelleId: string, label: string, betrag: number | null) => {
    // Optimistisch: Override-Zeile dieser Obergruppe einfügen/aktualisieren/entfernen.
    setRows(prev => {
      const ohne = prev.filter(r => !(r.zeilen_art === 'investition_obergruppe' && r.quelle_id === quelleId))
      if (betrag === null) return ohne
      const bestehend = prev.find(r => r.zeilen_art === 'investition_obergruppe' && r.quelle_id === quelleId)
      const neu: KbfRow = bestehend
        ? { ...bestehend, betrag, bezeichnung: label }
        : {
            id: `temp-${quelleId}`, bereich: 'kapitalbedarf', zeilen_art: 'investition_obergruppe',
            bezeichnung: label, betrag, zinssatz: null, laufzeit_jahre: null,
            tilgungsfrei_jahre: null, sort_order: 0, is_system: true, quelle_id: quelleId,
          }
      return [...ohne, neu]
    })

    const res = await fetch(`${basePath}/investition-obergruppe`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quelle_id: quelleId, bezeichnung: label, betrag }),
    })
    // Bei gesetztem Override die echte ID/Server-Daten übernehmen.
    if (betrag !== null && res.ok) {
      const saved: ApiRow = await res.json()
      setRows(prev => prev.map(r =>
        r.zeilen_art === 'investition_obergruppe' && r.quelle_id === quelleId ? toRow(saved) : r,
      ))
    }
  }, [basePath])

  return {
    loading: loading || invest.loading || liqui.loading,
    error: error ?? invest.error ?? liqui.error,
    autoInvest,
    autoBetriebsmittel,
    investObergruppen,
    kapitalbedarfRows,
    eigenkapitalRows,
    fremdkapitalRows,
    gesamtkapitalbedarf,
    summeEigenkapital,
    summeFremdkapital,
    summeEkFk,
    differenz,
    effektiv,
    addRow,
    updateBetrag,
    rename,
    updateFkDetail,
    removeRow,
    resetOverride,
    moveRow,
    updateObergruppe,
  }
}
