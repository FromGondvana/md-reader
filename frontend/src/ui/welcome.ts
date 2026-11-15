import { openProject, pickAndOpenProject } from "../project";
import { rootName, state } from "../state";
import { icons, logoSvg } from "./icons";
import { escAttr, escHtml } from "./util";

const welcomeEl = document.getElementById("welcome")!;

/** Экран приветствия (когда папка не открыта). */
export function showWelcome(): void {
    state.current = null;
    setProjectName(null);
    document.getElementById("reader")!.innerHTML = "";
    document.getElementById("toc-panel")?.classList.add("hidden");

    const roots = state.settings?.recentRoots ?? [];
    const recentsHtml = roots.length
        ? `<div class="welcome-recent">` +
          `<div class="welcome-recent-title">Недавние проекты</div>` +
          roots
              .map(
                  (r) =>
                      `<div class="welcome-recent-item" data-path="${escAttr(r)}">` +
                      `${icons.folder}<span>${escHtml(rootName(r))}</span>` +
                      `<span class="recent-path">${escHtml(r)}</span></div>`,
              )
              .join("") +
          `</div>`
        : "";

    welcomeEl.innerHTML =
        `<div class="welcome-card">` +
        logoSvg +
        `<h1>MD Reader</h1>` +
        `<p class="welcome-sub">Лёгкий ридер для Markdown-файлов ваших проектов</p>` +
        `<button id="welcome-open" class="btn-primary">${icons.folder}<span>Открыть папку проекта</span></button>` +
        `<p class="welcome-hint">Можно также перетащить папку или .md файл прямо в окно</p>` +
        recentsHtml +
        `</div>`;

    welcomeEl
        .querySelector("#welcome-open")
        ?.addEventListener("click", () => void pickAndOpenProject());
    welcomeEl.querySelectorAll<HTMLElement>(".welcome-recent-item").forEach((el) => {
        el.addEventListener("click", () => {
            void openProject(el.dataset.path ?? "");
        });
    });

    welcomeEl.classList.remove("hidden");
}

/** Прячет приветствие. */
export function hideWelcome(): void {
    welcomeEl.classList.add("hidden");
}

/** Заглушка «в папке нет .md файлов». */
export function showNoFiles(): void {
    document.getElementById("reader")!.innerHTML =
        `<div class="reader-empty">В этой папке нет .md файлов</div>`;
    document.getElementById("toc-panel")?.classList.add("hidden");
}

/** Обновляет имя проекта в топбаре. */
export function setProjectName(name: string | null): void {
    const el = document.getElementById("project-name");
    if (el) el.textContent = name ?? "Открыть папку…";
}
