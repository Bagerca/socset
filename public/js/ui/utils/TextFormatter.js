// public/js/ui/utils/TextFormatter.js

export class TextFormatter {
    static escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    static parse(rawText) {
        if (!rawText) return '';
        
        // 1. Защита от XSS (превращаем теги в безопасные символы)
        let html = this.escapeHTML(rawText);

        // 2. ССЫЛКИ [url=https://...]Текст[/url]
        // Выполняем до других тегов, чтобы защитить href от парсинга
        html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (match, url, text) => {
            const cleanUrl = this.sanitizeUrl(url);
            if (!cleanUrl) return text; // Если URL опасный, выводим просто текст
            return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="cycle-link">${text}</a>`;
        });

        // 3. БЛОКИ (Центр, Право)
        // Убираем \n вокруг блоков, чтобы не было пустых дыр в верстке
        html = html.replace(/\n?\[center\]([\s\S]*?)\[\/center\]\n?/gi, '<div class="cycle-text-center">$1</div>');
        html = html.replace(/\n?\[right\]([\s\S]*?)\[\/right\]\n?/gi, '<div class="cycle-text-right">$1</div>');

        // 4. РАЗМЕРЫ
        html = html.replace(/\[large\]([\s\S]*?)\[\/large\]/gi, '<span class="cycle-text-large">$1</span>');
        html = html.replace(/\[small\]([\s\S]*?)\[\/small\]/gi, '<span class="cycle-text-small">$1</span>');

        // 5. ИНЛАЙН ФОРМАТИРОВАНИЕ (Жирный, Подчеркнутый, Спойлер)
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        html = html.replace(/__(.*?)__/g, '<u class="cycle-text-underline">$1</u>');
        html = html.replace(/\|\|(.*?)\|\|/g, '<span class="post-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');

        // 6. ЦИТАТЫ (Старый стандарт: > текст)
        html = html.replace(/(?:^|\n)&gt; (.*)/g, '<div class="post-quote">$1</div>');
        
        // Подчищаем лишние переносы после закрытия блочных элементов
        html = html.replace(/<\/div>\n/g, '</div>');

        return html;
    }

    // Жесткая валидация URL-адресов
    static sanitizeUrl(url) {
        let decoded = url.replace(/&amp;/g, '&').trim();
        // Автоматически подставляем https:// если пользователь забыл
        if (!/^https?:\/\//i.test(decoded)) {
            decoded = 'https://' + decoded;
        }
        
        try {
            const parsed = new URL(decoded);
            // Разрешаем только безопасные протоколы (никаких javascript:alert())
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.href;
            }
        } catch (e) {
            return null;
        }
        return null;
    }
}