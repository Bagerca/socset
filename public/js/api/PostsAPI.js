import { httpClient } from './httpClient.js';

export const PostsAPI = {
    getPosts: (page = 1, limit = 10, communityId = null, feedType = 'main') => {
        let url = `/posts?page=${page}&limit=${limit}&feedType=${feedType}`;
        if (communityId) url += `&communityId=${communityId}`;
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