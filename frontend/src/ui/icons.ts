const S = (p: string): string =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

export const icons = {
    back: S("<path d='M19 12H5'/><path d='m12 19-7-7 7-7'/>"),
    fwd: S("<path d='M5 12h14'/><path d='m12 5 7 7-7 7'/>"),
    chev: S("<polyline points='9 18 15 12 9 6'/>"),
    folder: S(
        "<path d='M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'/>",
    ),
    file: S(
        "<path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'/><polyline points='14 2 14 8 20 8'/>",
    ),
    search: S("<circle cx='11' cy='11' r='8'/><path d='m21 21-4.3-4.3'/>"),
    panelLeft: S("<rect width='18' height='18' x='3' y='3' rx='2'/><path d='M9 3v18'/>"),
    list: S(
        "<line x1='8' y1='6' x2='21' y2='6'/><line x1='8' y1='12' x2='21' y2='12'/><line x1='8' y1='18' x2='21' y2='18'/><line x1='3.5' y1='6' x2='3.51' y2='6'/><line x1='3.5' y1='12' x2='3.51' y2='12'/><line x1='3.5' y1='18' x2='3.51' y2='18'/>",
    ),
    sun: S(
        "<circle cx='12' cy='12' r='4'/><path d='M12 2v2'/><path d='M12 20v2'/><path d='m4.93 4.93 1.41 1.41'/><path d='m17.66 17.66 1.41 1.41'/><path d='M2 12h2'/><path d='M20 12h2'/><path d='m6.34 17.66-1.41 1.41'/><path d='m19.07 4.93-1.41 1.41'/>",
    ),
    moon: S("<path d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'/>"),
    copy: S(
        "<rect width='14' height='14' x='8' y='8' rx='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/>",
    ),
};

/** Логотип Markdown для экрана приветствия. */
export const logoSvg = `<svg viewBox="0 0 208 128" class="welcome-logo" aria-hidden="true">
  <rect x="4" y="4" width="200" height="120" rx="14" fill="none" stroke="currentColor" stroke-width="8"/>
  <path fill="currentColor" d="M30 98V30h21l21.5 27L94 30h21v68H94V60.5L72.5 87 51 60.5V98Z"/>
  <path fill="currentColor" d="M125 30h20v34h20l-30 34-30-34h20Z"/>
</svg>`;
