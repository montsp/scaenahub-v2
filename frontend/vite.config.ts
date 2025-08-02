import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Custom plugin for SPA routing
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          // Skip API routes and static assets
          if (req.url?.startsWith('/api') || 
              req.url?.startsWith('/socket.io') ||
              req.url?.includes('.')) {
            return next();
          }
          
          // For all other routes, serve index.html
          req.url = '/';
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          icons: ['@heroicons/react', 'lucide-react'],
        },
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
  },
  // SPA routing support
  appType: 'spa',
})
