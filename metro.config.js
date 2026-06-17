const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root (where package.json for the app is)
const projectRoot = __dirname;
// Find the workspace root
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro look for dependencies in both local and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
