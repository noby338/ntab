import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'NTab',
    short_name: 'NTab',
    description: 'Modern, fast and customizable new tab page with smart bookmark management',
    version: '1.0.0',
    permissions: [
      'bookmarks',
      'favicon',
      'storage',
      'topSites',
      'sessions',
      'identity',
      'history',
    ],
    host_permissions: ['*://*/*'],
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
  },
});
