import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import tailwindcss from '@tailwindcss/vite'
import postcss from 'postcss'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
const isElectron = mode === 'electron'
const isAndroid = mode === 'android'

// Android 8.1 on the ELO uses WebView 85, which does not understand CSS
// cascade layers. Tailwind 4 emits its base/components/utilities inside
// @layer blocks, so unwrap them only in the Android bundle.
const androidCssCompatibility = {
  name: 'android-css-compatibility',
  apply: 'build' as const,
  generateBundle(_options: unknown, bundle: Record<string, any>) {
    if (!isAndroid) return

    for (const output of Object.values(bundle)) {
      if (output.type !== 'asset' || !output.fileName.endsWith('.css')) continue

      const root = postcss.parse(String(output.source))
      root.walkAtRules('layer', (rule) => {
        if (rule.nodes?.length) rule.replaceWith(...rule.nodes)
        else rule.remove()
      })
      output.source = root.toString()
    }
  },
}

return {
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    androidCssCompatibility,
    ...(isElectron ? [
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['better-sqlite3'],
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(args) {
            args.reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron',
            },
          },
        },
      ]),
      renderer(),
    ] : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: isElectron ? [] : ['sql.js'],
  },
  build: isAndroid ? {
    target: 'chrome85',
    cssTarget: 'chrome85',
  } : undefined,
  server: {
    host: true,
  },
}
})
