import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: true, port: 5173, allowedHosts: ['.trycloudflare.com'] },
  preview: { host: true, port: 4173, allowedHosts: ['.trycloudflare.com'] },
});
