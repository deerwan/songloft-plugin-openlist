// 应用入口 — Tab 切换、事件绑定与导入流程
// 由 builder 以本文件为入口,将 modules/ 下的模块一并打包为 app.bundle.js

import {
    addServerConfig, deleteServerConfig, testServerConnection,
    submitRemoteSongs, fetchPlaylists, createPlaylist, addSongsToPlaylist,
} from './modules/api.js';
import { AppState, toggleItemSelection, getSelectedItems, parentPath } from './modules/state.js';
import { showSnackbar, showProgress, hideProgress, escapeHtml } from './modules/ui.js';
import { loadServerConfigs, readServerForm, clearServerForm } from './modules/config-view.js';
import { loadDirectory, renderBrowserList, updateBrowserChrome, updateSelectionBar, setSelectMode } from './modules/browser-view.js';

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
    // 文件:多选模式下切换选中;否则提示进入多选
    if (AppState.selectMode) {
        toggleItemSelection(itemId);
        renderBrowserList();
        updateSelectionBar();
    } else {
        showSnackbar('点击右上角「多选」以导入歌曲');
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
    // Tab Bar
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // AppBar 刷新
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadServerConfigs();
        if (AppState.currentServer) {
            loadDirectory(AppState.currentServer, AppState.currentPath);
        }
        showSnackbar('已刷新');
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

    // 浏览页:服务器切换
    document.getElementById('browserServerSelect').addEventListener('change', e => {
        const name = e.target.value;
        if (name) loadDirectory(name, '/');
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

    // 浏览页:条目点击与复选框(事件委托)
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
        const row = e.target.closest('.list-item[data-item-id]');
        if (row) handleItemClick(row.dataset.itemId, row.dataset.itemType);
    });

    // FAB 多选操作栏
    document.getElementById('fabCancelBtn').addEventListener('click', () => setSelectMode(false));
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
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadServerConfigs();
});
