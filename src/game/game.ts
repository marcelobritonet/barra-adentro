import { anchorForce, letGo, makeAnchor, SHACKLE } from '../sim/anchor';
import {
  BodyForce, bodyToWorld, D2R, Env, KN, makeCoaster, makeState, pointVelocity, ShipState,
  stepShip, TELEGRAPH, TELEGRAPH_LABELS, worldForceAt,
} from '../sim/ship';
import * as W from '../world/santos';
import { Pilot, PilotGrade, PILOTS } from './pilot';
import { makeTugs, TugMode } from './tugs';

export type Scenario = 'entrada' | 'fundeio';
export interface Msg { t: number; text: string; level: 'info' | 'warn' | 'bad' | 'pilot'; who: string }
export interface Result { ok: boolean; title: string; detail: string; lines: [string, number][]; total: number; trustBefore: number; trustAfter: number; left: boolean }

const TRUST_KEY = 'barra-adentro.confianca';
function loadTrust() { try { return Math.max(-100, Math.min(100, +(localStorage.getItem(TRUST_KEY) ?? 0) || 0)); } catch { return 0; } }
function saveTrust(v: number) { try { localStorage.setItem(TRUST_KEY, String(Math.round(v))); } catch { /* sem armazenamento */ } }

const DT = 0.05;
const HULL: [number, number][] = [
  [45, 0], [36, 5], [36, -5], [20, 7], [20, -7], [0, 7], [0, -7],
  [-25, 7], [-25, -7], [-42, 6], [-42, -6], [-45, 0],
];
const KQ = 4e5, CQ = 6e5, MU = 0.3;
const PAR_MIN: Record<Scenario, number> = { entrada: 75, fundeio: 40 };

export class Game {
  p = makeCoaster(1);
  s: ShipState = makeState(0, 0, 0);
  anchor = makeAnchor();
  env: Env;
  time = 0; warp = 1; paused = false;
  status: 'menu' | 'running' | 'done' = 'menu';
  scenario: Scenario = 'entrada';
  equip = { gps: false, rot: false };
  shackles = 4;
  msgs: Msg[] = [];
  result: Result | null = null;
  ledger = { fuel: 0, speeding: 0, buoys: 0, contact: 0, anchor: 0, pilot: 0, vts: 0, tugs: 0 };
  tugs = makeTugs();
  pilot = new Pilot();
  /** Autorização de entrada do VTS. */
  vts: 'none' | 'asked' | 'ok' = 'none';
  private vtsTimer = 0;
  hitBuoys = new Set<number>();
  mooring = 0;             // segundos restantes passando espias
  touching = false;
  ukcMin = 99;             // menor água sob o casco (proa, popa e bordos), m
  private acc = 0;
  private lastContact = -99;
  holdTime = 0;
  /** Confiança da tripulação no comandante: -100 a +100, começa em 0 e persiste entre viagens. */
  trust = loadTrust();
  trustNote = ''; trustNoteAt = -99;
  private trustStart = 0; private baseAck = 0; private baseHelm = 0;
  private telTimes: number[] = [];
  private anchorPhase = '';
  private berthSig = ''; private berthAt = -99;
  private said = new Map<string, number>();
  private windBase = 7; private windFromBase = 160 * D2R;

  constructor() {
    this.env = { depth: W.depth, current: (x, y) => W.current(x, y, 1), windFrom: this.windFromBase, windSpeed: this.windBase };
  }

