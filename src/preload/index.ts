import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '@shared/channels'
import type {
  AppInfo,
  BackupRecord,
  Category,
  ComponentMeta,
  DetectionResult,
  InstallPlan,
  OperationResult
} from '@shared/types'

/**
 * The only surface the renderer can reach. Each method wraps exactly one channel and
 * passes only plain data. There is no generic "invoke any channel" escape hatch, so a
 * compromised renderer cannot reach arbitrary main-process functionality.
 */
const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(CHANNELS.appInfo),
  getCatalog: (): Promise<{
    categories: Category[]
    components: ComponentMeta[]
    recommended: string[]
  }> => ipcRenderer.invoke(CHANNELS.catalog),
  scanSystem: (): Promise<DetectionResult> => ipcRenderer.invoke(CHANNELS.scan),
  buildPlan: (componentIds: string[]): Promise<InstallPlan> =>
    ipcRenderer.invoke(CHANNELS.plan, componentIds),
  install: (componentIds: string[]): Promise<OperationResult> =>
    ipcRenderer.invoke(CHANNELS.install, componentIds),
  remove: (componentIds: string[]): Promise<OperationResult> =>
    ipcRenderer.invoke(CHANNELS.remove, componentIds),
  listBackups: (): Promise<BackupRecord[]> => ipcRenderer.invoke(CHANNELS.backups),
  restore: (backupId: string): Promise<OperationResult> =>
    ipcRenderer.invoke(CHANNELS.restore, backupId),
  installedComponents: (): Promise<string[]> => ipcRenderer.invoke(CHANNELS.installedComponents),
  claudeCodeRoute: (): Promise<{ route: { kind: string; reason?: string }; command: string }> =>
    ipcRenderer.invoke(CHANNELS.claudeCodeRoute),
  installClaudeCode: (): Promise<OperationResult> => ipcRenderer.invoke(CHANNELS.installClaudeCode),
  buildDiagnostics: (): Promise<string> => ipcRenderer.invoke(CHANNELS.diagnostics),
  saveDiagnostics: (): Promise<{ saved: boolean; path?: string }> =>
    ipcRenderer.invoke(CHANNELS.saveDiagnostics),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(CHANNELS.openExternal, url),
  revealConfig: (which: 'claude' | 'backups'): Promise<boolean> =>
    ipcRenderer.invoke(CHANNELS.revealConfig, which)
}

export type BcsApi = typeof api

contextBridge.exposeInMainWorld('bcs', api)
