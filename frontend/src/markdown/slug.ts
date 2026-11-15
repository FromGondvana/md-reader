/**
 * Слаги заголовков в стиле GitHub: нижний регистр, пробелы → «-»,
 * пунктуация убирается, буквы (включая кириллицу) сохраняются.
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
        .trim()
        .replace(/\s+/g, "-");
}
