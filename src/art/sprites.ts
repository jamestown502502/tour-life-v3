// All visuals are code-drawn: Phaser Graphics + generateTexture(). No image files.
import Phaser from 'phaser';
import { H, PALETTE, UI_RADIUS, W } from '../const';
import { CITY_TINTS, NIGHT_TINTS } from './palette';
import type { BandmateId } from '../../content/schema';

function withGraphics(scene: Phaser.Scene, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** A tiny xorshift-ish deterministic PRNG local to art generation — not the game's seeded RNG
 *  (src/core/rng.ts), just enough to make repeated fillRect calls look organic without state. */
function nextSeed(seed: number): number {
  return (seed * 9301 + 49297) % 233280;
}

function lerpColor(c1: number, c2: number, t: number): number {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

/** Vertical gradient as banded solid fills. NOT Graphics.fillGradientStyle — confirmed by
 *  direct pixel readback that fillGradientStyle bakes as fully transparent through
 *  generateTexture() in this Phaser/WebGL setup (solid fillStyle bakes correctly; the gradient
 *  shader path apparently isn't captured by the RenderTexture snapshot). Every background that
 *  used to call fillGradientStyle was silently invisible — masked only because PALETTE.night
 *  happens to match the page's own background color. Don't reintroduce fillGradientStyle inside
 *  a withGraphics()/generateTexture() callback without re-verifying this is fixed upstream. */
function fillVerticalGradient(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number,
  colorTop: number, colorBottom: number, alpha = 1, steps = 24,
): void {
  const stepH = h / steps;
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    g.fillStyle(lerpColor(colorTop, colorBottom, t), alpha);
    g.fillRect(x, y + i * stepH, w, stepH + 1);
  }
}

/** One row of silhouette buildings, optionally with lit windows scattered inside them —
 *  shared by the title screen and city backgrounds so both use the same depth language. */
function drawBuildingRow(
  g: Phaser.GameObjects.Graphics, startSeed: number, baseY: number, color: number, alpha: number,
  minH: number, maxH: number, minW: number, maxW: number, gap: number, startX: number,
  windowColor?: number, windowAlpha = 0.55,
): void {
  let seed = startSeed;
  let x = startX;
  while (x < W) {
    seed = nextSeed(seed);
    const bw = minW + (seed % (maxW - minW));
    seed = nextSeed(seed);
    const bh = minH + (seed % (maxH - minH));
    const top = baseY - bh;
    g.fillStyle(color, alpha);
    g.fillRect(x, top, bw, bh);
    if (windowColor !== undefined) {
      g.fillStyle(windowColor, windowAlpha);
      for (let wy = top + 12; wy < baseY - 10; wy += 20) {
        for (let wx = x + 6; wx < x + bw - 6; wx += 15) {
          seed = nextSeed(seed);
          if (seed % 3 === 0) g.fillRect(wx, wy, 6, 8);
        }
      }
    }
    x += bw + gap;
  }
}

// Shared UI-chrome shapes. A plain white rounded rect (for shadows/glows via .setTint()) plus
// a fill+gold-border variant (for actual button/chip faces) — one texture cache per unique
// size+radius(+color), reused everywhere so the whole game shares one geometry language.
export function ensureRoundedRect(scene: Phaser.Scene, w: number, h: number, radius: number): string {
  const key = `rrect_${w}_${h}_${radius}`;
  withGraphics(scene, w, h, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, w, h, radius);
  }, key);
  return key;
}

export function ensureButtonTexture(scene: Phaser.Scene, w: number, h: number, fill: number, disabled: boolean, radius: number = UI_RADIUS.button): string {
  const key = `btn_${w}_${h}_${radius}_${fill.toString(16)}_${disabled ? 1 : 0}`;
  withGraphics(scene, w, h, (g) => {
    g.fillStyle(fill, 0.95);
    g.fillRoundedRect(0, 0, w, h, radius);
    g.lineStyle(2, PALETTE.gold, disabled ? 0.2 : 0.7);
    g.strokeRoundedRect(1, 1, w - 2, h - 2, radius);
    // subtle top-edge highlight so it reads as raised, not flat
    g.lineStyle(2, 0xffffff, 0.15);
    g.beginPath();
    g.moveTo(radius, 2);
    g.lineTo(w - radius, 2);
    g.strokePath();
  }, key);
  return key;
}

