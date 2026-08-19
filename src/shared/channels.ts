/**
 * The complete list of messages the renderer may send to the main process.
 * The preload bridge exposes only these; anything else is unreachable from the UI.
 */
export const CHANNELS = {
  appInfo: 'app:info',
  catalog: 'catalog:get',
  scan: 'system:scan',
  plan: 'install:plan',
  install: 'install:apply',
  remove: 'install:remove',
  backups: 'backup:list',
  restore: 'backup:restore',
  installedComponents: 'install:installed',
  claudeCodeRoute: 'claude-code:route',
  installClaudeCode: 'claude-code:install',
  diagnostics: 'diagnostics:build',
  saveDiagnostics: 'diagnostics:save',
  openExternal: 'shell:open-external',
  scanProgress: 'system:scan-progress',
  installProgress: 'install:progress',
  revealConfig: 'shell:reveal'
} as const
