'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-86: Lädt die Container-Maximalkapazitäten je Produkt einer Planversion
// (globale Containervolumina + Paketmaße → max. Stückzahl je Containerart) für die
// Container-Aufschlüsselung in der Bestell-Detailansicht.

export interface ContainerKapazitaet {
  max_20dc: number | null
  max_40hq: number | null
}

function computeMax(volM3: number | null, stueckCm3: number | null): number | null {
  if (!volM3 || !stueckCm3 || stueckCm3 <= 0) return null
  return Math.floor((volM3 * 1_000_000) / stueckCm3)
}

export function useLangfristigeContainerKapazitaet(versionId: string) {
  const [byProdukt, setByProdukt] = useState<Map<string, ContainerKapazitaet>>(new Map())

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    const base = `/api/langfristige-planung/${versionId}/produktinformationen`
    Promise.all([
      fetch(`${base}/container-global`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${base}/containerkapazitaet`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([global, kap]) => {
      if (!aktiv) return
      const vol20 = (global as { volumen_20dc: number | null } | null)?.volumen_20dc ?? null
      const vol40 = (global as { volumen_40hq: number | null } | null)?.volumen_40hq ?? null
      const map = new Map<string, ContainerKapazitaet>()
      for (const r of (kap ?? []) as Array<{
        produkt_id: string
        laenge_cm: number | null
        breite_cm: number | null
        hoehe_cm: number | null
      }>) {
        const stueck =
          r.laenge_cm && r.breite_cm && r.hoehe_cm ? r.laenge_cm * r.breite_cm * r.hoehe_cm : null
        map.set(r.produkt_id, {
          max_20dc: computeMax(vol20, stueck),
          max_40hq: computeMax(vol40, stueck),
        })
      }
      setByProdukt(map)
    })
    return () => {
      aktiv = false
    }
  }, [versionId])

  const getKapazitaet = useCallback(
    (produktId: string): ContainerKapazitaet =>
      byProdukt.get(produktId) ?? { max_20dc: null, max_40hq: null },
    [byProdukt],
  )

  return { getKapazitaet }
}
