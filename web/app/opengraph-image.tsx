import { ImageResponse } from "next/og";

// A branded 1200×630 card for link previews (Google, iMessage, socials).
export const alt = "TopSpin — The physics of a better game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f5f2e8",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 999,
              background: "#d3e94c",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 700, color: "#1d221b", letterSpacing: "0.06em" }}>
            TopSpin Labs
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, color: "#1d221b", lineHeight: 1.02, letterSpacing: "-0.03em" }}>
            The physics of a
          </div>
          <div style={{ fontSize: 84, color: "#17673a", fontStyle: "italic", lineHeight: 1.02, letterSpacing: "-0.03em" }}>
            better game.
          </div>
        </div>

        {/* footer line */}
        <div style={{ fontSize: 26, color: "#5a6152", fontFamily: "monospace" }}>
          On-device stroke analysis · Real drag + Magnus physics
        </div>
      </div>
    ),
    { ...size },
  );
}
