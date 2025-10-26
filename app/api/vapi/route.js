// app/api/vapi/route.js
import { NextResponse } from "next/server";
export const runtime = "nodejs";

const VAPI_BASE = (process.env.VAPI_BASE || "https://api.vapi.ai").replace(
  /\/+$/,
  ""
);
const VAPI_AGENT_ID = process.env.VAPI_AGENT_ID || "";
const VAPI_API_KEY = process.env.VAPI_API_KEY || "";

/** Simple health check: curl http://localhost:3000/api/vapi */
export async function GET() {
  return NextResponse.json({
    ok: true,
    haveAgent: Boolean(VAPI_AGENT_ID),
    base: VAPI_BASE,
  });
}

/**
 * Request body (JSON): { text?: string, mood?: string }
 * Normalized success:
 *   { audioUrl: "https://..." }  OR
 *   { audio: "<base64>", contentType: "audio/mpeg" }
 */
export async function POST(req) {
  try {
    const { text, mood } = await req.json();

    if (!VAPI_AGENT_ID || !VAPI_API_KEY) {
      return NextResponse.json(
        {
          error: "Missing env",
          details: {
            VAPI_AGENT_ID: !!VAPI_AGENT_ID,
            VAPI_API_KEY: !!VAPI_API_KEY,
          },
        },
        { status: 500 }
      );
    }

    const prompt =
      text ||
      `Create a soft, ${
        mood || "sleepy"
      } whisper, 1–2 short lines for bedtime.`;

    const url = `${VAPI_BASE}/v1/agents/${VAPI_AGENT_ID}/speak`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: prompt, format: "mp3" }),
    });

    const ct = r.headers.get("content-type") || "";
    // If JSON, parse and normalize
    if (ct.includes("application/json")) {
      const j = await r.json();
      if (!r.ok) {
        return NextResponse.json(
          {
            error: "Vapi error",
            status: r.status,
            details: j,
          },
          { status: r.status || 500 }
        );
      }
      const audioUrl = j.audioUrl || j.url;
      const base64 = j.audio || j.audio_base64 || j.result?.audio;
      if (audioUrl) return NextResponse.json({ audioUrl });
      if (base64)
        return NextResponse.json({ audio: base64, contentType: "audio/mpeg" });
      return NextResponse.json(
        { error: "Unexpected Vapi JSON shape", raw: j },
        { status: 502 }
      );
    }

    // If audio/*, convert to base64
    if (ct.startsWith("audio/")) {
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      return NextResponse.json({ audio: b64, contentType: ct });
    }

    // Non-JSON, non-audio → capture text so the client can SEE what's wrong
    const textBody = await r.text();
    return NextResponse.json(
      {
        error: "Vapi non-JSON",
        status: r.status,
        contentType: ct,
        bodySnippet: textBody.slice(0, 300),
      },
      { status: r.status || 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Vapi route error" },
      { status: 500 }
    );
  }
}
