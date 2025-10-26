import { NextResponse } from "next/server";
export const runtime = "nodejs";

const BASE = (process.env.FISHAUDIO_BASE || "https://api.fish.audio").replace(
  /\/+$/,
  ""
);

const PATH = process.env.FISHAUDIO_MODELS_PATH || "/model";
const API_KEY = process.env.FISHAUDIO_API_KEY || "";

export async function GET() {
  try {
    const url = `${BASE}${PATH}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    const ct = r.headers.get("content-type") || "";
    const text = await r.text();

    // Show raw response if not JSON so we can adjust PATH quickly
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        {
          error: "Unexpected content-type from Fish",
          url,
          status: r.status,
          body: text.slice(0, 300),
        },
        { status: r.status || 500 }
      );
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!json)
      return NextResponse.json(
        { error: "Invalid JSON from Fish", url, raw: text.slice(0, 300) },
        { status: 500 }
      );

    const list = (Array.isArray(json) ? json : json?.data) || [];
    const voices = list
      .map((v) => ({
        id: v.id || v.modelId || v.voice_id || v._id,
        name: v.name || v.displayName || v.title || v.slug || "Unnamed",
        tags: v.tags || v.labels || v.attributes || [],
        raw: v,
      }))
      .filter((v) => v.id);

    return NextResponse.json({ count: voices.length, voices, source: url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
