// PROJ-107: Reiner Tilgungs-/Zinsplan einer Finanzierung (Ratendarlehen).
// Bewusst ohne Abhängigkeiten, damit Client (Finanzierungsausgaben Planung) und
// Server (Auswertungen) dieselbe Rechnung verwenden.
//
// Regeln:
//  • Laufzeit L Monate ab Startmonat; die ersten F Monate sind tilgungsfrei.
//  • Tilgung: Finanzierungssumme gleichmäßig auf die Monate F … L−1 verteilt
//    (letzte Rate gleicht Rundungsdifferenzen aus → Summe Tilgung = Betrag).
//  • Zinsen je Monat = offenes Volumen zum Monatsanfang × Zinssatz p. a. / 12.

export interface Darlehen {
  betrag: number
  zinssatz: number // % p. a.
  laufzeit_monate: number
  tilgungsfrei_monate: number
  start_jahr: number
  start_monat: number // 1–12
}

export interface TilgungsplanMonat {
  jahr: number
  monat: number
  restschuldAnfang: number
  zinsen: number
  tilgung: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function berechneTilgungsplan(d: Darlehen): TilgungsplanMonat[] {
  const laufzeit = Math.max(1, Math.floor(d.laufzeit_monate))
  const frei = Math.min(Math.max(0, Math.floor(d.tilgungsfrei_monate)), laufzeit - 1)
  const tilgungsMonate = laufzeit - frei
  const rate = round2(d.betrag / tilgungsMonate)
  const monatsZins = d.zinssatz / 100 / 12

  const plan: TilgungsplanMonat[] = []
  let rest = round2(d.betrag)
  let jahr = d.start_jahr
  let monat = d.start_monat
  for (let i = 0; i < laufzeit; i++) {
    const zinsen = round2(rest * monatsZins)
    let tilgung = 0
    if (i >= frei) tilgung = i === laufzeit - 1 ? rest : Math.min(rate, rest)
    plan.push({ jahr, monat, restschuldAnfang: rest, zinsen, tilgung })
    rest = round2(rest - tilgung)
    monat += 1
    if (monat > 12) {
      monat = 1
      jahr += 1
    }
  }
  return plan
}
