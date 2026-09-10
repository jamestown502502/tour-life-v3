import Phaser from 'phaser';
import { ensureSceneBackdrop } from '../art/sprites';
import { addCoverBackground } from '../art/background';
import { applyVignette } from '../art/effects';
import { PALETTE_HEX, W, PALETTE } from '../const';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { makeRng } from '../core/rng';
import { CITIES, getCity } from '../game/content';
import { generateRoute, MID_TOUR_COMPLICATIONS, routeArcRole } from '../game/route';
import { drawScenePoolFlags } from '../game/scenePool';
import { saveRun } from '../core/save';
import { addTextScrim, textStyle } from './textStyles';
import { TOUR_PROMISES } from '../../content/promises';
import { DialogueBox } from './DialogueBox';
import { addMenuButton } from './MenuButton';

const ONBOARD_FLAG = 'onboard_routeplan_seen';

export const COMPLICATION_LABELS: Record<string, string> = {
  van_breakdown: 'The van has been making a noise none of you want to name.',
  lost_gear: 'A pedal went missing somewhere between cities. Nobody\'s owning up.',
  booking_conflict: 'Two venues both think they booked you the same night.',
  bandmate_gets_sick: 'Someone\'s been quietly rationing cold medicine.',
  venue_falls_through: 'A venue emailed. It was not good news.',
  unexpected_press: 'A local blog wrote about you. Nobody expected that.',
};

export class RoutePlanScene extends Phaser.Scene {
  constructor() { super('RoutePlan'); }

  create(): void {
    fadeIn(this);
    // Painted backdrop (pre-public "no barren screens" pass). Falls back to a code-drawn
    // gradient if the asset is missing — ensureSceneBackdrop keeps that seam.
    const bgKey = ensureSceneBackdrop(this, 'routeplan', PALETTE.terracotta);
    applyVignette(addCoverBackground(this, bgKey));

    if (!State.hasFlag(ONBOARD_FLAG)) {
      const box = new DialogueBox(this);
      box.show(
        { id: 'onboard_routeplan', speaker: 'sol', text: "Pick the cities that feel right. You can't play them all — that's the point." },
        () => { State.addFlag(ONBOARD_FLAG); box.destroy(); this.renderRoutePlan(); },
        () => {},
      );
      return;
    }
    this.renderRoutePlan();
  }

