import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const audioCache = new Map<string, { audioBase64: string; mimeType: string }>();

app.use(express.json({ limit: '1mb' }));

app.post('/api/tts', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 240) {
    res.status(400).json({ error: 'Invalid text parameter' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY_NOT_CONFIGURED' });
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
    res.status(502).json({ error: message });
  }
});

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