/** A full-screen darkening scrim: strongest at the top and bottom edges, fully clear through
 *  the middle. Painted backgrounds are far busier than the flat code-drawn fills they replace,
 *  and loose UI text (the city name at the top, the location-picker header, Hub stat labels)
 *  sits directly on them with no panel behind it. This keeps that text readable without
 *  flattening the artwork where nothing overlaps it.
 *
 *  Built from banded solid fills with per-band alpha, NOT fillGradientStyle — see the comment
 *  on fillVerticalGradient above for why that function is unusable inside generateTexture(). */
export function ensureScrimTexture(scene: Phaser.Scene): string {
  const key = 'ui_scrim';
  const steps = 40;
  withGraphics(scene, W, H, (g) => {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);              // 0 at top, 1 at bottom
      const middleness = 1 - Math.abs(t - 0.5) * 2; // 1 mid-screen, 0 at both edges
      const alpha = 0.5 * (1 - middleness) ** 1.5;  // eased so the falloff isn't a hard wedge
      if (alpha <= 0.001) continue;
      // Integer band edges derived from the index: exactly contiguous, never overlapping.
      // A fractional height with a `+1` fudge (the obvious way to avoid seams) makes adjacent
      // bands share a row — and because these fills are semi-transparent, a shared row gets
      // composited twice and shows up as a visible darker line every few pixels.
      const y0 = Math.round((H * i) / steps);
      const y1 = Math.round((H * (i + 1)) / steps);
      g.fillStyle(PALETTE.night, alpha);
      g.fillRect(0, y0, W, y1 - y0);
    }
  }, key);
  return key;
}

export function ensureTitleBackground(scene: Phaser.Scene): string {
  const key = 'bg_title';
  withGraphics(scene, W, H, (g) => {
    fillVerticalGradient(g, 0, 0, W, H, PALETTE.night, PALETTE.plum);
    // Soft moon, behind the skyline
    g.fillStyle(PALETTE.gold, 0.85);
    g.fillCircle(W - 120, 160, 46);
    // Far layer: smaller silhouettes with lit windows
    drawBuildingRow(g, 7, H - 60, PALETTE.plum, 0.7, 100, 240, 36, 90, 8, 0, PALETTE.gold);
    // Near layer: larger, darker, unlit — foreground depth
    drawBuildingRow(g, 91, H, PALETTE.night, 0.9, 70, 190, 56, 130, 10, -20);
  }, key);
  return key;
}

export function ensureCityBackground(scene: Phaser.Scene, cityId: string, tint: string): string {
  const key = `bg_city_${cityId}`;
  withGraphics(scene, W, H, (g) => {
    const tintColor = CITY_TINTS[tint] ?? CITY_TINTS.warm_amber;
    const isNight = NIGHT_TINTS.has(tint);
    fillVerticalGradient(g, 0, 0, W, H, PALETTE.sky, tintColor);
    // Far layer: distant buildings, windows lit gold at night / soft cream glass by day
    drawBuildingRow(g, 13, H - 340, PALETTE.cream, 0.22, 160, 340, 70, 130, 12, -30,
      isNight ? PALETTE.gold : PALETTE.cream, isNight ? 0.6 : 0.3);
    // Near layer: closer foreground silhouette in the city's own tint
    drawBuildingRow(g, 61, H, tintColor, 0.28, 120, 260, 90, 170, 14, -30);
  }, key);
  return key;
}

/** Addendum v2, Item 10: the rhythm playfield's stage backdrop, per city. Same seam as every
 *  other background — register a real image under `bg_rhythm_<cityId>` and this fallback is
 *  simply never called. Falls back to the original flat night rectangle (RhythmScene's look
 *  before this pass) rather than inventing a new code-drawn stage scene, since the lanes/notes
 *  themselves are already the whole visual focus in that fallback case. */
export function ensureRhythmStageBackdrop(scene: Phaser.Scene, cityId: string): string {
  const key = `bg_rhythm_${cityId}`;
  withGraphics(scene, W, H, (g) => {
    g.fillStyle(PALETTE.night, 1);
    g.fillRect(0, 0, W, H);
  }, key);
  return key;
}

