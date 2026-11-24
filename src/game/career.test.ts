import { describe, expect, it } from 'vitest';
import { makeCoaster } from '../sim/ship';
import { applyCareer, buy, buyShip, CONTRACTS, equipOf, maxStars, newCareer, offers, PARTS, reputation, salaries } from './career';
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

  it('reputação libera estrelas; ofertas mudam a cada viagem e crescem com o navio', () => {
    const c = newCareer();
    expect(maxStars(c)).toBe(2);
    const a = offers(c); c.voyages = 1; const b = offers(c);
    expect(a.map(x => x.freight)).not.toEqual(b.map(x => x.freight));
    expect(a.find(x => x.id === 'cheia')!.freight).toBeGreaterThan(28000 * 0.89);
    reputation(c, a.find(x => x.id === 'meia')!, true, true);
    expect(c.rep).toBe(8);
    c.rep = 30; expect(maxStars(c)).toBe(5);
    reputation(c, a[0], false, false); expect(c.rep).toBe(24);
    c.ship = 'handy';
    const big = offers(c).find(x => x.id === 'cheia')!;
    expect(big.freight).toBeGreaterThan(28000 * 2.3); expect(big.cargo).toContain('11.000 t');
  });
  it('comprar o graneleiro exige reputação e dinheiro, e zera máquina e governo', () => {
    const c = newCareer(); c.money = 200000; c.parts.engine = 2; c.parts.radar = 1; c.crew.helm = 1;
    expect(buyShip(c, 'handy')).toMatch(/reputação/);
    c.rep = 25;
    expect(buyShip(c, 'handy')).toBeNull();
    expect(c.ship).toBe('handy'); expect(c.money).toBe(50000);
    expect(c.parts.engine).toBe(0); expect(c.parts.radar).toBe(1); expect(c.crew.helm).toBe(1);
    const g = new Game(); g.career = c; g.start('entrada');
    expect(g.p.L).toBe(130); expect(g.geo.hull[0][0]).toBe(65); expect(g.tugs[0].xf).toBe(52);
  });
});
