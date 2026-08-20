import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '@shared/channels'
import type {
  AppInfo,
  BackupRecord,
  Category,
  ComponentMeta,
  DetectionResult,
  InstallPlan,
  OperationResult,
  ChatSkillsState,
  StepResult
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
    ipcRenderer.invoke(CHANNELS.revealConfig, which),

  /** Claude account skills. None of these reach the user's Claude account. */
  chatSkillsState: (): Promise<ChatSkillsState> => ipcRenderer.invoke(CHANNELS.chatSkillsState),
  prepareChatSkills: (): Promise<{ directory: string; files: string[] }> =>
    ipcRenderer.invoke(CHANNELS.chatSkillsPrepare),
  confirmChatSkills: (): Promise<ChatSkillsState> => ipcRenderer.invoke(CHANNELS.chatSkillsConfirm),
  resetChatSkills: (): Promise<ChatSkillsState> => ipcRenderer.invoke(CHANNELS.chatSkillsReset),
  revealChatSkills: (): Promise<boolean> => ipcRenderer.invoke(CHANNELS.chatSkillsReveal),

  /**
   * Progress subscriptions. Each returns an unsubscribe function, and the listener only
   * ever receives plain data forwarded from the main process.
   */
  onWindowState: (
    listener: (state: { fullscreen: boolean; maximized: boolean; platform: string }) => void
  ): (() => void) => {
    const handler = (
      _event: unknown,
      state: { fullscreen: boolean; maximized: boolean; platform: string }
    ): void => listener(state)
    ipcRenderer.on(CHANNELS.windowState, handler)
    return () => ipcRenderer.removeListener(CHANNELS.windowState, handler)
  },
  onScanStep: (listener: (step: string) => void): (() => void) => {
    const handler = (_event: unknown, step: string): void => listener(step)
    ipcRenderer.on(CHANNELS.scanProgress, handler)
    return () => ipcRenderer.removeListener(CHANNELS.scanProgress, handler)
  },
  onInstallStep: (
    listener: (payload: { step: StepResult; done: number; total: number }) => void
  ): (() => void) => {
    const handler = (
      _event: unknown,
      payload: { step: StepResult; done: number; total: number }
    ): void => listener(payload)
    ipcRenderer.on(CHANNELS.installProgress, handler)
    return () => ipcRenderer.removeListener(CHANNELS.installProgress, handler)
  }
}

export type BcsApi = typeof api

contextBridge.exposeInMainWorld('bcs', api)
