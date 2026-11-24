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

  it('o plano diz onde fazer cada chamado de rádio, e o imediato lembra no ponto de chamada', () => {
    const g = new Game(); g.start('entrada');
    const plan = makePlan(g);
    expect(plan.calls.length).toBe(5);
    expect(plan.calls[0].where).toMatch(/ponto de chamada: .*boia \d+.* a 1200 m da barra/);
    expect(plan.calls[0].why).toMatch(/linha de espera/);
    expect(W.CALL_POINT_S).toBeGreaterThan(W.nearest(g.s.x, g.s.y).s);   // a viagem começa antes dele
    expect(W.HOLD_LINE_S).toBeGreaterThan(W.CALL_POINT_S);
    g.setTelegraph(6); g.warp = 8;
    for (let i = 0; i < 600 && !g.msgs.some(m => m.text.includes('ponto de chamada')); i++) {
      const s = g.s, n = W.nearest(s.x, s.y), [x, y] = W.pointAt(n.s + 300); let e = Math.atan2(x - s.x, y - s.y) - s.psi; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      g.setRudderDeg(Math.round(Math.max(-20, Math.min(20, e / D2R * 1.5 - s.r / D2R * 50)) / 5) * 5); g.update(0.1);
    }
    expect(g.msgs.some(m => m.who === 'Imediato' && m.text.includes('ponto de chamada'))).toBe(true);
    expect(W.nearest(g.s.x, g.s.y).s).toBeLessThan(W.HOLD_LINE_S);
    expect(makePlan(Object.assign(new Game(), {})).calls.length).toBe(5);
    const f = new Game(); f.start('fundeio'); expect(makePlan(f).calls.length).toBe(0);
  });

  it('o plano dá o rumo a governar: compensa a corrente de través na baía e o vento de través no canal', () => {
    const g = new Game(); g.free = true; g.freeWind = 'calmaria'; g.start('entrada');
    const calm = makePlan(g);
    expect(calm.steps[0].set!).toBeGreaterThan(1.5);                                   // na baía a corrente costeira leva para leste, boreste de quem entra
    expect(calm.steps[0].steer!).toBeLessThan(calm.steps[0].course!);                  // então governa-se mais para bombordo
    const inCanal = calm.steps.find(s => s.s > W.S_MOUTH + 200)!;
    expect(Math.abs(inCanal.set!)).toBeLessThan(0.6);                                  // no canal a corrente é pela proa: não abate
    g.freeWind = 'leste'; g.start('entrada');
    const east = makePlan(g), leg = east.steps.find(s => s.s > W.S_MOUTH + 200)!;
    console.log('vento leste de 18 nós no canal: abate', leg.set!.toFixed(1), '°; governar', leg.steer!.toFixed(0), 'para fazer', leg.course!.toFixed(0));
    expect(leg.set!).toBeLessThan(-1);                                                 // vento de boreste empurra para bombordo
    expect(leg.steer!).toBeGreaterThan(leg.course!);
    expect(g.env.windSpeed).toBeCloseTo(18 * 0.514444, 1);
  });
  it('com vento de través o navio abate de verdade, e o GPS mostra para que lado', () => {
    const run = (wind: 'calmaria' | 'leste') => {
      const g = new Game(); g.free = true; g.freeWind = wind; g.trust = 0; g.start('entrada'); g.vts = 'ok'; g.traffic = [];
      g.env.current = () => [0, 0];
      const s0 = W.S_MOUTH + 1050, [x, y] = W.pointAt(s0, 0), hdg = W.courseAt(s0 + 10), s = g.s;
      s.x = x; s.y = y; s.psi = hdg * D2R; s.u = 2; g.setTelegraph(6); g.warp = 8;
      let acc = 0;   // timoneiro que segura o rumo de verdade, sem deixar o navio orçar para o vento
      for (let i = 0; i < 3000 && g.status === 'running' && W.nearest(s.x, s.y).s < s0 + 700; i++) {
        let e = hdg - s.psi / D2R; if (e > 180) e -= 360; if (e < -180) e += 360; acc = Math.max(-40, Math.min(40, acc + e * 0.8));
        g.setRudderDeg(Math.round(Math.max(-25, Math.min(25, e * 3 + acc * 0.25 - s.r / D2R * 40)))); g.update(0.1);
      }
      const n = W.nearest(s.x, s.y); return { off: n.d * (n.side > 0 ? -1 : 1), leeway: g.leeway };
    };
    const calm = run('calmaria'), east = run('leste');
    console.log('700 m segurando o rumo: calmaria sai', calm.off.toFixed(0), 'm; leste de 18 nós sai', east.off.toFixed(0), 'm, abatendo', east.leeway.toFixed(1), '°');
    expect(Math.abs(calm.off)).toBeLessThan(8);
    expect(east.off).toBeLessThan(-4);        // empurrado para bombordo
    expect(east.leeway).toBeLessThan(-1);
  });
});
