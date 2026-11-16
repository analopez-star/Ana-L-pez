// French speech synthesis: Gemini TTS via /api/tts with Web Speech API fallback

let cachedFrenchVoice: SpeechSynthesisVoice | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentBufferSource: AudioBufferSourceNode | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let speakSafetyTimer: number | null = null;
let audioCtx: AudioContext | null = null;
let playToken = 0;
let ttsEndpointUnavailable = false;
let ttsProbeStarted = false;

const ttsBufferCache = new Map<string, AudioBuffer>();
const ttsBlobCache = new Map<string, string>();

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Win = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || Win.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', ensureAudioContext, { passive: true });
  document.addEventListener('keydown', ensureAudioContext, { passive: true });
}

function findFrenchVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const normLang = (l: string) => l.replace('_', '-').toLowerCase();
  const preferredNames = [
    'thomas',
    'amélie',
    'amelie',
    'hortense',
    'denise',
    'henri',
    'audrey',
    'aurélie',
    'aurelie',
    'julie',
    'paul',
  ];
  const frVoices = voices.filter((v) => normLang(v.lang).startsWith('fr'));

  cachedFrenchVoice =
    frVoices.find(
      (v) => v.localService && preferredNames.some((n) => v.name.toLowerCase().includes(n))
    ) ||
    frVoices.find((v) => normLang(v.lang) === 'fr-fr' && v.localService) ||
    frVoices.find((v) => v.localService) ||
    frVoices.find((v) => normLang(v.lang) === 'fr-fr') ||
    frVoices[0] ||
    null;
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
  if (speakSafetyTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(speakSafetyTimer);
    speakSafetyTimer = null;
  }
  if (currentBufferSource) {
    try {
      currentBufferSource.stop();
    } catch {
      // ignore
    }
    try {
      currentBufferSource.disconnect();
    } catch {
      // ignore
    }
    currentBufferSource = null;
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  activeUtterance = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
  }
}

function speakWithBrowser(
  text: string,
  rate: number,
  token: number,
  options?: { onStart?: () => void; onEnd?: () => void },
  skipVoice = false
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
    const synth = window.speechSynthesis;
    try {
      synth.resume();
    } catch {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(text);
    activeUtterance = utterance;
    if (!skipVoice) {
      const voice = cachedFrenchVoice || findFrenchVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'fr-FR';
      }
    } else {
      utterance.lang = 'fr-FR';
    }
    const effectiveRate =
      rate < 0.8
        ? Math.max(0.35, Math.min(0.5, rate - 0.05))
        : Math.max(0.5, Math.min(2.0, rate));
    utterance.rate = effectiveRate;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (token === playToken) options?.onStart?.();
    };
    utterance.onend = () => {
      if (token !== playToken) return;
      if (activeUtterance === utterance) activeUtterance = null;
      if (speakSafetyTimer !== null) {
        window.clearTimeout(speakSafetyTimer);
        speakSafetyTimer = null;
      }
      options?.onEnd?.();
    };
    utterance.onerror = (ev) => {
      if (token !== playToken) return;
      const errCode = ev?.error || '';
      if (errCode === 'interrupted' || errCode === 'canceled') {
        options?.onEnd?.();
        return;
      }
      if (!skipVoice && utterance.voice && errCode !== 'not-allowed') {
        speakWithBrowser(text, rate, token, options, true);
        return;
      }
      if (activeUtterance === utterance) activeUtterance = null;
      if (speakSafetyTimer !== null) {
        window.clearTimeout(speakSafetyTimer);
        speakSafetyTimer = null;
      }
      options?.onEnd?.();
    };

    options?.onStart?.();
    if (speakSafetyTimer !== null) window.clearTimeout(speakSafetyTimer);
    const safetyMs = Math.max(7000, Math.round(7000 / Math.max(0.35, effectiveRate)));
    speakSafetyTimer = window.setTimeout(() => {
      if (token === playToken) options?.onEnd?.();
    }, safetyMs);

    synth.speak(utterance);
  } catch {
    if (token === playToken) options?.onEnd?.();
  }
}

function base64ToArrayBuffer(audioBase64: string): ArrayBuffer {
  const binary = atob(audioBase64);
  const arrayBuffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return arrayBuffer;
}

