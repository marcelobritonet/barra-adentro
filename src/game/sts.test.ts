import { describe, expect, it } from 'vitest';
import * as W from '../world/santos';
import { Game } from './game';

/** Navio parado, paralelo ao navio fundeado, a `off` metros das defensas dele. */
function beside(off: number, drift = 0) {
  const g = new Game(); g.trust = 0; g.start('contrabordo');
  const Q = W.QUAY, s = g.s;
  s.x = Q.cx + Q.nx * (Q.fender + 7 + off); s.y = Q.cy + Q.ny * (Q.fender + 7 + off); s.psi = Math.atan2(Q.tx, Q.ty);
  s.u = 0; s.v = -drift; s.stw = 0; s.telegraph = s.telAck = 4; s.n = 0; s.r = 0;
  g.warp = 8;
  const run = (sec: number) => { for (let t = 0; t < sec && g.status === 'running'; t += 0.8) g.update(0.1); };
  return { g, run };
}

describe('a contrabordo', () => {
  it('o alvo é o costado de boreste do navio fundeado e acompanha o giro dele', () => {
    const { g, run } = beside(200);
    const o = g.sts!;
    expect(o.kind).toBe('anchored'); expect(W.QUAY.id).toBe('sts');
    const side = () => (W.QUAY.cx - o.x) * Math.cos(o.psi) - (W.QUAY.cy - o.y) * Math.sin(o.psi);
    expect(side()).toBeCloseTo(o.B / 2, 3);
    g.tidePreset = 'baixamar'; run(300);
    expect(side()).toBeCloseTo(o.B / 2, 3);
    expect(W.QUAY.tx).toBeCloseTo(Math.sin(o.psi), 6);
  });
  it('encostar devagar nas defensas e passar as espias conclui o transbordo', () => {
    const { g, run } = beside(6, 0.1);
    // amarra assim que a proa encosta, como se faz: não dá para ficar esperando encostado
    for (let i = 0; i < 400 && g.status === 'running' && g.berth().bow > 4; i++) g.update(0.1);
    expect(g.status).toBe('running');
    expect(g.ledger.contact).toBe(0);
    g.moor(); run(500);
    console.log('contrabordo:', g.result?.title, g.result?.detail, JSON.stringify(g.berth()));
    expect(g.result?.ok).toBe(true);
    expect(g.result?.title).toBe('Navio a contrabordo');
  });
  it('bater de proa na popa dele, fora das defensas, é abalroamento', () => {
    const { g, run } = beside(200);
    const o = g.sts!, s = g.s;
    s.x = o.x - Math.sin(o.psi) * (o.L / 2 + 120); s.y = o.y - Math.cos(o.psi) * (o.L / 2 + 120); s.psi = o.psi; s.u = 2; s.telegraph = s.telAck = 6; s.n = 0.4;
    run(200);
    expect(g.result?.title).toBe('Abalroamento');
  });
  it('chegar rápido de lado amassa os dois navios', () => {
    const { g, run } = beside(8, 0.9);
    run(60);
    expect(g.result?.ok).toBe(false);
    expect(g.result?.title).toMatch(/Avaria grave|Abalroamento/);
  });
});
