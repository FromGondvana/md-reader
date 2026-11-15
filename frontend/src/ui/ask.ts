import { escAttr, escHtml } from "./util";

/** Возвращает содержимое временного диалога и убирает его из DOM. */
function openDialog(html: string, onMount: (root: HTMLDivElement) => void): void {
    const root = document.createElement("div");
    root.className = "overlay dialog-overlay";
    root.innerHTML = `<div class="dialog" role="dialog">${html}</div>`;
    document.getElementById("overlay-root")!.append(root);
    requestAnimationFrame(() => root.classList.add("open"));
    root.addEventListener("mousedown", (e) => {
        if (e.target === root) close();
    });
    function close(): void {
        root.classList.remove("open");
        window.setTimeout(() => root.remove(), 120);
    }
    onMount(root);
}

/** Диалог-подтверждение: «Удалить …?» и т.п. */
export function askConfirm(opts: {
    title: string;
    text?: string;
    okLabel?: string;
    danger?: boolean;
}): Promise<boolean> {
    return new Promise((resolve) => {
        openDialog(
            `<div class="dialog-title">${escHtml(opts.title)}</div>` +
                (opts.text ? `<div class="dialog-text">${escHtml(opts.text)}</div>` : "") +
                `<div class="dialog-actions">` +
                `<button class="btn-dialog" data-act="cancel">Отмена</button>` +
                `<button class="btn-dialog ${opts.danger ? "btn-danger" : "btn-primary"}" data-act="ok">` +
                `${escHtml(opts.okLabel ?? "OK")}</button></div>`,
            (root) => {
                const onKey = (e: KeyboardEvent): void => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        done(true);
                    } else if (e.key === "Escape") {
                        e.stopPropagation();
                        done(false);
                    }
                };
                const done = (v: boolean): void => {
                    document.removeEventListener("keydown", onKey, true);
                    resolve(v);
                    root.classList.remove("open");
                    window.setTimeout(() => root.remove(), 120);
                };
                root.querySelector('[data-act="ok"]')?.addEventListener("click", () => done(true));
                root.querySelector('[data-act="cancel"]')?.addEventListener("click", () => done(false));
                document.addEventListener("keydown", onKey, true);
                (root.querySelector('[data-act="ok"]') as HTMLElement)?.focus();
            },
        );
    });
}

/** Диалог ввода имени (создание/переименование). */
export function askName(opts: {
    title: string;
    value?: string;
    placeholder?: string;
    okLabel?: string;
}): Promise<string | null> {
    return new Promise((resolve) => {
        openDialog(
            `<div class="dialog-title">${escHtml(opts.title)}</div>` +
                `<input type="text" class="dialog-input" value="${escAttr(opts.value ?? "")}" ` +
                `placeholder="${escAttr(opts.placeholder ?? "")}" spellcheck="false"/>` +
                `<div class="dialog-actions">` +
                `<button class="btn-dialog" data-act="cancel">Отмена</button>` +
                `<button class="btn-dialog btn-primary" data-act="ok">${escHtml(opts.okLabel ?? "Создать")}</button></div>`,
            (root) => {
                const input = root.querySelector<HTMLInputElement>(".dialog-input")!;
                const done = (v: string | null): void => {
                    resolve(v);
                    document.removeEventListener("keydown", onKey, true);
                    root.classList.remove("open");
                    window.setTimeout(() => root.remove(), 120);
                };
                const submit = (): void => {
                    const v = input.value.trim();
                    done(v || null);
                };
                root.querySelector('[data-act="ok"]')?.addEventListener("click", submit);
                root.querySelector('[data-act="cancel"]')?.addEventListener("click", () => done(null));
                const onKey = (e: KeyboardEvent): void => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        submit();
                    } else if (e.key === "Escape") {
                        e.stopPropagation();
                        done(null);
                    }
                };
                document.addEventListener("keydown", onKey, true);
                input.focus();
                input.select();
            },
        );
    });
}
