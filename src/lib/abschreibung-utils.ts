export const ABSCHREIBUNG_MONATE: Record<string, number> = {
  '1_jahr': 12,
  '3_jahre': 36,
  '5_jahre': 60,
  '7_jahre': 84,
  '10_jahre': 120,
}

export function addMonthsWithClamp(ursprung: string, offset: number): string {
  const [yStr, mStr, dStr] = ursprung.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10) - 1
  const d = parseInt(dStr, 10)
  const zielJahr = y + Math.floor((m + offset) / 12)
  const zielMonat = ((m + offset) % 12 + 12) % 12
  const letzterTag = new Date(zielJahr, zielMonat + 1, 0).getDate()
  const tag = Math.min(d, letzterTag)
  const mm = String(zielMonat + 1).padStart(2, '0')
  const dd = String(tag).padStart(2, '0')
  return `${zielJahr}-${mm}-${dd}`
}

export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}
