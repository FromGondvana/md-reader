import { errMsg } from "../api";
import { activeMask, saveSettings, state } from "../state";
import type { Mask, SortMode } from "../types";
import { icons } from "./icons";
import { escAttr, escHtml } from "./util";
import { toast } from "./toast";
import { askConfirm } from "./ask";

const SORT_LABELS: Record<SortMode, string> = {
    name: "по имени",
    "name-desc": "по имени ↓",
    modified: "по дате изменения",
};

/** Циклическая смена сортировки (кнопка в шапке дерева). */
export async function cycleSort(): Promise<void> {
    if (!state.root) return;
    const order: SortMode[] = ["name", "name-desc", "modified"];
    const m = activeMask();
    if (m) {
        // правим активную маску
        const list = state.settings!.masks[state.root] ?? [];
        const mask = list.find((x) => x.name === m.name);
        if (mask) {
            mask.sort = order[(order.indexOf(mask.sort || "name") + 1) % order.length] as SortMode;
            saveSettings();
            await refreshTree();
            updateTreeHeader();
        }
        return;
    }
    const s = state.settings!;
    const cur = s.sorts[state.root] ?? "name";
    s.sorts[state.root] = order[(order.indexOf(cur) + 1) % order.length] as SortMode;
    saveSettings();
    await refreshTree();
    updateTreeHeader();
}

/** Синхронизирует шапку дерева: сортировка + активная маска. */
export function updateTreeHeader(): void {
    const btnSort = document.getElementById("btn-sort")!;
    const btnMask = document.getElementById("btn-masks")!;
    const m = activeMask();
    btnSort.innerHTML = `${icons.sort}<span>${SORT_LABELS[(currentSortSafe()) as SortMode]}</span>`;
    btnMask.innerHTML = m
        ? `${icons.funnel}<span>${escHtml(m.name)}</span>`
        : `${icons.funnel}<span>Все файлы</span>`;
    btnMask.classList.toggle("active", !!m);
}

function currentSortSafe(): string {
    const m = activeMask();
    if (m) return m.sort || "name";
    const s = state.settings;
    return (s && state.root ? s.sorts[state.root] : undefined) ?? "name";
}

async function refreshTree(): Promise<void> {
    if (!state.root) return;
    const { refreshAll } = await import("../project");
    await refreshAll();
}

/* ================= оверлей управления масками ================= */

let root: HTMLDivElement | null = null;

/** Открывает оверлей масок. Повторный вызов закрывает. */
export function openMasks(): void {
    if (!state.root) {
        toast("Сначала откройте папку проекта", "info");
        return;
    }
    if (root?.classList.contains("open")) {
        closeMasks();
        return;
    }
    if (!root) build();
    root!.classList.add("open");
    renderList();
}

export function closeMasks(): void {
    root?.classList.remove("open");
}

function build(): void {
    root = document.createElement("div");
    root.className = "overlay";
    root.innerHTML = `
        <div class="palette palette--masks" role="dialog" aria-label="Маски фильтрации">
            <div class="masks-head">
                <span class="masks-title">Маски фильтрации</span>
                <button type="button" class="btn-dialog btn-primary" data-act="new">+ Новая маска</button>
            </div>
            <div class="masks-list"></div>
            <div class="palette-hints">
                <span>Правила: <kbd>docs/**</kbd> путь, <kbd>drafts</kbd> имя на любой глубине, <kbd>*.tmp.md</kbd> маска имени</span>
            </div>
        </div>`;
    document.getElementById("overlay-root")!.append(root);
    root.addEventListener("mousedown", (e) => {
        if (e.target === root) closeMasks();
    });
    root.querySelector('[data-act="new"]')?.addEventListener("click", () => void editMask(null));
}

function masks(): Mask[] {
    if (!state.root) return [];
    return state.settings!.masks[state.root] ?? [];
}

function renderList(): void {
    const list = root!.querySelector(".masks-list")!;
    const all = masks();
    const active = activeMask();
    if (!all.length) {
        list.innerHTML =
            `<div class="pal-empty">Масок пока нет.<br/>Создайте маску — набор правил, какие файлы и папки показывать в дереве.</div>`;
        return;
    }
    list.innerHTML = "";
    for (const m of all) {
        const isActive = active?.name === m.name;
        const rules = [...m.include.map((r) => `+ ${r}`), ...m.exclude.map((r) => `− ${r}`)];
        const el = document.createElement("div");
        el.className = `mask-item${isActive ? " active" : ""}`;
        el.innerHTML =
            `<div class="mask-row">` +
            `<span class="mask-name">${icons.funnel}${escHtml(m.name)}</span>` +
            `<span class="mask-sort">${SORT_LABELS[m.sort || "name"]}</span>` +
            `<button type="button" class="icon-btn" data-op="use" title="${isActive ? "Снять маску" : "Применить"}">${isActive ? icons.close : icons.funnel}</button>` +
            `<button type="button" class="icon-btn" data-op="edit" title="Изменить">${icons.pencil}</button>` +
            `<button type="button" class="icon-btn" data-op="del" title="Удалить">${icons.trash}</button>` +
            `</div>` +
            `<div class="mask-rules">${rules.map((r) => `<code>${escHtml(r)}</code>`).join(" ") || "<span class='mask-norules'>без правил</span>"}</div>`;
        el.querySelector('[data-op="use"]')?.addEventListener("click", () => void setActive(m));
        el.querySelector('[data-op="edit"]')?.addEventListener("click", () => void editMask(m));
        el.querySelector('[data-op="del"]')?.addEventListener("click", () => void removeMask(m));
        list.append(el);
    }
}

