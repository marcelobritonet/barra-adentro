import { describe, expect, it } from 'vitest';
import * as W from './santos';

describe('faróis de alinhamento', () => {
  it('há um farol em terra no fim de cada pernada, no prolongamento do eixo', () => {
    expect(W.BEACONS.length).toBeGreaterThanOrEqual(4);
    for (const b of W.BEACONS) {
      expect(W.depth(b.x, b.y)).toBeLessThanOrEqual(0);                    // em terra
      expect(b.x).toBeGreaterThan(W.BOUNDS.x0); expect(b.y).toBeLessThan(W.BOUNDS.y1);
    }
  });
  it('branco no eixo; encarnado se o navio abre para boreste; verde para bombordo; apagado fora do setor', () => {
    for (const b of W.BEACONS) {
      // um ponto no meio da pernada deste farol
      const s0 = W.TURNS[b.leg - 1].s, s1 = b.leg < W.TURNS.length ? W.TURNS[b.leg].s : W.CHANNEL_LENGTH, [mx, my] = W.pointAt((s0 + s1) / 2, 0);
      const mid = Math.hypot(mx - b.x, my - b.y);
      const at = (along: number, side: number) => W.sector(b, b.x - b.tx * along + b.ty * side, b.y - b.ty * along - b.tx * side);
      expect(at(mid, 0)).toBe('white');
      expect(at(mid, 6)).toBe('white');
      expect(at(mid, 70)).toBe('red');      // a boreste do eixo: o lado das boias encarnadas
      expect(at(mid, -70)).toBe('green');
      expect(at(5000, 0)).toBe('off');
      expect(at(-200, 0)).toBe('off');      // já passou do farol
    }
  });
  it('só o farol da pernada em que o navio está fica aceso', () => {
    const [x, y] = W.pointAt(W.S_MOUTH + 1400, 45);
    const lit = W.BEACONS.filter(b => W.sector(b, x, y) !== 'off');
    expect(lit.length).toBe(1);
    expect(W.sector(lit[0], x, y)).toBe('red');
  });
  it('seguindo o eixo de cada pernada o farol dela fica branco', () => {
    for (const b of W.BEACONS) {
      const s0 = W.TURNS[b.leg - 1].s, s1 = b.leg < W.TURNS.length ? W.TURNS[b.leg].s : W.CHANNEL_LENGTH;
      for (const f of [0.2, 0.5, 0.8]) { const [x, y] = W.pointAt(s0 + (s1 - s0) * f, 0); expect(W.sector(b, x, y)).toBe('white'); }
    }
  });
});
