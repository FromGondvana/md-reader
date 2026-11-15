import { go } from "./api";
import { defaultSettings, type FileNode, type Settings } from "./types";

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
