// 视图:迷你播放器(底部播放条)
// 职责:管理单个 <audio> 实例与当前目录播放队列。
// 直链经后端 GET /api/play-url 实时解析(与主程序 music/url 同一套策略),
// 音频流由页面 <audio> 直拉 CDN/OpenList,不经过 QuickJS 沙箱代理。

import { pluginFetch } from './api.js';
import { showSnackbar } from './ui.js';

// 播放队列:开始播放时对当前目录音频文件做快照,
// 之后用户翻目录不影响正在播放的队列
let queue = [];        // [{ id: 完整路径, name: 文件名 }]
let queueServer = '';  // 队列所属服务器配置名
let currentIndex = -1;

// 连续解析失败计数:达到上限停止自动跳下一首,避免坏源死循环
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

const audio = typeof Audio !== 'undefined' ? new Audio() : null;

function els() {
    return {
        bar: document.getElementById('miniPlayer'),
        title: document.getElementById('playerTitle'),
        sub: document.getElementById('playerSub'),
        playBtn: document.getElementById('playerPlayBtn'),
        prevBtn: document.getElementById('playerPrevBtn'),
        nextBtn: document.getElementById('playerNextBtn'),
        closeBtn: document.getElementById('playerCloseBtn'),
        progress: document.getElementById('playerProgress'),
        time: document.getElementById('playerTime'),
    };
}

function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function setPlayIcon(playing) {
    const { playBtn } = els();
    playBtn.innerHTML = `<span class="material-symbols-outlined">${playing ? 'pause' : 'play_arrow'}</span>`;
    playBtn.title = playing ? '暂停' : '播放';
}

/** 副标题行:队列位置 · 服务器 · 播放时间(合并展示,窄屏下省略号截断) */
function setSub(index) {
    const { sub, time } = els();
    const t = time.textContent;
    sub.textContent = `${index + 1}/${queue.length} · ${queueServer}` + (t ? ` · ${t}` : '');
}

function showBar(visible) {
    const { bar } = els();
    bar.classList.toggle('show', visible);
    // 播放条悬浮在底部,给页面内容让出空间避免遮挡列表末尾
    document.body.classList.toggle('player-open', visible);
}

/** 解析并播放队列中指定下标的歌曲 */
async function loadAndPlay(index) {
    if (!audio || index < 0 || index >= queue.length) return;
    const item = queue[index];
    const { title, sub, progress } = els();
    currentIndex = index;
    title.textContent = item.name;
    sub.textContent = `正在解析直链... (${index + 1}/${queue.length})`;
    progress.value = 0;
    setPlayIcon(false);

    try {
        const q = `configName=${encodeURIComponent(queueServer)}&path=${encodeURIComponent(item.id)}`;
        const data = await pluginFetch(`./api/play-url?${q}`);
        // 解析期间用户可能已关闭播放器或切了歌
        if (currentIndex !== index || !els().bar.classList.contains('show')) return;
        audio.src = data.url;
        await audio.play();
        consecutiveErrors = 0;
        // 队列位置与时间由 timeupdate 拼进副标题行(时间不再独占控件)
        setSub(index);
        setPlayIcon(true);
    } catch (e) {
        if (currentIndex !== index) return;
        consecutiveErrors++;
        showSnackbar('播放失败:' + e.message, 'error');
        if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS && index < queue.length - 1) {
            loadAndPlay(index + 1); // 坏源跳过,继续下一首
        } else {
            setPlayIcon(false);
        }
        return;
    }
}

/**
 * 从文件列表开始播放
 * @param {Array<{id:string, name:string}>} files 当前目录音频文件(作为播放队列)
 * @param {string} startId 被点击的文件 id
 * @param {string} serverName 服务器配置名
 */
export function playFromList(files, startId, serverName) {
    if (!audio) {
        showSnackbar('当前环境不支持音频播放', 'error');
        return;
    }
    const idx = files.findIndex(f => f.id === startId);
    if (idx < 0) return;
    queue = files.map(f => ({ id: f.id, name: f.name }));
    queueServer = serverName;
    showBar(true);
    loadAndPlay(idx);
}

export function togglePlay() {
    if (!audio || currentIndex < 0) return;
    if (audio.paused) {
        audio.play().catch(() => setPlayIcon(false));
    } else {
        audio.pause();
    }
}

export function playNext() {
    if (!queue.length) return;
    loadAndPlay((currentIndex + 1) % queue.length);
}

export function playPrev() {
    if (!queue.length) return;
    loadAndPlay((currentIndex - 1 + queue.length) % queue.length);
}

/** 关闭播放器:停播并隐藏播放条 */
export function closePlayer() {
    if (audio) {
        audio.pause();
        audio.removeAttribute('src');
    }
    queue = [];
    currentIndex = -1;
    showBar(false);
}

/**
 * 绑定播放器控件事件(在 app.js bindEvents 中调用一次)
 */
export function initPlayer() {
    if (!audio) return;
    const { playBtn, prevBtn, nextBtn, closeBtn, progress, time } = els();

    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', playPrev);
    nextBtn.addEventListener('click', playNext);
    closeBtn.addEventListener('click', closePlayer);

    // 拖动进度条定位(change 在松手时触发,避免拖动中频繁 seek)
    progress.addEventListener('change', () => {
        if (!audio.duration) return;
        audio.currentTime = (progress.value / 1000) * audio.duration;
    });

    audio.addEventListener('play', () => setPlayIcon(true));
    audio.addEventListener('pause', () => setPlayIcon(false));
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        progress.value = Math.floor((audio.currentTime / audio.duration) * 1000);
        time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        setSub(currentIndex);
    });
    audio.addEventListener('ended', playNext);
    audio.addEventListener('error', () => {
        // src 未设置(关闭播放器)时不报错
        if (currentIndex < 0 || !audio.getAttribute('src')) return;
        consecutiveErrors++;
        showSnackbar('音频加载失败,跳到下一首', 'error');
        if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS && queue.length > 1) {
            loadAndPlay((currentIndex + 1) % queue.length);
        } else {
            setPlayIcon(false);
        }
    });
}
