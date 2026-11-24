// Carreira: dinheiro, contratos, oficina (peças) e tripulação. Estilo "Top Gear": cada compra muda o navio.
import { ShipClass, ShipParams, SHIPS } from '../sim/ship';
import { TidePreset } from '../world/tide';

export type PartId = 'engine' | 'rudder' | 'air' | 'thruster' | 'gps' | 'rot' | 'doppler' | 'radar' | 'ecdis';
export type CrewId = 'helm' | 'engineer' | 'mate';

export interface Level { name: string; price: number; salary?: number; effect: string }
/** Nível 0 é o que vem com o navio; cada nível seguinte é comprado em ordem. */
export const PARTS: Record<PartId, { label: string; group: 'Máquina e governo' | 'Instrumentos'; levels: Level[] }> = {
  engine: { label: 'Máquina principal', group: 'Máquina e governo', levels: [
    { name: 'Diesel velho de fábrica', price: 0, effect: 'Meia força em 47 s; inverter leva 15 s' },
    { name: 'Injeção e turbina revisadas', price: 12000, effect: 'Sobe de rotação 40% mais rápido; inverter em 11 s' },
    { name: 'Motor novo', price: 35000, effect: '+25% de empuxo, sobe 80% mais rápido; inverter em 8 s' },
  ] },
  rudder: { label: 'Máquina do leme', group: 'Máquina e governo', levels: [
    { name: 'Uma bomba hidráulica', price: 0, effect: 'Leme a 1,8°/s' },
    { name: 'Segunda bomba', price: 8000, effect: 'Leme a 2,6°/s' },
    { name: 'Leme de alto desempenho', price: 22000, effect: 'Leme a 3,0°/s e 35% mais força' },
  ] },
  air: { label: 'Ar de partida', group: 'Máquina e governo', levels: [
    { name: 'Duas garrafas', price: 0, effect: '5 partidas; repõe uma a cada 90 s' },
    { name: 'Garrafas extras e compressor novo', price: 5000, effect: '8 partidas; repõe uma a cada 55 s' },
  ] },
  thruster: { label: 'Impelidor de proa', group: 'Máquina e governo', levels: [
    { name: 'Não tem', price: 0, effect: 'Sem controle lateral da proa' },
    { name: 'Impelidor de 35 kN', price: 30000, effect: 'Gira a proa com o navio quase parado' },
    { name: 'Impelidor de 60 kN', price: 25000, effect: 'Quase o dobro de força' },
  ] },
  gps: { label: 'GPS', group: 'Instrumentos', levels: [
    { name: 'Não tem', price: 0, effect: 'Posição só por marcação visual' },
    { name: 'Receptor GPS', price: 4000, effect: 'Velocidade e rumo no fundo; posição na carta' },
  ] },
  rot: { label: 'Indicador de guinada', group: 'Instrumentos', levels: [
    { name: 'Não tem', price: 0, effect: 'Guinada só pela agulha' },
    { name: 'Indicador de taxa de guinada', price: 3000, effect: 'Mostra a guinada em graus por minuto' },
  ] },
  doppler: { label: 'Doppler de atracação', group: 'Instrumentos', levels: [
    { name: 'Não tem', price: 0, effect: 'Distância e velocidade ao cais só pelo rádio da proa' },
    { name: 'Doppler de dois eixos', price: 9000, effect: 'Velocidade lateral da proa e da popa' },
  ] },
  radar: { label: 'Radar', group: 'Instrumentos', levels: [
    { name: 'Não tem', price: 0, effect: 'Tráfego só à vista' },
    { name: 'Radar banda X', price: 15000, effect: 'Costa, boias e navios até 2 milhas' },
  ] },
  ecdis: { label: 'ECDIS', group: 'Instrumentos', levels: [
    { name: 'Não tem', price: 0, effect: 'Só a carta de papel' },
    { name: 'Carta eletrônica com AIS', price: 20000, effect: 'Navio na carta, previsão de 3 min, próxima curva e alvos AIS' },
  ] },
};
export const CREW: Record<CrewId, { label: string; levels: Level[] }> = {
  helm: { label: 'Timoneiro', levels: [
    { name: 'Moço de convés', price: 0, salary: 0, effect: 'Leva 2 s para começar a cumprir a ordem de leme' },
    { name: 'Timoneiro experiente', price: 6000, salary: 800, effect: 'Cumpre em 1,2 s' },
    { name: 'Mestre', price: 15000, salary: 1500, effect: 'Cumpre em 0,6 s' },
  ] },
  engineer: { label: 'Chefe de máquinas', levels: [
    { name: 'Segundo maquinista', price: 0, salary: 0, effect: 'Leva 6 s para atender o telégrafo' },
    { name: 'Chefe experiente', price: 7000, salary: 900, effect: 'Atende em 4 s; 30% menos desgaste' },
    { name: 'Chefe de primeira', price: 18000, salary: 1800, effect: 'Atende em 2,5 s; 60% menos desgaste' },
  ] },
  mate: { label: 'Imediato', levels: [
    { name: 'Piloto recém-formado', price: 0, salary: 0, effect: 'Avisa pouca água com 1,5 m sob o casco' },
    { name: 'Imediato experiente', price: 6000, salary: 800, effect: 'Avisa com 2,5 m e antes do limite de velocidade' },
    { name: 'Imediato de primeira', price: 14000, salary: 1400, effect: 'Avisa com 3,5 m; amarra em metade do tempo' },
  ] },
};

