// 应用入口 — Tab 切换、事件绑定与导入流程
// 由 builder 以本文件为入口,将 modules/ 下的模块一并打包为 app.bundle.js

import {
    addServerConfig, deleteServerConfig, testServerConnection,
    submitRemoteSongs, fetchPlaylists, createPlaylist, addSongsToPlaylist,
} from './modules/api.js';
import { AppState, toggleItemSelection, getSelectedItems, parentPath, getRememberedBrowse, clearRememberedBrowse } from './modules/state.js';
import { showSnackbar, showProgress, hideProgress, escapeHtml } from './modules/ui.js';
import { loadServerConfigs, readServerForm, clearServerForm } from './modules/config-view.js';
import {
    loadDirectory, renderBrowserList, updateBrowserChrome, updateSelectionBar, setSelectMode,
    setViewMode, updateViewToggleBtn, toggleSelectAll,
} from './modules/browser-view.js';
import { initPlayer, playFromList } from './modules/player.js';

// ---------- Tab 切换 ----------
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    const content = document.getElementById('tab-' + tabId);
    if (content) content.classList.add('active');
    const tabBtn = document.querySelector(`.tab-item[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
}

// ---------- 服务器管理动作 ----------
async function handleAddServer() {
    const form = readServerForm();
    if (!form.name) return showSnackbar('请填写配置名称', 'warning');
    if (!form.url) return showSnackbar('请填写服务器地址', 'warning');
    if (!/^https?:\/\//i.test(form.url)) return showSnackbar('地址须以 http:// 或 https:// 开头', 'warning');

    const btn = document.getElementById('addServerBtn');
    btn.disabled = true;
    try {
        await addServerConfig(form);
        clearServerForm();
        await loadServerConfigs();
        showSnackbar('服务器已保存', 'success');
    } catch (e) {
        showSnackbar('保存失败:' + e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function handleTestServer() {
    const form = readServerForm();
    if (!form.url) return showSnackbar('请先填写服务器地址', 'warning');

    const btn = document.getElementById('testServerBtn');
    btn.disabled = true;
    try {
        const result = await testServerConnection(form);
        if (result.success) {
            showSnackbar(`连接成功,根目录共 ${result.count} 项`, 'success');
        } else if (result.error && /guest user is disabled/i.test(result.error)) {
            showSnackbar('该服务器未开放游客访问,请填写用户名和密码', 'error');
        } else {
            showSnackbar('连接失败:' + (result.error || '未知错误'), 'error');
        }
    } catch (e) {
        showSnackbar('连接失败:' + e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function handleDeleteServer(serverName) {
    if (!confirm(`确定删除服务器「${serverName}」?\n已入库的歌曲将无法播放。`)) return;
    try {
        await deleteServerConfig(serverName);
        // 若正在浏览该服务器,清空浏览状态
        if (AppState.currentServer === serverName) {
            AppState.currentServer = '';
            AppState.currentPath = '/';
            AppState.items = [];
            renderBrowserList();
            updateBrowserChrome();
        }
        // 清除指向已删服务器的记忆,避免下次启动恢复到不存在的服务器
        if (getRememberedBrowse().server === serverName) clearRememberedBrowse();
        await loadServerConfigs();
        showSnackbar('已删除', 'success');
    } catch (e) {
        showSnackbar('删除失败:' + e.message, 'error');
    }
}

// ---------- 浏览动作 ----------
function handleItemClick(itemId, itemType) {
    if (itemType === 'directory') {
        loadDirectory(AppState.currentServer, itemId);
        return;
    }
    // 文件:多选模式下切换选中;否则直接播放(队列=当前目录全部音频)
    if (AppState.selectMode) {
        toggleItemSelection(itemId);
        renderBrowserList();
        updateSelectionBar();
    } else {
        const files = AppState.items.filter(i => i.type === 'file');
        playFromList(files, itemId, AppState.currentServer);
    }
}

// ---------- 导入流程 ----------
async function handleDirectImport() {
    const items = getSelectedItems();
    if (!items.length) return showSnackbar('请先选择音频文件', 'warning');

    showProgress('正在入库', `共 ${items.length} 首歌曲...`);
    try {
        const songs = await submitRemoteSongs(items, AppState.currentServer);
        hideProgress();
        showSnackbar(`成功入库 ${songs.length} 首歌曲`, 'success');
        setSelectMode(false);
    } catch (e) {
        hideProgress();
        showSnackbar('入库失败:' + e.message, 'error');
    }
}

async function openPlaylistDialog() {
    const items = getSelectedItems();
    if (!items.length) return showSnackbar('请先选择音频文件', 'warning');

    const select = document.getElementById('playlistTarget');
    select.disabled = true;
    select.innerHTML = '<option value="__new__">新建歌单</option>';
    document.getElementById('playlistDialog').classList.add('show');

    try {
        const playlists = await fetchPlaylists();
        select.innerHTML = '<option value="__new__">新建歌单</option>' +
            playlists.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    } catch (e) {
        showSnackbar('加载歌单失败:' + e.message, 'error');
    } finally {
        select.disabled = false;
    }
}

async function handleConfirmPlaylist() {
    const items = getSelectedItems();
    const target = document.getElementById('playlistTarget');
    const isNew = target.value === '__new__';
    const name = document.getElementById('playlistName').value.trim();

    if (isNew && !name) return showSnackbar('请输入歌单名称', 'warning');

    document.getElementById('playlistDialog').classList.remove('show');
    showProgress('正在导入', `共 ${items.length} 首歌曲...`);
    try {
        const songs = await submitRemoteSongs(items, AppState.currentServer);
        const songIds = songs.map(s => s.id);
        let playlistId = target.value;
        if (isNew) {
            playlistId = await createPlaylist(name);
        }
        await addSongsToPlaylist(playlistId, songIds);
        hideProgress();
        showSnackbar(`已导入 ${songIds.length} 首歌曲到歌单`, 'success');
        setSelectMode(false);
    } catch (e) {
        hideProgress();
        showSnackbar('导入失败:' + e.message, 'error');
    }
}

// ---------- 事件绑定 ----------
function bindEvents() {
    // 迷你播放器控件
    initPlayer();

    // Tab Bar
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // AppBar 刷新:保留正在浏览的服务器与路径,仅当该服务器已不存在时才清空
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadServerConfigs();
        if (AppState.currentServer) {
            if (AppState.servers.some(s => s.name === AppState.currentServer)) {
                // 服务器仍存在:原地重载当前目录
                loadDirectory(AppState.currentServer, AppState.currentPath);
            } else {
                // 服务器已被删除:重置浏览状态
                AppState.currentServer = '';
                AppState.currentPath = '/';
                AppState.items = [];
                renderBrowserList();
                updateBrowserChrome();
                clearRememberedBrowse();
            }
        }
        showSnackbar('已刷新');
    });

    // 视图切换(列表 / 网格)
    document.getElementById('viewToggleBtn').addEventListener('click', () => {
        setViewMode(AppState.viewMode === 'grid' ? 'list' : 'grid');
    });

    // 面包屑导航:点击任意分段跳到对应目录
    document.getElementById('browserPathDisplay').addEventListener('click', e => {
        const seg = e.target.closest('.breadcrumb-seg[data-path]');
        if (!seg || seg.classList.contains('current')) return;
        if (AppState.currentServer) {
            loadDirectory(AppState.currentServer, seg.dataset.path);
        }
    });

    // 服务器管理
    document.getElementById('addServerBtn').addEventListener('click', handleAddServer);
    document.getElementById('testServerBtn').addEventListener('click', handleTestServer);

    // 服务器列表:删除按钮(事件委托)
    document.getElementById('serverList').addEventListener('click', e => {
        const btn = e.target.closest('[data-action="delete-server"]');
        if (!btn) return;
        const row = btn.closest('[data-server]');
        if (row) handleDeleteServer(row.dataset.server);
    });

    // 服务器管理页:浏览服务器下拉选择,选定后直接切到浏览页
    document.getElementById('browseServerSelect').addEventListener('change', e => {
        const name = e.target.value;
        if (!name) return;
        switchTab('browser');
        loadDirectory(name, '/');
    });

    // 浏览页:返回上一级
    document.getElementById('browserUpBtn').addEventListener('click', () => {
        if (AppState.currentPath !== '/') {
            loadDirectory(AppState.currentServer, parentPath(AppState.currentPath));
        }
    });

    // 浏览页:多选开关
    document.getElementById('toggleSelectModeBtn').addEventListener('click', () => {
        setSelectMode(!AppState.selectMode);
    });

    // 浏览页:条目点击与复选框(事件委托,兼容列表与网格两种形态)
    const browserList = document.getElementById('browserList');
    browserList.addEventListener('click', e => {
        const checkbox = e.target.closest('input[type="checkbox"]');
        if (checkbox) {
            e.stopPropagation();
            toggleItemSelection(checkbox.dataset.itemId);
            renderBrowserList();
            updateSelectionBar();
            return;
        }
        const row = e.target.closest('[data-item-id][data-item-type]');
        if (row) handleItemClick(row.dataset.itemId, row.dataset.itemType);
    });

    // FAB 多选操作栏
    document.getElementById('fabCancelBtn').addEventListener('click', () => setSelectMode(false));
    document.getElementById('fabSelectAllBtn').addEventListener('click', toggleSelectAll);
    document.getElementById('fabImportBtn').addEventListener('click', handleDirectImport);
    document.getElementById('fabPlaylistBtn').addEventListener('click', openPlaylistDialog);

    // 歌单对话框
    document.getElementById('cancelPlaylistBtn').addEventListener('click', () => {
        document.getElementById('playlistDialog').classList.remove('show');
    });
    document.getElementById('confirmPlaylistBtn').addEventListener('click', handleConfirmPlaylist);
    document.getElementById('playlistTarget').addEventListener('change', e => {
        const isNew = e.target.value === '__new__';
        document.getElementById('playlistNameGroup').style.display = isNew ? '' : 'none';
    });
}

// ---------- 启动 ----------
document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    updateViewToggleBtn();
    await loadServerConfigs();
    await restoreLastBrowse();
    // 只有一台服务器且无浏览记忆时直接加载,免去手动选择步骤
    if (!AppState.currentServer && AppState.servers.length === 1) {
        loadDirectory(AppState.servers[0].name, '/');
    }
});

/**
 * 恢复上次浏览的服务器与路径(记忆功能):
 * 仅当记忆的服务器仍存在时才自动加载,否则静默忽略。
 */
async function restoreLastBrowse() {
    const remembered = getRememberedBrowse();
    if (!remembered.server) return;
    if (!AppState.servers.some(s => s.name === remembered.server)) {
        clearRememberedBrowse();
        return;
    }
    await loadDirectory(remembered.server, remembered.path || '/');
}