  start(sc: Scenario) {
    this.scenario = sc;
    this.p = makeCoaster(1);
    if (sc === 'entrada') {
      const [x, y] = W.pointAt(W.S_MOUTH - 1500);
      const [x2, y2] = W.pointAt(W.S_MOUTH - 1400);
      this.s = makeState(x, y, Math.atan2(x2 - x, y2 - y) / D2R, 7, 7);
    } else {
      this.s = makeState(-700, -5100, 320, 5, 6);
    }
    this.anchor = makeAnchor();
    this.time = 0; this.warp = 1; this.paused = false; this.acc = 0;
    this.msgs = []; this.result = null; this.hitBuoys.clear();
    this.ledger = { fuel: 0, speeding: 0, buoys: 0, contact: 0, anchor: 0, pilot: 0, vts: 0, tugs: 0 };
    this.tugs = makeTugs();
    this.pilot = new Pilot(); this.vts = sc === 'entrada' ? 'none' : 'ok'; this.vtsTimer = 0;
    this.mooring = 0; this.holdTime = 0; this.anchorPhase = 'stowed'; this.berthSig = ''; this.berthAt = -99; this.said.clear(); this.lastContact = -99;
    this.status = 'running';
    this.trustStart = this.trust; this.trustNote = ''; this.trustNoteAt = -99; this.telTimes = [];
    this.baseAck = this.p.ackDelay; this.baseHelm = this.p.helmDelay;
    if (sc === 'entrada') {
      this.say('Imediato', 'Maré vazante, vento sueste. Precisamos da autorização do VTS antes da barra. Prático é opcional: chame pelo rádio se quiser.', 'info');
      this.say('Imediato', 'Berço no cais de bombordo, depois da segunda curva. Calado 5,2 m. Temos ar para 5 partidas de máquina.', 'info');
    } else {
      this.say('Capitania', 'Berço ocupado. Fundeie no fundeadouro a noroeste e aguarde.', 'info');
      this.say('Imediato', 'Fundo de 17 m. Sugiro 4 quartéis, aproado ao vento, quase parado.', 'info');
    }
  }

  say(who: string, text: string, level: Msg['level'] = 'info', key?: string, every = 20) {
    if (key) {
      const last = this.said.get(key);
      if (last !== undefined && this.time - last < every) return;
      this.said.set(key, this.time);
    }
    this.msgs.push({ t: this.time, text, level, who });
    if (this.msgs.length > 60) this.msgs.shift();
  }

  /** Tripulação confiante cumpre mais rápido; desconfiada hesita. 0,7 a 1,3. */
  get crewFactor() { return 1 - 0.3 * this.trust / 100; }
  resetTrust() { this.trust = 0; saveTrust(0); }
  private trustEvent(d: number, note: string, key?: string, every = 30) {
    if (key) {
      const last = this.said.get('tr:' + key);
      if (last !== undefined && this.time - last < every) return;
      this.said.set('tr:' + key, this.time);
    }
    this.trust = Math.max(-100, Math.min(100, this.trust + d));
    this.trustNote = (d > 0 ? '▲ ' : '▼ ') + note; this.trustNoteAt = this.time;
  }
  /** O tom da tripulação muda com a confiança. */
  private tone(text: string) {
    return this.trust > 40 ? text.replace(/\.$/, ', comandante.') : this.trust < -40 ? '… ' + text.toLowerCase() : text;
  }

  get sog() { return Math.hypot(this.s.u, this.s.v); }
  get cog() {
    const s = this.s, sin = Math.sin(s.psi), cos = Math.cos(s.psi);
    return (Math.atan2(s.u * sin + s.v * cos, s.u * cos - s.v * sin) + 2 * Math.PI) % (2 * Math.PI);
  }

  setTelegraph(i: number) {
    i = Math.max(0, Math.min(TELEGRAPH.length - 1, i));
    if (i !== this.s.telegraph && this.status === 'running') {
      if (this.s.telAck === this.s.telegraph) this.s.ackTimer = this.p.ackDelay;
      this.s.telegraph = i;
      this.say('Máquinas', this.tone(TELEGRAPH_LABELS[i][0] + TELEGRAPH_LABELS[i].slice(1).toLowerCase() + '.'), 'info');
      this.telTimes = this.telTimes.filter(t => this.time - t < 90); this.telTimes.push(this.time);
      if (this.telTimes.length > 6) this.trustEvent(-3, 'ordens de máquina demais', 'fidget', 60);
      if (i <= 1 && this.s.u > 2) this.trustEvent(-4, 'máquina a ré de emergência', 'crash', 120);
    }
  }
  setRudderDeg(d: number) {
    const s = this.s, o = Math.max(-35, Math.min(35, d)) * D2R;
    if (o === s.rudderOrder) return;
    if (s.helmAck === s.rudderOrder) s.helmTimer = this.p.helmDelay;
    s.rudderOrder = o;
  }

  callVTS() {
    if (this.status !== 'running' || this.scenario !== 'entrada' || this.vts !== 'none') return;
    this.vts = 'asked'; this.vtsTimer = 20;
    this.say('Maré Mansa', 'Santos VTS, Maré Mansa, 2 milhas da barra, calado 5,2. Solicito entrada.', 'info');
  }
  callPilot(grade: PilotGrade) {
    if (this.status !== 'running' || this.scenario !== 'entrada' || this.pilot.state !== 'none') return;
    this.say('Maré Mansa', `Praticagem, Maré Mansa. Solicito ${PILOTS[grade].label.toLowerCase()}.`, 'info');
    this.pilot.call(this, grade);
  }

