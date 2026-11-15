export interface FileNode {
    name: string;
    /** Относительный путь от корня проекта, разделитель «/» */
    path: string;
    isDir: boolean;
    /** Дата изменения (мс) — для сортировки «по дате» */
    modifiedAt?: number;
    children?: FileNode[];
}

/** Режим сортировки дерева. */
export type SortMode = "name" | "name-desc" | "modified";

/**
 * Именованная маска: glob-правила фильтрации дерева.
 * Правило без «/» сверяется с именем на любой глубине («drafts»),
 * с «/» — с путём от корня («docs/**»). `**` — любое число сегментов.
 */
export interface Mask {
    name: string;
    /** выбранные каталоги: показывать только файлы в них ("" — файлы в корне) */
    dirs: string[];
    /** пусто = показывать всё (кроме exclude) */
    include: string[];
    exclude: string[];
    sort: SortMode;
}

export interface FileContent {
    path: string;
    content: string;
    modifiedAt: number;
}

export interface SearchHit {
    line: number;
    text: string;
}

export interface SearchFileResult {
    path: string;
    count: number;
    hits: SearchHit[];
}

export interface SearchAllResult {
    files: SearchFileResult[];
    total: number;
    fileCount: number;
    truncated: boolean;
    ms: number;
}

export type ThemeName = "dark" | "light";

export interface Settings {
    theme: ThemeName;
    lastProject: string | null;
    recentRoots: string[];
    /** проект → последний открытый файл */
    lastFiles: Record<string, string>;
    /** проект → недавние файлы */
    recents: Record<string, string[]>;
    /** проект → развёрнутые папки дерева */
    expanded: Record<string, string[]>;
    /** проект → именованные маски фильтрации */
    masks: Record<string, Mask[]>;
    /** проект → имя активной маски ("" или нет записи = все файлы) */
    activeMask: Record<string, string>;
    /** проект → сортировка дерева без маски */
    sorts: Record<string, SortMode>;
    /** проект → избранные файлы */
    favorites: Record<string, string[]>;
    sidebarWidth: number;
    sidebarHidden: boolean;
    tocHidden: boolean;
    zoom: number;
}

export function defaultSettings(): Settings {
    return {
        theme: "dark",
        lastProject: null,
        recentRoots: [],
        lastFiles: {},
        recents: {},
        expanded: {},
        masks: {},
        activeMask: {},
        sorts: {},
        favorites: {},
        sidebarWidth: 280,
        sidebarHidden: false,
        tocHidden: false,
        zoom: 1,
    };
}
