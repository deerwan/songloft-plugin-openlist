// 路由模块:目录浏览
// 端点:GET /lists/:id/items?path=<dir>
//
// 返回目录与音频文件列表;播放直链不在此处解析
// (播放时由 POST /api/music/url 实时调 fs/get 获取,避免目录列表产生 N 次请求)。

import { jsonResponse, parseQuery } from '@songloft/plugin-sdk'
import type { Router } from '@songloft/plugin-sdk'
import { getConfig } from '../config'
import { listFiles } from '../services/openlist-client'
import { isAudioFile } from '../types'

export function mountBrowserRoutes(router: Router): void {
  router.get('/lists/:id/items', async (req, params) => {
    const config = await getConfig(params.id)
    if (!config) {
      return jsonResponse({ error: 'Config not found' }, 404)
    }

    const query = parseQuery(req.query || '')
    const dirPath = query.path || '/'

    try {
      const items = await listFiles(config, dirPath)
      // 目录全部保留;文件只保留音频,避免浏览列表被无关文件淹没
      const filtered = items.filter(i => i.isDir || isAudioFile(i.name))
      return jsonResponse(filtered.map(i => ({
        id: i.path,
        name: i.name,
        type: i.isDir ? 'directory' : 'file',
        size: i.size,
        thumb: i.thumb || '',
      })))
    } catch (e) {
      return jsonResponse({ error: String((e as Error)?.message || e) }, 500)
    }
  })
}
