// Screen-reader announcements (2026-10-07). The game is one Phaser canvas, which a screen reader
// sees as a blank image. A polite live region reads out each dialogue line (with its speaker) as it
// starts, so the story — most of the game — can be followed with TalkBack or VoiceOver on. Buttons
// inside the canvas are still not reachable this way; see the before/after doc's accessibility note.
let live: HTMLElement | null = null;
let last = '';

export function announce(text: string): void {
  if (typeof document === 'undefined' || !text || text === last) return;
  last = text;
  if (!live) {
    live = document.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    Object.assign(live.style, { position: 'fixed', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' });
    document.body.appendChild(live);
  }
  live.textContent = text;
}
