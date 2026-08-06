// 全局状态 — 纯数据,不含 DOM 操作

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
