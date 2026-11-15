/** Каталог файла в «/»-путях ("" для корня). */
export function dirname(p: string): string {
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(0, i) : "";
}

/** Имя файла без пути. */
export function fileName(p: string): string {
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(i + 1) : p;
}

/**
 * Разрешает ссылку относительно каталога текущего файла.
 * «/foo.md» трактуется от корня проекта.
 */
export function resolveRel(baseDir: string, target: string): string {
    if (target.startsWith("/")) {
        target = target.replace(/^\/+/, "");
        return normalize(target.split("/"));
    }
    return normalize([...baseDir.split("/"), ...target.split("/")]);
}

function normalize(parts: string[]): string {
    const out: string[] = [];
    for (const part of parts) {
        if (!part || part === ".") continue;
        if (part === "..") out.pop();
        else out.push(part);
    }
    return out.join("/");
}
