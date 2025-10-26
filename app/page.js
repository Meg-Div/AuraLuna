"use client";

import { useState } from "react";
import Image from "next/image";

const MOODS = [
  "Sleepy",
  "Serene",
  "Gentle Rain",
  "Ocean",
  "Forest Night",
  "Warm Fireplace",
  // Social Impact
  "Calm",
];

export default function Home() {
  // A. Removed contextInput state
  const [liveMode, setLiveMode] = useState(false);
  const [mood, setMood] = useState("Sleepy");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");

  // lavender/grey palette (Tailwind utilities)
  const bg = "bg-gradient-to-b from-[#1f1f2a] to-[#0f0f14]"; // deep grey→ink
  const panel = "bg-[#1a1a24]/70 ring-1 ring-white/10"; // soft grey panel
  const accent = "bg-[#9b8bc4] hover:bg-[#a798cf]"; // muted lavender
  const textSoft = "text-[#c9c7d1]"; // soft grey
  const textLav = "text-[#b7a6da]"; // lavender text

  // helper: base64 → Blob (More robust, using fetch API on the client)
  // Replaces your existing b64ToBlob function
  async function b64ToBlob(b64Data, contentType = "audio/mpeg") {
    // 1. Prepend the Data URL prefix
    const dataUrl = `data:${contentType};base64,${b64Data}`;

    // 2. Use fetch to treat the Data URL as a resource and convert it to a Blob
    const response = await fetch(dataUrl);
    return response.blob();
  }

  async function postJsonOrThrow(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await res.json();
      if (!res.ok) {
        const msg = j?.error || `HTTP ${res.status}`;
        const details = j?.details || j?.bodySnippet || j;
        throw new Error(
          `${msg} ${
            typeof details === "string" ? details : JSON.stringify(details)
          }`
        );
      }
      return j;
    } else {
      const t = await res.text();
      throw new Error(
        `Non-JSON from ${url} (status ${res.status}). ${t.slice(0, 160)}`
      );
    }
  }

  async function handleGenerate() {
    setError("");
    setMessage("");
    setAudioUrl(null);
    setLoading(true);

    try {
      // Claude, Generates the whisper text
      // API payload is now clean, only sending 'mood'
      const cjson = await postJsonOrThrow("/api/claude", { mood });
      const text =
        cjson.prompt ||
        cjson.text ||
        cjson.output ||
        "Rest and breathe softly.";
      setMessage(text);

      // Generate or stream audio (Vapi live or Fish static)
      let url = null;

      // --- Static Whisper via Fish (TTS) ---
      const fjson = await postJsonOrThrow("/api/fish", {
        text,
        format: "mp3",
        speed: 0.7,
      });
      if (fjson.audioUrl) {
        url = fjson.audioUrl;
      } else if (fjson.audio && (fjson.contentType || fjson.mimeType)) {
        url = `data:${fjson.contentType || fjson.mimeType};base64,${
          fjson.audio
        }`;
      }

      // Validate and play
      if (!url) throw new Error("No audio returned");
      setAudioUrl(url);

      const audio = new Audio(url);
      audio.play().catch(() => {
        /* fallback to visible player */
      });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`min-h-screen ${bg} text-white`}>
      <header className="max-w-4xl mx-auto px-6 pt-2 flex justify-center">
        <Image
          src="/auraluna-logo.png"
          alt="AuraLuna Logo"
          width={500}
          height={500}
          className="object-contain"
          priority
        />
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-0 pb-8 -mt-2">
        <div
          className={`rounded-2xl ${panel} p-6 md:p-8 backdrop-blur-md shadow-2xl`}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Drift into <span className={textLav}>gentle</span> sleep.
          </h2>
          <p className={`${textSoft} mb-8`}>
            AI-crafted whisper narration to send you to sleep.
          </p>

          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
            {/* Live toggle */}

            {/* Mood */}
            <div className="flex-1">
              <label className="block text-sm mb-1 text-[#a6a4b1]">Mood</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full rounded-xl bg-[#121219] border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-[#b7a6da]"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`rounded-xl px-6 py-3 font-semibold transition-colors ${accent} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {loading
                ? liveMode
                  ? "Streaming…"
                  : "Generating…"
                : liveMode
                ? "Start Live Whisper"
                : "Generate Whisper"}
            </button>
          </div>

          {/* Error */}
          {!!error && (
            <div className="mt-6 rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-3 text-red-200">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
