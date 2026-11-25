import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * CSP from the spec (section 8). Styles need 'unsafe-inline': Recharts positions
 * the tooltip and legend with inline styles. Scripts stay strict — no external
 * CDNs are needed, everything is bundled locally.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * The meta tag is injected into the built index.html only: the Vite dev server
 * uses an inline react-refresh script that strict script-src would block.
 */
function cspPlugin(): Plugin {
  return {
    name: 'office-capacity-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
        return html.replace('<head>', `<head>\n    ${meta}`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
});