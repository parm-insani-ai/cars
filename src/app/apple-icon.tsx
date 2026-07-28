import { ImageResponse } from "next/og";

// iOS "Add to Home Screen" needs a PNG apple-touch-icon at 180x180 (SVG
// support is spotty across Safari versions). Rather than shipping a static
// PNG file that has to be regenerated each brand tweak, this route uses
// Next.js's built-in ImageResponse to render one on demand — the icon
// design stays inline with the tailwind theme + logo colors.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
        }}
      >
        <svg viewBox="0 0 24 24" width="112" height="112" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9" />
          <circle cx="12" cy="12" r="2.5" fill="#ffffff" stroke="none" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
