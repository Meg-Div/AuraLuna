import { NextResponse } from "next/server";
export const runtime = "nodejs";

// Try several common bases if VAPI_BASE is unset/wrong
const BASES = [
  process.env.VAPI_BASE || "",
  "https://api.vapi.ai",
  "https://api.vapi.run",
  "https://api.vapi.dev",
].filter(Boolean);

// common endpoints (v1/v2 + with/without agent id)
function endpoints(base, agentId) {
  const b = base.replace(/\/+$/, "");
  return [
    {
      label: "v2: tts",
      url: `${b}/v2/tts`,
      method: "POST",
      body: { text: "test", format: "mp3" },
    },
    {
      label: "v1: tts",
      url: `${b}/v1/tts`,
      method: "POST",
      body: { text: "test", format: "mp3" },
    },
    {
      label: "v2: agents/speak(body)",
      url: `${b}/v2/agents/speak`,
      method: "POST",
      body: { agentId, text: "test", format: "mp3" },
    },
    {
      label: "v1: agents/speak(body)",
      url: `${b}/v1/agents/speak`,
      method: "POST",
      body: { agentId, text: "test", format: "mp3" },
    },
    {
      label: "v2: agents/:id/speak",
      url: `${b}/v2/agents/${agentId}/speak`,
      method: "POST",
      body: { text: "test", format: "mp3" },
    },
    {
      label: "v1: agents/:id/speak",
      url: `${b}/v1/agents/${agentId}/speak`,
      method: "POST",
      body: { text: "test", format: "mp3" },
    },
    {
      label: "v2: speak",
      url: `${b}/v2/speak`,
      method: "POST",
      body: { text: "test", format: "mp3" },
    },
    {
      label: "v1: speak",
      url: `${b}/v1/speak`,
      method: "POST",
      body: { text: "test", format: "mp3" },
    },
    { label: "v2: me", url: `${b}/v2/me`, method: "GET" },
    { label: "v1: me", url: `${b}/v1/me`, method: "GET" },
    { label: "root /", url: `${b}/`, method: "GET" },
  ];
}

const AGENT_ID = process.env.VAPI_AGENT_ID || "";
const KEY = process.env.VAPI_API_KEY || "";

export async function GET() {
  const report = [];
  for (const base of BASES) {
    const tries = [];
    for (const e of endpoints(base, AGENT_ID)) {
      try {
        const r = await fetch(e.url, {
          method: e.method,
          headers: {
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
          },
          body: e.body ? JSON.stringify(e.body) : undefined,
        });
        const ct = r.headers.get("content-type") || "";
        let body;
        if (ct.includes("application/json")) {
          try {
            body = await r.json();
          } catch {
            body = { parse: "json-failed" };
          }
        } else {
          body = (await r.text()).slice(0, 200);
        }
        tries.push({ ...e, status: r.status, contentType: ct, body });
      } catch (err) {
        tries.push({ ...e, error: err.message });
      }
    }
    report.push({ base, tries });
  }
  return NextResponse.json({
    okEnv: Boolean(AGENT_ID && KEY),
    agentIdPresent: Boolean(AGENT_ID),
    basesTried: BASES,
    report,
  });
}
