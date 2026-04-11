// public/js/ui/widgets/ProfileWallHandler.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';
import { ProfileAPI } from '../../api/ProfileAPI.js';
import { Toast } from '../utils/Toast.js';
import { ProfileRenderer } from '../renderers/ProfileRenderer.js';

export class ProfileWallHandler {
    constructor(stores, targetUsername, isMyProfile) {
        this.stores = stores;
        this.targetUsername = targetUsername;
        this.isMyProfile = isMyProfile;
        
        this.wallInput = document.getElementById('wallInput');
        this.wallSendBtn = document.getElementById('wallSendBtn');
        this.wallList = document.getElementById('wallPostsList');
        
        this.bindEvents();
        this.renderWall(); 
    }

    bindEvents() {
        if (this.wallSendBtn) {
            this.wallSendBtn.addEventListener('click', async () => {
                const content = this.wallInput.value.trim();
                if (!content) return;
                
                this.wallSendBtn.disabled = true;
                const res = await ProfileAPI.addToWall(this.targetUsername, content);
                if (res.success) {
                    this.wallInput.value = '';
                    this.renderWall();
                } else {
                    Toast.show(res.error || 'Ошибка', 'error');
                }
                this.wallSendBtn.disabled = false;
            });
        }

        this.wallList.addEventListener('click', async (e) => {
            const delBtn = e.target.closest('.wall-delete-btn');
            if (delBtn) {
                if (confirm('Удалить запись?')) {
                    const res = await ProfileAPI.deleteFromWall(delBtn.dataset.id);
                    if (res.success) this.renderWall();
                }
                return;
            }

            const replyBtn = e.target.closest('.wall-reply-btn');
            if (replyBtn) {
                const mention = `@${replyBtn.dataset.username}, `;
                this.wallInput.focus();
                if (this.wallInput.value.length > 0 && !this.wallInput.value.endsWith(' ')) {
                    this.wallInput.value += ' ';
                }
                this.wallInput.value += mention;
                return;
            }
        });
    }

    async renderWall() {
        try {
            const wallPosts = await ProfileAPI.getWall(this.targetUsername);
            
            if (wallPosts.length === 0) {
                this.wallList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">На стене пока пусто. Будьте первым!</div>`;
                return;
            }

            this.wallList.innerHTML = wallPosts.map(post => {
                const canDelete = post.author_username === this.stores.auth.user.username || this.isMyProfile || this.stores.auth.user.isAdmin;
                const deleteBtn = canDelete ? `<div class="wall-delete-btn" data-id="${post.id}"><i class="fa-solid fa-trash"></i></div>` : '';
                const verifiedIcon = post.isVerified ? '<i class="fa-solid fa-circle-check" style="color:#1da1f2;font-size:13px;margin-left:4px;"></i>' : '';
                
                const frameStyle = this._getFrameStyle(post.frameId);
                const frameDiv = frameStyle ? `<div style="position:absolute;top:-10%;left:-10%;width:120%;height:120%;pointer-events:none;background-size:contain;background-repeat:no-repeat;background-position:center;border-radius:50%;${frameStyle}"></div>` : '';
                
                const showReply = post.author_username !== this.stores.auth.user.username;
                const replyBtn = showReply ? `<div class="wall-post-actions"><button class="wall-action-btn wall-reply-btn" data-username="${escapeHTML(post.author_username)}"><i class="fa-solid fa-reply"></i> Ответить</button></div>` : '';

                const nameHTML = ProfileRenderer.renderUserName(post.name, post.fontId, this.stores.shop);
                const titleHTML = ProfileRenderer.renderUserTitle(post.titleId, this.stores.shop);

                return `
                    <div class="wall-post">
                        <a href="#/profile/${encodeURIComponent(post.author_username)}" style="position:relative; width:40px; height:40px; flex-shrink:0;">
                            <img src="${post.avatar}" onerror="this.src='https://placehold.co/40x40/333/fff?text=U'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                            ${frameDiv}
                        </a>
                        <div style="flex:1;">
                            <div class="wall-post-header">
                                <a href="#/profile/${encodeURIComponent(post.author_username)}" class="wall-post-name">${nameHTML} ${verifiedIcon}</a>
                                ${titleHTML}
                                <span class="wall-post-date">· ${formatTime(post.timestamp)}</span>
                            </div>
                            <div class="wall-post-content">${parseFormatting(post.content)}</div>
                            ${replyBtn}
                        </div>
                        ${deleteBtn}
                    </div>
                `;
            }).join('');
        } catch (e) { console.error(e); }
    }

    // ИСПРАВЛЕНА СТРОЧКА
    _getFrameStyle(frameId) {
        const frame = this.stores.shop.getItemById(frameId);
        if (!frame) return '';
        if (frame.url) return `background-image: url('${frame.url}');`;
        if (frame.css) return frame.css;
        return '';
    }

    destroy() {}
}