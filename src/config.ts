// 服务器配置持久化 — 基于 songloft.storage,key = openlist_configs

import type { OpenListConfig } from './types'

const CONFIG_KEY = 'openlist_configs'

export async function getConfigs(): Promise<OpenListConfig[]> {
  try {
    const val = await songloft.storage.get(CONFIG_KEY)
    if (val) {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val
      if (Array.isArray(parsed)) return parsed as OpenListConfig[]
    }
  } catch (err) {
    songloft.log.error(`[OpenList] Failed to load configs: ${String(err)}`)
  }
  return []
}

export async function saveConfigs(configs: OpenListConfig[]): Promise<void> {
  await songloft.storage.set(CONFIG_KEY, JSON.stringify(configs))
}

export async function getConfig(name: string): Promise<OpenListConfig | undefined> {
  const configs = await getConfigs()
  return configs.find(c => c.name === name)
}
