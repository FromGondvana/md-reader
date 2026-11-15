import type { FileContent, FileNode, SearchAllResult } from "./types";

/** Типизированный доступ к Go-привязкам Wails (window.go.main.App). */
interface GoApp {
    ChooseFolder(title: string): Promise<string>;
    LoadTree(root: string, optsJson: string): Promise<FileNode>;
    ReadFile(root: string, rel: string): Promise<FileContent>;
    ReadFileBase64(root: string, rel: string): Promise<string>;
    SearchAll(root: string, query: string): Promise<SearchAllResult>;
    SearchFiles(root: string, query: string): Promise<string[]>;
    GetSettings(): Promise<string>;
    SaveSettings(json: string): Promise<void>;
    StartWatch(root: string): Promise<void>;
    StopWatch(): Promise<void>;
    OpenExternal(url: string): Promise<void>;
    SetWindowTitle(title: string): Promise<void>;
    TakeStartupFile(): Promise<string>;
    // ---- редактирование ----
    WriteFile(root: string, rel: string, content: string): Promise<void>;
    CreateFile(root: string, rel: string): Promise<void>;
    CreateFolder(root: string, rel: string): Promise<void>;
    RenameEntry(root: string, rel: string, newName: string): Promise<void>;
    DeleteEntry(root: string, rel: string): Promise<void>;
    // ---- экспорт ----
    ExportHTML(fileName: string, html: string): Promise<string>;
    // ---- поиск с заменой ----
    ReplaceInFiles(
        root: string,
        query: string,
        replacement: string,
        files: string[],
        caseSensitive: boolean,
    ): Promise<number>;
}

declare global {
    interface Window {
        go?: { main?: { App?: GoApp } };
        runtime?: {
            EventsOn?: (name: string, cb: (...data: never[]) => void) => void;
            OnFileDrop?: (
                cb: (x: number, y: number, paths: string[]) => void,
                useDropTarget: boolean,
            ) => void;
            WindowSetTitle?: (title: string) => void;
            ClipboardSetText?: (text: string) => Promise<boolean>;
        };
    }
}

export function go(): GoApp {
    const app = window.go?.main?.App;
    if (!app) {
        throw new Error(
            "Wails runtime недоступен. Запустите приложение через «wails dev» или собранный exe.",
        );
    }
    return app;
}

export function rt(): NonNullable<Window["runtime"]> | undefined {
    return window.runtime;
}

/** Приводит ошибку любого вида к читаемой строке. */
export function errMsg(e: unknown): string {
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "message" in e) {
        return String((e as { message: unknown }).message);
    }
    return String(e);
}

/** Копирование в буфер обмена с резервными вариантами. */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // без прав/жеста — пробуем рантайм Wails
        try {
            const set = window.runtime?.ClipboardSetText;
            if (set && (await set(text))) return true;
        } catch {
            // игнорируем
        }
        // последний резерв: скрытая textarea + execCommand
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.append(ta);
            ta.select();
            const ok = document.execCommand("copy");
            ta.remove();
            return ok;
        } catch {
            return false;
        }
    }
}
