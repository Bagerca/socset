// public/js/store/PostsStore.js
import { PostsAPI } from '../api/PostsAPI.js';
import { generateId } from '../utils/utils.js';

export class PostsStore {
    constructor(authStore) {
        this.authStore = authStore;
        this.posts = [];
        this.offlineQueue =[];
        this.initSocket();
        this.initOfflineQueue();
    }

    initSocket() {
        if (window.socket) { 
            window.socket.on('new_post', (post) => {
                const justCreatedLocally = this.posts.some(p => p.isPending && p.content === post.content && p.author.username === post.author.username);
                if (!this.posts.find(p => p.id === post.id) && !justCreatedLocally) {
                    this.posts.unshift(this._personalize(post));
                    document.dispatchEvent(new CustomEvent('cycle:posts_updated')); // Для нового поста полная перерисовка нормальна
                }
            });

            // МГНОВЕННОЕ ТОЧЕЧНОЕ ОБНОВЛЕНИЕ
            window.socket.on('update_post', (updatedPost) => {
                const index = this.posts.findIndex(p => p.id === updatedPost.id);
                if (index !== -1) {
                    this.posts[index] = this._personalize(updatedPost);
                    // Вызываем точечное обновление конкретного поста!
                    document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: this.posts[index] }));
                }
            });

            window.socket.on('delete_post', (postId) => {
                this.posts = this.posts.filter(p => p.id !== postId);
                document.dispatchEvent(new CustomEvent('cycle:posts_updated'));
            });
        }
    }

    async initOfflineQueue() {
        if (window.localforage) {
            this.offlineQueue = (await localforage.getItem('cycle_offline_queue')) ||[];
            window.addEventListener('online', () => this.syncOfflineQueue());
            setInterval(() => this.syncOfflineQueue(), 15000);
        }
    }

    async saveToQueue(task) {
        this.offlineQueue.push(task);
        if (window.localforage) await localforage.setItem('cycle_offline_queue', this.offlineQueue);
    }

    async syncOfflineQueue() {
        if (!navigator.onLine || this.offlineQueue.length === 0) return;
        const queueCopy =[...this.offlineQueue];
        this.offlineQueue =[]; 
        if (window.localforage) await localforage.setItem('cycle_offline_queue', this.offlineQueue);

        for (const task of queueCopy) {
            try {
                if (task.action === 'addPost') {
                    const data = await PostsAPI.createPost(task.payload);
                    if (data.success) {
                        const index = this.posts.findIndex(p => p.id === task.tempId);
                        if (index !== -1) {
                            this.posts[index] = this._personalize(data.post);
                            document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: this.posts[index] }));
                        }
                    }
                } else if (task.action === 'addComment') {
                    const data = await PostsAPI.addComment(task.payload.postId, task.payload.comment);
                    if (data.success) {
                        const post = this.posts.find(p => p.id === task.payload.postId);
                        if (post) {
                            const cIndex = post.comments.findIndex(c => c.id === task.tempId);
                            if (cIndex !== -1) {
                                post.comments[cIndex] = data.comment;
                                this._personalize(post);
                                document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));
                            }
                        }
                    }
                }
            } catch (e) {
                this.offlineQueue.push(task);
                if (window.localforage) await localforage.setItem('cycle_offline_queue', this.offlineQueue);
            }
        }
    }

    async loadPosts(page = 1, targetId = null, feedType = 'main', extraIds =[]) {
        try {
            const newPosts = await PostsAPI.getPosts(page, 10, targetId, feedType, extraIds);
            const processed = newPosts.map(p => this._personalize(p));
            if (page === 1) { 
                this.posts = processed; 
                this.injectOfflinePosts(targetId, feedType); 
            } else {
                const existingIds = new Set(this.posts.map(p => p.id));
                const uniqueNew = processed.filter(p => !existingIds.has(p.id));
                this.posts =[...this.posts, ...uniqueNew];
            }
            return processed;
        } catch (e) { return[]; }
    }

    injectOfflinePosts(targetId, feedType) {
        const offlinePosts = this.offlineQueue.filter(t => t.action === 'addPost').reverse();
        for (const task of offlinePosts) {
            if (feedType === 'communities' && task.payload.communityId !== targetId) continue;
            if (feedType === 'game' && (!task.payload.attachment || task.payload.attachment.game !== targetId)) continue;
            
            const p = this.createOptimisticPostObj(task.tempId, task.payload);
            if (!this.posts.find(existing => existing.id === p.id)) {
                this.posts.unshift(this._personalize(p));
            }
        }
    }

    _personalize(post) {
        const me = this.authStore.user?.username;
        if (!post.likedBy) post.likedBy =[];
        post.isLiked = post.likedBy.includes(me);
        post.likes = post.likedBy.length;

        if (post.poll) {
            if (!post.poll.votedBy) post.poll.votedBy = {};
            post.poll.votedOptionId = post.poll.votedBy[me] || null;
            post.poll.totalVotes = Object.keys(post.poll.votedBy).length;
            post.poll.options.forEach(opt => { opt.votes = Object.values(post.poll.votedBy).filter(id => id === opt.id).length; });
        }
        
        if (post.comments) {
            post.comments.forEach(comment => {
                if (!comment.reactionsMap) comment.reactionsMap = {};
                comment.userReaction = comment.reactionsMap[me] || null;
                const reactions = Object.values(comment.reactionsMap);
                comment.likes = reactions.filter(r => r === 'like').length;
                comment.dislikes = reactions.filter(r => r === 'dislike').length;
            });
        }
        return post;
    }
    
    createOptimisticPostObj(tempId, payload) {
        const me = this.authStore.user;
        let poll = null;
        if (payload.pollData && payload.pollData.options.length >= 2) {
            poll = { options: payload.pollData.options.map(opt => ({ id: 'opt_' + generateId(), text: opt, votes: 0 })), totalVotes: 0, days: payload.pollData.duration || 3, votedBy: {} };
        }
        return {
            id: tempId, author: { username: me.username, name: me.name, avatar: me.avatar, frameId: me.frameId, isVerified: me.isVerified, verifiedBadgeType: me.verifiedBadgeType },
            content: payload.content, attachment_type: payload.attachment ? (payload.attachment.music ? 'music' : 'game') : null, attachment: payload.attachment,
            poll, community_id: payload.communityId || null, timestamp: Date.now(), likedBy:[], comments:[], views: 0, isPending: true 
        };
    }

    addPost(content, pollData = null, attachment = null, communityId = null) {
        const tempId = 'local_' + generateId();
        const payload = { content, pollData, attachment, communityId };
        const optimisticPost = this.createOptimisticPostObj(tempId, payload);
        this.posts.unshift(this._personalize(optimisticPost));
        document.dispatchEvent(new CustomEvent('cycle:posts_updated')); // Новый пост все же рендерит ленту, это ок

        const task = { action: 'addPost', payload: { content, poll: optimisticPost.poll, attachment, communityId }, tempId, timestamp: Date.now() };
        PostsAPI.createPost(task.payload).then(data => {
            if (data.success) {
                const index = this.posts.findIndex(p => p.id === tempId);
                if (index !== -1) {
                    this.posts[index] = this._personalize(data.post);
                    document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: this.posts[index] }));
                }
            }
        }).catch(() => { this.saveToQueue(task); });
    }

    addComment(postId, content, type = 'text', waveform = null) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        const tempId = 'local_c_' + generateId();
        const me = this.authStore.user;
        const optimisticComment = {
            id: tempId, postId, content, type, waveform, timestamp: Date.now(),
            author: { username: me.username, name: me.name, avatar: me.avatar, frameId: me.frameId, isVerified: me.isVerified, verifiedBadgeType: me.verifiedBadgeType },
            reactionsMap: {}, isPending: true
        };

        post.comments.push(optimisticComment);
        this._personalize(post);
        document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post })); // Точечно

        const task = { action: 'addComment', payload: { postId, comment: { content, type, waveform } }, tempId, timestamp: Date.now() };
        PostsAPI.addComment(postId, task.payload.comment).then(data => {
            if (data.success) {
                const cIndex = post.comments.findIndex(c => c.id === tempId);
                if (cIndex !== -1) {
                    post.comments[cIndex] = data.comment;
                    this._personalize(post);
                    document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post })); // Точечно
                }
            }
        }).catch(() => { this.saveToQueue(task); });
    }

    async repostPost(postId) { await PostsAPI.repost(postId); }

    async toggleLike(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        
        // Оптимистичное обновление
        post.isLiked ? (post.likes--, post.isLiked = false) : (post.likes++, post.isLiked = true);
        document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));
        
        await PostsAPI.likePost(postId);
    }

    async togglePostVisibility(postId) { await PostsAPI.togglePostVisibility(postId); }
    async votePoll(postId, optionId) { await PostsAPI.votePoll(postId, optionId); }
    
    async deleteComment(postId, commentId) {
        const post = this.posts.find(p => p.id === postId);
        if (post) { 
            post.comments = post.comments.filter(c => c.id !== commentId); 
            document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));
            await PostsAPI.deleteComment(postId, commentId); 
        }
    }
    
    async toggleCommentReaction(postId, commentId, type) { 
        const post = this.posts.find(p => p.id === postId);
        const comment = post?.comments.find(c => c.id === commentId);
        if (!comment) return;

        const me = this.authStore.user.username;
        if (!comment.reactionsMap) comment.reactionsMap = {};
        if (comment.reactionsMap[me] === type) delete comment.reactionsMap[me];
        else comment.reactionsMap[me] = type;
        
        this._personalize(post);
        document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));

        await PostsAPI.reactComment(postId, commentId, type); 
    }
    
    async deletePost(postId) { await PostsAPI.deletePost(postId); }
}