  callTug(i: number) {
    if (this.status !== 'running' || this.scenario !== 'entrada' || this.tugs[i].state !== 'none') return;
    this.say('Maré Mansa', `Rebocadores, Maré Mansa. Solicito um rebocador na ${this.tugs[i].where}.`, 'info');
    this.tugs[i].call(this);
  }
  tugOrder(i: number, mode: TugMode, power?: number) { if (this.status === 'running') this.tugs[i].order(this, mode, power); }

  letGoAnchor() {
    if (this.status !== 'running') return;
    const a = this.anchor;
    if (a.state === 'lost') return this.say('Proa', 'Não temos mais ferro, comandante.', 'bad');
    if (a.state !== 'stowed') return;
    if (this.sog > 3 * KN) {
      a.state = 'lost'; this.ledger.anchor += 25000; this.trustEvent(-20, 'ferro perdido');
      return this.say('Proa', 'Largou com muito seguimento: a amarra partiu. Ferro perdido!', 'bad');
    }
    const [bx, by] = bodyToWorld(this.s, 42, 0);
    letGo(a, bx, by, this.shackles, this.env.depth(bx, by));
    this.say('Proa', `Ferro largado. Arriando ${this.shackles} quartéis.`, 'info');
  }
  heaveAnchor() {
    if (this.anchor.state === 'down') { this.anchor.state = 'heaving'; this.say('Proa', 'Virando o ferro.', 'info'); }
  }

  /** Situação do navio em relação ao berço. */
  berth() {
    const [ac] = W.quayLocal(this.s.x, this.s.y);
    const bow = W.quayLocal(...bodyToWorld(this.s, 36, -5))[1] - W.QUAY.fender;
    const stern = W.quayLocal(...bodyToWorld(this.s, -42, -6))[1] - W.QUAY.fender;
    return { along: ac, bow, stern };
  }
  moor() {
    if (this.status !== 'running' || this.scenario !== 'entrada' || this.mooring > 0) return;
    const b = this.berth();
    if (Math.abs(b.along) > W.QUAY.berthHalf) return this.say('Imediato', `Fora da posição: ${Math.abs(b.along).toFixed(0)} m ${b.along > 0 ? 'avante' : 'a ré'} do berço.`, 'warn');
    // a proa precisa estar encostada; a popa pode vir depois, virada pelos cabos
    if (b.bow > 8 || b.stern > 35) return this.say('Imediato', `Longe demais para passar espias: proa ${Math.max(0, b.bow).toFixed(0)} m (máx. 8), popa ${Math.max(0, b.stern).toFixed(0)} m (máx. 35).`, 'warn');
    if (this.sog > 0.25) return this.say('Imediato', 'Ainda com seguimento. Pare o navio antes de amarrar.', 'warn');
    this.mooring = 40 * this.crewFactor;
    this.setTelegraph(4);
    this.say('Imediato', b.stern > 8 ? 'Lançante de proa em terra. Virando a popa nos cabos.' : 'Passando espias. Lançante e espringue em terra.', 'info');
  }

  update(dtReal: number) {
    if (this.status !== 'running' || this.paused) return;
    this.acc += Math.min(dtReal, 0.1) * this.warp;
    while (this.acc >= DT && this.status === 'running') { this.acc -= DT; this.tick(); }
  }

