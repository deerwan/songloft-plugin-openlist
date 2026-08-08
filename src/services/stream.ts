// 播放直链组装 — 把 source_data(configName + path)解析成可播放 URL
//
// 策略:
// 1. fs/get 返回的 raw_url 指向 OpenList 服务器自身(代理/本地路径,
//    如 /p/ 或 DownProxyURL)→ 稳定链接,直接使用
// 2. raw_url 指向第三方网盘 CDN → 是调用时刻的一次性快照,可能很快过期
//    (暂停久了/切后台恢复时失效),弃用,改走下载路由实时解析
// 3. 其余情况(含 raw_url 为空)统一回退到 OpenList 下载路由
//    /d/<path>?sign=<sign>:每次请求重新解析新直链并 302,不受快照过期影响
// 无论哪种方式都保留 sign 签名参数,避免开启 sign_all 的服务器拒绝访问。

import type { OpenListConfig } from '../types'
import { getFile } from './openlist-client'

export interface StreamRequest {
  url: string
  headers?: Record<string, string>
}

function encodePathSegments(path: string): string {
  return path.split('/').map(s => (s ? encodeURIComponent(s) : '')).join('/')
}

/** 取 URL 的 scheme://host[:port] 前缀,用于判断是否指向同一服务器 */
function originOf(url: string): string {
  const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i)
  return m ? m[0].toLowerCase() : ''
}

/**
 * 解析播放直链。失败抛错,由 createMusicUrlHandler 统一转成 404。
 * 返回 { url },headers 目前不需要(raw_url 通常自带 CDN 签名)。
 */
export async function buildStreamRequest(
  config: OpenListConfig,
  path: string,
): Promise<StreamRequest> {
  if (!path || !path.startsWith('/')) {
    throw new Error('Invalid OpenList file path')
  }

  const info = await getFile(config, path)
  const base = config.url.replace(/\/+$/, '')

  if (info.rawUrl) {
    let url = info.rawUrl
    // 个别驱动返回相对路径,补全为服务器绝对地址
    if (url.startsWith('/')) {
      url = base + url
    }
    // 指向 OpenList 服务器自身的链接(代理/本地)是稳定的,直接使用
    if (originOf(url) === originOf(config.url)) {
      if (info.sign && !/[?&]sign=/.test(url)) {
        url += (url.includes('?') ? '&' : '?') + `sign=${encodeURIComponent(info.sign)}`
      }
      return { url }
    }
    // 第三方 CDN 直链是快照,可能已过期 → 落入下方 /d 路由实时解析
  }

  // 下载路由:每次请求重新解析新直链,天然新鲜
  let url = `${base}/d${encodePathSegments(path)}`
  if (info.sign) {
    url += `?sign=${encodeURIComponent(info.sign)}`
  }
  return { url }
}
