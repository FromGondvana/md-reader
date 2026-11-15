import { go } from "./api";
import { defaultSettings, type FileNode, type Mask, type Settings, type SortMode } from "./types";

export interface HistoryEntry {
    path: string;
    anchor?: string;
    scrollTop?: number;
}

/** Глобальное состояние приложения. */
export const state = {
    settings: null as Settings | null,
    root: null as string | null,
    projectName: "",
    tree: null as FileNode | null,
    files: [] as string[],
    fileSet: new Set<string>(),
    current: null as string | null,
    expanded: new Set<string>(),
    history: [] as HistoryEntry[],
    historyIdx: -1,
};

/* ================= маски и сортировка ================= */

/** Активная маска проекта (или null — показывать все файлы). */
export function activeMask(): Mask | null {
    const s = state.settings;
    if (!s || !state.root) return null;
    const name = s.activeMask[state.root];
    if (!name) return null;
    return (s.masks[state.root] ?? []).find((m) => m.name === name) ?? null;
}

/** Сортировка без маски (по умолчанию — по имени). */
export function currentSort(): SortMode {
    const m = activeMask();
    if (m) return m.sort || "name";
    const s = state.settings;
    return (s && state.root ? s.sorts[state.root] : undefined) ?? "name";
}

/** JSON-опции для LoadTree: активная маска либо сортировка проекта. */
export function treeOptsJson(): string {
    const m = activeMask();
    if (m) {
        return JSON.stringify({ include: m.include, exclude: m.exclude, sort: m.sort ?? "name" });
    }
    const sort = currentSort();
    return sort === "name" ? "" : JSON.stringify({ sort });
}

/* ================= избранное ================= */

export function favorites(): string[] {
    const s = state.settings;
    return (s && state.root ? s.favorites[state.root] : undefined) ?? [];
}

export function isFavorite(path: string): boolean {
    return favorites().includes(path);
}

export function toggleFavorite(path: string): void {
    const s = state.settings;
    if (!s || !state.root) return;
    const list = s.favorites[state.root] ?? [];
    const idx = list.indexOf(path);
    if (idx >= 0) list.splice(idx, 1);
    else list.unshift(path);
    s.favorites[state.root] = list.slice(0, 50);
    saveSettings();
}

export function pushHistory(loc: HistoryEntry): void {
    state.history = state.history.slice(0, state.historyIdx + 1);
    state.history.push(loc);
    if (state.history.length > 300) state.history.shift();
    state.historyIdx = state.history.length - 1;
}

export function rootName(p: string): string {
    const norm = p.replace(/[\\/]+$/, "");
    const i = Math.max(norm.lastIndexOf("\\"), norm.lastIndexOf("/"));
    return i >= 0 ? norm.slice(i + 1) : norm;
}

let saveTimer: number | undefined;

/** Отложенное сохранение настроек. */
export function saveSettings(): void {
    const s = state.settings;
    if (!s) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        go()
            .SaveSettings(JSON.stringify(s))
            .catch(() => {});
    }, 400);
}

export async function loadSettings(): Promise<Settings> {
    try {
        const raw = await go().GetSettings();
        return { ...defaultSettings(), ...(JSON.parse(raw || "{}") as Partial<Settings>) };
    } catch {
        return defaultSettings();
    }
}