export interface Contract {
  id: string; title: string; cargo: string; scenario: 'entrada' | 'fundeio';
  load: number;          // 0 = em lastro, 1 = carregado: muda calado, massa e área de vento
  tide: TidePreset; freight: number; parMin: number; stars: number; note: string;
  sky?: Sky;
}
export type Sky = 'dia' | 'noite' | 'nevoeiro';
export const SKY: Record<Sky, { label: string; bonus: number; hint: string }> = {
  dia: { label: 'Dia claro', bonus: 1, hint: '' },
  noite: { label: 'Noite', bonus: 1.15, hint: 'Só se veem as luzes: boias piscando, luzes de navegação e a cidade.' },
  nevoeiro: { label: 'Nevoeiro', bonus: 1.3, hint: 'Visibilidade de 300 m e limite de 6 nós. Sem radar é quase às cegas.' },
};
export const CONTRACTS: Contract[] = [
  { id: 'fundeio', title: 'Aguardar berço', cargo: 'Em lastro', scenario: 'fundeio', load: 0.15, tide: 'vazante', freight: 3500, parMin: 40, stars: 1, note: 'Fundear entre os navios do fundeadouro. Navio leve: o vento manda.' },
  { id: 'meia', title: 'Fertilizante, meia carga', cargo: '1.600 t de fertilizante', scenario: 'entrada', load: 0.55, tide: 'vazante', freight: 16000, parMin: 75, stars: 2, note: 'Calado de 4,5 m e vazante pela proa: a entrada mais tranquila.' },
  { id: 'cheia', title: 'Fertilizante, carga completa', cargo: '2.900 t de fertilizante', scenario: 'entrada', load: 1, tide: 'vazante', freight: 28000, parMin: 75, stars: 3, note: 'Calado de 5,2 m: mais pesado e com menos água sob a quilha.' },
  { id: 'acucar', title: 'Açúcar na preamar', cargo: '2.900 t de açúcar', scenario: 'entrada', load: 1, tide: 'preamar', freight: 34000, parMin: 80, stars: 4, note: 'Corrente parada: o navio não freia sozinho e custa a governar devagar.' },
  { id: 'trigo', title: 'Trigo na baixa-mar', cargo: '2.900 t de trigo', scenario: 'entrada', load: 1, tide: 'baixamar', freight: 40000, parMin: 90, stars: 5, note: 'Pouca água nos bancos, e a maré vira para enchente no meio da viagem.' },
  { id: 'urgente', title: 'Carga urgente na enchente', cargo: '2.900 t de peças', scenario: 'entrada', load: 1, tide: 'enchente', freight: 48000, parMin: 70, stars: 5, note: 'Corrente a favor no berço. Sem rebocadores, é para poucos.' },
];

