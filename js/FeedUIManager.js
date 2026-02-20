import { escapeHTML } from './utils.js';

export class FeedUIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        // Мы будем получать current user непосредственно при проверке, чтобы данные были свежими
        
        this.container = document.getElementById('postsContainer');
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
        this.renderAll();
    }

    createGlobalContextMenu() {
        if (document.getElementById('customContextMenu')) return;
        const menu = document.createElement('div');
        menu.id = 'customContextMenu';
        menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
        document.body.appendChild(menu);
        this.contextMenu = menu;
        this.contextTargetCommentId = null;
        this.contextTargetPostId = null;

        document.addEventListener('click', () => { this.contextMenu.style.display = 'none'; });
        // Добавляем скролл - при скролле меню должно исчезать
        document.addEventListener('scroll', () => { this.contextMenu.style.display = 'none'; }, true);
    }

    initEventListeners() {
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
                this.input.value = ''; this.closePoll(); this.renderAll();
            }
        });

        // КЛИК ПО "УДАЛИТЬ" В КОНТЕКСТНОМ МЕНЮ
        document.getElementById('ctxDeleteComment').addEventListener('click', () => {
            if (this.contextTargetPostId && this.contextTargetCommentId) {
                this.dataManager.deleteComment(this.contextTargetPostId, this.contextTargetCommentId);
                this.rerenderComments(this.contextTargetPostId);
                this.contextMenu.style.display = 'none';
            }
        });

        // ОБРАБОТЧИК ПКМ
        this.container.addEventListener('contextmenu', (e) => {
            const commentItem = e.target.closest('.comment-item');
            if (commentItem) {
                const authorUsername = commentItem.dataset.author;
                // Получаем свежие данные о текущем пользователе
                const currentUser = this.dataManager.getProfileData();
                
                // Проверяем: это наш коммент или нет?
                if (authorUsername === currentUser.username) {
                    e.preventDefault(); // Блокируем меню браузера
                    
                    this.contextTargetCommentId = commentItem.dataset.id;
                    this.contextTargetPostId = commentItem.dataset.postId;
                    
                    // Показываем меню под курсором
                    this.contextMenu.style.display = 'block';
                    this.contextMenu.style.top = `${e.pageY}px`;
                    this.contextMenu.style.left = `${e.pageX}px`;
                }
            }
        });

        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            // Лайки комментов
            const reactionBtn = target.closest('.comment-action-btn');
            if (reactionBtn) {
                this.dataManager.toggleCommentReaction(reactionBtn.dataset.postId, reactionBtn.dataset.id, reactionBtn.dataset.type);
                this.rerenderComments(reactionBtn.dataset.postId);
                return;
            }

            // Открыть комменты
            const commentBtn = target.closest('.action-btn-comment');
            if (commentBtn) {
                document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('active');
                return;
            }

            // Отправка коммента
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

            // Аудио запись
            const recordBtn = target.closest('.record-btn');
            if (recordBtn) {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') { this.stopRecording(recordBtn); } 
                else { this.startRecording(recordBtn.dataset.id, recordBtn); }
                return;
            }

            // Плеер
            const playAudioBtn = target.closest('.audio-control-btn');
            if (playAudioBtn) {
                const audio = playAudioBtn.nextElementSibling;
                const progressBar = playAudioBtn.parentElement.querySelector('.audio-progress');
                if (audio.paused) {
                    document.querySelectorAll('audio').forEach(a => { if(a!==audio){a.pause();a.currentTime=0;}});
                    audio.play();
                    playAudioBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    audio.ontimeupdate = () => progressBar.style.width = `${(audio.currentTime/audio.duration)*100}%`;
                    audio.onended = () => { playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; progressBar.style.width='0%'; };
                } else {
                    audio.pause(); playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                }
                return;
            }

            // Опции поста и Лайки поста
            if (target.closest('.post-options-btn')) { target.closest('.post-options-btn').nextElementSibling.classList.toggle('active'); return; }
            if (target.closest('.like-btn')) { const updated = this.dataManager.toggleLike(target.closest('.like-btn').dataset.id); if(updated) this.renderAll(); return; } 
            if (target.closest('.delete-post-btn')) { if(confirm('Удалить?')) { this.dataManager.deletePost(target.closest('.delete-post-btn').dataset.id); this.renderAll(); } return; }
        });
    }

    async startRecording(postId, btn) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.recordingPostId = postId;
            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    this.dataManager.addComment(this.recordingPostId, reader.result, 'audio');
                    this.rerenderComments(this.recordingPostId);
                };
                stream.getTracks().forEach(track => track.stop());
            };
            this.mediaRecorder.start();
            btn.classList.add('recording');
        } catch (err) { alert('Нужен микрофон!'); console.error(err); }
    }
    stopRecording(btn) { if(this.mediaRecorder){this.mediaRecorder.stop(); btn.classList.remove('recording');} }

    rerenderComments(postId) {
        const post = this.dataManager.getAllPosts().find(p => p.id === postId);
        const commentsList = document.getElementById(`comments-list-${postId}`);
        const commentCountBtn = this.container.querySelector(`.action-btn-comment[data-id="${postId}"] span`);
        if (commentCountBtn) commentCountBtn.textContent = post.comments ? post.comments.length : 0;
        if (post && commentsList) {
            commentsList.innerHTML = post.comments.map(c => this.createCommentHTML(c, postId)).join('');
            commentsList.scrollTop = commentsList.scrollHeight;
        }
    }

    createCommentHTML(comment, postId) {
        let contentHTML = '';
        if (comment.type === 'audio') {
            contentHTML = `<div class="audio-message"><button class="audio-control-btn"><i class="fa-solid fa-play"></i></button><audio src="${comment.content}" style="display:none;"></audio><div class="audio-waveform"><div class="audio-progress"></div></div></div>`;
        } else {
            contentHTML = `<div class="comment-text">${escapeHTML(comment.content)}</div>`;
        }
        
        const likes = comment.likes || 0;
        const dislikes = comment.dislikes || 0;
        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';

        return `
            <div class="comment-item" data-id="${comment.id}" data-post-id="${postId}" data-author="${comment.author.username}">
                <img src="${comment.author.avatar}" class="comment-avatar">
                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHTML(comment.author.name)}</span>
                        <span class="comment-date">Только что</span>
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
        const currentUser = this.dataManager.getProfileData(); // Получаем юзера для рендера меню
        const isPrivate = post.visibility === 'private';
        let optionsMenuHTML = '';
        if (post.author.username === currentUser.username) {
            optionsMenuHTML = `
                <button class="icon-btn post-options-btn"><i class="fa-solid fa-ellipsis"></i></button>
                <div class="options-menu">
                    <div class="menu-item toggle-visibility-btn" data-id="${post.id}"><i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span></div>
                    <div class="menu-item menu-item-danger delete-post-btn" data-id="${post.id}"><i class="fa-solid fa-trash-can"></i><span>Удалить</span></div>
                </div>`;
        }
        let pollHTML = '';
        if (post.poll) {
             pollHTML += `<div class="poll-wrapper">`;
             post.poll.options.forEach(opt => {
                 if (post.poll.votedOptionId) {
                     const percent = post.poll.totalVotes === 0 ? 0 : Math.round((opt.votes / post.poll.totalVotes) * 100);
                     const isVoted = post.poll.votedOptionId === opt.id;
                     pollHTML += `<div class="poll-result-item ${isVoted?'voted':''}"><div class="poll-bar" style="width: ${percent}%"></div><span class="poll-item-text">${escapeHTML(opt.text)}</span><span class="poll-item-percent">${percent}%</span></div>`;
                 } else { pollHTML += `<div class="poll-vote-btn" data-post-id="${post.id}" data-option-id="${opt.id}">${escapeHTML(opt.text)}</div>`; }
             });
             pollHTML += `<div class="poll-meta">${post.poll.totalVotes} голосов · Завершится через ${post.poll.days} дн.</div></div>`;
        }

        const commentsHTML = post.comments ? post.comments.map(c => this.createCommentHTML(c, post.id)).join('') : '';

        // ВОТ ЗДЕСЬ ИЗМЕНЕНИЕ СТРУКТУРЫ: post-main-body обертывает верхнюю часть, а comments-section идет следом
        return `
            <article class="post ${isPrivate ? 'private-post' : ''}" data-id="${post.id}">
                ${optionsMenuHTML}
                
                <div class="post-main-body">
                    <div class="avatar"><img src="${post.author.avatar}"></div>
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
                            <div class="action-btn action-btn-comment" data-id="${post.id}">
                                <i class="fa-regular fa-comment"></i><span>${post.comments ? post.comments.length : 0}</span>
                            </div>
                        </div>
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

    renderAll() {
        const posts = this.dataManager.getAllPosts();
        this.container.innerHTML = posts.map(post => this.createPostHTML(post)).join('');
        this.checkPublishState();
    }
}