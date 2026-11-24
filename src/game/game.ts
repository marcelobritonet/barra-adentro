import { anchorForce, HEAVE_RATE, letGo, makeAnchor, SHACKLE } from '../sim/anchor';
import {
  BodyForce, bodyToWorld, D2R, Env, KN, makeCoaster, makeShipParams, makeState, pointVelocity, ShipClass, shipGeo, ShipState,
  stepShip, TELEGRAPH, TELEGRAPH_LABELS, worldForceAt,
} from '../sim/ship';
import * as W from '../world/santos';
import { Pilot, PilotGrade, PILOTS } from './pilot';
import { makeTugs, TugMode } from './tugs';
import { bearingText, berthBusy, berthShip, DEPART_ON_REQUEST, DREDGE_KN, hullDistance, interaction, makeTraffic, Other, slowAhead, swingRadius, updateTraffic, YIELD_TIME } from './traffic';
import { Tide, tideAt, TidePreset, tideText } from '../world/tide';
import { applyCareer, bestHired, Career, Contract, CREW, equipOf, mateLead, newCareer, reputation, salaries, saveCareer, Sky, wearFactor } from './career';

export type Scenario = 'entrada' | 'fundeio' | 'contrabordo';
export interface Msg { t: number; text: string; level: 'info' | 'warn' | 'bad' | 'pilot'; who: string }
export interface Result { ok: boolean; title: string; detail: string; lines: [string, number][]; total: number; trustBefore: number; trustAfter: number; left: boolean; rep: number }

const TRUST_KEY = 'barra-adentro.confianca';
function loadTrust() { try { return Math.max(-100, Math.min(100, +(localStorage.getItem(TRUST_KEY) ?? 0) || 0)); } catch { return 0; } }
function saveTrust(v: number) { try { localStorage.setItem(TRUST_KEY, String(Math.round(v))); } catch { /* sem armazenamento */ } }

const DT = 0.05;
const KQ = 4e5, CQ = 6e5, MU = 0.3;
const PAR_MIN: Record<Scenario, number> = { entrada: 75, fundeio: 40, contrabordo: 50 };

export class Game {
  p = makeCoaster(1);
  geo = shipGeo(this.p);
  /** Porte em relação ao costeiro: escala defensas, cabos e ferro. */
  private size = 1;
  s: ShipState = makeState(0, 0, 0);
  anchor = makeAnchor();
  env: Env;
  time = 0; warp = 1; paused = false;
  status: 'menu' | 'running' | 'done' = 'menu';
  scenario: Scenario = 'entrada';
  /** Carreira: dinheiro, peças e tripulação. No modo livre nada disso vale e os equipamentos são chaves de teste. */
  career: Career = newCareer();
  free = false;
  freeShip: ShipClass = 'coaster';
  /** Céu desta viagem: muda o que se vê da ponte, não a física. */
  sky: Sky = 'dia'; freeSky: Sky = 'dia';
  freeBerth = 'cais';
  /** Atracar aproado ao mar: passar do berço, girar na bacia de evolução e voltar. */
  headOut = false; freeHeadOut = false;
  /** Limite de velocidade no canal: 8 nós, 6 com nevoeiro. */
  get limitKn() { return this.sky === 'nevoeiro' ? 6 : W.SPEED_LIMIT_KN; }
  /** Alcance visual, em metros. */
  get visibility() { return this.sky === 'nevoeiro' ? 300 : this.sky === 'noite' ? 2500 : 20000; }
  contract: Contract | null = null;
  tidePreset: TidePreset = 'vazante';
  tide: Tide = tideAt(0, 'vazante');
  equip = { gps: false, rot: false, radar: false, ecdis: false, doppler: false, thruster: false };
  shackles = 4;
  msgs: Msg[] = [];
  /** Acontecimentos para o som: 'horn', 'horn5', 'thud', 'splash', 'tug', 'lines'. */
  events: string[] = [];
  private emit(e: string) { if (this.events.length < 40) this.events.push(e); }
  /** Apito do navio, um toque longo. */
  sound() { if (this.status === 'running') { this.emit('horn'); this.say('Maré Mansa', 'Um apito longo.', 'info', 'horn', 6); } }
  result: Result | null = null;
  ledger = { fuel: 0, speeding: 0, buoys: 0, contact: 0, anchor: 0, pilot: 0, vts: 0, tugs: 0 };
  tugs = makeTugs();
  traffic: Other[] = makeTraffic();
  /** Atracação a contrabordo: o navio fundeado que serve de "cais". */
  sts: Other | null = null;
  private stsQuay: W.Quay = { id: 'sts', name: '', s: 0, side: 1, cx: 0, cy: 0, tx: 0, ty: 1, nx: 1, ny: 0, half: 60, berthHalf: 30, fender: 2.5 };
  /** O costado de boreste do navio fundeado acompanha o giro dele. */
  private syncSts() {
    const o = this.sts; if (!o) return;
    const q = this.stsQuay, tx = Math.sin(o.psi), ty = Math.cos(o.psi);
    q.tx = tx; q.ty = ty; q.nx = ty; q.ny = -tx; q.cx = o.x + q.nx * o.B / 2; q.cy = o.y + q.ny * o.B / 2;
    q.half = o.L / 2 - 15; q.name = `N/M ${o.name}`;
  }
  /** Onde o navio encosta: cais ou outro navio. */
  get against() { return this.sts ? 'navio' : 'cais'; }
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
  private heaveQ = 0;
  private berthSig = ''; private berthAt = -99;
  private said = new Map<string, number>();
  private windBase = 7; private windFromBase = 160 * D2R;

