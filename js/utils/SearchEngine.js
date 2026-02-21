// js/utils/SearchEngine.js

export class SearchEngine {
    constructor() {
        // Карта переключения раскладки (QWERTY <-> ЙЦУКЕН)
        this.layoutMap = {
            'q':'й', 'w':'ц', 'e':'у', 'r':'к', 't':'е', 'y':'н', 'u':'г', 'i':'ш', 'o':'щ', 'p':'з', '[':'х', ']':'ъ',
            'a':'ф', 's':'ы', 'd':'в', 'f':'а', 'g':'п', 'h':'р', 'j':'о', 'k':'л', 'l':'д', ';':'ж', '\'':'э',
            'z':'я', 'x':'ч', 'c':'с', 'v':'м', 'b':'и', 'n':'т', 'm':'ь', ',':'б', '.':'ю', '`':'ё'
        };
        // Создаем обратную карту
        this.reverseLayoutMap = {};
        Object.keys(this.layoutMap).forEach(key => {
            this.reverseLayoutMap[this.layoutMap[key]] = key;
        });
    }

    // Метод исправления раскладки (ghbdtn -> привет)
    fixLayout(text) {
        let result = '';
        for (let char of text.toLowerCase()) {
            if (this.layoutMap[char]) result += this.layoutMap[char];
            else if (this.reverseLayoutMap[char]) result += this.reverseLayoutMap[char];
            else result += char;
        }
        return result;
    }

    // Основной метод поиска
    search(items, query, fields = ['title', 'artist']) {
        if (!query) return items;

        const qOriginal = query.toLowerCase().trim();
        const qFixed = this.fixLayout(qOriginal);
        
        // Разбиваем запрос на слова для более точного поиска
        const searchTerms = [qOriginal, qFixed].filter(t => t.length > 0);

        return items.filter(item => {
            // Собираем весь текст из нужных полей (название, артист) в одну строку
            const itemText = fields.map(field => item[field] ? item[field].toLowerCase() : '').join(' ');
            
            // Проверяем: либо оригинальный запрос, либо исправленный должны входить в текст
            return searchTerms.some(term => itemText.includes(term));
        });
    }
}