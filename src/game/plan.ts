// Plano de viagem ("plano de bordo"): rumos, velocidades e, principalmente, ONDE começar cada guinada
// e quando quebrá-la. Os números saem de simular este navio, com a carga desta viagem.
import { D2R, Env, KN, makeState, ShipParams, stepShip, TELEGRAPH_LABELS } from '../sim/ship';
import * as W from '../world/santos';
import { BERTH } from './game';
import type { Game } from './game';

export interface PlanTurn {
  s: number;          // onde começar a guinada, ao longo do canal
  x: number; y: number;
  helm: number;       // graus, negativo = bombordo
  to: number;         // rumo novo
  counter: number;    // quebrar a guinada com leme contrário quando faltarem estes graus
  before: number;     // metros antes do vértice da curva
  buoy: number;       // índice da boia de referência, ou -1
  ref: string;        // "com a boia 8 pelo través", "120 m antes da boia 8"
}
export interface PlanStep {
  title: string;
  s: number;          // início da perna ao longo do canal (ou -1 fora do canal)
  course?: number; dist?: number; tel?: number; stw?: number; sog?: number; min?: number;
  action: string;     // o que fazer ao chegar ao fim desta perna
  turn?: PlanTurn;
}
export interface PlanCall { where: string; what: string; why: string }
export interface Plan { title: string; steps: PlanStep[]; track: [number, number][]; notes: string[]; stopAt: number; asternAt: number; calls: PlanCall[] }

const DT = 0.1, Z = { X: 0, Y: 0, N: 0 };
const wrapDeg = (a: number) => ((a + 540) % 360) - 180;
const fmtCourse = (c: number) => String(Math.round((c + 360) % 360) % 360).padStart(3, '0') + '°';
const round10 = (v: number) => Math.round(v / 10) * 10;
const calm = (depth: number): Env => ({ depth: () => depth, current: () => [0, 0], windFrom: 0, windSpeed: 0 });

/** Velocidade na água que o navio estabiliza em cada posição do telégrafo. */
export function steadySpeed(p: ShipParams, tel: number, depth = 14) {
  const s = makeState(0, 0, 0, 4, tel), env = calm(depth);
  for (let t = 0; t < 900; t += DT) stepShip(s, p, env, DT, Z);
  return s.u;
}

/** Simula uma guinada de `delta` graus com `helm` de leme e devolve onde começar e quando quebrar. */
export function simTurn(p: ShipParams, tel: number, delta: number, helm: number, depth = 14) {
  const sign = Math.sign(delta), D = Math.abs(delta), env = calm(depth), u0 = steadySpeed(p, tel, depth);
  const run = (lead: number) => {
    const s = makeState(0, 0, 0, 0, tel); s.u = u0; s.n = s.n; let phase = 0, settle = 0, h = 0, prev = 0;
    s.rudderOrder = sign * helm * D2R; s.helmTimer = p.helmDelay;
    for (let t = 0; t < 900; t += DT) {
      stepShip(s, p, env, DT, Z);
      let d = s.psi - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; h += d; prev = s.psi;
      const turned = sign * h / D2R;
      if (phase === 0 && D - turned <= lead) { phase = 1; s.rudderOrder = -sign * helm * D2R; s.helmTimer = p.helmDelay; }
      else if (phase === 1 && sign * s.r <= 0.0002) { phase = 2; s.rudderOrder = 0; s.helmTimer = p.helmDelay; }
      else if (phase === 2 && (settle += DT) > 40) return { final: turned, x: s.x, y: s.y, time: t };
    }
    return { final: sign * h / D2R, x: s.x, y: s.y, time: 900 };
  };
  let lo = 0, hi = D, best = run(D / 3), lead = D / 3;
  for (let i = 0; i < 9; i++) {
    lead = (lo + hi) / 2; best = run(lead);
    if (best.final > D) lo = lead; else hi = lead;   // passou do rumo: quebrar mais cedo
  }
  // o navio termina sobre o rumo novo; quanto antes do vértice a guinada tem de começar
  const dr = D * D2R, before = best.y - Math.abs(best.x) / Math.tan(dr);
  return { before: Math.max(0, before), counter: Math.max(1, Math.round(lead)), time: best.time, error: best.final - D };
}