async function playAudioBuffer(
  buffer: AudioBuffer,
  rate: number,
  token: number,
  options?: { onStart?: () => void; onEnd?: () => void }
): Promise<boolean> {
  if (token !== playToken) return false;
  const ctx = ensureAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.connect(ctx.destination);
    currentBufferSource = src;
    src.onended = () => {
      if (currentBufferSource === src) currentBufferSource = null;
      if (token === playToken) options?.onEnd?.();
    };
    options?.onStart?.();
    src.start(0);
    return true;
  } catch {
    if (currentBufferSource) currentBufferSource = null;
    return false;
  }
}

async function playBlobUrl(
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
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    const pitchedAudio = audio as HTMLAudioElement & {
      preservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
      mozPreservesPitch?: boolean;
    };
    if ('preservesPitch' in pitchedAudio) pitchedAudio.preservesPitch = true;
    if ('webkitPreservesPitch' in pitchedAudio) pitchedAudio.webkitPreservesPitch = true;
    if ('mozPreservesPitch' in pitchedAudio) pitchedAudio.mozPreservesPitch = true;
    audio.onloadedmetadata = () => {
      try {
        audio.playbackRate = rate;
      } catch {
        // ignore
      }
    };
    audio.onplay = () => {
      try {
        audio.playbackRate = rate;
      } catch {
        // ignore
      }
    };
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
    try {
      audio.playbackRate = rate;
    } catch {
      // ignore
    }
  } catch {
    if (currentAudio) currentAudio = null;
    speakWithBrowser(fallbackText, rate, token, options);
  }
}

async function fetchGeminiAudio(
  clean: string
): Promise<{ decoded: AudioBuffer | null; blobUrl: string } | null> {
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

    if (!res.ok) {
      if (res.status === 403 || res.status === 404 || res.status === 503) {
        ttsEndpointUnavailable = true;
      }
      return null;
    }

    const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
    if (!data?.audioBase64) return null;

    const arrayBuffer = base64ToArrayBuffer(data.audioBase64);
    const blobUrl = URL.createObjectURL(
      new Blob([arrayBuffer], { type: data.mimeType || 'audio/wav' })
    );

    let decoded: AudioBuffer | null = null;
    const ctx = ensureAudioContext();
    if (ctx) {
      try {
        decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      } catch {
        decoded = null;
      }
    }

    if (ttsBlobCache.size >= 150) {
      const oldestKey = ttsBlobCache.keys().next().value;
      if (oldestKey) {
        const oldUrl = ttsBlobCache.get(oldestKey);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        ttsBlobCache.delete(oldestKey);
        ttsBufferCache.delete(oldestKey);
      }
    }
    if (decoded) ttsBufferCache.set(clean, decoded);
    ttsBlobCache.set(clean, blobUrl);

    return { decoded, blobUrl };
  } catch {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    return null;
  }
}

if (typeof window !== 'undefined' && !ttsProbeStarted) {
  ttsProbeStarted = true;
  if (navigator.onLine === false || window.location.protocol === 'file:') {
    ttsEndpointUnavailable = true;
  } else {
    fetchGeminiAudio('bonjour')
      .then((res) => {
        if (!res) ttsEndpointUnavailable = true;
      })
      .catch(() => {
        ttsEndpointUnavailable = true;
      });
  }
}

export async function speakFrench(
  text: string,
  options?: { rate?: number; onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  const clean = text.trim();
  const rate = options?.rate ?? 1.0;
  if (!clean) {
    options?.onEnd?.();
    return;
  }

  ensureAudioContext();
  stopSpeaking();
  const token = playToken;

  const cachedBuf = ttsBufferCache.get(clean);
  if (rate >= 0.85 && cachedBuf && (await playAudioBuffer(cachedBuf, rate, token, options))) {
    return;
  }

  const cachedUrl = ttsBlobCache.get(clean);
  if (cachedUrl) {
    await playBlobUrl(cachedUrl, rate, token, clean, options);
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
  const audioData = await fetchGeminiAudio(clean);
  if (token !== playToken) return;

  if (!audioData) {
    speakWithBrowser(clean, rate, token, options);
    return;
  }

  if (
    rate >= 0.85 &&
    audioData.decoded &&
    (await playAudioBuffer(audioData.decoded, rate, token, options))
  ) {
    return;
  }
  await playBlobUrl(audioData.blobUrl, rate, token, clean, options);
}
