// js/utils/SearchEngine.js

export class SearchEngine {
    constructor() {
        // Карта переключения раскладки (QWERTY <-> ЙЦУКЕН)
        this.layoutMap = {
            'q':'й', 'w':'ц', 'e':'у', 'r':'к', 't':'е', 'y':'н', 'u':'г', 'i':'ш', 'o':'щ', 'p':'з', '[':'х', ']':'ъ',
            'a':'ф', 's':'ы', 'd':'в', 'f':'а', 'g':'п', 'h':'р', 'j':'о', 'k':'л', 'l':'д', ';':'ж', '\'':'э',
            'z':'я', 'x':'ч', 'c':'с', 'v':'м', 'b':'и', 'n':'т', 'm':'ь', ',':'б', '.':'ю', '`':'ё'
        };
        this.reverseLayoutMap = {};
        Object.keys(this.layoutMap).forEach(key => {
            this.reverseLayoutMap[this.layoutMap[key]] = key;
        });

        // Карта транслитерации (РУС -> АНГЛ)
        this.translitMap = {
            'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'yo', 'ж':'zh',
            'з':'z', 'и':'i', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o',
            'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'h', 'ц':'ts',
            'ч':'ch', 'ш':'sh', 'щ':'sch', 'ь':'', 'ы':'y', 'ъ':'', 'э':'e', 'ю':'yu', 'я':'ya'
        };
    }

    // 1. Исправление раскладки (ghbdtn -> привет)
    fixLayout(text) {
        let result = '';
        for (let char of text) {
            if (this.layoutMap[char]) result += this.layoutMap[char];
            else if (this.reverseLayoutMap[char]) result += this.reverseLayoutMap[char];
            else result += char;
        }
        return result;
    }

    // 2. Транслитерация (киберпанк -> kiberpank)
    transliterate(text) {
        let result = '';
        for (let char of text) {
            result += this.translitMap[char] !== undefined ? this.translitMap[char] : char;
        }
        return result;
    }

    // 3. Расстояние Левенштейна (Опечатки)
    getLevenshteinDistance(a, b) {
        if (Math.abs(a.length - b.length) > 3) return 99; 
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        return matrix[b.length][a.length];
    }

    // 4. Главный метод поиска
    search(items, query, fields = [{ field: 'title', weight: 1 }]) {
        if (!query || !query.trim()) return items;

        const qOriginal = query.toLowerCase().trim();
        const qFixed = this.fixLayout(qOriginal);
        const qTranslit = this.transliterate(qOriginal); // Добавили транслит

        // Собираем все варианты слов, которые мог иметь в виду пользователь
        const tokens = [...new Set([
            ...qOriginal.split(/\s+/), 
            ...qFixed.split(/\s+/),
            ...qTranslit.split(/\s+/)
        ])];

        const scoredItems = items.map(item => {
            let score = 0;

            fields.forEach(fieldInfo => {
                const fieldName = typeof fieldInfo === 'string' ? fieldInfo : fieldInfo.field;
                const weight = typeof fieldInfo === 'string' ? 1 : (fieldInfo.weight || 1);

                if (!item[fieldName]) return;

                const itemText = item[fieldName].toString().toLowerCase();
                const itemTokens = itemText.split(/\s+/);

                // --- ШАГ 1: Идеальное совпадение ---
                if (itemText === qOriginal || itemText === qFixed || itemText === qTranslit) {
                    score += 500 * weight;
                }

                // --- ШАГ 2: Вхождение фразы целиком ---
                if (itemText.includes(qOriginal) || itemText.includes(qFixed) || itemText.includes(qTranslit)) {
                    score += 100 * weight;
                }

                // --- ШАГ 3: Пословный поиск и Опечатки ---
                tokens.forEach(token => {
                    if (token.length < 2) return;

                    if (itemText.includes(token)) {
                        score += 20 * weight;
                    }

                    if (token.length >= 4) {
                        itemTokens.forEach(itemToken => {
                            const distance = this.getLevenshteinDistance(token, itemToken);
                            if (distance === 1) score += 10 * weight; 
                            else if (distance === 2 && token.length > 5) score += 5 * weight; 
                        });
                    }
                });
            });

            return { item, score };
        });

        return scoredItems
            .filter(res => res.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(res => res.item);
    }
}