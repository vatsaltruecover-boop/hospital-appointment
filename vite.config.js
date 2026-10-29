import { defineConfig } from 'vite';
import { resolve } from 'path';

// Middleware plugin to seamlessly route clean vanity paths:
// /joshi-clinic -> index.html
// /joshi-clinic/tv -> live-tv.html
// /joshi-clinic/doctor -> doctor.html
function clinicCleanUrlsPlugin() {
  return {
    name: 'clinic-clean-urls',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [rawPath, rawQuery] = (req.url || '').split('?');
        const queryStr = rawQuery ? `?${rawQuery}` : '';

        // Ignore static assets, node_modules, and vite internals
        if (
          rawPath.includes('.') ||
          rawPath.startsWith('/@') ||
          rawPath.startsWith('/node_modules') ||
          rawPath.startsWith('/src')
        ) {
          return next();
        }

        const segments = rawPath.split('/').filter(Boolean);

        if (segments.length === 1) {
          const seg = segments[0].toLowerCase();
          if (seg === 'doctor') {
            req.url = '/doctor.html' + queryStr;
          } else if (seg === 'tv' || seg === 'live-tv') {
            req.url = '/live-tv.html' + queryStr;
          } else if (seg === 'admin') {
            req.url = '/admin.html' + queryStr;
          } else {
            // Vanity clinic slug: /joshi-clinic -> patient booking
            req.url = '/index.html' + queryStr;
          }
        } else if (segments.length >= 2) {
          const last = segments[segments.length - 1].toLowerCase();
          const first = segments[0].toLowerCase();

          if (last === 'tv' || last === 'live-tv' || first === 'tv' || first === 'live-tv') {
            req.url = '/live-tv.html' + queryStr;
          } else if (last === 'doctor' || first === 'doctor') {
            req.url = '/doctor.html' + queryStr;
          } else if (last === 'admin' || first === 'admin') {
            req.url = '/admin.html' + queryStr;
          } else {
            req.url = '/index.html' + queryStr;
          }
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [clinicCleanUrlsPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        liveTv: resolve(import.meta.dirname, 'live-tv.html'),
        doctor: resolve(import.meta.dirname, 'doctor.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      }
    }
  }
});
