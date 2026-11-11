// Where the tour's narration card goes, given what is highlighted. Pure, so it can be tested.
//
// The card is an overlay: it sits in the dimmed part of the screen next to the highlight and
// never reshapes the product. It tries right, left, below, above (in that order — reading
// flows from the highlighted thing to the explanation), takes as much width as that side
// allows within MIN..MAX, and is clamped inside the viewport. When no side has room (the
// highlight fills the screen) it sits inside the viewport over the target's bottom-right
// corner, which on every screen we tour is the least important part of it.

import type { FocusRect } from "./focus-store"

export type Side = "right" | "left" | "below" | "above" | "inside"
export interface Placement { side: Side; left: number; top: number; width: number }
export interface Viewport { width: number; height: number; top: number /* below the app header */ }

export const CARD_MIN = 256  // the lane beside the 1080px customer file at 1728px; the card tightens its type below 320
export const CARD_MAX = 420
const GAP = 20
const FIGURES_LANE = 340 // right-most columns of a wide list: duration + price
const EDGE = 16

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function placeCard(target: FocusRect, cardHeight: number, vp: Viewport): Placement {
  const right = vp.width - (target.left + target.width) - GAP - EDGE
  const left = target.left - GAP - EDGE
  const below = vp.height - (target.top + target.height) - GAP - EDGE
  const above = target.top - vp.top - GAP - EDGE
  const topAligned = clamp(target.top, vp.top + EDGE, vp.height - cardHeight - EDGE)

  if (right >= CARD_MIN) {
    const width = Math.min(CARD_MAX, right)
    return { side: "right", left: target.left + target.width + GAP, top: topAligned, width }
  }
  if (left >= CARD_MIN) {
    const width = Math.min(CARD_MAX, left)
    return { side: "left", left: target.left - GAP - width, top: topAligned, width }
  }
  const hCentred = (width: number) =>
    clamp(target.left + target.width - width, EDGE, vp.width - width - EDGE) // right-aligned to the target
  if (below >= cardHeight) {
    return { side: "below", left: hCentred(CARD_MAX), top: target.top + target.height + GAP, width: CARD_MAX }
  }
  if (above >= cardHeight) {
    return { side: "above", left: hCentred(CARD_MAX), top: target.top - GAP - cardHeight, width: CARD_MAX }
  }
  // the highlight fills the screen: tuck the card into its bottom-right corner
  const width = CARD_MAX
  const visibleBottom = Math.min(target.top + target.height, vp.height) - EDGE
  // A wide list or table keeps its figures (duration, price) in the right-most columns and
  // truncated prose in the middle, so a card over the very corner hides what the viewer was
  // meant to read. Slide it left over the prose.
  const clearFigures = target.width >= width * 3 ? FIGURES_LANE : 0
  return {
    side: "inside",
    left: clamp(target.left + target.width - width - EDGE - clearFigures, EDGE, vp.width - width - EDGE),
    top: clamp(visibleBottom - cardHeight, vp.top + EDGE, vp.height - cardHeight - EDGE),
    width,
  }
}
