import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkK2hxnf2T+7s3N/fdNRQGIacYnkKq1XiDlP2vow5K5GzAWThQTW3NpRAA5xpunv/UIn9bAIlgbgxKxfNrBtE5etTJp7r24OCPemZDMqzDosPFL2sy1ZgX0WOpZalyFr9zIdWPDbdPpQqqYxL7f8RP7M6rlEiYstgLxfnazpKln6L98IsivMqe4sPLdV0h2/6wmQVMbZNzwqfN2aqVGA4B8qCYLcASo51ZA8FX13KpLPvR6mwGalyJreDmHTqlA+4LNd7vdc+oLu05NtUb+XcR7cFRWckq6khmA+s+5sSXuZ8N7nMyvcCHXgg7olIN1GWan/i8MhFoX02pvEkYjgqDwIDAQAB',
    name: 'NTab',
    short_name: 'NTab',
    description: 'Modern, fast and customizable new tab page with smart bookmark management',
    version: '1.0.1',
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