  constructor() {
    // a carta dá a profundidade na baixa-mar de referência; a maré soma água por cima
    this.env = {
      depth: (x, y) => { const d = W.depth(x, y); return d > 0 ? d + this.tide.height : d; },
      current: (x, y) => W.current(x, y, this.tide.flow),
      windFrom: this.windFromBase, windSpeed: this.windBase,
    };
  }

  start(sc: Scenario) {
    this.scenario = sc;
    const ct = this.contract && this.contract.scenario === sc ? this.contract : null;
    this.contract = ct;
    const cls: ShipClass = this.free ? this.freeShip : this.career.ship;
    this.p = makeShipParams(cls, ct ? ct.load : 1);
    this.geo = shipGeo(this.p); this.size = this.p.mass / makeCoaster(1).mass;
    if (ct) this.tidePreset = ct.tide;
    this.sky = ct ? ct.sky ?? 'dia' : this.free ? this.freeSky : 'dia';
    W.setQuay(ct ? ct.berth ?? 'cais' : this.free ? this.freeBerth : 'cais');
    this.headOut = sc === 'entrada' && (ct ? !!ct.headOut : this.free && this.freeHeadOut) && W.QUAY.id === 'cais';
    if (this.headOut) W.useQuay(W.headOut(W.QUAY));
    if (!this.free) { applyCareer(this.p, this.career); this.equip = equipOf(this.career); }
    if (sc === 'entrada') {
      const [x, y] = W.pointAt(W.S_MOUTH - 1500);
      const [x2, y2] = W.pointAt(W.S_MOUTH - 1400);
      this.s = makeState(x, y, Math.atan2(x2 - x, y2 - y) / D2R, 7, 7);
    } else {
      this.s = makeState(-700, -5100, 320, 5, 6);
    }
    this.anchor = makeAnchor(); this.anchor.scale = this.size ** 0.8;
    this.tide = tideAt(0, this.tidePreset);
    this.time = 0; this.warp = 1; this.paused = false; this.acc = 0;
    this.msgs = []; this.result = null; this.hitBuoys.clear();
    this.ledger = { fuel: 0, speeding: 0, buoys: 0, contact: 0, anchor: 0, pilot: 0, vts: 0, tugs: 0 };
    this.tugs = makeTugs(this.geo.tug);
    this.traffic = makeTraffic(sc === 'entrada'); updateTraffic(this, 0);
    this.sts = sc === 'contrabordo' ? this.traffic[0] : null;
    if (this.sts) {
      this.syncSts(); W.useQuay(this.stsQuay);
      // começa pela popa do navio fundeado, um pouco aberto para o bordo de boreste dele
      const o = this.sts, q = this.stsQuay;
      this.s = makeState(o.x - q.tx * 950 + q.nx * 160, o.y - q.ty * 950 + q.ny * 160, o.psi / D2R, 4, 6);
      this.s.air = this.p.airStarts;
    }
    this.pilot = new Pilot(); this.vts = sc === 'entrada' ? 'none' : 'ok'; this.vtsTimer = 0;
    this.mooring = 0; this.holdTime = 0; this.anchorPhase = 'stowed'; this.berthSig = ''; this.berthAt = -99; this.said.clear(); this.lastContact = -99;
    this.status = 'running';
    this.s.air = this.p.airStarts;
    this.trustStart = this.trust; this.trustNote = ''; this.trustNoteAt = -99; this.telTimes = [];
    this.baseAck = this.p.ackDelay; this.baseHelm = this.p.helmDelay;
    if (sc === 'entrada') {
      this.say('Imediato', `Vento sueste. Maré: ${tideText(this.tide)}.`, 'info');
      if (this.sky === 'nevoeiro') this.say('Imediato', 'Nevoeiro fechado, uns 300 metros de visibilidade. Limite de 6 nós no canal; navegamos pelo radar e pelas boias.', 'warn');
      if (this.sky === 'noite') this.say('Imediato', 'Noite sem lua. Encarnada a boreste, verde a bombordo: siga as luzes das boias.', 'info');
      this.say('Imediato', 'Precisamos da autorização do VTS antes da barra. Prático é opcional: chame pelo rádio se quiser.', 'info');
      this.say('Imediato', `Berço: ${W.QUAY.name}, ${this.headOut ? 'aproado ao mar: passamos dele, giramos na bacia de evolução e voltamos para atracar por boreste' : W.QUAY.side > 0 ? 'por bombordo, depois da segunda curva' : 'por boreste, no fundo do canal'}. Calado ${this.p.T.toFixed(1).replace('.', ',')} m. Temos ar para ${this.p.airStarts} partidas de máquina.`, 'info');
    } else if (sc === 'contrabordo') {
      this.say('Capitania', `Atraque a contrabordo do N/M ${this.sts!.name}, fundeado, pelo boreste dele, para o transbordo.`, 'info');
      this.say('Imediato', 'Ele está aproado ao vento e gira devagar. Chegue paralelo, quase parado, e encoste a proa nas defensas. Depois, espias (M).', 'info');
    } else {
      this.say('Capitania', 'Berço ocupado. Fundeie no fundeadouro a noroeste e aguarde.', 'info');
      this.say('Imediato', 'Há três navios fundeados. Precisamos de uns 280 m de folga do ferro de cada um.', 'info');
      this.say('Imediato', `Fundo de 17 m na carta. Sugiro 4 quartéis, aproado ao vento, quase parado. Maré: ${tideText(this.tide)}.`, 'info');
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
  setThruster(v: number) { if (this.equip.thruster && this.status === 'running') this.s.thrusterOrder = Math.max(-1, Math.min(1, v)); }
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

  /** Pede pelo rádio que o navio do berço adiante a largada. */
  callShip() {
    const o = berthShip(this);
    if (this.status !== 'running' || this.scenario !== 'entrada' || !o || o.phase !== 'berthed' || o.asked) return;
    o.asked = true;
    this.say('Maré Mansa', `${o.name}, Maré Mansa. Estou entrando para o seu berço. O senhor pode adiantar a largada?`, 'info');
    const at = this.time + DEPART_ON_REQUEST;
    if (at < o.departAt) { o.departAt = at; this.say(`N/M ${o.name}`, `Maré Mansa, ${o.name}. Afirmativo, largo em ${Math.round(DEPART_ON_REQUEST / 60)} minutos e saio pelo meu boreste.`, 'info'); }
    else this.say(`N/M ${o.name}`, `Maré Mansa, ${o.name}. Já estou largando, aguarde.`, 'info');
  }
  /** Pede passagem ao navio lento que sobe o canal à frente. */
  callDredge(by = 'Maré Mansa') {
    const o = slowAhead(this);
    if (this.status !== 'running' || !o || this.time < o.yieldUntil) return;
    o.yieldUntil = this.time + YIELD_TIME;
    this.say(by, `Draga ${o.name}, Maré Mansa pela sua popa. Solicito passagem pelo seu bombordo.`, 'info');
    this.say(`Draga ${o.name}`, `Afirmativo. Saio do canal para a margem de boreste e fico quase parada por ${YIELD_TIME / 60} minutos. O canal é seu.`, 'info');
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
    const [bx, by] = bodyToWorld(this.s, this.geo.bow, 0);
    letGo(a, bx, by, this.shackles, this.env.depth(bx, by));
    this.emit('splash');
    this.say('Proa', `Ferro largado. Arriando ${this.shackles} quartéis.`, 'info');
  }
  heaveAnchor() {
    if (this.status !== 'running') return;
    const a = this.anchor;
    if (a.state === 'down') {
      a.state = 'heaving';
      this.say('Proa', `Virando o ferro: ${(a.paid / SHACKLE).toFixed(1).replace('.', ',')} quartéis n'água, uns ${Math.ceil(a.paid / HEAVE_RATE / 60)} minutos.`, 'info');
    } else if (a.state === 'heaving') this.say('Proa', `Já estamos virando: faltam ${(a.paid / SHACKLE).toFixed(1).replace('.', ',')} quartéis.`, 'info', 'heaving', 5);
    else if (a.state === 'stowed') this.say('Proa', 'O ferro já está a bordo.', 'info', 'stowed', 5);
    else this.say('Proa', 'Não temos mais ferro, comandante.', 'bad', 'lost', 5);
  }
  /** Segundos que faltam para o ferro chegar a bordo. */
  get heaveLeft() { return this.anchor.state === 'heaving' ? this.anchor.paid / HEAVE_RATE : 0; }

  /** Situação do navio em relação ao berço. */
  berth() {
    const [ac] = W.quayLocal(this.s.x, this.s.y);
    const m = W.QUAY.side, [bf, bs] = this.geo.berthBow, [sf, ss] = this.geo.berthStern; // no cais a boreste, encosta o outro bordo
    const bow = W.quayLocal(...bodyToWorld(this.s, bf, bs * m))[1] - W.QUAY.fender;
    const stern = W.quayLocal(...bodyToWorld(this.s, sf, ss * m))[1] - W.QUAY.fender;
    return { along: ac, bow, stern };
  }
  moor() {
    if (this.status !== 'running' || this.scenario === 'fundeio' || this.mooring > 0) return;
    if (this.scenario === 'entrada' && berthBusy(this)) return this.say('Imediato', `O berço ainda está ocupado pelo ${berthShip(this)!.name}.`, 'warn');
    const b = this.berth();
    if (Math.abs(b.along) > W.QUAY.berthHalf) return this.say('Imediato', `Fora da posição: ${Math.abs(b.along).toFixed(0)} m ${b.along > 0 ? 'avante' : 'a ré'} do ${this.sts ? 'meio do navio' : 'berço'}.`, 'warn');
    // a proa precisa estar encostada; a popa pode vir depois, virada pelos cabos
    if (b.bow > 8 || b.stern > 35) return this.say('Imediato', `Longe demais para passar espias: proa ${Math.max(0, b.bow).toFixed(0)} m (máx. 8), popa ${Math.max(0, b.stern).toFixed(0)} m (máx. 35).`, 'warn');
    if (this.sog > 0.25) return this.say('Imediato', 'Ainda com seguimento. Pare o navio antes de amarrar.', 'warn');
    this.mooring = 40 * this.crewFactor * (!this.free && this.career.crew.mate >= 2 ? 0.5 : 1);
    this.setTelegraph(4); this.emit('lines');
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
    const flowBefore = this.tide.flow;
    this.tide = tideAt(this.time, this.tidePreset);
    if (flowBefore * this.tide.flow < 0) this.say('Imediato', `A maré virou: começa a ${this.tide.flow > 0 ? 'vazante' : 'enchente'}.`, 'warn');
    env.windSpeed = this.windBase * (1 + 0.2 * Math.sin(this.time / 37) + 0.1 * Math.sin(this.time / 11 + 1));
    env.windFrom = this.windFromBase + 8 * D2R * Math.sin(this.time / 53);

    const cf = this.crewFactor;
    if (!this.equip.thruster) s.thrusterOrder = 0;
    p.ackDelay = this.baseAck * cf; p.helmDelay = this.baseHelm * cf;

    if (this.vts === 'asked' && (this.vtsTimer -= DT) <= 0) {
      this.vts = 'ok';
      const o = berthShip(this), wait = o && o.phase === 'berthed' ? Math.max(0, Math.round((o.departAt - this.time) / 60)) : 0;
      this.say('Santos VTS', `Maré Mansa, entrada autorizada, limite de ${this.limitKn} nós da barra para dentro. Maré ${tideText(this.tide)}.`, 'info');
      if (o && berthBusy(this)) this.say('Santos VTS', `Seu berço está ocupado pelo N/M ${o.name}, com largada prevista em ${wait} min. Regule a chegada ou combine com ele pelo rádio.`, 'warn');
    }
    this.pilot.update(this, DT);

    const ext: BodyForce = { X: 0, Y: 0, N: 0 };

    // --- amarra
    const HULL = this.geo.hull, hx = this.geo.bow;
    const [bx, by] = bodyToWorld(s, hx, 0);
    const [bvx, bvy] = pointVelocity(s, hx, 0);
    const [fx, fy] = anchorForce(this.anchor, bx, by, bvx, bvy, Math.max(env.depth(bx, by), 1), DT);
    if (fx || fy) worldForceAt(s, fx, fy, hx, 0, ext);
    if (this.anchor.stalled) this.say('Proa', 'Amarra tesa, o molinete não vence. Dê um toque de máquina adiante para aliviar.', 'warn', 'stall', 20);
    if (this.anchor.state === 'heaving') {
      const q = Math.ceil(this.anchor.paid / SHACKLE);
      if (q !== this.heaveQ) { if (this.heaveQ && q < this.heaveQ) this.say('Proa', q <= 1 ? 'Ferro a pique, quase em cima.' : `${q} quartéis n'água.`, 'info'); this.heaveQ = q; }
    } else this.heaveQ = 0;
    if (this.anchor.dragging) { this.say('Proa', 'O ferro está garrando!', 'warn', 'drag', 15); this.trustEvent(-3, 'ferro garrando', 'drag', 90); }
    {
      const a = this.anchor;
      const ph = a.state !== 'down' ? a.state : a.paid < a.target - 0.5 ? 'paying' : 'set';
      if (ph !== this.anchorPhase) {
        if (ph === 'set') this.say('Proa', `${(a.paid / SHACKLE).toFixed(0)} quartéis n'água, amarra aboçada.`, 'info');
        if (ph === 'stowed' && this.anchorPhase === 'heaving') this.say('Proa', 'Ferro a bordo. Navio livre para manobrar.', 'info');
        this.anchorPhase = ph;
      }
    }

    for (const t of this.tugs) t.update(this, DT, ext);

    // --- outros navios: abalroamento encerra a viagem; passar raspando custa confiança
    updateTraffic(this, DT);
    this.syncSts();
    for (const o of this.traffic) {
      if (!o.active) continue;
      if (Math.hypot(o.x - s.x, o.y - s.y) > o.L / 2 + 160) { o.near = false; continue; }
      // sucção entre os cascos
      const it = interaction(p, s, o, Math.min(0.9, (p.T / Math.max(s.depth, 1)) ** 3));
      ext.Y += it.Y; ext.N += it.N;
      if (Math.abs(it.Y) > 10e3) this.say('Imediato', `Os cascos estão se sugando com o ${o.name}! Abra distância ou reduza.`, 'warn', 'suck' + o.name, 30);
      if (o.phase === 'berthed' && this.mooring <= 0 && Math.hypot(o.x - s.x, o.y - s.y) > o.L / 2 + 60) continue;
      let dmin = 1e9;
      for (const [xf, ys] of HULL) {
        const [wx, wy] = bodyToWorld(s, xf, ys);
        if (o === this.sts) { const [qa, qb] = W.quayLocal(wx, wy); if (Math.abs(qa) <= W.QUAY.half + 2 && qb > -4) continue; } // esse lado tem defensas
        dmin = Math.min(dmin, hullDistance(o, wx, wy));
      }
      if (o === this.sts && dmin > 0.5) continue; // chegar perto dele é a manobra
      if (dmin <= 0.5) return this.finish(false, 'Abalroamento', `O Maré Mansa abalroou o N/M ${o.name}${o.kind === 'anchored' ? ', que estava fundeado' : ''}.`, 120000);
      const limit = o.kind === 'anchored' ? 25 : 35;
      if (dmin < limit && !o.near) {
        o.near = true; this.trustEvent(-6, `passou a ${dmin.toFixed(0)} m do ${o.name}`);
        this.say(`N/M ${o.name}`, `Maré Mansa, o senhor passou a ${dmin.toFixed(0)} metros de mim!`, 'bad');
      }
      if (o.kind === 'outbound' && !o.warned && dmin < 700 && W.nearest(s.x, s.y).side > 0 && W.nearest(s.x, s.y).d > 5) {
        o.warned = true; this.emit('horn5'); this.say(`N/M ${o.name}`, 'Maré Mansa, o senhor está no meu lado do canal. Guine para boreste! (cinco apitos curtos)', 'bad');
      }
    }
    const dr = slowAhead(this);
    if (dr) {
      const near2 = W.nearest(s.x, s.y), gapS = dr.s - near2.s;
      if (gapS > 0 && gapS < 900 && this.time >= dr.yieldUntil && this.sog > dr.u + 0.3) this.say('Imediato', `Draga ${dr.name} à frente, a ${gapS.toFixed(0)} m, a ${DREDGE_KN} nós. Peça passagem pelo rádio ou siga atrás dela.`, 'warn', 'dredge', 120);
    }
    for (const o of this.traffic) {
      if (o.kind !== 'outbound' || o.phase !== 'underway') continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < 1300) this.say('Imediato', `N/M ${o.name} ${bearingText(this, o)}, a ${(d / 1852).toFixed(1).replace('.', ',')} milha, vindo em sentido contrário.`, 'info', 'meet' + o.name, 90);
    }

    // --- defensas do cais
    const Q = W.QUAY;
    let contact = false, impact = 0;
    for (const [xf, ys] of HULL) {
      const [wx, wy] = bodyToWorld(s, xf, ys);
      const [a, b] = W.quayLocal(wx, wy);
      if (Math.abs(a) > Q.half + 2 || b >= Q.fender) continue;
      if (b < -4) return this.finish(false, this.sts ? 'Abalroamento' : 'Colisão com o cais', this.sts ? `O Maré Mansa esmagou as defensas e abalroou o N/M ${this.sts.name}.` : 'O navio entrou cais adentro.', this.sts ? 120000 : 60000);
      let [vx, vy] = pointVelocity(s, xf, ys);
      // a contrabordo, o que importa é a velocidade em relação ao costado do outro navio, que gira
      if (this.sts) { vx -= this.sts.rate * (wy - this.sts.y); vy += this.sts.rate * (wx - this.sts.x); }
      const vn = vx * Q.nx + vy * Q.ny, vt = vx * Q.tx + vy * Q.ty;
      const F = Math.max(0, KQ * (Q.fender - b) - CQ * vn) * this.size;
      const fr = -MU * F * Math.tanh(vt / 0.05);
      worldForceAt(s, F * Q.nx + fr * Q.tx, F * Q.ny + fr * Q.ty, xf, ys, ext);
      contact = true; impact = Math.max(impact, -vn);
    }
    // amarrando: os cabos e os guinchos trazem o navio para o cais, devagar
    if (this.mooring > 0) {
      for (const [xf, y0] of [this.geo.berthBow, this.geo.berthStern]) {
        const ys = y0 * Q.side;
        const gap = W.quayLocal(...bodyToWorld(s, xf, ys))[1] - Q.fender;
        const [vx, vy] = pointVelocity(s, xf, ys);
        const F = (Math.max(0, Math.min(60e3, 8e3 * gap)) + 4e5 * (vx * Q.nx + vy * Q.ny)) * this.size;
        worldForceAt(s, -F * Q.nx, -F * Q.ny, xf, ys, ext);
      }
    }
    if (contact && this.time - this.lastContact > 10 && this.mooring <= 0) this.onImpact(impact);
    if (contact) this.lastContact = this.time;
    this.touching = contact;
    if (this.status !== 'running') return;

    stepShip(s, p, env, DT, ext);
    if (Math.abs(s.bankForce) > 12e3 && this.mooring <= 0) {
      const bb = s.bankForce < 0;
      this.say('Imediato', `Margem a ${bb ? 'bombordo' : 'boreste'} sugando a popa e jogando a proa para ${bb ? 'boreste' : 'bombordo'}. Leme para o lado da margem para segurar.`, 'warn', 'bank', 45);
    }
    if (s.noAir) { this.say('Máquinas', 'Sem ar de partida! Aguardando os compressores.', 'bad', 'air', 25); this.trustEvent(-8, 'máquina sem ar de partida', 'air', 120); }
    else if (s.air < 2 && s.n === 0) this.say('Máquinas', `Ar de partida baixo: só ${Math.floor(s.air)} partida${s.air >= 2 ? 's' : ''}.`, 'warn', 'airlow', 60);

    if (this.mooring > 0) {
      s.u *= 0.97;
      this.mooring -= DT;
      const mb = this.berth();
      if (this.mooring <= 0) this.mooring = DT; // só termina com o navio encostado
      if (this.mooring <= DT && mb.bow < 3.5 && mb.stern < 2.5) return this.finish(true, this.sts ? 'Navio a contrabordo' : 'Navio atracado', this.sts ? `Amarrado ao costado do N/M ${this.sts.name}. Mangotes conectados.` : 'Espias passadas, portaló arriado.');
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
      if (Math.abs(xf) < p.L / 2 + 1 && Math.abs(ys) < p.B / 2 + 1) {
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
    if (near.s > W.S_MOUTH - 300 && this.sog > this.limitKn * KN) {
      this.ledger.speeding += 40 * DT; this.trustEvent(-2, 'excesso de velocidade', 'speed', 45);
      this.say('Capitania', `Acima de ${this.limitKn} nós no canal. Multa correndo.`, 'bad', 'speed', 30);
    }
    this.ledger.fuel += Math.abs(s.n) ** 3 * 3 * DT;
    // imediato confiante avisa cedo; desconfiado só fala em cima da hora
    const lead = this.free ? 0 : mateLead(this.career);
    if (ukcMin < 1.5 + lead + this.trust / 100) this.say('Imediato', `Pouca água: ${Math.max(0, ukcMin).toFixed(1)} m sob o casco!`, 'warn', 'ukc', 12);
    if (ukcMin < 1) this.trustEvent(-3, 'pouca água sob a quilha', 'ukc', 45);
    if ((this.trust > 20 || lead > 0) && near.s > W.S_MOUTH - 600 && this.sog > (this.limitKn - 0.7) * KN && this.sog <= this.limitKn * KN) {
      this.say('Imediato', `Comandante, ${(this.sog / KN).toFixed(1)} nós. O limite é ${this.limitKn}.`, 'warn', 'prespeed', 60);
    }

    if (this.scenario !== 'fundeio' && this.mooring <= 0) {
      const b = this.berth();
      if (Math.min(b.bow, b.stern) < 120 && Math.abs(b.along) < 300) {
        const f = (v: number) => (v < 0.3 ? 'encostada' : `a ${v.toFixed(v < 10 ? 1 : 0)} m`);
        // só informa quando a distância muda de verdade, e mais espaçado quando ainda está longe
        const far = Math.min(b.bow, b.stern) > 30, q = far ? 10 : 2;
        const sig = `${Math.round(b.bow / q)}/${Math.round(b.stern / q)}`;
        if (sig !== this.berthSig && this.time - this.berthAt >= (far ? 20 : 7) * cf * cf) {
          this.berthSig = sig; this.berthAt = this.time;
          this.say('Proa', `Proa ${f(b.bow)}, popa ${f(b.stern)} do ${this.against}.`, 'info');
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
      // fundeado em cima do giro de outro navio não vale
      const crowd = holding ? this.traffic.find(o => o.kind === 'anchored' && Math.hypot(a.ax - o.ax, a.ay - o.ay) < Math.max(swingRadius(o), a.paid + 90) + 40) : undefined;
      if (crowd) {
        this.holdTime = 0;
        this.say('Santos VTS', `Maré Mansa, o senhor fundeou dentro do giro do N/M ${crowd.name}. Suspenda (G) e fundeie com mais folga.`, 'bad', 'crowd', 45);
        this.trustEvent(-4, 'fundeou perto demais', 'crowd', 120);
      }
      if (holding && !inZone) this.say('Capitania', 'Vocês fundearam fora do fundeadouro (círculo rosa). Suspendam (G) e fundeiem dentro dele.', 'warn', 'zone', 40);
      else if (holding && this.sog >= 0.25) this.say('Imediato', `Ferro no fundo, mas o navio ainda tem ${(this.sog / KN).toFixed(1)} nó de seguimento. Tire o seguimento.`, 'warn', 'way', 25);
      if (this.holdTime > 45 && inZone) return this.finish(true, 'Navio fundeado', `Ferro unhado com ${(a.paid / SHACKLE).toFixed(0)} quartéis.`);
    }
  }

  private onImpact(v: number) {
    const kn = (v / KN).toFixed(1);
    this.emit('thud');
    if (v > 0.6) return this.finish(false, this.sts ? 'Avaria grave nos dois navios' : 'Avaria grave no cais', `Tocou o ${this.against} a ${kn} nós.`, this.sts ? 90000 : 60000);
    if (v > 0.3) { this.ledger.contact += 15000; this.trustEvent(-18, 'pancada no cais'); this.say('Imediato', `Pancada forte no ${this.against}: ${kn} nós. Vai ter vistoria.`, 'bad'); }
    else if (v > 0.15) { this.ledger.contact += 3000; this.trustEvent(-6, 'encostou duro'); this.say('Imediato', `Encostou duro: ${kn} nós.`, 'warn'); }
    else { this.say('Imediato', this.tone(`Encostou macio, ${kn} nós.`), 'info'); this.trustEvent(8, 'atracação macia', 'soft', 600); }
  }

  private finish(ok: boolean, title: string, detail: string, penalty = 0) {
    const L = this.ledger, lines: [string, number][] = [];
    const ct = this.contract;
    if (ok) lines.push(ct ? [`Frete: ${ct.cargo}`, ct.freight] : this.scenario === 'entrada' ? ['Frete: 2.900 t de fertilizante', 28000] : this.scenario === 'contrabordo' ? ['Transbordo a contrabordo', 14000] : ['Fundeio dentro do prazo', 3500]);
    if (penalty) lines.push([title, -penalty]);
    lines.push(['Óleo combustível', -Math.round(L.fuel)]);
    if (L.pilot) lines.push([`Praticagem (${this.pilot.name.toLowerCase()})`, -L.pilot]);
    if (L.vts) lines.push(['Multa: entrada sem autorização do VTS', -L.vts]);
    if (L.tugs) lines.push([`Rebocadores (${this.tugs.filter(t => t.state !== 'none').length})`, -Math.round(L.tugs)]);
    const wf = this.free ? 1 : wearFactor(this.career);
    const wear = Math.round((this.s.wearEngine * 350 + this.s.starts * 120) * wf / 10) * 10;
    if (wear) lines.push([`Desgaste da máquina (${this.s.starts} partidas)`, -wear]);
    const helm = Math.round(this.s.wearRudder * 0.6 / 10) * 10;
    if (helm) lines.push([`Desgaste da máquina do leme (${Math.round(this.s.wearRudder)}° de curso)`, -helm]);
    if (L.speeding) lines.push(['Multa por excesso de velocidade', -Math.round(L.speeding)]);
    if (L.buoys) lines.push(['Boias abalroadas', -L.buoys]);
    if (L.contact) lines.push(['Avaria no cais e nas defensas', -L.contact]);
    if (L.anchor) lines.push(['Ferro e amarra perdidos', -L.anchor]);
    const pay = this.free ? 0 : salaries(this.career);
    if (pay) lines.push(['Soldadas da tripulação contratada', -pay]);
    const late = this.time / 60 - (ct ? ct.parMin : PAR_MIN[this.scenario]);
    if (late > 0) lines.push([`Demora (${late.toFixed(0)} min)`, -Math.round(late * 300)]);
    if (!ok) this.trustEvent(-30, title.toLowerCase());
    else {
      const clean = !L.speeding && !L.buoys && !L.contact && !L.anchor && !L.vts;
      if (this.scenario === 'entrada' && this.pilot.state === 'none') this.trustEvent(5, 'entrou sem prático');
      this.trustEvent((this.scenario === 'entrada' ? 15 : 8) + (clean ? 10 : 0) - (late > 0 ? 5 : 0), clean ? 'manobra limpa' : 'manobra concluída');
    }
    // tripulação que não confia no comandante vai embora
    const left = this.trust <= -60;
    // quem vai embora é o melhor tripulante contratado; sem ninguém contratado, vai o timoneiro de bordo
    const gone = left && !this.free ? bestHired(this.career) : null;
    if (left) lines.push([gone ? `${CREW[gone].levels[this.career.crew[gone]].name} pediu desembarque: passagens e substituto` : 'Timoneiro pediu desembarque: substituto e passagens', -6000]);
    if (gone) this.career.crew[gone] = 0;
    const trustAfter = this.trust;
    if (left) this.trust = -30;
    saveTrust(this.trust);
    const total = lines.reduce((a, l) => a + l[1], 0);
    const cleanRun = !L.speeding && !L.buoys && !L.contact && !L.anchor && !L.vts;
    const repDelta = !this.free && ct ? reputation(this.career, ct, ok, cleanRun) : 0;
    if (!this.free) { this.career.money += total; this.career.voyages++; saveCareer(this.career); }
    this.result = { ok, title, detail, lines, total: lines.reduce((a, l) => a + l[1], 0), trustBefore: this.trustStart, trustAfter, left, rep: repDelta };
    this.status = 'done';
  }
}
