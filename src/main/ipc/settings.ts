import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import type { CredentialStatus } from '../../shared/ipc-types'
import { saveApiKey, loadApiKey, isEncryptionAvailable } from '../credentials'
import { agentHost } from '../agent-host'

/**
 * 设置相关 IPC：API Key 写入/查询。
 *
 * 写入后重启 Agent Utility Process，让新的 Key 生效
 * （Key 是在 spawn 时通过环境变量传给子进程的）。
 */
export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.SET_API_KEY, async (_event, apiKey: unknown): Promise<void> => {
    const key = typeof apiKey === 'string' ? apiKey.trim() : ''
    if (!key) return
    saveApiKey(key)
    // 重启 Agent，使新凭据生效
    const workspace = process.env.PIFORGE_WORKSPACE ?? process.cwd()
    agentHost.restart(workspace)
  })

  ipcMain.handle(IPC.CREDENTIAL_STATUS, async (): Promise<CredentialStatus> => {
    const stored = loadApiKey() !== null
    return {
      hasStoredKey: stored,
      encryptionAvailable: isEncryptionAvailable(),
      usingEnvVar: !stored && Boolean(process.env.DEEPSEEK_API_KEY)
    }
  })
}
