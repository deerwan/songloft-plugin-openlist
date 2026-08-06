// 视图:文件浏览(Tab 2)
// 职责:目录列表渲染与导航状态更新;事件绑定在 app.js

import { fetchDirectoryItems } from './api.js';
import { AppState, exitSelectMode, clearSelection, getSelectedItems, formatSize } from './state.js';
import { showSnackbar, escapeHtml } from './ui.js';

/**
 * 加载并渲染某个目录
 */
export async function loadDirectory(serverName, path) {
    if (!serverName) return;
    AppState.currentServer = serverName;
    AppState.currentPath = path || '/';
    AppState.loading = true;
    // 切换目录时退出多选,避免选中项与列表不一致
    exitSelectMode();
    updateBrowserChrome();
    renderBrowserLoading();

    try {
        const items = await fetchDirectoryItems(serverName, AppState.currentPath);
        // 防御:加载期间用户可能已切换服务器
        if (AppState.currentServer !== serverName) return;
        AppState.items = sortItems(Array.isArray(items) ? items : []);
    } catch (e) {
        if (AppState.currentServer !== serverName) return;
        AppState.items = [];
        showSnackbar('加载目录失败:' + e.message, 'error');
    } finally {
        if (AppState.currentServer === serverName) {
            AppState.loading = false;
            updateBrowserChrome();
            renderBrowserList();
        }
    }
}

/**
 * 目录优先、名称排序
 */
function sortItems(items) {
    return items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name, 'zh-CN');
    });
}

/**
 * 更新路径显示与返回按钮状态
 */
export function updateBrowserChrome() {
    document.getElementById('browserPathDisplay').textContent = AppState.currentPath;
    document.getElementById('browserUpBtn').disabled =
        !AppState.currentServer || AppState.currentPath === '/';
    const toggleBtn = document.getElementById('toggleSelectModeBtn');
    const hasFiles = AppState.items.some(i => i.type === 'file');
    toggleBtn.style.display = hasFiles ? '' : 'none';
}

function renderBrowserLoading() {
    document.getElementById('browserList').innerHTML =
        '<div class="loading-row"><div class="spinner"></div>正在加载...</div>';
}

/**
 * 渲染当前目录条目列表
 */
export function renderBrowserList() {
    const container = document.getElementById('browserList');

    if (!AppState.currentServer) {
        container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">folder_open</span>请选择服务器进行浏览</div>';
        return;
    }
    if (!AppState.items.length) {
        container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">folder_off</span>此目录为空(或没有音频文件)</div>';
        return;
    }

    container.innerHTML = AppState.items.map(item => {
        const isDir = item.type === 'directory';
        const selected = AppState.selectedIds.has(item.id);
        const icon = isDir ? 'folder' : 'audio_file';
        const subtitle = isDir ? '文件夹' : formatSize(item.size);
        const checkbox = (AppState.selectMode && !isDir)
            ? `<label class="md-checkbox"><input type="checkbox" data-item-id="${escapeHtml(item.id)}" ${selected ? 'checked' : ''}></label>`
            : '';
        const trailing = isDir
            ? '<span class="material-symbols-outlined" style="color:var(--md-on-surface-variant);font-size:20px">chevron_right</span>'
            : checkbox;

        return `
        <div class="list-item clickable ${selected ? 'selected' : ''}" data-item-id="${escapeHtml(item.id)}" data-item-type="${item.type}">
            <div class="list-item-icon ${isDir ? '' : 'file'}">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div class="list-item-info">
                <div class="list-item-title">${escapeHtml(item.name)}</div>
                <div class="list-item-subtitle">${subtitle}</div>
            </div>
            <div class="list-item-trailing">${trailing}</div>
        </div>`;
    }).join('');
}

/**
 * 更新多选操作栏(FAB)显示
 */
export function updateSelectionBar() {
    const fab = document.getElementById('fabContainer');
    const count = getSelectedItems().length;
    if (AppState.selectMode && count > 0) {
        fab.classList.add('show');
        document.getElementById('fabSelectionCount').textContent = `已选 ${count} 项`;
    } else {
        fab.classList.remove('show');
    }
}

/**
 * 进入 / 退出多选模式
 */
export function setSelectMode(enabled) {
    AppState.selectMode = enabled;
    if (!enabled) clearSelection();
    renderBrowserList();
    updateSelectionBar();
    const toggleBtn = document.getElementById('toggleSelectModeBtn');
    toggleBtn.innerHTML = enabled
        ? '<span class="material-symbols-outlined">close</span> 退出多选'
        : '<span class="material-symbols-outlined">checklist</span> 多选';
}
