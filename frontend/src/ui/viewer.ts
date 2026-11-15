import { copyText, go, errMsg } from "../api";
import { pushHistory, saveSettings, state } from "../state";
import { renderMarkdown } from "../markdown/render";
import { dirname, fileName, resolveRel } from "../markdown/links";
import { buildToc } from "./toc";
import { ensureExpanded, renderTree } from "./tree";
import { toast } from "./toast";
import { icons } from "./icons";
import { renderBreadcrumb, updateNavButtons } from "./layout";
import type { FileContent } from "../types";

export const contentEl = document.getElementById("content")!;
export const readerEl = document.getElementById("reader")!;

export interface OpenOpts {
    anchor?: string;
    push?: boolean;
    scrollTop?: number;
    /** сохранить позицию прокрутки при перерисовке (авто-refresh) */
    keepScroll?: boolean;
}

/** Открывает md-файл: читает, рендерит, обновляет дерево/оглавление/историю. */
export async function openFile(path: string, opts: OpenOpts = {}): Promise<void> {
    if (!state.root) return;
    const prevScroll = contentEl.scrollTop;
    let fc: FileContent;
    try {
        fc = await go().ReadFile(state.root, path);
    } catch (e) {
        toast(errMsg(e));
        return;
    }
    state.current = path;
    readerEl.innerHTML = renderMarkdown(fc.content);
    decorate(path);
    buildToc(readerEl);
    ensureExpanded(path);
    renderTree();
    renderBreadcrumb();

    if (opts.anchor) {
        scrollToAnchor(opts.anchor);
    } else if (opts.keepScroll) {
        contentEl.scrollTop = prevScroll;
    } else if (opts.scrollTop != null) {
        contentEl.scrollTop = opts.scrollTop;
    } else {
        contentEl.scrollTop = 0;
    }

    if (opts.push !== false) pushHistory({ path, anchor: opts.anchor });
    updateNavButtons();
    go()
        .SetWindowTitle(`${fileName(path)} — MD Reader`)
        .catch(() => {});
    addRecent(path);
    rememberScroll();
}

/** Запоминает позицию прокрутки в текущей записи истории. */
export function rememberScroll(): void {
    const loc = state.history[state.historyIdx];
    if (loc) loc.scrollTop = contentEl.scrollTop;
}

/** Прокрутка к заголовку-якорю с подсветкой. */
export function scrollToAnchor(anchor: string): void {
    const el = findAnchorEl(anchor);
    if (el) {
        el.scrollIntoView({ block: "start" });
        flash(el);
    } else {
        contentEl.scrollTop = 0;
    }
}

function findAnchorEl(anchor: string): HTMLElement | null {
    let a = anchor.replace(/^#/, "");
    try {
        a = decodeURIComponent(a);
    } catch {
        // оставляем как есть
    }
    let el = readerEl.querySelector<HTMLElement>(`[id="${CSS.escape(a)}"]`);
    if (el) return el;
    // терпимый поиск: без учёта регистра среди заголовков
    const heads = readerEl.querySelectorAll<HTMLElement>("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]");
    for (const h of heads) {
        if (h.id.toLowerCase() === a.toLowerCase()) return h;
    }
    return null;
}

function flash(el: HTMLElement): void {
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    window.setTimeout(() => el.classList.remove("flash"), 1600);
}

/** Копки «Копировать» в коде, локальные картинки → data-URI. */
function decorate(path: string): void {
    readerEl.querySelectorAll("pre").forEach((pre) => {
        if (pre.closest(".code-block")) return;
        const code = pre.querySelector("code");
        const lang = code?.className.match(/language-([\w#+-]+)/)?.[1] ?? "";
        const wrap = document.createElement("div");
        wrap.className = "code-block";
        const head = document.createElement("div");
        head.className = "code-head";
        const langSpan = document.createElement("span");
        langSpan.className = "code-lang";
        langSpan.textContent = lang || "текст";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "code-copy";
        btn.title = "Копировать код";
        btn.innerHTML = `${icons.copy}<span>Копировать</span>`;
        head.append(langSpan, btn);
        pre.replaceWith(wrap);
        wrap.append(head, pre);
    });

    if (!state.root) return;
    readerEl.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") ?? "";
        if (!src || /^(https?:|data:)/i.test(src)) return;
        const rel = resolveRel(dirname(path), src);
        go()
            .ReadFileBase64(state.root!, rel)
            .then((b64) => {
                img.src = "data:" + b64;
            })
            .catch(() => {
                const span = document.createElement("span");
                span.className = "img-missing";
                span.textContent = `[изображение недоступно: ${img.getAttribute("alt") || rel}]`;
                img.replaceWith(span);
            });
    });
}

/* --- клики внутри статьи: копирование кода и переходы по ссылкам --- */
readerEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const copyBtn = target.closest<HTMLButtonElement>(".code-copy");
    if (copyBtn) {
        void handleCopyClick(copyBtn);
        return;
    }

    const a = target.closest<HTMLAnchorElement>("a");
    if (!a) return;
    e.preventDefault();
    void handleLink(a);
});

