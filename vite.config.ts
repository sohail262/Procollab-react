import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { VitePWA } from "vite-plugin-pwa"
import { createRequire } from "module"

// vite-plugin-compression is a prod build-only dependency.
// Load it safely so `npm run dev` still works before the package is installed.
const _require = createRequire(import.meta.url)
let compression: (...args: any[]) => any
try {
  compression = _require('vite-plugin-compression').default ?? _require('vite-plugin-compression')
} catch {
  // Package not installed yet — use a no-op plugin stub
  compression = () => ({ name: 'compression-noop' })
}

export default defineConfig({
  plugins: [
    react(),
    // Brotli compression — best compression ratio (~70% smaller than gzip)
    // Run `npm install --save-dev vite-plugin-compression` to activate
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024, // Only compress files > 1KB
    }),
    // Gzip as fallback for older CDNs/proxies that don't support Brotli
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        importScripts: ["/firebase-messaging-sw.js"],
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit for single chunks
      },
      manifest: {
        name: "ProCollab",
        short_name: "ProCollab",
        description: "Student Project Collaboration & Showcase Platform",
        theme_color: "#000000",
        background_color: "#09090b",
        display: "standalone",
        start_url: "/",
        orientation: "any",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/maskable-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Fix duplicate module warnings — ensures single instance of React in bundle
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    // Target modern browsers — significantly reduces polyfill payload
    target: 'es2020',
    // Use lightningcss for faster, smaller CSS output (replaces esbuild CSS)
    cssMinify: 'lightningcss',
    // Skip compressed size reporting for faster CI builds
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core — always cached together
          if (id.includes('react-dom') || id.includes('react-router-dom')) return 'react-vendor'
          if (id.includes('/react/')) return 'react-vendor'

          // Firebase — split by sub-module so unused features aren't loaded
          if (id.includes('firebase/auth') || id.includes('@firebase/auth')) return 'firebase-auth'
          if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) return 'firebase-firestore'
          if (id.includes('firebase/storage') || id.includes('@firebase/storage')) return 'firebase-storage'
          if (id.includes('firebase/messaging') || id.includes('@firebase/messaging')) return 'firebase-messaging'
          if (id.includes('firebase/functions') || id.includes('@firebase/functions')) return 'firebase-functions'
          if (id.includes('firebase/database') || id.includes('@firebase/database')) return 'firebase-rtdb'
          if (id.includes('firebase/app') || id.includes('@firebase/app')) return 'firebase-core'

          // Heavy UI / animation libs — separate so they're cached independently
          if (id.includes('framer-motion')) return 'framer-motion'
          if (id.includes('three') || id.includes('Three')) return 'three-vendor'
          if (id.includes('gsap')) return 'gsap-vendor'
          if (id.includes('recharts')) return 'chart-vendor'
          if (id.includes('lucide-react')) return 'lucide-react'

          // Radix UI components
          if (id.includes('@radix-ui')) return 'radix-ui'

          // Google OAuth
          if (id.includes('@react-oauth')) return 'oauth-vendor'

          // Utility libs
          if (id.includes('clsx') || id.includes('class-variance-authority') || id.includes('tailwind-merge')) return 'utils'
        },
      }
    },
    // Warn at 500KB — slightly below default to keep chunks honest
    chunkSizeWarningLimit: 500,
    // Terser with aggressive dead-code elimination
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        // Remove pure function calls that have no side effects
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2,        // Two compression passes for better results
        ecma: 2020,
      },
      mangle: {
        safari10: false,  // Don't need Safari 10 workarounds
      },
      format: {
        comments: false,  // Strip all comments from production bundle
      }
    }
  },
  // Dev server: fixed port avoids "Failed to fetch dynamically imported module" when 5173
  // is already taken — Vite would otherwise bind to 5174+ while the browser still uses 5173.
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false
    }
  }
})
