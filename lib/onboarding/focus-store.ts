// What the tour is pointing at right now. TourFocus measures its target every frame and
// writes it here; the narration card reads it to sit beside the highlight. A tiny external
// store (instead of lifting state into the page) so only the card re-renders, never the app.

export interface FocusRect { top: number; left: number; width: number; height: number }
export interface FocusState { selector: string | null; rect: FocusRect | null }

let state: FocusState = { selector: null, rect: null }
const listeners = new Set<() => void>()

export function setFocus(next: FocusState) {
  const a = state.rect, b = next.rect
  const same = state.selector === next.selector && (a === b || (!!a && !!b &&
    Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5))
  if (same) return
  state = next
  listeners.forEach((l) => l())
}

export function subscribeFocus(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getFocus = () => state
const EMPTY: FocusState = { selector: null, rect: null }
export const getServerFocus = () => EMPTY
