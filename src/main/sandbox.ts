import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * 沙箱管理（阶段十二）。
 *
 * 两种模式：
 *   - local ：默认。受限子进程（工作区限制 + 危险命令确认，见 shared/safety.ts）
 *   - docker：可选。容器隔离（工作区 bind-mount 到 /app，网络默认拒绝）
 *
 * Docker 集成要点（按你的 prompt）：
 *   - 用 docker CLI 而非 dockerode SDK（更稳定）
 *   - 自动检测 CLI 与守护进程
 *   - 首次使用拉取镜像
 *   - 退出时自动停止并移除容器
 */

export type SandboxMode = 'local' | 'docker'

export const SANDBOX_IMAGE = 'node:22-slim'
export const CONTAINER_NAME = 'piforge-sandbox'

export interface DockerInfo {
  /** docker CLI 是否可用 */
  cliAvailable: boolean
  /** 守护进程是否运行 */
  daemonRunning: boolean
  /** docker 版本 */
  version?: string
  /** 沙箱镜像是否已就绪 */
  imageReady: boolean
  /** 错误信息（若不可用） */
  error?: string
}

export interface SandboxStatus {
  mode: SandboxMode
  docker: DockerInfo
  /** 正在运行的沙箱容器 id（docker 模式） */
  containerId?: string
}

let currentMode: SandboxMode = 'local'
let containerId: string | undefined

/** 执行 docker 命令（返回 stdout/stderr） */
async function docker(args: string[], timeoutMs = 15000): Promise<{ ok: boolean; out: string; err: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('docker', args, { timeout: timeoutMs })
    return { ok: true, out: stdout, err: stderr }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, out: e.stdout ?? '', err: e.stderr ?? e.message ?? String(err) }
  }
}

/** 检测 Docker 可用性 */
export async function detectDocker(): Promise<DockerInfo> {
  const version = await docker(['--version'])
  if (!version.ok) {
    return { cliAvailable: false, daemonRunning: false, imageReady: false, error: version.err }
  }
  const cliVersion = version.out.trim()

  const info = await docker(['info', '--format', '{{.ServerVersion}}'])
  if (!info.ok) {
    return {
      cliAvailable: true,
      daemonRunning: false,
      version: cliVersion,
      imageReady: false,
      error: 'Docker 守护进程未运行（请启动 Docker Desktop）'
    }
  }

  const images = await docker(['images', '-q', SANDBOX_IMAGE])
  const imageReady = images.ok && images.out.trim().length > 0

  return {
    cliAvailable: true,
    daemonRunning: true,
    version: cliVersion,
    imageReady
  }
}

/** 拉取沙箱镜像（首次使用时） */
export async function ensureImage(): Promise<void> {
  const info = await detectDocker()
  if (!info.daemonRunning) throw new Error(info.error ?? 'Docker 不可用')
  if (info.imageReady) return
  const result = await docker(['pull', SANDBOX_IMAGE], 300000)
  if (!result.ok) throw new Error(`拉取镜像失败：${result.err}`)
}

/** 启动沙箱容器（工作区 bind-mount 到 /app，网络拒绝） */
export async function startContainer(workspace: string): Promise<string> {
  await ensureImage()
  // 先清理同名残留
  await docker(['rm', '-f', CONTAINER_NAME])

  const result = await docker([
    'run',
    '-d',
    '--name',
    CONTAINER_NAME,
    '--network',
    'none', // 网络默认拒绝
    '-v',
    `${workspace}:/app`,
    '-w',
    '/app',
    SANDBOX_IMAGE,
    'sleep',
    'infinity'
  ])
  if (!result.ok) throw new Error(`启动容器失败：${result.err}`)
  containerId = result.out.trim()
  return containerId
}

/** 停止并移除沙箱容器 */
export async function stopContainer(): Promise<void> {
  if (!containerId) return
  await docker(['rm', '-f', CONTAINER_NAME])
  containerId = undefined
}

/** 在沙箱容器内执行命令 */
export async function execInContainer(command: string, timeoutMs = 60000): Promise<string> {
  if (!containerId) throw new Error('沙箱容器未启动')
  const result = await docker(['exec', CONTAINER_NAME, 'bash', '-lc', command], timeoutMs)
  return result.ok ? result.out : `${result.out}\n${result.err}`
}

/** 当前沙箱状态 */
export async function getStatus(): Promise<SandboxStatus> {
  const dockerInfo = await detectDocker()
  return { mode: currentMode, docker: dockerInfo, containerId }
}

/** 切换沙箱模式 */
export async function setMode(mode: SandboxMode, workspace: string): Promise<SandboxStatus> {
  if (mode === 'docker') {
    const info = await detectDocker()
    if (!info.daemonRunning) throw new Error(info.error ?? 'Docker 不可用，无法切换到 Docker 沙箱')
    if (!containerId) await startContainer(workspace)
  } else {
    await stopContainer()
  }
  currentMode = mode
  return getStatus()
}
