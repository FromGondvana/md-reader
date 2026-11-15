import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "./styles/vars.css";
import "./styles/layout.css";
import "./styles/tree.css";
import "./styles/viewer.css";
import "./styles/editor.css";
import "./styles/overlays.css";
import "./styles/toc.css";
import "./styles/toast.css";

import { errMsg, go, rt } from "./api";
import { loadSettings, saveSettings, state, treeOptsJson } from "./state";
import { toast } from "./ui/toast";
import { icons } from "./ui/icons";
import { renderTree, newFileAtRoot } from "./ui/tree";
import { openFile } from "./ui/viewer";
import { setProjectName, showNoFiles, showWelcome } from "./ui/welcome";
import { closeAllOverlays, openPalette, openSearch } from "./ui/overlays";
import { cycleSort, openMasks } from "./ui/masks";
import { exportCurrent, setExportIcon } from "./ui/export";
import {
    applyEditorAction,
    editorActive,
    saveEditor,
    setExitHook,
    syncEditButton,
    toggleEditor,
} from "./editor/editor";
import { goBack, goForward } from "./ui/history";
import { setNavIcons, wireResizer } from "./ui/layout";
import { toggleTocPanel } from "./ui/toc";
import { buildEditorToolbar } from "./editor/editor";
import { flattenFiles, openProject, pickAndOpenProject, refreshAll } from "./project";

async function boot(): Promise<void> {
    state.settings = await loadSettings();
    const s = state.settings;

    applyTheme(s.theme);
    document.documentElement.style.setProperty("--sidebar-w", `${s.sidebarWidth}px`);
    if (s.zoom !== 1) document.body.style.zoom = String(s.zoom);
    if (s.sidebarHidden) document.getElementById("app")!.classList.add("no-sidebar");

    setNavIcons();
    wireTopbar();
    wireResizer();
    wireKeyboard();
    wireWatch();
    wireDrop();
    wireOpenRequests();
    buildEditorToolbar();
    setExportIcon();
    setExitHook(() => {
        // выход из редактора → перерисовать ридер текущего файла
        if (state.current) void openFile(state.current, { push: false });
    });

    // файл из аргументов запуска («открыть с помощью»)
    let startupRoot = "";
    let startupRel = "";
    try {
        const raw = await go().TakeStartupFile();
        if (raw) {
            const d = JSON.parse(raw) as { root: string; rel: string };
            startupRoot = d.root;
            startupRel = d.rel;
        }
    } catch {
        // обычный запуск без файла
    }

    // ?root=... — удобство для проверки в обычном браузере
    const qRoot = new URLSearchParams(location.search).get("root");

    const root = startupRoot || qRoot || s.lastProject;
    const file = startupRel || (root ? (s.lastFiles?.[root] ?? undefined) : undefined);

    if (root) {
        const ok = await openProject(root, file);
        if (!ok) showWelcome();
    } else {
        showWelcome();
    }
}

/* ================= топбар ================= */

let btnTheme: HTMLButtonElement | null = null;

function wireTopbar(): void {
    const btn = (id: string): HTMLButtonElement =>
        document.getElementById(id) as HTMLButtonElement;
    btnTheme = btn("btn-theme");

    btn("btn-back").addEventListener("click", goBack);
    btn("btn-fwd").addEventListener("click", goForward);
    btn("btn-open-folder").addEventListener("click", () => void pickAndOpenProject());
    btn("btn-palette").addEventListener("click", openPalette);
    btn("btn-search").addEventListener("click", openSearch);
    btn("btn-tree").addEventListener("click", toggleSidebar);
    btn("btn-toc").addEventListener("click", toggleTocPanel);
    btn("btn-edit").addEventListener("click", () => void toggleEditor());
    btn("btn-export").addEventListener("click", () => void exportCurrent());
    btn("btn-newfile").addEventListener("click", () => void newFileAtRoot());
    btn("btn-sort").addEventListener("click", () => void cycleSort());
    btn("btn-masks").addEventListener("click", openMasks);
    btnTheme.addEventListener("click", () => {
        const s = state.settings!;
        s.theme = s.theme === "dark" ? "light" : "dark";
        applyTheme(s.theme);
        saveSettings();
    });

    btn("btn-palette").innerHTML = `${icons.file}<span>Файл…</span>`;
    btn("btn-search").innerHTML = `${icons.search}<span>Поиск</span>`;
    btn("btn-tree").innerHTML = icons.panelLeft;
    btn("btn-toc").innerHTML = icons.list;
    btn("btn-sort").innerHTML = `${icons.sort}<span>по имени</span>`;
    btn("btn-masks").innerHTML = `${icons.funnel}<span>Все файлы</span>`;
    syncEditButton();
    syncThemeIcon();
}

