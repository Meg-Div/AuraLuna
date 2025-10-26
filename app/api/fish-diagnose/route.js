import { NextResponse } from "next/server";

const BASES = [
  process.env.FISHAUDIO_BASE || "https://api.fish.audio",
  "https://api.fish.audio/v1", // sometimes the API expects /v1 in the base
];

const CREATE_PATHS = [
  process.env.FISHAUDIO_CREATE_PATH, // env override first if you set it
  "/v1/generate",
  "/v1/music/generate",
  "/v1/audio/generate",
  "/v1/text-to-music",
  "/api/generate",
  "/v1/compose",
  "/generate", // if /v1 already in base, this may be right
].filter(Boolean);

export async function GET() {
  const tries = [];
  for (const base of BASES) {
    for (const path of CREATE_PATHS) {
      const url = `${base.replace(/\/+$/, "")}${path}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.FISHAUDIO_API_KEY || ""}`,
          },
          // send a tiny body; most servers will at least return JSON error
          body: JSON.stringify({ prompt: "test", duration: 5, format: "mp3" }),
        });
        const text = await r.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        tries.push({
          url,
          status: r.status,
          kind: json ? "json" : "text",
          body: json || text.slice(0, 120),
        });
      } catch (e) {
        tries.push({ url, status: "fetch_error", error: String(e) });
      }
    }
  }
  return NextResponse.json({ tries });
}
