const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo (extend Expo defaults, don't replace them)
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// Resolve modules from monorepo root first, then app root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Shim Node.js crypto (used by @riderguy/utils id.ts server fallback, never reached in RN)
config.resolver.extraNodeModules = {
  crypto: path.resolve(projectRoot, 'src/crypto-shim.js'),
};

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// On Windows the RN Gradle plugin passes a relative --entry-file (relative to `root`).
// expo/metro-config sets unstable_serverRoot = monorepoRoot, so Metro resolves that
// relative path from the monorepo root — going 2 levels above it — and fails.
// Fix: keep serverRoot = projectRoot so Metro resolves from the app directory,
// where ../../node_modules/expo-router/entry.js correctly reaches riderguy/node_modules/.
config.server = {
  ...config.server,
  unstable_serverRoot: projectRoot,
};

// Force axios to use its browser bundle BEFORE withNativeWind so NativeWind wraps
// this resolver (not the other way around). withNativeWind saves the current
// resolveRequest as `originalResolver` and calls it as a fallback — if we set it
// after, we bypass NativeWind's CSS file interception entirely.
const axiosBrowserBundle = path.resolve(monorepoRoot, 'node_modules/axios/dist/browser/axios.cjs');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return { filePath: axiosBrowserBundle, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/globals.css' });
