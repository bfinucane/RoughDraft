import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateWireframeWithProvider,
  getAvailableProviders,
} from './server/aiWireframe.ts';
import type { AiGenerationMode, AiProviderId } from './server/aiWireframe.ts';
import type { DevicePreset } from './src/types/wireframe.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // Discover server-configured AI providers without exposing API keys
  app.get('/api/ai/providers', (_req, res) => {
    res.json({ providers: getAvailableProviders() });
  });

  // Text-to-Wireframe and Screenshot-to-Wireframe generation proxy
  app.post('/api/ai/wireframe', async (req, res) => {
    try {
      const body = req.body as {
        mode?: AiGenerationMode;
        provider?: AiProviderId;
        model?: string;
        prompt?: string;
        imageBase64?: string;
        imageMimeType?: string;
        device?: DevicePreset;
        artboardWidth?: number;
        artboardHeight?: number;
      };

      const mode: AiGenerationMode = body.mode === 'screenshot' ? 'screenshot' : 'text';
      const provider: AiProviderId = body.provider || 'gemini';
      const device: DevicePreset =
        body.device === 'mobile' || body.device === 'tablet' ? body.device : 'desktop';

      const defaultDims =
        device === 'mobile'
          ? { w: 390, h: 820 }
          : device === 'tablet'
          ? { w: 768, h: 960 }
          : { w: 1024, h: 700 };

      const artboardWidth =
        typeof body.artboardWidth === 'number' && body.artboardWidth >= 240
          ? Math.min(2400, Math.round(body.artboardWidth))
          : defaultDims.w;
      const artboardHeight =
        typeof body.artboardHeight === 'number' && body.artboardHeight >= 240
          ? Math.min(2400, Math.round(body.artboardHeight))
          : defaultDims.h;

      if (mode === 'text' && (!body.prompt || !body.prompt.trim())) {
        res.status(400).json({ error: 'Please enter a wireframe description prompt.' });
        return;
      }

      if (mode === 'screenshot' && (!body.imageBase64 || !body.imageBase64.trim())) {
        res.status(400).json({ error: 'Please upload or paste a screenshot image.' });
        return;
      }

      const result = await generateWireframeWithProvider({
        mode,
        provider,
        model: body.model,
        prompt: body.prompt,
        imageBase64: body.imageBase64,
        imageMimeType: body.imageMimeType,
        device,
        artboardWidth,
        artboardHeight,
      });

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate wireframe.';
      const status =
        message.includes('not configured') || message.includes('Please ')
          ? 400
          : message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')
          ? 403
          : message.includes('RESOURCE_EXHAUSTED') || message.includes('429')
          ? 429
          : 502;
      res.status(status).json({ error: message });
    }
  });

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RoughDraft server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RoughDraft server:', err);
  process.exit(1);
});
