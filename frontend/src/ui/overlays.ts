import { go, errMsg } from "../api";
import { state } from "../state";
import type { SearchAllResult } from "../types";
import { fileName } from "../markdown/links";
import { highlightQuery, jumpToLine, openFile, readerEl } from "./viewer";
import { icons } from "./icons";
import { escHtml } from "./util";
import { toast } from "./toast";

/* ================= Ctrl+P — быстрый переход к файлу ================= */

let palRoot: HTMLDivElement | null = null;
let palInput: HTMLInputElement;
let palList: HTMLDivElement;
let palCount: HTMLSpanElement;
let palItems: { path: string; el: HTMLElement }[] = [];
let palActive = 0;
let palTimer: number | undefined;

/** Открывает палитру файлов (Ctrl+P). Повторный вызов закрывает. */
export function openPalette(): void {
    if (!state.root) {
        toast("Сначала откройте папку проекта", "info");
        return;
    }
    if (palRoot?.classList.contains("open")) {
        closePalette();
        return;
    }
    if (!palRoot) buildPalette();
    palRoot!.classList.add("open");
    palInput.value = "";
    void updatePalette("");
    palInput.focus();
}

function closePalette(): void {
    palRoot?.classList.remove("open");
}

function buildPalette(): void {
    palRoot = document.createElement("div");
    palRoot.className = "overlay";
    palRoot.innerHTML = `
        <div class="palette" role="dialog" aria-label="Быстрый переход">
            <div class="palette-input-row">${icons.search}
                <input type="text" placeholder="К файлу… имя или путь"/>
                <span class="palette-count"></span>
            </div>
            <div class="palette-list"></div>
            <div class="palette-hints">
                <span><kbd>↑</kbd><kbd>↓</kbd> выбор</span>
                <span><kbd>Enter</kbd> открыть</span>
                <span><kbd>Esc</kbd> закрыть</span>
            </div>
        </div>`;
    document.getElementById("overlay-root")!.append(palRoot);
    palInput = palRoot.querySelector("input")!;
    palList = palRoot.querySelector(".palette-list")!;
    palCount = palRoot.querySelector(".palette-count")!;

    palRoot.addEventListener("mousedown", (e) => {
        if (e.target === palRoot) closePalette();
    });
    palInput.addEventListener("input", () => void updatePalette(palInput.value));
    palInput.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            movePal(1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            movePal(-1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            activatePal();
        }
    });
}

function updatePalette(q: string): void {
    window.clearTimeout(palTimer);
    palTimer = window.setTimeout(async () => {
        if (!state.root) return;
        let files: string[];
        if (!q.trim()) {
            const recents = state.settings?.recents[state.root] ?? [];
            const all = await go().SearchFiles(state.root, "").catch(() => []);
            files = [...recents, ...all.filter((f) => !recents.includes(f))].slice(0, 50);
        } else {
            files = await go().SearchFiles(state.root, q).catch(() => []);
        }
        renderPalList(files, q.trim());
    }, 120);
}

function renderPalList(files: string[], q: string): void {
    palItems = files.map((f) => {
        const el = document.createElement("div");
        el.className = "pal-item";
        el.innerHTML =
            `<div class="pal-name">${markMatch(fileName(f), q)}</div>` +
            `<div class="pal-path">${escHtml(f)}</div>`;
        el.addEventListener("click", () => {
            closePalette();
            void openFile(f);
        });
        return { path: f, el };
    });
    palList.innerHTML = "";
    if (!palItems.length) {
        palList.innerHTML = `<div class="pal-empty">Ничего не найдено</div>`;
        palCount.textContent = "";
        return;
    }
    palItems.forEach((x) => palList.append(x.el));
    palActive = 0;
    palItems[0].el.classList.add("active");
    palCount.textContent = String(palItems.length);
}

function markMatch(name: string, q: string): string {
    if (!q) return escHtml(name);
    const i = name.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return escHtml(name);
    return (
        escHtml(name.slice(0, i)) +
        "<mark>" +
        escHtml(name.slice(i, i + q.length)) +
        "</mark>" +
        escHtml(name.slice(i + q.length))
    );
}

function movePal(delta: number): void {
    if (!palItems.length) return;
    palItems[palActive].el.classList.remove("active");
    palActive = (palActive + delta + palItems.length) % palItems.length;
    palItems[palActive].el.classList.add("active");
    palItems[palActive].el.scrollIntoView({ block: "nearest" });
}

