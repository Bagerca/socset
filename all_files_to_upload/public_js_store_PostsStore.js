// public/js/store/PostsStore.js
import { PostsAPI } from '../api/PostsAPI.js';
import { generateId } from '../ui/utils/utils.js';
import { SocketService } from '../services/SocketService.js';
import { OfflineQueueManager } from '../services/OfflineQueueManager.js';

export class PostsStore {
    constructor(authStore) {
        this.authStore = authStore;
        this.posts = [];
        this.offlineManager = new OfflineQueueManager(this);
        this.initSocket();
    }

    initSocket() {
        SocketService.on('new_post', (post) => {
            const justCreatedLocally = this.posts.some(p => p.isPending && p.content === post.content && p.author.username === post.author.username);
            if (!this.posts.find(p => p.id === post.id) && !justCreatedLocally) {
                const enriched = this._personalize(post);
                this.posts.unshift(enriched);
                document.dispatchEvent(new CustomEvent('cycle:post_added', { detail: enriched })); 
            }
        });

        SocketService.on('update_post', (updatedPost) => {
            const index = this.posts.findIndex(p => p.id === updatedPost.id);
            if (index !== -1) {
                const isOwner = updatedPost.author.username === this.authStore.user?.username;
                const isAdmin = this.authStore.user?.isAdmin || this.authStore.user?.activeCommunityAdmin === updatedPost.community_id;
                
                if (updatedPost.visibility === 'private' && !isOwner && !isAdmin) {
                    this.posts.splice(index, 1);
                    document.dispatchEvent(new CustomEvent('cycle:post_deleted', { detail: updatedPost.id }));
                } else {
                    this.posts[index] = this._personalize(updatedPost);
                    document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: this.posts[index] }));
                }
            }
        });

        SocketService.on('delete_post', (postId) => {
            this.posts = this.posts.filter(p => p.id !== postId);
            document.dispatchEvent(new CustomEvent('cycle:post_deleted', { detail: postId }));
        });
    }

    async loadPosts(beforeCursor = null, targetId = null, feedType = 'main', extraIds = []) {
        try {
            const newPosts = await PostsAPI.getPosts(beforeCursor, 10, targetId, feedType, extraIds);
            const processed = newPosts.map(p => this._personalize(p));
            
            if (!beforeCursor) { 
                this.posts = processed; 
                this.injectOfflinePosts(targetId, feedType); 
            } else {
                const existingIds = new Set(this.posts.map(p => p.id));
                const uniqueNew = processed.filter(p => !existingIds.has(p.id));
                this.posts = [...this.posts, ...uniqueNew];
            }
            return processed;
        } catch (e) { return []; }
    }

    injectOfflinePosts(targetId, feedType) {
        const offlinePosts = this.offlineManager.getPendingPosts(targetId, feedType);
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
        if (!post.reactionsMap) post.reactionsMap = {};

        if (post.poll) {
            if (!post.poll.votedBy) post.poll.votedBy = {};
            post.poll.votedOptionId = post.poll.votedBy[me] || null;
            post.poll.totalVotes = Object.keys(post.poll.votedBy).length;
            post.poll.options.forEach(opt => { opt.votes = Object.values(post.poll.votedBy).filter(id => id === opt.id).length; });
        }
        
        if (post.comments) {
            post.comments.forEach(comment => {
                if (!comment.reactionsMap) comment.reactionsMap = {};
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
            poll, community_id: payload.communityId || null, timestamp: Date.now(), reactionsMap: {}, comments: [], views: 0, isPending: true 
        };
    }

    addPost(content, pollData = null, attachment = null, communityId = null) {
        const tempId = 'local_' + generateId();
        const payload = { content, pollData, attachment, communityId };
        const optimisticPost = this.createOptimisticPostObj(tempId, payload);
        const enriched = this._personalize(optimisticPost);
        this.posts.unshift(enriched);
        
        document.dispatchEvent(new CustomEvent('cycle:post_added', { detail: enriched }));

        const task = { action: 'addPost', payload, tempId, timestamp: Date.now() };
        PostsAPI.createPost(task.payload)
            .then(data => { if (data.success) this.handleOfflinePostSuccess(tempId, data.post); })
            .catch(() => this.offlineManager.add(task));
    }

    handleOfflinePostSuccess(tempId, realPost) {
        const index = this.posts.findIndex(p => p.id === tempId);
        if (index !== -1) {
            this.posts[index] = this._personalize(realPost);
            document.dispatchEvent(new CustomEvent('cycle:post_updated', { 
                detail: { oldId: tempId, post: this.posts[index] } 
            }));
        }
    }

    addComment(postId, content, type = 'text', waveform = null, replyToId = null, attachment = null) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        const tempId = 'local_c_' + generateId();
        const me = this.authStore.user;
        const optimisticComment = {
            id: tempId, postId, content, type, waveform, timestamp: Date.now(),
            reply_to_id: replyToId, attachment,
            author: { username: me.username, name: me.name, avatar: me.avatar, frameId: me.frameId, titleId: me.titleId, fontId: me.fontId, isVerified: me.isVerified, verifiedBadgeType: me.verifiedBadgeType },
            reactionsMap: {}, isPending: true
        };

        post.comments.push(optimisticComment);
        this._personalize(post);
        document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));

        const task = { action: 'addComment', payload: { postId, comment: { content, type, waveform, replyToId, attachment } }, tempId, timestamp: Date.now() };
        PostsAPI.addComment(postId, task.payload.comment)
            .then(data => { if (data.success) this.handleOfflineCommentSuccess(postId, tempId, data.comment); })
            .catch(() => this.offlineManager.add(task));
    }

    handleOfflineCommentSuccess(postId, tempId, realComment) {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            const cIndex = post.comments.findIndex(c => c.id === tempId);
            if (cIndex !== -1) {
                post.comments[cIndex] = realComment;
                this._personalize(post);
                document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));
            }
        }
    }

    async repostPost(postId) { await PostsAPI.repost(postId); }

    async reactPost(postId, emoji) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        
        const me = this.authStore.user.username;
        if (!post.reactionsMap) post.reactionsMap = {};
        if (!post.reactionsMap[emoji]) post.reactionsMap[emoji] = [];
        
        const idx = post.reactionsMap[emoji].indexOf(me);
        if (idx > -1) {
            post.reactionsMap[emoji].splice(idx, 1);
            if (post.reactionsMap[emoji].length === 0) delete post.reactionsMap[emoji];
        } else {
            post.reactionsMap[emoji].push(me);
        }
        
        document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));
        await PostsAPI.reactPost(postId, emoji);
    }

    async togglePostVisibility(postId) { 
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            post.visibility = post.visibility === 'public' ? 'private' : 'public';
            document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));
        }
        await PostsAPI.togglePostVisibility(postId); 
    }

    async votePoll(postId, optionId) { 
        const post = this.posts.find(p => p.id === postId);
        if (post && post.poll && !post.poll.votedOptionId) {
            post.poll.votedOptionId = optionId;
            post.poll.totalVotes++;
            const opt = post.poll.options.find(o => o.id === optionId);
            if (opt) opt.votes++;
            document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));
        }
        await PostsAPI.votePoll(postId, optionId); 
    }
    
    async deleteComment(postId, commentId) {
        const post = this.posts.find(p => p.id === postId);
        if (post) { 
            post.comments = post.comments.filter(c => c.id !== commentId && c.reply_to_id !== commentId); 
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
        if (!comment.reactionsMap[type]) comment.reactionsMap[type] = [];
        
        const idx = comment.reactionsMap[type].indexOf(me);
        if (idx > -1) {
            comment.reactionsMap[type].splice(idx, 1);
            if (comment.reactionsMap[type].length === 0) delete comment.reactionsMap[type];
        } else {
            comment.reactionsMap[type].push(me);
        }
        
        this._personalize(post);
        document.dispatchEvent(new CustomEvent('cycle:post_updated', { detail: post }));

        await PostsAPI.reactComment(postId, commentId, type); 
    }
    
    async deletePost(postId) { await PostsAPI.deletePost(postId); }
}