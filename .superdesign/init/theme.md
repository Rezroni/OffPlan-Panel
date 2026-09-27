# Theme

## Compact token summary

- Background: `#f8fafc`; foreground/ink: `#0f172a`; cards: `#ffffff`; border: `#e2e8f0`.
- Primary: sky `#0284c7`; success: emerald `#059669`; warning/accent: amber `#d97706`; destructive: rose `#e11d48`.
- Muted surface/text: `#f1f5f9` / `#64748b`.
- Font: native system sans stack; many numerical blocks override to Tailwind `font-mono`.
- Radius: base `1rem`; extended `1rem`, `1.25rem`, `1.75rem`; pills use full rounding.
- Shadows: subtle 1–3px slate shadows; tactile hover uses 10–25px diffuse elevation.
- Layout: `max-w-7xl`, sticky top header, responsive breakpoints from Tailwind defaults.
- Current visual inconsistency: core pages are light slate/sky, while Studio, CMA, Alternatives, Imports, Reports and Data Health use dark near-black surfaces with amber/indigo/purple accents.

## Raw `src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --border: #e2e8f0;
  --primary: #0284c7;
  --primary-foreground: #ffffff;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #d97706;
  --accent-foreground: #ffffff;
  --destructive: #e11d48;
  --destructive-foreground: #ffffff;
  --success: #059669;
  --success-foreground: #ffffff;
  --warning: #d97706;
  --warning-foreground: #ffffff;
  --radius: 1rem;
}

body {
  color: var(--foreground);
  background-color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.glass-panel, .luxury-card { background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05); }
.glass-panel-hover, .luxury-card-hover { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.glass-panel-hover:hover, .luxury-card-hover:hover { border-color: #cbd5e1; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03); transform: translateY(-2px); }
.glass-input, .luxury-input { background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; transition: all 0.15s ease-in-out; }
.glass-input:focus, .luxury-input:focus { outline: none; border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); background: #ffffff; }
.badge-emerald { background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.badge-amber { background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.badge-blue { background-color: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
.badge-rose { background-color: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
.hatched-bar { background-image: repeating-linear-gradient(45deg, rgba(15,23,42,.06), rgba(15,23,42,.06) 3px, transparent 3px, transparent 7px); }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f8fafc; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
@media print { body { background: #fff !important; background-image: none !important; color: #000 !important; } .no-print { display:none !important; } .print-only { display:block !important; } .print-page-break { page-break-after:always; } }
```

## Raw `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: ["class"],
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: {
      background: "var(--background)", foreground: "var(--foreground)", border: "var(--border)", card: "var(--card)", "card-foreground": "var(--card-foreground)",
      surface: { subtle: "#f8fafc", card: "#ffffff", elevated: "#ffffff", hover: "#f1f5f9", border: "#e2e8f0" },
      brand: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 900: "#0c4a6e" },
      primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" }, muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" }, accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" }, destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" }, success: { DEFAULT: "var(--success)", foreground: "var(--success-foreground)" }, warning: { DEFAULT: "var(--warning)", foreground: "var(--warning-foreground)" },
    },
    borderRadius: { "2xl": "1rem", "3xl": "1.25rem", "4xl": "1.75rem", lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    boxShadow: { subtle: "0 1px 2px 0 rgba(15,23,42,.05)", tactile: "0 1px 3px 0 rgba(15,23,42,.06), 0 4px 12px -2px rgba(15,23,42,.04)", "tactile-hover": "0 10px 25px -5px rgba(15,23,42,.08), 0 8px 10px -6px rgba(15,23,42,.03)", elevated: "0 12px 32px -8px rgba(15,23,42,.08), 0 1px 3px 0 rgba(15,23,42,.04)", card: "0 1px 3px 0 rgba(15,23,42,.04), 0 1px 2px -1px rgba(15,23,42,.04)" },
  } },
  plugins: [],
};
export default config;
```
