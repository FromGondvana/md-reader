import { EditorState } from "@codemirror/state";
import {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    dropCursor,
    rectangularSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { go, errMsg } from "../api";
import { state } from "../state";
import { toast } from "../ui/toast";
import { icons } from "../ui/icons";

const contentEl = document.getElementById("content")!;
const editorRoot = document.getElementById("editor-root")!;
const editorHost = document.getElementById("editor-host")!;
const btnEdit = document.getElementById("btn-edit") as HTMLButtonElement;

let view: EditorView | null = null;
let editPath: string | null = null;
let dirty = false;
let baseContent = "";

/** Вызывается после выхода из редактора, чтобы перерисовать ридер. */
let exitHook: (() => void) | null = null;
export function setExitHook(fn: () => void): void {
    exitHook = fn;
}

export function editorActive(): boolean {
    return view !== null;
}

export function editorDirty(): boolean {
    return dirty;
}

/* ================= тема и подсветка ================= */

const editorTheme = EditorView.theme({
    "&": {
        height: "100%",
        fontSize: "14px",
        backgroundColor: "var(--bg)",
        color: "var(--text)",
    },
    ".cm-content": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.7",
        padding: "14px 0 45vh",
        caretColor: "var(--accent)",
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-gutters": {
        backgroundColor: "var(--bg-side)",
        color: "var(--text-faint)",
        border: "none",
        borderRight: "1px solid var(--border)",
    },
    ".cm-activeLine": { backgroundColor: "var(--bg-hover)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--bg-hover)", color: "var(--text)" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "var(--accent-soft) !important",
    },
    ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
});

const mdHighlight = HighlightStyle.define([
    { tag: tags.heading1, fontSize: "1.5em", fontWeight: "700" },
    { tag: tags.heading2, fontSize: "1.3em", fontWeight: "700" },
    { tag: tags.heading3, fontSize: "1.15em", fontWeight: "650" },
    { tag: tags.heading, fontWeight: "650" },
    { tag: tags.strong, fontWeight: "650" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.link, color: "var(--accent)" },
    { tag: tags.url, color: "var(--text-faint)" },
    { tag: [tags.monospace], color: "var(--inline-code)" },
    { tag: tags.quote, color: "var(--text-dim)", fontStyle: "italic" },
    { tag: tags.list, color: "var(--code-title)" },
    { tag: tags.meta, color: "var(--text-faint)" },
    { tag: tags.keyword, color: "var(--code-keyword)" },
    { tag: [tags.string, tags.special(tags.string)], color: "var(--code-string)" },
    { tag: tags.number, color: "var(--code-number)" },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--code-comment)", fontStyle: "italic" },
    { tag: [tags.processingInstruction], color: "var(--code-title)" },
]);

/* ================= вход / выход ================= */

/** Открывает редактор для текущего файла. */
export async function enterEditor(): Promise<void> {
    if (!state.root || !state.current) {
        toast("Сначала откройте файл", "info");
        return;
    }
    if (view) return; // уже открыто
    const path = state.current;
    let fc;
    try {
        fc = await go().ReadFile(state.root, path);
    } catch (e) {
        toast(errMsg(e));
        return;
    }
    editPath = path;
    dirty = false;

    view = new EditorView({
        state: EditorState.create({
            doc: fc.content,
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightActiveLine(),
                history(),
                drawSelection(),
                dropCursor(),
                rectangularSelection(),
                EditorView.lineWrapping,
                markdown(),
                syntaxHighlighting(mdHighlight),
                editorTheme,
                keymap.of([
                    { key: "Mod-s", preventDefault: true, run: () => (void saveEditor(), true) },
                    ...defaultKeymap,
                    ...historyKeymap,
                    indentWithTab,
                ]),
                EditorView.updateListener.of((u) => {
                    if (!u.docChanged) return;
                    setDirty(u.state.doc.toString() !== baseContent);
                }),
            ],
        }),
        parent: editorHost,
    });

    baseContent = fc.content;
    setDirty(false);
    editorRoot.classList.remove("hidden");
    contentEl.classList.add("editing");
    syncEditButton();
    view.focus();
}