/** Code-drawn fallback backdrop for a minigame that has no real painted backdrop yet (or when
 *  one fails to load) — the same texture-key seam as every other background: register a real
 *  image under `bg_mini_<id>` and this function is simply never called. A soft gradient +
 *  a few scattered warm motes reads as "somewhere backstage," not a placeholder. */
export function ensureMiniGameBackdrop(scene: Phaser.Scene, id: string, tint: number): string {
  const key = `bg_mini_${id}`;
  withGraphics(scene, W, H, (g) => {
    fillVerticalGradient(g, 0, 0, W, H, PALETTE.night, tint, 1, 20);
    let seed = id.length * 97 + 13;
    for (let i = 0; i < 26; i++) {
      seed = nextSeed(seed);
      const x = seed % W;
      seed = nextSeed(seed);
      const y = 80 + (seed % (H - 200));
      seed = nextSeed(seed);
      const r = 2 + (seed % 4);
      g.fillStyle(PALETTE.gold, 0.12 + (seed % 20) / 100);
      g.fillCircle(x, y, r);
    }
  }, key);
  return key;
}

export function ensureBusHubBackground(scene: Phaser.Scene): string {
  const key = 'bg_hub';
  withGraphics(scene, W, H, (g) => {
    fillVerticalGradient(g, 0, 0, W, H, PALETTE.plum, PALETTE.night);
    // window frame (pane fill drawn dynamically per-scene so it can reflect the next city's weather)
    g.fillStyle(PALETTE.night, 1);
    g.fillRoundedRect(80, 160, W - 160, 340, 24);
    // string lights along the ceiling
    g.fillStyle(PALETTE.gold, 0.9);
    for (let x = 40; x < W - 40; x += 34) {
      const sag = Math.sin((x / W) * Math.PI) * 14;
      g.fillCircle(x, 60 + sag, 4);
    }
    g.lineStyle(1.5, PALETTE.gold, 0.35);
    g.beginPath();
    for (let x = 40; x < W - 40; x += 6) {
      const sag = Math.sin((x / W) * Math.PI) * 14;
      if (x === 40) g.moveTo(x, 60 + sag); else g.lineTo(x, 60 + sag);
    }
    g.strokePath();
    // bunks along the lower-left wall
    g.fillStyle(PALETTE.terracotta, 0.55);
    g.fillRoundedRect(40, 560, 180, 60, 12);
    g.fillRoundedRect(40, 630, 180, 60, 12);
    // seats
    g.fillStyle(PALETTE.terracotta, 0.9);
    g.fillRoundedRect(100, 620, W - 200, 160, 18);
    g.lineStyle(2, 0xffffff, 0.12);
    g.beginPath(); g.moveTo(118, 622); g.lineTo(W - 118, 622); g.strokePath();
    // corkboard frame (souvenir pins/labels drawn dynamically in HubScene, on top)
    g.fillStyle(0x8a6a4a, 0.9);
    g.fillRoundedRect(W - 190, 860, 150, 190, 10);
    g.lineStyle(6, 0x6b4a2f, 1);
    g.strokeRoundedRect(W - 190, 860, 150, 190, 10);
  }, key);
  return key;
}

/** Window-pane fill, colored by the given tint — drawn separately from the cached hub
 *  background so it can change with whichever city is coming up next without invalidating
 *  the (much larger, static) background texture. */
export function ensureHubWindowPane(scene: Phaser.Scene, tint: string): string {
  const key = `hub_window_${tint}`;
  const tintColor = CITY_TINTS[tint] ?? PALETTE.night;
  withGraphics(scene, W - 180, 320, (g) => {
    fillVerticalGradient(g, 0, 0, W - 180, 320, PALETTE.sky, tintColor, 0.45);
  }, key);
  return key;
}

export function ensureDialoguePanel(scene: Phaser.Scene): string {
  const key = 'panel_dialogue';
  const w = W - 60, h = 300, r = UI_RADIUS.card;
  withGraphics(scene, w, h, (g) => {
    g.fillStyle(PALETTE.sand, 0.97);
    g.fillRoundedRect(0, 0, w, h, r);
    g.lineStyle(2, PALETTE.gold, 0.35);
    g.strokeRoundedRect(1, 1, w - 2, h - 2, r);
    // top-edge highlight so the panel reads as raised, not flat
    g.lineStyle(3, 0xffffff, 0.4);
    g.beginPath();
    g.moveTo(r, 2);
    g.lineTo(w - r, 2);
    g.strokePath();
  }, key);
  return key;
}

