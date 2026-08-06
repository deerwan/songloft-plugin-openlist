// 播放直链组装 — 把 source_data(configName + path)解析成可播放 URL
//
// 策略:
// 1. fs/get 拿到 raw_url 非空 → 直接作为播放链接(可能是网盘原始 CDN 或 OpenList 代理地址)
// 2. raw_url 为空 → 回退到 OpenList 下载路由 /d/<path>?sign=<sign>
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

  if (info.rawUrl) {
    let url = info.rawUrl
    // 个别驱动返回相对路径,补全为服务器绝对地址
    if (url.startsWith('/')) {
      url = config.url.replace(/\/+$/, '') + url
    }
    // 保留服务端附带的 sign(fs/get 的 sign 针对该文件路径)
    if (info.sign && !/[?&]sign=/.test(url)) {
      url += (url.includes('?') ? '&' : '?') + `sign=${encodeURIComponent(info.sign)}`
    }
    return { url }
  }

  // 回退:OpenList 下载路由
  const base = config.url.replace(/\/+$/, '')
  let url = `${base}/d${encodePathSegments(path)}`
  if (info.sign) {
    url += `?sign=${encodeURIComponent(info.sign)}`
  }
  return { url }
}
