const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

// The Demo owns its Expo project and identifier, while its static entrypoint
// intentionally composes the preserved mock App from the workspace root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.join(workspaceRoot, 'node_modules')];

module.exports = config;