export function ensurePortraitFrame(scene: Phaser.Scene): string {
  const key = 'portrait_frame';
  const size = 168;
  withGraphics(scene, size, size, (g) => {
    g.fillStyle(PALETTE.cream, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 4);
    g.lineStyle(4, PALETTE.gold, 0.9);
    g.strokeCircle(size / 2, size / 2, size / 2 - 4);
  }, key);
  return key;
}

// Clothing/identity color per bandmate (torso, accessory accents).
export const BANDMATE_BASE: Record<BandmateId, number> = {
  mira: 0xc4704f,
  theo: 0x3e7c7b,
  jun: 0xd9a441,
  rowan: 0x8fb7c9,
};

const SKIN: Record<BandmateId, number> = {
  mira: 0xead9bd, theo: 0xc48a5f, jun: 0x8a5a3c, rowan: 0xe0b48a,
};
const HAIR: Record<BandmateId, number> = {
  mira: 0x3a2418, theo: 0x6b4a2f, jun: 0x1c1c1c, rowan: 0x8a3a2a,
};

const PORTRAIT_SIZE = 280;
const CX = PORTRAIT_SIZE / 2;
const CY = 118;
const HEAD_R = 62;

function drawTorso(g: Phaser.GameObjects.Graphics, id: BandmateId): void {
  g.fillStyle(BANDMATE_BASE[id], 1);
  g.beginPath();
  g.moveTo(CX - 46, PORTRAIT_SIZE);
  g.lineTo(CX - 70, CY + HEAD_R + 70);
  g.lineTo(CX - 30, CY + HEAD_R + 34);
  g.lineTo(CX + 30, CY + HEAD_R + 34);
  g.lineTo(CX + 70, CY + HEAD_R + 70);
  g.lineTo(CX + 46, PORTRAIT_SIZE);
  g.closePath();
  g.fillPath();
  // neck
  g.fillStyle(SKIN[id], 1);
  g.fillRoundedRect(CX - 18, CY + HEAD_R - 14, 36, 40, 10);
}

function drawHairBack(g: Phaser.GameObjects.Graphics, id: BandmateId): void {
  const hair = HAIR[id];
  g.fillStyle(hair, 1);
  if (id === 'mira') {
    // long wavy sides, flowing past the shoulders
    g.fillEllipse(CX, CY - HEAD_R * 0.35, HEAD_R * 1.7, HEAD_R * 1.15);
    g.fillEllipse(CX - HEAD_R * 0.92, CY + HEAD_R * 0.75, HEAD_R * 0.55, HEAD_R * 1.9);
    g.fillEllipse(CX + HEAD_R * 0.92, CY + HEAD_R * 0.75, HEAD_R * 0.55, HEAD_R * 1.9);
  } else if (id === 'theo') {
    // shaggy base — front spikes added in drawHairFront
    g.fillEllipse(CX, CY - HEAD_R * 0.5, HEAD_R * 1.75, HEAD_R * 0.95);
  } else if (id === 'jun') {
    // cropped undercut — a thin band hugging just the top
    g.fillEllipse(CX, CY - HEAD_R * 0.6, HEAD_R * 1.5, HEAD_R * 0.6);
  } else {
    // rowan: neat cap, braid added in drawHairFront
    g.fillEllipse(CX, CY - HEAD_R * 0.42, HEAD_R * 1.55, HEAD_R * 1.0);
  }
}

function drawHairFront(g: Phaser.GameObjects.Graphics, id: BandmateId): void {
  const hair = HAIR[id];
  g.fillStyle(hair, 1);
  if (id === 'theo') {
    for (let i = -2; i <= 2; i++) {
      const x = CX + i * HEAD_R * 0.34;
      const jitter = (i * i) % 2 === 0 ? 6 : -4;
      g.fillTriangle(x - 12, CY - HEAD_R * 0.32, x + 12, CY - HEAD_R * 0.32, x + jitter, CY - HEAD_R * 0.78);
    }
  } else if (id === 'rowan') {
    // braid over one shoulder — a segmented cord of shrinking circles
    for (let i = 0; i < 6; i++) {
      g.fillCircle(CX + HEAD_R * 0.8, CY + HEAD_R * 0.15 + i * 15, 9 - i * 0.6);
    }
  }
}

