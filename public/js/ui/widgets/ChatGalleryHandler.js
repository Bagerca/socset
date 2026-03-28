// public/js/ui/widgets/ChatGalleryHandler.js

export class ChatGalleryHandler {
    constructor() {
        this.currentImageGallery = [];
        this.currentImageIndex = 0;
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            const imgTarget = e.target.closest('.cycle-media-img') || e.target.closest('.cd-media-thumb');
            if (imgTarget) { 
                e.preventDefault();
                const url = imgTarget.dataset.url || imgTarget.src; 
                
                const grid = imgTarget.closest('.msg-image-grid');
                if (grid && grid.dataset.images) {
                    this.currentImageGallery = grid.dataset.images.split(',');
                    this.currentImageIndex = this.currentImageGallery.indexOf(url);
                    if (this.currentImageIndex === -1) this.currentImageIndex = 0;
                } else {
                    this.currentImageGallery = [url];
                    this.currentImageIndex = 0;
                }

                if (url) { 
                    this.updateModal();
                    document.getElementById('chatImageModal').classList.add('active'); 
                } 
            }
            
            const chatImageModal = document.getElementById('chatImageModal');
            if (chatImageModal && chatImageModal.classList.contains('active')) { 
                if (e.target.closest('#closeChatImageModal') || e.target === chatImageModal || e.target.classList.contains('modal-content')) { 
                    chatImageModal.classList.remove('active'); 
                } 
            }
        });

        document.getElementById('prevChatImageBtn')?.addEventListener('click', (e) => { e.stopPropagation(); this.changeImage(-1); });
        document.getElementById('nextChatImageBtn')?.addEventListener('click', (e) => { e.stopPropagation(); this.changeImage(1); });

        document.addEventListener('keydown', (e) => {
            const chatImageModal = document.getElementById('chatImageModal');
            if (chatImageModal && chatImageModal.classList.contains('active')) {
                if (e.key === 'Escape') chatImageModal.classList.remove('active');
                if (e.key === 'ArrowLeft') this.changeImage(-1);
                if (e.key === 'ArrowRight') this.changeImage(1);
            }
        });
    }

    updateModal() {
        const url = this.currentImageGallery[this.currentImageIndex];
        document.getElementById('chatFullImage').src = url; 
        document.getElementById('downloadChatImageBtn').href = url; 
        
        const prevBtn = document.getElementById('prevChatImageBtn');
        const nextBtn = document.getElementById('nextChatImageBtn');
        const counter = document.getElementById('chatImageCounter');

        if (this.currentImageGallery.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
            counter.style.display = 'block';
            counter.textContent = `${this.currentImageIndex + 1} / ${this.currentImageGallery.length}`;
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            counter.style.display = 'none';
        }
    }

    changeImage(direction) {
        if (this.currentImageGallery.length <= 1) return;
        const total = this.currentImageGallery.length;
        this.currentImageIndex = (this.currentImageIndex + direction + total) % total;
        this.updateModal();
    }
}