import { escapeHTML } from './utils.js';

export class ProfileUIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentUser = this.dataManager.getProfileData();

        this.avatarImg = document.getElementById('avatarImage');
        this.bannerImg = document.getElementById('bannerImage');
        this.avatarInput = document.getElementById('avatarInput');
        this.bannerInput = document.getElementById('bannerInput');
        this.bioTextarea = document.getElementById('bioTextarea');
        this.telegramInput = document.getElementById('telegramInput');
        this.githubInput = document.getElementById('githubInput');
        this.saveBtn = document.getElementById('saveProfileBtn');
        
        this.musicInput = document.getElementById('musicInput');
        this.playMusicBtn = document.getElementById('playMusicBtn');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.musicTrackName = document.getElementById('musicTrackName');

        this.postsContainer = document.getElementById('profilePostsContainer');
        this.input = document.getElementById('postInput');
        this.publishBtn = document.getElementById('publishBtn');
        this.togglePollBtn = document.getElementById('togglePollBtn');
        this.pollCreator = document.getElementById('pollCreator');
        this.closePollBtn = document.getElementById('closePollBtn');
        this.pollInputsContainer = document.getElementById('pollInputs');
        this.addOptionBtn = document.getElementById('addOptionBtn');
        
        this.isPollActive = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingPostId = null;

        this.createGlobalContextMenu();
        this.initEventListeners();
        this.loadProfileData();
        this.renderProfileFeed(); 
    }

    createGlobalContextMenu() {
        let menu = document.getElementById('customContextMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'customContextMenu';
            menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
            document.body.appendChild(menu);

            document.getElementById('ctxDeleteComment').addEventListener('click', () => {
                if (this.contextTargetPostId && this.contextTargetCommentId) {
                    this.dataManager.deleteComment(this.contextTargetPostId, this.contextTargetCommentId);
                    this.rerenderComments(this.contextTargetPostId);
                    this.contextMenu.style.display = 'none';
                }
            });

            document.addEventListener('click', () => { this.contextMenu.style.display = 'none'; });
            document.addEventListener('scroll', () => { this.contextMenu.style.display = 'none'; }, true);
        }
        this.contextMenu = menu;
        this.contextTargetCommentId = null;
        this.contextTargetPostId = null;
    }

    loadProfileData() {
        const profile = this.dataManager.getProfileData();
        this.avatarImg.src = profile.avatar;
        this.bannerImg.src = profile.banner;
        this.bioTextarea.value = profile.bio;
        this.telegramInput.value = profile.socials.telegram;
        this.githubInput.value = profile.socials.github;
        this.musicTrackName.textContent = profile.music.name;
        if(profile.music.data) this.audioPlayer.src = profile.music.data;
    }

    initEventListeners() {
        this.avatarInput.addEventListener('change', e => this.previewFile(e.target.files, this.avatarImg));
        this.bannerInput.addEventListener('change', e => this.previewFile(e.target.files, this.bannerImg));
        this.musicInput.addEventListener('change', e => this.handleMusicUpload(e.target.files));
        this.saveBtn.addEventListener('click', () => this.saveProfile());
        this.playMusicBtn.addEventListener('click', () => this.toggleMusic());

        this.togglePollBtn.addEventListener('click', () => this.togglePoll());
        this.closePollBtn.addEventListener('click', () => this.closePoll());
        this.addOptionBtn.addEventListener('click', () => this.addPollOption());
        this.input.addEventListener('input', () => this.checkPublishState());
        this.pollInputsContainer.addEventListener('input', () => this.checkPublishState());
        
        this.publishBtn.addEventListener('click', () => {
            const text = this.input.value.trim();
            let pollData = null;
            if (this.isPollActive) {
                const options = Array.from(this.pollInputsContainer.querySelectorAll('.poll-input')).map(i => i.value.trim()).filter(v => v !== '');
                if (options.length >= 2) pollData = { options, duration: parseInt(document.getElementById('pollDuration').value) };
            }
            if (text.length > 0 || pollData) {
                this.dataManager.addPost(text, pollData);
                this.input.value = ''; this.closePoll(); 
                this.renderProfileFeed();
            }
        });

        this.postsContainer.addEventListener('contextmenu', (e) => {
            const commentItem = e.target.closest('.comment-item');
            if (commentItem) {
                const authorUsername = commentItem.dataset.author;
                const currentUser = this.dataManager.getProfileData();
                if (authorUsername === currentUser.username) {
                    e.preventDefault();
                    this.contextTargetCommentId = commentItem.dataset.id;
                    this.contextTargetPostId = commentItem.dataset.postId;
                    this.contextMenu.style.display = 'block';
                    this.contextMenu.style.top = `${e.pageY}px`;
                    this.contextMenu.style.left = `${e.pageX}px`;
                }
            }
        });

        this.postsContainer.addEventListener('click', (e) => {
            const target = e.target;
            
            const commentBtn = target.closest('.action-btn-comment');
            if (commentBtn) { document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('active'); return; }

            const sendCommentBtn = target.closest('.send-comment-btn');
            if (sendCommentBtn) {
                const postId = sendCommentBtn.dataset.id;
                const input = document.getElementById(`comment-input-${postId}`);
                if (input.value.trim()) {
                    this.dataManager.addComment(postId, input.value.trim(), 'text');
                    input.value = '';
                    this.rerenderComments(postId);
                }
                return;
            }

            const reactionBtn = target.closest('.comment-action-btn');
            if (reactionBtn) {
                this.dataManager.toggleCommentReaction(reactionBtn.dataset.postId, reactionBtn.dataset.id, reactionBtn.dataset.type);
                this.rerenderComments(reactionBtn.dataset.postId);
                return;
            }

            const recordBtn = target.closest('.record-btn');
            if (recordBtn) {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') this.stopRecording(recordBtn);
                else this.startRecording(recordBtn.dataset.id, recordBtn);
                return;
            }

            const playAudioBtn = target.closest('.audio-control-btn');
            if (playAudioBtn) {
                const audio = playAudioBtn.nextElementSibling;
                const progressBar = playAudioBtn.parentElement.querySelector('.wave-progress'); 
                if (audio.paused) {
                    document.querySelectorAll('audio').forEach(a => { if(a!==audio && a.id!=='audioPlayer'){a.pause();a.currentTime=0;}});
                    audio.play();
                    playAudioBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    audio.ontimeupdate = () => progressBar.style.width = `${(audio.currentTime/audio.duration)*100}%`;
                    audio.onended = () => { playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; progressBar.style.width='0%'; };
                } else {
                    audio.pause(); playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                }
                return;
            }
            
            const optionsBtn = target.closest('.post-options-btn');
            if (optionsBtn) {
                const menu = optionsBtn.nextElementSibling;
                document.querySelectorAll('.options-menu.active').forEach(m => { if(m!==menu) m.classList.remove('active'); });
                menu.classList.toggle('active');
                return;
            }
            
            const deleteBtn = target.closest('.delete-post-btn');
            if (deleteBtn) {
                if (confirm('Удалить этот пост?')) {
                    this.dataManager.deletePost(deleteBtn.dataset.id);
                    const postArticle = deleteBtn.closest('.post');
                    if (postArticle) {
                        postArticle.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        postArticle.style.opacity = '0';
                        postArticle.style.transform = 'scale(0.95)';
                        setTimeout(() => postArticle.remove(), 300);
                    }
                }
                return;
            }

            const visibilityBtn = target.closest('.toggle-visibility-btn');
            if (visibilityBtn) {
                const updatedPost = this.dataManager.togglePostVisibility(visibilityBtn.dataset.id);
                if (updatedPost) {
                    const isPrivate = updatedPost.visibility === 'private';
                    const icon = visibilityBtn.querySelector('i');
                    const span = visibilityBtn.querySelector('span');
                    icon.className = `fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}`;
                    span.textContent = isPrivate ? 'Сделать публичным' : 'Скрыть для всех';
                    const postArticle = visibilityBtn.closest('.post');
                    if (postArticle) postArticle.classList.toggle('private-post', isPrivate);
                }
                return;
            }

            const likeBtn = target.closest('.like-btn');
            if (likeBtn) {
                const updatedPost = this.dataManager.toggleLike(likeBtn.dataset.id);
                if (updatedPost) {
                    likeBtn.classList.toggle('liked', updatedPost.isLiked); 
                    const icon = likeBtn.querySelector('i'); const span = likeBtn.querySelector('span');
                    icon.className = `fa-${updatedPost.isLiked ? 'solid' : 'regular'} fa-heart`;
                    span.textContent = updatedPost.likes;
                }
                return;
            }

            const voteBtn = target.closest('.poll-vote-btn');
            if (voteBtn) {
                this.dataManager.votePoll(voteBtn.dataset.postId, voteBtn.dataset.optionId);
                this.renderProfileFeed();
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.post-options-btn') && !e.target.closest('.options-menu')) {
                document.querySelectorAll('.options-menu.active').forEach(m => m.classList.remove('active'));
            }
        });
    }

    previewFile(file, imgElement) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => imgElement.src = e.target.result;
        reader.readAsDataURL(file);
    }
    handleMusicUpload(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { this.audioPlayer.src = e.target.result; this.musicTrackName.textContent = file.name; };
        reader.readAsDataURL(file);
    }
    toggleMusic() {
        const icon = this.playMusicBtn.querySelector('i');
        if (this.audioPlayer.paused) { this.audioPlayer.play(); icon.classList.remove('fa-play'); icon.classList.add('fa-pause'); }
        else { this.audioPlayer.pause(); icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
    }
    saveProfile() {
        const newData = {
            bio: this.bioTextarea.value, avatar: this.avatarImg.src, banner: this.bannerImg.src,
            music: { name: this.musicTrackName.textContent, data: this.audioPlayer.src },
            socials: { telegram: this.telegramInput.value, github: this.githubInput.value }
        };
        this.dataManager.saveProfileData(newData);
        alert('Профиль сохранен!');
    }

    async startRecording(postId, btn) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.recordingPostId = postId;
            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
                const waveform = await this.analyzeAudioWaveform(audioBlob);
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    this.dataManager.addComment(this.recordingPostId, reader.result, 'audio', waveform);
                    this.rerenderComments(this.recordingPostId);
                };
                stream.getTracks().forEach(track => track.stop());
            };
            this.mediaRecorder.start();
            btn.classList.add('recording');
        } catch (err) { alert('Нужен микрофон!'); console.error(err); }
    }
    
    async analyzeAudioWaveform(audioBlob) {
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);
            const samples = 20;
            const blockSize = Math.floor(rawData.length / samples);
            const waveform = [];

            for (let i = 0; i < samples; i++) {
                let max = 0;
                for (let j = 0; j < blockSize; j++) {
                    if (Math.abs(rawData[i * blockSize + j]) > max) {
                        max = Math.abs(rawData[i * blockSize + j]);
                    }
                }
                let percent = Math.round(max * 100);
                if (percent < 15) percent = 15;
                if (percent > 100) percent = 100;
                waveform.push(percent);
            }
            return waveform;
        } catch (e) {
            console.error("Ошибка анализа аудио:", e);
            return [30,50,45,70,40,60,35,80,55,30,65,50,40,75,45,35,60,40,30,50];
        }
    }
    
    stopRecording(btn) { if(this.mediaRecorder){this.mediaRecorder.stop(); btn.classList.remove('recording');} }

    rerenderComments(postId) {
        const post = this.dataManager.getAllPosts().find(p => p.id === postId);
        const commentsList = document.getElementById(`comments-list-${postId}`);
        const commentCountBtn = this.postsContainer.querySelector(`.action-btn-comment span`);
        if (commentCountBtn) commentCountBtn.textContent = post.comments ? post.comments.length : 0;
        if (post && commentsList) {
            commentsList.innerHTML = post.comments.map(c => this.createCommentHTML(c, postId)).join('');
            commentsList.scrollTop = commentsList.scrollHeight;
        }
    }

    createCommentHTML(comment, postId) {
        let contentHTML = '';
        if (comment.type === 'audio') {
            const heights = comment.waveform || [20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20];
            const barsHTML = heights.map(h => `<div class="wave-bar" style="height: ${h}%;"></div>`).join('');
            
            contentHTML = `
                <div class="audio-message">
                    <button class="audio-control-btn"><i class="fa-solid fa-play"></i></button>
                    <audio src="${comment.content}" style="display:none;"></audio>
                    <div class="audio-waveform-new">
                        <div class="wave-bg">${barsHTML}</div>
                        <div class="wave-progress"><div class="wave-progress-inner">${barsHTML}</div></div>
                    </div>
                </div>`;
        } else {
            contentHTML = `<div class="comment-text">${escapeHTML(comment.content)}</div>`;
        }
        
        const likes = comment.likes || 0;
        const dislikes = comment.dislikes || 0;
        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';

        return `
            <div class="comment-item" data-id="${comment.id}" data-post-id="${postId}" data-author="${comment.author.username}">
                <img src="${comment.author.avatar}" class="comment-avatar" alt="Аватар">
                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHTML(comment.author.name)}</span>
                        <span class="comment-date">· Только что</span>
                    </div>
                    ${contentHTML}
                    <div class="comment-actions">
                        <button class="comment-action-btn ${likedClass}" data-type="like" data-id="${comment.id}" data-post-id="${postId}">
                            <i class="fa-solid fa-thumbs-up"></i> ${likes > 0 ? likes : ''}
                        </button>
                        <button class="comment-action-btn ${dislikedClass}" data-type="dislike" data-id="${comment.id}" data-post-id="${postId}">
                            <i class="fa-solid fa-thumbs-down"></i> ${dislikes > 0 ? dislikes : ''}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    togglePoll(){this.isPollActive=!this.isPollActive;this.pollCreator.style.display=this.isPollActive?"flex":"none";this.togglePollBtn.classList.toggle("active",this.isPollActive);this.checkPublishState()}closePoll(){this.isPollActive=!1;this.pollCreator.style.display="none";this.togglePollBtn.classList.remove("active");this.pollInputsContainer.innerHTML='<input type="text" class="poll-input" placeholder="Вариант 1"><input type="text" class="poll-input" placeholder="Вариант 2">';this.addOptionBtn.style.display="block";this.checkPublishState()}addPollOption(){const e=this.pollInputsContainer.querySelectorAll(".poll-input");if(e.length<4){const t=document.createElement("input");t.type="text",t.className="poll-input",t.placeholder=`Вариант ${e.length+1}`,this.pollInputsContainer.appendChild(t),e.length+1>=4&&(this.addOptionBtn.style.display="none")}this.checkPublishState()}checkPublishState(){let e=!1;if(this.isPollActive){if(Array.from(this.pollInputsContainer.querySelectorAll(".poll-input")).filter(e=>e.value.trim().length>0).length>=2)e=!0}this.publishBtn.disabled=!(this.input.value.trim().length>0||e)}

    createPostHTML(post) {
        const isPrivate = post.visibility === 'private';
        const visibilityText = isPrivate ? 'Сделать публичным' : 'Скрыть для всех';
        const visibilityIcon = isPrivate ? 'fa-eye' : 'fa-eye-slash';
        
        const optionsMenuHTML = `
            <button class="icon-btn post-options-btn"><i class="fa-solid fa-ellipsis"></i></button>
            <div class="options-menu">
                <div class="menu-item toggle-visibility-btn" data-id="${post.id}">
                    <i class="fa-solid ${visibilityIcon}"></i><span>${visibilityText}</span>
                </div>
                <div class="menu-item menu-item-danger delete-post-btn" data-id="${post.id}">
                    <i class="fa-solid fa-trash-can"></i><span>Удалить пост</span>
                </div>
            </div>
        `;

        let pollHTML = '';
        if (post.poll) {
            pollHTML += `<div class="poll-wrapper">`;
            post.poll.options.forEach(opt => {
                if (post.poll.votedOptionId) {
                    const percent = post.poll.totalVotes === 0 ? 0 : Math.round((opt.votes / post.poll.totalVotes) * 100);
                    const isVoted = post.poll.votedOptionId === opt.id;
                    pollHTML += `<div class="poll-result-item ${isVoted?'voted':''}"><div class="poll-bar" style="width: ${percent}%"></div><span class="poll-item-text">${escapeHTML(opt.text)}</span><span class="poll-item-percent">${percent}%</span></div>`;
                } else {
                    pollHTML += `<div class="poll-vote-btn" data-post-id="${post.id}" data-option-id="${opt.id}">${escapeHTML(opt.text)}</div>`;
                }
            });
            pollHTML += `<div class="poll-meta">${post.poll.totalVotes} голосов · Завершится через ${post.poll.days} дн.</div></div>`;
        }

        const commentsHTML = post.comments ? post.comments.map(c => this.createCommentHTML(c, post.id)).join('') : '';
        const privateClass = isPrivate ? 'private-post' : '';

        // --- ВОТ ТУТ ГЛАВНОЕ ИЗМЕНЕНИЕ ---
        return `
            <article class="post ${privateClass}" data-id="${post.id}">
                ${optionsMenuHTML}
                
                <div class="post-main-body">
                    <div class="avatar"><img src="${post.author.avatar}" alt="Аватар"></div>
                    <div class="post-content">
                        <div class="post-header">
                            <span class="post-name">${escapeHTML(post.author.name)}</span>
                            <span class="post-username">${escapeHTML(post.author.username)}</span>
                            <span class="post-time">· ${post.timestamp}</span>
                        </div>
                        <div class="post-text">${post.content ? escapeHTML(post.content) : ''}</div>
                        ${pollHTML}
                    </div>
                </div>
                
                <!-- БЛОК ДЕЙСТВИЙ -->
                <div class="post-actions">
                    <div class="action-btn like-btn ${post.isLiked ? 'liked' : ''}" data-id="${post.id}">
                        <i class="fa-${post.isLiked ? 'solid' : 'regular'} fa-heart"></i><span>${post.likes}</span>
                    </div>
                    <div class="action-btn"><i class="fa-solid fa-retweet"></i><span>0</span></div>
                    <div class="action-btn action-btn-comment" data-id="${post.id}">
                        <i class="fa-regular fa-comment"></i><span>${post.comments ? post.comments.length : 0}</span>
                    </div>
                    
                    <div class="action-btn views-btn" title="Просмотры">
                        <i class="fa-solid fa-chart-simple"></i><span>${post.views || 0}</span>
                    </div>
                </div>

                <div class="comments-section" id="comments-${post.id}">
                    <div class="comments-list" id="comments-list-${post.id}">
                        ${commentsHTML}
                    </div>
                    <div class="comment-input-area">
                        <input type="text" class="comment-input" id="comment-input-${post.id}" placeholder="Написать комментарий...">
                        <button class="record-btn" data-id="${post.id}" title="Голосовое сообщение"><i class="fa-solid fa-microphone"></i></button>
                        <button class="send-comment-btn" data-id="${post.id}">Отпр.</button>
                    </div>
                </div>
            </article>
        `;
    }

    renderProfileFeed() {
        const posts = this.dataManager.getUserPosts(this.currentUser.username);
        if (posts.length === 0) {
            this.postsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">У вас пока нет публикаций</div>`;
        } else {
            this.postsContainer.innerHTML = posts.map(post => this.createPostHTML(post)).join('');
        }
        this.checkPublishState();
    }
}