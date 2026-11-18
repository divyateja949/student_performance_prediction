import { spawn, ChildProcess } from 'child_process';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const FLASK_PORT = Number(process.env.FLASK_PORT || 5001);
const FLASK_HOST = '127.0.0.1';

let flaskProcess: ChildProcess | null = null;

function checkFlaskHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: FLASK_HOST,
        port: FLASK_PORT,
        path: '/api/health',
        method: 'GET',
        timeout: 1000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function ensureFlaskRunning() {
  const alreadyRunning = await checkFlaskHealth();
  if (alreadyRunning) {
    console.log(`[Bridge] Python Flask API already running on port ${FLASK_PORT}`);
    return;
  }

  console.log(`[Bridge] Starting Python Flask ML backend on port ${FLASK_PORT}...`);
  const pylibsPath = path.join(__dirname, '.pylibs');
  const pythonPath = process.env.PYTHONPATH
    ? `${pylibsPath}${path.delimiter}${process.env.PYTHONPATH}`
    : pylibsPath;

  flaskProcess = spawn('python3', [path.join(__dirname, 'backend', 'app.py')], {
    cwd: __dirname,
    env: {
      ...process.env,
      FLASK_PORT: String(FLASK_PORT),
      PYTHONPATH: pythonPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  flaskProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[Flask] ${chunk}`);
  });
  flaskProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[Flask] ${chunk}`);
  });
  flaskProcess.on('exit', (code) => {
    console.log(`[Flask] Process exited with code ${code}`);
    flaskProcess = null;
  });

  // Wait up to 15 seconds for Flask to boot
  for (let i = 0; i < 30; i++) {
    if (await checkFlaskHealth()) {
      console.log('[Bridge] Python Flask ML backend is ready.');
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn('[Bridge] Flask did not respond to health check within 15s; continuing startup.');
}

async function startServer() {
  await ensureFlaskRunning();

  const app = express();

  // Proxy /api/* requests directly to the Python Flask backend
  app.use('/api', (req, res) => {
    const targetPath = `/api${req.url === '/' ? '' : req.url}`;
    const proxyReq = http.request(
      {
        hostname: FLASK_HOST,
        port: FLASK_PORT,
        path: targetPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${FLASK_HOST}:${FLASK_PORT}`,
        },
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 500);
        Object.entries(proxyRes.headers).forEach(([key, val]) => {
          if (val !== undefined) {
            res.setHeader(key, val);
          }
        });
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      console.error('[Bridge] Proxy error to Flask:', err.message);
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Machine learning backend service is unavailable. Please retry in a moment.',
        });
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Application running at http://0.0.0.0:${PORT}`);
  });

  const cleanup = () => {
    if (flaskProcess) {
      flaskProcess.kill('SIGTERM');
    }
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
