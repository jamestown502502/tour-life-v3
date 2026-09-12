import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { ensureBusHubBackground, ensureHubWindowPane } from '../art/sprites';
import { applyVignette, spawnFireflies, type WeatherHandle } from '../art/effects';
import { addCoverBackground } from '../art/background';
import { hasRealAsset } from '../core/assets';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { bedForCity } from '../game/ambience';
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
import { routeArcRole } from '../game/route';

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
    // The bus bed is the NEXT city's song, slowed right down — the sound of heading somewhere
    // specific rather than one fixed loop played between every pair of cities.
    const nextStop = State.data.route[State.data.currentCityIndex];
    if (nextStop) {
      const bed = bedForCity(nextStop.cityId, State.data.seed, (State.data.cityMemories ?? []).filter((m) => m.firstShowRecorded).map((m) => m.cityId), 0.34);
      audio.playAmbience(bed.chords, bed.bpm, bed.waveform);
    } else {
      audio.playAmbience(DEFAULT_AMBIENCE_CHORDS, DEFAULT_AMBIENCE_BPM);
    }
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
    this.renderLedgerCard();
    this.renderCorkboard(hasRealAsset(bgKey));

    if (stop) {
      const city = getCity(stop.cityId);
      this.add.text(W / 2, 766, `Next stop: ${city.name}`, textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      // Item D: mirrors RoutePlanScene's opener/midpoint/finale framing for this same route, so
      // the city about to be traveled to reads as a specific point in this run's arc, not just
      // the next item in a list.
      const objective = this.objectiveLineFor(State.data.currentCityIndex);
      if (objective) {
        this.add.text(W / 2, 794, objective, textStyle('small', {
          fontSize: '13px', color: PALETTE_HEX.gold, wordWrap: { width: W - 140 }, align: 'center',
        })).setOrigin(0.5);
      }
      createButton(this, W / 2 - 160, 820, 320, 66, `Travel to ${city.name}`, () => {
        State.setProgress({ screen: 'city', cityId: city.id });
        saveRun(State.data);
        // Addendum v2, Item 9b: hub -> city travel uses 'drive'.
        // Via the van: a two-beat travel scene on the way in (VanScene), which sets no progress
        // and gates nothing, so an interruption there still resumes at the Hub.
        goTo(this, 'Van', { cityId: city.id }, { theme: 'drive', label: `On the road to ${city.name}` });
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

    // QA #9 (decision D6): replay any minigame from this run's route without rewards or flags.
    createButton(this, W / 2 - 160, 990, 320, 56, 'Practice a minigame', () => this.showPractice(), { fillColor: 0x8a6fa3, fontSize: '17px' });

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

  /** The Van Ledger card: the run's last money decisions, so `funds` reads as a story rather
   *  than a bar. Only appears once a ledger minigame has been played. */
  private renderLedgerCard(): void {
    const entries = (State.data.ledger ?? []).slice(-3).reverse();
    if (entries.length === 0) return;
    const x = 60, y = 318, w = 400;
    const h = 30 + entries.length * 22;
    this.add.rectangle(x, y, w, h, PALETTE.night, 0.62).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold, 0.5);
    this.add.text(x + 12, y + 8, 'Van ledger', textStyle('stat', { fontSize: '13px', color: PALETTE_HEX.gold }));
    entries.forEach((e, i) => {
      const sign = e.funds > 0 ? '+' : e.funds < 0 ? '-' : '±';
      this.add.text(x + 12, y + 30 + i * 22, `${getCity(e.cityId).name}: ${e.label}`, textStyle('small', { fontSize: '13px', color: PALETTE_HEX.cream }));
      this.add.text(x + w - 12, y + 30 + i * 22, `${sign}${Math.abs(e.funds)} funds`, textStyle('small', { fontSize: '13px', color: e.funds >= 0 ? PALETTE_HEX.gold : PALETTE_HEX.softRed })).setOrigin(1, 0);
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
      // QA #7: this used to be plain text. It opens the full list now.
      const more = this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 40 + 4 * 34, `+${State.data.inventory.length - 4} more`,
        textStyle('small', { fontSize: '12px', color: '#FFFFFF', fontStyle: '700' })).setOrigin(0.5);
      more.setInteractive(new Phaser.Geom.Rectangle(-30, -14, more.width + 60, more.height + 28), Phaser.Geom.Rectangle.Contains);
      more.input!.cursor = 'pointer';
      more.on('pointerdown', () => this.showSouvenirs());
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

  /** Item D: the same opener/midpoint/finale framing RoutePlanScene draws for the whole route,
   *  for just the one stop about to be traveled to — routeArcRole (src/game/route.ts) is the
   *  single source for which index plays which role, so this and RoutePlanScene can't drift. */
  private objectiveLineFor(index: number): string | null {
    const role = routeArcRole(index, State.data.route.length);
    if (role === 'opener') return 'The opener — get your legs under you.';
    if (role === 'finale') return 'The one that matters.';
    if (role === 'midpoint') return 'This is the one where things get complicated.';
    return null;
  }

  /** Full souvenir list — the corkboard only has room for four. */
  private showSouvenirs(): void {
    if (this.children.getByName('souvenirPanel')) return;
    const w = 560, h = 620;
    const x = W / 2 - w / 2, y = 300;
    const panel = this.add.container(0, 0).setName('souvenirPanel').setDepth(200);
    const backdrop = this.add.rectangle(0, 0, W, this.cameras.main.height, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
    backdrop.on('pointerdown', () => panel.destroy());
    const card = this.add.rectangle(x, y, w, h, PALETTE.sand, 0.98).setOrigin(0, 0).setInteractive();
    card.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => event.stopPropagation());
    const title = this.add.text(x + w / 2, y + 36, 'Souvenirs', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5);
    const list = State.data.inventory.map((it) => `• ${it.name}`).join('\n');
    const body = this.add.text(x + 30, y + 70, list, textStyle('body', { fontSize: '17px', color: PALETTE_HEX.plum, wordWrap: { width: w - 60 }, lineSpacing: 6 }));
    panel.add([backdrop, card, title, body]);
    if (body.height > h - 170) {
      const mask = this.make.graphics({}).fillRect(x, y + 60, w, h - 150);
      body.setMask(mask.createGeometryMask());
      const minY = y + 70 - (body.height - (h - 160));
      card.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => { body.y = Phaser.Math.Clamp(body.y - dy * 0.5, minY, y + 70); });
      let dragY: number | null = null;
      card.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; });
      card.on('pointermove', (p: Phaser.Input.Pointer) => { if (dragY !== null && p.isDown) { body.y = Phaser.Math.Clamp(body.y + (p.y - dragY), minY, y + 70); dragY = p.y; } });
      card.on('pointerup', () => { dragY = null; });
      panel.add(this.add.text(x + w / 2, y + h - 100, 'scroll for more', textStyle('small', { fontSize: '12px', color: PALETTE_HEX.plum })).setOrigin(0.5));
    }
    panel.add(createButton(this, x + w / 2 - 110, y + h - 80, 220, 60, 'Close', () => panel.destroy(), { fillColor: 0x8fb7c9 }));
  }

  /** Practice picker: every minigame authored on the cities of this run's route. Practice runs
   *  write no reward, no relationship change, and no played-flag (MiniGameScene `practice`). */
  private showPractice(): void {
    if (this.children.getByName('practicePanel')) return;
    const entries: { cityId: string; id: string; title: string }[] = [];
    const seen = new Set<string>();
    for (const stop of State.data.route) {
      if (seen.has(stop.cityId)) continue;
      seen.add(stop.cityId);
      for (const mg of getCity(stop.cityId).minigames ?? []) entries.push({ cityId: stop.cityId, id: mg.id, title: mg.title });
    }
    const rows = entries.slice(0, 9);
    const w = 600, h = Math.min(1060, 170 + rows.length * 70);
    const x = W / 2 - w / 2, y = Math.max(100, (this.cameras.main.height - h) / 2);
    const panel = this.add.container(0, 0).setName('practicePanel').setDepth(200);
    const backdrop = this.add.rectangle(0, 0, W, this.cameras.main.height, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
    backdrop.on('pointerdown', () => panel.destroy());
    const card = this.add.rectangle(x, y, w, h, PALETTE.sand, 0.98).setOrigin(0, 0).setInteractive();
    card.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => event.stopPropagation());
    panel.add([backdrop, card]);
    panel.add(this.add.text(x + w / 2, y + 36, 'Practice', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    panel.add(this.add.text(x + w / 2, y + 66, 'No rewards, no story changes — just the game.', textStyle('small', { fontSize: '13px', color: PALETTE_HEX.plum })).setOrigin(0.5));
    rows.forEach((e, i) => {
      const cityName = getCity(e.cityId).name;
      panel.add(createButton(this, x + 30, y + 92 + i * 70, w - 60, 56, `${e.title} — ${cityName}`, () => {
        panel.destroy();
        goTo(this, 'MiniGame', { cityId: e.cityId, minigameId: e.id, returnPhase: 'locations', practice: true });
      }, { fillColor: 0x3e7c7b, fontSize: '17px' }));
    });
    if (rows.length === 0) panel.add(this.add.text(x + w / 2, y + 120, 'Nothing to practice yet.', textStyle('body', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    panel.add(createButton(this, x + w / 2 - 110, y + h - 74, 220, 56, 'Close', () => panel.destroy(), { fillColor: 0x8fb7c9 }));
  }

  private wrapTour(): void {
    const ending = generateEnding(State.data);
    State.data.meta = completeRun(State.data.meta, {
      seed: State.data.seed, bandName: State.data.band.name, endingId: ending.id, tags: ending.tags, completedAt: Date.now(),
    });
    State.setProgress({ screen: 'scrapbook' });
    saveRun(State.data);
    goTo(this, 'Scrapbook', { endingId: ending.id, tags: ending.tags }, { theme: 'pages', label: 'The tour, in pictures' });
  }
}
