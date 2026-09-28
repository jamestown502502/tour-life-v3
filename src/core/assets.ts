// Real-asset swap-in layer (Phase G).
//
// How the seam works: every ensureX() function in src/art/sprites.ts routes through
// withGraphics(), which early-returns if `scene.textures.exists(key)`. So if a real painted
// image is registered in Phaser's texture manager under the SAME key a code-drawn function
// would have generated, the real image wins and the code-drawn path never runs. A missing or
// broken file simply isn't registered, and the code-drawn version draws as before. That makes
// code-drawn a genuine automatic fallback, not a parallel branch anyone has to maintain.

export interface ManifestEntry {
  key: string;
  file: string;
}

const MANIFEST_PATH = 'assets/manifest.json';
/** Art that is not needed in a run's first minutes: loaded after the title screen appears, never
 *  at boot. The boot manifest is already ~10 MB; this keeps it from doubling. */
export const LATER_MANIFEST_PATH = 'assets/manifest-later.json';

/** Vite sets BASE_URL from vite.config's `base` ('./' here), so this resolves correctly both
 *  on the dev server and in the static production build. */
export function assetBaseUrl(): string {
  return import.meta.env.BASE_URL ?? './';
}

export async function fetchManifest(path: string = MANIFEST_PATH): Promise<ManifestEntry[]> {
  try {
    const res = await fetch(`${assetBaseUrl()}${path}`, { cache: 'no-cache' });
    if (!res.ok) return [];
    const parsed = await res.json();
    if (!Array.isArray(parsed)) {
      console.warn('[assets] manifest.json is not an array — ignoring it');
      return [];
    }
    return parsed.filter((e): e is ManifestEntry =>
      !!e && typeof e.key === 'string' && typeof e.file === 'string');
  } catch {
    // No manifest at all is a completely valid state — the game is fully playable code-drawn.
    return [];
  }
}

const realAssetKeys = new Set<string>();

export function markRealAsset(key: string): void {
  realAssetKeys.add(key);
}

/** True when `key` is backed by a real painted asset rather than the code-drawn fallback.
 *
 *  Scenes need this because some code-drawn art is *composed against its own background*. The
 *  bus hub is the clearest case: the code-drawn `bg_hub` bakes in a window frame at a known
 *  position and a corkboard frame in the corner, and HubScene draws a tinted window pane and
 *  souvenir chips on top of exactly those spots. A painted bus interior puts its windows
 *  wherever the model decided, so those same overlays would land on unrelated pixels. Rather
 *  than fight the generator for pixel-accurate placement, scenes ask this and adapt. */
export function hasRealAsset(key: string): boolean {
  return realAssetKeys.has(key);
}

/** Keys queued by the background loader that have not arrived yet. While a key is pending, a
 *  code-drawn fallback must NOT be generated under it: the real image would then find its key
 *  already taken when it lands, and Phaser would discard it for the rest of the session. See
 *  ensureMiniGameBackdrop, which draws its placeholder under a separate key instead. */
const pendingKeys = new Set<string>();

export function markPending(key: string): void { pendingKeys.add(key); }
export function settlePending(key: string): void { pendingKeys.delete(key); }
export function isPending(key: string): boolean { return pendingKeys.has(key); }

// The one real (non-procedural) audio asset the design allows (DESIGN.md §15.17) — a single
// flag rather than a Set since there's only ever this one file. Same missing-file tolerance as
// markRealAsset/hasRealAsset above: BootScene only calls markTitleThemeLoaded() on a successful
// load, so a missing/corrupt file just leaves this false and TitleScene keeps using the
// procedural DEFAULT_AMBIENCE it already had.
let titleThemeLoaded = false;

export function markTitleThemeLoaded(): void {
  titleThemeLoaded = true;
}

export function hasTitleTheme(): boolean {
  return titleThemeLoaded;
}
