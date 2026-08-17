import type { ExpoConfig, ConfigContext } from 'expo/config';

function normalizePublicUrl(value: string) {
  return value.trim().replace('api.riderguy.com', 'api.myriderguy.com').replace(/\/+$/, '');
}

const apiUrl = normalizePublicUrl(process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myriderguy.com/api/v1');
const socketUrl = normalizePublicUrl(process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RiderGuy Rider',
  slug: 'riderguy-rider',
  scheme: 'riderguy-rider',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: false,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#40BE89',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.riderguy.rider',
    associatedDomains: ['applinks:app.myriderguy.com', 'applinks:riderguy.com', 'applinks:www.riderguy.com'],
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist',
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'RiderGuy Rider uses your location to show your position to customers.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'RiderGuy Rider needs your location at all times to share it with customers during active deliveries.',
      NSCameraUsageDescription:
        'RiderGuy Rider uses the camera for proof of delivery photos and document uploads.',
      NSPhotoLibraryUsageDescription:
        'RiderGuy Rider accesses your photos for document and vehicle photo uploads.',
      NSFaceIDUsageDescription:
        'RiderGuy Rider uses Face ID so you can log in quickly and securely.',
      UIBackgroundModes: ['location', 'audio', 'fetch', 'remote-notification'],
    },
  },
  android: {
    ...(apiUrl.startsWith('http://') || socketUrl.startsWith('http://') ? { usesCleartextTraffic: true } : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#40BE89',
    },
    package: 'com.riderguy.rider',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
    ],
    blockedPermissions: [
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.READ_APP_BADGE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'com.anddoes.launcher.permission.UPDATE_COUNT',
      'com.google.android.gms.permission.ACTIVITY_RECOGNITION',
      'com.google.android.providers.gsf.permission.READ_GSERVICES',
      'com.htc.launcher.permission.READ_SETTINGS',
      'com.htc.launcher.permission.UPDATE_SHORTCUT',
      'com.huawei.android.launcher.permission.CHANGE_BADGE',
      'com.huawei.android.launcher.permission.READ_SETTINGS',
      'com.huawei.android.launcher.permission.WRITE_SETTINGS',
      'com.majeur.launcher.permission.UPDATE_BADGE',
      'com.oppo.launcher.permission.READ_SETTINGS',
      'com.oppo.launcher.permission.WRITE_SETTINGS',
      'com.sec.android.provider.badge.permission.READ',
      'com.sec.android.provider.badge.permission.WRITE',
      'com.sonyericsson.home.permission.BROADCAST_BADGE',
      'com.sonymobile.home.permission.PROVIDER_INSERT_BADGE',
      'me.everything.badger.permission.BADGE_COUNT_READ',
      'me.everything.badger.permission.BADGE_COUNT_WRITE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: false,
        data: [{ scheme: 'riderguy-rider' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'riderguy.com', pathPrefix: '/auth' },
          { scheme: 'https', host: 'www.riderguy.com', pathPrefix: '/auth' },
          { scheme: 'https', host: 'app.myriderguy.com', pathPrefix: '/auth' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  } as ExpoConfig['android'] & { usesCleartextTraffic?: boolean },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-local-authentication',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow RiderGuy Rider to use your location while delivering.',
        locationAlwaysAndWhenInUsePermission:
          'Allow RiderGuy Rider to use your location at all times during active deliveries.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow RiderGuy Rider to use the camera for delivery proof and documents.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow RiderGuy Rider to access your photos for document uploads.',
        microphonePermission: false,
      },
    ],
    [
      'expo-av',
      { microphonePermission: false },
    ],
    'expo-notifications',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl,
    socketUrl,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: 'd41a49c6-5a28-407a-bffb-8b278e90b627',
    },
  },
});
