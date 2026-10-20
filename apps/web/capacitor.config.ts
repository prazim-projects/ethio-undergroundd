import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'et.ethiounderground.app',
  appName: 'Ethio Underground',
  webDir: 'dist-native',
  server: { androidScheme: 'https' },
};

export default config;
