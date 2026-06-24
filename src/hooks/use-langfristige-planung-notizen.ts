'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-84: Versionsgebundene Zellen-Notizen für Planungsseiten der Langfristigen
// Planung. Spiegelt usePlanungNotizen, hängt aber an einer Planversion (versionId)
// und einer Seite (z.B. "absatzplanung"). Datensätze werden pro Version isoliert
// gespeichert und beim Löschen der Version kaskadierend mitgelöscht.

export interface LangfristigePlanungNotiz {
  zellen_schluessel: string
  notiz_text: string
}

export function useLangfristigePlanungNotizen(versionId: string, seite: string) {
  const [notizen, setNotizen] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const basePath = `/api/langfristige-planung/${versionId}/planung-notizen`

  useEffect(() => {
    if (!versionId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${basePath}?seite=${encodeURIComponent(seite)}`)
        if (!res.ok || cancelled) return
        const { data } = (await res.json()) as { data: LangfristigePlanungNotiz[] }
        if (cancelled) return
        const map = new Map<string, string>()
        for (const item of data) {
          map.set(item.zellen_schluessel, item.notiz_text)
        }
        setNotizen(map)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [versionId, seite, basePath])

  const upsertNotiz = useCallback(
    async (zellenSchluessel: string, text: string) => {
      if (!text.trim()) {
        // Leerer Text → wie Löschen behandeln
        setNotizen(prev => {
          const next = new Map(prev)
          next.delete(zellenSchluessel)
          return next
        })
        await fetch(
          `${basePath}?seite=${encodeURIComponent(seite)}&zellen_schluessel=${encodeURIComponent(zellenSchluessel)}`,
          { method: 'DELETE' },
        )
        return
      }

      // Optimistisches Update
      setNotizen(prev => new Map(prev).set(zellenSchluessel, text))

      await fetch(basePath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seite, zellen_schluessel: zellenSchluessel, notiz_text: text }),
      })
    },
    [seite, basePath],
  )

  const deleteNotiz = useCallback(
    async (zellenSchluessel: string) => {
      setNotizen(prev => {
        const next = new Map(prev)
        next.delete(zellenSchluessel)
        return next
      })

      await fetch(
        `${basePath}?seite=${encodeURIComponent(seite)}&zellen_schluessel=${encodeURIComponent(zellenSchluessel)}`,
        { method: 'DELETE' },
      )
    },
    [seite, basePath],
  )

  return { notizen, loading, upsertNotiz, deleteNotiz }
}
