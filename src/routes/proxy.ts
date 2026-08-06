// 路由模块:封面与歌词代理
// 端点:GET /api/cover?configName=&path=  GET /api/lyric?configName=&path=
//
// 封面:优先 fs/get 返回的 thumb;thumb 为相对地址时按服务器根地址补全。
// 歌词:查找同目录下同名 .lrc 文件(fs/list 同级过滤),读取内容返回。

import { jsonResponse, parseQuery } from '@songloft/plugin-sdk'
import type { Router } from '@songloft/plugin-sdk'
import { getConfig } from '../config'
import { getFile, listFiles } from '../services/openlist-client'
import { buildStreamRequest } from '../services/stream'
import { stripExtension } from '../types'
import type { OpenListConfig } from '../types'

function resolveAbsoluteUrl(config: OpenListConfig, url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return config.url.replace(/\/+$/, '') + url
  return ''
}

async function readBytesViaServer(config: OpenListConfig, path: string): Promise<{ status: number; contentType: string; body: Uint8Array }> {
  const request = await buildStreamRequest(config, path)
  const resp = await fetch(request.url, {
    headers: { ...(request.headers || {}), 'X-Fetch-No-Redirect': '1' },
  })
  if (resp.status >= 300 && resp.status < 400) {
    return { status: 502, contentType: 'text/plain', body: new TextEncoder().encode('Cross-origin redirect rejected') }
  }
  if (!resp.ok) {
    return { status: resp.status, contentType: 'text/plain', body: new TextEncoder().encode(`Fetch failed: ${resp.status}`) }
  }
  const contentType = resp.headers.get('content-type') || 'application/octet-stream'
  const buf = await resp.arrayBuffer()
  return { status: 200, contentType, body: new Uint8Array(buf) }
}

export function mountProxyRoutes(router: Router): void {
  // 封面代理
  router.get('/api/cover', async (req) => {
    const query = parseQuery(req.query || '')
    const configName = query.configName || ''
    const path = query.path || ''
    if (!configName || !path) {
      return jsonResponse({ error: 'Missing configName or path' }, 400)
    }
    const config = await getConfig(configName)
    if (!config) return jsonResponse({ error: 'Config not found' }, 404)

    try {
      const info = await getFile(config, path)
      if (!info.thumb) {
        return jsonResponse({ error: 'No cover available' }, 404)
      }
      const thumbUrl = resolveAbsoluteUrl(config, info.thumb)
      if (!thumbUrl) {
        return jsonResponse({ error: 'Unsupported thumb url' }, 502)
      }
      const resp = await fetch(thumbUrl, { headers: { 'X-Fetch-No-Redirect': '1' } })
      if (!resp.ok) {
        return jsonResponse({ error: `Cover fetch failed: ${resp.status}` }, 502)
      }
      const contentType = resp.headers.get('content-type') || 'image/jpeg'
      const buf = await resp.arrayBuffer()
      return { statusCode: 200, headers: { 'Content-Type': contentType }, body: new Uint8Array(buf) }
    } catch (e) {
      return jsonResponse({ error: String((e as Error)?.message || e) }, 502)
    }
  })

  // 歌词代理 — 返回格式须符合主程序 LyricFetcher 期望
  router.get('/api/lyric', async (req) => {
    const query = parseQuery(req.query || '')
    const configName = query.configName || ''
    const path = query.path || ''
    const fail = (message: string) => jsonResponse({ code: -1, data: {}, message })
    if (!configName || !path) return fail('Missing configName or path')

    const config = await getConfig(configName)
    if (!config) return fail('Config not found')

    try {
      // 找同级 .lrc:文件所在目录 list 一次,匹配同名歌词文件
      const lastSlash = path.lastIndexOf('/')
      const parent = lastSlash <= 0 ? '/' : path.substring(0, lastSlash)
      const baseName = stripExtension(path.substring(lastSlash + 1))
      const siblings = await listFiles(config, parent)
      const lyric = siblings.find(i => !i.isDir && stripExtension(i.name) === baseName && i.name.toLowerCase().endsWith('.lrc'))
      if (!lyric) return fail('Lyric not found')

      const result = await readBytesViaServer(config, lyric.path)
      if (result.status !== 200) return fail(`Lyric fetch failed: ${result.status}`)
      const text = new TextDecoder('utf-8').decode(result.body)
      return jsonResponse({ code: 0, data: { lyric: text, tlyric: '', rlyric: '', lxlyric: '' } })
    } catch (e) {
      return fail(String((e as Error)?.message || e))
    }
  })
}