/** Distância para o navio perder seguimento: só parando a máquina até 1 nó, e depois com ré até parar. */
export function simStop(p: ShipParams, tel: number, depth = 12) {
  const env = calm(depth), s = makeState(0, 0, 0, 0, tel); s.u = steadySpeed(p, tel, depth);
  s.telegraph = 4; s.ackTimer = p.ackDelay; let coast = 0;
  for (let t = 0; t < 1800 && s.u > 1 * KN; t += DT) stepShip(s, p, env, DT, Z);
  coast = s.y; s.telegraph = 2; s.ackTimer = p.ackDelay;
  for (let t = 0; t < 900 && s.u > 0.05; t += DT) stepShip(s, p, env, DT, Z);
  return { coast, astern: s.y - coast };
}

const buoyS = W.BUOYS.map(b => ({ s: W.nearest(b.x, b.y).s, id: b.id, kind: b.kind }));
function reference(s: number): { buoy: number; ref: string } {
  let best = -1, bd = 1e9;
  buoyS.forEach((b, i) => { if (b.kind !== 'danger' && Math.abs(b.s - s) < bd) { bd = Math.abs(b.s - s); best = i; } });
  if (best < 0 || bd > 450) return { buoy: -1, ref: 'sem boia por perto' };
  const b = buoyS[best], d = b.s - s, name = `boia ${b.id} (${b.kind === 'red' ? 'encarnada, a boreste' : 'verde, a bombordo'})`;
  return { buoy: best, ref: Math.abs(d) < 30 ? `com a ${name} pelo través` : d > 0 ? `${round10(d)} m antes da ${name}` : `${round10(-d)} m depois da ${name}` };
}

