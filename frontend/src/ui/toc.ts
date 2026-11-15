import { pushHistory, saveSettings, state } from "../state";
import { cssEscape, escHtml } from "./util";
import { updateNavButtons } from "./layout";

/* Берём элементы напрямую: модуль viewer.ts циклически импортирует этот файл,
   поэтому значения из него на верхнем уровне недоступны. */
const contentEl = document.getElementById("content")!;
const tocPanel = document.getElementById("toc-panel")!;
const tocEl = document.getElementById("toc")!;

let spyHeads: HTMLElement[] = [];
let spyTicking = false;

/** Строит оглавление по заголовкам отрендеренного файла. */
export function buildToc(container: HTMLElement): void {
    const heads = Array.from(
        container.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id]"),
    );
    if (heads.length < 2 || state.settings?.tocHidden) {
        tocPanel.classList.add("hidden");
        tocEl.innerHTML = "";
        spyHeads = [];
        return;
    }
    tocPanel.classList.remove("hidden");
    tocEl.innerHTML = heads
        .map(
            (h) =>
                `<a class="toc-item toc-${h.tagName.toLowerCase()}" href="#${h.id}" data-id="${h.id}">` +
                `${escHtml(h.textContent ?? "")}</a>`,
        )
        .join("");
    spyHeads = heads;
    markActive();
}

function onScroll(): void {
    if (spyTicking || !spyHeads.length) return;
    spyTicking = true;
    requestAnimationFrame(() => {
        spyTicking = false;
        markActive();
    });
}

function markActive(): void {
    const fromTop = contentEl.scrollTop + 100;
    let active: HTMLElement | null = null;
    for (const h of spyHeads) {
        if (h.offsetTop <= fromTop) active = h;
        else break;
    }
    tocEl.querySelectorAll(".toc-item.active").forEach((x) => x.classList.remove("active"));
    if (active) {
        tocEl.querySelector(`[data-id="${cssEscape(active.id)}"]`)?.classList.add("active");
    }
}

contentEl.addEventListener("scroll", onScroll, { passive: true });

tocEl.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest<HTMLAnchorElement>(".toc-item");
    if (!item || !state.current) return;
    e.preventDefault();
    const id = item.dataset.id ?? "";
    pushHistory({ path: state.current, anchor: id });
    updateNavButtons();
    document.getElementById(id)?.scrollIntoView({ block: "start" });
});

/** Показать/скрыть панель оглавления. */
export function toggleTocPanel(): void {
    const s = state.settings;
    if (!s) return;
    s.tocHidden = !s.tocHidden;
    tocPanel.classList.toggle("hidden", s.tocHidden);
    saveSettings();
    if (!s.tocHidden && state.current) {
        buildToc(document.getElementById("reader")!);
    }
}
