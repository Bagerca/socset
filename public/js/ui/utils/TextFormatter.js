// public/js/ui/utils/TextFormatter.js

export class TextFormatter {
    static escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    static sanitizeUrl(url) {
        let decoded = url.replace(/&amp;/g, '&').trim();
        // Подставляем протокол, если юзер ввел просто "youtube.com"
        if (!/^https?:\/\//i.test(decoded)) {
            decoded = 'https://' + decoded;
        }
        try {
            const parsed = new URL(decoded);
            // Разрешаем только безопасные протоколы
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.href;
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    static parse(rawText) {
        if (!rawText) return '';

        // 1. Экранирование HTML (Защита от XSS)
        let text = this.escapeHTML(rawText);

        // 2. Ссылки (Обрабатываем первыми, чтобы защитить саму ссылку от форматирования)
        // Пример: [url=test.com]Мой __сайт__[/url] -> <a href="...">Мой __сайт__</a>
        text = text.replace(/\[url=([^\]]+?)\]([\s\S]+?)\[\/url\]/gi, (match, url, linkText) => {
            const cleanUrl = this.sanitizeUrl(url);
            return cleanUrl ? `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="cycle-link">${linkText}</a>` : linkText;
        });

        // 3. Блочные элементы и размеры
        const blockTags = [
            { bb: 'center', open: '<div class="cycle-text-center">', close: '</div>' },
            { bb: 'right', open: '<div class="cycle-text-right">', close: '</div>' },
            { bb: 'large', open: '<span class="cycle-text-large">', close: '</span>' },
            { bb: 'small', open: '<span class="cycle-text-small">', close: '</span>' }
        ];

        blockTags.forEach(t => {
            const regex = new RegExp(`\\[${t.bb}\\]([\\s\\S]*?)\\[\\/${t.bb}\\]`, 'gi');
            let prev;
            // Делаем в цикле на случай вложенности одинаковых тегов (например [center][center]...[/center][/center])
            do {
                prev = text;
                text = text.replace(regex, `${t.open}$1${t.close}`);
            } while (text !== prev);
        });

        // 4. Инлайн форматирование (Жирный, Подчеркнутый, Спойлер)
        // Запускаем в цикле, чтобы легко "переваривать" пересечения вроде **__текст__**
        let prevInline;
        do {
            prevInline = text;
            text = text.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
            text = text.replace(/__([\s\S]+?)__/g, '<u class="cycle-text-underline">$1</u>');
            text = text.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="post-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
        } while (text !== prevInline);

        // 5. Цитаты (Интеллектуальная обработка многострочных цитат)
        // Разбиваем на строки, чтобы аккуратно склеить несколько > в один красивый блок
        const lines = text.split('\n');
        let inQuote = false;
        let resultHtml = '';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Ищем строку, начинающуюся с > (с учетом экранирования &gt; и пробелов)
            if (/^\s*&gt;/.test(line)) {
                const quoteText = line.replace(/^\s*&gt;\s?/, ''); // Убираем саму стрелочку
                
                if (!inQuote) {
                    resultHtml += `<div class="post-quote">`;
                    inQuote = true;
                } else {
                    resultHtml += `<br>`; // Если это вторая строка цитаты, просто делаем перенос внутри блока
                }
                resultHtml += quoteText;
            } else {
                if (inQuote) {
                    resultHtml += `</div>`; // Закрываем блок цитаты, если следующая строка обычная
                    inQuote = false;
                }
                resultHtml += line + (i < lines.length - 1 ? '\n' : '');
            }
        }
        
        // Закрываем цитату, если она была в самом конце текста
        if (inQuote) {
            resultHtml += `</div>`;
        }
        text = resultHtml;

        // 6. Финальная очистка переносов строк
        // Превращаем оставшиеся \n в <br>
        text = text.replace(/\n/g, '<br>');
        
        // Убираем уродливые пустые отступы (<br>) сразу до или после блочных элементов <div>
        text = text.replace(/<br>\s*<div/g, '<div');
        text = text.replace(/<\/div>\s*<br>/g, '</div>');

        return text;
    }
}