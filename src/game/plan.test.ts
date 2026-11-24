import { describe, expect, it } from 'vitest';
import { D2R, makeCoaster, makeShipParams, makeState, stepShip } from '../sim/ship';
import * as W from '../world/santos';
import { Game } from './game';
import { makePlan, simStop, simTurn, steadySpeed } from './plan';

describe('plano de viagem', () => {
  it('a guinada simulada termina no rumo pedido, e navio maior começa antes', () => {
    const c = simTurn(makeCoaster(1), 6, -31, 15), h = simTurn(makeShipParams('handy', 1), 6, -31, 15);
    console.log('guinada de 31° a devagar, leme 15: costeiro começa', c.before.toFixed(0), 'm antes e quebra aos', c.counter, '°; graneleiro', h.before.toFixed(0), 'm e', h.counter, '°');
    expect(Math.abs(c.error)).toBeLessThan(2.5); expect(Math.abs(h.error)).toBeLessThan(2.5);
    expect(c.before).toBeGreaterThan(40); expect(c.counter).toBeGreaterThan(3);
    expect(h.before).toBeGreaterThan(c.before * 1.2);
  });
  it('seguir o plano à risca põe o navio sobre o rumo novo, perto do eixo', () => {
    // canal reto para o norte que guina 31° a bombordo em y = 2000
    const p = makeCoaster(1), plan = simTurn(p, 6, -31, 15), env = { depth: () => 14, current: () => [0, 0] as [number, number], windFrom: 0, windSpeed: 0 };
    const s = makeState(0, 0, 0, 0, 6); s.u = steadySpeed(p, 6);
    let phase = 0;
    for (let t = 0; t < 1500; t += 0.1) {
      let h = s.psi / D2R; if (h > 180) h -= 360;
      if (phase === 0 && s.y >= 2000 - plan.before) { phase = 1; s.rudderOrder = -15 * D2R; s.helmTimer = p.helmDelay; }
      else if (phase === 1 && h <= -31 + plan.counter) { phase = 2; s.rudderOrder = 15 * D2R; s.helmTimer = p.helmDelay; }
      else if (phase === 2 && s.r >= -0.0002) { phase = 3; s.rudderOrder = 0; s.helmTimer = p.helmDelay; }
      stepShip(s, p, env, 0.1, { X: 0, Y: 0, N: 0 });
    }
    let h = s.psi / D2R; if (h > 180) h -= 360;
    const dx = s.x, dy = s.y - 2000, off = dx * Math.cos(-31 * D2R) - dy * Math.sin(-31 * D2R);   // distância lateral ao rumo novo
    console.log('seguindo o plano: rumo final', h.toFixed(1), '°, a', off.toFixed(0), 'm do eixo novo');
    expect(Math.abs(h + 31)).toBeLessThan(5);   // o plano é um guia: o ajuste fino é do timoneiro
    expect(Math.abs(off)).toBeLessThan(30);
  });
  it('o plano da entrada tem as curvas do canal, cada uma amarrada a uma boia, e a parada', () => {
    const g = new Game(); g.start('entrada');
    const plan = makePlan(g), turns = plan.steps.filter(s => s.turn);
    expect(turns.length).toBe(3);   // 003°, 342° e 311°; a de meio grau no começo não entra
    for (const st of turns) { expect(st.turn!.buoy).toBeGreaterThanOrEqual(0); expect(st.turn!.s).toBeLessThan(W.QUAY_S); expect(st.action).toMatch(/Guinar para \d{3}°: leme (BB|BE) \d+/); }
    expect(plan.steps.reduce((a, s) => a + (s.dist ?? 0), 0)).toBeCloseTo(W.QUAY_S - W.nearest(g.s.x, g.s.y).s, 0);
    expect(plan.stopAt).toBeGreaterThan(150); expect(plan.asternAt).toBeGreaterThan(20);
    expect(plan.steps.every(s => (s.sog ?? 1) > 0)).toBe(true);
    const total = plan.steps.reduce((a, s) => a + (s.min ?? 0), 0);
    expect(total).toBeGreaterThan(25); expect(total).toBeLessThan(80);
  });
  it('parar leva mais longe com o graneleiro; há plano para fundeio, contrabordo, ilha e giro', () => {
    expect(simStop(makeShipParams('handy', 1), 5).coast).toBeGreaterThan(simStop(makeCoaster(1), 5).coast);
    const g = new Game();
    g.start('fundeio'); expect(makePlan(g).steps.length).toBe(3);
    g.start('contrabordo'); expect(makePlan(g).title).toContain('Serra Azul');
    g.free = true; g.freeBerth = 'ilha'; g.start('entrada'); expect(makePlan(g).title).toContain('Terminal da Ilha');
    g.freeBerth = 'cais'; g.freeHeadOut = true; g.start('entrada');
    const giro = makePlan(g); expect(giro.title).toContain('aproado ao mar'); expect(giro.steps[giro.steps.length - 1].action).toContain('bacia de evolução');
  });
});
