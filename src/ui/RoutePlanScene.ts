import Phaser from 'phaser';
import { PALETTE_HEX, W } from '../const';
import { createButton } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { makeRng } from '../core/rng';
import { CITIES, getCity } from '../game/content';
import { generateRoute, MID_TOUR_COMPLICATIONS } from '../game/route';
import { drawScenePoolFlags } from '../game/scenePool';
import { saveRun } from '../core/save';
import { textStyle } from './textStyles';
import { DialogueBox } from './DialogueBox';

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
    this.add.rectangle(0, 0, W, this.cameras.main.height, 0x2b3a55, 1).setOrigin(0, 0);

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
    const possessive = State.data.band.name.endsWith('s') ? `${State.data.band.name}'` : `${State.data.band.name}'s`;
    this.add.text(W / 2, 80, `${possessive} Route`, textStyle('h1')).setOrigin(0.5);
    this.add.text(W / 2, 130, `Seed: ${State.data.seed}`, textStyle('small')).setOrigin(0.5);

    const rng = makeRng(`${State.data.seed}:route`);
    const generated = generateRoute(rng, CITIES);

    generated.stops.forEach((stop, i) => {
      const city = getCity(stop.cityId);
      stop.weather = generated.weatherByCity[stop.cityId];
      this.add.text(W / 2, 200 + i * 60, `${i + 1}. ${city.name} — ${stop.weather?.replace(/_/g, ' ')}`,
        textStyle('body', { fontSize: '22px' })).setOrigin(0.5);
    });

    const complicationY = 200 + generated.stops.length * 60 + 30;
    this.add.text(W / 2, complicationY, COMPLICATION_LABELS[generated.midTourComplication] ?? '',
      textStyle('small', { color: PALETTE_HEX.terracotta, wordWrap: { width: W - 120 }, align: 'center' })).setOrigin(0.5);

    createButton(this, W / 2 - 150, complicationY + 80, 300, 56, 'Confirm route', () => {
      State.data.route = generated.stops;
      State.data.midTourComplication = generated.midTourComplication;
      for (const stop of generated.stops) {
        State.data.localLove[stop.cityId] = 0;
        const city = getCity(stop.cityId);
        for (const flag of drawScenePoolFlags(makeRng(`${State.data.seed}:${city.id}:pool`), city)) {
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
