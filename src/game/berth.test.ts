import { describe, expect, it } from 'vitest';
import { KN } from '../sim/ship';
import * as W from '../world/santos';
import { BERTH, berthSpeedKn, Game } from './game';

/** Navio parado, paralelo ao Cais de Santos, com o costado a `off` metros das defensas e deriva `drift` (m/s) para o cais. */
function near(off: number, drift = 0, wind = false) {
  const g = new Game(); g.trust = 0; g.start('entrada'); g.vts = 'ok'; g.traffic = [];
  const Q = W.QUAY, s = g.s;
  s.x = Q.cx + Q.nx * (Q.fender + 7 + off); s.y = Q.cy + Q.ny * (Q.fender + 7 + off); s.psi = Math.atan2(Q.tx, Q.ty);
  s.u = 0; s.v = -drift; s.stw = 0; s.telegraph = s.telAck = 4; s.n = 0; s.r = 0;
  if (!wind) { (g as any).windBase = 0; g.env.current = () => [0, 0]; }
  g.warp = 8;
  const run = (sec: number) => { for (let t = 0; t < sec && g.status === 'running'; t += 0.8) g.update(0.1); };
  return { g, run };
}

describe('atracação', () => {
  it('a defensa absorve a pancada: o navio encosta e fica, em vez de quicar', () => {
    const { g, run } = near(4, 0.18);
    let far = 0;
    for (let i = 0; i < 150 && g.status === 'running'; i++) { g.update(0.1); if (g.touching || far) far = Math.max(far, g.berth().bow, g.berth().stern); }
    console.log('depois de encostar a 0,35 nó, afastou no máximo', far.toFixed(1), 'm em 2 min');
    expect(g.ledger.contact).toBe(0);     // 0,35 nó é macio
    expect(far).toBeLessThan(4.5);   // antes das defensas novas eram 17 m
    run(1);
  });
  it('multas pelo toque: macio até 0,4 nó, duro até 0,9, pancada até 1,6, avaria acima', () => {
    const hit = (v: number) => { const { g, run } = near(3, v); run(40); return g; };
    expect(hit(0.15).ledger.contact).toBe(0);
    expect(hit(0.3).ledger.contact).toBe(3000);
    expect(hit(0.6).ledger.contact).toBe(15000);
    expect(hit(1.0).result?.ok).toBe(false);
    expect(BERTH.soft / KN).toBeCloseTo(0.39, 1);
  });
  it('com a proa a 14 m e 0,6 nó já se passam as espias, e os cabos trazem o navio até amarrar', () => {
    const { g, run } = near(11, 0, true);           // costado a 11 m: a bochecha fica a 13 m das defensas
    g.s.u = 0.3;                                    // ainda com seguimento ao longo do cais
    g.moor();
    expect(g.mooring).toBeGreaterThan(0);
    run(600);
    console.log('amarrado em', (g.time / 60).toFixed(1), 'min:', g.result?.title, 'contato', g.ledger.contact);
    expect(g.result?.ok).toBe(true);
    expect(g.ledger.contact).toBe(0);               // os guinchos encostam macio
  });
  it('longe ou rápido demais não amarra, e o imediato diz o que falta', () => {
    const a = near(20); a.g.moor(); expect(a.g.mooring).toBe(0);
    expect(a.g.msgs.at(-1)!.text).toMatch(/Longe demais.*máx\. 15/);
    const b = near(5); b.g.s.u = 0.7; b.g.moor(); expect(b.g.mooring).toBe(0);
    expect(b.g.msgs.at(-1)!.text).toMatch(/Ainda com 1[.,]4 nó/);
    const c = near(5); c.g.s.x -= W.QUAY.tx * 130; c.g.s.y -= W.QUAY.ty * 130; c.g.moor(); expect(c.g.mooring).toBe(0);
    expect(c.g.msgs.at(-1)!.text).toMatch(/Fora do alcance dos cabos/);
  });
  it('o plano de atracação pede menos velocidade quanto mais perto, e o imediato cobra', () => {
    expect(berthSpeedKn(500)).toBe(2); expect(berthSpeedKn(300)).toBe(1.5); expect(berthSpeedKn(130)).toBe(1); expect(berthSpeedKn(60)).toBe(0.5); expect(berthSpeedKn(10)).toBe(0.3);
    const { g, run } = near(60); g.s.x -= W.QUAY.tx * 200; g.s.y -= W.QUAY.ty * 200; g.s.u = 1.6; run(15);
    expect(g.msgs.some(m => m.who === 'Imediato' && /o plano pede/.test(m.text))).toBe(true);
  });

  it('80 m fora do ponto e ainda andando: passa as espias e os cabos correm o navio até o lugar', () => {
    const { g, run } = near(6, 0, true);
    g.s.x -= W.QUAY.tx * 80; g.s.y -= W.QUAY.ty * 80; g.s.u = 0.3;
    expect(g.canMoor).toBe(true);
    g.moor(); expect(g.mooring).toBeGreaterThan(0);
    let maxU = 0; for (let i = 0; i < 2000 && g.status === 'running'; i++) { g.update(0.1); maxU = Math.max(maxU, Math.abs(g.s.u)); }
    console.log('correu 80 m nos cabos em', (g.time / 60).toFixed(1), 'min, a no máximo', (maxU / KN).toFixed(2), 'nó; terminou a', Math.abs(g.berth().along).toFixed(0), 'm do ponto');
    expect(g.result?.ok).toBe(true);
    expect(Math.abs(g.berth().along)).toBeLessThan(BERTH.alongDone);
    expect(g.ledger.contact).toBe(0);
    expect(g.time / 60).toBeLessThan(9);
  });
  it('o painel entra em modo de atracação perto do berço e sai longe dele', () => {
    const far = new Game(); far.start('entrada'); expect(far.berthing).toBe(false);
    const { g } = near(60); expect(g.berthing).toBe(true);
    const f = new Game(); f.start('fundeio'); expect(f.berthing).toBe(false);
    const c = new Game(); c.start('contrabordo'); expect(c.berthing).toBe(false);
    const Q = W.QUAY; c.s.x = Q.cx + Q.nx * 40; c.s.y = Q.cy + Q.ny * 40; c.s.psi = Math.atan2(Q.tx, Q.ty); expect(c.berthing).toBe(true);
  });
});
