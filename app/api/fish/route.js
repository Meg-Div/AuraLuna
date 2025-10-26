// app/api/fish/route.js
import { NextResponse } from "next/server";
export const runtime = "nodejs";

const BASE = (process.env.FISHAUDIO_BASE || "https://api.fish.audio").replace(
  /\/+$/,
  ""
);
const TTS_PATH = process.env.FISHAUDIO_TTS_PATH || "/v1/tts";
const API_KEY = process.env.FISHAUDIO_API_KEY || "";

// My cloned model
const FIXED_MODEL_ID = "4beafc273e80402190a864cbfa961ba0";

function bufToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      text,
      // Default to slowest 0.7 speed if not provided
      speed = 0.7,
      format = "mp3",
      language = "en",
    } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required (string)" },
        { status: 400 }
      );
    }

    // Build payload: Use canonical parameter names and the fixed ID
    const payload = {
      text,
      format,
      speed,
      language,
      model_id: FIXED_MODEL_ID,
      reference_id: FIXED_MODEL_ID, // <-- CRITICAL ADDITION for closed voice selection
    };

    // Optional: print what you’re sending, to verify in your terminal
    console.log("[Fish TTS] POST payload ->", payload);

    const url = `${BASE}${TTS_PATH}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const ct = r.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      const json = await r.json();
      if (!r.ok) {
        console.error("[Fish TTS] Error JSON <-", json);
        return NextResponse.json(
          { error: "Fish TTS error", details: json },
          { status: r.status || 500 }
        );
      }

      const audioUrl =
        json.audioUrl || json.url || json.result?.audioUrl || json.data?.url;
      const base64 =
        json.audio ||
        json.audio_base64 ||
        json.result?.audio ||
        json.data?.audio;

      if (audioUrl) return NextResponse.json({ audioUrl });

      if (base64)
        return NextResponse.json({ audio: base64, contentType: "audio/mpeg" });

      return NextResponse.json(
        { error: "Unexpected Fish TTS JSON shape", raw: json },
        { status: 502 }
      );
    }

    if (ct.startsWith("audio/")) {
      const arrayBuf = await r.arrayBuffer();
      const base64 = Buffer.from(arrayBuf).toString("base64");
      if (!r.ok) {
        return NextResponse.json(
          {
            error: "Fish TTS audio error",
            contentType: ct,
            size: arrayBuf.byteLength,
          },
          { status: r.status || 500 }
        );
      }
      return NextResponse.json({ audio: base64, contentType: ct });
    }

    const textBody = await r.text();
    return NextResponse.json(
      {
        error: `Fish TTS unexpected content-type '${ct}'`,
        body: textBody.slice(0, 300),
      },
      { status: r.status || 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Unknown Fish TTS error" },
      { status: 500 }
    );
  }
}
