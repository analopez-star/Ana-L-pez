// Offline-capable French speech synthesis using browser Web Speech API

let cachedFrenchVoice: SpeechSynthesisVoice | null = null;

function findFrenchVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Prefer native fr-FR voices, then any French voice
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
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function hasFrenchVoiceInstalled(): boolean {
  return Boolean(cachedFrenchVoice || findFrenchVoice());
}

export function speakFrench(
  text: string,
  options?: { rate?: number; onStart?: () => void; onEnd?: () => void }
): void {
  if (!isSpeechSupported()) {
    options?.onEnd?.();
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
    utterance.rate = options?.rate ?? 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => options?.onStart?.();
    utterance.onend = () => options?.onEnd?.();
    utterance.onerror = () => options?.onEnd?.();

    window.speechSynthesis.speak(utterance);
  } catch {
    options?.onEnd?.();
  }
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}
