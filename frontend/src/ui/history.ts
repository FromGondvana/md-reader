import { state } from "../state";
import { openFile, rememberScroll } from "./viewer";

/** Назад по истории. */
export function goBack(): void {
    if (state.historyIdx <= 0) return;
    rememberScroll();
    state.historyIdx--;
    const loc = state.history[state.historyIdx];
    void openFile(loc.path, {
        anchor: loc.anchor,
        push: false,
        scrollTop: loc.scrollTop,
    });
}

/** Вперёд по истории. */
export function goForward(): void {
    if (state.historyIdx >= state.history.length - 1) return;
    rememberScroll();
    state.historyIdx++;
    const loc = state.history[state.historyIdx];
    void openFile(loc.path, {
        anchor: loc.anchor,
        push: false,
        scrollTop: loc.scrollTop,
    });
}