/** Закрывает редактор. false — если пользователь передумал. */
export async function exitEditor(
    opts: { rerender?: boolean; skipConfirm?: boolean } = {},
): Promise<boolean> {
    if (!view) return true;
    if (dirty && !opts.skipConfirm) {
        const act = await confirmUnsaved();
        if (act === "cancel") return false;
        if (act === "save" && !(await saveEditor())) return false;
    }
    view.destroy();
    view = null;
    editPath = null;
    dirty = false;
    editorRoot.classList.add("hidden");
    contentEl.classList.remove("editing");
    syncEditButton();
    if (opts.rerender !== false) exitHook?.();
    return true;
}

/** Переключение ридер↔редактор (Ctrl+E). */
export async function toggleEditor(): Promise<void> {
    if (view) {
        await exitEditor();
    } else {
        await enterEditor();
    }
}

/* ================= сохранение ================= */

/** Сохраняет файл; true — успешно. */
export async function saveEditor(): Promise<boolean> {
    if (!view || !state.root || !editPath) return true;
    const content = view.state.doc.toString();
    try {
        await go().WriteFile(state.root, editPath, content);
    } catch (e) {
        toast(errMsg(e));
        return false;
    }
    baseContent = content;
    setDirty(false);
    toast("Сохранено");
    return true;
}

function setDirty(v: boolean): void {
    dirty = v;
    syncEditButton();
    // маркер в заголовке окна
    if (state.current) {
        const name = editPath?.split("/").pop() ?? "";
        void go()
            .SetWindowTitle(`${dirty ? "• " : ""}${name} — MD Reader`)
            .catch(() => {});
    }
}

/* ================= диалог несохранённых правок ================= */

function confirmUnsaved(): Promise<"save" | "discard" | "cancel"> {
    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.className = "overlay dialog-overlay";
        root.innerHTML =
            `<div class="dialog" role="dialog">` +
            `<div class="dialog-title">Есть несохранённые правки</div>` +
            `<div class="dialog-actions">` +
            `<button class="btn-dialog" data-act="cancel">Отмена</button>` +
            `<button class="btn-dialog" data-act="discard">Не сохранять</button>` +
            `<button class="btn-dialog btn-primary" data-act="save">Сохранить</button>` +
            `</div></div>`;
        document.getElementById("overlay-root")!.append(root);
        requestAnimationFrame(() => root.classList.add("open"));
        const done = (v: "save" | "discard" | "cancel"): void => {
            resolve(v);
            root.classList.remove("open");
            window.setTimeout(() => root.remove(), 120);
        };
        root.querySelector('[data-act="save"]')?.addEventListener("click", () => done("save"));
        root.querySelector('[data-act="discard"]')?.addEventListener("click", () => done("discard"));
        root.querySelector('[data-act="cancel"]')?.addEventListener("click", () => done("cancel"));
        root.addEventListener("mousedown", (e) => {
            if (e.target === root) done("cancel");
        });
    });
}

/* ================= тулбар ================= */

const TOOLBAR = [
    { act: "h1", label: "H1", title: "Заголовок 1" },
    { act: "h2", label: "H2", title: "Заголовок 2" },
    { act: "h3", label: "H3", title: "Заголовок 3" },
    { sep: true },
    { act: "bold", label: "Ж", title: "Полужирный (Ctrl+B)" },
    { act: "italic", label: "К", title: "Курсив (Ctrl+I)" },
    { act: "strike", label: "S", title: "Зачёркнутый" },
    { act: "code", label: "‹›", title: "Код", mono: true },
    { sep: true },
    { act: "ul", label: "• —", title: "Список" },
    { act: "ol", label: "1. 2.", title: "Нумерованный список" },
    { act: "quote", label: "❝", title: "Цитата" },
    { act: "link", label: "🔗", title: "Ссылка" },
    { act: "hr", label: "— —", title: "Разделитель" },
];

let toolbarBuilt = false;

