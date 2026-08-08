// 视图:文件浏览(Tab 2)
// 职责:目录列表渲染与导航状态更新;事件绑定在 app.js

import { fetchDirectoryItems } from './api.js';
import { AppState, exitSelectMode, clearSelection, getSelectedItems, formatSize, rememberBrowse, writePref } from './state.js';
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
        // 加载成功后才记忆浏览位置(避免记住一个已失效的路径)
        rememberBrowse(serverName, AppState.currentPath);
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
    renderBreadcrumb();
    document.getElementById('browserUpBtn').disabled =
        !AppState.currentServer || AppState.currentPath === '/';
    const toggleBtn = document.getElementById('toggleSelectModeBtn');
    const hasFiles = AppState.items.some(i => i.type === 'file');
    toggleBtn.style.display = hasFiles ? '' : 'none';
}

/**
 * 把当前路径渲染成可点击的面包屑,一步跳回任意上层目录
 */
function renderBreadcrumb() {
    const el = document.getElementById('browserPathDisplay');
    const path = AppState.currentPath || '/';
    const segs = path.split('/').filter(Boolean);
    const parts = [];

    // 根目录段(当前就在根目录时不可点)
    parts.push(`<span class="breadcrumb-seg root ${segs.length ? '' : 'current'}" data-path="/">根目录</span>`);

    let acc = '';
    segs.forEach((seg, i) => {
        acc += '/' + seg;
        const isLast = i === segs.length - 1;
        parts.push('<span class="breadcrumb-sep">/</span>');
        parts.push(isLast
            ? `<span class="breadcrumb-seg current">${escapeHtml(seg)}</span>`
            : `<span class="breadcrumb-seg" data-path="${escapeHtml(acc)}">${escapeHtml(seg)}</span>`);
    });

    el.innerHTML = parts.join('');
    // 滚到最右,保证当前层级始终可见
    el.scrollLeft = el.scrollWidth;
}

function renderBrowserLoading() {
    const container = document.getElementById('browserList');
    container.classList.remove('grid-view');
    container.innerHTML =
        '<div class="loading-row"><div class="spinner"></div>正在加载...</div>';
}

/**
 * 渲染当前目录条目列表(列表 / 网格两种形态)
 */
export function renderBrowserList() {
    const container = document.getElementById('browserList');
    const isGrid = AppState.viewMode === 'grid';

    if (!AppState.currentServer) {
        container.classList.remove('grid-view');
        container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">folder_open</span>请选择服务器进行浏览</div>';
        return;
    }
    if (!AppState.items.length) {
        container.classList.remove('grid-view');
        container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">folder_off</span>此目录为空(或没有音频文件)</div>';
        return;
    }

    container.classList.toggle('grid-view', isGrid);

    container.innerHTML = AppState.items.map(item => {
        const isDir = item.type === 'directory';
        const selected = AppState.selectedIds.has(item.id);
        const icon = isDir ? 'folder' : 'audio_file';
        const subtitle = isDir ? '文件夹' : formatSize(item.size);
        const checkbox = (AppState.selectMode && !isDir)
            ? `<label class="md-checkbox ${isGrid ? 'grid-checkbox' : ''}"><input type="checkbox" data-item-id="${escapeHtml(item.id)}" ${selected ? 'checked' : ''}></label>`
            : '';

        if (isGrid) {
            return `
        <div class="grid-item clickable ${selected ? 'selected' : ''}" data-item-id="${escapeHtml(item.id)}" data-item-type="${item.type}">
            ${checkbox}
            <div class="grid-item-icon ${isDir ? '' : 'file'}">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div class="grid-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="grid-item-sub">${subtitle}</div>
        </div>`;
        }

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
    // 多选模式下始终展示操作栏(即使未选中,方便使用「全选本页」)
    if (AppState.selectMode) {
        fab.classList.add('show');
        document.getElementById('fabSelectionCount').textContent = `已选 ${count} 项`;
        updateSelectAllButton();
    } else {
        fab.classList.remove('show');
    }
}

/**
 * 刷新 FAB 内「全选本页 / 取消全选」按钮的文案
 */
export function updateSelectAllButton() {
    const btn = document.getElementById('fabSelectAllBtn');
    if (!btn) return;
    const files = AppState.items.filter(i => i.type === 'file');
    const allSelected = files.length > 0 && files.every(f => AppState.selectedIds.has(f.id));
    btn.innerHTML = allSelected
        ? '<span class="material-symbols-outlined" style="font-size:18px;">deselect</span> 取消全选'
        : '<span class="material-symbols-outlined" style="font-size:18px;">select_all</span> 全选本页';
}

/**
 * 全选/取消全选本页音频文件(自动过滤目录)
 */
export function toggleSelectAll() {
    const files = AppState.items.filter(i => i.type === 'file');
    if (!files.length) return;
    const allSelected = files.every(f => AppState.selectedIds.has(f.id));
    if (allSelected) {
        files.forEach(f => AppState.selectedIds.delete(f.id));
    } else {
        files.forEach(f => AppState.selectedIds.add(f.id));
    }
    renderBrowserList();
    updateSelectionBar();
}

/**
 * 进入 / 退出多选模式
 */
export function setSelectMode(enabled) {
    AppState.selectMode = enabled;
    if (!enabled) clearSelection();
    // 顶部多选操作条吸顶时,浏览页内容相应下移(CSS #tab-browser.select-mode)
    document.getElementById('tab-browser').classList.toggle('select-mode', enabled);
    renderBrowserList();
    updateSelectionBar();
    const toggleBtn = document.getElementById('toggleSelectModeBtn');
    toggleBtn.innerHTML = enabled
        ? '<span class="material-symbols-outlined">close</span> 退出多选'
        : '<span class="material-symbols-outlined">checklist</span> 多选';
}

/**
 * 切换列表 / 网格视图(持久化)
 */
export function setViewMode(mode) {
    AppState.viewMode = mode === 'grid' ? 'grid' : 'list';
    writePref('view_mode', AppState.viewMode);
    renderBrowserList();
    updateViewToggleBtn();
}

/**
 * 同步视图切换按钮的图标与提示
 */
export function updateViewToggleBtn() {
    const btn = document.getElementById('viewToggleBtn');
    if (!btn) return;
    const toGrid = AppState.viewMode !== 'grid';
    btn.innerHTML = `<span class="material-symbols-outlined">${toGrid ? 'grid_view' : 'view_list'}</span>`;
    btn.title = toGrid ? '切换到网格视图' : '切换到列表视图';
}
