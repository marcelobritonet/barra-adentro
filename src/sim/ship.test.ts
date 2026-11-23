import { describe, expect, it } from 'vitest';
import { D2R, Env, KN, makeCoaster, makeState, ShipState, stepShip, TELEGRAPH } from './ship';

const DT = 0.05;
const sea = (depth = 200, windSpeed = 0, windFromDeg = 0): Env => ({
  depth: () => depth, current: () => [0, 0], windFrom: windFromDeg * D2R, windSpeed,
});
const p = makeCoaster(1);
const run = (s: ShipState, env: Env, seconds: number, each?: (t: number) => void) => {
  for (let t = 0; t < seconds; t += DT) { stepShip(s, p, env, DT, { X: 0, Y: 0, N: 0 }); each?.(t); }
};
const cruising = (env: Env) => { const s = makeState(0, 0, 0, 9.5, 8); run(s, env, 400); return s; };

function turningCircle(env: Env) {
  const s = cruising(env);
  const x0 = s.x;
  s.rudderOrder = 35 * D2R;
  let maxX = 0, turned = 0, prev = s.psi, tactical = 0;
  run(s, env, 600, () => {
    let d = s.psi - prev; if (d < -Math.PI) d += 2 * Math.PI; if (d > Math.PI) d -= 2 * Math.PI;
    turned += d; prev = s.psi;
    maxX = Math.max(maxX, s.x - x0);
    if (!tactical && turned >= Math.PI) tactical = s.x - x0;
  });
  return { tactical: tactical / p.L, speedKn: Math.hypot(s.u, s.v) / KN };
}

