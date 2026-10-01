/**
 * Which data rows a marquee touches, and where its points and rectangle lie on the rows' canvas. Only
 * its vertical span decides the rows; the rules and their reasons: `docs/map/territory/marquee.md`.
 */
import { screenScale } from './rowWindow.js';

/** The rows a marquee touches, by data-row index: `anchor` nearest the press, `head` nearest the pointer. */
export interface MarqueeRange {
  anchor: number;
  head: number;
}

export interface MarqueeRangeInput {
  /** The press's y on the rows' canvas, in px. */
  from: number;
  /** The pointer's y on the rows' canvas, in px. */
  to: number;
  /** One row's measured height, in px. */
  rowHeight: number;
  /** How many rows the list has in all. */
  total: number;
}

/** The contiguous rows whose band the span overlaps, or `null` when it overlaps none. */
export function marqueeRange({ from, to, rowHeight, total }: MarqueeRangeInput): MarqueeRange | null {
  if (!(rowHeight > 0) || total <= 0) return null;

  const top = Math.min(from, to);
  const bottom = Math.max(from, to);
  const first = Math.floor(top / rowHeight);
  // A span ending on a border overlaps nothing of the row below; a zero-height span keeps its row.
  const last = Math.max(first, Math.ceil(bottom / rowHeight) - 1);
  if (last < 0 || first > total - 1) return null;

  const low = Math.max(0, first);
  const high = Math.min(total - 1, last);
  return from <= to ? { anchor: low, head: high } : { anchor: high, head: low };
}

export interface MarqueeScaleInput {
  /** The scroller's height on screen (`getBoundingClientRect`) and in layout (`offsetHeight`). */
  scrollerScreen: number;
  scrollerLayout: number;
  /** The rows' canvas's height on screen and in layout. */
  canvasScreen: number;
  canvasLayout: number;
}

/**
 * Screen px per layout px: `screenScale` over the longer of the scroller and the canvas. The reason:
 * `docs/map/territory/marquee.md`.
 */
export function marqueeScale({
  scrollerScreen,
  scrollerLayout,
  canvasScreen,
  canvasLayout,
}: MarqueeScaleInput): number {
  return canvasLayout > scrollerLayout
    ? screenScale(canvasScreen, canvasLayout)
    : screenScale(scrollerScreen, scrollerLayout);
}

/** The scroller's inner box on screen — its scrollbars and border excluded — in client px. */
export interface MarqueeView {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Screen px per layout px. */
  scale: number;
}

export interface MarqueeViewInput {
  /** The scroller's border box on screen: its `getBoundingClientRect()`'s left and top. */
  boxLeft: number;
  boxTop: number;
  /** The scroller's left and top border widths. */
  clientLeft: number;
  clientTop: number;
  /** The scroller's inner width and height. */
  clientWidth: number;
  clientHeight: number;
  /** Screen px per layout px, as `screenScale` measures it; the `client*` lengths are layout px. */
  scale: number;
}

export function marqueeView({
  boxLeft,
  boxTop,
  clientLeft,
  clientTop,
  clientWidth,
  clientHeight,
  scale,
}: MarqueeViewInput): MarqueeView {
  return {
    left: boxLeft + clientLeft * scale,
    top: boxTop + clientTop * scale,
    width: clientWidth * scale,
    height: clientHeight * scale,
    scale,
  };
}

/**
 * Whether a press at this client point lies at or past the view's inner right or bottom edge. A zero
 * length marks no scrollbar on its axis: `docs/map/invariant/zero-is-no-measurement.md`.
 */
export function pressOnScrollbar(view: MarqueeView, clientX: number, clientY: number): boolean {
  if (view.width > 0 && clientX >= view.left + view.width) return true;
  if (view.height > 0 && clientY >= view.top + view.height) return true;
  return false;
}

/**
 * The scroller's content in canvas px, which are layout px; a side with no measured length is
 * `Infinity`.
 */
export interface MarqueeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What a marquee reads once, at the press, and measures every later point against. */
export interface MarqueeFrame {
  view: MarqueeView;
  /** The canvas's client box at the press. */
  canvasLeft: number;
  canvasTop: number;
  /** The scroller's scroll offset at the press. */
  scrollLeft: number;
  scrollTop: number;
  bounds: MarqueeBounds;
}

export interface MarqueeFrameInput {
  view: MarqueeView;
  /** The canvas's `getBoundingClientRect()` left and top at the press. */
  canvasLeft: number;
  canvasTop: number;
  /** The scroller's `scrollLeft`, `scrollTop`, `scrollWidth` and `scrollHeight` at the press. */
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
}

export function marqueeFrame({
  view,
  canvasLeft,
  canvasTop,
  scrollLeft,
  scrollTop,
  scrollWidth,
  scrollHeight,
}: MarqueeFrameInput): MarqueeFrame {
  /** The canvas's offset in the scroller's content, in layout px; leading rows push it down. */
  const offsetLeft = (canvasLeft - view.left) / view.scale + scrollLeft;
  const offsetTop = (canvasTop - view.top) / view.scale + scrollTop;
  return {
    view,
    canvasLeft,
    canvasTop,
    scrollLeft,
    scrollTop,
    // A zero length bounds nothing: `docs/map/invariant/zero-is-no-measurement.md`.
    bounds: {
      left: -offsetLeft,
      top: -offsetTop,
      right: scrollWidth > 0 ? scrollWidth - offsetLeft : Infinity,
      bottom: scrollHeight > 0 ? scrollHeight - offsetTop : Infinity,
    },
  };
}

/** A point on the rows' canvas, in layout px. */
export interface CanvasPoint {
  x: number;
  y: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * A client point on the rows' canvas: clamped to the frame's view, less the canvas's client box at the
 * press and divided by the scale, plus how far the scroller has scrolled since. `scrollLeft` and
 * `scrollTop` are the scroller's now. A zero view length clamps nothing on its axis.
 */
export function toCanvas(
  frame: MarqueeFrame,
  clientX: number,
  clientY: number,
  scrollLeft: number,
  scrollTop: number,
): CanvasPoint {
  const { view } = frame;
  const x = view.width > 0 ? clamp(clientX, view.left, view.left + view.width) : clientX;
  const y = view.height > 0 ? clamp(clientY, view.top, view.top + view.height) : clientY;
  return {
    x: (x - frame.canvasLeft) / view.scale + scrollLeft - frame.scrollLeft,
    y: (y - frame.canvasTop) / view.scale + scrollTop - frame.scrollTop,
  };
}

/** The rectangle's box on the rows' canvas, in layout px. */
export interface MarqueeBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The rectangle between the press's point and the pointer's, each edge clamped to `bounds`. */
export function marqueeRectangle(
  bounds: MarqueeBounds,
  origin: CanvasPoint,
  here: CanvasPoint,
): MarqueeBox {
  const left = clamp(Math.min(origin.x, here.x), bounds.left, bounds.right);
  const right = clamp(Math.max(origin.x, here.x), bounds.left, bounds.right);
  const top = clamp(Math.min(origin.y, here.y), bounds.top, bounds.bottom);
  const bottom = clamp(Math.max(origin.y, here.y), bounds.top, bounds.bottom);
  return { left, top, width: right - left, height: bottom - top };
}
