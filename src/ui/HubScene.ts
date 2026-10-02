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
import { addTextScrim, textStyle } from './textStyles';
import { DialogueBox } from './DialogueBox';
import { addHelpButton } from './HelpButton';
import { COMPLICATION_LABELS } from './RoutePlanScene';
import { routeArcRole } from '../game/route';
import { wildcardFor, goalFor, describeDeltas } from '../game/wildcard';

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
    // QA round 2 #4: the Hub's supporting lines were 13-14px terracotta/gold straight on the
    // painted bus, unreadable on a phone. Each now sits on a scrim, at 16px, in cream.
    if (complicationNote) {
      addTextScrim(this, W / 2, 98, W - 100, 44, 0.8);
      this.add.text(W / 2, 98, complicationNote, textStyle('small', {
        fontSize: '16px', color: PALETTE_HEX.cream, wordWrap: { width: W - 140 }, align: 'center',
      })).setOrigin(0.5);
    }

    this.renderStats();
    this.renderLedgerCard();
    this.renderTourCard();
    this.renderCorkboard(hasRealAsset(bgKey));

    if (stop) {
      const city = getCity(stop.cityId);
      addTextScrim(this, W / 2, 786, W - 120, 70, 0.8);
      this.add.text(W / 2, 768, `Next stop: ${city.name}`, textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      // Item D: mirrors RoutePlanScene's opener/midpoint/finale framing for this same route, so
      // the city about to be traveled to reads as a specific point in this run's arc, not just
      // the next item in a list.
      const objective = this.objectiveLineFor(State.data.currentCityIndex);
      if (objective) {
        this.add.text(W / 2, 800, objective, textStyle('small', {
          fontSize: '16px', color: PALETTE_HEX.cream, wordWrap: { width: W - 140 }, align: 'center',
        })).setOrigin(0.5);
      }
      createButton(this, W / 2 - 160, 828, 320, 66, `Travel to ${city.name}`, () => {
        // The wildcard's per-city effect lands once per stop, as the van leaves.
        const stopFlag = `wildcard_stop_${State.data.currentCityIndex}`;
        if (!State.hasFlag(stopFlag)) { State.applyStatDeltas(wildcardFor(State.data.seed).perStop); State.addFlag(stopFlag); }
        State.setProgress({ screen: 'city', cityId: city.id });
        saveRun(State.data);
        // Addendum v2, Item 9b: hub -> city travel uses 'drive'.
        // Via the van: a two-beat travel scene on the way in (VanScene), which sets no progress
        // and gates nothing, so an interruption there still resumes at the Hub.
        goTo(this, 'Van', { cityId: city.id }, { theme: 'drive', label: `On the road to ${city.name}` });
      }, { fillColor: 0x3e7c7b });
      // Left-anchored (not centered) and clipped short of the corkboard's x-range (CORKBOARD_X
      // starts at W-190) so this can't visually collide with the souvenir chips beside it.
      addTextScrim(this, 40 + 240, 932, 480, 48, 0.8);
      this.add.text(52, 932, `Tonight: soundcheck, then whatever ${city.collaborator.npcName} has waiting.`,
        textStyle('small', { fontSize: '16px', color: PALETTE_HEX.cream, wordWrap: { width: 456 } })).setOrigin(0, 0.5);
    } else {
      this.add.text(W / 2, 780, 'The last show is behind you.', textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      createButton(this, W / 2 - 160, 820, 320, 66, 'Wrap the tour', () => this.wrapTour(), { fillColor: 0xd9a441 });
    }

    if (State.data.meta.unlockedDecor.length > 0) {
      this.add.text(W / 2, 966, `Décor: ${State.data.meta.unlockedDecor.map((d) => d.replace(/_/g, ' ')).join(', ')}`,
        textStyle('small', { wordWrap: { width: W - 100 }, align: 'center' })).setOrigin(0.5);
    }

    // QA #9 (decision D6): replay any minigame from this run's route without rewards or flags.
    createButton(this, W / 2 - 160, 990, 320, 56, 'Practice a minigame', () => this.showPractice(), { fillColor: 0x8a6fa3, fontSize: '17px' });

    createButton(this, W / 2 - 220, 1140, 200, 66, 'Settings', () => {
      this.scene.launch('Settings', { returnTo: 'Hub' });
      this.scene.pause();
    }, { fillColor: 0x8fb7c9, fontSize: '18px' });
    // QA round 2 #7: a plain way back to the home screen. The run is saved first, so Continue there
    // returns to this bus.
    createButton(this, W / 2 + 20, 1140, 200, 66, 'Home', () => {
      saveRun(State.data);
      audio.stopMusic();
      goTo(this, 'Title');
    }, { fillColor: 0x8a6fa3, fontSize: '18px' });

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

  /** THIS TOUR: the run's wildcard and tour goal (src/game/wildcard.ts), with the goal ticked off
   *  live. Sits under the ledger card (or in its place before any ledger game has been played). */
  private renderTourCard(): void {
    const wc = wildcardFor(State.data.seed), goal = goalFor(State.data.seed);
    const ledgerRows = Math.min(3, (State.data.ledger ?? []).length);
    const x = 60, w = W - 120;
    const y = ledgerRows > 0 ? 318 + 34 + ledgerRows * 24 + 14 : 318;
    const done = goal.check(State.data);
    addTextScrim(this, x + w / 2, y + 66, w, 132, 0.8);
    this.add.text(x + 14, y + 10, 'This tour', textStyle('stat', { fontSize: '15px', color: PALETTE_HEX.gold }));
    this.add.text(x + 14, y + 32, `${wc.name}: ${wc.text}`, textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream, wordWrap: { width: w - 28 } }));
    const per = describeDeltas(wc.perStop);
    if (per) this.add.text(x + w - 14, y + 10, `each city: ${per}`, textStyle('small', { fontSize: '13px', color: PALETTE_HEX.cream })).setOrigin(1, 0);
    this.add.text(x + 14, y + 94, `${done ? 'Goal met' : 'Tour goal'}: ${goal.text}${done ? '  ✓' : ''}`, textStyle('small', {
      fontSize: '15px', color: done ? PALETTE_HEX.gold : PALETTE_HEX.cream, wordWrap: { width: w - 28 },
    }));
  }

  /** The Van Ledger card: the run's last money decisions, so `funds` reads as a story rather
   *  than a bar. Only appears once a ledger minigame has been played. */
  private renderLedgerCard(): void {
    const entries = (State.data.ledger ?? []).slice(-3).reverse();
    if (entries.length === 0) return;
    const x = 60, y = 318, w = 420;
    const h = 34 + entries.length * 24;
    this.add.rectangle(x, y, w, h, PALETTE.night, 0.62).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold, 0.5);
    this.add.text(x + 12, y + 8, 'Van ledger', textStyle('stat', { fontSize: '15px', color: PALETTE_HEX.gold }));
    entries.forEach((e, i) => {
      const sign = e.funds > 0 ? '+' : e.funds < 0 ? '-' : '±';
      this.add.text(x + 12, y + 32 + i * 24, `${getCity(e.cityId).name}: ${e.label}`, textStyle('small', { fontSize: '15px', color: PALETTE_HEX.cream }));
      this.add.text(x + w - 12, y + 32 + i * 24, `${sign}${Math.abs(e.funds)} funds`, textStyle('small', { fontSize: '15px', color: e.funds >= 0 ? PALETTE_HEX.gold : PALETTE_HEX.cream })).setOrigin(1, 0);
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
      this.add.text(CORKBOARD_X + 75, CORKBOARD_Y + 60, 'Nothing yet', textStyle('small', { fontSize: '14px', color: '#FFFFFF' })).setOrigin(0.5);
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
        textStyle('small', { fontSize: '14px', color: '#FFFFFF', fontStyle: '700' })).setOrigin(0.5);
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

  /** Practice picker: every minigame on this run's route, one city at a time. Practice runs write
   *  no reward, no relationship change, and no played-flag (MiniGameScene `practice`).
   *
   *  Grouped by city with a tab row because the flat list it replaced was capped at nine rows, and
   *  the route carries around thirty minigames — so everything past the first city's was
   *  unreachable from here. */
  private showPractice(cityIndex = 0): void {
    this.children.getByName('practicePanel')?.destroy();
    const cityIds: string[] = [];
    for (const stop of State.data.route) if (!cityIds.includes(stop.cityId)) cityIds.push(stop.cityId);
    if (cityIds.length === 0) return;
    const current = cityIds[Math.max(0, Math.min(cityIndex, cityIds.length - 1))];
    const rows = (getCity(current).minigames ?? []);
    const w = 640, rowH = 64;
    const h = 250 + rows.length * rowH;
    const x = W / 2 - w / 2, y = Math.max(60, (this.cameras.main.height - h) / 2);
    const panel = this.add.container(0, 0).setName('practicePanel').setDepth(200);
    const backdrop = this.add.rectangle(0, 0, W, this.cameras.main.height, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
    backdrop.on('pointerdown', () => panel.destroy());
    const card = this.add.rectangle(x, y, w, h, PALETTE.sand, 0.98).setOrigin(0, 0).setInteractive();
    card.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation: () => void }) => event.stopPropagation());
    panel.add([backdrop, card]);
    panel.add(this.add.text(x + w / 2, y + 34, 'Practice', textStyle('h2', { color: PALETTE_HEX.plum })).setOrigin(0.5));
    panel.add(this.add.text(x + w / 2, y + 62, 'No rewards, no story changes — just the game.', textStyle('small', { fontSize: '13px', color: PALETTE_HEX.plum })).setOrigin(0.5));
    const tabW = (w - 40) / cityIds.length;
    cityIds.forEach((id, i) => {
      const on = id === current;
      panel.add(createButton(this, x + 20 + i * tabW, y + 84, tabW - 8, 54, getCity(id).name, () => this.showPractice(i),
        { fillColor: on ? 0xd9a441 : 0x8fb7c9, fontSize: '15px' }));
    });
    rows.forEach((mg, i) => {
      const tag = mg.hostBandmate ? ` · ${mg.hostBandmate[0].toUpperCase()}${mg.hostBandmate.slice(1)}` : '';
      panel.add(createButton(this, x + 30, y + 156 + i * rowH, w - 60, 54, `${mg.title}${tag}`, () => {
        panel.destroy();
        goTo(this, 'MiniGame', { cityId: current, minigameId: mg.id, returnPhase: 'locations', practice: true });
      }, { fillColor: mg.hostBandmate ? 0x8a6fa3 : 0x3e7c7b, fontSize: '16px' }));
    });
    panel.add(createButton(this, x + w / 2 - 110, y + h - 72, 220, 56, 'Close', () => panel.destroy(), { fillColor: 0x8fb7c9 }));
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
