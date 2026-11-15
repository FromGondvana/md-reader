/** HTML-экранирование. */
export function escHtml(s: string): string {
    return s.replace(/[&<>"]/g, (c) =>
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
    );
}

export const escAttr = escHtml;

/** Экранирование для CSS-селекторов (id и значения атрибутов). */
export function cssEscape(s: string): string {
    try {
        return CSS.escape(s);
    } catch {
        return s.replace(/["\\]/g, "\\$&");
    }
}
