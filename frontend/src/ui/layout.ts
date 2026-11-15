import { saveSettings, state } from "../state";
import { icons } from "./icons";
import { escAttr, escHtml } from "./util";

const bcEl = document.getElementById("breadcrumb")!;
const btnBack = document.getElementById("btn-back") as HTMLButtonElement;
const btnFwd = document.getElementById("btn-fwd") as HTMLButtonElement;

/** Хлебные крошки текущего файла. */
export function renderBreadcrumb(): void {
    if (!state.current) {
        bcEl.innerHTML = "";
        return;
    }
    const parts = state.current.split("/");
    bcEl.innerHTML = parts
        .map((p, i) => {
            const last = i === parts.length - 1;
            return last
                ? `<span class="bc-file" title="${escAttr(state.current!)}">${escHtml(p)}</span>`
                : `<span class="bc-dir">${escHtml(p)}</span>`;
        })
        .join(`<span class="bc-sep">›</span>`);
}

/** Активирует/блокирует кнопки назад-вперёд. */
export function updateNavButtons(): void {
    btnBack.disabled = state.historyIdx <= 0;
    btnFwd.disabled = state.historyIdx >= state.history.length - 1;
}

/** Расставляет иконки навигации (вызывается один раз при загрузке). */
export function setNavIcons(): void {
    btnBack.innerHTML = icons.back;
    btnFwd.innerHTML = icons.fwd;
}

/** Перетаскиваемая граница сайдбара. */
export function wireResizer(): void {
    const divider = document.getElementById("divider")!;
    const sidebar = document.getElementById("sidebar")!;
    let dragging = false;
    divider.addEventListener("pointerdown", (e) => {
        dragging = true;
        divider.setPointerCapture(e.pointerId);
        document.body.classList.add("resizing");
    });
    divider.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        // сайдбар прилегает к левому краю, поэтому ширина = clientX
        const w = Math.min(480, Math.max(190, e.clientX));
        document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    });
    const finish = (e: PointerEvent): void => {
        if (!dragging) return;
        dragging = false;
        document.body.classList.remove("resizing");
        divider.releasePointerCapture(e.pointerId);
        if (state.settings) {
            state.settings.sidebarWidth = Math.round(sidebar.getBoundingClientRect().width);
            saveSettings();
        }
    };
    divider.addEventListener("pointerup", finish);
    divider.addEventListener("pointercancel", finish);
}