async function setActive(m: Mask | null): Promise<void> {
    const s = state.settings!;
    const root_ = state.root!;
    if (!m || activeMask()?.name === m.name) {
        delete s.activeMask[root_]; // снять маску
    } else {
        s.activeMask[root_] = m.name;
    }
    saveSettings();
    closeMasks();
    updateTreeHeader();
    await refreshTree();
}

async function removeMask(m: Mask): Promise<void> {
    const ok = await askConfirm({
        title: `Удалить маску «${m.name}»?`,
        okLabel: "Удалить",
        danger: true,
    });
    if (!ok || !state.root) return;
    const s = state.settings!;
    s.masks[state.root] = (s.masks[state.root] ?? []).filter((x) => x.name !== m.name);
    if (s.activeMask[state.root] === m.name) delete s.activeMask[state.root];
    saveSettings();
    renderList();
    updateTreeHeader();
    await refreshTree();
}

/** Форма создания/редактирования маски (модально поверх списка). */
async function editMask(m: Mask | null): Promise<void> {
    const isNew = m === null;
    const draft: Mask = m
        ? { ...m, include: [...m.include], exclude: [...m.exclude] }
        : { name: "", include: [], exclude: [], sort: "name" };

    const form = document.createElement("div");
    form.className = "overlay dialog-overlay";
    form.innerHTML =
        `<div class="dialog dialog--mask">` +
        `<div class="dialog-title">${isNew ? "Новая маска" : "Изменить маску"}</div>` +
        `<label class="dialog-label">Название</label>` +
        `<input type="text" class="dialog-input" data-field="name" value="${escAttr(draft.name)}" placeholder="Например: Только документация" spellcheck="false"/>` +
        `<label class="dialog-label">Показывать (включения, по одному на строку)</label>` +
        `<textarea class="dialog-textarea" data-field="include" spellcheck="false" placeholder="docs/**&#10;README.md">${escHtml(draft.include.join("\n"))}</textarea>` +
        `<label class="dialog-label">Скрывать (исключения, по одному на строку)</label>` +
        `<textarea class="dialog-textarea" data-field="exclude" spellcheck="false" placeholder="drafts&#10;*.tmp.md">${escHtml(draft.exclude.join("\n"))}</textarea>` +
        `<label class="dialog-label">Сортировка</label>` +
        `<select class="dialog-select" data-field="sort">` +
        Object.entries(SORT_LABELS)
            .map(([k, v]) => `<option value="${k}"${draft.sort === k ? " selected" : ""}>${v}</option>`)
            .join("") +
        `</select>` +
        `<div class="dialog-actions">` +
        `<button class="btn-dialog" data-act="cancel">Отмена</button>` +
        `<button class="btn-dialog btn-primary" data-act="ok">${isNew ? "Создать" : "Сохранить"}</button>` +
        `</div></div>`;
    document.getElementById("overlay-root")!.append(form);
    requestAnimationFrame(() => form.classList.add("open"));

    const closeForm = (): void => {
        form.classList.remove("open");
        window.setTimeout(() => form.remove(), 120);
    };
    form.addEventListener("mousedown", (e) => {
        if (e.target === form) closeForm();
    });

    const save = async (): Promise<void> => {
        const name = (form.querySelector('[data-field="name"]') as HTMLInputElement).value.trim();
        if (!name) {
            toast("Укажите название маски");
            return;
        }
        if (!isNew && name !== m!.name && masks().some((x) => x.name === name)) {
            toast("Маска с таким названием уже есть");
            return;
        }
        const lines = (sel: string): string[] =>
            (form.querySelector(sel) as HTMLTextAreaElement).value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean);
        const mask: Mask = {
            name,
            include: lines('[data-field="include"]'),
            exclude: lines('[data-field="exclude"]'),
            sort: (form.querySelector('[data-field="sort"]') as HTMLSelectElement).value as SortMode,
        };
        if (!mask.include.length && !mask.exclude.length) {
            toast("Добавьте хотя бы одно правило");
            return;
        }
        const s = state.settings!;
        const root_ = state.root!;
        if (isNew) {
            s.masks[root_] = [...(s.masks[root_] ?? []), mask];
            s.activeMask[root_] = mask.name; // сразу применяем
        } else {
            const oldName = m!.name;
            s.masks[root_] = (s.masks[root_] ?? []).map((x) => (x.name === oldName ? mask : x));
            if (s.activeMask[root_] === oldName) s.activeMask[root_] = name;
        }
        saveSettings();
        closeForm();
        closeMasks();
        updateTreeHeader();
        try {
            // перечитать дерево с новой маской
            await refreshTree();
        } catch (e) {
            toast(errMsg(e));
        }
    };
    form.querySelector('[data-act="ok"]')?.addEventListener("click", () => void save());
    form.querySelector('[data-act="cancel"]')?.addEventListener("click", closeForm);
}
