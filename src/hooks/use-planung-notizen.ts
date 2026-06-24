'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PlanungNotiz {
  zellen_schluessel: string
  notiz_text: string
}

export function usePlanungNotizen(seite: string) {
  const [notizen, setNotizen] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/planung-notizen?seite=${encodeURIComponent(seite)}`)
        if (!res.ok || cancelled) return
        const { data } = (await res.json()) as { data: PlanungNotiz[] }
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
    return () => { cancelled = true }
  }, [seite])

  const upsertNotiz = useCallback(
    async (zellenSchluessel: string, text: string) => {
      if (!text.trim()) {
        // Empty text → treat as delete
        setNotizen(prev => {
          const next = new Map(prev)
          next.delete(zellenSchluessel)
          return next
        })
        await fetch(
          `/api/planung-notizen?seite=${encodeURIComponent(seite)}&zellen_schluessel=${encodeURIComponent(zellenSchluessel)}`,
          { method: 'DELETE' },
        )
        return
      }

      // Optimistic update
      setNotizen(prev => new Map(prev).set(zellenSchluessel, text))

      await fetch('/api/planung-notizen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seite, zellen_schluessel: zellenSchluessel, notiz_text: text }),
      })
    },
    [seite],
  )

  const deleteNotiz = useCallback(
    async (zellenSchluessel: string) => {
      setNotizen(prev => {
        const next = new Map(prev)
        next.delete(zellenSchluessel)
        return next
      })

      await fetch(
        `/api/planung-notizen?seite=${encodeURIComponent(seite)}&zellen_schluessel=${encodeURIComponent(zellenSchluessel)}`,
        { method: 'DELETE' },
      )
    },
    [seite],
  )

  const resetNotizen = useCallback(async () => {
    setNotizen(new Map())
    await fetch(`/api/planung-notizen?seite=${encodeURIComponent(seite)}`, { method: 'DELETE' })
  }, [seite])

  return { notizen, loading, upsertNotiz, deleteNotiz, resetNotizen }
}
