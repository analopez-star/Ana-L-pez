import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI } from '@google/genai';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => VercelResponse;
}

const audioCache = new Map<string, { audioBase64: string; mimeType: string }>();
let permanentlyUnavailableError: string | null = null;

async function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = await readJsonBody(req);
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!text || text.length > 240) {
    res.status(400).json({ error: 'Invalid text parameter' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY_NOT_CONFIGURED' });
    return;
  }

  if (permanentlyUnavailableError) {
    res.status(403).json({ error: permanentlyUnavailableError });
    return;
  }

  const cached = audioCache.get(text);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: 'Native French (fr-FR) language teacher pronouncing a French verb phrase clearly and naturally',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const inlinePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => Boolean(part.inlineData?.data)
    );
    const audioBase64 = inlinePart?.inlineData?.data;
    const mimeType = inlinePart?.inlineData?.mimeType || 'audio/wav';

    if (!audioBase64) {
      res.status(502).json({ error: 'EMPTY_TTS_AUDIO' });
      return;
    }

    const payload = { audioBase64, mimeType };
    if (audioCache.size >= 200) {
      const oldestKey = audioCache.keys().next().value;
      if (oldestKey) audioCache.delete(oldestKey);
    }
    audioCache.set(text, payload);

    res.status(200).json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS_GENERATION_FAILED';
    const isAuthOrBilling =
      message.includes('PERMISSION_DENIED') ||
      message.includes('API_KEY_INVALID') ||
      message.includes('"code":403') ||
      message.includes('"code":400');
    if (isAuthOrBilling) {
      permanentlyUnavailableError = message;
      res.status(403).json({ error: message });
      return;
    }
    res.status(502).json({ error: message });
  }
}
