// public/js/ui/widgets/DraggableWidget.js

export class DraggableWidget {
    constructor(widgetElement, cssVarX, cssVarY, options = {}) {
        this.widget = widgetElement;
        this.cssVarX = cssVarX;
        this.cssVarY = cssVarY;
        this.dockArea = document.getElementById('rightDockArea');
        
        this.config = {
            margin: 24,                      
            defaultX: 24,
            defaultY: 80,
            ...options
        };

        this.isDragging = false;
        this.isDocked = false;
        this.hasMoved = false; 
        
        this.startMouseX = 0;
        this.startMouseY = 0;
        this.startX = 0;
        this.startY = 0;
        
        this.currentX = this.config.defaultX;
        this.currentY = this.config.defaultY;

        DraggableWidget.topZIndex = DraggableWidget.topZIndex || 10000;

        this.init();
    }

    init() {
        this.updateTransform();

        this.onPointerDown = this.handlePointerDown.bind(this);
        this.onPointerMove = this.handlePointerMove.bind(this);
        this.onPointerUp = this.handlePointerUp.bind(this);
        this.onResize = this.snapToCorners.bind(this);

        this.widget.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp); 
        window.addEventListener('resize', this.onResize);
    }

    handlePointerDown(e) {
        if (e.target.closest('button, input, .fmp-controls-row, .fcw-controls, .fsr-controls-area, .fmp-volume-row')) return;

        this.isDragging = true;
        this.hasMoved = false;
        this.widget.style.zIndex = ++DraggableWidget.topZIndex; 

        this.startMouseX = e.clientX;
        this.startMouseY = e.clientY;

        if (!this.isDocked) {
            this.startX = this.currentX;
            this.startY = this.currentY;
        }

        // --- УМНЫЙ СИЛУЭТ: Считываем размеры и радиус виджета ---
        const rect = this.widget.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(this.widget);
        
        // Передаем их в CSS через корневые переменные
        document.body.style.setProperty('--drag-w', `${rect.width}px`);
        document.body.style.setProperty('--drag-h', `${rect.height}px`);
        document.body.style.setProperty('--drag-r', computedStyle.borderRadius || '20px');
        // ---------------------------------------------------------

        this.widget.style.transition = 'none';
        this.widget.setPointerCapture(e.pointerId);
    }

    handlePointerMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.startMouseX;
        const dy = e.clientY - this.startMouseY;

        if (!this.hasMoved && Math.abs(dx) < 3 && Math.abs(dy) < 3) {
            return;
        }

        if (!this.hasMoved) {
            this.hasMoved = true;
            document.body.classList.add('is-dragging-widget');
            this.widget.classList.add('grabbing');

            if (this.isDocked) {
                const rect = this.widget.getBoundingClientRect();
                this.undock();
                
                this.currentX = rect.left;
                this.currentY = rect.top;
                this.startX = rect.left;
                this.startY = rect.top;
                this.updateTransform();
            }
        }

        this.currentX = this.startX + dx;
        this.currentY = this.startY + dy;
        this.updateTransform();

        if (window.innerWidth > 1100 && this.dockArea) {
            const dockRect = this.dockArea.getBoundingClientRect();
            if (e.clientX >= dockRect.left && e.clientX <= dockRect.right && 
                e.clientY >= dockRect.top && e.clientY <= dockRect.bottom) {
                this.dockArea.classList.add('drag-over');
            } else {
                this.dockArea.classList.remove('drag-over');
            }
        }
    }

    handlePointerUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        try { this.widget.releasePointerCapture(e.pointerId); } catch(err) {}

        if (!this.hasMoved) {
            this.widget.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease';
            return;
        }

        document.body.classList.remove('is-dragging-widget');
        this.widget.classList.remove('grabbing');
        this.widget.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease';

        const isOverDock = window.innerWidth > 1100 && this.dockArea && this.dockArea.classList.contains('drag-over');

        if (isOverDock) {
            if (!this.isDocked) {
                this.dock();
            } else {
                this.widget.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                this.widget.style.transform = '';
                this.dockArea.classList.remove('drag-over');
            }
        } else {
            if (this.isDocked) {
                const visualRect = this.widget.getBoundingClientRect();
                this.undock();
                this.currentX = visualRect.left;
                this.currentY = visualRect.top;
                this.updateTransform();
            }
            
            this.widget.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease';
            this.snapToCorners();
        }
    }

    dock() {
        this.isDocked = true;
        if (this.dockArea) {
            this.dockArea.classList.remove('drag-over');
            this.dockArea.appendChild(this.widget);
        }
        this.widget.classList.add('widget-docked');
        this.widget.style.transform = ''; 

        this.widget.style.setProperty(this.cssVarX, `0px`);
        this.widget.style.setProperty(this.cssVarY, `0px`);
    }

    undock() {
        this.isDocked = false;
        this.widget.classList.remove('widget-docked');
        document.body.appendChild(this.widget);
        this.widget.style.transform = ''; 
    }

    snapToCorners() {
        if (this.widget.classList.contains('hidden') || this.isDocked || this.isDragging) return;

        const w = this.widget.offsetWidth;
        const h = this.widget.offsetHeight;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        const snapLeft = this.config.margin;
        const snapRight = screenW - w - this.config.margin;
        const snapTop = 24; // Теперь виджеты будут прилипать и к самому верху экрана
        const snapBottom = screenH - h - this.config.margin;

        this.currentX = Math.abs(this.currentX - snapLeft) < Math.abs(this.currentX - snapRight) ? snapLeft : snapRight;
        this.currentY = Math.max(snapTop, Math.min(this.currentY, snapBottom)); 

        this.updateTransform();
    }

    updateTransform() {
        this.widget.style.setProperty(this.cssVarX, `${this.currentX}px`);
        this.widget.style.setProperty(this.cssVarY, `${this.currentY}px`);
    }

    reset() {
        if (this.isDocked) this.undock();
        this.currentX = this.config.defaultX;
        this.currentY = this.config.defaultY;
        this.updateTransform();
    }

    destroy() {
        this.widget.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('pointercancel', this.onPointerUp);
        window.removeEventListener('resize', this.onResize);
    }
}