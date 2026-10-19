/**
 * MiMo-V2.5-TTS Web UI — 音频播放器 & 波形可视化
 *
 * - AudioPlayer：Web Audio 播放内核（现仅用于音色试听按钮）
 * - WaveformPlayer：基于 wavesurfer.js 的结果波形，支持拖动/点击 seek 与 hover 时间浮层
 * - chunksToWavBlob：流式 PCM chunks → WAV Blob（下载/历史用）
 */

'use strict';

class AudioPlayer {
    constructor() {
        this.ctx = null;
        this.buffer = null;
        this.source = null;
        this.gainNode = null;
        this.startTime = 0;
        this.pauseOffset = 0;
        this.isPlaying = false;
        this.duration = 0;
        this.volume = 1;
        this._rafId = null;
        this.onTimeUpdate = null;
        this.onEnded = null;
    }

    /** 确保 AudioContext 已初始化 */
    _ensureCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.ctx.createGain();
            this.gainNode.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /** 从 WAV Blob 加载 */
    async loadFromBlob(blob) {
        this.stop();
        this._ensureCtx();
        const arrayBuf = await blob.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(arrayBuf);
        this.duration = this.buffer.duration;
        this.pauseOffset = 0;
    }

    play() {
        if (!this.buffer) return;
        this._ensureCtx();
        if (this.isPlaying) return;

        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode);
        this.source.onended = () => {
            if (this.isPlaying) {
                this.isPlaying = false;
                this.pauseOffset = 0;
                cancelAnimationFrame(this._rafId);
                if (this.onEnded) this.onEnded();
            }
        };

        this.startTime = this.ctx.currentTime - this.pauseOffset;
        this.source.start(0, this.pauseOffset);
        this.isPlaying = true;
        this._tick();
    }

    pause() {
        if (!this.isPlaying) return;
        this.pauseOffset = this.ctx.currentTime - this.startTime;
        this.source.stop();
        this.source = null;
        this.isPlaying = false;
        cancelAnimationFrame(this._rafId);
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch {}
            this.source = null;
        }
        this.isPlaying = false;
        this.pauseOffset = 0;
        cancelAnimationFrame(this._rafId);
    }

    seek(time) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();
        this.pauseOffset = Math.max(0, Math.min(time, this.duration));
        if (wasPlaying) this.play();
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.gainNode) this.gainNode.gain.value = this.volume;
    }

    getCurrentTime() {
        if (!this.isPlaying) return this.pauseOffset;
        return this.ctx.currentTime - this.startTime;
    }

    getDuration() {
        return this.duration;
    }

    _tick() {
        if (!this.isPlaying) return;
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.getCurrentTime(), this.duration);
        }
        this._rafId = requestAnimationFrame(() => this._tick());
    }

    destroy() {
        this.stop();
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}

function writeStr(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** Float32 声道数据 → 16-bit PCM WAV Blob */
function encodeWav(channels, sampleRate) {
    const numCh = channels.length;
    const len = channels[0].length;
    const bytesPerSample = 2;
    const dataSize = len * numCh * bytesPerSample;

    const buf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buf);

    // RIFF header
    writeStr(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(view, 8, 'WAVE');

    // fmt
    writeStr(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numCh * bytesPerSample, true);
    view.setUint16(32, numCh * bytesPerSample, true);
    view.setUint16(34, 16, true);

    // data
    writeStr(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let pos = 44;
    for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < numCh; ch++) {
            const s = Math.max(-1, Math.min(1, channels[ch][i]));
            view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            pos += 2;
        }
    }

    return new Blob([buf], { type: 'audio/wav' });
}

/** 流式合成的 16-bit PCM chunks（默认 24kHz 单声道）→ WAV Blob */
function chunksToWavBlob(chunks, sampleRate = 24000) {
    let totalLen = 0;
    for (const c of chunks) totalLen += c.byteLength / 2; // 16-bit = 2 bytes

    const float32 = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
        const view = new DataView(c);
        for (let i = 0; i < c.byteLength; i += 2) {
            float32[offset++] = view.getInt16(i, true) / 32768;
        }
    }
    return encodeWav([float32], sampleRate);
}

