// French speech synthesis: Gemini TTS via /api/tts with Web Speech API fallback

let cachedFrenchVoice: SpeechSynthesisVoice | null = null;
let currentAudio: HTMLAudioElement | null = null;
let playToken = 0;
let ttsEndpointUnavailable = false;
const ttsAudioCache = new Map<string, string>();

function findFrenchVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const exactFr = voices.find((v) => v.lang.toLowerCase() === 'fr-fr' && v.localService);
  const anyFrFr = voices.find((v) => v.lang.toLowerCase() === 'fr-fr');
  const anyFr = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));

  cachedFrenchVoice = exactFr || anyFrFr || anyFr || null;
  return cachedFrenchVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  findFrenchVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    findFrenchVoice();
  });
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && ('Audio' in window || 'speechSynthesis' in window);
}

export function hasFrenchVoiceInstalled(): boolean {
  return Boolean(cachedFrenchVoice || findFrenchVoice());
}

export function stopSpeaking(): void {
  playToken += 1;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function speakWithBrowser(
  text: string,
  rate: number,
  token: number,
  options?: { onStart?: () => void; onEnd?: () => void }
): void {
  if (
    token !== playToken ||
    typeof window === 'undefined' ||
    !('speechSynthesis' in window)
  ) {
    if (token === playToken) options?.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = cachedFrenchVoice || findFrenchVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'fr-FR';
    }
    utterance.rate = rate;
    utterance.pitch = 1;

    utterance.onstart = () => {
      if (token === playToken) options?.onStart?.();
    };
    utterance.onend = () => {
      if (token === playToken) options?.onEnd?.();
    };
    utterance.onerror = () => {
      if (token === playToken) options?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    if (token === playToken) options?.onEnd?.();
  }
}

function base64ToBlobUrl(audioBase64: string, mimeType: string): string {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType || 'audio/wav' }));
}

async function playAudioUrl(
  url: string,
  rate: number,
  token: number,
  fallbackText: string,
  options?: { onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  if (token !== playToken) return;
  try {
    const audio = new Audio(url);
    currentAudio = audio;
    audio.playbackRate = rate;
    if ('preservesPitch' in audio) {
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    }
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      if (token === playToken) options?.onEnd?.();
    };
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      speakWithBrowser(fallbackText, rate, token, options);
    };
    options?.onStart?.();
    await audio.play();
  } catch {
    if (currentAudio) currentAudio = null;
    speakWithBrowser(fallbackText, rate, token, options);
  }
}

export async function speakFrench(
  text: string,
  options?: { rate?: number; onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  const clean = text.trim();
  const rate = options?.rate ?? 0.95;
  if (!clean) {
    options?.onEnd?.();
    return;
  }

  stopSpeaking();
  const token = playToken;

  const cachedUrl = ttsAudioCache.get(clean);
  if (cachedUrl) {
    await playAudioUrl(cachedUrl, rate, token, clean, options);
    return;
  }

  const canTryRemote =
    typeof window !== 'undefined' &&
    navigator.onLine !== false &&
    window.location.protocol !== 'file:' &&
    !ttsEndpointUnavailable;

  if (!canTryRemote) {
    speakWithBrowser(clean, rate, token, options);
    return;
  }

  options?.onStart?.();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 8000) : null;

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean }),
      signal: controller?.signal,
    });
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    if (token !== playToken) return;

    if (!res.ok) {
      if (res.status === 404 || res.status === 503) {
        ttsEndpointUnavailable = true;
      }
      speakWithBrowser(clean, rate, token, options);
      return;
    }

    const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
    if (token !== playToken) return;

    if (!data?.audioBase64) {
      speakWithBrowser(clean, rate, token, options);
      return;
    }

    const url = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');
    if (ttsAudioCache.size >= 150) {
      const oldestKey = ttsAudioCache.keys().next().value;
      if (oldestKey) {
        const oldUrl = ttsAudioCache.get(oldestKey);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        ttsAudioCache.delete(oldestKey);
      }
    }
    ttsAudioCache.set(clean, url);
    await playAudioUrl(url, rate, token, clean, options);
  } catch {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    speakWithBrowser(clean, rate, token, options);
  }
}
