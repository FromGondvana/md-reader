import { state, saveSettings } from "../state";
import type { FileNode } from "../types";
import { openFile } from "./viewer";
import { icons } from "./icons";
import { cssEscape, escHtml } from "./util";

const treeEl = document.getElementById("tree")!;

/** Рисует дерево файлов заново. */
export function renderTree(): void {
    if (!state.tree) {
        treeEl.innerHTML = `<div class="tree-empty">Папка не открыта</div>`;
        return;
    }
    if (!state.files.length) {
        treeEl.innerHTML = `<div class="tree-empty">В этой папке нет .md файлов</div>`;
        return;
    }
    const rows: string[] = [];
    emitNode(state.tree, 0, rows);
    treeEl.innerHTML = rows.join("");
    highlightActive();
}

function emitNode(n: FileNode, depth: number, rows: string[]): void {
    if (n.isDir) {
        const open = state.expanded.has(n.path);
        rows.push(
            `<div class="tree-row dir${open ? " open" : ""}" data-path="${escHtml(n.path)}" data-dir="1" style="--d:${depth}">` +
                `<span class="tree-chev">${icons.chev}</span>${icons.folder}` +
                `<span class="tree-name">${escHtml(n.name)}</span></div>`,
        );
        if (open) {
            for (const c of n.children ?? []) emitNode(c, depth + 1, rows);
        }
    } else {
        rows.push(
            `<div class="tree-row file" data-path="${escHtml(n.path)}" style="--d:${depth}">` +
                `${icons.file}<span class="tree-name">${escHtml(n.name)}</span></div>`,
        );
    }
}

treeEl.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>(".tree-row");
    if (!row) return;
    const path = row.dataset.path ?? "";
    if (row.dataset.dir) {
        if (state.expanded.has(path)) state.expanded.delete(path);
        else state.expanded.add(path);
        persistExpanded();
        renderTree();
    } else {
        void openFile(path);
    }
});

function persistExpanded(): void {
    const s = state.settings;
    if (!s || !state.root) return;
    s.expanded[state.root] = [...state.expanded];
    saveSettings();
}

/** Разворачивает папки-предки файла. */
export function ensureExpanded(path: string): void {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
        state.expanded.add(parts.slice(0, i).join("/"));
    }
    persistExpanded();
}

function highlightActive(): void {
    treeEl.querySelectorAll(".tree-row.active").forEach((x) => x.classList.remove("active"));
    if (!state.current) return;
    const sel = `.tree-row.file[data-path="${state.current.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
    const row = treeEl.querySelector<HTMLElement>(sel);
    if (row) {
        row.classList.add("active");
        const tr = treeEl.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        if (rr.top < tr.top + 8 || rr.bottom > tr.bottom - 8) {
            row.scrollIntoView({ block: "nearest" });
        }
    }
}

export function findTreeRow(path: string): HTMLElement | null {
    return treeEl.querySelector<HTMLElement>(
        `.tree-row[data-path="${cssEscape(path)}"]`,
    );
}
