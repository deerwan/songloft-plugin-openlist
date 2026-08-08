// 共享类型定义 — 后端各模块与路由层共用

/** 单个 OpenList/AList 服务器配置 */
export interface OpenListConfig {
  /** 配置名称,作为唯一标识(前端展示与 source_data 引用) */
  name: string
  /** 服务器根地址,如 http://192.168.1.10:5244 */
  url: string
  /** 登录用户名(留空尝试游客模式) */
  username?: string
  /** 登录密码 */
  password?: string
}

/** OpenList fs/list、fs/search 返回的文件对象(归一化后) */
export interface OpenListFileItem {
  /** 完整路径,如 /music/album/song.mp3 */
  path: string
  /** 文件名,如 song.mp3 */
  name: string
  size: number
  isDir: boolean
  /** 缩略图 URL(仅 list 返回,可能为空) */
  thumb?: string
}

/** fs/get 返回的直链信息 */
export interface OpenListFileInfo {
  rawUrl: string
  sign: string
  thumb?: string
  name?: string
  /** 同级同前缀名文件名列表(fs/get 的 related 字段,可用于查找同名 .lrc 歌词) */
  related?: string[]
}

/** 主程序识别的音频文件扩展名(与 Songloft 扫描规则保持一致) */
export const AUDIO_EXTENSIONS = [
  'mp3', 'flac', 'wav', 'ape', 'ogg', 'opus',
  'm4a', 'm4b', 'wma', 'aif', 'aiff', 'mka',
]

/** 判断文件名是否为音频文件 */
export function isAudioFile(name: string): boolean {
  const idx = name.lastIndexOf('.')
  if (idx === -1) return false
  const ext = name.substring(idx + 1).toLowerCase()
  return AUDIO_EXTENSIONS.includes(ext)
}

/** 拼接 OpenList 路径,保证以 / 开头且无重复斜杠 */
export function joinPath(parent: string, name: string): string {
  const p = (parent || '/').replace(/\/$/, '')
  return `${p}/${name}`
}

/** 取文件名去掉扩展名 */
export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx > 0 ? name.substring(0, idx) : name
}