export interface Career { money: number; voyages: number; ship: ShipClass; rep: number; parts: Record<PartId, number>; crew: Record<CrewId, number> }
const KEY = 'barra-adentro.carreira';
export const newCareer = (): Career => ({
  money: 8000, voyages: 0, ship: 'coaster', rep: 0,
  parts: { engine: 0, rudder: 0, air: 0, thruster: 0, gps: 0, rot: 0, doppler: 0, radar: 0, ecdis: 0 },
  crew: { helm: 0, engineer: 0, mate: 0 },
});
export function loadCareer(): Career {
  const c = newCareer();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw) { c.money = +raw.money || 0; c.voyages = +raw.voyages || 0; c.rep = +raw.rep || 0; if (raw.ship in SHIPS) c.ship = raw.ship; Object.assign(c.parts, raw.parts); Object.assign(c.crew, raw.crew); }
  } catch { /* sem armazenamento */ }
  return c;
}
export function saveCareer(c: Career) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* sem armazenamento */ } }

/** Compra o próximo nível de uma peça ou contrata o próximo nível de um tripulante. */
export function buy(c: Career, kind: 'part' | 'crew', id: string): string | null {
  const table = kind === 'part' ? PARTS[id as PartId] : CREW[id as CrewId];
  const have = kind === 'part' ? c.parts[id as PartId] : c.crew[id as CrewId];
  const next = table.levels[have + 1];
  if (!next) return 'Já está no melhor nível.';
  if (c.money < next.price) return `Faltam R$ ${(next.price - c.money).toLocaleString('pt-BR')}.`;
  c.money -= next.price;
  if (kind === 'part') c.parts[id as PartId]++; else c.crew[id as CrewId]++;
  return null;
}
export const salaries = (c: Career) => (Object.keys(CREW) as CrewId[]).reduce((a, k) => a + (CREW[k].levels[c.crew[k]].salary ?? 0), 0);

/** Aplica peças e tripulação aos parâmetros do navio. */
export function applyCareer(p: ShipParams, c: Career) {
  const e = c.parts.engine, r = c.parts.rudder;
  p.nUp *= [1, 1.4, 1.8][e]; p.nDown *= [1, 1.3, 1.6][e]; p.nUpHigh *= [1, 1.4, 1.8][e]; p.revDelay = [15, 11, 8][e]; p.Tb *= [1, 1, 1.25][e];
  p.rudderRate *= [1, 2.6 / 1.8, 3.0 / 1.8][r]; p.rudderCL *= [1, 1, 1.35][r];
  if (c.parts.air) { p.airStarts = 8; p.airRefill = 1 / 55; }
  p.thrusterMax = [0, 35e3, 60e3][c.parts.thruster] * (p.L / 90) ** 1.5;
  p.helmDelay = [2, 1.2, 0.6][c.crew.helm];
  p.ackDelay = [6, 4, 2.5][c.crew.engineer];
}
export const wearFactor = (c: Career) => [1, 0.7, 0.4][c.crew.engineer];
export const mateLead = (c: Career) => [0, 1, 2][c.crew.mate];          // metros a mais de antecedência no aviso de pouca água
export const equipOf = (c: Career) => ({
  gps: c.parts.gps > 0, rot: c.parts.rot > 0, radar: c.parts.radar > 0, ecdis: c.parts.ecdis > 0, doppler: c.parts.doppler > 0, thruster: c.parts.thruster > 0,
});
/** Quem vai embora quando a tripulação perde a confiança: o melhor contratado. */
export function bestHired(c: Career): CrewId | null {
  let best: CrewId | null = null;
  for (const k of Object.keys(CREW) as CrewId[]) if (c.crew[k] > 0 && (!best || CREW[k].levels[c.crew[k]].price > CREW[best].levels[c.crew[best]].price)) best = k;
  return best;
}

