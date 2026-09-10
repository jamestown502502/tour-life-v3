import Phaser from 'phaser';
import { ensureSceneBackdrop } from '../art/sprites';
import { addCoverBackground } from '../art/background';
import { applyVignette } from '../art/effects';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { createButton, setButtonSelected } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { BANDMATES, GENRES, WHY_TOUR_BEATS } from '../../content/bands';
import { saveRun } from '../core/save';
import { createFloatingInput, type FloatingInput } from './htmlOverlay';
import { addTextScrim, textStyle } from './textStyles';
import { addMenuButton } from './MenuButton';
import { DialogueBox } from './DialogueBox';
import { OPENING_GRAPH } from '../../content/opening';
import { ensurePortrait, ensurePortraitFrame } from '../art/sprites';

export class BandCreatorScene extends Phaser.Scene {
  constructor() { super('BandCreator'); }

  private genre = '';
  private whyTour = '';
  private nameInput!: FloatingInput;
  private meetBox: DialogueBox | null = null;

  create(): void {
    fadeIn(this);
    // Painted backdrop (pre-public "no barren screens" pass). Falls back to a code-drawn
    // gradient if the asset is missing — ensureSceneBackdrop keeps that seam.
    const bgKey = ensureSceneBackdrop(this, 'bandcreator', PALETTE.teal);
    applyVignette(addCoverBackground(this, bgKey));
    // Every loose label on this screen sits directly on the painted backdrop — lit wood, a bright
    // window, flyers. All of them were authored while a stale service-worker manifest meant the
    // code-drawn FLAT gradient was what actually rendered, where cream and teal read fine. Scrims
    // are what make them survive the real art. See addTextScrim for why insertion order matters.
    addTextScrim(this, W / 2, 70, 420, 66);
    this.add.text(W / 2, 70, 'Name your band', textStyle('h1')).setOrigin(0.5);
    // Pre-Hub setup screens (this one and RoutePlan) had no way out at all before this — only
    // forward. "Quit to Title" from here is the actual "back out of setup" path.
    addMenuButton(this, 'BandCreator');

    this.nameInput = createFloatingInput(W / 2, 130, 320, 'Band name');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.nameInput.destroy());

    // GRID_ROW_H/GRID_INCREMENT (not the original 50/60/46/56): at the 390px mobile viewport
    // the canvas renders at ~0.542x, so a button needs its raw canvas-unit height to clear
    // ~65px (accounting for Button.ts's own 8px-each-side pad) before it scales down to a real
    // >=44 CSS-px touch target. 50/46 landed under that. Verified live at 390x844, not just by
    // this arithmetic.
    const GRID_ROW_H = 70;
    const GRID_INCREMENT = 78;

    addTextScrim(this, W / 2, 200, 220, 52);
    this.add.text(W / 2, 200, 'Genre', textStyle('h2')).setOrigin(0.5);
    const genres = [...GENRES, ...State.data.meta.unlockedGenres.map((id) => ({ id, label: id.replace(/_/g, ' ') }))];
    const genreLabels: Phaser.GameObjects.Container[] = [];
    genres.forEach((g, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const btn = createButton(this, W / 2 - 300 + col * 310, 240 + row * GRID_INCREMENT, 290, GRID_ROW_H, g.label, () => {
        this.genre = g.id;
        genreLabels.forEach((b) => setButtonSelected(b, false));
        setButtonSelected(btn, true);
      });
      genreLabels.push(btn);
    });

    const whyY = 240 + Math.ceil(genres.length / 2) * GRID_INCREMENT + 40;
    addTextScrim(this, W / 2, whyY, 320, 52);
    this.add.text(W / 2, whyY, 'Why this tour?', textStyle('h2')).setOrigin(0.5);
    const whyLabels: Phaser.GameObjects.Container[] = [];
    WHY_TOUR_BEATS.forEach((beat, i) => {
      const btn = createButton(this, W / 2 - 300, whyY + 40 + i * GRID_INCREMENT, 600, GRID_ROW_H, beat, () => {
        this.whyTour = beat;
        whyLabels.forEach((b) => setButtonSelected(b, false));
        setButtonSelected(btn, true);
      }, { fontSize: '18px' });
      whyLabels.push(btn);
    });

