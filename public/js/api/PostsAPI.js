// public/js/api/PostsAPI.js
import { httpClient } from './httpClient.js';

export const PostsAPI = {
    getPost: (postId) => httpClient.get(`/post/${postId}`), // <--- ДОБАВЛЕНО
    
    getPosts: (page = 1, limit = 10, targetId = null, feedType = 'main', extraIds =[]) => {
        let url = `/posts?page=${page}&limit=${limit}&feedType=${feedType}`;
        if (feedType === 'communities' || feedType === 'main') {
            if (targetId) url += `&communityId=${targetId}`;
        } else if (feedType === 'game') {
            if (targetId) url += `&gameId=${targetId}`;
            if (extraIds.length > 0) url += `&musicIds=${extraIds.join(',')}`;
        }
        return httpClient.get(url);
    },
    createPost: (postData) => httpClient.post('/posts', postData),
    deletePost: (postId) => httpClient.post('/posts/delete', { postId }),
    togglePostVisibility: (postId) => httpClient.post('/posts/visibility', { postId }),
    likePost: (postId) => httpClient.post('/posts/like', { postId }),
    repost: (postId) => httpClient.post('/posts/repost', { postId }),
    votePoll: (postId, optionId) => httpClient.post('/posts/vote', { postId, optionId }),
    addComment: (postId, comment) => httpClient.post('/posts/comment', { postId, comment }),
    deleteComment: (postId, commentId) => httpClient.post('/posts/comment/delete', { postId, commentId }),
    reactComment: (postId, commentId, type) => httpClient.post('/posts/comment/react', { postId, commentId, type })
};