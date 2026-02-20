import { escapeHTML } from './utils.js';

export class ProfileUIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentUser = this.dataManager.getProfileData();

        // Элементы профиля
        this.avatarImg = document.getElementById('avatarImage');
        this.bannerImg = document.getElementById('bannerImage');
        this.avatarInput = document.getElementById('avatarInput');
        this.bannerInput = document.getElementById('bannerInput');
        this.bioTextarea = document.getElementById('bioTextarea');
        this.telegramInput = document.getElementById('telegramInput');
        this.githubInput = document.getElementById('githubInput');
        this.saveBtn = document.getElementById('saveProfileBtn');
        
        // Музыка
        this.musicInput = document.getElementById('musicInput');
        this.playMusicBtn = document.getElementById('playMusicBtn');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.musicTrackName = document.getElementById('musicTrackName');

        // Элементы ленты (публикация и список)
        this.postsContainer = document.getElementById('profilePostsContainer');
        this.input = document.getElementById('postInput');
        this.publishBtn = document.getElementById('publishBtn');
        this.togglePollBtn = document.getElementById('togglePollBtn');
        this.pollCreator = document.getElementById('pollCreator');
        this.closePollBtn = document.getElementById('closePollBtn');
        this.pollInputsContainer = document.getElementById('pollInputs');
        this.addOptionBtn = document.getElementById('addOptionBtn');
        
        this.isPollActive = false;

        this.initEventListeners();
        this.loadProfileData();
        this.renderProfileFeed(); // Рисуем посты при старте
    }

    loadProfileData() {
        const profile = this.dataManager.getProfileData();
        this.avatarImg.src = profile.avatar;
        this.bannerImg.src = profile.banner;
        this.bioTextarea.value = profile.bio;
        this.telegramInput.value = profile.socials.telegram;
        this.githubInput.value = profile.socials.github;
        this.musicTrackName.textContent = profile.music.name;
        if(profile.music.data) {
            this.audioPlayer.src = profile.music.data;
        }
    }

    initEventListeners() {
        // --- ПРОФИЛЬ ---
        this.avatarInput.addEventListener('change', e => this.previewFile(e.target.files[0], this.avatarImg));
        this.bannerInput.addEventListener('change', e => this.previewFile(e.target.files[0], this.bannerImg));
        this.musicInput.addEventListener('change', e => this.handleMusicUpload(e.target.files[0]));
        this.saveBtn.addEventListener('click', () => this.saveProfile());
        this.playMusicBtn.addEventListener('click', () => this.toggleMusic());

        // --- ПУБЛИКАЦИЯ ---
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
                if (options.length >= 2) { pollData = { options, duration: parseInt(document.getElementById('pollDuration').value) }; }
            }
            if (text.length > 0 || pollData) {
                this.dataManager.addPost(text, pollData);
                this.input.value = ''; this.closePoll(); 
                this.renderProfileFeed(); // Обновляем ленту профиля
            }
        });

        // --- ЛЕНТА (Лайки, удаление, меню) ---
        this.postsContainer.addEventListener('click', (e) => {
            const target = e.target;
            
            // Меню
            const optionsBtn = target.closest('.post-options-btn');
            if (optionsBtn) {
                const menu = optionsBtn.nextElementSibling;
                document.querySelectorAll('.options-menu.active').forEach(m => { if(m!==menu) m.classList.remove('active'); });
                menu.classList.toggle('active');
                return;
            }
            
            // Удаление
            const deleteBtn = target.closest('.delete-post-btn');
            if (deleteBtn) {
                if (confirm('Удалить этот пост?')) {
                    this.dataManager.deletePost(deleteBtn.dataset.id);
                    this.renderProfileFeed();
                }
                return;
            }

            // Скрытие
            const visibilityBtn = target.closest('.toggle-visibility-btn');
            if (visibilityBtn) {
                const updatedPost = this.dataManager.togglePostVisibility(visibilityBtn.dataset.id);
                this.renderProfileFeed(); // Проще перерисовать, чем менять классы точечно
                return;
            }

            // Лайки
            const likeBtn = target.closest('.like-btn');
            if (likeBtn) {
                const updatedPost = this.dataManager.toggleLike(likeBtn.dataset.id);
                if (updatedPost) {
                    const icon = likeBtn.querySelector('i'); const span = likeBtn.querySelector('span');
                    likeBtn.classList.toggle('liked', updatedPost.isLiked); 
                    icon.classList.toggle('fa-solid', updatedPost.isLiked); icon.classList.toggle('fa-regular', !updatedPost.isLiked);
                    span.textContent = updatedPost.likes;
                }
                return;
            }

            // Опросы
            const voteBtn = target.closest('.poll-vote-btn');
            if (voteBtn) {
                this.dataManager.votePoll(voteBtn.dataset.postId, voteBtn.dataset.optionId);
                this.renderProfileFeed();
            }
        });

        // Закрытие меню при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.post-options-btn') && !e.target.closest('.options-menu')) {
                document.querySelectorAll('.options-menu.active').forEach(m => m.classList.remove('active'));
            }
        });
    }

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ПРОФИЛЯ ---
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

    // --- ФУНКЦИИ ЛЕНТЫ И ОПРОСОВ ---
    togglePoll(){this.isPollActive=!this.isPollActive;this.pollCreator.style.display=this.isPollActive?"flex":"none";this.togglePollBtn.classList.toggle("active",this.isPollActive);this.checkPublishState()}closePoll(){this.isPollActive=!1;this.pollCreator.style.display="none";this.togglePollBtn.classList.remove("active");this.pollInputsContainer.innerHTML='<input type="text" class="poll-input" placeholder="Вариант 1"><input type="text" class="poll-input" placeholder="Вариант 2">';this.addOptionBtn.style.display="block";this.checkPublishState()}addPollOption(){const e=this.pollInputsContainer.querySelectorAll(".poll-input");if(e.length<4){const t=document.createElement("input");t.type="text",t.className="poll-input",t.placeholder=`Вариант ${e.length+1}`,this.pollInputsContainer.appendChild(t),e.length+1>=4&&(this.addOptionBtn.style.display="none")}this.checkPublishState()}checkPublishState(){let e=!1;if(this.isPollActive){if(Array.from(this.pollInputsContainer.querySelectorAll(".poll-input")).filter(e=>e.value.trim().length>0).length>=2)e=!0}this.publishBtn.disabled=!(this.input.value.trim().length>0||e)}

    createPostHTML(post) {
        // Меню действий (всегда показываем в своем профиле, так как это наши посты)
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

        const privateClass = isPrivate ? 'private-post' : '';

        return `
            <article class="post ${privateClass}" data-id="${post.id}">
                ${optionsMenuHTML}
                <div class="avatar"><img src="${post.author.avatar}" alt="Аватар"></div>
                <div class="post-content">
                    <div class="post-header">
                        <span class="post-name">${escapeHTML(post.author.name)}</span>
                        <span class="post-username">${escapeHTML(post.author.username)}</span>
                        <span class="post-time">· ${post.timestamp}</span>
                    </div>
                    <div class="post-text">${post.content ? escapeHTML(post.content) : ''}</div>
                    ${pollHTML}
                    <div class="post-actions">
                        <div class="action-btn like-btn ${post.isLiked ? 'liked' : ''}" data-id="${post.id}">
                            <i class="fa-${post.isLiked ? 'solid' : 'regular'} fa-heart"></i><span>${post.likes}</span>
                        </div>
                        <div class="action-btn"><i class="fa-solid fa-retweet"></i><span>0</span></div>
                        <div class="action-btn"><i class="fa-regular fa-comment"></i></div>
                    </div>
                </div>
            </article>
        `;
    }

    renderProfileFeed() {
        // Берем посты ТОЛЬКО текущего юзера
        const posts = this.dataManager.getUserPosts(this.currentUser.username);
        
        if (posts.length === 0) {
            this.postsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">У вас пока нет публикаций</div>`;
        } else {
            this.postsContainer.innerHTML = posts.map(post => this.createPostHTML(post)).join('');
        }
        this.checkPublishState();
    }
}