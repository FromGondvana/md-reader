import { go, errMsg } from "../api";
import { state, saveSettings, isFavorite, toggleFavorite } from "../state";
import type { FileNode } from "../types";
import { openFile } from "./viewer";
import { icons } from "./icons";
import { cssEscape, escHtml } from "./util";
import { askConfirm, askName } from "./ask";
import { toast } from "./toast";
import { refreshAll } from "../project";

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
        const fav = isFavorite(n.path);
        rows.push(
            `<div class="tree-row file${fav ? " fav" : ""}" data-path="${escHtml(n.path)}" style="--d:${depth}">` +
                `${icons.file}<span class="tree-name">${escHtml(n.name)}</span>` +
                (fav ? `<span class="tree-fav">${icons.star}</span>` : "") +
                `</div>`,
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

/* ================= контекстное меню ================= */

let menuEl: HTMLDivElement | null = null;

treeEl.addEventListener("contextmenu", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>(".tree-row");
    if (!row || !state.root) return;
    e.preventDefault();
    const path = row.dataset.path ?? "";
    const isDir = row.dataset.dir === "1";
    showMenu(e.clientX, e.clientY, path, isDir);
});

function showMenu(x: number, y: number, path: string, isDir: boolean): void {
    closeMenu();
    menuEl = document.createElement("div");
    menuEl.className = "ctx-menu";
    const fav = !isDir && isFavorite(path);
    const items: { id: string; icon: string; label: string; danger?: boolean; sep?: boolean }[] = [];
    if (isDir) {
        items.push(
            { id: "newfile", icon: icons.filePlus, label: "Новый файл" },
            { id: "newfolder", icon: icons.folderPlus, label: "Новая папка" },
            { id: "", icon: "", label: "", sep: true },
        );
    }
    if (!isDir) {
        items.push(
            { id: "open", icon: icons.file, label: "Открыть" },
            {
                id: "fav",
                icon: icons.star,
                label: fav ? "Убрать из избранного" : "В избранное",
            },
        );
    }
    items.push(
        { id: "rename", icon: icons.pencil, label: "Переименовать" },
        { id: "delete", icon: icons.trash, label: "Удалить", danger: true },
    );
    for (const it of items) {
        if (it.sep) {
            const sep = document.createElement("div");
            sep.className = "ctx-sep";
            menuEl!.append(sep);
            continue;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `ctx-item${it.danger ? " danger" : ""}`;
        btn.innerHTML = `${it.icon}<span>${escHtml(it.label)}</span>`;
        btn.addEventListener("click", () => {
            closeMenu();
            void handleMenu(it.id, path, isDir);
        });
        menuEl!.append(btn);
    }
    document.getElementById("overlay-root")!.append(menuEl!);
    const r = menuEl!.getBoundingClientRect();
    menuEl!.style.left = `${Math.min(x, window.innerWidth - r.width - 8)}px`;
    menuEl!.style.top = `${Math.min(y, window.innerHeight - r.height - 8)}px`;
}

function closeMenu(): void {
    menuEl?.remove();
    menuEl = null;
}
document.addEventListener("mousedown", (e) => {
    if (menuEl && !menuEl.contains(e.target as Node)) closeMenu();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
});

async function handleMenu(id: string, path: string, isDir: boolean): Promise<void> {
    if (!state.root) return;
    const root = state.root;
    try {
        switch (id) {
            case "open":
                await openFile(path);
                break;
            case "fav":
                toggleFavorite(path);
                renderTree();
                break;
            case "newfile":
                await newEntry(root, path, true);
                break;
            case "newfolder":
                await newEntry(root, path, false);
                break;
            case "rename": {
                const old = path.split("/").pop()!;
                const name = await askName({
                    title: isDir ? "Переименовать папку" : "Переименовать файл",
                    value: old,
                    okLabel: "Переименовать",
                });
                if (!name || name === old) return;
                await go().RenameEntry(root, path, name);
                toast("Переименовано");
                await refreshAll();
                break;
            }
            case "delete": {
                const name = path.split("/").pop()!;
                const ok = await askConfirm({
                    title: isDir ? `Удалить папку «${name}»?` : `Удалить файл «${name}»?`,
                    text: isDir ? "Папка будет удалена со всем содержимым." : undefined,
                    okLabel: "Удалить",
                    danger: true,
                });
                if (!ok) return;
                await go().DeleteEntry(root, path);
                toast("Удалено");
                await refreshAll();
                break;
            }
        }
    } catch (e) {
        toast(errMsg(e));
    }
}

/** Новый файл/папка: в выбранной папке или рядом с файлом. */
async function newEntry(root: string, path: string, isFile: boolean): Promise<void> {
    // целевая папка: для файла — родитель, для папки — сама папка
    const inDir = isDirPath(path) || !path ? path : path.split("/").slice(0, -1).join("/");
    const dirPrefix = inDir ? inDir + "/" : "";
    const name = await askName({
        title: isFile ? "Новый файл в «" + (inDir || state.projectName) + "»" : "Новая папка в «" + (inDir || state.projectName) + "»",
        placeholder: isFile ? "заметка.md" : "папка",
        okLabel: "Создать",
    });
    if (!name) return;
    const rel = dirPrefix + name;
    if (isFile) {
        if (!/\.markdown?$/i.test(name)) {
            toast("Файл должен иметь расширение .md", "info");
            return;
        }
        await go().CreateFile(root, rel);
        await refreshAll();
        ensureExpanded(rel);
        renderTree();
        await openFile(rel);
    } else {
        await go().CreateFolder(root, rel);
        state.expanded.add(rel);
        persistExpanded();
        await refreshAll();
        toast("Папка создана");
    }
}

function isDirPath(path: string): boolean {
    return !!state.tree && findNode(state.tree, path)?.isDir === true;
}

function findNode(node: FileNode, path: string): FileNode | null {
    if (node.path === path) return node;
    for (const c of node.children ?? []) {
        const found = findNode(c, path);
        if (found) return found;
    }
    return null;
}

/** Кнопка «+» в шапке дерева — новый файл в корне проекта. */
export async function newFileAtRoot(): Promise<void> {
    if (!state.root) {
        toast("Сначала откройте папку проекта", "info");
        return;
    }
    await newEntry(state.root, "", true);
}

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
