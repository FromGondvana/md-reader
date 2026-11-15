import { go, errMsg } from "./api";
import { rootName, saveSettings, state, treeOptsJson } from "./state";
import { toast } from "./ui/toast";
import { updateTreeHeader } from "./ui/masks";
import { syncTopbarActions } from "./editor/editor";
import { renderTree } from "./ui/tree";
import { openFile } from "./ui/viewer";
import { hideWelcome, setProjectName, showNoFiles, showWelcome } from "./ui/welcome";
import type { FileNode } from "./types";

/* ================= открывание проекта ================= */

/** Системный диалог выбора папки. Возвращает null при отмене. */
export async function chooseFolder(): Promise<string | null> {
    try {
        const dir = await go().ChooseFolder("Выберите папку проекта");
        return dir || null;
    } catch {
        return null;
    }
}

/** Открывает диалог и затем папку. */
export async function pickAndOpenProject(): Promise<void> {
    const dir = await chooseFolder();
    if (!dir) return;
    const ok = await openProject(dir);
    if (!ok) showWelcome();
}

/** Загружает дерево проекта, восстанавливает состояние, открывает файл. */
export async function openProject(root: string, openRel?: string): Promise<boolean> {
    let tree: FileNode;
    try {
        tree = await go().LoadTree(root, treeOptsJson());
    } catch (e) {
        toast(`Папка недоступна: ${errMsg(e)}`);
        return false;
    }
    state.root = root;
    state.projectName = rootName(root);
    state.tree = tree;
    flattenFiles(tree);
    state.expanded = new Set(["", ...(state.settings?.expanded?.[root] ?? [])]);
    state.current = null;
    syncTopbarActions();
    state.history = [];
    state.historyIdx = -1;
    void go()
        .StartWatch(root)
        .catch(() => {});

    const s = state.settings!;
    s.lastProject = root;
    s.recentRoots = [root, ...(s.recentRoots ?? []).filter((r) => r !== root)].slice(0, 8);
    saveSettings();
    setProjectName(state.projectName);
    updateTreeHeader();
    renderTree();
    hideWelcome();

    const file = openRel && state.fileSet.has(openRel) ? openRel : firstFile();
    if (file) await openFile(file);
    else showNoFiles();
    return true;
}

function flattenFiles(node: FileNode): void {
    const files: string[] = [];
    const set = new Set<string>();
    const walk = (n: FileNode): void => {
        if (n.isDir) {
            for (const c of n.children ?? []) walk(c);
        } else {
            files.push(n.path);
            set.add(n.path);
        }
    };
    walk(node);
    state.files = files;
    state.fileSet = set;
}

export { flattenFiles };

/** Первый файл для открытия: AGENTS.md → README.md → самый верхний. */
export function firstFile(): string | undefined {
    const files = state.files;
    if (!files.length) return undefined;
    const agents = files.find((f) => /^agents?\.md$/i.test(f));
    if (agents) return agents;
    const readme = files.find((f) => /^readme\.md$/i.test(f));
    if (readme) return readme;
    return [...files].sort(
        (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    )[0];
}

/** Перечитывает дерево и открытый файл. */
export async function refreshAll(): Promise<void> {
    if (!state.root) return;
    const cur = state.current;
    if (cur && state.fileSet.has(cur)) {
        await openFile(cur, { push: false, keepScroll: true });
    }
    try {
        const tree = await go().LoadTree(state.root, treeOptsJson());
        state.tree = tree;
        flattenFiles(tree);
        renderTree();
    } catch {
        // папка могла пропасть — не критично для F5
    }
}
