import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vela ships hard-coded English month/weekday arrays for the time axis and the
 * crosshair time label. Expose them as one shared, mutable global table so the
 * app's i18n layer can localize the words (axis stays Gregorian).
 * Build transform rather than a node_modules edit, so `npm install` can never
 * silently revert it.
 */
function velaAxisLocale() {
  return {
    name: 'vela-axis-locale',
    enforce: 'pre',
    transform(code, id) {
      if (!/@luxalgo[\\/]vela[\\/]dist[\\/].*\.js$/.test(id)) return null;
      if (!code.includes('var MONTHS = ["Jan"')) return null;
      return code
        .replace(/var MONTHS = \[("Jan"[^\]]*)\];/, 'var MONTHS = (globalThis.__VELA_MONTHS__ ||= [$1]);')
        .replace(/var WEEKDAYS = \[("Sun"[^\]]*)\];/, 'var WEEKDAYS = (globalThis.__VELA_WEEKDAYS__ ||= [$1]);');
    }
  };
}

export default defineConfig({
  root: 'client',
  plugins: [velaAxisLocale()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      // Two entry points: the trading app and the standalone back-office console
      // (the console never loads the chart engine bundle).
      input: {
        landing: fileURLToPath(new URL('./client/index.html', import.meta.url)),
        main: fileURLToPath(new URL('./client/chart/index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./client/admin/index.html', import.meta.url))
      }
    }
  },
  server: {
    port: 5173
  }
});
