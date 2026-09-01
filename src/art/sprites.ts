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

export function ensureLaneTextures(scene: Phaser.Scene): { lane: string; noteTap: string; noteHold: string; noteChoice: string } {
  const laneKey = 'rhythm_lane';
  withGraphics(scene, 140, H, (g) => {
    g.fillStyle(PALETTE.teal, 0.18);
    g.fillRect(0, 0, 140, H);
    g.lineStyle(2, PALETTE.teal, 0.5);
    g.strokeRect(0, 0, 140, H);
  }, laneKey);

  const noteTap = 'note_tap';
  withGraphics(scene, 110, 40, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 110, 40, 12);
    g.lineStyle(3, PALETTE.gold, 1);
    g.strokeRoundedRect(0, 0, 110, 40, 12);
  }, noteTap);

  const noteHold = 'note_hold';
  withGraphics(scene, 110, 40, (g) => {
    g.fillStyle(PALETTE.gold, 0.9);
    g.fillRoundedRect(0, 0, 110, 40, 12);
  }, noteHold);

  const noteChoice = 'note_choice';
  withGraphics(scene, 110, 60, (g) => {
    g.fillStyle(PALETTE.terracotta, 1);
    g.fillRoundedRect(0, 0, 110, 60, 16);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeRoundedRect(0, 0, 110, 60, 16);
  }, noteChoice);

  return { lane: laneKey, noteTap, noteHold, noteChoice };
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