  private tick() {
    const s = this.s, p = this.p, env = this.env;
    this.time += DT;
    env.windSpeed = this.windBase * (1 + 0.2 * Math.sin(this.time / 37) + 0.1 * Math.sin(this.time / 11 + 1));
    env.windFrom = this.windFromBase + 8 * D2R * Math.sin(this.time / 53);

    const cf = this.crewFactor;
    p.ackDelay = this.baseAck * cf; p.helmDelay = this.baseHelm * cf;

    if (this.vts === 'asked' && (this.vtsTimer -= DT) <= 0) {
      this.vts = 'ok';
      this.say('Santos VTS', `Maré Mansa, entrada autorizada. Canal livre, limite de ${W.SPEED_LIMIT_KN} nós da barra para dentro.`, 'info');
    }
    this.pilot.update(this, DT);

    const ext: BodyForce = { X: 0, Y: 0, N: 0 };

    // --- amarra
    const [bx, by] = bodyToWorld(s, 42, 0);
    const [bvx, bvy] = pointVelocity(s, 42, 0);
    const [fx, fy] = anchorForce(this.anchor, bx, by, bvx, bvy, Math.max(env.depth(bx, by), 1), DT);
    if (fx || fy) worldForceAt(s, fx, fy, 42, 0, ext);
    if (this.anchor.dragging) { this.say('Proa', 'O ferro está garrando!', 'warn', 'drag', 15); this.trustEvent(-3, 'ferro garrando', 'drag', 90); }
    {
      const a = this.anchor;
      const ph = a.state !== 'down' ? a.state : a.paid < a.target - 0.5 ? 'paying' : 'set';
      if (ph !== this.anchorPhase) {
        if (ph === 'set') this.say('Proa', `${(a.paid / SHACKLE).toFixed(0)} quartéis n'água, amarra aboçada.`, 'info');
        if (ph === 'stowed' && this.anchorPhase === 'heaving') this.say('Proa', 'Ferro a bordo.', 'info');
        this.anchorPhase = ph;
      }
    }

    for (const t of this.tugs) t.update(this, DT, ext);

    // --- defensas do cais
    const Q = W.QUAY;
    let contact = false, impact = 0;
    for (const [xf, ys] of HULL) {
      const [wx, wy] = bodyToWorld(s, xf, ys);
      const [a, b] = W.quayLocal(wx, wy);
      if (Math.abs(a) > Q.half + 2 || b >= Q.fender) continue;
      if (b < -4) return this.finish(false, 'Colisão com o cais', 'O navio entrou cais adentro.', 60000);
      const [vx, vy] = pointVelocity(s, xf, ys);
      const vn = vx * Q.nx + vy * Q.ny, vt = vx * Q.tx + vy * Q.ty;
      const F = Math.max(0, KQ * (Q.fender - b) - CQ * vn);
      const fr = -MU * F * Math.tanh(vt / 0.05);
      worldForceAt(s, F * Q.nx + fr * Q.tx, F * Q.ny + fr * Q.ty, xf, ys, ext);
      contact = true; impact = Math.max(impact, -vn);
    }
    // amarrando: os cabos e os guinchos trazem o navio para o cais, devagar
    if (this.mooring > 0) {
      for (const [xf, ys] of [[36, -5], [-42, -6]]) {
        const gap = W.quayLocal(...bodyToWorld(s, xf, ys))[1] - Q.fender;
        const [vx, vy] = pointVelocity(s, xf, ys);
        const F = Math.max(0, Math.min(60e3, 8e3 * gap)) + 4e5 * (vx * Q.nx + vy * Q.ny);
        worldForceAt(s, -F * Q.nx, -F * Q.ny, xf, ys, ext);
      }
    }
    if (contact && this.time - this.lastContact > 10 && this.mooring <= 0) this.onImpact(impact);
    if (contact) this.lastContact = this.time;
    this.touching = contact;
    if (this.status !== 'running') return;

    stepShip(s, p, env, DT, ext);
    if (s.noAir) { this.say('Máquinas', 'Sem ar de partida! Aguardando os compressores.', 'bad', 'air', 25); this.trustEvent(-8, 'máquina sem ar de partida', 'air', 120); }
    else if (s.air < 2 && s.n === 0) this.say('Máquinas', `Ar de partida baixo: só ${Math.floor(s.air)} partida${s.air >= 2 ? 's' : ''}.`, 'warn', 'airlow', 60);

    if (this.mooring > 0) {
      s.u *= 0.97;
      this.mooring -= DT;
      const mb = this.berth();
      if (this.mooring <= 0) this.mooring = DT; // só termina com o navio encostado
      if (this.mooring <= DT && mb.bow < 3.5 && mb.stern < 2.5) return this.finish(true, 'Navio atracado', 'Espias passadas, portaló arriado.');
    }

    // --- encalhe e margens
    let ukcMin = 99;
    for (const [xf, ys] of HULL) {
      const [wx, wy] = bodyToWorld(s, xf, ys);
      const [a, b] = W.quayLocal(wx, wy);
      if (Math.abs(a) <= Q.half + 2 && b > -4 && b < Q.fender + 1) continue;
      const d = env.depth(wx, wy);
      if (d <= 0.5) return this.finish(false, 'Bateu na margem', 'O casco tocou terra.', 60000);
      ukcMin = Math.min(ukcMin, d - p.T - s.squat);
      if (d - p.T - s.squat <= 0) return this.finish(false, 'Encalhou', `Fundo de ${d.toFixed(1)} m para um calado de ${(p.T + s.squat).toFixed(1)} m com o afundamento.`, 45000);
    }
    this.ukcMin = ukcMin;
    if (s.x < W.BOUNDS.x0 + 60 || s.x > W.BOUNDS.x1 - 60 || s.y < W.BOUNDS.y0 + 60 || s.y > W.BOUNDS.y1 - 60) {
      return this.finish(false, 'Saiu da área do porto', 'A Capitania cancelou a manobra.', 8000);
    }

    // --- boias
    const sin = Math.sin(s.psi), cos = Math.cos(s.psi);
    W.BUOYS.forEach((bu, i) => {
      if (this.hitBuoys.has(i)) return;
      const dx = bu.x - s.x, dy = bu.y - s.y;
      const xf = dx * sin + dy * cos, ys = dx * cos - dy * sin;
      if (Math.abs(xf) < 46 && Math.abs(ys) < 8) {
        this.hitBuoys.add(i); this.ledger.buoys += 2500; this.trustEvent(-8, 'boia abalroada');
        this.say('Imediato', `Abalroamos a boia ${bu.id}!`, 'bad');
      }
    });

    // --- regras
    const near = W.nearest(s.x, s.y);
    if (near.s > W.S_MOUTH - 300 && this.vts !== 'ok' && !this.ledger.vts) {
      this.ledger.vts = 8000; this.trustEvent(-6, 'entrou sem autorização');
      this.say('Santos VTS', 'Maré Mansa, o senhor cruzou a barra sem autorização. Será autuado.', 'bad');
    }
    if (near.s > W.S_MOUTH - 300 && this.sog > W.SPEED_LIMIT_KN * KN) {
      this.ledger.speeding += 40 * DT; this.trustEvent(-2, 'excesso de velocidade', 'speed', 45);
      this.say('Capitania', `Acima de ${W.SPEED_LIMIT_KN} nós no canal. Multa correndo.`, 'bad', 'speed', 30);
    }
    this.ledger.fuel += Math.abs(s.n) ** 3 * 3 * DT;
    // imediato confiante avisa cedo; desconfiado só fala em cima da hora
    if (ukcMin < 1.5 + this.trust / 100) this.say('Imediato', `Pouca água: ${Math.max(0, ukcMin).toFixed(1)} m sob o casco!`, 'warn', 'ukc', 12);
    if (ukcMin < 1) this.trustEvent(-3, 'pouca água sob a quilha', 'ukc', 45);
    if (this.trust > 20 && near.s > W.S_MOUTH - 600 && this.sog > (W.SPEED_LIMIT_KN - 0.7) * KN && this.sog <= W.SPEED_LIMIT_KN * KN) {
      this.say('Imediato', `Comandante, ${(this.sog / KN).toFixed(1)} nós. O limite é ${W.SPEED_LIMIT_KN}.`, 'warn', 'prespeed', 60);
    }

    if (this.scenario === 'entrada' && this.mooring <= 0) {
      const b = this.berth();
      if (Math.min(b.bow, b.stern) < 120 && Math.abs(b.along) < 300) {
        const f = (v: number) => (v < 0.3 ? 'encostada' : `a ${v.toFixed(v < 10 ? 1 : 0)} m`);
        // só informa quando a distância muda de verdade, e mais espaçado quando ainda está longe
        const far = Math.min(b.bow, b.stern) > 30, q = far ? 10 : 2;
        const sig = `${Math.round(b.bow / q)}/${Math.round(b.stern / q)}`;
        if (sig !== this.berthSig && this.time - this.berthAt >= (far ? 20 : 7) * cf * cf) {
          this.berthSig = sig; this.berthAt = this.time;
          this.say('Proa', `Proa ${f(b.bow)}, popa ${f(b.stern)} do cais.`, 'info');
        }
      }
      if (this.trust > -20 && b.along > -700 && b.along < -150 && this.sog > 4 * KN) {
        this.say('Imediato', `${this.trust > 40 ? 'Comandante, estamos' : 'Estamos'} com ${(this.sog / KN).toFixed(1)} nós a ${(-b.along).toFixed(0)} m do berço.`, 'warn', 'fastberth', 40);
      }
    }

    if (this.scenario === 'fundeio') {
      const a = this.anchor;
      const inZone = Math.hypot(a.ax - W.ANCHORAGE.x, a.ay - W.ANCHORAGE.y) < W.ANCHORAGE.r;
      const holding = a.state === 'down' && a.paid >= a.target - 0.5 && !a.dragging;
      if (holding && this.sog < 0.25) this.holdTime += DT; else this.holdTime = 0;
      if (holding && !inZone) this.say('Capitania', 'Vocês fundearam fora do fundeadouro (círculo rosa). Suspendam (G) e fundeiem dentro dele.', 'warn', 'zone', 40);
      else if (holding && this.sog >= 0.25) this.say('Imediato', `Ferro no fundo, mas o navio ainda tem ${(this.sog / KN).toFixed(1)} nó de seguimento. Tire o seguimento.`, 'warn', 'way', 25);
      if (this.holdTime > 45 && inZone) return this.finish(true, 'Navio fundeado', `Ferro unhado com ${(a.paid / SHACKLE).toFixed(0)} quartéis.`);
    }
  }

