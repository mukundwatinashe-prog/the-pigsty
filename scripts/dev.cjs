'use strict';

const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

/**
 * Pick the first free TCP port starting at startPort (checks up to maxAttempts ports).
 */
function findAvailablePort(startPort, maxAttempts) {
  return new Promise((resolve, reject) => {
    function tryListen(port, remaining) {
      if (remaining <= 0) {
        reject(
          new Error(
            `No free port between ${startPort} and ${startPort + maxAttempts - 1}. Stop other dev servers or free a port.`,
          ),
        );
        return;
      }
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') tryListen(port + 1, remaining - 1);
        else reject(err);
      });
      // Match Express `app.listen(port)` (dual-stack ::) so we don’t pick a port that’s only “free” on 127.0.0.1.
      server.listen(port, () => {
        server.close(() => resolve(port));
      });
    }
    tryListen(startPort, maxAttempts);
  });
}

(async () => {
  const root = path.join(__dirname, '..');
  spawnSync(process.execPath, [path.join(__dirname, 'sync-open-app.cjs')], {
    cwd: root,
    stdio: 'inherit',
  });

  const apiPort = await findAvailablePort(4000, 40);
  const env = {
    ...process.env,
    PORT: String(apiPort),
    API_PORT: String(apiPort),
  };

  console.log(
    `[dev] API → http://127.0.0.1:${apiPort} · Vite proxies /api to this port (set API_PORT=${apiPort})`,
  );

  const concurrently = path.join(root, 'node_modules', '.bin', 'concurrently');
  const args = [
    '-n',
    'api,web',
    '-c',
    'blue,green',
    'npm run dev --prefix backend',
    'npm run dev --prefix frontend',
  ];

  const child = spawn(concurrently, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
