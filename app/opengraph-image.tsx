import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Udaan Academy, GT Road, Phagwara";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const font = await readFile(join(process.cwd(), "fonts/noto-sans-latin-700-normal.woff"));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#faf7ec",
          color: "#1c293f",
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#91380e" }}>GT Road, Phagwara</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", fontSize: 84, lineHeight: 1 }}>Udaan Academy</div>
          <div style={{ display: "flex", fontSize: 36, color: "#3f4858" }}>
            Coaching on GT Road, Phagwara
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#91380e" }}>
          IELTS · JEE · NEET · Punjab board · Spoken English
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Noto Sans", data: font, weight: 700, style: "normal" }],
    },
  );
}
