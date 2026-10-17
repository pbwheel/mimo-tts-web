/**
 * MiMo-V2.5-TTS Web UI — UI 交互组件 (Miuix Console 版)
 *
 * 使用 Miuix Console 框架的组件和设计令牌
 */

'use strict';

const UI = {
    /** Toast 通知 — 使用 MxToast */
    toast(message, type = 'info', duration = 3000) {
        if (typeof MxToast !== 'undefined') {
            MxToast.show({ message, type, duration });
        } else {
            // fallback
            console.log(`[${type}] ${message}`);
        }
    },

    /** 设置按钮 loading 状态（含真实耗时计时；合成按钮同步移动端 Dock） */
    setBtnLoading(btn, loading) {
        const dockBtn = btn.id && btn.id.endsWith('-synthesize-btn')
            ? document.getElementById('dock-synth-btn') : null;
        const setVisual = (target, isLoading) => {
            target.disabled = isLoading;
            target.classList.toggle('loading', isLoading);
            const svg = target.querySelector('svg');
            if (svg) svg.style.display = isLoading ? 'none' : '';
            const sp = target.querySelector('.spinner');
            if (isLoading && !sp) {
                const s = document.createElement('span');
                s.className = 'spinner';
                target.appendChild(s);
            } else if (!isLoading && sp) sp.remove();
        };
        if (loading) {
            const txt = btn.querySelector('.btn-text');
            if (txt) txt.dataset.origText = txt.textContent;
            setVisual(btn, true);
            if (dockBtn) setVisual(dockBtn, true);
            const dtxt = dockBtn ? dockBtn.querySelector('.btn-text') : null;
            const t0 = performance.now();
            if (txt) txt.textContent = '合成中 0.0s';
            if (dtxt) dtxt.textContent = '合成中 0.0s';
            btn._loadingTimer = setInterval(() => {
                if (!btn.isConnected) { clearInterval(btn._loadingTimer); return; }
                const label = `合成中 ${((performance.now() - t0) / 1000).toFixed(1)}s`;
                if (txt) txt.textContent = label;
                if (dtxt) dtxt.textContent = label;
            }, 100);
        } else {
            clearInterval(btn._loadingTimer);
            setVisual(btn, false);
            if (dockBtn) setVisual(dockBtn, false);
            const txt = btn.querySelector('.btn-text');
            if (txt) txt.textContent = txt.dataset.origText || '开始合成';
            if (dockBtn) {
                const dtxt = dockBtn.querySelector('.btn-text');
                if (dtxt) dtxt.textContent = '开始合成';
            }
        }
    },

    /** 渲染音色网格 — 声纹指纹卡片 */
    renderVoiceGrid(voices, selectedId, onSelect, onPreview) {
        const grid = document.getElementById('voice-grid');
        grid.innerHTML = '';
        const genderText = { male: '男声', female: '女声', neutral: '通用' };
        voices.forEach(v => {
            const card = document.createElement('div');
            card.className = `voice-card${v.id === selectedId ? ' selected' : ''}`;
            card.dataset.voiceId = v.id;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-pressed', v.id === selectedId ? 'true' : 'false');
            const fp = Utils.voiceFingerprint(v.id);
            const bars = fp.map((h, i) =>
                `<span style="height:${h}%;animation-delay:${(-i * 0.07).toFixed(2)}s"></span>`
            ).join('');
            card.innerHTML = `
                <button class="voice-preview-btn" data-voice="${v.id}" title="试听">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
                <div class="voice-fp" aria-hidden="true">${bars}</div>
                <div class="voice-card-name">${v.name}</div>
                <div class="voice-card-meta">
                    <span>${genderText[v.gender] || '通用'}</span>
                    <span class="voice-card-badge">${v.language}</span>
                </div>
            `;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.voice-preview-btn')) return;
                onSelect(v.id);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(v.id);
                }
            });
            card.querySelector('.voice-preview-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onPreview(v.id, v.preview_url);
            });
            grid.appendChild(card);
        });
    },

    /** 更新音色选中状态 */
    updateVoiceSelection(selectedId) {
        document.querySelectorAll('.voice-card').forEach(c => {
            const sel = c.dataset.voiceId === selectedId;
            c.classList.toggle('selected', sel);
            c.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
    },

    /** 渲染风格标签 */
    renderStyleTags(containerId, tags, selectedSet, onToggle) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        for (const [category, items] of Object.entries(tags)) {
            const catEl = document.createElement('span');
            catEl.className = 'tag-chip-category';
            catEl.textContent = category;
            container.appendChild(catEl);
            items.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = `tag-chip${selectedSet.has(tag) ? ' selected' : ''}`;
                chip.textContent = tag;
                chip.addEventListener('click', () => onToggle(tag));
                container.appendChild(chip);
            });
        }
    },

    /** 渲染音频标签 */
    renderAudioTags(containerId, tags, onInsert) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        tags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.textContent = tag;
            chip.addEventListener('click', () => onInsert(tag));
            container.appendChild(chip);
        });
    },

    /** 更新标签预览 */
    updateTagsPreview(previewId, selectedSet) {
        const preview = document.getElementById(previewId);
        const textEl = document.getElementById(previewId.replace('-preview', '-preview-text'));
        if (selectedSet.size === 0) {
            preview.classList.add('hidden');
        } else {
            preview.classList.remove('hidden');
            textEl.textContent = `(${[...selectedSet].join(' ')})`;
        }
    },

    /** 渲染参数摘要 */
    renderParamSummary(rowsId, params) {
        const container = document.getElementById(rowsId);
        container.innerHTML = '';
        params.forEach(({ label, value }) => {
            const row = document.createElement('div');
            row.className = 'param-row';
            row.innerHTML = `<span class="param-row-label">${label}</span><span class="param-row-value">${value}</span>`;
            container.appendChild(row);
        });
    },

    /** 初始化 Miuix Tab 切换 */
    initMxTabs(tabsContainer, onSwitch) {
        const tabs = tabsContainer.querySelectorAll('.mx-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (onSwitch) onSwitch(tab.dataset.subtab);
            });
        });
    },

    /** 字数统计绑定 */
    bindCharCount(textareaId, countId) {
        const ta = document.getElementById(textareaId);
        const count = document.getElementById(countId);
        if (!ta || !count) return;
        const update = () => { count.textContent = ta.value.length; };
        ta.addEventListener('input', update);
        update();
    },

    /** 在 textarea 光标位置插入文本 */
    insertAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        textarea.value = val.slice(0, start) + text + val.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
        textarea.dispatchEvent(new Event('input'));
    },

    /** 更新侧边栏 API 状态（待配置用琥珀色提示，不当作错误） */
    updateApiStatus(hasKey) {
        const badge = document.getElementById('sidebar-api-status');
        const settingsBadge = document.getElementById('settings-api-status');
        const mobileBadge = document.getElementById('mobile-api-badge');
        if (badge) {
            badge.className = `mx-badge api-badge ${hasKey ? 'mx-badge-success' : 'mx-badge-warning'}`;
            badge.querySelector('span').textContent = hasKey ? 'API 已连接' : 'API 未配置';
        }
        if (settingsBadge) {
            settingsBadge.className = `mx-badge ${hasKey ? 'mx-badge-success' : 'mx-badge-warning'}`;
            settingsBadge.textContent = hasKey ? '已配置' : '未配置';
        }
        if (mobileBadge) {
            mobileBadge.className = `mx-badge api-badge ${hasKey ? 'mx-badge-success' : 'mx-badge-warning'}`;
            mobileBadge.textContent = hasKey ? 'API 已连接' : 'API 未配置';
        }
    },

    /** 更新页面标题（sub 为该 tab 的真实元信息，由调用方计算） */
    updatePageTitle(tab, sub) {
        const titles = {
            preset: '预置音色合成',
            voicedesign: '音色设计',
            voiceclone: '音色复刻',
            settings: '设置',
        };
        const title = titles[tab] || '';
        document.getElementById('page-title').textContent = title;
        document.getElementById('page-desc').textContent = sub || '';
        document.getElementById('breadcrumb-current').textContent = title;
    },
};