  private onImpact(v: number) {
    const kn = (v / KN).toFixed(1);
    if (v > 0.6) return this.finish(false, 'Avaria grave no cais', `Tocou o cais a ${kn} nós.`, 60000);
    if (v > 0.3) { this.ledger.contact += 15000; this.trustEvent(-18, 'pancada no cais'); this.say('Imediato', `Pancada forte no cais: ${kn} nós. Vai ter vistoria.`, 'bad'); }
    else if (v > 0.15) { this.ledger.contact += 3000; this.trustEvent(-6, 'encostou duro'); this.say('Imediato', `Encostou duro: ${kn} nós.`, 'warn'); }
    else { this.say('Imediato', this.tone(`Encostou macio, ${kn} nós.`), 'info'); this.trustEvent(8, 'atracação macia', 'soft', 600); }
  }

  private finish(ok: boolean, title: string, detail: string, penalty = 0) {
    const L = this.ledger, lines: [string, number][] = [];
    if (ok) lines.push(this.scenario === 'entrada' ? ['Frete: 2.900 t de fertilizante', 28000] : ['Fundeio dentro do prazo', 3500]);
    if (penalty) lines.push([title, -penalty]);
    lines.push(['Óleo combustível', -Math.round(L.fuel)]);
    if (L.pilot) lines.push([`Praticagem (${this.pilot.name.toLowerCase()})`, -L.pilot]);
    if (L.vts) lines.push(['Multa: entrada sem autorização do VTS', -L.vts]);
    if (L.tugs) lines.push([`Rebocadores (${this.tugs.filter(t => t.state !== 'none').length})`, -Math.round(L.tugs)]);
    const wear = Math.round((this.s.wearEngine * 350 + this.s.starts * 120) / 10) * 10;
    if (wear) lines.push([`Desgaste da máquina (${this.s.starts} partidas)`, -wear]);
    const helm = Math.round(this.s.wearRudder * 0.6 / 10) * 10;
    if (helm) lines.push([`Desgaste da máquina do leme (${Math.round(this.s.wearRudder)}° de curso)`, -helm]);
    if (L.speeding) lines.push(['Multa por excesso de velocidade', -Math.round(L.speeding)]);
    if (L.buoys) lines.push(['Boias abalroadas', -L.buoys]);
    if (L.contact) lines.push(['Avaria no cais e nas defensas', -L.contact]);
    if (L.anchor) lines.push(['Ferro e amarra perdidos', -L.anchor]);
    const late = this.time / 60 - PAR_MIN[this.scenario];
    if (late > 0) lines.push([`Demora (${late.toFixed(0)} min)`, -Math.round(late * 300)]);
    if (!ok) this.trustEvent(-30, title.toLowerCase());
    else {
      const clean = !L.speeding && !L.buoys && !L.contact && !L.anchor && !L.vts;
      if (this.scenario === 'entrada' && this.pilot.state === 'none') this.trustEvent(5, 'entrou sem prático');
      this.trustEvent((this.scenario === 'entrada' ? 15 : 8) + (clean ? 10 : 0) - (late > 0 ? 5 : 0), clean ? 'manobra limpa' : 'manobra concluída');
    }
    // tripulação que não confia no comandante vai embora
    const left = this.trust <= -60;
    if (left) lines.push(['Timoneiro pediu desembarque: substituto e passagens', -6000]);
    const trustAfter = this.trust;
    if (left) this.trust = -30;
    saveTrust(this.trust);
    this.result = { ok, title, detail, lines, total: lines.reduce((a, l) => a + l[1], 0), trustBefore: this.trustStart, trustAfter, left };
    this.status = 'done';
  }
}
