// js/api/UploadAPI.js
import { httpClient } from './httpClient.js';

export const UploadAPI = {
    uploadFile: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return httpClient.post('/upload', formData, true);
    }
};