/**
 * 基于 wavesurfer.js 的结果波形播放器 — 拖动/点击 seek + hover 时间浮层。
 * 接口鸭子类型对齐 AudioPlayer 在面板控制中用到的部分（play/pause/stop/seek/
 * loadFromBlob/getDuration/isPlaying/onTimeUpdate/onEnded），另加 onPlayState
 * （异步播放状态校正）与 reveal()（揭晓生长动效）。
 *
 * wavesurfer 实例惰性创建：首次 loadFromBlob 时输出卡已显示、容器有真实宽度。
 */
class WaveformPlayer {
    constructor(container) {
        this.container = container;
        this.ws = null;
        this.isPlaying = false;
        this.onTimeUpdate = null;
        this.onEnded = null;
        this.onPlayState = null;
        this.onError = null;

        this._themeHandler = () => this._applyTheme();
        window.addEventListener('mx-theme-change', this._themeHandler);
    }

    /** 波形配色 — 与旧自研渲染器一致（仅硬编码于此，不进设计令牌） */
    _themeColors() {
        const isDark = document.documentElement.dataset.theme !== 'light';
        return {
            waveColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            progressColor: isDark ? '#818cf8' : '#6366f1',
            cursorColor: isDark ? '#818cf8' : '#6366f1',
        };
    }

    _initWs() {
        if (this.ws) return;
        this.ws = WaveSurfer.create({
            container: this.container,
            height: 'auto',
            ...this._themeColors(),
            barWidth: 2,
            barGap: 1,
            barRadius: 1,
            barMinHeight: 2,
            cursorWidth: 1,
            dragToSeek: true,
            // 不传颜色选项：浮层交给 CSS ::part(hover-label) 随主题令牌变色
            plugins: [WaveSurfer.Hover.create({ lineWidth: 1 })],
        });

        const emitTime = (t) => {
            if (this.onTimeUpdate) this.onTimeUpdate(t, this.ws.getDuration());
        };
        this.ws.on('timeupdate', emitTime);
        // 暂停态的点击/拖动不触发 timeupdate，靠 interaction（立即）与 seeking 补齐
        this.ws.on('interaction', emitTime);
        this.ws.on('seeking', emitTime);

        this.ws.on('play', () => { this.isPlaying = true; if (this.onPlayState) this.onPlayState(true); });
        this.ws.on('pause', () => { this.isPlaying = false; if (this.onPlayState) this.onPlayState(false); });
        this.ws.on('finish', () => {
            this.ws.stop(); // 播放头归零，与旧 AudioPlayer.onEnded 行为一致
            if (this.onEnded) this.onEnded();
        });
        this.ws.on('error', (err) => {
            console.error('[waveform]', err);
            if (this.onError) this.onError(err && err.message ? err.message : String(err));
        });
    }

    async loadFromBlob(blob) {
        this._initWs();
        this.isPlaying = false;
        try {
            await this.ws.loadBlob(blob);
        } catch (err) {
            // 被更新的加载顶替属预期，静默；其余上抛由调用方提示
            if (err && err.name === 'AbortError') return;
            throw err;
        }
    }

    play() {
        if (!this.ws) return;
        this.isPlaying = true; // 点击路径同步读取；异步事件随后校正
        this.ws.play().catch(() => {
            this.isPlaying = false;
            if (this.onPlayState) this.onPlayState(false);
        });
    }

    pause() {
        if (!this.ws) return;
        this.isPlaying = false;
        this.ws.pause();
    }

    stop() {
        if (!this.ws) return;
        this.isPlaying = false;
        this.ws.stop();
    }

    seek(time) {
        if (!this.ws) return;
        const dur = this.ws.getDuration();
        if (dur > 0) this.ws.setTime(Math.max(0, Math.min(time, dur)));
    }

    getDuration() {
        return this.ws ? this.ws.getDuration() : 0;
    }

    /** 揭晓时刻：容器 clip-path 从左向右生长（450ms easeOutCubic，reduced-motion 由 CSS 白杀） */
    reveal() {
        const el = this.container;
        el.classList.remove('is-revealing');
        void el.offsetWidth; // 强制重排，连续两次合成也能重放动画
        el.classList.add('is-revealing');
    }

    empty() {
        if (this.ws) this.ws.empty();
    }

    _applyTheme() {
        if (this.ws) this.ws.setOptions(this._themeColors());
    }

    destroy() {
        window.removeEventListener('mx-theme-change', this._themeHandler);
        if (this.ws) {
            this.ws.destroy();
            this.ws = null;
        }
    }
}
