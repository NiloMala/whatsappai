import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Bind to localhost (IPv4) to avoid IPv6 <-> IPv4 connection reset issues on Windows
    host: "localhost",
  port: 8080,
    strictPort: true,
    // Ensure HMR client connects to the same dev server host/port
    hmr: {
      host: 'localhost',
      clientPort: 8080,
    },
    proxy: {
      '/api/openai-agent-proxy': {
        target: 'https://cvyagrunpypnznptkcsf.supabase.co/functions/v1/openai-agent-proxy',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai-agent-proxy/, ''),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
