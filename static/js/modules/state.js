// 全局状态 — 纯数据,不含 DOM 操作

// ---------- 本地偏好(localStorage,页面刷新后仍保留) ----------
const PREF_PREFIX = 'openlist_';

export function readPref(key, fallback = '') {
    try {
        return localStorage.getItem(PREF_PREFIX + key) || fallback;
    } catch (_) {
        return fallback;
    }
}

export function writePref(key, value) {
    try {
        localStorage.setItem(PREF_PREFIX + key, String(value));
    } catch (_) { /* webview 禁用 storage 时忽略 */ }
}

export function removePref(key) {
    try {
        localStorage.removeItem(PREF_PREFIX + key);
    } catch (_) { /* 忽略 */ }
}

// 记忆上次浏览的服务器与路径,刷新后自动恢复
export function rememberBrowse(server, path) {
    writePref('last_server', server);
    writePref('last_path', path || '/');
}

export function getRememberedBrowse() {
    return { server: readPref('last_server'), path: readPref('last_path', '/') };
}

export function clearRememberedBrowse() {
    removePref('last_server');
    removePref('last_path');
}

export const AppState = {
    // 已配置的服务器列表 [{ id, name, url }]
    servers: [],
    // 当前浏览的服务器名(空字符串表示未选择)
    currentServer: '',
    // 当前浏览路径
    currentPath: '/',
    // 当前目录条目 [{ id, name, type:'directory'|'file', size, thumb }]
    items: [],
    // 是否处于多选模式
    selectMode: false,
    // 已选中的条目 id(完整路径)集合
    selectedIds: new Set(),
    // 是否正在加载
    loading: false,
    // 浏览视图形态:'list' | 'grid'(持久化到 localStorage)
    viewMode: readPref('view_mode', 'list'),
};

// ---------- 选择操作 ----------
export function toggleItemSelection(itemId) {
    if (AppState.selectedIds.has(itemId)) {
        AppState.selectedIds.delete(itemId);
    } else {
        AppState.selectedIds.add(itemId);
    }
}

export function clearSelection() {
    AppState.selectedIds.clear();
}

export function getSelectedItems() {
    // 只有音频文件可以导入,目录不参与
    return AppState.items.filter(
        i => i.type === 'file' && AppState.selectedIds.has(i.id)
    );
}

export function exitSelectMode() {
    AppState.selectMode = false;
    clearSelection();
}

// ---------- 路径工具 ----------
export function parentPath(path) {
    if (!path || path === '/') return '/';
    const idx = path.lastIndexOf('/');
    if (idx <= 0) return '/';
    return path.substring(0, idx);
}

export function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return size.toFixed(size >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
}
