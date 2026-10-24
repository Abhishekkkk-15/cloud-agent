const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

const watchFolders = [monorepoRoot];

// If Expo CLI is executed via pnpm dlx or global cache, watch its package folder to prevent Metro SHA-1 errors
try {
  const cliPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  if (cliPath && !cliPath.startsWith(monorepoRoot)) {
    // Add dlx cache root or parent of the running cli
    const dlxMatch = cliPath.match(/^(.*?[\/\\]dlx[\/\\][^\/\\]+)/);
    if (dlxMatch && dlxMatch[1]) {
      watchFolders.push(path.resolve(dlxMatch[1]));
    } else {
      watchFolders.push(path.resolve(cliPath, '../../..'));
    }
  }
} catch {
  // ignore
}

// 1. Watch all files within the monorepo + external CLI packages
config.watchFolders = watchFolders;

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Shim react-native-web AssetRegistry for web builds
const assetRegistryShim = path.resolve(projectRoot, 'shims/assetRegistry.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react-native-web/dist/exports/AssetRegistry' ||
    moduleName === 'react-native-web/dist/cjs/exports/AssetRegistry' ||
    moduleName === 'react-native-web/dist/modules/AssetRegistry' ||
    moduleName === 'react-native-web/dist/cjs/modules/AssetRegistry' ||
    (platform === 'web' && (
      moduleName === '@react-native/assets-registry/registry' ||
      moduleName === '@react-native/assets-registry'
    ))
  ) {
    return {
      filePath: assetRegistryShim,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
