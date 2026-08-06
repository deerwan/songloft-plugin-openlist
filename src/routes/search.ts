// 路由模块:全局搜索(主程序标准音源接口)
// 端点:POST /api/search
//
// 与 WebDAV 插件不同,OpenList 提供 fs/search 服务端索引搜索,
// 因此这里聚合所有已配置服务器的搜索结果(真实搜索)。

import { createSearchHandler } from '@songloft/plugin-sdk'
import type { Router, SearchResultItem } from '@songloft/plugin-sdk'
import { getConfigs } from '../config'
import { searchFiles } from '../services/openlist-client'
import { isAudioFile, stripExtension } from '../types'

const MAX_RESULTS_PER_SERVER = 50

/** 解析 "歌手 - 歌名" 文件名,否则歌名即全部文件名 */
function parseTrackName(baseName: string): { title: string; artist: string } {
  const m = baseName.match(/^(.+?)\s*-\s*(.+)$/)
  if (m) return { artist: m[1].trim(), title: m[2].trim() }
  return { artist: '', title: baseName }
}

export function mountSearchRoutes(router: Router): void {
  router.post('/api/search', createSearchHandler({
    search: async (keyword, page, pageSize) => {
      const configs = await getConfigs()
      if (configs.length === 0) return []

      const perServer = Math.min(pageSize || MAX_RESULTS_PER_SERVER, MAX_RESULTS_PER_SERVER)

      // 各服务器并行搜索,单台失败不影响整体
      const settled = await Promise.allSettled(
        configs.map(config => searchFiles(config, keyword, page || 1, perServer).then(items => ({ config, items })))
      )

      const results: SearchResultItem[] = []
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i]
        if (r.status === 'rejected') {
          songloft.log.warn(`[OpenList] search failed on ${configs[i].name}: ${String((r.reason as Error)?.message || r.reason)}`)
          continue
        }
        const { config, items } = r.value
        for (const item of items) {
          if (item.isDir || !isAudioFile(item.name)) continue
          const meta = parseTrackName(stripExtension(item.name))
          results.push({
            title: meta.title,
            artist: meta.artist || config.name, // 无歌手信息时用服务器名作来源标识
            duration: 0,
            source_data: { configName: config.name, path: item.path },
          })
        }
      }
      return results
    },
  }))
}
