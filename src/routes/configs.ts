// 路由模块:服务器配置管理(CRUD + 测试连接)
// 端点:GET/POST /lists, DELETE /lists/:id, POST /test

import { jsonResponse } from '@songloft/plugin-sdk'
import type { Router, HTTPRequest } from '@songloft/plugin-sdk'
import { getConfigs, saveConfigs, getConfig } from '../config'
import { testConnection, clearToken } from '../services/openlist-client'
import type { OpenListConfig } from '../types'

export function parseBody(req: HTTPRequest): Record<string, any> {
  if (!req.body) return {}
  try {
    const str = typeof req.body === 'string'
      ? req.body
      : String.fromCharCode.apply(null, Array.from(req.body as Uint8Array))
    return JSON.parse(str)
  } catch {
    return {}
  }
}

export function mountConfigsRoutes(router: Router): void {
  // 列出所有已配置的服务器
  router.get('/lists', async () => {
    const configs = await getConfigs()
    return jsonResponse(configs.map(c => ({
      id: c.name,
      name: c.name,
      url: c.url,
    })))
  })

  // 添加/更新服务器配置
  router.post('/lists', async (req) => {
    const data = parseBody(req)
    if (!data.name || !data.url) {
      return jsonResponse({ error: 'name and url are required' }, 400)
    }
    const config: OpenListConfig = {
      name: String(data.name).trim(),
      url: String(data.url).trim().replace(/\/+$/, ''),
      username: data.username ? String(data.username) : '',
      password: data.password ? String(data.password) : '',
    }
    const configs = await getConfigs()
    const idx = configs.findIndex(c => c.name === config.name)
    if (idx >= 0) configs[idx] = config
    else configs.push(config)
    await saveConfigs(configs)
    clearToken(config.name) // 凭证变更,清掉旧 token
    return jsonResponse({ success: true })
  })

  // 删除配置
  router.delete('/lists/:id', async (_req, params) => {
    const configs = await getConfigs()
    await saveConfigs(configs.filter(c => c.name !== params.id))
    clearToken(params.id)
    return jsonResponse({ success: true })
  })

  // 测试连接(登录 + 列根目录)
  router.post('/test', async (req) => {
    const data = parseBody(req)
    if (!data.url) {
      return jsonResponse({ success: false, error: 'url is required' }, 400)
    }
    const config: OpenListConfig = {
      name: String(data.name || 'Test'),
      url: String(data.url).trim().replace(/\/+$/, ''),
      username: data.username ? String(data.username) : '',
      password: data.password ? String(data.password) : '',
    }
    try {
      const count = await testConnection(config)
      return jsonResponse({ success: true, count })
    } catch (e) {
      return jsonResponse({ success: false, error: String((e as Error)?.message || e) })
    }
  })

  // 读取单个配置(前端调试用,不暴露密码)
  router.get('/lists/:id/config', async (_req, params) => {
    const config = await getConfig(params.id)
    if (!config) return jsonResponse({ error: 'Config not found' }, 404)
    return jsonResponse({ name: config.name, url: config.url, username: config.username || '' })
  })
}
