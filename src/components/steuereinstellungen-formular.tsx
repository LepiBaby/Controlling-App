'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import { useLangfristigeKpiKategorien } from '@/hooks/use-langfristige-kpi-kategorien'
import {
  useUstEinstellungen,
  type Zahlungsfrequenz,
} from '@/hooks/use-ust-einstellungen'
import { useUstKategorieSaetze } from '@/hooks/use-ust-kategorie-saetze'
import { useEinfuhrustFiskalverzollung } from '@/hooks/use-einfuhrust-fiskalverzollung'
import { ustEbeneAuswahlPfad } from '@/lib/steuereinstellungen-api'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'

// ─── Types ────────────────────────────────────────────────────────────────────

type UstSettingsHook = ReturnType<typeof useUstEinstellungen>
type UstKategorieSaetzeHook = ReturnType<typeof useUstKategorieSaetze>
type EbeneWahl = Record<string, 'hier' | 'unterebene'>
type ExpandState = Record<string, boolean>

interface ParentGroup {
  parent: KpiCategory
  children: KpiCategory[]
  childEbene?: 1 | 2
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LST_KEY = 'ust_ebene_wahl'

function loadEbeneWahl(): EbeneWahl {
  try {
    const stored = localStorage.getItem(LST_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function persistEbeneWahl(wahl: EbeneWahl) {
  try { localStorage.setItem(LST_KEY, JSON.stringify(wahl)) } catch { /* noop */ }
}

function buildGroups(cats: KpiCategory[]): ParentGroup[] {
  const parents = cats.filter(c => c.level === 1).sort((a, b) => a.sort_order - b.sort_order)
  return parents.map(p => ({
    parent: p,
    children: cats
      .filter(c => c.parent_id === p.id && c.level === 2)
      .sort((a, b) => a.sort_order - b.sort_order),
  }))
}

// ─── Section 1: Umsatzsteuer-Grundeinstellungen ───────────────────────────────

function GrundeinstellungenSektion({ ustSettings }: { ustSettings: UstSettingsHook }) {
  const { einstellungen, loading, error, save } = ustSettings
  const { toast } = useToast()
  const [zahlungsfrequenz, setZahlungsfrequenz] = useState<Zahlungsfrequenz>('monatlich')
  const [verschiebungStr, setVerschiebungStr] = useState('0')
  const initialized = useRef(false)

  useEffect(() => {
    if (!loading && !initialized.current) {
      initialized.current = true
      setZahlungsfrequenz(einstellungen.zahlungsfrequenz)
      setVerschiebungStr(String(einstellungen.zahlungsverschiebung_tage))
    }
  }, [loading, einstellungen])

  async function handleFrequenzChange(value: Zahlungsfrequenz) {
    setZahlungsfrequenz(value)
    try {
      await save({ zahlungsfrequenz: value })
    } catch (e) {
      toast({
        title: 'Fehler beim Speichern',
        description: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  async function handleVerschiebungBlur() {
    const tage = parseInt(verschiebungStr, 10)
    if (isNaN(tage) || tage < 0) {
      toast({
        title: 'Ungültige Eingabe',
        description: 'Zahlungsverschiebung muss eine ganze Zahl ≥ 0 sein.',
        variant: 'destructive',
      })
      setVerschiebungStr(String(einstellungen.zahlungsverschiebung_tage))
      return
    }
    if (tage === einstellungen.zahlungsverschiebung_tage) return
    try {
      await save({ zahlungsverschiebung_tage: tage })
    } catch (e) {
      toast({
        title: 'Fehler beim Speichern',
        description: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="py-4 text-center text-sm text-muted-foreground">Laden…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <h2 className="text-base font-semibold">Umsatzsteuer-Grundeinstellungen</h2>

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <div className="space-y-2">
          <Label>Zahlungsfrequenz</Label>
          <Select value={zahlungsfrequenz} onValueChange={v => handleFrequenzChange(v as Zahlungsfrequenz)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monatlich">Monatlich</SelectItem>
              <SelectItem value="quartalsweise">Quartalsweise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="verschiebung-tage">Zahlungsverschiebung (Tage)</Label>
          <Input
            id="verschiebung-tage"
            type="number"
            min={0}
            step={1}
            value={verschiebungStr}
            onChange={e => setVerschiebungStr(e.target.value)}
            onBlur={handleVerschiebungBlur}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Section 2: Umsatzsteuersätze ─────────────────────────────────────────────

interface ParentGroupRowProps {
  group: ParentGroup
  ebeneWahl: EbeneWahl
  expandiert: ExpandState
  localSaetze: Record<string, string>
  onWahlChange: (parentId: string, wahl: 'hier' | 'unterebene') => void
  onToggle: (parentId: string) => void
  onRowChange: (katId: string, value: string) => void
  onRowBlur: (katId: string, ebene: 1 | 2) => void
  kpiHref?: string
}

function ParentGroupRow({
  group,
  ebeneWahl,
  expandiert,
  localSaetze,
  onWahlChange,
  onToggle,
  onRowChange,
  onRowBlur,
  kpiHref,
}: ParentGroupRowProps) {
  const { parent, children } = group
  const hasChildren = children.length > 0
  const wahl = hasChildren ? (ebeneWahl[parent.id] ?? 'hier') : 'hier'
  const isUnterebene = wahl === 'unterebene'
  const isExpanded = expandiert[parent.id] ?? false

  return (
    <>
      <tr className="border-t">
        <td className="px-4 py-2 text-sm font-medium">
          <div className="flex items-center gap-1.5">
            {isUnterebene ? (
              <button
                type="button"
                onClick={() => onToggle(parent.id)}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="inline-block w-[22px] shrink-0" />
            )}
            {parent.name}
          </div>
        </td>
        <td className="px-4 py-2 text-center">
          {hasChildren && (
            <div className="inline-flex rounded border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => onWahlChange(parent.id, 'hier')}
                className={`px-2 py-1 transition-colors ${
                  !isUnterebene
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                Gesamt
              </button>
              <button
                type="button"
                onClick={() => onWahlChange(parent.id, 'unterebene')}
                className={`px-2 py-1 border-l transition-colors ${
                  isUnterebene
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                Aufgeteilt
              </button>
            </div>
          )}
        </td>
        <td className="px-4 py-2">
          {!isUnterebene ? (
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={localSaetze[parent.id] ?? ''}
              onChange={e => onRowChange(parent.id, e.target.value)}
              onBlur={() => onRowBlur(parent.id, 1)}
              placeholder="—"
              className="h-7 text-right w-28 ml-auto"
            />
          ) : (
            <span className="block text-right text-muted-foreground text-sm pr-1">—</span>
          )}
        </td>
      </tr>
      {isUnterebene && isExpanded && children.map(child => (
        <tr key={child.id} className="border-t bg-muted/30">
          <td className="px-4 py-2 pl-10 text-sm text-muted-foreground">
            {child.name}
          </td>
          <td />
          <td className="px-4 py-2">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={localSaetze[child.id] ?? ''}
              onChange={e => onRowChange(child.id, e.target.value)}
              onBlur={() => onRowBlur(child.id, group.childEbene ?? 2)}
              placeholder="—"
              className="h-7 text-right w-28 ml-auto"
            />
          </td>
        </tr>
      ))}
      {isUnterebene && isExpanded && children.length === 0 && (
        <tr className="border-t bg-muted/30">
          <td colSpan={3} className="px-4 py-2 pl-10 text-sm text-muted-foreground">
            Keine Einträge in dieser Planversion.{' '}
            {kpiHref && (
              <a href={kpiHref} className="underline hover:text-foreground">
                Zur KPI-Modell-Verwaltung
              </a>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function UstSaetzeTabelle({
  title,
  groups,
  ebeneWahl,
  expandiert,
  localSaetze,
  onWahlChange,
  onToggle,
  onRowChange,
  onRowBlur,
  kpiHref,
}: {
  title: string
  groups: ParentGroup[]
  ebeneWahl: EbeneWahl
  expandiert: ExpandState
  localSaetze: Record<string, string>
  onWahlChange: (parentId: string, wahl: 'hier' | 'unterebene') => void
  onToggle: (parentId: string) => void
  onRowChange: (katId: string, value: string) => void
  onRowBlur: (katId: string, ebene: 1 | 2) => void
  kpiHref?: string
}) {
  if (groups.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kategorie</th>
              <th className="px-4 py-2 text-center font-medium w-40">Ebene</th>
              <th className="px-4 py-2 text-right font-medium w-36">UST-Satz (%)</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <ParentGroupRow
                key={group.parent.id}
                group={group}
                ebeneWahl={ebeneWahl}
                expandiert={expandiert}
                localSaetze={localSaetze}
                onWahlChange={onWahlChange}
                onToggle={onToggle}
                onRowChange={onRowChange}
                onRowBlur={onRowBlur}
                kpiHref={kpiHref}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UstSaetzeSektion({
  kategorieSaetze,
  versionId,
}: {
  ustSettings: UstSettingsHook
  kategorieSaetze: UstKategorieSaetzeHook
  versionId?: string
}) {
  const { saetze, loading: saetzeLoading, saveBatch } = kategorieSaetze
  const { categories: einnahmenCats, loading: eLoading } = useKpiCategories('einnahmen')
  const { categories: ausgabenCats, loading: aLoading } = useKpiCategories('ausgaben_kosten')
  const { categories: globalProdukte, loading: gpLoading } = useKpiCategories('produkte')
  // PROJ-83: Im Versions-Modus stammen die Unterzeilen von Produktverkäufe /
  // Marketing / Investitionen aus dem KPI-Modell DIESER Planversion.
  const isVersion = !!versionId
  const { categories: lpProdukte, loading: lpProdLoading } = useLangfristigeKpiKategorien(versionId ?? '', 'lp_produkt')
  const { categories: lpMarketing, loading: lpMktLoading } = useLangfristigeKpiKategorien(versionId ?? '', 'lp_marketingkanal')
  const { categories: lpInvest, loading: lpInvLoading } = useLangfristigeKpiKategorien(versionId ?? '', 'lp_investition')
  const { toast } = useToast()

  const [ebeneWahl, setEbeneWahl] = useState<EbeneWahl>({})
  const [expandiert, setExpandiert] = useState<ExpandState>({})
  const [localSaetze, setLocalSaetze] = useState<Record<string, string>>({})
  const initialized = useRef(false)

  const kpiHref = versionId
    ? `/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`
    : '/dashboard/kpi-modell'
  const ebeneAuswahlPfad = ustEbeneAuswahlPfad(versionId)

  // Versions-Kategorie-Hooks laden im Kurzfristig-Modus nie (leere versionId) und
  // werden dann auch nicht in `loading` einbezogen, sonst bliebe der Spinner hängen.
  const loading = saetzeLoading || eLoading || aLoading
    || (isVersion ? (lpProdLoading || lpMktLoading || lpInvLoading) : gpLoading)

  useEffect(() => {
    // Lade die Gesamt/Aufgeteilt-Auswahl aus der DB. Im Kurzfristig-Modus dient
    // localStorage als Rückfall (Abwärtskompatibilität); im Versions-Modus NICHT,
    // da localStorage nicht versionsspezifisch ist.
    fetch(ebeneAuswahlPfad)
      .then(r => r.ok ? r.json() : null)
      .then((dbWahl: Record<string, 1 | 2> | null) => {
        if (dbWahl && Object.keys(dbWahl).length > 0) {
          const wahl: EbeneWahl = {}
          const autoExpand: ExpandState = {}
          for (const [id, ebene] of Object.entries(dbWahl)) {
            wahl[id] = ebene === 2 ? 'unterebene' : 'hier'
            if (ebene === 2) autoExpand[id] = true
          }
          setEbeneWahl(wahl)
          setExpandiert(autoExpand)
          if (!isVersion) persistEbeneWahl(wahl)
        } else if (!isVersion) {
          const wahl = loadEbeneWahl()
          setEbeneWahl(wahl)
          const autoExpand: ExpandState = {}
          for (const [id, w] of Object.entries(wahl)) {
            if (w === 'unterebene') autoExpand[id] = true
          }
          setExpandiert(autoExpand)
        }
      })
      .catch(() => {
        if (isVersion) return
        const wahl = loadEbeneWahl()
        setEbeneWahl(wahl)
        const autoExpand: ExpandState = {}
        for (const [id, w] of Object.entries(wahl)) {
          if (w === 'unterebene') autoExpand[id] = true
        }
        setExpandiert(autoExpand)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ebeneAuswahlPfad])

  useEffect(() => {
    if (!loading && !initialized.current) {
      initialized.current = true
      const map: Record<string, string> = {}
      for (const s of saetze) {
        if (s.ust_satz !== null) {
          map[s.kategorie_id] = String(s.ust_satz)
        }
      }
      setLocalSaetze(map)
    }
  }, [loading, saetze])

  // Unterzeilen für "Produktverkäufe": im Versions-Modus die Produkte DIESER
  // Version, sonst die globalen KPI-Produkte (bisheriges Kurzfristig-Verhalten).
  const produktLevel1 = useMemo(() => {
    const quelle = isVersion ? lpProdukte : globalProdukte
    return quelle.filter(c => c.level === 1).sort((a, b) => a.sort_order - b.sort_order)
  }, [isVersion, lpProdukte, globalProdukte])

  // Versions-Marketingkanäle (flach).
  const marketingLevel1 = useMemo(
    () => lpMarketing.filter(c => c.level === 1).sort((a, b) => a.sort_order - b.sort_order),
    [lpMarketing]
  )

  // Versions-Investitionen: nur die Obergruppen (Ebene 1); Untergruppen erben
  // später den Satz der Obergruppe (außerhalb dieser Seite).
  const investitionLevel1 = useMemo(
    () => lpInvest.filter(c => c.level === 1).sort((a, b) => a.sort_order - b.sort_order),
    [lpInvest]
  )

  // IDs der Versions-Kategorien (für die Herkunfts-Markierung beim Speichern).
  const versionKatIds = useMemo(() => {
    if (!isVersion) return new Set<string>()
    return new Set<string>([
      ...produktLevel1.map(c => c.id),
      ...marketingLevel1.map(c => c.id),
      ...investitionLevel1.map(c => c.id),
    ])
  }, [isVersion, produktLevel1, marketingLevel1, investitionLevel1])

  const einnahmenGroups = useMemo(() => {
    const groups = buildGroups(einnahmenCats)
    return groups.map(g =>
      g.parent.name.toLowerCase().includes('produktverkäufe')
        ? { ...g, children: produktLevel1, childEbene: 1 as const }
        : g
    )
  }, [einnahmenCats, produktLevel1])

  const ausgabenGroups = useMemo(() => {
    const groups = buildGroups(ausgabenCats).filter(g => g.parent.name.toLowerCase() !== 'steuern')
    if (!isVersion) return groups
    // Versions-Modus: Marketing & Investitionen aus dem Versions-KPI-Modell.
    // Die globale Oberkategorie heißt "Produktinvestitionen"; auf dieser Seite
    // wird sie als "Investitionen" angezeigt (nur Label; gespeichert wird weiterhin
    // gegen die globale Kategorie-ID).
    return groups.map(g => {
      const n = g.parent.name.toLowerCase()
      if (n.includes('marketing')) return { ...g, children: marketingLevel1, childEbene: 1 as const }
      if (n.includes('investition')) {
        return {
          ...g,
          parent: { ...g.parent, name: 'Investitionen' },
          children: investitionLevel1,
          childEbene: 1 as const,
        }
      }
      return g
    })
  }, [ausgabenCats, isVersion, marketingLevel1, investitionLevel1])

  function handleWahlChange(parentId: string, wahl: 'hier' | 'unterebene') {
    const next = { ...ebeneWahl, [parentId]: wahl }
    setEbeneWahl(next)
    if (!isVersion) persistEbeneWahl(next)
    // Auswahl in der DB speichern (das Berechnungs-Backend liest sie)
    fetch(ebeneAuswahlPfad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: parentId, ebene: wahl === 'unterebene' ? 2 : 1 }]),
    }).catch(() => { /* unkritisch */ })
    if (wahl === 'unterebene') {
      setExpandiert(prev => ({ ...prev, [parentId]: true }))
    }
  }

  function handleToggle(parentId: string) {
    setExpandiert(prev => ({ ...prev, [parentId]: !prev[parentId] }))
  }

  function handleRowChange(katId: string, value: string) {
    setLocalSaetze(prev => ({ ...prev, [katId]: value }))
  }

  async function handleRowBlur(katId: string, ebene: 1 | 2) {
    const val = localSaetze[katId] ?? ''
    if (val !== '') {
      const num = parseFloat(val)
      if (isNaN(num) || num < 0 || num > 100) {
        toast({
          title: 'Ungültige Eingabe',
          description: 'UST-Satz muss zwischen 0 und 100 liegen.',
          variant: 'destructive',
        })
        const saved = saetze.find(s => s.kategorie_id === katId && s.ebene === ebene)
        setLocalSaetze(prev => ({
          ...prev,
          [katId]: saved?.ust_satz != null ? String(saved.ust_satz) : '',
        }))
        return
      }
    }
    try {
      await saveBatch([{
        kategorie_id: katId,
        ebene,
        ust_satz: val !== '' ? parseFloat(val) : null,
        // Im Versions-Modus die Herkunft mitschicken (global vs. Versions-Kategorie).
        ...(isVersion ? { quelle: versionKatIds.has(katId) ? 'version' as const : 'global' as const } : {}),
      }])
    } catch (e) {
      toast({
        title: 'Fehler beim Speichern',
        description: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  const hasNoCategories = einnahmenCats.length === 0 && ausgabenCats.length === 0

  const tableProps = {
    ebeneWahl,
    expandiert,
    localSaetze,
    onWahlChange: handleWahlChange,
    onToggle: handleToggle,
    onRowChange: handleRowChange,
    onRowBlur: handleRowBlur,
    kpiHref,
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <h2 className="text-base font-semibold">Umsatzsteuersätze</h2>

      {loading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Laden…</div>
      ) : hasNoCategories ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
          <p className="font-medium">Keine Kategorien im KPI-Modell gefunden</p>
          {/* Einnahmen-/Ausgabenkategorien sind global → immer zum globalen KPI-Modell */}
          <a href="/dashboard/kpi-modell">
            <Button variant="outline" size="sm" className="mt-2">
              Zum KPI-Modell
            </Button>
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <UstSaetzeTabelle title="Einnahmenarten" groups={einnahmenGroups} {...tableProps} />
          <UstSaetzeTabelle title="Ausgabenarten" groups={ausgabenGroups} {...tableProps} />
        </div>
      )}
    </div>
  )
}

// ─── Section 3: Einfuhrumsatzsteuer ──────────────────────────────────────────

function EinfuhrUstSektion({ ustSettings, versionId }: { ustSettings: UstSettingsHook; versionId?: string }) {
  const { einstellungen, loading, error, save } = ustSettings
  const { toast } = useToast()
  const [zahlungszielStr, setZahlungszielStr] = useState('0')
  const [satzStr, setSatzStr] = useState('0')
  const initialized = useRef(false)
  const isVersion = !!versionId
  // Produktquelle: im Versions-Modus die Produkte DIESER Version, sonst global.
  const { categories: globalProdukte, loading: gpLoading } = useKpiCategories('produkte')
  const { categories: lpProdukte, loading: lpProdLoading } = useLangfristigeKpiKategorien(versionId ?? '', 'lp_produkt')
  const produktCats = isVersion ? lpProdukte : globalProdukte
  const produkteLoading = isVersion ? lpProdLoading : gpLoading
  const kpiHref = versionId
    ? `/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`
    : '/dashboard/kpi-modell'
  const { isFiskalverzollung, toggle: toggleFiskalverzollung } = useEinfuhrustFiskalverzollung(versionId)

  useEffect(() => {
    if (!loading && !initialized.current) {
      initialized.current = true
      setZahlungszielStr(String(einstellungen.einfuhrust_zahlungsziel_tage))
      setSatzStr(String(einstellungen.einfuhrust_satz))
    }
  }, [loading, einstellungen])

  async function handleZahlungszielBlur() {
    const tage = parseInt(zahlungszielStr, 10)
    if (isNaN(tage) || tage < 0) {
      toast({
        title: 'Ungültige Eingabe',
        description: 'Zahlungsziel muss eine ganze Zahl ≥ 0 sein.',
        variant: 'destructive',
      })
      setZahlungszielStr(String(einstellungen.einfuhrust_zahlungsziel_tage))
      return
    }
    if (tage === einstellungen.einfuhrust_zahlungsziel_tage) return
    try {
      await save({ einfuhrust_zahlungsziel_tage: tage })
    } catch (e) {
      toast({
        title: 'Fehler beim Speichern',
        description: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  async function handleSatzBlur() {
    const satz = parseFloat(satzStr)
    if (isNaN(satz) || satz < 0 || satz > 100) {
      toast({
        title: 'Ungültige Eingabe',
        description: 'Einfuhr-Umsatzsteuer-Satz muss zwischen 0 und 100 liegen.',
        variant: 'destructive',
      })
      setSatzStr(String(einstellungen.einfuhrust_satz))
      return
    }
    if (satz === einstellungen.einfuhrust_satz) return
    try {
      await save({ einfuhrust_satz: satz })
    } catch (e) {
      toast({
        title: 'Fehler beim Speichern',
        description: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="py-4 text-center text-sm text-muted-foreground">Laden…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const produktLevel1 = produktCats
    .filter(c => c.level === 1)
    .sort((a, b) => a.sort_order - b.sort_order)

  async function handleFiskalverzollungToggle(produktId: string, checked: boolean) {
    try {
      await toggleFiskalverzollung(produktId, checked)
    } catch (e) {
      toast({
        title: 'Fehler beim Speichern',
        description: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <h2 className="text-base font-semibold">Einfuhrumsatzsteuer</h2>

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="einfuhrust-satz">Einfuhr-Umsatzsteuer-Satz (%)</Label>
          <Input
            id="einfuhrust-satz"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={satzStr}
            onChange={e => setSatzStr(e.target.value)}
            onBlur={handleSatzBlur}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="einfuhrust-zahlungsziel">Zahlungsziel (Tage)</Label>
          <Input
            id="einfuhrust-zahlungsziel"
            type="number"
            min={0}
            step={1}
            value={zahlungszielStr}
            onChange={e => setZahlungszielStr(e.target.value)}
            onBlur={handleZahlungszielBlur}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Fiskalverzollung je Produkt</p>
        {produkteLoading ? (
          <div className="py-3 text-sm text-muted-foreground">Laden…</div>
        ) : produktCats.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            Keine Produkte {isVersion ? 'in dieser Planversion' : 'im KPI-Modell'} gefunden.{' '}
            <a href={kpiHref} className="underline hover:text-foreground">
              Zur KPI-Modell-Verwaltung
            </a>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Produkt</th>
                  <th className="px-4 py-2 text-center font-medium w-40">Fiskalverzollung</th>
                </tr>
              </thead>
              <tbody>
                {produktLevel1.map(produkt => (
                  <tr key={produkt.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{produkt.name}</td>
                    <td className="px-4 py-2 text-center">
                      <Checkbox
                        checked={isFiskalverzollung(produkt.id)}
                        onCheckedChange={checked => handleFiskalverzollungToggle(produkt.id, !!checked)}
                        aria-label={`Fiskalverzollung für ${produkt.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

// versionId optional: ohne → globale Kurzfristig-Steuereinstellungen (PROJ-65,
// unverändertes Verhalten); mit → versionsgebundene Langfristig-Variante (PROJ-83).
export function SteuereinstellungenFormular({ versionId }: { versionId?: string } = {}) {
  const ustSettings = useUstEinstellungen(versionId)
  const kategorieSaetze = useUstKategorieSaetze(versionId)

  return (
    <Tabs defaultValue="grundeinstellungen" className="space-y-4">
      <TabsList className="w-full h-auto">
        <TabsTrigger value="grundeinstellungen" className="flex-1">
          Umsatzsteuer-Grundeinstellungen
        </TabsTrigger>
        <TabsTrigger value="saetze" className="flex-1">
          Umsatzsteuersätze
        </TabsTrigger>
        <TabsTrigger value="einfuhr" className="flex-1">
          Einfuhrumsatzsteuer
        </TabsTrigger>
      </TabsList>
      <TabsContent value="grundeinstellungen">
        <GrundeinstellungenSektion ustSettings={ustSettings} />
      </TabsContent>
      <TabsContent value="saetze">
        <UstSaetzeSektion ustSettings={ustSettings} kategorieSaetze={kategorieSaetze} versionId={versionId} />
      </TabsContent>
      <TabsContent value="einfuhr">
        <EinfuhrUstSektion ustSettings={ustSettings} versionId={versionId} />
      </TabsContent>
    </Tabs>
  )
}

// PROJ-83: versionsgebundene Variante (Langfristige Planung). Reine Verdrahtung —
// reicht die versionId an die parametrisierte Komponente durch.
export function LangfristigeSteuereinstellungenFormular({ versionId }: { versionId: string }) {
  return <SteuereinstellungenFormular versionId={versionId} />
}
