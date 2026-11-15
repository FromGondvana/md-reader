import { go, errMsg } from "../api";
import { state } from "../state";
import { readerEl } from "./viewer";
import { toast } from "./toast";
import { icons } from "./icons";

/** Кнопка «Экспорт» в топбаре: сохранить текущий файл как HTML. */
export async function exportCurrent(): Promise<void> {
    if (!state.current) {
        toast("Сначала откройте файл", "info");
        return;
    }
    try {
        const html = buildStandalone(state.current, readerEl.innerHTML);
        const p = await go().ExportHTML(fileName(state.current), html);
        if (p) toast(`Экспортировано: ${p}`);
    } catch (e) {
        toast(errMsg(e));
    }
}

function fileName(path: string): string {
    const base = path.split("/").pop() ?? "документ";
    return base.replace(/\.(md|markdown)$/i, "") + ".html";
}

/* ---------- сборка автономного HTML ---------- */

/** Значения CSS-переменных темы — чтобы экспорт выглядел как в приложении. */
function collectVars(): string {
    const wanted = [
        "--bg", "--bg-bar", "--bg-side", "--bg-elev", "--bg-hover", "--bg-active",
        "--bg-code", "--bg-mark", "--text", "--text-dim", "--text-faint",
        "--border", "--border-strong", "--accent", "--accent-soft",
        "--inline-code", "--danger", "--code-keyword", "--code-string",
        "--code-number", "--code-comment", "--code-title", "--code-type",
        "--code-tag", "--code-attr", "--code-builtin", "--code-meta",
        "--font-ui", "--font-mono",
    ];
    const cs = getComputedStyle(document.documentElement);
    return wanted
        .map((v) => `${v}:${cs.getPropertyValue(v).trim()}`)
        .join(";");
}

/** Компактная типографика статьи — зеркало viewer.css для автономного файла. */
const EXPORT_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:var(--font-ui);font-size:15.5px;line-height:1.75;color:var(--text);background:var(--bg);padding:48px 24px 80px}
article{max-width:860px;margin:0 auto}
article>:first-child{margin-top:0}
h1,h2,h3,h4,h5,h6{font-weight:650;line-height:1.3;margin:1.6em 0 .6em}
h1{font-size:1.85em;margin-top:.2em}
h2{font-size:1.42em;padding-bottom:.3em;border-bottom:1px solid var(--border)}
h3{font-size:1.2em}
h4{font-size:1.05em}
h5,h6{font-size:.95em;color:var(--text-dim)}
p{margin:.85em 0}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
a.link-external::after{content:" ↗";font-size:.85em}
strong{font-weight:650}
ul,ol{margin:.8em 0;padding-left:1.7em}
li{margin:.3em 0}
li::marker{color:var(--text-faint)}
li.task-list-item{list-style:none;margin-left:-1.4em}
li.task-list-item input{margin-right:.55em;accent-color:var(--accent)}
hr{border:none;border-top:1px solid var(--border);margin:2em 0}
img{max-width:100%;border-radius:10px}
mark{background:var(--bg-mark);color:inherit;padding:0 2px;border-radius:3px}
kbd{font-family:var(--font-ui);font-size:.8em;background:var(--bg-side);border:1px solid var(--border-strong);border-bottom-width:2px;border-radius:5px;padding:1px 6px}
details{border:1px solid var(--border);border-radius:10px;padding:10px 16px;margin:1.1em 0}
summary{cursor:pointer;font-weight:600}
code{font-family:var(--font-mono);font-size:.86em;background:var(--bg-code);color:var(--inline-code);padding:.12em .38em;border-radius:5px}
.code-block{margin:1.1em 0;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-code)}
.code-head{display:flex;align-items:center;justify-content:space-between;padding:5px 8px 5px 14px;border-bottom:1px solid var(--border);background:var(--bg-side)}
.code-lang{font-family:var(--font-mono);font-size:11px;color:var(--text-faint)}
.code-block pre{margin:0;padding:14px 16px;overflow-x:auto;background:transparent}
.code-block code{background:transparent;color:var(--text);padding:0;font-size:13px;line-height:1.65}
pre{margin:1.1em 0;padding:14px 16px;overflow-x:auto;background:var(--bg-code);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:.92em;margin:1.1em 0;border:1px solid var(--border);border-radius:10px}
th,td{padding:7px 14px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}
th{background:var(--bg-side);font-weight:600}
tr:last-child td{border-bottom:none}
blockquote{margin:1.1em 0;padding:.35em 1.1em;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0}
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-doctag{color:var(--code-keyword)}
.hljs-string,.hljs-regexp,.hljs-addition{color:var(--code-string)}
.hljs-number,.hljs-symbol,.hljs-bullet{color:var(--code-number)}
.hljs-comment,.hljs-quote{color:var(--code-comment);font-style:italic}
.hljs-title,.hljs-section,.hljs-name{color:var(--code-title)}
.hljs-type,.hljs-class .hljs-title{color:var(--code-type)}
.hljs-attr,.hljs-attribute,.hljs-variable{color:var(--code-attr)}
.hljs-built_in{color:var(--code-builtin)}
.hljs-meta{color:var(--code-meta)}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:600}
@media print{body{padding:0;background:#fff;color:#222}h2{-webkit-print-color-adjust:exact}blockquote,.code-block,pre,table{-webkit-print-color-adjust:exact}}
`;

/** Собирает автономный HTML: тема приложения + рендер статьи. */
export function buildStandalone(rel: string, bodyHtml: string): string {
    const vars = collectVars();
    const title = (rel.split("/").pop() ?? "документ").replace(/\.(md|markdown)$/i, "");
    return (
        `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8"/>\n` +
        `<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n` +
        `<title>${title}</title>\n` +
        `<style>:root{${vars}}</style>\n<style>${EXPORT_CSS}</style>\n` +
        `</head>\n<body>\n<article>${bodyHtml}</article>\n</body>\n</html>`
    );
}

/** Иконка кнопки (вызывается при инициализации топбара). */
export function setExportIcon(): void {
    document.getElementById("btn-export")!.innerHTML = `${icons.download}<span>Экспорт</span>`;
}
