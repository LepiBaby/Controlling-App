import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduziert die Modulanzahl beim Kompilieren großer Barrel-Imports → schnellere
  // (Dev-)Kompilierung der Seiten, die diese Libs nutzen (Tabellen, Diagramme, Icons).
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "date-fns"],
    // Diese Maschine hat 16 Kerne → Next/Turbopack spawnt sonst ~15 jest-worker-
    // Kindprozesse für die Static-Path-Generierung. Bei dieser Masse bricht auf
    // Windows die Worker-IPC-Pipe (`write EPIPE` → Worker-Crash → "Jest worker
    // encountered child process exceptions"). Vgl. vercel/next.js#27000.
    // 1 Worker = einziger nachweislich crashfreier Wert (cpus:4 crasht unter Last
    // mit vielen Tabs erneut per EPIPE). Mit normalem Tab-Verbrauch (1–2 Tabs) ist
    // das schnell; viele Tabs gleichzeitig kann KEIN cpus-Wert auffangen.
    cpus: 1,
  },
  // Dev-DX: bereits kompilierte Seiten lange im Speicher halten, damit Zurück-
  // Navigieren NICHT neu kompiliert (sonst wiederkehrende Kalt-Spikes von ~5-11s).
  // Greift nur im Dev-Server, hat keine Auswirkung auf Production.
  onDemandEntries: {
    maxInactiveAge: 1000 * 60 * 60, // 1 Stunde
    pagesBufferLength: 60, // bis zu 60 Seiten warm halten
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
  ],
};

export default nextConfig;
