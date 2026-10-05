import type { LucideIcon } from 'lucide-react'
import {
  Asterisk,
  AudioWaveform,
  Bot,
  Braces,
  Cloud,
  Code2,
  Cpu,
  Flame,
  Globe,
  MessageSquare,
  Moon,
  Plug,
  Smartphone,
  Sparkles,
  Terminal,
  Zap
} from 'lucide-react'

/**
 * 「供应商类型」精选列表。
 *
 * 对齐参考图：中文/友好名称 + 图标占位，每项携带预填的 API 协议与 Base URL。
 * providerId 指向 SDK 内置目录里的 provider，仅作为元数据与 slug 回退；
 * 内置目录里没有对应 provider 的类型（火山引擎、纯通义千问等）providerId 为 null，
 * 以「自定义地址」预设兜底。
 *
 * 图标只做占位（lucide 通用图标 + 品牌色），不引入品牌 SVG 资源。
 */
export interface ProviderType {
  /** 稳定标识（用于 React key 与表单状态） */
  key: string
  label: string
  providerId: string | null
  api: string
  baseUrl: string
  icon: LucideIcon
  /** 图标颜色类（品牌色近似） */
  colorClass: string
}

export const PROVIDER_TYPES: ProviderType[] = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    providerId: 'anthropic',
    api: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com',
    icon: Asterisk,
    colorClass: 'text-orange-400'
  },
  {
    key: 'anthropic-compatible',
    label: 'Anthropic 兼容格式',
    providerId: null,
    api: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com',
    icon: Braces,
    colorClass: 'text-orange-400'
  },
  {
    key: 'openai',
    label: 'OpenAI',
    providerId: 'openai',
    api: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    icon: Sparkles,
    colorClass: 'text-emerald-400'
  },
  {
    key: 'openai-responses',
    label: 'OpenAI Responses 格式',
    providerId: null,
    api: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    icon: MessageSquare,
    colorClass: 'text-emerald-400'
  },
  {
    key: 'openai-codex',
    label: 'ChatGPT 订阅 (Codex)',
    providerId: 'openai-codex',
    api: 'openai-codex-responses',
    baseUrl: 'https://chatgpt.com/backend-api',
    icon: Terminal,
    colorClass: 'text-emerald-400'
  },
  {
    key: 'github-copilot',
    label: 'GitHub Copilot 订阅',
    providerId: 'github-copilot',
    api: 'anthropic-messages',
    baseUrl: 'https://api.individual.githubcopilot.com',
    icon: Code2,
    colorClass: 'text-foreground'
  },
  {
    key: 'xai',
    label: 'xAI 订阅 (Grok)',
    providerId: 'xai',
    api: 'openai-responses',
    baseUrl: 'https://api.x.ai/v1',
    icon: Zap,
    colorClass: 'text-foreground'
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    providerId: 'deepseek',
    api: 'openai-completions',
    baseUrl: 'https://api.deepseek.com',
    icon: Bot,
    colorClass: 'text-sky-400'
  },
  {
    key: 'google',
    label: 'Google',
    providerId: 'google',
    api: 'google-generative-ai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    icon: Globe,
    colorClass: 'text-blue-400'
  },
  {
    key: 'kimi',
    label: 'Kimi API',
    providerId: 'moonshotai-cn',
    api: 'openai-completions',
    baseUrl: 'https://api.moonshot.cn/v1',
    icon: Moon,
    colorClass: 'text-sky-400'
  },
  {
    key: 'kimi-coding',
    label: 'Kimi Coding Plan',
    providerId: 'kimi-coding',
    api: 'anthropic-messages',
    baseUrl: 'https://api.kimi.com/coding',
    icon: Moon,
    colorClass: 'text-sky-400'
  },
  {
    key: 'zhipu',
    label: '智谱 AI',
    providerId: 'zai-coding-cn',
    api: 'openai-completions',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    icon: Cpu,
    colorClass: 'text-cyan-400'
  },
  {
    key: 'zhipu-coding',
    label: '智谱 Coding Plan',
    providerId: 'zai',
    api: 'openai-completions',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    icon: Cpu,
    colorClass: 'text-cyan-400'
  },
  {
    key: 'zhipu-coding-team',
    label: '智谱 Coding Plan 团队版',
    providerId: null,
    api: 'openai-completions',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    icon: Cpu,
    colorClass: 'text-cyan-400'
  },
  {
    key: 'volcengine',
    label: '火山引擎 API',
    providerId: null,
    api: 'openai-completions',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    icon: Flame,
    colorClass: 'text-rose-400'
  },
  {
    key: 'minimax',
    label: 'MiniMax (API&编程包)',
    providerId: 'minimax-cn',
    api: 'anthropic-messages',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    icon: AudioWaveform,
    colorClass: 'text-indigo-400'
  },
  {
    key: 'qwen',
    label: '通义千问',
    providerId: null,
    api: 'openai-completions',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    icon: Cloud,
    colorClass: 'text-violet-400'
  },
  {
    key: 'qwen-token-plan',
    label: '通义千问 Token Plan',
    providerId: 'qwen-token-plan-cn',
    api: 'openai-completions',
    baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    icon: Cloud,
    colorClass: 'text-violet-400'
  },
  {
    key: 'xiaomi',
    label: '小米 MiMo (API)',
    providerId: 'xiaomi',
    api: 'openai-completions',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    icon: Smartphone,
    colorClass: 'text-orange-400'
  },
  {
    key: 'xiaomi-token-plan',
    label: '小米 MiMo Token Plan',
    providerId: 'xiaomi-token-plan-cn',
    api: 'openai-completions',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    icon: Smartphone,
    colorClass: 'text-orange-400'
  },
  {
    key: 'openai-custom',
    label: 'OpenAI Chat Completions（自定义地址）',
    providerId: null,
    api: 'openai-completions',
    baseUrl: '',
    icon: Plug,
    colorClass: 'text-muted-foreground'
  }
]

export function providerTypeByKey(key: string): ProviderType | undefined {
  return PROVIDER_TYPES.find((item) => item.key === key)
}
