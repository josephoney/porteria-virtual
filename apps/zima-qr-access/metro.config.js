// Metro resolves `@porteria/shared` to its TypeScript source. That source uses
// NodeNext-style relative specifiers ending in `.js`, while the files on disk
// are `.ts`. Metro does not remap explicit extensions, so we resolve those
// specifiers inside the shared package without the extension.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);
const sharedSrc = path
  .resolve(__dirname, '../../packages/shared/src')
  .replace(/\\/g, '/')
  .toLowerCase();

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath.replace(/\\/g, '/');

  if (
    origin.toLowerCase().startsWith(sharedSrc) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js')
  ) {
    const directory = path.dirname(context.originModulePath);
    const withoutExtension = moduleName.slice(0, -3);
    const candidates = [`${withoutExtension}.ts`, `${withoutExtension}.tsx`].map((file) =>
      path.resolve(directory, file),
    );

    if (candidates.some((file) => fs.existsSync(file))) {
      return context.resolveRequest(context, withoutExtension, platform);
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
