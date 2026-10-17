import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function asaasApiDevPlugin() {
  return {
    name: 'asaas-api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [rawUrl, queryString = ''] = (req.url || '').split('?');
        const url = rawUrl;
        const query = Object.fromEntries(new URLSearchParams(queryString));

        if (req.method === 'OPTIONS' && url.startsWith('/api/')) {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, access_token',
          });
          res.end();
          return;
        }

        if (url === '/api/subscribe' || url === '/api/asaas/subscription') {
          if (req.method === 'POST') {
            try {
              let bodyStr = '';
              req.on('data', (chunk) => { bodyStr += chunk; });
              req.on('end', async () => {
                let parsedBody = {};
                try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
                const { handleAsaasSubscription } = await import('./src/server/subscribeHandler.js');
                const result = await handleAsaasSubscription(parsedBody);
                res.writeHead(result.status, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                });
                res.end(JSON.stringify(result.body));
              });
              return;
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Erro interno no servidor' }));
              return;
            }
          }
        }

        if (url === '/api/appointments/create-pix') {
          if (req.method === 'POST') {
            try {
              let bodyStr = '';
              req.on('data', (chunk) => { bodyStr += chunk; });
              req.on('end', async () => {
                let parsedBody = {};
                try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
                const { handleCreatePix } = await import('./src/server/appointmentsPixHandler.js');
                const result = await handleCreatePix(parsedBody);
                res.writeHead(result.status, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                });
                res.end(JSON.stringify(result.body));
              });
              return;
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Erro ao criar Pix' }));
              return;
            }
          }
        }

        if (url === '/api/payments/status') {
          if (req.method === 'GET' || req.method === 'POST') {
            try {
              let bodyStr = '';
              req.on('data', (chunk) => { bodyStr += chunk; });
              req.on('end', async () => {
                let parsedBody = {};
                try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
                const paymentId = query.paymentId || query.payment_id || parsedBody.paymentId || parsedBody.payment_id;
                const appointmentId = query.appointmentId || query.appointment_id || parsedBody.appointmentId || parsedBody.appointment_id;
                const companyId = query.companyId || query.company_id || parsedBody.companyId || parsedBody.company_id;

                const { handlePaymentStatus } = await import('./src/server/appointmentsPixHandler.js');
                const result = await handlePaymentStatus(paymentId, appointmentId, companyId);
                res.writeHead(result.status, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                });
                res.end(JSON.stringify(result.body));
              });
              return;
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Erro ao consultar status' }));
              return;
            }
          }
        }

        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [rawUrl, queryString = ''] = (req.url || '').split('?');
        const url = rawUrl;
        const query = Object.fromEntries(new URLSearchParams(queryString));

        if (url === '/api/appointments/create-pix' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => { bodyStr += chunk; });
          req.on('end', async () => {
            let parsedBody = {};
            try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
            const { handleCreatePix } = await import('./src/server/appointmentsPixHandler.js');
            const result = await handleCreatePix(parsedBody);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
          });
          return;
        }

        if (url === '/api/payments/status') {
          let bodyStr = '';
          req.on('data', (chunk) => { bodyStr += chunk; });
          req.on('end', async () => {
            let parsedBody = {};
            try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
            const paymentId = query.paymentId || parsedBody.paymentId;
            const appointmentId = query.appointmentId || parsedBody.appointmentId;
            const companyId = query.companyId || parsedBody.companyId;

            const { handlePaymentStatus } = await import('./src/server/appointmentsPixHandler.js');
            const result = await handlePaymentStatus(paymentId, appointmentId, companyId);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
          });
          return;
        }

        if (url === '/api/subscribe' || url === '/api/asaas/subscription') {
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk) => { bodyStr += chunk; });
            req.on('end', async () => {
              let parsedBody = {};
              try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
              const { handleAsaasSubscription } = await import('./src/server/subscribeHandler.js');
              const result = await handleAsaasSubscription(parsedBody);
              res.writeHead(result.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result.body));
            });
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);
  const targetUrl = (env.VITE_SUPABASE_URL || 'https://ijitvgzcbvguacsveccy.supabase.co').trim();

  return {
    appType: 'spa',
    logLevel: 'error',
    plugins: [react(), asaasApiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
      historyApiFallback: true,
      proxy: {
        '/supabase-proxy': {
          target: targetUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/supabase-proxy/, ''),
          secure: true,
          ws: true,
        },
      },
    },
    preview: {
      port: 3000,
      host: true,
      historyApiFallback: true,
    },
  };
});