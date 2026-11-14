const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
const workspace = path.resolve(__dirname, '../..');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const excluded = ['.toolchain', '.qa', '.npm-cache', '.pnpm-store', 'android', 'reference', 'apps/server/storage'];
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  ...excluded.map(folder => new RegExp('^' + escape(path.join(workspace, folder)) + '([/\\\\].*)?$')),
];
module.exports = config;
