// All visuals are code-drawn: Phaser Graphics + generateTexture(). No image files.
import Phaser from 'phaser';
import { H, PALETTE, W } from '../const';
import { CITY_TINTS } from './palette';
import type { BandmateId } from '../../content/schema';

function withGraphics(scene: Phaser.Scene, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function ensureTitleBackground(scene: Phaser.Scene): string {
  const key = 'bg_title';
  withGraphics(scene, W, H, (g) => {
    g.fillGradientStyle(PALETTE.night, PALETTE.night, PALETTE.plum, PALETTE.plum, 1);
    g.fillRect(0, 0, W, H);
    // Skyline silhouette
    g.fillStyle(PALETTE.plum, 0.9);
    let x = 0;
    let seed = 7;
    while (x < W) {
      seed = (seed * 9301 + 49297) % 233280;
      const bw = 40 + (seed % 60);
      const bh = 120 + (seed % 260);
      g.fillRect(x, H - bh, bw, bh);
      x += bw + 6;
    }
    // Soft moon
    g.fillStyle(PALETTE.gold, 0.85);
    g.fillCircle(W - 120, 160, 46);
  }, key);
  return key;
}

export function ensureCityBackground(scene: Phaser.Scene, cityId: string, tint: 'warm_amber' | 'teal_pink'): string {
  const key = `bg_city_${cityId}`;
  withGraphics(scene, W, H, (g) => {
    const tintColor = CITY_TINTS[tint];
    g.fillGradientStyle(PALETTE.sky, PALETTE.sky, tintColor, tintColor, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(PALETTE.cream, 0.25);
    for (let i = 0; i < 6; i++) {
      const bw = 90 + i * 14;
      const bh = 200 + (i % 3) * 90;
      g.fillRect(i * 130 - 40, H - bh, bw, bh);
    }
    g.fillStyle(tintColor, 0.15);
    g.fillRect(0, H - 380, W, 380);
  }, key);
  return key;
}

export function ensureBusHubBackground(scene: Phaser.Scene): string {
  const key = 'bg_hub';
  withGraphics(scene, W, H, (g) => {
    g.fillStyle(PALETTE.plum, 1);
    g.fillRect(0, 0, W, H);
    // window
    g.fillStyle(PALETTE.night, 1);
    g.fillRoundedRect(80, 160, W - 160, 340, 24);
    g.fillStyle(PALETTE.sky, 0.35);
    g.fillRoundedRect(90, 170, W - 180, 320, 20);
    // seats
    g.fillStyle(PALETTE.terracotta, 0.9);
    g.fillRoundedRect(100, 620, W - 200, 160, 18);
  }, key);
  return key;
}

export function ensureDialoguePanel(scene: Phaser.Scene): string {
  const key = 'panel_dialogue';
  withGraphics(scene, W - 60, 300, (g) => {
    g.fillStyle(PALETTE.sand, 0.97);
    g.fillRoundedRect(0, 0, W - 60, 300, 22);
    g.lineStyle(2, PALETTE.plum, 0.15);
    g.strokeRoundedRect(0, 0, W - 60, 300, 22);
  }, key);
  return key;
}

const MOOD_COLORS: Record<string, number> = {
  worried: 0x8fb7c9,
  happy: 0xd9a441,
  tense: 0xc94f4f,
  inspired: 0x3e7c7b,
};

const BANDMATE_BASE: Record<BandmateId, number> = {
  mira: 0xc4704f,
  theo: 0x3e7c7b,
  jun: 0xd9a441,
  rowan: 0x8fb7c9,
};

export function ensurePortrait(scene: Phaser.Scene, id: BandmateId, mood: string): string {
  const key = `portrait_${id}_${mood}`;
  withGraphics(scene, 200, 200, (g) => {
    const base = BANDMATE_BASE[id];
    const accent = MOOD_COLORS[mood] ?? PALETTE.sand;
    g.fillStyle(base, 1);
    g.fillCircle(100, 110, 80);
    g.fillStyle(accent, 0.5);
    g.fillCircle(100, 110, 80);
    // eyes
    g.fillStyle(PALETTE.plum, 1);
    const eyeY = mood === 'tense' ? 96 : 100;
    g.fillCircle(75, eyeY, 7);
    g.fillCircle(125, eyeY, 7);
    // mouth by mood
    g.lineStyle(5, PALETTE.plum, 1);
    if (mood === 'happy') {
      g.beginPath(); g.arc(100, 130, 26, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160)); g.strokePath();
    } else if (mood === 'worried') {
      g.beginPath(); g.arc(100, 155, 22, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340)); g.strokePath();
    } else if (mood === 'tense') {
      g.lineBetween(80, 140, 120, 140);
    } else {
      g.beginPath(); g.arc(100, 128, 18, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170)); g.strokePath();
      g.fillStyle(accent, 0.9);
      g.fillCircle(100, 60, 10);
    }
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
  withGraphics(scene, W - 80, H - 260, (g) => {
    g.fillStyle(PALETTE.cream, 1);
    g.fillRoundedRect(0, 0, W - 80, H - 260, 18);
    g.lineStyle(4, PALETTE.gold, 0.8);
    g.strokeRoundedRect(6, 6, W - 92, H - 272, 14);
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
