import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-types'
import type {
  CustomProvider,
  ProviderProbeRequest,
  ProviderProbeResult,
  SaveProviderRequest
} from '../../shared/ipc-types'
import {
  deleteProvider,
  getProviderKeys,
  listProviders,
  saveProvider,
  syncModelsJson
} from '../model-providers'
import { probeProvider } from '../model-probe'
import { agentHost } from '../agent-host'
import { getWorkspace } from '../workspace'

/**
 * 自定义 provider / 模型 IPC。
 *
 * 任何写操作后：同步 models.json → 重启 agent（重载 provider 并重注入运行时密钥），
 * 这样模型选择器会立刻看到新模型。
 */
function afterChange(): void {
  const agentDir = agentHost.getAgentDir()
  if (agentDir) syncModelsJson(agentDir)
  const workspace = getWorkspace()
  if (workspace) agentHost.restart(workspace, getProviderKeys())
}

export function registerModelProviderIpc(): void {
  ipcMain.handle(IPC.CUSTOM_PROVIDER_LIST, async (): Promise<CustomProvider[]> => listProviders())

  ipcMain.handle(
    IPC.CUSTOM_PROVIDER_SAVE,
    async (_event, request: SaveProviderRequest): Promise<CustomProvider[]> => {
      const next = saveProvider(request)
      afterChange()
      return next
    }
  )

  ipcMain.handle(IPC.CUSTOM_PROVIDER_DELETE, async (_event, id: unknown): Promise<CustomProvider[]> => {
    const next = deleteProvider(String(id ?? ''))
    afterChange()
    return next
  })

  ipcMain.handle(
    IPC.CUSTOM_PROVIDER_PROBE,
    async (_event, request: ProviderProbeRequest): Promise<ProviderProbeResult> =>
      probeProvider(request)
  )

  ipcMain.handle(
    IPC.CUSTOM_PROVIDER_FETCH_MODELS,
    async (_event, request: ProviderProbeRequest): Promise<ProviderProbeResult> =>
      probeProvider(request)
  )
}
