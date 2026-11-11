// While the tour runs it owns the screen: the viewer cannot change page, close a dialog the
// tour opened, or tab into the dimmed product. These are the pure rules the page applies, kept
// here so they can be tested without a browser.

/** Only the tour itself may change the page while it is active. */
export function canChangeView(tourActive: boolean, source: "tour" | "user"): boolean {
  return !tourActive || source === "tour"
}

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"])
const ACTIVATE_KEYS = new Set([" ", "Enter"])

/**
 * Should the page cancel this keystroke while the tour is active?
 * Escape never reaches a dialog or the sidebar, Tab never leaves the card, and Enter/Space
 * never "click" a dimmed button the viewer managed to focus. Scrolling keys pass, and keys
 * pressed inside the tour card are left to the card. Only Escape also needs its propagation
 * stopped (Radix listens for it on the document); the others just need preventDefault, so the
 * card's own window-level shortcuts keep working.
 */
export function shouldSwallowKey(key: string, inTourUi: boolean): boolean {
  if (SCROLL_KEYS.has(key)) return false
  if (inTourUi) return key === "Escape"
  return key === "Escape" || key === "Tab" || ACTIVATE_KEYS.has(key)
}
