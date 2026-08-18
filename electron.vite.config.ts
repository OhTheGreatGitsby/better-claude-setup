import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = resolve('src/shared')

// Injected at build time so the version shown in the interface is this project's, not
// Electron's, which is what app.getVersion() reports when running unpackaged.
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const define = { __APP_VERSION__: JSON.stringify(pkg.version) }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define,
    resolve: { alias: { '@shared': shared } },
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react()],
    resolve: { alias: { '@shared': shared } },
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } }
  }
})
