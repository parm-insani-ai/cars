import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B0F14", soft: "#1A2029", muted: "#5B6775" },
        lane: { DEFAULT: "#0EA5E9", hot: "#F43F5E", warm: "#F59E0B", cool: "#10B981" },
        surface: { DEFAULT: "#FFFFFF", sub: "#F7F8FA", border: "#E5E8EB" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
