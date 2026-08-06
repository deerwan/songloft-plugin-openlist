// API 层 — 所有网络请求集中在此文件
// 分两类:
//   1. 插件自身路由(相对路径,由插件后端处理)
//   2. 主程序 Core API(window.location.origin + /api/v1/...,需 Bearer 认证)

// ---------- 认证 ----------
export function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const token = SongloftPlugin.getAuthToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
    } catch (_) { /* 非宿主环境调试时忽略 */ }
    return headers;
}

// ---------- 插件自身路由 ----------
// 主程序对 /api/v1/jsplugin/* 路由要求 Bearer 认证,必须携带认证头,否则 401
export async function pluginFetch(path, options) {
    const opts = options || {};
    opts.headers = Object.assign({}, getAuthHeaders(), opts.headers || {});
    const res = await fetch(path, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = text; }
    if (!res.ok) {
        const msg = (data && data.error) ? data.error : `请求失败 (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

// 服务器配置 CRUD
export function fetchServerConfigs() {
    return pluginFetch('./lists');
}

export function addServerConfig(config) {
    return pluginFetch('./lists', {
        method: 'POST',
        body: JSON.stringify(config)
    });
}

export function deleteServerConfig(name) {
    return pluginFetch('./lists/' + encodeURIComponent(name), { method: 'DELETE' });
}

export function testServerConnection(config) {
    return pluginFetch('./test', {
        method: 'POST',
        body: JSON.stringify(config)
    });
}

// 目录浏览
export function fetchDirectoryItems(serverName, path) {
    const q = 'path=' + encodeURIComponent(path || '/');
    return pluginFetch(`./lists/${encodeURIComponent(serverName)}/items?${q}`);
}

// ---------- 主程序 Core API ----------

/**
 * 解析文件名元数据:支持 "歌手 - 歌名" 格式,其余情况歌名即全部文件名
 */
function parseTrackName(fileName) {
    const base = fileName.replace(/\.[^.]+$/, '').trim();
    const m = base.match(/^(.+?)\s*-\s*(.+)$/);
    if (m) return { artist: m[1].trim(), title: m[2].trim() };
    return { artist: '', title: base };
}

/**
 * 批量导入远程歌曲
 * @param {Array<{name:string, path:string, size:number}>} items
 * @param {string} serverName 配置名
 * @returns {Promise<Array<{id:string}>>} 入库后的歌曲 ID 列表
 */
export async function submitRemoteSongs(items, serverName) {
    const reqs = items.map(item => {
        const meta = parseTrackName(item.name);
        return {
            title: meta.title,
            artist: meta.artist || serverName,
            album: '',
            cover_url: '',
            duration: 0,
            plugin_entry_path: 'openlist',
            source_data: JSON.stringify({ configName: serverName, path: item.path }),
            dedup_key: `openlist_${serverName}_${item.path}`
        };
    });

    const res = await fetch(window.location.origin + '/api/v1/songs/remote', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(reqs)
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return Array.isArray(data.songs) ? data.songs : [];
}

// 拉取全部普通歌单(分页)
export async function fetchPlaylists() {
    const playlists = [];
    const limit = 100;
    let offset = 0;

    for (;;) {
        const res = await fetch(
            window.location.origin + `/api/v1/playlists?type=normal&limit=${limit}&offset=${offset}`,
            { headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const page = Array.isArray(data.playlists) ? data.playlists : [];
        playlists.push(...page);
        offset += page.length;
        if (page.length < limit) break;
    }
    return playlists;
}

// 创建歌单
export async function createPlaylist(name) {
    const res = await fetch(window.location.origin + '/api/v1/playlists', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description: 'Imported from OpenList', type: 'normal' })
    });
    if (!res.ok) throw new Error('创建歌单失败');
    const playlist = await res.json();
    return playlist.id;
}

// 向歌单添加歌曲
export async function addSongsToPlaylist(playlistId, songIds) {
    if (!songIds.length) return;
    const res = await fetch(window.location.origin + `/api/v1/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ song_ids: songIds })
    });
    if (!res.ok) throw new Error('添加歌曲到歌单失败');
}