describe('costeiro de 90 m', () => {
  it('toda força dá cerca de 11 nós', () => {
    const s = cruising(sea());
    console.log('velocidade máxima', (s.u / KN).toFixed(2), 'nós');
    expect(s.u / KN).toBeGreaterThan(8.5); expect(s.u / KN).toBeLessThan(10.5);
  });

  it('mantém o rumo com leme a meio', () => {
    const s = cruising(sea());
    s.r = 0.5 * D2R; const h0 = s.psi;
    run(s, sea(), 200);
    expect(Math.abs(s.r)).toBeLessThan(0.02 * D2R);
    expect(Math.abs(s.psi - h0)).toBeLessThan(15 * D2R);
  });

  it('curva de giro com diâmetro tático de 3 a 4,5 comprimentos', () => {
    const c = turningCircle(sea());
    console.log('diâmetro tático', c.tactical.toFixed(2), 'L; velocidade na curva', c.speedKn.toFixed(1), 'nós');
    expect(c.tactical).toBeGreaterThan(3); expect(c.tactical).toBeLessThan(4.5);
    expect(c.speedKn).toBeLessThan(8.5);
  });

  it('em água rasa a curva alarga', () => {
    const deep = turningCircle(sea()), shallow = turningCircle(sea(p.T * 1.25));
    console.log('raso', shallow.tactical.toFixed(2), 'L');
    expect(shallow.tactical).toBeGreaterThan(deep.tactical * 1.25);
  });

  it('a máquina demora a responder', () => {
    const s = makeState(0, 0, 0, 0, 4);
    s.telegraph = 8;
    run(s, sea(), 5);
    expect(s.n).toBeLessThan(0.4);
    run(s, sea(), 30);
    expect(s.n).toBeLessThan(0.9); // de meia para toda força a carga sobe devagar
    run(s, sea(), 120);
    expect(s.n).toBe(TELEGRAPH[8]);
  });

  it('toda força ré para o navio em 4 a 9 comprimentos', () => {
    const s = cruising(sea());
    const y0 = s.y; s.telegraph = 0;
    let t = 0;
    while (s.u > 0 && t < 900) { stepShip(s, p, sea(), DT, { X: 0, Y: 0, N: 0 }); t += DT; }
    const d = Math.hypot(s.y - y0, s.x) / p.L;
    console.log('parada de emergência', d.toFixed(1), 'L em', t.toFixed(0), 's');
    expect(d).toBeGreaterThan(4); expect(d).toBeLessThan(9);
  });

  it('só parando a máquina, o navio segue por mais de 12 comprimentos', () => {
    const s = cruising(sea());
    const y0 = s.y; s.telegraph = 4;
    let t = 0;
    while (s.u > 1 * KN && t < 3000) { stepShip(s, p, sea(), DT, { X: 0, Y: 0, N: 0 }); t += DT; }
    const d = (s.y - y0) / p.L;
    console.log('até 1 nó sem máquina', d.toFixed(1), 'L em', (t / 60).toFixed(1), 'min');
    expect(d).toBeGreaterThan(12);
  });

  it('em ré a proa cai para boreste (hélice de passo direito)', () => {
    const s = makeState(0, 0, 0, 0, 4);
    s.telegraph = 1;
    run(s, sea(), 90);
    expect(s.u).toBeLessThan(0);
    expect(s.r).toBeGreaterThan(0);
  });

  it('parado, sem máquina, o leme não governa', () => {
    const s = makeState(0, 0, 0, 0, 4);
    s.rudderOrder = 35 * D2R;
    run(s, sea(), 60);
    expect(Math.abs(s.r)).toBeLessThan(0.01 * D2R);
  });

  it('parado, um toque de máquina com leme carregado gira o navio quase sem avançar', () => {
    const s = makeState(0, 0, 0, 0, 4);
    s.rudderOrder = 35 * D2R; s.telegraph = 7;
    run(s, sea(), 70);
    console.log('toque de máquina: guinada', (s.r / D2R).toFixed(2), '°/s, avanço', (s.u / KN).toFixed(1), 'nós');
    expect(s.r / D2R).toBeGreaterThan(0.4);
    expect(s.u / KN).toBeLessThan(4);
  });

  it('vento de través de 20 nós faz o navio parado abater a cerca de 0,5–1,2 nó', () => {
    const s = makeState(0, 0, 0, 0, 4);
    run(s, sea(200, 10, 270), 600);
    const drift = Math.hypot(s.u, s.v) / KN;
    console.log('abatimento', drift.toFixed(2), 'nós');
    expect(drift).toBeGreaterThan(0.4); expect(drift).toBeLessThan(1.3);
  });

  it('a ordem só é cumprida depois de repetida', () => {
    const s = makeState(0, 0, 0, 0, 4);
    s.telegraph = 6; s.ackTimer = p.ackDelay; s.rudderOrder = 20 * D2R; s.helmTimer = p.helmDelay;
    run(s, sea(), 0.9);
    expect(s.n).toBe(0); expect(s.rudder).toBe(0);
    run(s, sea(), 7);
    expect(s.n).toBeGreaterThan(0); expect(s.rudder).toBeGreaterThan(0);
  });

  it('partidas demais esgotam o ar e a máquina não parte', () => {
    const s = makeState(0, 0, 0, 0, 4);
    for (let i = 0; i < 5; i++) { s.telegraph = 5; run(s, sea(), 4); s.telegraph = 4; run(s, sea(), 6); }
    expect(s.starts).toBe(5);
    s.telegraph = 5; run(s, sea(), 5);
    expect(s.noAir).toBe(true); expect(s.n).toBe(0);
    run(s, sea(), 90); // compressores repõem
    expect(s.n).toBeGreaterThan(0);
  });

  it('a corrente carrega o navio parado', () => {
    const env: Env = { depth: () => 200, current: () => [0.5, 0], windFrom: 0, windSpeed: 0 };
    const s = makeState(0, 0, 0, 0, 4);
    for (let t = 0; t < 900; t += DT) stepShip(s, p, env, DT, { X: 0, Y: 0, N: 0 });
    expect(s.x).toBeGreaterThan(300);
    expect(Math.abs(s.stw)).toBeLessThan(0.05);
  });
});
