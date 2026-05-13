import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B0F14", soft: "#1A2029", muted: "#5F6975" },
        lane: {
          DEFAULT: "#1F6FEB",   // calm blue
          hot:     "#E11D48",   // rose
          warm:    "#D97706",   // amber-600
          cool:    "#16A34A",   // green-600
        },
        surface: {
          DEFAULT: "#FFFFFF",
          sub:     "#F7F8FA",
          border:  "#E4E7EB",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
