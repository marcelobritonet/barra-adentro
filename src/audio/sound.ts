// Som do jogo, todo sintetizado (sem arquivos): máquina, água, vento, sinos, alarmes, rádio e apito.
// Só observa o jogo; não muda nada nele.
import { Game } from '../game/game';

const KEY = 'barra-adentro.som';

export class Sound {
  on = true;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private eng!: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode; filter: BiquadFilterNode };
  private water!: { gain: GainNode; filter: BiquadFilterNode };
  private wind!: { gain: GainNode; filter: BiquadFilterNode };
  private chain!: GainNode;
  private seen = 0; private tel = -1; private ack = -1; private alarmT = 0; private fogT = 30; private otherFogT = 75;
  private wasStatus = '';

  constructor() { try { this.on = localStorage.getItem(KEY) !== '0'; } catch { /* sem armazenamento */ } }

  /** O navegador só deixa tocar depois de um clique ou tecla. */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.5 : 0; this.master.connect(c.destination);
    // ruído branco em laço, base da água, do vento e da amarra
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (freq: number, q: number, type: BiquadFilterType) => {
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const filter = c.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
      const gain = c.createGain(); gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master); src.start();
      return { gain, filter };
    };
    this.water = noise(500, 0.6, 'lowpass'); this.wind = noise(700, 1.5, 'bandpass');
    this.chain = noise(2400, 3, 'bandpass').gain;
    // diesel lento: dente de serra grave com um sub
    const osc = c.createOscillator(), sub = c.createOscillator(), filter = c.createBiquadFilter(), gain = c.createGain();
    osc.type = 'sawtooth'; sub.type = 'square'; filter.type = 'lowpass'; filter.frequency.value = 220; gain.gain.value = 0;
    osc.connect(filter); sub.connect(filter); filter.connect(gain).connect(this.master); osc.start(); sub.start();
    this.eng = { osc, sub, gain, filter };
  }
  toggle() { this.on = !this.on; try { localStorage.setItem(KEY, this.on ? '1' : '0'); } catch { /* sem armazenamento */ } if (this.ctx) this.master.gain.value = this.on ? 0.5 : 0; }

  private tone(freq: number, dur: number, vol = 0.2, type: OscillatorType = 'sine', at = 0, slide = 0) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  private bell(n: number, freq = 1250) { for (let i = 0; i < n; i++) { this.tone(freq, 0.7, 0.16, 'sine', i * 0.22); this.tone(freq * 2.7, 0.4, 0.05, 'sine', i * 0.22); } }
  /** Apito do navio: grave e longo. vol cai com a distância para os outros navios. */
  horn(dur = 4, vol = 0.3, freq = 130, at = 0) { this.tone(freq, dur, vol, 'sawtooth', at); this.tone(freq * 1.5, dur, vol * 0.5, 'square', at); }

  update(g: Game, dt: number) {
    const c = this.ctx; if (!c) return;
    const s = g.s, live = g.status === 'running' && !g.paused, t = c.currentTime;
    const set = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, 0.15);
    const n = Math.abs(s.n);
    set(this.eng.gain.gain, live ? 0.05 + 0.2 * n : 0);
    set(this.eng.osc.frequency, 26 + 44 * n); set(this.eng.sub.frequency, 13 + 22 * n); set(this.eng.filter.frequency, 140 + 300 * n);
    set(this.water.gain.gain, live ? Math.min(0.22, 0.02 + 0.03 * Math.abs(s.stw)) : 0); set(this.water.filter.frequency, 350 + 220 * Math.abs(s.stw));
    set(this.wind.gain.gain, live ? Math.min(0.12, s.relWindSpeed * 0.006) : 0); set(this.wind.filter.frequency, 500 + 40 * s.relWindSpeed);
    const a = g.anchor, running = a.state === 'heaving' || (a.state === 'down' && a.paid < a.target - 0.5);
    set(this.chain.gain, live && running ? 0.09 * (0.6 + 0.4 * Math.sin(t * 23)) : 0);

    if (g.status !== this.wasStatus) {
      if (g.status === 'done' && g.result) g.result.ok ? [523, 659, 784].forEach((f, i) => this.tone(f, 0.5, 0.18, 'triangle', i * 0.18)) : this.tone(160, 1.2, 0.3, 'sawtooth', 0, -90);
      if (g.status === 'running') { this.seen = g.msgs.length; this.tel = s.telegraph; this.ack = s.telAck; this.fogT = 30; this.otherFogT = 75; g.events.length = 0; }
      this.wasStatus = g.status;
    }
    if (!live) return;

    // telégrafo: um toque na ordem, dois quando a máquina responde
    if (s.telegraph !== this.tel) { this.tel = s.telegraph; this.bell(1); }
    if (s.telAck !== this.ack) { this.ack = s.telAck; this.bell(2, 1050); }
    // rádio: estalo a cada mensagem; ordem do prático e aviso grave têm som próprio
    if (g.msgs.length < this.seen) this.seen = 0;
    const fresh = g.msgs.slice(this.seen); this.seen = g.msgs.length;
    if (fresh.length) {
      const lv = fresh.some(m => m.level === 'bad') ? 'bad' : fresh.some(m => m.level === 'pilot') ? 'pilot' : fresh.some(m => m.level === 'warn') ? 'warn' : 'info';
      if (lv === 'pilot') { this.tone(880, 0.12, 0.14, 'triangle'); this.tone(1175, 0.18, 0.14, 'triangle', 0.11); }
      else if (lv === 'bad') { this.tone(300, 0.25, 0.2, 'square'); this.tone(230, 0.35, 0.2, 'square', 0.22); }
      else if (lv === 'warn') this.tone(620, 0.2, 0.13, 'triangle');
      else this.tone(1900, 0.04, 0.05, 'square');
    }
    // alarme do ecobatímetro
    this.alarmT -= dt;
    if (g.ukcMin < 1.5 && this.alarmT <= 0) { this.alarmT = 0.9; this.tone(1480, 0.12, 0.16, 'square'); this.tone(1480, 0.12, 0.16, 'square', 0.2); }
    // nevoeiro: um apito longo a cada 2 minutos, o nosso e o do navio que vem
    if (g.sky === 'nevoeiro') {
      this.fogT -= dt * g.warp; this.otherFogT -= dt * g.warp;
      if (this.fogT <= 0) { this.fogT = 120; this.horn(4, 0.28); }
      const o = g.traffic.find(x => x.kind === 'outbound' && x.phase === 'underway');
      if (o && this.otherFogT <= 0) { this.otherFogT = 120; const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < 3000) this.horn(4, 0.22 * Math.max(0.1, 1 - d / 3000), 98); }
    }
    for (const e of g.events.splice(0)) {
      if (e === 'horn') this.horn(3.5, 0.3);
      else if (e === 'horn5') for (let i = 0; i < 5; i++) this.horn(0.7, 0.22, 98, i * 1.0);
      else if (e === 'thud') { this.tone(70, 0.5, 0.4, 'sine', 0, -30); this.tone(240, 0.12, 0.12, 'square'); }
      else if (e === 'splash') { this.tone(900, 0.5, 0.1, 'sawtooth', 0, -700); }
      else if (e === 'tug') { this.tone(310, 0.25, 0.14, 'sawtooth'); this.tone(310, 0.25, 0.14, 'sawtooth', 0.35); }
      else if (e === 'lines') { this.bell(3, 900); }
    }
  }
}
