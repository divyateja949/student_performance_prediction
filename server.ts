import { spawn, spawnSync, type ChildProcess } from 'child_process';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createNodeApiRouter } from './backend/nodeEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const FLASK_PORT = Number(process.env.FLASK_PORT || 5001);
const FLASK_HOST = '127.0.0.1';

let flaskProcess: ChildProcess | null = null;
let useFlaskProxy = false;

function hasPythonMLStack(): boolean {
  try {
    const check = spawnSync(
      'python3',
      ['-c', 'import flask, flask_cors, sklearn, pandas, numpy, joblib'],
      { cwd: __dirname, timeout: 5000, stdio: 'ignore' }
    );
    return check.status === 0;
  } catch {
    return false;
  }
}

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

async function tryStartFlask(): Promise<boolean> {
  if (await checkFlaskHealth()) {
    console.log(`[Bridge] Python Flask API already running on port ${FLASK_PORT}`);
    return true;
  }

  if (!hasPythonMLStack()) {
    console.log('[Bridge] Python Flask/Scikit-learn packages not detected; activating built-in Node SQLite + ML Engine.');
    return false;
  }

  console.log(`[Bridge] Starting Python Flask ML backend on port ${FLASK_PORT}...`);
  flaskProcess = spawn('python3', [path.join(__dirname, 'backend', 'app.py')], {
    cwd: __dirname,
    env: { ...process.env, FLASK_PORT: String(FLASK_PORT) },
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

  for (let i = 0; i < 20; i++) {
    if (await checkFlaskHealth()) {
      console.log('[Bridge] Python Flask ML backend is ready.');
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.warn('[Bridge] Flask startup timed out; activating built-in Node SQLite + ML Engine.');
  return false;
}

async function startServer() {
  useFlaskProxy = await tryStartFlask();

  const app = express();

  if (useFlaskProxy) {
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
  } else {
    app.use('/api', createNodeApiRouter(__dirname));
  }

  const distDir = path.join(__dirname, 'dist');
  const isDev = process.env.NODE_ENV === 'development' || !fs.existsSync(distDir);

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Server] Application running at http://0.0.0.0:${PORT} (${isDev ? 'dev' : 'production'} · ${useFlaskProxy ? 'Python Flask' : 'Node SQLite+ML'})`
    );
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
