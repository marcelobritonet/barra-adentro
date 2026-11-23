import { describe, expect, it } from 'vitest';
import { Game } from '../game/game';
import * as W from './santos';
import { TIDE_AMP, TIDE_MEAN, TIDE_PERIOD, tideAt } from './tide';

describe('maré', () => {
  it('altura fica entre a baixa-mar e a preamar', () => {
    for (let t = 0; t < TIDE_PERIOD; t += 600) {
      const h = tideAt(t, 'vazante').height;
      expect(h).toBeGreaterThanOrEqual(TIDE_MEAN - TIDE_AMP - 1e-9); expect(h).toBeLessThanOrEqual(TIDE_MEAN + TIDE_AMP + 1e-9);
    }
  });
  it('nível caindo é vazante, subindo é enchente', () => {
    const v = tideAt(0, 'vazante'), e = tideAt(0, 'enchente');
    expect(v.flow).toBeGreaterThan(0.5); expect(v.rising).toBe(false); expect(tideAt(600, 'vazante').height).toBeLessThan(v.height);
    expect(e.flow).toBeLessThan(-0.3); expect(e.rising).toBe(true); expect(tideAt(600, 'enchente').height).toBeGreaterThan(e.height);
  });
  it('a corrente para e vira no tempo previsto', () => {
    const td = tideAt(0, 'baixamar');
    expect(td.flow).toBeGreaterThan(0);
    expect(tideAt(td.toSlack + 60, 'baixamar').flow).toBeLessThan(0);
    expect(td.toSlack / 60).toBeLessThan(40);
  });
  it('no jogo: a maré soma água à carta e inverte a corrente', () => {
    const g = new Game();
    g.tidePreset = 'preamar'; g.start('entrada'); const high = g.env.depth(-1000, -1500);
    g.tidePreset = 'baixamar'; g.start('entrada'); const low = g.env.depth(-1000, -1500);
    expect(high - low).toBeGreaterThan(1);
    expect(low).toBeGreaterThan(W.depth(-1000, -1500));
    expect(g.env.depth(-2000, 900)).toBeLessThanOrEqual(0); // terra continua terra
    const [x, y] = W.pointAt(W.S_MOUTH + 800), t = W.nearest(x, y);
    g.tidePreset = 'vazante'; g.start('entrada'); let [ce, cn] = g.env.current(x, y);
    expect(ce * t.tx + cn * t.ty).toBeLessThan(-0.3);   // contra quem entra
    g.tidePreset = 'enchente'; g.start('entrada'); [ce, cn] = g.env.current(x, y);
    expect(ce * t.tx + cn * t.ty).toBeGreaterThan(0.15); // a favor, mais fraca
  });
});
