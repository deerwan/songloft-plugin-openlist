// 通用 UI 工具 — Snackbar、进度对话框、HTML 转义

let snackbarTimer = null;

export function showSnackbar(message, type) {
    const bar = document.getElementById('snackbar');
    bar.textContent = message;
    bar.className = 'snackbar show' + (type ? ' ' + type : '');
    clearTimeout(snackbarTimer);
    snackbarTimer = setTimeout(() => bar.classList.remove('show'), 3000);
}

export function showProgress(title, text) {
    document.getElementById('progressTitle').textContent = title || '正在处理';
    document.getElementById('progressText').textContent = text || '请稍候...';
    document.getElementById('progressDialog').classList.add('show');
}

export function hideProgress() {
    document.getElementById('progressDialog').classList.remove('show');
}

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
