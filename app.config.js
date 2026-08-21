const staticConfig = require('./app.json');

function configuredActionLink() {
  const raw = process.env.EXPO_PUBLIC_AUTH_ACTION_BASE_URL;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== 'https:' ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname === '/'
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

module.exports = () => {
  const variant = process.env.APP_VARIANT || 'http';
  if (variant !== 'http') {
    throw new Error('A configuração raiz aceita somente APP_VARIANT=http. Use o projeto demo para o mock.');
  }

  const expo = staticConfig.expo;
  const actionLink = configuredActionLink();
  const plugins = [['expo-secure-store', { configureAndroidBackup: true }]];

  return {
    ...expo,
    name: 'Tchê Agro',
    slug: 'tche-agro-mobile',
    plugins,
    extra: { ...(expo.extra || {}), appVariant: 'http' },
    android: {
      ...expo.android,
      package: 'com.tcheagro.mobile',
      permissions: [],
      blockedPermissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.RECORD_AUDIO',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE',
      ],
      ...(actionLink === null
        ? {}
        : {
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                category: ['BROWSABLE', 'DEFAULT'],
                data: [
                  {
                    scheme: 'https',
                    host: actionLink.hostname,
                    pathPrefix: actionLink.pathname,
                  },
                ],
              },
            ],
          }),
    },
    ios: {
      ...expo.ios,
      bundleIdentifier: 'com.tcheagro.mobile',
      infoPlist: {},
      ...(actionLink === null
        ? {}
        : { associatedDomains: [`applinks:${actionLink.hostname}`] }),
    },
  };
};
