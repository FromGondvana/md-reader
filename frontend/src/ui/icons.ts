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
    pencil: S("<path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/>"),
    save: S(
        "<path d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/><polyline points='17 21 17 13 7 13 7 21'/><polyline points='7 3 7 8 15 8'/>",
    ),
    close: S("<path d='M18 6 6 18'/><path d='m6 6 12 12'/>"),
    plus: S("<path d='M12 5v14'/><path d='M5 12h14'/>"),
    star: S(
        "<polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/>",
    ),
    sort: S("<path d='m3 16 4 4 4-4'/><path d='M7 20V4'/><path d='m21 8-4-4-4 4'/><path d='M17 4v16'/>"),
    funnel: S("<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'/>"),
    download: S(
        "<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/>",
    ),
    trash: S(
        "<path d='M3 6h18'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'/><path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>",
    ),
    filePlus: S(
        "<path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'/><polyline points='14 2 14 8 20 8'/><line x1='12' y1='12' x2='12' y2='18'/><line x1='9' y1='15' x2='15' y2='15'/>",
    ),
    folderPlus: S(
        "<path d='M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'/><line x1='12' y1='10' x2='12' y2='16'/><line x1='9' y1='13' x2='15' y2='13'/>",
    ),
};

/** Логотип Markdown для экрана приветствия. */
export const logoSvg = `<svg viewBox="0 0 208 128" class="welcome-logo" aria-hidden="true">
  <rect x="4" y="4" width="200" height="120" rx="14" fill="none" stroke="currentColor" stroke-width="8"/>
  <path fill="currentColor" d="M30 98V30h21l21.5 27L94 30h21v68H94V60.5L72.5 87 51 60.5V98Z"/>
  <path fill="currentColor" d="M125 30h20v34h20l-30 34-30-34h20Z"/>
</svg>`;
