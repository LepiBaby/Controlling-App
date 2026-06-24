import type { ReactNode } from 'react'

// Versuch 1 (Dev-Performance): KEIN `force-dynamic` mehr. Es hat den ursprünglichen
// Turbopack-Worker-Crash nie behoben (das macht `experimental.cpus: 1` in
// next.config.ts) — deaktivierte aber das Client-seitige Router-Caching dieser
// Seiten, wodurch jeder Prefetch/Soft-Nav die Seite erneut vom Server holte
// (Dauerfeuer bei mehreren Tabs/Navigation). Ohne force-dynamic greift der
// Client-Cache wieder. Reine Routing-/Caching-Einstellung — verändert weder
// Berechnungen noch Darstellung.
export default function VersionLayout({ children }: { children: ReactNode }) {
  return children
}
