import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const CAMPAIGN_CAPTURE_ROUTE = '/__defl/campaign-capture';
const CAMPAIGN_CAPTURE_DIR = resolve(process.cwd(), '.tmp/campaign-debug');
const MAX_CAPTURE_BODY = 8 * 1024 * 1024;

function safePart(value: unknown, fallback: string): string {
  const text = String(value ?? '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return text || fallback;
}

/**
 * Local-only campaign QA sink. The browser recorder posts here while Vite is
 * serving; nothing in the production bundle knows about this endpoint.
 */
function campaignCapturePlugin(): Plugin {
  return {
    name: 'deflect-campaign-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(CAMPAIGN_CAPTURE_ROUTE, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.end('POST only');
          return;
        }

        let body = '';
        let closed = false;
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
          if (closed) return;
          body += chunk;
          if (body.length > MAX_CAPTURE_BODY) {
            closed = true;
            res.statusCode = 413;
            res.end('capture too large');
            req.destroy();
          }
        });
        req.on('end', () => {
          if (closed) return;
          void (async () => {
            try {
              const payload = JSON.parse(body) as {
                kind?: string;
                sessionId?: string;
                report?: unknown;
                snapshot?: { t?: number; reason?: string; dataUrl?: string };
              };
              const sessionId = safePart(payload.sessionId, 'session');
              await mkdir(join(CAMPAIGN_CAPTURE_DIR, 'screenshots', sessionId), { recursive: true });

              if (payload.kind === 'screenshot' && payload.snapshot) {
                const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
                  String(payload.snapshot.dataUrl ?? ''),
                );
                if (!match) throw new Error('invalid screenshot');
                const image = Buffer.from(match[2], 'base64');
                if (image.length > 4 * 1024 * 1024) throw new Error('screenshot too large');
                const ext = match[1] === 'png' ? 'png' : 'jpg';
                const t = Number.isFinite(Number(payload.snapshot.t)) ? Number(payload.snapshot.t) : 0;
                const reason = safePart(payload.snapshot.reason, 'snapshot');
                const name = `${String(Math.round(t * 10)).padStart(7, '0')}-${reason}-${Date.now().toString(36)}.${ext}`;
                await writeFile(join(CAMPAIGN_CAPTURE_DIR, 'screenshots', sessionId, name), image);
                await writeFile(join(CAMPAIGN_CAPTURE_DIR, `latest.${ext}`), image);
              } else if (payload.kind === 'report' && payload.report) {
                const text = JSON.stringify(payload.report, null, 2);
                await writeFile(join(CAMPAIGN_CAPTURE_DIR, `report-${sessionId}.json`), text);
                await writeFile(join(CAMPAIGN_CAPTURE_DIR, 'latest.json'), text);
              }

              res.statusCode = 204;
              res.end();
            } catch (error) {
              res.statusCode = 400;
              res.end(error instanceof Error ? error.message : 'invalid capture');
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [campaignCapturePlugin()],
  base: './',
  server: {
    port: 5173,
    // Captures and test artifacts live in the repo. Watching them made a kiosk
    // `?demo=true` session reload every time a screenshot was written.
    watch: { ignored: ['**/screenshots/**', '**/.tmp/campaign-debug/**'] },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
