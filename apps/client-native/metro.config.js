const path = require('path');
const Module = require('module');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// NativeWind is hoisted by npm, while React Native is intentionally local to
// this workspace because the web apps use a different React version. Give
// hoisted Metro plugins a fallback path to this app's native dependencies.
const appNodeModules = path.resolve(projectRoot, 'node_modules');
const nodePathEntries = (process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean);
if (!nodePathEntries.includes(appNodeModules)) {
  process.env.NODE_PATH = [appNodeModules, ...nodePathEntries].join(path.delimiter);
  Module._initPaths();
}

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

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
  // Shared workspace packages must use the app's React 19 runtime, not the
  // React 18 runtime used by the Next.js workspaces at the monorepo root.
  react: path.resolve(appNodeModules, 'react'),
};

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

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
