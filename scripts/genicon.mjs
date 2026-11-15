// Генератор иконки MD Reader: 512×512 PNG, чистый Node (zlib), без зависимостей.
// Скруглённый квадрат с тёмным «чернильным» градиентом + глиф «M↓» (логотип Markdown)
// с изумрудно-циановым градиентом.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const S = 512;

/* ---------- геометрия: SDF-примитивы ---------- */

// расстояние до отрезка
function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const wx = px - ax, wy = py - ay;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
    const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
    return Math.hypot(dx, dy);
}

// SDF скруглённого прямоугольника (0,0 — центр)
function rrDist(px, py, cx, cy, hx, hy, r) {
    const dx = Math.abs(px - cx) - (hx - r);
    const dy = Math.abs(py - cy) - (hy - r);
    const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

// глиф: набор отрезков, возвращает расстояние до ближайшего
const M_STROKES = [
    [150, 352, 150, 160], // левая нога
    [150, 160, 239, 296], // диагональ вниз
    [239, 296, 328, 160], // диагональ вверх
    [328, 160, 328, 352], // правая нога
];
const ARROW = [
    [386, 168, 386, 292],      // ножка
    [348, 258, 386, 300],      // крыло
    [424, 258, 386, 300],      // крыло
];
const GLYPH = [...M_STROKES, ...ARROW];

function glyphDist(px, py) {
    let d = Infinity;
    for (const [ax, ay, bx, by] of GLYPH) {
        d = Math.min(d, segDist(px, py, ax, ay, bx, by));
    }
    return d;
}

/* ---------- рендер с 2×2 суперсэмплингом ---------- */

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
];
const C1 = [15, 23, 42];   // #0F172A чернильный (верх диагонали)
const C2 = [30, 41, 59];   // #1E293B тёмный сланец (низ диагонали)
const G1 = [52, 211, 153]; // #34D399 изумруд (верх глифа)
const G2 = [34, 211, 238]; // #22D3EE циан (низ глифа)

const rgba = Buffer.alloc(S * S * 4);
const STROKE = 34 / 2; // полутолщина линий

for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
        let a = 0; // alpha глифа (0..1)
        for (let sy = 0; sy < 2; sy++) {
            for (let sx = 0; sx < 2; sx++) {
                const px = x + 0.25 + sx * 0.5;
                const py = y + 0.25 + sy * 0.5;
                const d = glyphDist(px, py);
                a += Math.max(0, Math.min(1, STROKE - d + 0.5));
            }
        }
        a /= 4;

        // фон: градиент по диагонали
        const t = (x / S + y / S) / 2;
        let [r, g, b] = mix(C1, C2, t);

        // скруглённый квадрат: снаружи прозрачно
        const dRR = rrDist(x + 0.5, y + 0.5, S / 2, S / 2, S / 2 - 2, S / 2 - 2, 104);
        const bgA = Math.max(0, Math.min(1, -dRR + 0.5)); // 1 внутри

        const i = (y * S + x) * 4;
        rgba[i] = Math.round(lerp(0, r, bgA));
        rgba[i + 1] = Math.round(lerp(0, g, bgA));
        rgba[i + 2] = Math.round(lerp(0, b, bgA));
        rgba[i + 3] = Math.round(bgA * 255);

        // градиентный глиф поверх
        if (a > 0) {
            const gt = Math.max(0, Math.min(1, (y + 0.5) / S));
            const [gr, gg, gb] = mix(G1, G2, gt);
            rgba[i] = Math.round(lerp(rgba[i], gr, a));
            rgba[i + 1] = Math.round(lerp(rgba[i + 1], gg, a));
            rgba[i + 2] = Math.round(lerp(rgba[i + 2], gb, a));
        }
    }
}

/* ---------- кодировщик PNG ---------- */

const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;  // бит на канал
ihdr[9] = 6;  // RGBA
// 10,11,12 — compression, filter, interlace = 0

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // фильтр None
    rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}

const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "build", "appicon.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`OK: ${out} (${png.length} байт)`);