async function handleCopyClick(btn: HTMLButtonElement): Promise<void> {
    const pre = btn.closest(".code-block")?.querySelector("pre");
    const ok = await copyText(pre?.textContent ?? "");
    const label = btn.querySelector("span");
    if (label) {
        label.textContent = ok ? "Скопировано" : "Не удалось";
        window.setTimeout(() => {
            label.textContent = "Копировать";
        }, 1500);
    }
}

async function handleLink(a: HTMLAnchorElement): Promise<void> {
    const ext = a.dataset.external;
    if (ext) {
        go()
            .OpenExternal(ext)
            .catch(() => toast("Не удалось открыть ссылку"));
        return;
    }
    if (!state.root || !state.current) return;
    const href = a.getAttribute("href") ?? "";
    if (!href) return;

    let decoded = href;
    try {
        decoded = decodeURI(href);
    } catch {
        // оставляем как есть
    }

    if (decoded.startsWith("#")) {
        const anchor = decoded.slice(1);
        pushHistory({ path: state.current, anchor });
        updateNavButtons();
        scrollToAnchor(anchor);
        return;
    }

    const hashIdx = decoded.indexOf("#");
    const pathPart = hashIdx >= 0 ? decoded.slice(0, hashIdx) : decoded;
    const anchor = hashIdx >= 0 ? decoded.slice(hashIdx + 1) : undefined;

    let target = resolveRel(dirname(state.current), pathPart);
    if (!state.fileSet.has(target)) {
        if (state.fileSet.has(target + ".md")) target += ".md";
        else if (state.fileSet.has(target + "/README.md")) target += "/README.md";
        else if (state.fileSet.has(target + "/index.md")) target += "/index.md";
        else {
            toast(`Ссылка не найдена: ${pathPart}`);
            return;
        }
    }
    await openFile(target, { anchor });
}

/* --- подсветка совпадений поиска --- */

/** Оборачивает все вхождения query в <mark class="search-hit">. Возвращает число. */
export function highlightQuery(container: HTMLElement, query: string): number {
    const q = query.toLowerCase();
    if (!q.trim()) return 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const t = node as Text;
            if (!t.nodeValue || !t.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (t.parentElement?.closest("mark")) return NodeFilter.FILTER_REJECT;
            return t.nodeValue.toLowerCase().includes(q)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);

    let count = 0;
    for (const node of nodes) {
        if (count >= 500) break;
        const text = node.nodeValue ?? "";
        const lower = text.toLowerCase();
        const frag = document.createDocumentFragment();
        let pos = 0;
        let idx = lower.indexOf(q);
        while (idx >= 0 && count < 500) {
            frag.append(text.slice(pos, idx));
            const mark = document.createElement("mark");
            mark.className = "search-hit";
            mark.textContent = text.slice(idx, idx + q.length);
            frag.append(mark);
            count++;
            pos = idx + q.length;
            idx = lower.indexOf(q, pos);
        }
        frag.append(text.slice(pos));
        node.parentNode?.replaceChild(frag, node);
    }
    return count;
}

/** Прокрутка к блоку, содержащему строку исходника line. */
export function jumpToLine(line: number): void {
    const blocks = readerEl.querySelectorAll<HTMLElement>("[data-line]");
    let target: HTMLElement | null = null;
    for (const b of blocks) {
        if (Number(b.dataset.line) <= line) target = b;
        else break;
    }
    (target ?? readerEl.firstElementChild)?.scrollIntoView({ block: "start" });
}

function addRecent(rel: string): void {
    const s = state.settings;
    if (!s || !state.root) return;
    const list = s.recents[state.root] ?? [];
    s.recents[state.root] = [rel, ...list.filter((x) => x !== rel)].slice(0, 12);
    s.lastFiles[state.root] = rel;
    saveSettings();
}