/** Monta o plano da viagem que acabou de ser preparada em `g`. */
export function makePlan(g: Game): Plan {
  const p = g.p, depth = W.DREDGED_DEPTH + g.tide.height;
  if (g.scenario !== 'entrada') return sidePlan(g);
  const start = W.nearest(g.s.x, g.s.y).s, Q = W.QUAY.base ?? W.QUAY;
  const end = g.headOut ? W.BASIN.s : Q.s;
  const telAt = (s: number) => (s < W.S_MOUTH - 500 ? 7 : end - s < 700 ? 5 : 6);
  // pontos do plano: curvas do canal e mudanças de máquina
  const pts: { s: number; kind: 'turn' | 'speed'; to?: number }[] = [];
  // curvas de menos de 4 graus não são manobra: o timoneiro acerta no rumo
  for (const t of W.TURNS) if (t.s > start + 50 && t.s < end - 60 && Math.abs(wrapDeg(t.course - W.courseAt(t.s - 5))) >= 4) pts.push({ s: t.s, kind: 'turn', to: t.course });
  for (const s of [W.S_MOUTH - 500, end - 700]) if (s > start + 50 && s < end - 60) pts.push({ s, kind: 'speed' });
  pts.sort((a, b) => a.s - b.s);

  const steps: PlanStep[] = [], track: [number, number][] = [W.pointAt(start, 0)];
  let from = start, name = 'Partida';
  const stop = simStop(p, 5, 11 + g.tide.height);
  for (let i = 0; i <= pts.length; i++) {
    const pt = pts[i], to = pt ? pt.s : end, mid = (from + to) / 2;
    const course = W.courseAt(mid), tel = telAt(mid), stw = steadySpeed(p, tel, depth);
    const [mx, my] = W.pointAt(mid, 0), [ce, cn] = g.env.current(mx, my);
    const sog = Math.max(0.2, stw + ce * Math.sin(course * D2R) + cn * Math.cos(course * D2R));
    const step: PlanStep = { title: name, s: from, course, dist: to - from, tel, stw, sog, min: (to - from) / sog / 60, action: '' };
    if (!pt) {
      step.action = g.headOut ? 'Parar na bacia de evolução e girar por boreste até a proa apontar para o mar.'
        : `Chegar paralelo ao cais, que fica a ${W.QUAY.side > 0 ? 'bombordo' : 'boreste'}, em ângulo raso.`;
    } else if (pt.kind === 'speed') {
      step.action = `Reduzir para ${TELEGRAPH_LABELS[telAt(pt.s + 10)].toLowerCase()}.`;
      name = pt.s < W.S_MOUTH ? 'Aproximação da barra' : 'Chegada ao berço';
    } else {
      const delta = wrapDeg(pt.to! - course), helm = Math.abs(delta) < 14 ? 10 : Math.abs(delta) < 36 ? 15 : 20;
      const sim = simTurn(p, tel, delta, helm, depth), ws = pt.s - sim.before, [x, y] = W.pointAt(ws, 0), r = reference(ws);
      step.turn = { s: ws, x, y, helm: Math.sign(delta) * helm, to: pt.to!, counter: sim.counter, before: sim.before, buoy: r.buoy, ref: r.ref };
      step.action = `Guinar para ${fmtCourse(pt.to!)}: leme ${delta < 0 ? 'BB' : 'BE'} ${helm}, ${r.ref} (${round10(sim.before)} m antes da curva). Quebrar com leme contrário quando faltarem ${sim.counter}°.`;
      name = `Depois da curva para ${fmtCourse(pt.to!)}`;
    }
    steps.push(step); track.push(W.pointAt(to, 0)); from = to;
  }
  const notes = [
    `Navio: ${p.L} m, calado ${p.T.toFixed(1).replace('.', ',')} m, ${(p.mass / 1e6).toFixed(1).replace('.', ',')} mil t. Fundo do canal: ${depth.toFixed(1).replace('.', ',')} m com a maré de agora.`,
    `Parada: de muito devagar, pare a máquina a ${round10(stop.coast + stop.astern + 40)} m do meio do berço. Se ainda tiver mais de 1 nó a ${round10(stop.astern + 30)} m, devagar ré.`,
    `As velocidades no fundo já descontam a corrente de agora (${g.tide.flow > 0.1 ? 'vazante, pela proa' : g.tide.flow < -0.1 ? 'enchente, pela popa' : 'quase parada'}); ela muda com a maré.`,
    'Os pontos de guinada valem para o leme e a máquina do plano. Mais rápido ou com menos leme, comece antes.',
    `Atracação, velocidade no fundo por distância ao meio do berço: ${BERTH.profile.slice(0, 4).map(([d, k]) => `a ${d} m, ${String(k).replace('.', ',')} nó`).join('; ')}; encostar de lado a menos de ${String(BERTH.soft / KN).slice(0, 3).replace('.', ',')} nó. Com a proa a ${BERTH.bowMax} m das defensas e menos de ${(BERTH.speedMax / KN).toFixed(1).replace('.', ',')} nó, passe as espias (M): os cabos trazem o navio.`,
  ];
  // chamados de rádio: onde fazer cada um, e por quê ali
  const minsTo = (target: number) => { let m = 0; for (const st of steps) { const a = st.s, b = st.s + (st.dist ?? 0); if (target <= a) break; m += (st.min ?? 0) * Math.min(1, (target - a) / Math.max(1, b - a)); } return m; };
  const toHold = minsTo(W.HOLD_LINE_S), toBerth = minsTo(end), callRef = reference(W.CALL_POINT_S), holdRef = reference(W.HOLD_LINE_S);
  const calls: PlanCall[] = [
    { where: `No ponto de chamada: ${callRef.ref}, a ${round10(W.S_MOUTH - W.CALL_POINT_S)} m da barra`, what: 'Pedir entrada ao Santos VTS', why: `A resposta leva 20 s. Sem ela não se passa da linha de espera (${holdRef.ref}), que fica a ${Math.round(toHold)} min daqui.` },
    { where: 'Junto com o pedido de entrada', what: 'Pedir o prático, se quiser', why: `O padrão embarca em 5,5 min e o sênior em 3. Você chega à linha de espera em ${Math.round(toHold)} min: ${toHold < 5.5 ? 'com o padrão, reduza ou ele só embarca depois da barra' : 'dá tempo para qualquer um'}. Ele só embarca com o navio a até 7 nós.` },
    { where: 'Logo depois da autorização', what: 'Pedir ao navio do berço que largue', why: `Ele larga 6 min depois do pedido e leva 4 para abrir do cais; sem pedido, só aos 30 min. Você chega ao berço em ${Math.round(toBerth)} min. Quanto antes pedir, mais para fora do canal é o cruzamento.` },
    { where: 'Ao cruzar a barra', what: 'Chamar os rebocadores, se for usar', why: 'Chegam em 4 min, só da barra para dentro, e só passam o cabo com o navio a até 5 nós.' },
    { where: 'Com a draga a uns 800 m pela proa', what: 'Pedir passagem à draga', why: 'Ela leva uns 2 min para sair do canal dragado e fica fora por 8 min.' },
  ];
  if (g.sky !== 'dia') notes.push(g.sky === 'nevoeiro' ? 'Nevoeiro: limite de 6 nós. Conte as boias; cada guinada do plano está amarrada a uma.' : 'Noite: as boias de referência piscam na cor delas.');
  return { title: `Plano de viagem: ${Q.name}${g.headOut ? ', aproado ao mar' : ''}`, steps, track, notes, stopAt: stop.coast + stop.astern + 40, asternAt: stop.astern + 30, calls };
}

