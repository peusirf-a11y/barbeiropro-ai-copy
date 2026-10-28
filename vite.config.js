import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {
  handleAsaasSubscription,
  handleSyncAsaasSubscription,
  handleCancelAsaasSubscription,
} from './src/server/subscribeHandler.js';
import {
  handleCreatePix,
  handleCreateCardPayment,
  handleCreateAppointment,
  handlePaymentStatus,
} from './src/server/appointmentsPixHandler.js';
import { handleTestConnection } from './src/server/asaasTestConnectionHandler.js';
import { handleMasterCreateCompany } from './src/server/masterCompanyHandler.js';

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
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          res.end();
          return;
        }

        if (url === '/api/master/create-company' && req.method === 'POST') {
          try {
            let bodyStr = '';
            req.on('data', (chunk) => { bodyStr += chunk; });
            req.on('end', async () => {
              let parsedBody = {};
              try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
              const result = await handleMasterCreateCompany(parsedBody);
              res.writeHead(result.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify(result.body));
            });
            return;
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message || 'Erro interno ao provisionar barbearia' }));
            return;
          }
        }

        if (url === '/api/asaas/cancel-subscription' && (req.method === 'POST' || req.method === 'DELETE')) {
          try {
            let bodyStr = '';
            req.on('data', (chunk) => { bodyStr += chunk; });
            req.on('end', async () => {
              let parsedBody = {};
              try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
              const authHeader = req.headers?.authorization || '';
              const result = await handleCancelAsaasSubscription(
                {
                  ...parsedBody,
                  company_id: parsedBody.company_id || parsedBody.companyId || query.company_id || query.companyId,
                  subscription_id: parsedBody.subscription_id || parsedBody.subscriptionId || query.subscription_id || query.subscriptionId,
                  email: parsedBody.email || query.email,
                },
                authHeader
              );
              res.writeHead(result.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify(result.body));
            });
            return;
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message || 'Erro interno ao cancelar assinatura' }));
            return;
          }
        }

        if (url === '/api/subscribe' || url === '/api/asaas/subscription') {
          if (req.method === 'GET') {
            try {
              const result = await handleSyncAsaasSubscription({
                company_id: query.companyId || query.company_id,
                subscription_id: query.subscriptionId || query.subscription_id,
                email: query.email,
              });
              res.writeHead(result.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify(result.body));
              return;
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Erro interno no servidor' }));
              return;
            }
          }
          if (req.method === 'POST') {
            try {
              let bodyStr = '';
              req.on('data', (chunk) => { bodyStr += chunk; });
              req.on('end', async () => {
                let parsedBody = {};
                try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
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

        if (url === '/api/appointments/create-pix' || url === '/api/appointments/create-card' || url === '/api/appointments/create') {
          if (req.method === 'POST') {
            try {
              let bodyStr = '';
              req.on('data', (chunk) => { bodyStr += chunk; });
              req.on('end', async () => {
                let parsedBody = {};
                try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
                const result = url === '/api/appointments/create-card'
                  ? await handleCreateCardPayment(parsedBody)
                  : url === '/api/appointments/create'
                  ? await handleCreateAppointment(parsedBody)
                  : await handleCreatePix(parsedBody);
                res.writeHead(result.status, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                });
                res.end(JSON.stringify(result.body));
              });
              return;
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Erro ao processar pagamento' }));
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
                const bookingData = parsedBody.booking || parsedBody || null;

                const result = await handlePaymentStatus(paymentId, appointmentId, companyId, bookingData);
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

        if (url === '/api/asaas/test-connection' && req.method === 'POST') {
          try {
            let bodyStr = '';
            req.on('data', (chunk) => { bodyStr += chunk; });
            req.on('end', async () => {
              let parsedBody = {};
              try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
              const result = await handleTestConnection(parsedBody);
              res.writeHead(result.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify(result.body));
            });
            return;
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: err.message || 'Erro interno ao testar conexão' }));
            return;
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

        if (url === '/api/master/create-company' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => { bodyStr += chunk; });
          req.on('end', async () => {
            let parsedBody = {};
            try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
            const result = await handleMasterCreateCompany(parsedBody);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
          });
          return;
        }

        if (url === '/api/asaas/cancel-subscription' && (req.method === 'POST' || req.method === 'DELETE')) {
          let bodyStr = '';
          req.on('data', (chunk) => { bodyStr += chunk; });
          req.on('end', async () => {
            let parsedBody = {};
            try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
            const authHeader = req.headers?.authorization || '';
            const result = await handleCancelAsaasSubscription(
              {
                ...parsedBody,
                company_id: parsedBody.company_id || parsedBody.companyId || query.company_id || query.companyId,
                subscription_id: parsedBody.subscription_id || parsedBody.subscriptionId || query.subscription_id || query.subscriptionId,
                email: parsedBody.email || query.email,
              },
              authHeader
            );
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
          });
          return;
        }

        if ((url === '/api/appointments/create-pix' || url === '/api/appointments/create-card' || url === '/api/appointments/create') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => { bodyStr += chunk; });
          req.on('end', async () => {
            let parsedBody = {};
            try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
            const result = url === '/api/appointments/create-card'
              ? await handleCreateCardPayment(parsedBody)
              : url === '/api/appointments/create'
              ? await handleCreateAppointment(parsedBody)
              : await handleCreatePix(parsedBody);
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
            const bookingData = parsedBody.booking || parsedBody || null;

            const result = await handlePaymentStatus(paymentId, appointmentId, companyId, bookingData);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
          });
          return;
        }

        if (url === '/api/subscribe' || url === '/api/asaas/subscription') {
          if (req.method === 'GET') {
            const result = await handleSyncAsaasSubscription({
              company_id: query.companyId || query.company_id,
              subscription_id: query.subscriptionId || query.subscription_id,
              email: query.email,
            });
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
            return;
          }
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk) => { bodyStr += chunk; });
            req.on('end', async () => {
              let parsedBody = {};
              try { parsedBody = JSON.parse(bodyStr); } catch (_) {}
              const result = await handleAsaasSubscription(parsedBody);
              res.writeHead(result.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result.body));
            });
            return;
          }
        }
        if (url === '/api/asaas/test-connection' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => { bodyStr += chunk; });
          req.on('end', async () => {
            let parsedBody = {};
            try { if (bodyStr) parsedBody = JSON.parse(bodyStr); } catch (_) {}
            const result = await handleTestConnection(parsedBody);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.body));
          });
          return;
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