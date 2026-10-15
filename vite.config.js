import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const targetUrl = (env.VITE_SUPABASE_URL || 'https://ijitvgzcbvguacsveccy.supabase.co').trim();

  return {
    appType: 'spa',
    logLevel: 'error',
    plugins: [react()],
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