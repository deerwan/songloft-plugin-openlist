// 路由模块:播放直链解析
// 端点:
//   POST /api/music/url                        — 主程序标准音源接口
//   GET  /api/play-url?configName=&path=       — 插件页面内置迷你播放器取直链
//
// source_data 结构:{ configName: string, path: string }

import { createMusicUrlHandler, jsonResponse, parseQuery } from '@songloft/plugin-sdk'
import type { Router } from '@songloft/plugin-sdk'
import { getConfig } from '../config'
import { buildStreamRequest } from '../services/stream'

export function mountPlaybackRoutes(router: Router): void {
  router.post('/api/music/url', createMusicUrlHandler({
    resolveUrl: async (sourceData) => {
      try {
        const configName = sourceData.configName as string
        const path = sourceData.path as string
        if (!configName || !path) {
          throw new Error('Invalid source_data: ' + JSON.stringify(sourceData))
        }

        const config = await getConfig(configName)
        if (!config) throw new Error('OpenList config not found: ' + configName)

        const request = await buildStreamRequest(config, path)
        return request.headers ? { url: request.url, headers: request.headers } : request.url
      } catch (err) {
        // SDK 会吞掉 resolveUrl 的异常并统一返回 404,这里先记日志便于排查
        songloft.log.warn(`[OpenList] music/url resolve failed: ${String((err as Error)?.message || err)}`)
        throw err
      }
    },
  }))

  // 内置迷你播放器取直链:与 music/url 同一套解析策略(见 services/stream.ts)。
  // 不做字节代理——QuickJS 沙箱内存有限,音频流直接由页面 <audio> 拉取。
  router.get('/api/play-url', async (req) => {
    const query = parseQuery(req.query || '')
    const configName = query.configName || ''
    const path = query.path || ''
    if (!configName || !path) {
      return jsonResponse({ error: 'Missing configName or path' }, 400)
    }
    const config = await getConfig(configName)
    if (!config) return jsonResponse({ error: 'Config not found' }, 404)
    try {
      const request = await buildStreamRequest(config, path)
      return jsonResponse({ url: request.url, headers: request.headers || {} })
    } catch (err) {
      songloft.log.warn(`[OpenList] play-url resolve failed: ${String((err as Error)?.message || err)}`)
      return jsonResponse({ error: String((err as Error)?.message || err) }, 404)
    }
  })
}
