// Lets the app import the repo's shared/ folder (types, schemas, status and
// money rules). Packages imported from shared/ (zod) resolve from
// mobile/node_modules, never from the website's node_modules one folder up.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, "..", "shared");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath.startsWith(sharedRoot + path.sep);
  const isPackage = !moduleName.startsWith(".") && !path.isAbsolute(moduleName);
  if (fromShared && isPackage) {
    // Resolve as if the import were written in the app itself.
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, "package.json") }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
