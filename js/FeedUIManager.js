import { escapeHTML } from './utils.js';

export class FeedUIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
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
        this.audioChunks =[];
        this.recordingPostId = null;

        // --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ЗАПИСИ И СОСТОЯНИЙ ---
        this.recordingStartTime = null;
        this.recordingInterval = null;
        this.recordedAudioBlob = null;
        this.playbackAudio = new Audio();
        // --- ---

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

        // --- ОБРАБОТЧИК КЛИКОВ (Обновлено) ---
        this.container.addEventListener('contextmenu', (e) => {
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

        this.container.addEventListener('click', (e) => {
            const target = e.target;

            // --- ОБРАБОТКА КОММЕНТАРИЕВ И АУДИО (обновлено) ---
            const postId = target.closest('.comment-input-area')?.dataset.id || target.closest('.comment-item')?.dataset.postId;

            // 1. Старт записи
            const micBtn = target.closest('.mic-btn-start');
            if (micBtn) {
                this.startRecordingUI(postId, target.closest('.comment-input-area'));
                return;
            }

            // 2. Управление записью (Пауза/Возобновить)
            const pauseResumeBtn = target.closest('.record-pause-btn');
            if (pauseResumeBtn) {
                this.pauseResumeRecording(pauseResumeBtn);
                return;
            }

            // 3. Отмена записи
            const cancelBtn = target.closest('.record-cancel-btn');
            if (cancelBtn) {
                this.cancelRecordingUI(target.closest('.comment-input-area'));
                return;
            }

            // 4. Стоп и переход к прослушиванию
            const stopBtn = target.closest('.mic-btn-stop');
            if (stopBtn) {
                this.stopRecordingUI(target.closest('.comment-input-area'));
                return;
            }

            // 5. Прослушивание перед отправкой
            const previewPlayBtn = target.closest('.preview-play-btn');
            if (previewPlayBtn) {
                this.togglePlaybackUI(previewPlayBtn);
                return;
            }

            // 6. Отправка аудио
            const sendAudioBtn = target.closest('.preview-send-btn');
            if (sendAudioBtn) {
                this.sendRecordedAudio(target.closest('.comment-input-area'));
                return;
            }
            
            // 7. Отправка текста
            const sendCommentBtn = target.closest('.send-text-btn');
            if (sendCommentBtn) {
                const input = document.getElementById(`comment-input-${postId}`);
                if (input.value.trim()) {
                    this.dataManager.addComment(postId, input.value.trim(), 'text');
                    input.value = ''; this.rerenderComments(postId);
                }
                return;
            }

            // 8. Лайки комментариев
            const reactionBtn = target.closest('.comment-action-btn');
            if (reactionBtn) {
                this.dataManager.toggleCommentReaction(reactionBtn.dataset.postId, reactionBtn.dataset.id, reactionBtn.dataset.type);
                this.rerenderComments(reactionBtn.dataset.postId);
                return;
            }

            // 9. Открыть/Закрыть комментарии
            const commentBtn = target.closest('.action-btn-comment');
            if (commentBtn) { document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('active'); return; }

            // 10. Пост действия
            if (target.closest('.post-options-btn')) { target.closest('.post-options-btn').nextElementSibling.classList.toggle('active'); return; }
            if (target.closest('.like-btn')) { const updated = this.dataManager.toggleLike(target.closest('.like-btn').dataset.id); if(updated) this.renderAll(); return; } 
            if (target.closest('.delete-post-btn')) { if(confirm('Удалить?')) { this.dataManager.deletePost(target.closest('.delete-post-btn').dataset.id); this.renderAll(); } return; }
        });
    }

    // --- ФУНКЦИИ УПРАВЛЕНИЯ ЗАПИСЬЮ И UI ---

    // 1. НАЧАЛО ЗАПИСИ
    async startRecordingUI(postId, inputArea) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks =[];
            this.recordingPostId = postId;

            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            this.mediaRecorder.start();

            // Показываем UI записи и запускаем таймер
            this.showRecordingUI(inputArea);

        } catch (err) { alert('Нужен микрофон!'); console.error(err); }
    }

    // 2. ОТОБРАЖЕНИЕ UI ЗАПИСИ
    showRecordingUI(inputArea) {
        const defaultState = inputArea.querySelector('.input-state-default');
        const recordUI = inputArea.querySelector('.record-ui');
        const previewUI = inputArea.querySelector('.preview-player');
        
        defaultState.style.display = 'none';
        previewUI.classList.remove('active');
        recordUI.classList.add('active');
        
        // Запускаем таймер
        const timerElement = recordUI.querySelector('.timer');
        this.recordingStartTime = Date.now();
        this.recordingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const seconds = String(elapsed % 60).padStart(2, '0');
            timerElement.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

    // 3. ПАУЗА / ВОЗОБНОВЛЕНИЕ
    pauseResumeRecording(btn) {
        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            clearInterval(this.recordingInterval);
        } else if (this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.recordingStartTime = Date.now() - (this.recordingStartTime - this.recordingStartTime); // Возобновляем таймер
            this.recordingInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
                const seconds = String(elapsed % 60).padStart(2, '0');
                document.querySelector('.record-ui .timer').textContent = `${minutes}:${seconds}`;
            }, 1000);
        }
    }

    // 4. ОСТАНОВКА (ПЕРЕХОД К ПРЕДПРОСМОТРУ)
    stopRecordingUI(inputArea) {
        clearInterval(this.recordingInterval);
        this.mediaRecorder.stop();
        
        const recordUI = inputArea.querySelector('.record-ui');
        const previewUI = inputArea.querySelector('.preview-player');
        
        recordUI.classList.remove('active');
        previewUI.classList.add('active');

        // Конвертируем аудио для прослушивания
        this.mediaRecorder.onstop = () => {
            this.recordedAudioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
            this.playbackAudio.src = URL.createObjectURL(this.recordedAudioBlob);
        };
    }

    // 5. ОТМЕНА ЗАПИСИ
    cancelRecordingUI(inputArea) {
        clearInterval(this.recordingInterval);
        this.mediaRecorder.stop(); // Очищаем запись
        this.recordedAudioBlob = null;
        this.playbackAudio.src = '';
        this.audioChunks =[];
        
        inputArea.querySelector('.record-ui').classList.remove('active');
        inputArea.querySelector('.preview-player').classList.remove('active');
        inputArea.querySelector('.input-state-default').style.display = 'flex';
    }

    // 6. ОТПРАВКА АУДИО
    sendRecordedAudio(inputArea) {
        const reader = new FileReader();
        reader.readAsDataURL(this.recordedAudioBlob);
        reader.onloadend = () => {
            this.dataManager.addComment(this.recordingPostId, reader.result, 'audio');
            this.rerenderComments(this.recordingPostId);
            // Возвращаемся в исходное состояние
            this.recordedAudioBlob = null;
            inputArea.querySelector('.preview-player').classList.remove('active');
            inputArea.querySelector('.input-state-default').style.display = 'flex';
        };
    }

    // 7. ВОСПРОИЗВЕДЕНИЕ ПРЕДПРОСМОТРА
    togglePlaybackUI(btn) {
        if (this.playbackAudio.paused) {
            this.playbackAudio.play();
            btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        } else {
            this.playbackAudio.pause();
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
        this.playbackAudio.onended = () => btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }

    // --- ФУНКЦИИ РЕНДЕРИНГА (частично обновлено) ---
    rerenderComments(postId) {
        const post = this.dataManager.getAllPosts().find(p => p.id === postId);
        const commentsList = document.getElementById(`comments-list-${postId}`);
        const commentCountBtn = this.container.querySelector(`.action-btn-comment span`);
        if (commentCountBtn) commentCountBtn.textContent = post.comments ? post.comments.length : 0;
        if (post && commentsList) {
            commentsList.innerHTML = post.comments.map(c => this.createCommentHTML(c, postId)).join('');
            commentsList.scrollTop = commentsList.scrollHeight;
        }
    }

    // Генерация псевдо-случайной волны для войса (улучшено)
    generateWaveform() {
        const numBars = 20; 
        const minHeight = 4; 
        const maxHeight = 20; 
        const heights = [];
        let barsHTML = '';

        for (let i = 0; i < numBars; i++) {
            // Более естественная генерация волн
            const height = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
            heights.push(height);
        }
        
        // Добавим сглаживание, чтобы волны не были "зубчатыми"
        const smoothedHeights = heights.map((h, i, arr) => {
            if (i === 0 || i === arr.length - 1) return h;
            return Math.floor((arr[i - 1] + h + arr[i + 1]) / 3);
        });

        smoothedHeights.forEach(h => {
            barsHTML += `<span class="wave-bar" style="height: ${h}px"></span>`;
        });
        return barsHTML;
    }

    createCommentHTML(comment, postId) {
        let contentHTML = '';
        if (comment.type === 'audio') {
            contentHTML = `
                <div class="audio-message">
                    <button class="audio-control-btn"><i class="fa-solid fa-play"></i></button>
                    <audio src="${comment.content}" style="display:none;"></audio>
                    <div class="audio-waveform-container">${this.generateWaveform()}</div>
                </div>
            `;
        } else {
            contentHTML = `<div class="comment-text-bubble">${escapeHTML(comment.content)}</div>`;
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
        const currentUser = this.dataManager.getProfileData();
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
                     pollHTML += `<div class="poll-result-item ${post.poll.votedOptionId === opt.id ?'voted':''}"><div class="poll-bar" style="width: ${percent}%"></div><span class="poll-item-text">${escapeHTML(opt.text)}</span><span class="poll-item-percent">${percent}%</span></div>`;
                 } else { pollHTML += `<div class="poll-vote-btn" data-post-id="${post.id}" data-option-id="${opt.id}">${escapeHTML(opt.text)}</div>`; }
             });
             pollHTML += `<div class="poll-meta">${post.poll.totalVotes} голосов · Завершится через ${post.poll.days} дн.</div></div>`;
        }

        const commentsHTML = post.comments ? post.comments.map(c => this.createCommentHTML(c, post.id)).join('') : '';

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
                        
                        <div class="post-actions-wrapper">
                            <div class="post-actions-left">
                                <div class="action-btn like-btn ${post.isLiked ? 'liked' : ''}" data-id="${post.id}">
                                    <i class="fa-${post.isLiked ? 'solid' : 'regular'} fa-heart"></i><span>${post.likes}</span>
                                </div>
                                <div class="action-btn"><i class="fa-solid fa-retweet"></i><span>0</span></div>
                                <div class="action-btn action-btn-comment" data-id="${post.id}">
                                    <i class="fa-regular fa-comment"></i><span>${post.comments ? post.comments.length : 0}</span>
                                </div>
                            </div>
                            <div class="post-views">
                                <i class="fa-regular fa-eye"></i> ${post.views || 0}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Блок комментариев -->
                <div class="comments-section" id="comments-${post.id}">
                    <div class="comments-list" id="comments-list-${post.id}">
                        ${commentsHTML}
                    </div>
                    <!-- НОВЫЙ ИНТЕРФЕЙС ВВОДА -->
                    <div class="comment-input-area" data-id="${post.id}">
                        <div class="input-state-default">
                            <input type="text" class="comment-input" id="comment-input-${post.id}" placeholder="Написать комментарий...">
                            <button class="record-btn mic-btn-start" title="Голосовое сообщение"><i class="fa-solid fa-microphone"></i></button>
                            <button class="send-comment-btn send-text-btn">Отпр.</button>
                        </div>
                        <!-- UI записи -->
                        <div class="record-ui">
                            <button class="record-cancel-btn action-btn" title="Отмена"><i class="fa-solid fa-xmark"></i></button>
                            <span class="timer">00:00</span>
                            <button class="record-pause-btn action-btn" title="Пауза"><i class="fa-solid fa-pause"></i></button>
                            <button class="mic-btn-stop action-btn" title="Стоп"><i class="fa-solid fa-check"></i></button>
                        </div>
                        <!-- UI предпросмотра -->
                        <div class="preview-player">
                            <button class="preview-play-btn action-btn" title="Прослушать"><i class="fa-solid fa-play"></i></button>
                            <span class="waveform"></span>
                            <button class="preview-send-btn action-btn" title="Отправить"><i class="fa-solid fa-paper-plane"></i></button>
                            <button class="record-cancel-btn action-btn" title="Отмена"><i class="fa-solid fa-trash"></i></button>
                        </div>
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