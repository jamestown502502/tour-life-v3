import Phaser from 'phaser';
import { W } from '../const';
import { createButton, setButtonSelected } from './Button';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { BANDMATES, GENRES, WHY_TOUR_BEATS } from '../../content/bands';
import { saveRun } from '../core/save';
import { createFloatingInput, type FloatingInput } from './htmlOverlay';
import { textStyle } from './textStyles';

export class BandCreatorScene extends Phaser.Scene {
  constructor() { super('BandCreator'); }

  private genre = '';
  private whyTour = '';
  private nameInput!: FloatingInput;

  create(): void {
    fadeIn(this);
    this.add.rectangle(0, 0, W, this.cameras.main.height, 0x2b3a55, 1).setOrigin(0, 0);
    this.add.text(W / 2, 70, 'Name your band', textStyle('h1')).setOrigin(0.5);

    this.nameInput = createFloatingInput(W / 2, 130, 320, 'Band name');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.nameInput.destroy());

    this.add.text(W / 2, 200, 'Genre', textStyle('h2')).setOrigin(0.5);
    const genres = [...GENRES, ...State.data.meta.unlockedGenres.map((id) => ({ id, label: id.replace(/_/g, ' ') }))];
    const genreLabels: Phaser.GameObjects.Container[] = [];
    genres.forEach((g, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const btn = createButton(this, W / 2 - 300 + col * 310, 240 + row * 60, 290, 50, g.label, () => {
        this.genre = g.id;
        genreLabels.forEach((b) => setButtonSelected(b, false));
        setButtonSelected(btn, true);
      });
      genreLabels.push(btn);
    });

    const whyY = 240 + Math.ceil(genres.length / 2) * 60 + 40;
    this.add.text(W / 2, whyY, 'Why this tour?', textStyle('h2')).setOrigin(0.5);
    const whyLabels: Phaser.GameObjects.Container[] = [];
    WHY_TOUR_BEATS.forEach((beat, i) => {
      const btn = createButton(this, W / 2 - 300, whyY + 40 + i * 56, 600, 46, beat, () => {
        this.whyTour = beat;
        whyLabels.forEach((b) => setButtonSelected(b, false));
        setButtonSelected(btn, true);
      }, { fontSize: '18px' });
      whyLabels.push(btn);
    });

    const membersY = whyY + 40 + WHY_TOUR_BEATS.length * 56 + 30;
    this.add.text(W / 2, membersY, 'The band', textStyle('h2')).setOrigin(0.5);
    BANDMATES.forEach((b, i) => {
      this.add.text(W / 2, membersY + 40 + i * 34, `${b.name} — ${b.instrument} — wants ${b.wants}`,
        textStyle('body', { fontSize: '16px' })).setOrigin(0.5);
    });

    createButton(this, W / 2 - 150, membersY + 40 + BANDMATES.length * 34 + 30, 300, 56, "Hit the road", () => {
      const name = this.nameInput.el.value.trim() || 'The Unnamed';
      const genre = this.genre || GENRES[0].id;
      const whyTour = this.whyTour || WHY_TOUR_BEATS[0];
      State.data.band = { name, genre, whyTour, members: BANDMATES.map((b) => b.id) };
      State.setProgress({ screen: 'routePlan' });
      saveRun(State.data);
      goTo(this, 'RoutePlan');
    }, { fillColor: 0xc4704f });
  }
}
