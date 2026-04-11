// public/js/services/OfflineQueueManager.js
import { PostsAPI } from '../api/PostsAPI.js';

export class OfflineQueueManager {
    constructor(postsStore) {
        this.postsStore = postsStore;
        this.queue = [];
        this.init();
    }

    async init() {
        if (window.localforage) {
            this.queue = (await localforage.getItem('cycle_offline_queue')) || [];
            window.addEventListener('online', () => this.sync());
            setInterval(() => this.sync(), 15000);
        }
    }

    async add(task) {
        this.queue.push(task);
        await this.save();
    }

    async save() {
        if (window.localforage) {
            await localforage.setItem('cycle_offline_queue', this.queue);
        }
    }

    async sync() {
        if (!navigator.onLine || this.queue.length === 0) return;
        
        const queueCopy = [...this.queue];
        this.queue = []; 
        await this.save();

        for (const task of queueCopy) {
            try {
                if (task.action === 'addPost') {
                    const data = await PostsAPI.createPost(task.payload);
                    if (data.success) {
                        this.postsStore.handleOfflinePostSuccess(task.tempId, data.post);
                    }
                } else if (task.action === 'addComment') {
                    const data = await PostsAPI.addComment(task.payload.postId, task.payload.comment);
                    if (data.success) {
                        this.postsStore.handleOfflineCommentSuccess(task.payload.postId, task.tempId, data.comment);
                    }
                }
            } catch (e) {
                task.retries = (task.retries || 0) + 1;
                if (task.retries < 3) {
                    this.queue.push(task);
                } else {
                    console.warn('[OfflineQueue] Битый запрос удален после 3 попыток:', task);
                }
                await this.save();
            }
        }
    }

    getPendingPosts(targetId, feedType) {
        return this.queue.filter(t => t.action === 'addPost').reverse();
    }
}