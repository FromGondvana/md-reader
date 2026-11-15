export type ToastKind = "error" | "info";

export function toast(msg: string, kind: ToastKind = "error"): void {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.textContent = msg;
    root.append(el);
    requestAnimationFrame(() => el.classList.add("show"));
    window.setTimeout(() => {
        el.classList.remove("show");
        window.setTimeout(() => el.remove(), 300);
    }, 4000);
}