  private renderRoutePlan(): void {
    // Called after any onboarding DialogueBox has already been destroyed (see create()), so
    // this never collides with its top-left backlog toggle the way CityScene's did.
    addMenuButton(this, 'RoutePlan');
    const possessive = State.data.band.name.endsWith('s') ? `${State.data.band.name}'` : `${State.data.band.name}'s`;
    // This whole scene drew straight onto the painted map — a lit desk, a paper chart, a mug —
    // with NOT ONE scrim anywhere. Reported as hard to read three separate times while the
    // contrast suite passed it, because the suite only ever saw the onboarding dialogue that
    // covers this screen on a first run and returns early. The header block and the route list
    // are the two densest stacks, so each gets one scrim rather than a dozen.
    addTextScrim(this, W / 2, 118, W - 60, 116);
    this.add.text(W / 2, 80, `${possessive} Route`, textStyle('h1')).setOrigin(0.5);
    this.add.text(W / 2, 130, `Seed: ${State.data.seed}`, textStyle('small', { color: PALETTE_HEX.cream })).setOrigin(0.5);
    // Stuck-screen-hardening follow-up, Item D: the why-tour pick (BandCreatorScene.ts) was
    // decorative everywhere except one flag-gated Lisbon branch — this is its second grounding
    // beat (after OpeningScene's closing line), so the reason for the whole route stays visible
    // right where the route itself is being laid out.
    this.add.text(W / 2, 160, `You're touring because: "${State.data.band.whyTour}"`, textStyle('small', {
      color: PALETTE_HEX.cream, wordWrap: { width: W - 120 }, align: 'center',
    })).setOrigin(0.5);

    const rng = makeRng(`${State.data.seed}:route`);
    const generated = generateRoute(rng, CITIES);
    // Item D: the route already has a real arc — HubScene.ts's applyMidTourComplicationIfDue
    // fires the seed-picked complication at exactly this index (the first Hub visit at or past
    // the midpoint) — this labels the stop where that actually happens, instead of showing the
    // complication as a single disconnected line below the whole list the way it did before.
    // The opener/finale labels are presentational (every stop is mechanically the same), but the
    // midpoint label reflects a real, already-existing mechanical fact about this run.
    const rowH = 78;

    // One strip behind the entire route list. Each row is a city line plus an optional arc note,
    // and both were cream/terracotta directly on pale paper.
    // 0.82, not the 0.72 default: a five-stop route puts its last row near the scrim's edge over
    // the map's brightest area, and the city line measured 4.46:1 against a 4.5 floor at 0.72.
    addTextScrim(this, W / 2, 210 + (generated.stops.length - 1) * rowH / 2 + 12,
      W - 40, generated.stops.length * rowH + 40, 0.82);

    generated.stops.forEach((stop, i) => {
      const city = getCity(stop.cityId);
      stop.weather = generated.weatherByCity[stop.cityId];
      const y = 210 + i * rowH;
      this.add.text(W / 2, y, `${i + 1}. ${city.name} — ${stop.weather?.replace(/_/g, ' ')}`,
        textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
      const role = routeArcRole(i, generated.stops.length);
      const frameLine = role === 'opener' ? 'The opener — get your legs under you.'
        : role === 'finale' ? 'The one that matters.'
        : role === 'midpoint' ? (COMPLICATION_LABELS[generated.midTourComplication] ?? '')
        : '';
      if (frameLine) {
        // Terracotta at 14px measured 2.80-2.99:1 on the route scrim, well under the 4.5 floor for
        // normal-weight text. Cream clears it; the size difference against the 22px city line
        // carries the hierarchy that the colour was doing.
        this.add.text(W / 2, y + 24, frameLine, textStyle('small', {
          fontSize: '14px', color: PALETTE_HEX.cream, wordWrap: { width: W - 140 }, align: 'center',
        })).setOrigin(0.5);
      }
    });

    const buttonY = 210 + generated.stops.length * rowH + 10;

    // 66px (not the original 56): at the measured 390px-width scale (0.5417x), a raw button
    // needs h>=66 — (66+16)*0.5417=44.4 CSS px — to actually clear the 44px floor including
    // Button.ts's own 8px-each-side pad. 64 measured at 43.3, just under; don't round down from
    // 66 without re-measuring live, the margin here is thin.
    // THE PROMISE. One line about what this tour is actually for, chosen before the first city and
    // answered in the epilogue (content/promises.ts). A route used to be a sequence of stops with
    // no stated intent, so the ending could only summarise what happened, never whether it was
    // what you set out to do. Purely additive: a run with no promise flag simply gets no promise
    // paragraph, which is what every save written before this did.
    addTextScrim(this, W / 2, buttonY - 8, 420, 52);
    // h2's default sky measures ~2.4-2.9:1 on a standard scrim — under even the 3:1 large-text
    // floor. MiniGameScene already carries this exact note; cream is the same answer here.
    this.add.text(W / 2, buttonY - 8, 'What is this tour for?',
      textStyle('h2', { color: PALETTE_HEX.cream })).setOrigin(0.5);
    let promiseChosen: string | null = null;
    const promiseButtons: Phaser.GameObjects.Container[] = [];
    addTextScrim(this, W / 2, buttonY + 34 + TOUR_PROMISES.length * 74, W - 100, 46);
    const promiseLine = this.add.text(W / 2, buttonY + 34 + TOUR_PROMISES.length * 74, '', textStyle('small', {
      color: PALETTE_HEX.cream, wordWrap: { width: W - 120 }, align: 'center',
    })).setOrigin(0.5);
    TOUR_PROMISES.forEach((promise, i) => {
      const btn = createButton(this, 40, buttonY + 24 + i * 74, W - 80, 62, promise.label, () => {
        promiseChosen = promise.flag;
        promiseLine.setText(promise.line);
        // Re-tint so the current pick is obvious without adding a selection widget.
        promiseButtons.forEach((b, j) => b.setAlpha(j === i ? 1 : 0.55));
      }, { fillColor: PALETTE.plum, fontSize: '17px' });
      promiseButtons.push(btn);
    });

    createButton(this, W / 2 - 150, buttonY + 60 + TOUR_PROMISES.length * 74, 300, 66, 'Confirm route', () => {
      if (promiseChosen) State.addFlag(promiseChosen);
      State.data.route = generated.stops;
      State.data.midTourComplication = generated.midTourComplication;
      for (const stop of generated.stops) {
        State.data.localLove[stop.cityId] = 0;
        const city = getCity(stop.cityId);
        for (const flag of drawScenePoolFlags(makeRng(`${State.data.seed}:${city.id}:pool`), city,
          State.data.meta.seenSceneIds ?? [])) {
          State.addFlag(flag);
        }
      }
      State.data.currentCityIndex = 0;
      State.setProgress({ screen: 'hub' });
      saveRun(State.data);
      goTo(this, 'Hub');
    }, { fillColor: 0x3e7c7b });
  }
}
