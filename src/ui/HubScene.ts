import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { ensureBusHubBackground, ensureHubWindowPane } from '../art/sprites';
import { applyVignette, spawnFireflies, type WeatherHandle } from '../art/effects';
import { addCoverBackground } from '../art/background';
import { hasRealAsset } from '../core/assets';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { getCity } from '../game/content';
import { saveRun } from '../core/save';
import { audio } from '../core/audio';
import { DEFAULT_AMBIENCE_BPM, DEFAULT_AMBIENCE_CHORDS } from '../core/musicTheory';
import { generateEnding } from '../game/endings';
import { completeRun } from '../game/meta';
import type { StatKey } from '../../content/schema';
import { textStyle } from './textStyles';
import { DialogueBox } from './DialogueBox';
import { addHelpButton } from './HelpButton';
import { COMPLICATION_LABELS } from './RoutePlanScene';

const ONBOARD_FLAG = 'onboard_hub_seen';
const COMPLICATION_APPLIED_FLAG = 'mid_tour_complication_applied';
// Route.ts draws one of these for flavor at RoutePlan (see COMPLICATION_LABELS there) but
// nothing ever read it back — purely cosmetic. This gives it the one small mechanical
// consequence the close-out plan asked for, applied once, at the route's midpoint Hub visit.
const COMPLICATION_EFFECTS: Record<string, Partial<Record<StatKey, number>>> = {
  van_breakdown: { energy: -5, funds: -20 },
  lost_gear: { funds: -15, inspiration: -3 },
  booking_conflict: { harmony: -3, funds: 10 },
  bandmate_gets_sick: { energy: -8 },
  venue_falls_through: { harmony: -2, funds: -10 },
  unexpected_press: { inspiration: 5, funds: 15 },
};
const STAT_LABELS: Record<StatKey, string> = { energy: 'Energy', harmony: 'Harmony', inspiration: 'Inspiration', funds: 'Funds' };
const STAT_COLORS: Record<StatKey, number> = { energy: PALETTE.gold, harmony: PALETTE.teal, inspiration: PALETTE.terracotta, funds: PALETTE.sky };
const CORKBOARD_X = W - 190;
const CORKBOARD_Y = 860;

export class HubScene extends Phaser.Scene {
  constructor() { super('Hub'); }

  private fireflies: WeatherHandle | null = null;

  create(): void {
    fadeIn(this);
    audio.playAmbience(DEFAULT_AMBIENCE_CHORDS, DEFAULT_AMBIENCE_BPM);
    const bgKey = ensureBusHubBackground(this);
    const bg = addCoverBackground(this, bgKey);
    applyVignette(bg);
    this.fireflies = spawnFireflies(this, PALETTE.gold, 10);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fireflies?.stop());

