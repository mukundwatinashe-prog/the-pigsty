import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.thepigsty.app',
  appName: 'The Pigsty',
  // Vite build output that gets copied into the native shells on `cap sync`.
  webDir: 'dist',
  ios: {
    // Allows the WebView to make requests to the remote API over HTTPS.
    contentInset: 'always',
  },
};

export default config;