export function buildEditorToolbar(): void {
    if (toolbarBuilt) return;
    toolbarBuilt = true;
    const bar = document.getElementById("editor-toolbar")!;
    const left = document.createElement("div");
    left.className = "etb-group";
    for (const b of TOOLBAR) {
        if ("sep" in b) {
            const sep = document.createElement("span");
            sep.className = "etb-sep";
            left.append(sep);
            continue;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "etb-btn";
        btn.title = b.title;
        btn.dataset.act = b.act;
        if (b.mono) btn.style.fontFamily = "var(--font-mono)";
        btn.textContent = b.label;
        btn.addEventListener("mousedown", (e) => e.preventDefault()); // не терять фокус
        btn.addEventListener("click", () => applyAction(b.act));
        left.append(btn);
    }
    const right = document.createElement("div");
    right.className = "etb-group";
    const dirtyMark = document.createElement("span");
    dirtyMark.id = "etb-dirty";
    dirtyMark.className = "etb-dirty";
    dirtyMark.textContent = "не сохранено";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "etb-btn etb-save";
    saveBtn.title = "Сохранить (Ctrl+S)";
    saveBtn.innerHTML = `${icons.save}<span>Сохранить</span>`;
    saveBtn.addEventListener("click", () => void saveEditor());
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "etb-btn";
    closeBtn.title = "К просмотру (Ctrl+E)";
    closeBtn.innerHTML = `${icons.close}<span>К просмотру</span>`;
    closeBtn.addEventListener("click", () => void exitEditor());
    right.append(dirtyMark, saveBtn, closeBtn);
    bar.append(left, right);
}

function applyAction(act: string): void {
    if (!view) return;
    view.focus();
    const { state } = view;
    const changes: { from: number; to: number; insert: string }[] = [];
    for (const range of state.selection.ranges) {
        const fromLine = state.doc.lineAt(range.from);
        const toLine = state.doc.lineAt(range.to);
        switch (act) {
            case "bold":
            case "italic":
            case "strike":
            case "code": {
                const m = { bold: "**", italic: "*", strike: "~~", code: "`" }[act]!;
                const text = state.sliceDoc(range.from, range.to);
                changes.push({ from: range.from, to: range.to, insert: m + text + m });
                break;
            }
            case "link": {
                const text = state.sliceDoc(range.from, range.to) || "текст";
                changes.push({ from: range.from, to: range.to, insert: `[${text}](ссылка)` });
                break;
            }
            case "hr":
                changes.push({ from: range.to, to: range.to, insert: "\n---\n" });
                break;
            default: {
                // построчные: ul/ol/quote/h1/h2/h3
                for (let n = fromLine.number; n <= toLine.number; n++) {
                    if (act === "ul" || act === "ol" || act === "quote") {
                        changes.push(prefixLine(state, n, act));
                    } else {
                        changes.push(headingLine(state, n, Number(act[1])));
                    }
                }
            }
        }
    }
    view.dispatch({ changes });
}

/** Действие тулбара/горячей клавиши (Ctrl+B/I — при активном редакторе). */
export function applyEditorAction(act: string): void {
    applyAction(act);
}

function prefixLine(state: EditorState, lineNo: number, act: string): { from: number; to: number; insert: string } {
    const line = state.doc.line(lineNo);
    const marker = act === "ul" ? "- " : act === "ol" ? "1. " : "> ";
    const m = line.text.match(/^(\s*)(- |\d+\. |> )/);
    const stripped = m ? line.text.slice(0, m[1].length) + line.text.slice(m[1].length + m[2].length) : line.text;
    if (m && m[2][0] === marker[0]) {
        return { from: line.from, to: line.to, insert: stripped }; // маркер того же типа — снять
    }
    return { from: line.from, to: line.to, insert: marker + stripped };
}

function headingLine(state: EditorState, lineNo: number, level: number): { from: number; to: number; insert: string } {
    const line = state.doc.line(lineNo);
    const stripped = line.text.replace(/^#{1,6}\s*/, "");
    return { from: line.from, to: line.to, insert: "#".repeat(level) + " " + stripped };
}

/** Синхронизирует кнопку «Редактировать» в топбаре. */
export function syncEditButton(): void {
    if (!btnEdit) return;
    btnEdit.classList.toggle("active", view !== null);
    btnEdit.innerHTML = view
        ? `${icons.close}<span>К просмотру</span>`
        : `${icons.pencil}<span>Редактировать</span>`;
}

/** Активирует «Редактировать»/«Экспорт» только когда открыт файл. */
export function syncTopbarActions(): void {
    if (!btnEdit) return;
    btnEdit.disabled = !state.current;
    const btnExport = document.getElementById("btn-export") as HTMLButtonElement | null;
    if (btnExport) btnExport.disabled = !state.current;
}