// ------------------------------------------------------------------ navios, reputação e ofertas

/** Quanto o frete cresce com o navio. */
export const FREIGHT_FACTOR: Record<ShipClass, number> = { coaster: 1, handy: 2.6 };
/** Reputação mínima para o armador confiar um navio maior. */
export const SHIP_REP: Record<ShipClass, number> = { coaster: 0, handy: 25 };
const RESALE = 0.6;

/** Estrelas que o mercado confia a este comandante: começa em 2 e sobe uma a cada 10 de reputação. */
export const maxStars = (c: Career) => Math.min(5, 2 + Math.floor(c.rep / 10));
export const repFor = (stars: number) => Math.max(0, (stars - 2) * 10);

const CARGOES = ['fertilizante', 'açúcar', 'trigo', 'sal', 'soja', 'bobinas de aço', 'celulose'];
/** Contratos oferecidos neste porto: mudam de carga e de frete a cada viagem, e dependem do navio. */
export function offers(c: Career): Contract[] {
  let seed = (c.voyages + 1) * 9973 + (c.ship === 'handy' ? 17 : 3);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ship = SHIPS[c.ship];
  return CONTRACTS.map(t => {
    const swing = 0.9 + rnd() * 0.25, name = CARGOES[Math.floor(rnd() * CARGOES.length)];
    if (t.scenario === 'fundeio') return { ...t, freight: Math.round(t.freight * FREIGHT_FACTOR[c.ship] * swing / 100) * 100 };
    const tons = Math.round(t.load * ship.capacity / 100) * 100;
    // contratos de três estrelas ou mais podem cair à noite ou com nevoeiro, pagando mais
    const roll = rnd(), sky: Sky = t.stars >= 4 && roll < 0.3 ? 'nevoeiro' : t.stars >= 3 && roll < 0.6 ? 'noite' : 'dia';
    return {
      ...t, sky, cargo: `${tons.toLocaleString('pt-BR')} t de ${name}`,
      title: t.title.replace(/^(Fertilizante|Açúcar|Trigo)/, name[0].toUpperCase() + name.slice(1)),
      freight: Math.round(t.freight * FREIGHT_FACTOR[c.ship] * swing * SKY[sky].bonus / 100) * 100,
      parMin: t.parMin + (c.ship === 'handy' ? 15 : 0) + (sky === 'nevoeiro' ? 10 : 0),
    };
  });
}

/** Troca de navio: o antigo entra como parte do pagamento; máquina e governo ficam com ele, instrumentos e tripulação vão junto. */
export function shipCost(c: Career, cls: ShipClass) { return SHIPS[cls].price - Math.round(SHIPS[c.ship].price * RESALE); }
export function buyShip(c: Career, cls: ShipClass): string | null {
  if (cls === c.ship) return 'Este já é o seu navio.';
  if (c.rep < SHIP_REP[cls]) return `O armador pede reputação ${SHIP_REP[cls]}; a sua é ${Math.round(c.rep)}.`;
  const cost = shipCost(c, cls);
  if (c.money < cost) return `Faltam R$ ${(cost - c.money).toLocaleString('pt-BR')}.`;
  c.money -= cost; c.ship = cls;
  c.parts.engine = c.parts.rudder = c.parts.air = c.parts.thruster = 0;
  return null;
}
/** Reputação depois de uma viagem contratada. */
export function reputation(c: Career, ct: Contract, ok: boolean, clean: boolean) {
  const d = ok ? ct.stars * 3 + (clean ? 2 : 0) : -6;
  c.rep = Math.max(0, Math.min(100, c.rep + d));
  return d;
}
