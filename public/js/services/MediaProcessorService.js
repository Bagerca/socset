// public/js/services/MediaProcessorService.js

export class MediaProcessorService {
    /**
     * Сжимает изображение перед отправкой на сервер.
     * Возвращает новый объект File.
     */
    static async compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    
                    if (w > maxWidth || h > maxHeight) {
                        const ratio = Math.min(maxWidth / w, maxHeight / h);
                        w *= ratio; 
                        h *= ratio;
                    }
                    
                    canvas.width = w; 
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], "image.jpg", { type: "image/jpeg" }));
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(file); 
            };
            reader.onerror = () => resolve(file);
        });
    }
}