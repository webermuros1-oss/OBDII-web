import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.obdii.diagnostics',
  appName: 'OBDII Diagnostics',
  webDir: 'dist',
  android: {
    minWebViewVersion: 60,
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
}

export default config
