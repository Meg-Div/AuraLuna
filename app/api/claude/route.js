import { NextResponse } from "next/server";

const ANTHROPIC_HEADERS = {
  "x-api-key": process.env.ANTHROPIC_API_KEY,
  "content-type": "application/json",
  "anthropic-version": "2023-06-01",
};

// preferred models in order; we’ll pick the first one you have
const PREFERRED = [
  "claude-3-5-sonnet-latest",
  "claude-3-sonnet-latest",
  "claude-3-haiku-20240307", // dated ID
  "claude-3-haiku-latest", // alias (some accounts don't have this)
];

async function chooseModel() {
  // Ask Anthropic which models your key can see
  const r = await fetch("https://api.anthropic.com/v1/models", {
    method: "GET",
    headers: ANTHROPIC_HEADERS,
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Models listing failed: ${t}`);
  }

  const data = await r.json(); // { data: [{id: "..."} , ...] }
  const ids = (data?.data || []).map((m) => m.id);

  // Pick the first preferred model that exists in your account
  for (const m of PREFERRED) {
    if (ids.includes(m)) return m;
  }

  // As a last resort, pick any Claude 3/3.5 model you have
  const fallback = ids.find((id) => /^claude-3/i.test(id));
  if (fallback) return fallback;

  throw new Error("No Claude models found for this API key.");
}

export async function POST(req) {
  try {
    const { mood } = await req.json();
    if (!mood) {
      return NextResponse.json({ error: "Mood is required" }, { status: 400 });
    }

    const model = await chooseModel();

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: ANTHROPIC_HEADERS,
      body: JSON.stringify({
        model,
        max_tokens: 180,
        system:
          "You are a whisper ASMR artist. Return multiple, short, simple sentences in a calming bedtime voice (no quotes, no emojis), suitable to be read aloud in a slow, soft voice. Use ellipses (...) to indicate necessary pauses for a gentle, measured pace. Keep the response under 100 words. Do not use terms of endearment, but do be direct, similar to 'let your eyes flutter shut, and drift off to sleep.'",
        messages: [
          {
            role: "user",
            content: `Mood: ${mood}. Create a gentle quiet whisper-style experience to help someone fall asleep.`,
          },
        ],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      // bubble up Anthropic’s exact error for fast debugging
      return NextResponse.json(
        { error: "Claude error", details: data },
        { status: resp.status }
      );
    }

    const text =
      data?.content?.[0]?.text?.trim() || "Soft ambient hush for deep rest.";
    return NextResponse.json({ model, prompt: text });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
