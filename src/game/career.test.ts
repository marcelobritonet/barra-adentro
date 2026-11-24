import { describe, expect, it } from 'vitest';
import { makeCoaster } from '../sim/ship';
import { applyCareer, buy, CONTRACTS, equipOf, newCareer, PARTS, salaries } from './career';
import { Game } from './game';

describe('carreira', () => {
  it('navio de fábrica não muda com a carreira zerada', () => {
    const a = makeCoaster(1), b = makeCoaster(1); applyCareer(b, newCareer());
    expect(b.nUp).toBe(a.nUp); expect(b.rudderRate).toBeCloseTo(a.rudderRate); expect(b.ackDelay).toBe(6); expect(b.helmDelay).toBe(2);
    expect(b.thrusterMax).toBe(0);
    expect(Object.values(equipOf(newCareer())).some(Boolean)).toBe(false);
  });
  it('comprar exige dinheiro, desconta o preço e sobe um nível por vez', () => {
    const c = newCareer();
    expect(buy(c, 'part', 'engine')).toMatch(/Faltam/);
    c.money = 50000;
    expect(buy(c, 'part', 'engine')).toBeNull();
    expect(c.parts.engine).toBe(1); expect(c.money).toBe(50000 - PARTS.engine.levels[1].price);
    expect(buy(c, 'part', 'engine')).toBeNull();
    expect(buy(c, 'part', 'engine')).toMatch(/melhor nível/);
  });
  it('peças e tripulação mudam o navio de verdade', () => {
    const c = newCareer(); c.parts.engine = 2; c.parts.rudder = 2; c.parts.thruster = 1; c.parts.air = 1; c.crew.helm = 2; c.crew.engineer = 2;
    const base = makeCoaster(1), p = makeCoaster(1); applyCareer(p, c);
    expect(p.Tb).toBeGreaterThan(base.Tb); expect(p.nUp).toBeGreaterThan(base.nUp * 1.7); expect(p.revDelay).toBe(8);
    expect(p.rudderRate).toBeGreaterThan(base.rudderRate * 1.6); expect(p.rudderCL).toBeGreaterThan(base.rudderCL);
    expect(p.thrusterMax).toBe(35e3); expect(p.airStarts).toBe(8);
    expect(p.helmDelay).toBe(0.6); expect(p.ackDelay).toBe(2.5);
    expect(salaries(c)).toBe(1500 + 1800);
    expect(equipOf(c).thruster).toBe(true);
  });
  it('o contrato define carga, calado, maré e frete; o resultado entra no caixa', () => {
    const g = new Game(); g.trust = 0;
    g.contract = CONTRACTS.find(c => c.id === 'meia')!; g.start('entrada');
    expect(g.p.T).toBeCloseTo(3.6 + 1.6 * 0.55); expect(g.p.mass).toBeLessThan(makeCoaster(1).mass);
    g.contract = CONTRACTS.find(c => c.id === 'fundeio')!; g.start('fundeio');
    expect(g.tidePreset).toBe('vazante');
    const money0 = g.career.money;
    const s = g.s; s.x = -2100; s.y = -3180; s.psi = 2.8; s.u = 0; s.stw = 0; s.telegraph = s.telAck = 4; s.n = 0;
    g.letGoAnchor(); g.warp = 8; for (let i = 0; i < 700 && g.status === 'running'; i++) g.update(0.1);
    expect(g.result?.ok).toBe(true);
    expect(g.result!.lines[0]).toEqual(['Frete: Em lastro', 3500]);
    expect(g.career.money).toBe(money0 + g.result!.total);
    expect(g.career.voyages).toBe(1);
  });
  it('com a confiança no fundo, o melhor tripulante contratado vai embora', () => {
    const g = new Game(); g.career.crew.engineer = 2; g.career.crew.helm = 1; g.trust = -50;
    g.start('entrada'); g.s.x = -1000; g.s.y = -1500; g.warp = 8; // em cima do Banco de Oeste
    for (let i = 0; i < 200 && g.status === 'running'; i++) g.update(0.1);
    expect(g.result?.ok).toBe(false); expect(g.result?.left).toBe(true);
    expect(g.career.crew.engineer).toBe(0); expect(g.career.crew.helm).toBe(1);
    expect(g.result!.lines.some(l => l[0].includes('Chefe de primeira pediu desembarque'))).toBe(true);
  });
  it('no modo livre a carreira não mexe no navio nem no caixa', () => {
    const g = new Game(); g.free = true; g.career.parts.engine = 2; g.equip.radar = true; const m = g.career.money;
    g.start('entrada');
    expect(g.p.revDelay).toBe(15); expect(g.equip.radar).toBe(true);
    g.s.x = -1000; g.s.y = -1500; g.warp = 8; for (let i = 0; i < 200 && g.status === 'running'; i++) g.update(0.1);
    expect(g.status).toBe('done');
    expect(g.career.money).toBe(m);
  });
});
