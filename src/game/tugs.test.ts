import { describe, expect, it } from 'vitest';
import * as W from '../world/santos';
import { Game } from './game';

/** Navio parado, paralelo ao cais, a `off` metros da face, com os dois rebocadores já de cabo passado. */
function alongside(off: number) {
  const g = new Game(); g.trust = 0; g.start('entrada'); g.vts = 'ok';
  const Q = W.QUAY, s = g.s;
  s.x = Q.cx + Q.nx * (Q.fender + 7 + off); s.y = Q.cy + Q.ny * (Q.fender + 7 + off); s.psi = Math.atan2(Q.tx, Q.ty);
  s.u = 0; s.stw = 0; s.telegraph = s.telAck = 4; s.n = 0;
  g.env.windSpeed = 0; (g as any).windBase = 0; g.env.current = () => [0, 0];
  for (const t of g.tugs) { t.state = 'fast'; }
  g.traffic = []; // berço livre para o teste
  g.warp = 8;
  const run = (sec: number) => { for (let t = 0; t < sec && g.status === 'running'; t += 0.8) g.update(0.1); };
  return { g, run };
}

describe('rebocadores', () => {
  it('a ordem demora a virar força', () => {
    const { g, run } = alongside(60);
    g.tugOrder(0, 'push', 1); run(3);
    expect(g.tugs[0].force).toBe(0);
    run(8);
    expect(g.tugs[0].force).toBeLessThan(0);
    expect(g.tugs[0].force).toBeGreaterThan(-120e3);
  });
  it('só o de proa empurrando: a proa cai para bombordo', () => {
    const { g, run } = alongside(60);
    g.tugOrder(0, 'push', 0.5); run(60);
    expect(g.s.r).toBeLessThan(0);
  });
  it('os dois empurrando levam o navio de lado para o cais', () => {
    const { g, run } = alongside(40);
    const b0 = g.berth().bow;
    g.tugOrder(0, 'push', 0.5); g.tugOrder(1, 'push', 0.5); run(80);
    expect(g.berth().bow).toBeLessThan(b0 - 5);
    expect(g.s.v).toBeLessThan(0);
  });
  it('empurrar e parar a tempo encosta macio; empurrar até o fim, não', () => {
    const soft = alongside(25);
    soft.g.tugOrder(0, 'push', 0.25); soft.g.tugOrder(1, 'push', 0.25); soft.run(45);
    soft.g.tugOrder(0, 'stop'); soft.g.tugOrder(1, 'stop'); soft.run(400);
    console.log('macio:', soft.g.ledger.contact, JSON.stringify(soft.g.berth()), soft.g.msgs.filter(m => m.who === 'Imediato').map(m => m.text).join(' | '));
    const hard = alongside(25);
    hard.g.tugOrder(0, 'push', 1); hard.g.tugOrder(1, 'push', 1); hard.run(400);
    console.log('forte:', hard.g.ledger.contact, hard.g.result?.title);
    expect(hard.g.ledger.contact + (hard.g.result && !hard.g.result.ok ? 1 : 0)).toBeGreaterThan(0);
    expect(soft.g.ledger.contact).toBeLessThanOrEqual(3000);
  });
  it('puxar depois de empurrar exige trocar de posição', () => {
    const { g, run } = alongside(60);
    g.tugOrder(1, 'push', 0.5); run(20);
    g.tugOrder(1, 'pull', 0.5); run(12);
    expect(g.tugs[1].force).toBeLessThanOrEqual(0);   // ainda não está puxando
    run(40);
    expect(g.tugs[1].force).toBeGreaterThan(0);
  });
  it('cobra a saída e o tempo de cabo passado', () => {
    const g = new Game(); g.start('entrada'); g.callTug(0);
    expect(g.ledger.tugs).toBe(1800);
  });

  it('o rebocador nunca passa por dentro do navio, nem chegando nem trocando de posição', () => {
    const { g, run } = alongside(120);
    for (const t of g.tugs) t.state = 'none';
    g.callTug(0); g.callTug(1);
    let inside = 0;
    const check = () => { for (const t of g.tugs) { if (t.state === 'none') continue; const dx = t.x - g.s.x, dy = t.y - g.s.y, sn = Math.sin(g.s.psi), cs = Math.cos(g.s.psi); if (Math.abs(dx * sn + dy * cs) < g.p.L / 2 + 2 && Math.abs(dx * cs - dy * sn) < g.p.B / 2 + 2) inside++; } };
    for (let i = 0; i < 400; i++) { g.update(0.1); check(); }
    expect(g.tugs.every(t => t.state === 'fast')).toBe(true);
    g.tugOrder(1, 'brake', 0.5); for (let i = 0; i < 60; i++) { g.update(0.1); check(); }
    g.tugOrder(1, 'pull', 0.25); g.tugOrder(0, 'pull', 0.25); for (let i = 0; i < 80; i++) { g.update(0.1); check(); }
    expect(inside).toBe(0);
    void run;
  });

  it('no cais a boreste os rebocadores trabalham por bombordo e empurram para boreste', () => {
    const g = new Game(); g.free = true; g.freeBerth = 'ilha'; g.trust = 0; g.start('entrada'); g.vts = 'ok'; g.traffic = [];
    const Q = W.QUAY, s = g.s;
    expect(Q.id).toBe('ilha'); expect(Q.side).toBe(-1);
    s.x = Q.cx + Q.nx * (Q.fender + 7 + 40); s.y = Q.cy + Q.ny * (Q.fender + 7 + 40); s.psi = Math.atan2(Q.tx, Q.ty);
    s.u = 0; s.stw = 0; s.telegraph = s.telAck = 4; s.n = 0;
    (g as any).windBase = 0; g.env.current = () => [0, 0];
    for (const t of g.tugs) t.state = 'fast';
    const b0 = g.berth().bow;
    g.tugOrder(0, 'push', 0.5); g.tugOrder(1, 'push', 0.5); g.warp = 8;
    for (let i = 0; i < 100; i++) g.update(0.1);
    expect(g.tugs[0].force).toBeGreaterThan(0);          // para boreste, onde está o cais
    expect(g.s.v).toBeGreaterThan(0);
    expect(g.berth().bow).toBeLessThan(b0 - 5);
    const dx = g.tugs[0].x - s.x, dy = g.tugs[0].y - s.y;
    expect(dx * Math.cos(s.psi) - dy * Math.sin(s.psi)).toBeLessThan(0); // rebocador a bombordo do navio
    W.setQuay('cais');
  });
});