/** Fundeio e contrabordo: sem canal, o plano é a aproximação e a parada. */
function sidePlan(g: Game): Plan {
  const p = g.p, s = g.s, stop = simStop(p, 6, 17 + g.tide.height);
  const wind = (g.env.windFrom / D2R + 360) % 360;
  const tx = g.sts ? g.sts.x : W.ANCHORAGE.x, ty = g.sts ? g.sts.y : W.ANCHORAGE.y + 420;
  const brg = (Math.atan2(tx - s.x, ty - s.y) / D2R + 360) % 360, dist = Math.hypot(tx - s.x, ty - s.y);
  const stw = steadySpeed(p, 6, 17);
  const steps: PlanStep[] = g.sts ? [
    { title: 'Aproximação', s: -1, course: g.sts.psi / D2R, dist, tel: 6, stw, sog: stw, min: dist / stw / 60, action: `Vir pela popa do ${g.sts.name}, no mesmo rumo dele (${fmtCourse(g.sts.psi / D2R)}), abrindo 40 m para o boreste dele.` },
    { title: 'Emparelhar', s: -1, tel: 5, action: `Reduzir para muito devagar a ${round10(stop.coast + 150)} m da popa dele. Parar a máquina ao passar a popa.` },
    { title: 'Encostar', s: -1, tel: 4, action: 'Fechar devagar, com a proa um pouco para dentro. Tocar as defensas a menos de 0,4 nó; com a proa a 15 m já dá para passar as espias.' },
  ] : [
    { title: 'Rumo ao fundeadouro', s: -1, course: brg, dist, tel: 6, stw, sog: stw, min: dist / stw / 60, action: 'Ponto sugerido: a parte norte do círculo, a mais de 280 m do ferro de cada navio.' },
    { title: 'Aproar ao vento', s: -1, course: wind, tel: 5, action: `Chegar ao ponto com a proa em ${fmtCourse(wind)}, de onde vem o vento. O navio para mais fácil e o ferro unha melhor.` },
    { title: 'Parar e largar', s: -1, tel: 4, action: `Parar a máquina a ${round10(stop.coast)} m do ponto e dar devagar ré a ${round10(stop.astern + 20)} m. Largar o ferro com menos de 0,5 nó.` },
  ];
  return {
    title: g.sts ? `Plano: a contrabordo do ${g.sts.name}` : 'Plano de fundeio', steps, track: [[s.x, s.y], [tx, ty]],
    notes: [`Navio: ${p.L} m, calado ${p.T.toFixed(1).replace('.', ',')} m. Vento de ${fmtCourse(wind)}.`, g.sts ? 'Ele gira devagar com o vento: confira o rumo dele antes de fechar.' : 'Com 4 quartéis em 17 m de fundo, o navio varre uns 200 m em volta do ferro.'],
    stopAt: stop.coast, asternAt: stop.astern, calls: [],
  };
}
