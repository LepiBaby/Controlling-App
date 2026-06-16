import { UmsatzausgabenTabelle } from '@/components/umsatzausgaben-tabelle'

export default function UmsatzausgabenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Umsatzausgaben</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Produkt-, Vertriebs- und Marketingausgaben je Kalenderwoche — automatisch berechnet, manuell anpassbar
        </p>
      </div>
      <UmsatzausgabenTabelle />
    </div>
  )
}
