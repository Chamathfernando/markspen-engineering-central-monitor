import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes/api.ts';
import { ensureWorkbook } from './server/excel/workbook.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use('/api', apiRouter);

  // Ensure workbook and initial data exist
  try {
    await ensureWorkbook();
    console.log('[Server] Authoritative Excel workbook verified and ready.');
  } catch (err) {
    console.error('[Server] Failed to verify workbook on boot:', err);
  }

  // Mount Vite or static frontend
  if (process.env.NODE_ENV === 'production' && !process.env.DEV_MODE) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Markspen Monitor] Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
