// 路由模块:播放直链解析(主程序标准音源接口)
// 端点:POST /api/music/url
//
// source_data 结构:{ configName: string, path: string }

import { createMusicUrlHandler } from '@songloft/plugin-sdk'
import type { Router } from '@songloft/plugin-sdk'
import { getConfig } from '../config'
import { buildStreamRequest } from '../services/stream'

export function mountPlaybackRoutes(router: Router): void {
  router.post('/api/music/url', createMusicUrlHandler({
    resolveUrl: async (sourceData) => {
      const configName = sourceData.configName as string
      const path = sourceData.path as string
      if (!configName || !path) throw new Error('Invalid source_data')

      const config = await getConfig(configName)
      if (!config) throw new Error('OpenList config not found: ' + configName)

      const request = await buildStreamRequest(config, path)
      return request.headers ? { url: request.url, headers: request.headers } : request.url
    },
  }))
}
