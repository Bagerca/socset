// js/config/GameConstants.js

export const GAME_CONSTANTS = {
    tiers: {
        'tier_indie': { id: 'tier_indie', label: 'Indie', color: '#44bd32' },
        'tier_aa':    { id: 'tier_aa',    label: 'AA',    color: '#f0932b' },
        'tier_aaa':   { id: 'tier_aaa',   label: 'AAA',   color: '#eb4d4b' }
    },

    categories: {
        genre: 'Жанр',
        setting: 'Сеттинг',
        mode: 'Режим',
        vibe: 'Атмосфера'
    },

    tags: {
        // Жанры
        'tag_action':    { id: 'tag_action',    label: 'Экшен',       category: 'genre' },
        'tag_shooter':   { id: 'tag_shooter',   label: 'Шутер',       category: 'genre' },
        'tag_rpg':       { id: 'tag_rpg',       label: 'RPG',         category: 'genre' },
        'tag_strategy':  { id: 'tag_strategy',  label: 'Стратегия',   category: 'genre' },
        'tag_adventure': { id: 'tag_adventure', label: 'Приключение', category: 'genre' },
        'tag_puzzle':    { id: 'tag_puzzle',    label: 'Головоломка', category: 'genre' },
        'tag_sim':       { id: 'tag_sim',       label: 'Симулятор',   category: 'genre' },
        'tag_rogue':     { id: 'tag_rogue',     label: 'Рогалик',     category: 'genre' },
        'tag_survival':  { id: 'tag_survival',  label: 'Выживание',   category: 'genre' },
        'tag_horror':    { id: 'tag_horror',    label: 'Хоррор',      category: 'genre' },
        'tag_platform':  { id: 'tag_platform',  label: 'Платформер',  category: 'genre' },

        // Сеттинг
        'tag_scifi':     { id: 'tag_scifi',     label: 'Sci-Fi',      category: 'setting' },
        'tag_cyberpunk': { id: 'tag_cyberpunk', label: 'Киберпанк',   category: 'setting' },
        'tag_fantasy':   { id: 'tag_fantasy',   label: 'Фэнтези',     category: 'setting' },
        'tag_space':     { id: 'tag_space',     label: 'Космос',      category: 'setting' },
        'tag_postapoc':  { id: 'tag_postapoc',  label: 'Постапокалипсис', category: 'setting' },
        'tag_anime':     { id: 'tag_anime',     label: 'Аниме',       category: 'setting' },
        'tag_retro':     { id: 'tag_retro',     label: 'Ретро',       category: 'setting' },
        'tag_military':  { id: 'tag_military',  label: 'Милитари',    category: 'setting' },

        // Режим
        'tag_single':    { id: 'tag_single',    label: 'Одиночная',   category: 'mode' },
        'tag_multi':     { id: 'tag_multi',     label: 'Мультиплеер', category: 'mode' },
        'tag_coop':      { id: 'tag_coop',      label: 'Кооператив',  category: 'mode' },
        'tag_pvp':       { id: 'tag_pvp',       label: 'PvP',         category: 'mode' },

        // Атмосфера
        'tag_story':     { id: 'tag_story',     label: 'Глубокий сюжет', category: 'vibe' },
        'tag_openworld': { id: 'tag_openworld', label: 'Открытый мир', category: 'vibe' },
        'tag_hardcore':  { id: 'tag_hardcore',  label: 'Сложная',      category: 'vibe' },
        'tag_relax':     { id: 'tag_relax',     label: 'Расслабляющая', category: 'vibe' },
        'tag_pixel':     { id: 'tag_pixel',     label: 'Пиксельная',   category: 'vibe' }
    }
};