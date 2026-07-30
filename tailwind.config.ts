import type { Config } from "tailwindcss";

// Enterprise design tokens. Neutrals lean cool-gray (Linear / Attio / Vercel
// style) rather than pure grayscale — reads as more sophisticated at scale.
// The `lane` accent stays the single brand color for actions and status.

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Text. Not pure black — enterprise design almost never uses #000
        // because it reads as too heavy on white backgrounds.
        ink: {
          DEFAULT: "#0A0A0B",   // primary text
          soft:    "#1D1F23",   // secondary text
          muted:   "#5C6470",   // tertiary text / metadata
          faint:   "#9CA3AF",   // placeholder / disabled
        },
        lane: {
          DEFAULT: "#2563EB",   // primary action blue — slightly warmer than before
          soft:    "#3B82F6",
          hot:     "#DC2626",
          warm:    "#D97706",
          cool:    "#059669",
        },
        surface: {
          DEFAULT:  "#FFFFFF",   // primary background (cards)
          sub:      "#F8F9FB",   // secondary background (page bg)
          subtle:   "#F0F2F5",   // hover/muted
          border:   "#E5E7EB",   // primary border
          divider:  "#EEF0F3",   // very subtle divider
        },
      },
      fontFamily: {
        // Inter is the enterprise-SaaS default. Variable weight, great at
        // small sizes, excellent kerning. Loaded via next/font in layout.tsx
        // so no external <link> and no FOUT.
        sans: [
          "var(--font-inter)",
          "ui-sans-serif", "system-ui", "-apple-system",
          "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        // Multi-layer shadows in the Vercel / Linear style. First layer is
        // the crisp edge, second is the diffuse spread. Reads more like
        // real light than a single flat drop shadow.
        "elev-1": "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        "elev-2": "0 2px 4px rgba(15,23,42,0.05), 0 4px 12px rgba(15,23,42,0.06)",
        "elev-3": "0 4px 8px rgba(15,23,42,0.06), 0 12px 24px rgba(15,23,42,0.08)",
        "focus":  "0 0 0 2px rgba(37,99,235,0.25)",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
