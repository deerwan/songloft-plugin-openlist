// OpenList/AList REST 客户端 — 登录、token 缓存、fs/list、fs/get、fs/search
//
// 协议要点:
// - POST /api/auth/login 返回 { code, message, data: { token } }
// - 后续请求 Authorization 头直接放 token(不带 Bearer 前缀)
// - token 失效(HTTP 401)时自动重新登录并重试一次

import type { OpenListConfig, OpenListFileItem, OpenListFileInfo } from '../types'

interface TokenEntry {
  token: string
  expiresAt: number
}

// token 内存缓存:key = `${name}|${url}`
const tokenCache = new Map<string, TokenEntry>()

// 缓存有效期 6 小时(OpenList 默认 JWT 过期 48 小时,留足余量)
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000

function cacheKey(config: OpenListConfig): string {
  return `${config.name}|${config.url}`
}

function baseUrl(config: OpenListConfig): string {
  return config.url.replace(/\/+$/, '')
}

/** OpenList 统一响应包装 */
interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

async function postJson(url: string, body: Record<string, unknown>, token: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = token
  return await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function parseEnvelope<T>(resp: Response): Promise<ApiEnvelope<T>> {
  const text = await resp.text()
  let json: ApiEnvelope<T>
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${resp.status})`)
  }
  if (!json || typeof json.code !== 'number') {
    throw new Error(`Unexpected response format (HTTP ${resp.status})`)
  }
  return json
}

/** 登录获取 token。游客模式(无用户名)返回空 token */
export async function login(config: OpenListConfig): Promise<string> {
  if (!config.username) return ''
  const resp = await postJson(`${baseUrl(config)}/api/auth/login`, {
    username: config.username,
    password: config.password || '',
  }, '')
  const json = await parseEnvelope<{ token: string }>(resp)
  if (json.code !== 200 || !json.data || !json.data.token) {
    throw new Error(json.message || 'Login failed')
  }
  return json.data.token
}

async function getToken(config: OpenListConfig, force = false): Promise<string> {
  const key = cacheKey(config)
  const cached = tokenCache.get(key)
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.token
  }
  const token = await login(config)
  tokenCache.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
  return token
}

/** 配置删除后清理 token 缓存 */
export function clearToken(name: string): void {
  for (const key of Array.from(tokenCache.keys())) {
    if (key.startsWith(`${name}|`)) tokenCache.delete(key)
  }
}

/**
 * 带认证的 API 调用。
 * 注意:OpenList 的认证失败有两种形态,都要触发重登重试:
 *   1. HTTP 401
 *   2. HTTP 200 + envelope code 401(如 "Guest user is disabled" / token 过期)
 * 重试一次后仍失败则抛错。
 */
async function apiCall<T>(config: OpenListConfig, path: string, body: Record<string, unknown>): Promise<T> {
  const doCall = async (token: string): Promise<{ status: number; envelope: ApiEnvelope<T> | null; raw: string }> => {
    const resp = await postJson(`${baseUrl(config)}${path}`, body, token)
    const text = await resp.text()
    let envelope: ApiEnvelope<T> | null = null
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.code === 'number') envelope = parsed
    } catch { /* 非 JSON,保留原始文本用于报错 */ }
    return { status: resp.status, envelope, raw: text }
  }

  let result = await doCall(await getToken(config))
  const isAuthError = (r: typeof result) => r.status === 401 || (r.envelope?.code === 401)
  if (isAuthError(result)) {
    tokenCache.delete(cacheKey(config))
    result = await doCall(await getToken(config, true))
  }
  if (isAuthError(result)) {
    throw new Error(result.envelope?.message || 'Authentication failed (401)')
  }
  if (!result.envelope) {
    throw new Error(`Invalid JSON response (HTTP ${result.status})`)
  }
  if (result.envelope.code !== 200) {
    throw new Error(result.envelope.message || `API error code ${result.envelope.code}`)
  }
  return result.envelope.data
}

/** fs/list 响应中的单个对象 */
interface FsListObj {
  name: string
  size?: number
  is_dir?: boolean
  thumb?: string
}

/** 列出目录内容(自动翻页,最多 MAX_LIST_PAGES 页防止超大目录拖垮请求) */
const MAX_LIST_PAGES = 5
export async function listFiles(config: OpenListConfig, path: string): Promise<OpenListFileItem[]> {
  const perPage = 1000
  const all: FsListObj[] = []
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const data = await apiCall<{ content: FsListObj[] | null; total?: number }>(config, '/api/fs/list', {
      path: path || '/',
      page,
      per_page: perPage,
      refresh: false,
    })
    const content = data.content || []
    all.push(...content)
    if (content.length < perPage) break
  }
  const parent = (path || '/').replace(/\/+$/, '') || '/'
  return all.map(o => ({
    path: parent === '/' ? `/${o.name}` : `${parent}/${o.name}`,
    name: o.name,
    size: o.size || 0,
    isDir: !!o.is_dir,
    thumb: o.thumb || '',
  }))
}

/** fs/search 响应中的单个节点 */
interface FsSearchNode {
  parent: string
  name: string
  is_dir?: boolean
  size?: number
}

/** 全局搜索(需服务端已建立索引;scope=2 仅搜文件) */
export async function searchFiles(
  config: OpenListConfig,
  keywords: string,
  page = 1,
  perPage = 100,
): Promise<OpenListFileItem[]> {
  const data = await apiCall<{ content: FsSearchNode[] | null }>(config, '/api/fs/search', {
    parent: '/',
    keywords,
    scope: 2,
    page,
    per_page: perPage,
  })
  return (data.content || []).map(n => ({
    path: (n.parent || '/').replace(/\/+$/, '') + `/${n.name}`,
    name: n.name,
    size: n.size || 0,
    isDir: !!n.is_dir,
  }))
}

/** fs/get 获取文件详情 + 直链(related 为同级同前缀名文件,含同名 .lrc 歌词) */
export async function getFile(config: OpenListConfig, path: string): Promise<OpenListFileInfo> {
  const data = await apiCall<{ raw_url?: string; sign?: string; thumb?: string; name?: string; related?: { name: string }[] }>(
    config, '/api/fs/get', { path },
  )
  return {
    rawUrl: data.raw_url || '',
    sign: data.sign || '',
    thumb: data.thumb || '',
    name: data.name || '',
    related: (data.related || []).map(o => o.name),
  }
}

/** 测试连接:登录 + 列根目录,返回根目录条目数 */
export async function testConnection(config: OpenListConfig): Promise<number> {
  const items = await listFiles(config, '/')
  return items.length
}