    // Stuck-screen-hardening follow-up, Item C: the 16 painted portraits (ensurePortrait) existed
    // and loaded fine but were never shown anywhere in the opening flow — the cast was 4 lines of
    // plain text. Face-first now: each bandmate's portrait, tappable for a one-line voice intro
    // (the same OPENING_GRAPH line OpeningScene plays after "Hit the road" — hearing it here is
    // a preview/callback, not a duplicate system) so a player who wants to meet the band before
    // committing to a name/genre can, without gating anything on it.
    const membersY = whyY + 40 + WHY_TOUR_BEATS.length * GRID_INCREMENT + 30;
    addTextScrim(this, W / 2, membersY, 260, 52);
    this.add.text(W / 2, membersY, 'The band', textStyle('h2')).setOrigin(0.5);
    const castY = membersY + 100;
    // One strip behind the whole roster: four columns of name/instrument/want plus the tap hint.
    // Per-column scrims would leave the busiest part of the backdrop showing between them.
    addTextScrim(this, W / 2, castY + 112, W - 40, 142, 0.86);
    const castStep = W / (BANDMATES.length + 1);
    BANDMATES.forEach((b, i) => {
      const cx = castStep * (i + 1);
      const frameKey = ensurePortraitFrame(this);
      const portraitKey = ensurePortrait(this, b.id, 'happy');
      const frame = this.add.image(cx, castY, frameKey).setScale(0.55);
      const portrait = this.add.image(cx, castY + 4, portraitKey).setScale(0.32);
      const hitR = 50;
      const hitZone = this.add.zone(cx, castY, hitR * 2, hitR * 2).setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => this.meetBandmate(b.id));
      hitZone.on('pointerover', () => { frame.setScale(0.6); portrait.setScale(0.35); });
      hitZone.on('pointerout', () => { frame.setScale(0.55); portrait.setScale(0.32); });
      this.add.text(cx, castY + 70, b.name, textStyle('body', { fontSize: '17px', fontStyle: '700' })).setOrigin(0.5);
      // 13px in small's default sky measured 3.45:1 over the roster scrim — under the 4.5:1 WCAG
      // AA floor for normal-weight text, and reported live as hard to read. Cream at 14px clears
      // it without changing the layout.
      this.add.text(cx, castY + 90, b.instrument, textStyle('small', {
        fontSize: '14px', color: PALETTE_HEX.cream,
      })).setOrigin(0.5);
      this.add.text(cx, castY + 108, `wants ${b.wants}`, textStyle('small', {
        fontSize: '14px', color: PALETTE_HEX.cream, wordWrap: { width: castStep - 10 }, align: 'center',
      })).setOrigin(0.5, 0);
    });
    // castY+166, not +150: one bandmate's want ("wants sonic experimentation") wraps to two lines,
    // whose second line ended ~3px above this hint. Not an overlap by bounds, but visibly crowded.
    this.add.text(W / 2, castY + 166, 'Tap a face to say hi.', textStyle('small', { fontSize: '14px' })).setOrigin(0.5);

    createButton(this, W / 2 - 150, castY + 200, 300, GRID_ROW_H, "Hit the road", () => {
      const name = this.nameInput.el.value.trim() || 'The Unnamed';
      const genre = this.genre || GENRES[0].id;
      const whyTour = this.whyTour || WHY_TOUR_BEATS[0];
      State.data.band = { name, genre, whyTour, members: BANDMATES.map((b) => b.id) };
      // WHY_TOUR_BEATS was purely decorative before this — picking "why this tour" never
      // affected anything downstream. This flag gives the funeral-promise beat specifically one
      // real payoff (Lisbon's journal entry, content/cities/lisbon.json's lis_journal) — the
      // same condition/fallback mechanism every gated backstory beat already uses. The opening
      // scene below (Item C) and RoutePlan's echo (Item D) are the pick's other two payoffs.
      if (whyTour === 'A promise made at a funeral.') State.addFlag('why_tour_funeral_promise');
      State.setProgress({ screen: 'routePlan' });
      saveRun(State.data);
      goTo(this, 'Opening');
    }, { fillColor: 0xc4704f });
  }

  /** Lazily creates one DialogueBox and reuses it for every "meet the band" tap — same instance,
   *  new node each time, matching how CityScene reuses its own single DialogueBox across an
   *  entire scene graph walk. */
  private meetBandmate(id: string): void {
    if (!this.meetBox) this.meetBox = new DialogueBox(this);
    const node = OPENING_GRAPH[id];
    this.meetBox.show(node, () => this.meetBox?.setVisible(false), () => {});
  }
}