    if (!State.hasFlag(ONBOARD_FLAG)) {
      const box = new DialogueBox(this);
      box.show(
        { id: 'onboard_hub', speaker: 'sol', text: "This bus is home between shows. Check in on the band, then hit the road when you're ready." },
        () => { State.addFlag(ONBOARD_FLAG); box.destroy(); this.renderHubContent(bgKey); },
        () => {},
      );
      return;
    }
    this.renderHubContent(bgKey);
  }

  private renderHubContent(bgKey: string): void {
    addHelpButton(this, 'This is home base between cities. Check your stats, see what you\'ve collected, then travel to the next show.');
    const complicationNote = this.applyMidTourComplicationIfDue();
    const stop = State.data.route[State.data.currentCityIndex];
    // The tinted window pane exists to show the next city's color through the bus window — but
    // it's positioned against the code-drawn background's window frame. Painted bus art has its
    // windows wherever the generator put them (and conveys "night outside" on its own), so the
    // pane is skipped there rather than being pasted over unrelated pixels.
    if (!hasRealAsset(bgKey)) {
      const windowTint = stop ? getCity(stop.cityId).tint : 'midnight_indigo';
      this.add.image(90, 170, ensureHubWindowPane(this, windowTint)).setOrigin(0, 0);
    }

    this.add.text(W / 2, 60, State.data.band.name, textStyle('h1')).setOrigin(0.5);
    if (complicationNote) {
      this.add.text(W / 2, 92, complicationNote, textStyle('small', {
        fontSize: '13px', color: PALETTE_HEX.terracotta, wordWrap: { width: W - 140 }, align: 'center',
      })).setOrigin(0.5);
    }

    this.renderStats();
    this.renderCorkboard(hasRealAsset(bgKey));

    if (stop) {
      const city = getCity(stop.cityId);
      this.add.text(W / 2, 780, `Next stop: ${city.name}`, textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      createButton(this, W / 2 - 160, 820, 320, 66, `Travel to ${city.name}`, () => {
        State.setProgress({ screen: 'city', cityId: city.id });
        saveRun(State.data);
        goTo(this, 'City', { cityId: city.id });
      }, { fillColor: 0x3e7c7b });
      // Left-anchored (not centered) and clipped short of the corkboard's x-range (CORKBOARD_X
      // starts at W-190) so this can't visually collide with the souvenir chips beside it.
      this.add.text(40, 892, `Tonight: soundcheck, then whatever ${city.collaborator.npcName} has waiting.`,
        textStyle('small', { fontSize: '14px', wordWrap: { width: 460 } }));
    } else {
      this.add.text(W / 2, 780, 'The last show is behind you.', textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      createButton(this, W / 2 - 160, 820, 320, 66, 'Wrap the tour', () => this.wrapTour(), { fillColor: 0xd9a441 });
    }

    if (State.data.meta.unlockedDecor.length > 0) {
      this.add.text(W / 2, 920, `Décor: ${State.data.meta.unlockedDecor.map((d) => d.replace(/_/g, ' ')).join(', ')}`,
        textStyle('small', { wordWrap: { width: W - 100 }, align: 'center' })).setOrigin(0.5);
    }

    createButton(this, W / 2 - 100, 1140, 200, 66, 'Settings', () => {
      this.scene.launch('Settings', { returnTo: 'Hub' });
      this.scene.pause();
    }, { fillColor: 0x8fb7c9, fontSize: '18px' });

    this.events.on(Phaser.Scenes.Events.RESUME, () => fadeIn(this));
  }

  private renderStats(): void {
    const keys = Object.keys(STAT_LABELS) as StatKey[];
    keys.forEach((key, i) => {
      const y = 130 + i * 44;
      const value = State.data.stats[key];
      const displayMax = key === 'funds' ? Math.max(500, value) : 100;
      const barW = 280;
      const targetW = Math.max(4, barW * Math.min(1, value / displayMax));

      this.add.text(60, y, STAT_LABELS[key], textStyle('stat', { fontSize: '16px' }));
      this.add.rectangle(220, y + 8, barW, 16, 0x000000, 0.25).setOrigin(0, 0);
      const fill = this.add.rectangle(220, y + 8, 0, 16, STAT_COLORS[key], 1).setOrigin(0, 0);
      this.tweens.add({
        targets: fill, width: targetW, duration: 550, delay: i * 90, ease: 'Cubic.easeOut',
      });
      this.add.text(220 + barW + 12, y, key === 'funds' ? `$${value}` : `${Math.round(value)}`, textStyle('stat'));
    });
  }

  /** Small pinned chips inside the corkboard frame drawn in ensureBusHubBackground — ties the
   *  hub's decoration to actual run state rather than being purely decorative. */
  private renderCorkboard(paintedBackground: boolean): void {
    // The code-drawn background bakes a corkboard frame behind these chips; painted art
    // doesn't, so draw a standalone board there instead or the chips float on nothing.
    if (paintedBackground) {
      const board = this.add.rectangle(CORKBOARD_X, CORKBOARD_Y, 150, 190, 0x8a6a4a, 0.92).setOrigin(0, 0);
      board.setStrokeStyle(6, 0x6b4a2f, 1);
    }
    // cream measures 4.2:1 on this corkboard's brown tint — just under the 4.5:1 floor this
    // 13px label needs (too small to qualify for the looser large-text bar). White clears it.
    this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 14, 'Souvenirs', textStyle('stat', { fontSize: '13px', color: '#FFFFFF' })).setOrigin(0.5);
    const items = State.data.inventory.slice(0, 4);
    if (items.length === 0) {
      this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 60, 'Nothing yet', textStyle('small', { fontSize: '12px', color: '#FFFFFF' })).setOrigin(0.5);
      return;
    }
    items.forEach((item, i) => {
      const y = CORKBOARD_Y + 40 + i * 34;
      const angle = (i % 2 === 0 ? -1 : 1) * 3;
      const chip = this.add.rectangle(CORKBOARD_X + 75, y, 128, 26, PALETTE.cream, 0.95).setAngle(angle);
      chip.setStrokeStyle(1, PALETTE.plum, 0.3);
      this.add.text(CORKBOARD_X + 75, y, item.name.length > 20 ? `${item.name.slice(0, 18)}…` : item.name,
        textStyle('small', { fontSize: '11px', color: PALETTE_HEX.plum })).setOrigin(0.5).setAngle(angle);
      // pin
      this.add.circle(CORKBOARD_X + 20, y - 10, 3, PALETTE.terracotta, 1);
    });
    if (State.data.inventory.length > 4) {
      // Default small's sky measures 2.3:1 on this corkboard's brown tint — same fix as the
      // "Souvenirs" header above.
      this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 40 + 4 * 34, `+${State.data.inventory.length - 4} more`,
        textStyle('small', { fontSize: '11px', color: '#FFFFFF' })).setOrigin(0.5);
    }
  }

  /** Fires once, the first Hub visit at or past the route's midpoint — gives the mid-tour
   *  complication (drawn at RoutePlan, previously flavor-only) its one real mechanical
   *  consequence. Returns the line to display, or null if it already fired or there's nothing
   *  to apply (e.g. a 1-city route has no meaningful midpoint). */
  private applyMidTourComplicationIfDue(): string | null {
    const midpoint = Math.floor(State.data.route.length / 2);
    if (State.data.route.length < 2 || State.data.currentCityIndex < midpoint) return null;
    if (State.hasFlag(COMPLICATION_APPLIED_FLAG)) return null;
    State.addFlag(COMPLICATION_APPLIED_FLAG);
    const effects = COMPLICATION_EFFECTS[State.data.midTourComplication];
    if (!effects) return null;
    State.applyStatDeltas(effects);
    saveRun(State.data);
    return COMPLICATION_LABELS[State.data.midTourComplication] ?? null;
  }

  private wrapTour(): void {
    const ending = generateEnding(State.data);
    State.data.meta = completeRun(State.data.meta, {
      seed: State.data.seed, bandName: State.data.band.name, endingId: ending.id, tags: ending.tags, completedAt: Date.now(),
    });
    State.setProgress({ screen: 'scrapbook' });
    saveRun(State.data);
    goTo(this, 'Scrapbook', { endingId: ending.id, tags: ending.tags });
  }
}
