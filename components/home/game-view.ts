/**
 * When a game starts, scrolls so its score bar and whole board are on screen, clear of the sticky
 * header. On a phone the Play button sits in the middle of the board, so tapping it often leaves the
 * top of the board (where the action is) under the header. Does nothing if the board is already in
 * full view.
 */
export function showWholeGame(board: HTMLElement | null) {
  const game = board?.parentElement;
  if (!board || !game) return;
  const top = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const view = window.innerHeight - top;
  const b = board.getBoundingClientRect();
  if (b.top >= top && b.bottom <= window.innerHeight) return;
  const g = game.getBoundingClientRect();
  // Centered if the whole game fits; otherwise the score bar just under the header.
  const by = g.height <= view ? g.top - top - (view - g.height) / 2 : g.top - top - 8;
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top: by, behavior: smooth ? "smooth" : "auto" });
}
