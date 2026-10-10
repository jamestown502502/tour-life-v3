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
import { OPENING_GRAPH } from '../../content/opening';
import { ensurePortrait, ensurePortraitFrame, ensureRoundedRect } from '../art/sprites';
import { suggestBandName } from '../game/bandName';

export class BandCreatorScene extends Phaser.Scene {
  constructor() { super('BandCreator'); }

  private genre = '';
  private whyTour = '';
  private nameInput!: FloatingInput;
  private meetCard: Phaser.GameObjects.Container | null = null;
  private meetId: string | null = null;
  private faceRings = new Map<string, Phaser.GameObjects.Arc>();
  private castY = 0;

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

    // Empty, with the suggestion as its placeholder (QA round 4 #7: a pre-filled name read as
    // already chosen and selected). Leaving it blank still gets the suggested name on Hit the road
    // (QA #1, decision D1), so the button is never blocked.
    const suggested = suggestBandName(State.data.seed);
    this.nameInput = createFloatingInput(this, W / 2, 130, 320, `e.g. ${suggested}`);
    this.nameInput.el.value = '';
    this.nameInput.el.setAttribute('aria-label', 'Band name');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.nameInput.destroy());
    addTextScrim(this, W / 2, 170, 380, 30, 0.6);
    this.add.text(W / 2, 170, `Type a name, or leave it blank for ${suggested}.`, textStyle('small', { fontSize: '13px', color: PALETTE_HEX.cream })).setOrigin(0.5);
    // QA #12: an explicit way back to the welcome screen from setup. Top-right: the menu gear
    // already owns the top-left corner (MenuButton.ts).
    // Same size and row as the gear opposite it (QA round 4 #11: it was 12 units shorter, so the two
    // never lined up), with a drawn arrow (Button.ts).
    createButton(this, W - 170, 20, 150, 66, '← Back', () => goTo(this, 'Title'), { fillColor: PALETTE.plum, fontSize: '18px' });

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
    // The pick is always visible (QA round 3 #3): the first option starts selected, which is what
    // "Hit the road" used to apply silently, and a tap on another one moves the ring.
    this.genre = genres[0].id;
    genres.forEach((g, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const btn = createButton(this, W / 2 - 300 + col * 310, 240 + row * GRID_INCREMENT, 290, GRID_ROW_H, g.label, () => {
        this.genre = g.id;
        genreLabels.forEach((b) => setButtonSelected(b, false));
        setButtonSelected(btn, true);
      });
      if (i === 0) setButtonSelected(btn, true);
      genreLabels.push(btn);
    });

    const whyY = 240 + Math.ceil(genres.length / 2) * GRID_INCREMENT + 40;
    addTextScrim(this, W / 2, whyY, 320, 52);
    this.add.text(W / 2, whyY, 'Why this tour?', textStyle('h2')).setOrigin(0.5);
    const whyLabels: Phaser.GameObjects.Container[] = [];
    this.whyTour = WHY_TOUR_BEATS[0];
    WHY_TOUR_BEATS.forEach((beat, i) => {
      const btn = createButton(this, W / 2 - 300, whyY + 40 + i * GRID_INCREMENT, 600, GRID_ROW_H, beat, () => {
        this.whyTour = beat;
        whyLabels.forEach((b) => setButtonSelected(b, false));
        setButtonSelected(btn, true);
      }, { fontSize: '18px' });
      if (i === 0) setButtonSelected(btn, true);
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
    this.castY = castY;
    this.faceRings.clear();
    this.meetCard = null;
    this.meetId = null;
    // One strip behind the whole roster: four columns of name/instrument/want plus the tap hint.
    // Per-column scrims would leave the busiest part of the backdrop showing between them.
    addTextScrim(this, W / 2, castY + 112, W - 40, 142, 0.86);
    const castStep = W / (BANDMATES.length + 1);
    BANDMATES.forEach((b, i) => {
      const cx = castStep * (i + 1);
      const frameKey = ensurePortraitFrame(this);
      const portraitKey = ensurePortrait(this, b.id, 'happy');
      // Gold ring on the bandmate whose line is showing, so it is clear who is talking and that
      // another face can be tapped straight away.
      this.faceRings.set(b.id, this.add.circle(cx, castY + 2, 58, PALETTE.gold, 0.9).setVisible(false));
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
    // Every want fits on one line (QA round 3 #5: Jun's "wants sonic experimentation" wrapped to two
    // and broke the row's alignment; it reads "wants new sounds" now).
    this.add.text(W / 2, castY + 166, 'Tap a face to say hi.', textStyle('small', { fontSize: '14px' })).setOrigin(0.5);

    createButton(this, W / 2 - 150, castY + 200, 300, GRID_ROW_H, "Hit the road", () => {
      const name = this.nameInput.el.value.trim() || suggestBandName(State.data.seed);
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

  /** "Say hi": the bandmate's line in a card ABOVE the row of faces (QA round 3 #3). It used to
   *  open the full dialogue box over the bottom of the screen, covering the very faces it came
   *  from, so meeting someone else meant dismissing it first. Now another face swaps the line at
   *  once, the same face (or the card, or its ×) closes it. */
  private meetBandmate(id: string): void {
    const wasOpen = this.meetId;
    this.closeMeet();
    if (wasOpen === id) return;
    const node = OPENING_GRAPH[id];
    const mate = BANDMATES.find((b) => b.id === id);
    if (!node || !mate) return;
    this.meetId = id;
    this.faceRings.get(id)?.setVisible(true);
    const w = W - 80, x = 40;
    const body = this.add.text(x + 28, 0, `"${node.text}"`, textStyle('dialogue', {
      fontSize: '19px', wordWrap: { width: w - 56 }, lineSpacing: 4,
    }));
    const h = body.height + 82;
    const y = this.castY - 72 - h;
    body.setY(y + 52);
    const card = this.add.container(0, 0).setDepth(120);
    const bg = this.add.image(x, y, ensureRoundedRect(this, w, h, 22)).setOrigin(0, 0).setTint(PALETTE.sand).setAlpha(0.98)
      .setInteractive();
    bg.on('pointerdown', () => this.closeMeet());
    const border = this.add.graphics().lineStyle(2, PALETTE.gold, 0.7).strokeRoundedRect(x, y, w, h, 22);
    const name = this.add.text(x + 28, y + 18, `${mate.name} · ${mate.instrument}`, textStyle('h2', { fontSize: '20px', color: PALETTE_HEX.plum }));
    const close = this.add.text(x + w - 24, y + 14, '×', textStyle('h1', { fontSize: '30px', color: PALETTE_HEX.plum })).setOrigin(1, 0);
    card.add([bg, border, name, close, body]);
    this.meetCard = card;
  }

  private closeMeet(): void {
    this.meetCard?.destroy();
    this.meetCard = null;
    if (this.meetId) this.faceRings.get(this.meetId)?.setVisible(false);
    this.meetId = null;
  }
}