function syncThemeIcon(): void {
    if (!btnTheme) return;
    btnTheme.innerHTML = (state.settings?.theme ?? "dark") === "dark" ? icons.sun : icons.moon;
}

function applyTheme(theme: "dark" | "light"): void {
    document.documentElement.dataset.theme = theme;
    syncThemeIcon();
}

function toggleSidebar(): void {
    const s = state.settings!;
    s.sidebarHidden = !s.sidebarHidden;
    document.getElementById("app")!.classList.toggle("no-sidebar", s.sidebarHidden);
    saveSettings();
}

/* ================= клавиатура ================= */

function wireKeyboard(): void {
    document.addEventListener("keydown", (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.shiftKey && e.code === "KeyP") {
            e.preventDefault();
            openPalette();
        } else if (mod && e.shiftKey && e.code === "KeyF") {
            e.preventDefault();
            openSearch();
        } else if (mod && e.code === "KeyE") {
            e.preventDefault();
            void toggleEditor();
        } else if (mod && e.code === "KeyS") {
            e.preventDefault();
            if (editorActive()) void saveEditor();
        } else if (mod && e.code === "KeyI" && editorActive()) {
            e.preventDefault();
            applyEditorAction("italic");
        } else if (mod && e.code === "KeyB") {
            e.preventDefault();
            if (editorActive()) applyEditorAction("bold");
            else toggleSidebar();
        } else if (e.altKey && e.key === "ArrowLeft") {
            e.preventDefault();
            goBack();
        } else if (e.altKey && e.key === "ArrowRight") {
            e.preventDefault();
            goForward();
        } else if (e.key === "F5") {
            e.preventDefault();
            void refreshAll();
        } else if (mod && (e.key === "=" || e.key === "+")) {
            e.preventDefault();
            changeZoom(0.1);
        } else if (mod && e.key === "-") {
            e.preventDefault();
            changeZoom(-0.1);
        } else if (mod && e.key === "0") {
            e.preventDefault();
            resetZoom();
        } else if (e.key === "Escape") {
            closeAllOverlays();
        }
    });
}

function changeZoom(delta: number): void {
    const s = state.settings!;
    s.zoom = Math.min(1.6, Math.max(0.8, Math.round((s.zoom + delta) * 10) / 10));
    document.body.style.zoom = String(s.zoom);
    saveSettings();
}

function resetZoom(): void {
    const s = state.settings!;
    s.zoom = 1;
    document.body.style.zoom = "";
    saveSettings();
}

/* ================= события от Go ================= */

let refreshTimer: number | undefined;

function wireWatch(): void {
    rt()?.EventsOn?.("fs:changed", () => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void refreshAfterChange(), 300);
    });
}

async function refreshAfterChange(): Promise<void> {
    if (!state.root) return;
    const cur = state.current;
    try {
        const tree = await go().LoadTree(state.root, treeOptsJson());
        state.tree = tree;
        flattenFiles(tree);
        renderTree();
    } catch {
        return;
    }
    // файл открыт в редакторе — не перечитываем его под руками пользователя,
    // иначе правки будут затёрты (свой WriteFile игнорируется guard'ом выше)
    if (editorActive()) return;
    if (!cur) return;
    if (state.fileSet.has(cur)) {
        await openFile(cur, { push: false, keepScroll: true });
    } else {
        toast("Открытый файл был удалён или перемещён", "info");
        state.current = null;
        setProjectName(state.projectName);
        showNoFiles();
    }
}

function wireOpenRequests(): void {
    rt()?.EventsOn?.("open-requested", (data: unknown) => {
        const d = data as { root?: string; rel?: string };
        if (d?.root) void openProject(d.root, d.rel);
    });
}

/** Перетаскивание папки или .md файла в окно. */
function wireDrop(): void {
    const r = rt();
    if (!r?.OnFileDrop) return;
    try {
        r.OnFileDrop((_x: number, _y: number, paths: string[]) => {
            const p = paths?.[0];
            if (p) void handleDroppedPath(p);
        }, true);
    } catch {
        // runtime без поддержки drop
    }
}

async function handleDroppedPath(p: string): Promise<void> {
    try {
        await go().LoadTree(p, ""); // папка?
        await openProject(p);
        return;
    } catch {
        // не папка — пробуем как файл
    }
    if (/\.md$/i.test(p)) {
        const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
        await openProject(p.slice(0, i), p.slice(i + 1));
    } else {
        toast("Поддерживаются только папки и .md файлы", "info");
    }
}

boot().catch((e: unknown) => {
    const el = document.createElement("div");
    el.className = "boot-error";
    el.textContent = `Ошибка запуска: ${errMsg(e)}`;
    document.body.append(el);
});