function drawAccessory(g: Phaser.GameObjects.Graphics, id: BandmateId): void {
  if (id === 'mira') {
    // small pendant necklace
    g.lineStyle(2, PALETTE.gold, 0.8);
    g.beginPath(); g.arc(CX, CY + HEAD_R + 4, 14, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160)); g.strokePath();
    g.fillStyle(PALETTE.gold, 1);
    g.fillCircle(CX, CY + HEAD_R + 18, 6);
  } else if (id === 'theo') {
    // drumstick tucked behind one ear
    g.fillStyle(0xc9a876, 1);
    g.save();
    g.translateCanvas(CX + HEAD_R * 0.75, CY - 6);
    g.rotateCanvas(Phaser.Math.DegToRad(35));
    g.fillRoundedRect(-4, -46, 8, 60, 4);
    g.restore();
  } else if (id === 'jun') {
    // guitar pick on a cord
    g.lineStyle(2, PALETTE.plum, 0.5);
    g.lineBetween(CX - 10, CY + HEAD_R + 2, CX, CY + HEAD_R + 20);
    g.lineBetween(CX + 10, CY + HEAD_R + 2, CX, CY + HEAD_R + 20);
    g.fillStyle(BANDMATE_BASE.jun, 1);
    g.fillTriangle(CX, CY + HEAD_R + 16, CX - 8, CY + HEAD_R + 32, CX + 8, CY + HEAD_R + 32);
  } else {
    // rowan: bass strap across the torso
    g.lineStyle(10, PALETTE.plum, 0.5);
    g.lineBetween(CX - 60, CY + HEAD_R + 30, CX + 50, PORTRAIT_SIZE - 10);
  }
}

function drawFace(g: Phaser.GameObjects.Graphics, mood: string): void {
  const eyeY = mood === 'tense' ? CY - 12 : mood === 'inspired' ? CY - 10 : CY - 6;
  const dx = 22;

  g.lineStyle(4, PALETTE.plum, 0.85);
  if (mood === 'worried') {
    g.lineBetween(CX - dx - 10, eyeY - 15, CX - dx + 8, eyeY - 21);
    g.lineBetween(CX + dx + 10, eyeY - 15, CX + dx - 8, eyeY - 21);
  } else if (mood === 'tense') {
    g.lineBetween(CX - dx - 10, eyeY - 13, CX - dx + 6, eyeY - 19);
    g.lineBetween(CX + dx + 10, eyeY - 13, CX + dx - 6, eyeY - 19);
  } else if (mood === 'inspired') {
    g.lineBetween(CX - dx - 10, eyeY - 21, CX - dx + 8, eyeY - 19);
    g.lineBetween(CX + dx + 10, eyeY - 21, CX + dx - 8, eyeY - 19);
  } else {
    g.lineBetween(CX - dx - 10, eyeY - 17, CX - dx + 8, eyeY - 17);
    g.lineBetween(CX + dx + 10, eyeY - 17, CX + dx - 8, eyeY - 17);
  }

  g.fillStyle(PALETTE.plum, 1);
  if (mood === 'tense') {
    g.fillRoundedRect(CX - dx - 8, eyeY, 16, 3, 1.5);
    g.fillRoundedRect(CX + dx - 8, eyeY, 16, 3, 1.5);
  } else if (mood === 'inspired') {
    g.fillCircle(CX - dx, eyeY, 8);
    g.fillCircle(CX + dx, eyeY, 8);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(CX - dx + 2, eyeY - 2, 2.5);
    g.fillCircle(CX + dx + 2, eyeY - 2, 2.5);
  } else {
    g.fillCircle(CX - dx, eyeY, 6);
    g.fillCircle(CX + dx, eyeY, 6);
  }

  g.lineStyle(5, PALETTE.plum, 1);
  if (mood === 'happy') {
    g.beginPath(); g.arc(CX, CY + 26, 22, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160)); g.strokePath();
  } else if (mood === 'worried') {
    g.beginPath(); g.arc(CX, CY + 44, 20, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340)); g.strokePath();
  } else if (mood === 'tense') {
    g.lineBetween(CX - 16, CY + 30, CX + 16, CY + 30);
  } else {
    g.fillStyle(PALETTE.plum, 0.9);
    g.fillEllipse(CX, CY + 28, 16, 12);
  }
}

