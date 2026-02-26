import { PostsAPI } from '../api/PostsAPI.js';
import { generateId } from '../utils/utils.js';

export class PostsStore {
    constructor(authStore) {
        this.authStore = authStore;
        this.posts =[];
        this.initSocket();
    }

    initSocket() {
        if (window.io) {
            this.socket = io();
            this.socket.on('new_post', (post) => {
                if (!this.posts.find(p => p.id === post.id)) {
                    this.posts.unshift(this._personalize(post));
                    document.dispatchEvent(new CustomEvent('cycle:posts_updated'));
                }
            });
        }
    }

    async loadPosts(page = 1, targetId = null, feedType = 'main', extraIds =[]) {
        try {
            const newPosts = await PostsAPI.getPosts(page, 10, targetId, feedType, extraIds);
            const processed = newPosts.map(p => this._personalize(p));
            if (page === 1) { 
                this.posts = processed; 
            } else {
                const existingIds = new Set(this.posts.map(p => p.id));
                const uniqueNew = processed.filter(p => !existingIds.has(p.id));
                this.posts = [...this.posts, ...uniqueNew];
            }
            return processed;
        } catch (e) { 
            return[]; 
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

    async addPost(content, pollData = null, attachment = null, communityId = null) {
        let poll = null;
        if (pollData && pollData.options.length >= 2) {
            poll = { options: pollData.options.map(opt => ({ id: 'opt_' + generateId(), text: opt, votes: 0 })), totalVotes: 0, days: pollData.duration || 3, votedBy: {} };
        }
        await PostsAPI.createPost({ content, poll, attachment, communityId });
    }

    async repostPost(postId) { await PostsAPI.repost(postId); }

    async toggleLike(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        post.isLiked ? (post.likes--, post.isLiked = false) : (post.likes++, post.isLiked = true);
        const data = await PostsAPI.likePost(postId);
        if(data.success) {
            post.likes = data.likes; post.likedBy = data.likedBy; post.isLiked = post.likedBy.includes(this.authStore.user.username);
        }
        return post;
    }

    async togglePostVisibility(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return null;
        const data = await PostsAPI.togglePostVisibility(postId);
        if (data.success) { post.visibility = data.visibility; return post; }
        return null;
    }

    async votePoll(postId, optionId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post || !post.poll || post.poll.votedOptionId) return false;
        const data = await PostsAPI.votePoll(postId, optionId);
        if (data.success) { post.poll = data.poll; this._personalize(post); return true; }
        return false;
    }

    async addComment(postId, content, type = 'text', waveform = null) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        const data = await PostsAPI.addComment(postId, { content, type, waveform });
        if(data.success) { post.comments.push(data.comment); this._personalize(post); return data.comment; }
    }

    async deleteComment(postId, commentId) {
        const post = this.posts.find(p => p.id === postId);
        if (post) { post.comments = post.comments.filter(c => c.id !== commentId); await PostsAPI.deleteComment(postId, commentId); }
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

        const data = await PostsAPI.reactComment(postId, commentId, type);
        if (data.success) { comment.reactionsMap = data.reactionsMap; this._personalize(post); }
    }

    async deletePost(postId) {
        this.posts = this.posts.filter(p => p.id !== postId);
        await PostsAPI.deletePost(postId);
    }
}