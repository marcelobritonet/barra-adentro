import { describe, expect, it } from 'vitest';
import { D2R } from '../sim/ship';
import * as W from '../world/santos';
import { Game } from './game';
import { swingRadius } from './traffic';

const stopped = (g: Game, x: number, y: number, psiDeg = 0) => { const s = g.s; s.x = x; s.y = y; s.psi = psiDeg * D2R; s.u = 0; s.stw = 0; s.telegraph = s.telAck = 4; s.n = 0; };
const run = (g: Game, sec: number) => { g.warp = 8; for (let t = 0; t < sec && g.status === 'running'; t += 0.8) g.update(0.1); };

describe('tráfego', () => {
  it('o navio do berço fica atracado até a hora, larga, segue o canal pelo lado dele em água funda e some na baía', () => {
    const g = new Game(); g.start('entrada'); g.vts = 'ok'; stopped(g, -3000, -5000);
    const out = g.traffic.find(o => o.kind === 'outbound')!;
    expect(out.phase).toBe('berthed');
    expect(Math.abs(W.quayLocal(out.x, out.y)[0])).toBeLessThan(1);
    g.callShip();
    expect(out.departAt).toBe(360);
    let minDepth = 99, maxOff = 0, wrongSide = 0, phases = new Set<string>();
    for (let i = 0; i < 5000 && out.phase !== 'gone'; i++) {
      g.warp = 8; g.update(0.1); stopped(g, -3000, -5000); phases.add(out.phase);
      if (out.phase !== 'underway') continue;
      const n = W.nearest(out.x, out.y);
      minDepth = Math.min(minDepth, W.depth(out.x, out.y)); maxOff = Math.max(maxOff, n.d); if (n.side < 0) wrongSide++;
    }
    expect([...phases]).toEqual(expect.arrayContaining(['berthed', 'unberthing', 'underway']));
    expect(minDepth).toBeGreaterThan(10);
    expect(maxOff).toBeLessThan(80);
    expect(wrongSide).toBe(0);
    expect(out.active).toBe(false);
  });
  it('não dá para passar espias com o berço ocupado; no fundeio o navio não sai', () => {
    const g = new Game(); g.start('entrada'); g.moor();
    expect(g.mooring).toBe(0);
    expect(g.msgs.some(m => m.text.includes('ainda está ocupado'))).toBe(true);
    const f = new Game(); f.start('fundeio');
    expect(f.traffic.find(o => o.kind === 'outbound')!.departAt).toBe(Infinity);
  });
  it('ficar no caminho do navio que sai termina em abalroamento', () => {
    const g = new Game(); g.trust = 0; g.start('entrada'); g.vts = 'ok';
    const out = g.traffic.find(o => o.kind === 'outbound')!;
    stopped(g, -3000, -5000); g.callShip();
    for (let i = 0; i < 2000 && out.phase !== 'underway'; i++) { g.warp = 8; g.update(0.1); stopped(g, -3000, -5000); }
    const [x, y] = W.pointAt(out.s - 300, -55); stopped(g, x, y, 300); // atravessado na frente dele
    run(g, 200);
    expect(g.result?.title).toBe('Abalroamento');
    expect(g.result?.detail).toContain(out.name);
  });
  it('fundeados aproam a resultante de vento e corrente, sem sair do giro', () => {
    const g = new Game(); g.start('fundeio'); stopped(g, -3000, -5000); run(g, 300);
    for (const o of g.traffic.filter(o => o.kind === 'anchored')) {
      expect(Math.hypot(o.x - o.ax, o.y - o.ay)).toBeLessThan(swingRadius(o));
      expect(Math.hypot(o.ax - W.ANCHORAGE.x, o.ay - W.ANCHORAGE.y)).toBeLessThan(W.ANCHORAGE.r);
    }
  });
  it('fundear dentro do giro de outro navio não é aceito; com folga, é', () => {
    const bad = new Game(); bad.trust = 0; bad.start('fundeio');
    const o = bad.traffic[0]; stopped(bad, o.ax + 150, o.ay + 120, 160); bad.letGoAnchor(); run(bad, 240);
    expect(bad.result).toBeNull();
    expect(bad.msgs.some(m => m.text.includes('dentro do giro'))).toBe(true);
    const ok = new Game(); ok.trust = 0; ok.start('fundeio');
    stopped(ok, W.ANCHORAGE.x, W.ANCHORAGE.y + 420, 160); ok.letGoAnchor(); run(ok, 400);
    expect(ok.result?.ok).toBe(true);
  });
});