export function ensurePortrait(scene: Phaser.Scene, id: BandmateId, mood: string): string {
  const key = `portrait_${id}_${mood}`;
  withGraphics(scene, PORTRAIT_SIZE, PORTRAIT_SIZE, (g) => {
    drawTorso(g, id);
    drawHairBack(g, id);
    g.fillStyle(SKIN[id], 1);
    g.fillEllipse(CX, CY, HEAD_R * 1.9, HEAD_R * 2.05);
    drawHairFront(g, id);
    drawFace(g, mood);
    drawAccessory(g, id);
  }, key);
  return key;
}

/** Lane + note faces, sized to the lane width the caller is laying out with (keys include the
 *  width, so two scenes with different lane widths don't collide in the texture cache). Notes
 *  fill most of the lane — bigger targets read better on a phone. */
export function ensureLaneTextures(scene: Phaser.Scene, laneW = 140): { lane: string; noteTap: string; noteChoice: string } {
  const laneKey = `rhythm_lane_${laneW}`;
  withGraphics(scene, laneW, H, (g) => {
    g.fillStyle(PALETTE.teal, 0.18);
    g.fillRect(0, 0, laneW, H);
    g.lineStyle(2, PALETTE.teal, 0.5);
    g.strokeRect(0, 0, laneW, H);
  }, laneKey);

  const noteW = laneW - 30;
  const noteTap = `note_tap_${noteW}`;
  withGraphics(scene, noteW + 6, 46, (g) => {
    // plum drop shadow, offset behind the note face
    g.fillStyle(PALETTE.plum, 0.35);
    g.fillRoundedRect(6, 9, noteW, 40, 12);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, noteW, 40, 12);
    g.lineStyle(3, PALETTE.gold, 1);
    g.strokeRoundedRect(0, 0, noteW, 40, 12);
  }, noteTap);

  const noteChoice = `note_choice_${noteW}`;
  withGraphics(scene, noteW + 6, 66, (g) => {
    g.fillStyle(PALETTE.plum, 0.35);
    g.fillRoundedRect(6, 9, noteW, 60, 16);
    g.fillStyle(PALETTE.terracotta, 1);
    g.fillRoundedRect(0, 0, noteW, 60, 16);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeRoundedRect(0, 0, noteW, 60, 16);
  }, noteChoice);

  return { lane: laneKey, noteTap, noteChoice };
}

/** A hold-note "rail": a vertical bar fading from a solid gold head to a translucent tail,
 *  bucketed to the nearest 10px so a whole song doesn't generate one texture per note. */
export function ensureHoldRail(scene: Phaser.Scene, heightPx: number, w = 70): string {
  const h = Math.max(20, Math.round(heightPx / 10) * 10);
  const key = `note_hold_rail_${w}_${h}`;
  withGraphics(scene, w, h, (g) => {
    const steps = Math.max(4, Math.round(h / 12));
    for (let i = 0; i < steps; i++) {
      const t = i / steps; // 0 at head (bottom), 1 at tail (top)
      const bandH = h / steps;
      g.fillStyle(PALETTE.gold, 0.85 - t * 0.55);
      g.fillRect(0, h - (i + 1) * bandH, w, bandH + 1);
    }
    g.lineStyle(3, PALETTE.gold, 0.9);
    g.strokeRoundedRect(0, h - 26, w, 26, 10); // head cap, solid
  }, key);
  return key;
}

/** Glowing hit line: a bright core with soft wider bands above/below faking a blur, since
 *  Graphics has no blur filter. */
export function ensureHitLineGlow(scene: Phaser.Scene, width: number): string {
  const key = `hit_line_glow_${width}`;
  const h = 28;
  withGraphics(scene, width, h, (g) => {
    g.fillStyle(PALETTE.gold, 0.12);
    g.fillRect(0, 0, width, h);
    g.fillStyle(PALETTE.gold, 0.3);
    g.fillRect(0, h / 2 - 6, width, 12);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(0, h / 2 - 2, width, 4);
  }, key);
  return key;
}

const CUE_ICON_SIZE = 44;

/** Small glyph per choice-cue type, drawn on a transparent square — used inside the styled
 *  cue callout instead of a raw text banner. */
