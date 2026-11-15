export interface FileNode {
    name: string;
    /** Относительный путь от корня проекта, разделитель «/» */
    path: string;
    isDir: boolean;
    children?: FileNode[];
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
        sidebarWidth: 280,
        sidebarHidden: false,
        tocHidden: false,
        zoom: 1,
    };
}
