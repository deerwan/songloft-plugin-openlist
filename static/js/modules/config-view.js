// 视图:服务器管理(Tab 1)
// 职责:渲染服务器列表、服务器下拉选项;不含事件绑定(由 app.js 绑定)

import { fetchServerConfigs } from './api.js';
import { AppState } from './state.js';
import { showSnackbar, escapeHtml } from './ui.js';

/**
 * 加载服务器配置并刷新两处 UI:配置列表卡片 + 浏览页服务器下拉框
 */
export async function loadServerConfigs() {
    try {
        AppState.servers = await fetchServerConfigs();
    } catch (e) {
        AppState.servers = [];
        showSnackbar('加载服务器列表失败:' + e.message, 'error');
    }
    renderServerList();
    renderServerSelectOptions();
}

/**
 * 渲染"已配置的服务器"卡片
 */
export function renderServerList() {
    const container = document.getElementById('serverList');
    if (!AppState.servers.length) {
        container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">dns</span>暂无服务器,请先添加</div>';
        return;
    }

    container.innerHTML = AppState.servers.map(server => `
        <div class="list-item" data-server="${escapeHtml(server.name)}">
            <div class="list-item-icon">
                <span class="material-symbols-outlined">cloud</span>
            </div>
            <div class="list-item-info">
                <div class="list-item-title">${escapeHtml(server.name)}</div>
                <div class="list-item-subtitle">${escapeHtml(server.url)}</div>
            </div>
            <div class="list-item-trailing">
                <button class="btn-icon danger" data-action="delete-server" title="删除">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * 渲染浏览页的服务器下拉选项
 */
export function renderServerSelectOptions() {
    const select = document.getElementById('browserServerSelect');
    const current = select.value;
    select.innerHTML = '<option value="">请选择服务器...</option>' +
        AppState.servers.map(s =>
            `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`
        ).join('');
    // 保持之前的选择(若仍存在)
    if (current && AppState.servers.some(s => s.name === current)) {
        select.value = current;
    }
}

/**
 * 读取"添加服务器"表单
 */
export function readServerForm() {
    return {
        name: document.getElementById('serverName').value.trim(),
        url: document.getElementById('serverUrl').value.trim(),
        username: document.getElementById('serverUsername').value.trim(),
        password: document.getElementById('serverPassword').value,
    };
}

export function clearServerForm() {
    document.getElementById('serverName').value = '';
    document.getElementById('serverUrl').value = '';
    document.getElementById('serverUsername').value = '';
    document.getElementById('serverPassword').value = '';
}