export function ensureCueIcon(scene: Phaser.Scene, type: string): string {
  const key = `cue_icon_${type}`;
  const s = CUE_ICON_SIZE;
  const c = s / 2;
  withGraphics(scene, s, s, (g) => {
    g.lineStyle(4, 0xffffff, 1);
    g.fillStyle(0xffffff, 1);
    if (type === 'pull_back') {
      g.fillTriangle(c - 12, c - 4, c + 12, c - 4, c, c + 14);
    } else if (type === 'build') {
      g.fillTriangle(c - 12, c + 4, c + 12, c + 4, c, c - 14);
    } else if (type === 'invite_crowd') {
      g.fillCircle(c - 10, c, 8);
      g.fillCircle(c + 10, c, 8);
    } else if (type === 'improvise') {
      g.beginPath();
      g.arc(c, c, 13, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(320));
      g.strokePath();
      g.fillCircle(c + 11, c - 6, 3);
    } else {
      // spotlight_bandmate: a star
      const points: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 14 : 6;
        const a = Phaser.Math.DegToRad(i * 36 - 90);
        points.push({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r });
      }
      g.fillPoints(points, true);
    }
  }, key);
  return key;
}

/** Crowd-meter figure — a simple silhouette in two poses (idle vs arms-raised), used instead
 *  of a plain progress bar so the meter reads as "a crowd," not a health bar. */
export function ensureCrowdFigure(scene: Phaser.Scene, raised: boolean): string {
  const key = `crowd_figure_${raised ? 'up' : 'down'}`;
  const w = 30, h = 40;
  withGraphics(scene, w, h, (g) => {
    const color = raised ? PALETTE.gold : PALETTE.sky;
    const alpha = raised ? 1 : 0.5;
    g.fillStyle(color, alpha);
    g.fillCircle(w / 2, 8, 7);
    g.fillRoundedRect(w / 2 - 7, 16, 14, 18, 6);
    g.lineStyle(4, color, alpha);
    if (raised) {
      g.lineBetween(w / 2 - 6, 20, w / 2 - 14, 4);
      g.lineBetween(w / 2 + 6, 20, w / 2 + 14, 4);
    } else {
      g.lineBetween(w / 2 - 6, 22, w / 2 - 10, 32);
      g.lineBetween(w / 2 + 6, 22, w / 2 + 10, 32);
    }
  }, key);
  return key;
}

export function ensureScrapbookCard(scene: Phaser.Scene): string {
  const key = 'scrapbook_card';
  const w = W - 80, h = H - 260, r = UI_RADIUS.card;
  withGraphics(scene, w, h, (g) => {
    g.fillStyle(PALETTE.cream, 1);
    g.fillRoundedRect(0, 0, w, h, r);
    g.lineStyle(4, PALETTE.gold, 0.8);
    g.strokeRoundedRect(6, 6, w - 12, h - 12, r - 4);
    g.lineStyle(3, 0xffffff, 0.5);
    g.beginPath();
    g.moveTo(r, 3);
    g.lineTo(w - r, 3);
    g.strokePath();
  }, key);
  return key;
}

export function ensurePixelTexture(scene: Phaser.Scene, key: string, color: number): string {
  withGraphics(scene, 8, 8, (g) => {
    g.fillStyle(color, 1);
    g.fillRect(0, 0, 8, 8);
  }, key);
  return key;
}

/** Backdrop for a standalone non-city scene (opening, band creation, route plan, scrapbook, van).
 *
 *  Pre-public "no barren screens" pass: these five scenes drew a flat navy rectangle, which read as
 *  unfinished next to the painted cities — and they are exactly the screens a player lingers on
 *  (the intro and the epilogue most of all). Each now has a real painted asset under bg_scene_<id>.
 *
 *  Same seam as every other painted asset: if the real file registered, withGraphics early-returns
 *  and the painting wins; if it is missing, the code-drawn gradient below draws instead and nothing
 *  crashes. The tint keeps each fallback distinguishable rather than four identical navy fields. */
export function ensureSceneBackdrop(scene: Phaser.Scene, id: string, tint: number): string {
  const key = `bg_scene_${id}`;
  withGraphics(scene, W, H, (g) => {
    fillVerticalGradient(g, 0, 0, W, H, PALETTE.night, tint, 1, 20);
  }, key);
  return key;
}