function activatePal(): void {
    const item = palItems[palActive];
    if (!item) return;
    closePalette();
    void openFile(item.path);
}

/* ================= Ctrl+Shift+F — поиск по проекту ================= */

let srchRoot: HTMLDivElement | null = null;
let srchInput: HTMLInputElement;
let srchList: HTMLDivElement;
let srchCount: HTMLSpanElement;
let srchTimer: number | undefined;

/** Открывает панель поиска по всем файлам (Ctrl+Shift+F). */
export function openSearch(): void {
    if (!state.root) {
        toast("Сначала откройте папку проекта", "info");
        return;
    }
    if (!srchRoot) buildSearch();
    srchRoot!.classList.add("open");
    srchInput.focus();
    srchInput.select();
}

function closeSearch(): void {
    srchRoot?.classList.remove("open");
}

function buildSearch(): void {
    srchRoot = document.createElement("div");
    srchRoot.className = "overlay";
    srchRoot.innerHTML = `
        <div class="palette palette--search" role="dialog" aria-label="Поиск по проекту">
            <div class="palette-input-row">${icons.search}
                <input type="text" placeholder="Что искать по всем файлам проекта…"/>
                <span class="palette-count"></span>
            </div>
            <div class="palette-list"></div>
            <div class="palette-hints">
                <span><kbd>Enter</kbd> первое совпадение</span>
                <span><kbd>Esc</kbd> закрыть</span>
            </div>
        </div>`;
    document.getElementById("overlay-root")!.append(srchRoot);
    srchInput = srchRoot.querySelector("input")!;
    srchList = srchRoot.querySelector(".palette-list")!;
    srchCount = srchRoot.querySelector(".palette-count")!;

    srchRoot.addEventListener("mousedown", (e) => {
        if (e.target === srchRoot) closeSearch();
    });
    srchInput.addEventListener("input", () => {
        window.clearTimeout(srchTimer);
        srchTimer = window.setTimeout(() => void doSearch(srchInput.value), 250);
    });
    srchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            void doSearch(srchInput.value);
        }
    });
}

async function doSearch(q: string): Promise<void> {
    if (!state.root) return;
    if (!q.trim()) {
        renderSearch(null);
        return;
    }
    srchCount.textContent = "…";
    try {
        const res = await go().SearchAll(state.root, q);
        renderSearch(res, q.trim());
    } catch (e) {
        renderSearch(null);
        toast(errMsg(e));
    }
}

function renderSearch(res: SearchAllResult | null, q = ""): void {
    if (!res) {
        srchList.innerHTML =
            `<div class="pal-empty">Введите запрос — поиск по всем .md файлам проекта</div>`;
        srchCount.textContent = "";
        return;
    }
    if (!res.total) {
        srchList.innerHTML = `<div class="pal-empty">Ничего не найдено</div>`;
        srchCount.textContent = "0";
        return;
    }
    srchCount.textContent = `${res.total} совп. в ${res.fileCount} файлах · ${res.ms} мс`;
    srchList.innerHTML = "";
    for (const f of res.files) {
        const group = document.createElement("div");
        group.className = "srch-group";
        group.innerHTML =
            `<div class="srch-file">${icons.file}<span>${escHtml(f.path)}</span>` +
            `<span class="srch-count">${f.count}</span></div>`;
        for (const hit of f.hits) {
            const row = document.createElement("div");
            row.className = "srch-hit";
            row.innerHTML =
                `<span class="srch-line">${hit.line}</span>` +
                `<span class="srch-text">${escHtml(hit.text)}</span>`;
            row.addEventListener("click", () => void openHit(f.path, hit.line, q));
            group.append(row);
        }
        srchList.append(group);
    }
    if (res.truncated) {
        const note = document.createElement("div");
        note.className = "srch-note";
        note.textContent = "Показаны первые результаты";
        srchList.append(note);
    }
}

async function openHit(path: string, line: number, q: string): Promise<void> {
    closeSearch();
    await openFile(path);
    highlightQuery(readerEl, q);
    jumpToLine(line);
}

/* ================= общее ================= */

/** Закрывает все открытые оверлеи. */
export function closeAllOverlays(): void {
    closePalette();
    closeSearch();
}

/** Открыт ли какой-нибудь оверлей. */
export function overlayOpen(): boolean {
    return (
        palRoot?.classList.contains("open") === true ||
        srchRoot?.classList.contains("open") === true
    );
}
