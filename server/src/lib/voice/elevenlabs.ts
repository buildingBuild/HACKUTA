// ElevenLabs: TTS for scout briefings + signed URLs for the conversational coach.
// The API key never leaves the server.
const BASE = 'https://api.elevenlabs.io/v1';

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY is not set');
  return k;
}

/** Text -> mp3 bytes. */
export async function tts(text: string, voiceId = process.env.ELEVENLABS_VOICE_ID): Promise<Buffer> {
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID is not set');
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3 },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Signed WebSocket URL for a private conversational agent (valid ~15 min). */
export async function getSignedUrl(agentId = process.env.ELEVENLABS_AGENT_ID): Promise<string> {
  if (!agentId) throw new Error('ELEVENLABS_AGENT_ID is not set');
  const res = await fetch(`${BASE}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
    headers: { 'xi-api-key': key() },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs signed URL -> ${res.status}`);
  const { signed_url } = (await res.json()) as { signed_url: string };
  return signed_url;
}

/** Text the voice briefing reads out. */
export function briefingScript(p: { display_name?: string | null; handle: string; summary: string }): string {
  return `Here's your new prospect: ${p.display_name || p.handle}. ${p.summary}`;
}
