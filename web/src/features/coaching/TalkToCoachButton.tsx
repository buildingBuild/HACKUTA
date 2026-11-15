// "Talk to your coach": ElevenLabs conversational agent primed with this clip's
// coaching report via dynamic variables. Falls back to pre-recorded audio, then
// to browser speech, so the demo never dead-ends.
import { useConversation } from '@elevenlabs/react';
import { useRef, useState } from 'react';
import { startVoiceSession } from './api';

interface Props {
  clipId: string;
  /** Spoken by the browser if both the agent and the recorded fallback fail. */
  fallbackText?: string;
}

export function TalkToCoachButton({ clipId, fallbackText }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fallbackPlaying, setFallbackPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversation = useConversation({
    onError: (e: unknown) => setError(typeof e === 'string' ? e : 'Voice coach error'),
  });
  const live = conversation.status === 'connected' || conversation.status === 'connecting';

  async function playFallback(url: string | null) {
    setFallbackPlaying(true);
    if (url) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setFallbackPlaying(false);
      try {
        await audio.play();
        return;
      } catch {
        /* fall through to speech */
      }
    }
    if (fallbackText && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(fallbackText);
      u.onend = () => setFallbackPlaying(false);
      speechSynthesis.speak(u);
    } else {
      setFallbackPlaying(false);
    }
  }

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const session = await startVoiceSession(clipId);
      if (!session.signedUrl) {
        setError('Live coach unavailable, playing recorded feedback');
        await playFallback(session.fallbackAudioUrl);
        return;
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ signedUrl: session.signedUrl, dynamicVariables: session.dynamicVariables });
    } catch (e) {
      setError((e as Error).message || 'Could not start voice coach');
      await playFallback(null);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (live) await conversation.endSession();
    audioRef.current?.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setFallbackPlaying(false);
  }

  const active = live || fallbackPlaying;
  return (
    <div className="yao-coach">
      <button className={`yao-btn ${active ? 'yao-btn--live' : 'yao-btn--primary'}`} onClick={active ? stop : start} disabled={busy}>
        {busy ? 'Connecting…' : active ? '■ End coaching call' : '🎙 Talk to your coach'}
      </button>
      {live && (
        <span className="yao-coach__status">
          <span className={`yao-dot ${conversation.isSpeaking ? 'yao-dot--pulse' : ''}`} />
          {conversation.isSpeaking ? 'Coach is speaking' : 'Listening… ask about your mistakes or drills'}
        </span>
      )}
      {error && <span className="yao-coach__error">{error}</span>}
    </div>
  );
}
