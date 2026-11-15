import DOMPurify from "dompurify";
import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { slugify } from "./slug";

const md: MarkdownIt = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    typographer: false,
    highlight(str: string, lang: string): string {
        const l = (lang.trim().split(/\s+/)[0] ?? "").toLowerCase();
        if (l && hljs.getLanguage(l)) {
            try {
                return hljs.highlight(str, { language: l, ignoreIllegals: true }).value;
            } catch {
                // подсветка не удалась — вернём экранированный текст
            }
        }
        return "";
    },
});

md.use(taskLists, { enabled: false });

/* не превращаем «AGENTS.md» и прочие имена файлов в фейковые домены */
md.linkify.set({ fuzzyLink: false });

/* --- id заголовков: слаги как на GitHub (кириллица сохраняется) --- */
interface MdToken {
    type: string;
    content: string;
    nesting: number;
    map?: [number, number] | null;
    children?: MdToken[] | null;
    attrSet(name: string, value: string): void;
    attrGet(name: string): string | null;
}

function inlineText(inline: MdToken): string {
    if (Array.isArray(inline.children) && inline.children.length) {
        return inline.children.map((c) => c.content ?? "").join("");
    }
    return inline.content ?? "";
}

md.core.ruler.push("heading_ids", (state) => {
    const used = new Map<string, number>();
    const tokens = state.tokens as unknown as MdToken[];
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type !== "heading_open") continue;
        const inline = tokens[i + 1];
        const raw = inline && inline.type === "inline" ? inlineText(inline) : "";
        let slug = slugify(raw) || "раздел";
        const seen = used.get(slug) ?? 0;
        used.set(slug, seen + 1);
        if (seen > 0) slug = `${slug}-${seen}`;
        tok.attrSet("id", slug);
    }
});

/* --- номера строк исходника (для переходов из поиска) --- */
md.core.ruler.push("source_lines", (state) => {
    for (const tok of state.tokens as unknown as MdToken[]) {
        if (tok.map && tok.nesting === 1) {
            tok.attrSet("data-line", String(tok.map[0] + 1));
        }
    }
});

/* --- таблицы в горизонтально прокручиваемую обёртку --- */
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
md.renderer.rules.table_close = () => "</table></div>";

/* --- помечаем внешние ссылки --- */
const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const href = tokens[idx].attrGet("href") ?? "";
    if (/^(https?:)?\/\//i.test(href) || /^(mailto|tel):/i.test(href)) {
        tokens[idx].attrSet("class", "link-external");
        tokens[idx].attrSet("data-external", href);
    }
    return defaultLinkOpen(tokens, idx, opts, env, self);
};

export function renderMarkdown(src: string): string {
    const html = md.render(src.replace(/\r\n/g, "\n"));
    return DOMPurify.sanitize(html, {
        ADD_ATTR: ["data-line", "data-external", "target", "checked", "disabled", "type"],
    });
}
