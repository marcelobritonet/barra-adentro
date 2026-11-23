// Passadiço: instrumentos e comandos. Regra: sem o equipamento, a informação não aparece.
import { Game } from '../game/game';
import { SHACKLE } from '../sim/anchor';
import { D2R, KN, TELEGRAPH, TELEGRAPH_LABELS, TELEGRAPH_STOP } from '../sim/ship';
import * as W from '../world/santos';
import { PILOTS, PilotGrade } from '../game/pilot';
import { TUG_FEE, TUG_PER_MIN, TugMode } from '../game/tugs';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const TAU = Math.PI * 2;

function canvas(id: string, w: number, h: number) {
  const c = $<HTMLCanvasElement>(id);
  c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d')!; ctx.scale(2, 2);
  return ctx;
}
const fmtTime = (t: number) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}`;
const deg3 = (rad: number) => String(Math.round(((rad / D2R) % 360 + 360) % 360) % 360).padStart(3, '0');

export class Panel {
  private cCompass; private cRudder; private cRpm; private cWind; private cEcho; private cChart;
  private big: HTMLCanvasElement;
  private chartBase: HTMLCanvasElement;
  private echo: number[] = []; private echoT = 0;
  private hdgShown = 0; private logCount = -1;
  bigChart = false;

  constructor(private g: Game, chartBase: HTMLCanvasElement) {
    this.chartBase = chartBase;
    $('bridge').innerHTML = `
      <div id="topbar" class="inst">
        <div id="clock"></div>
        ${[1, 2, 4, 8].map(w => `<button data-warp="${w}">${w}×</button>`).join('')}
        <button id="pause">Pausa</button>
      </div>
      <div class="inst" id="trustbox"><h4>Confiança da tripulação <span id="trustnote"></span></h4><div id="trustbar"><i></i><b id="trustfill"></b></div></div>
      <div class="inst" id="vhfbox"><h4>VHF</h4>
        <div id="vhf">
          <button id="vts">Santos VTS: pedir entrada</button>
          <button data-pilot="padrao">Prático · R$ ${PILOTS.padrao.fee.toLocaleString('pt-BR')} · ${Math.round(PILOTS.padrao.eta / 60)} min</button>
          <button data-pilot="senior">Prático sênior · R$ ${PILOTS.senior.fee.toLocaleString('pt-BR')} · ${Math.round(PILOTS.senior.eta / 60)} min</button>
        </div>
        <div class="lcd" id="pilotbox"></div>
      </div>
      <div class="inst" id="tugbox"><h4>Rebocadores · saída R$ ${TUG_FEE.toLocaleString('pt-BR')} + R$ ${TUG_PER_MIN}/min com cabo · empurrar leva para bombordo</h4>
        ${g.tugs.map((t, i) => `<div class="tug" data-tug="${i}">
          <span class="tugname"><b>${t.name}</b> ${t.where}</span>
          <button data-tcall="1">Chamar</button>
          <button data-tmode="push">◀ Empurrar</button><button data-tmode="stop">Parar</button><button data-tmode="pull">Puxar ▶</button>${i === 1 ? '<button data-tmode="brake">Segurar</button>' : ''}
          <select data-tpow="1">${[10, 25, 50, 100].map(p => `<option value="${p / 100}" ${p === 25 ? 'selected' : ''}>${p}%</option>`).join('')}</select>
          <span class="tugst"></span>
        </div>`).join('')}
      </div>
      <div class="row">
        <div class="inst"><h4>Agulha</h4><canvas id="cCompass"></canvas></div>
        <div class="inst" style="flex:1.1">
          <h4>Odômetro (na água)</h4><div class="lcd"><span class="big" id="stw">0.0</span> <span class="unit">nós</span></div>
          <h4>GPS</h4><div class="lcd" id="gps"></div>
          <h4>Taxa de guinada</h4><div class="lcd" id="rot"></div>
        </div>
        <div class="inst"><h4>Anemômetro</h4><canvas id="cWind"></canvas></div>
      </div>
      <div class="row">
        <div class="inst" style="flex:1.5">
          <h4>Leme: ordem e ângulo real</h4><canvas id="cRudder"></canvas>
          <input id="helm" type="range" min="-35" max="35" step="1" value="0" />
          <div id="helmrow"><button data-helm="-35">BB 35</button><button data-helm="-10">BB 10</button><button data-helm="0">A MEIO</button><button data-helm="10">BE 10</button><button data-helm="35">BE 35</button></div>
        </div>
        <div class="inst">
          <h4>Telégrafo de máquinas</h4>
          <div id="telegraph">${TELEGRAPH_LABELS.map((l, i) => `<button data-tel="${i}" class="${i > TELEGRAPH_STOP ? 'ahead' : i < TELEGRAPH_STOP ? 'astern' : 'stop'}">${l}</button>`).join('')}</div>
        </div>
      </div>
      <div class="row">
        <div class="inst"><h4>Tacômetro</h4><canvas id="cRpm"></canvas><h4 style="margin-top:4px">Ar de partida</h4><div class="lcd" id="air"></div></div>
        <div class="inst" style="flex:1.4"><h4>Ecobatímetro: menor água sob o casco</h4><canvas id="cEcho"></canvas></div>
      </div>
      <div class="row">
        <div class="inst">
          <h4>Carta (C amplia)</h4><canvas id="cChart"></canvas>
        </div>
        <div class="inst">
          <h4>Molinete</h4>
          <div class="lcd" id="anchor"></div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <select id="shackles">${[2, 3, 4, 5, 6].map(n => `<option ${n === 4 ? 'selected' : ''} value="${n}">${n} quartéis</option>`).join('')}</select>
            <button id="letgo" class="danger">Largar (F)</button><button id="heave">Virar (G)</button>
          </div>
          <h4 style="margin-top:8px">Atracação</h4>
          <button id="moor">Passar espias (M)</button>
          <h4 style="margin-top:8px">Equipamentos (teste de upgrades)</h4>
          <label class="sw"><input type="checkbox" id="eqGps"> GPS</label>
          <label class="sw"><input type="checkbox" id="eqRot"> Indicador de guinada</label>
        </div>
      </div>`;

    this.cCompass = canvas('cCompass', 118, 118); this.cWind = canvas('cWind', 118, 118);
    this.cRudder = canvas('cRudder', 220, 96); this.cRpm = canvas('cRpm', 150, 92);
    this.cEcho = canvas('cEcho', 216, 92); this.cChart = canvas('cChart', 150, 245);
    this.big = $<HTMLCanvasElement>('bigchart'); this.big.width = 600; this.big.height = 980;

    const br = $('bridge');
    br.addEventListener('click', e => {
      const t = (e.target as HTMLElement).closest('button'); if (!t) return;
      if (t.dataset.tel) g.setTelegraph(+t.dataset.tel);
      if (t.dataset.helm) g.setRudderDeg(+t.dataset.helm);
      if (t.dataset.warp) g.warp = +t.dataset.warp;
      if (t.id === 'pause') g.paused = !g.paused;
      if (t.id === 'letgo') g.letGoAnchor();
      if (t.id === 'heave') g.heaveAnchor();
      if (t.id === 'moor') g.moor();
      if (t.id === 'vts') g.callVTS();
      if (t.dataset.pilot) g.callPilot(t.dataset.pilot as PilotGrade);
      const tugEl = t.closest<HTMLElement>('.tug');
      if (tugEl) {
        const i = +tugEl.dataset.tug!;
        if (t.dataset.tcall) g.callTug(i);
        if (t.dataset.tmode) g.tugOrder(i, t.dataset.tmode as TugMode, +tugEl.querySelector<HTMLSelectElement>('select')!.value);
      }
      t.blur();
    });
    $<HTMLInputElement>('helm').addEventListener('input', e => g.setRudderDeg(+(e.target as HTMLInputElement).value));
    br.querySelectorAll<HTMLSelectElement>('[data-tpow]').forEach(sel => sel.addEventListener('change', () => {
      const i = +sel.closest<HTMLElement>('.tug')!.dataset.tug!, t = g.tugs[i];
      if (t.mode === 'stop') t.power = +sel.value; else g.tugOrder(i, t.mode, +sel.value);
    }));
    $<HTMLSelectElement>('shackles').addEventListener('change', e => { g.shackles = +(e.target as HTMLSelectElement).value; });
    $<HTMLInputElement>('eqGps').addEventListener('change', e => { g.equip.gps = (e.target as HTMLInputElement).checked; });
    $<HTMLInputElement>('eqRot').addEventListener('change', e => { g.equip.rot = (e.target as HTMLInputElement).checked; });
  }

  reset() { this.echo = []; this.logCount = -1; this.hdgShown = this.g.s.psi; }

  update(dt: number) {
    const g = this.g, s = g.s, p = g.p;
    $('clock').textContent = `${fmtTime(g.time)}  ${g.paused ? 'PAUSADO' : ''}`;
    document.querySelectorAll<HTMLElement>('[data-warp]').forEach(b => b.classList.toggle('on', +b.dataset.warp! === g.warp));
    $('pause').classList.toggle('on', g.paused);
    document.querySelectorAll<HTMLElement>('[data-tel]').forEach(b => {
      const i = +b.dataset.tel!;
      b.classList.toggle('on', i === s.telAck);
      b.classList.toggle('pending', i === s.telegraph && i !== s.telAck);
    });
    const full = Math.floor(s.air + 1e-6);
    $('air').innerHTML = `<span class="${s.noAir ? 'neg' : ''}">${'●'.repeat(full)}${'○'.repeat(p.airStarts - full)}</span> ${s.noAir ? 'SEM AR' : s.n === 0 && s.revTimer > 0 && TELEGRAPH[s.telAck] !== 0 ? 'revertendo' : ''}`;
    const helm = $<HTMLInputElement>('helm');
    if (document.activeElement !== helm) helm.value = String(Math.round(s.rudderOrder / D2R));

    const tf = $('trustfill'), tr = g.trust;
    tf.style.left = (tr >= 0 ? 50 : 50 + tr / 2) + '%'; tf.style.width = Math.abs(tr) / 2 + '%';
    tf.style.background = tr >= 0 ? '#2fb85a' : '#e23b3b';
    const fresh = g.time - g.trustNoteAt < 12 && g.trustNote;
    $('trustnote').textContent = fresh ? g.trustNote : `${tr > 0 ? '+' : ''}${Math.round(tr)}`;
    $('trustnote').className = fresh ? (g.trustNote[0] === '▲' ? 'pos' : 'neg') : 'dim';

    $('stw').textContent = (s.stw / KN).toFixed(1);
    const gps = $('gps');
    gps.classList.toggle('off', !g.equip.gps);
    gps.innerHTML = g.equip.gps
      ? `<span class="big">${(g.sog / KN).toFixed(1)}</span> <span class="unit">nós no fundo</span><br>rumo no fundo ${g.sog > 0.1 ? deg3(g.cog) : '---'}°`
      : `<span class="big">--.-</span><br>não instalado`;
    const rot = $('rot');
    rot.classList.toggle('off', !g.equip.rot);
    const rpm = s.r / D2R * 60;
    rot.innerHTML = g.equip.rot ? `<span class="big">${Math.abs(rpm).toFixed(0)}</span> <span class="unit">°/min ${rpm > 0.5 ? 'BE ▶' : rpm < -0.5 ? '◀ BB' : ''}</span>` : `<span class="big">--</span> não instalado`;

    // agulha com um pouco de preguiça
    let d = s.psi - this.hdgShown; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
    this.hdgShown = (this.hdgShown + d * Math.min(1, dt * g.warp * 1.2) + TAU) % TAU;
    this.compass(this.cCompass, this.hdgShown);
    this.wind(this.cWind, s.relWindDir, s.relWindSpeed);
    this.rudder(this.cRudder, s.rudder / D2R, s.rudderOrder / D2R, s.helmAck !== s.rudderOrder);
    this.rpm(this.cRpm, s.n * p.rpmMax, TELEGRAPH[s.telegraph] * p.rpmMax, p.rpmMax);

    this.echoT += dt * g.warp;
    if (this.echoT > 1.5 && g.status === 'running' && !g.paused) { this.echoT = 0; this.echo.push(g.ukcMin); if (this.echo.length > 108) this.echo.shift(); }
    this.echoDraw(this.cEcho, g.status === 'menu' ? 99 : g.ukcMin);

    // --- rádio e prático
    const entry = g.scenario === 'entrada', pl = g.pilot;
    $('vhfbox').style.display = entry ? '' : 'none';
    const vts = $<HTMLButtonElement>('vts');
    vts.disabled = g.vts !== 'none'; vts.classList.toggle('on', g.vts === 'ok');
    vts.textContent = g.vts === 'none' ? 'Santos VTS: pedir entrada' : g.vts === 'asked' ? 'VTS: aguardando resposta…' : 'VTS: entrada autorizada';
    document.querySelectorAll<HTMLButtonElement>('[data-pilot]').forEach(b => { b.disabled = pl.state !== 'none'; b.classList.toggle('on', pl.state !== 'none' && b.dataset.pilot === pl.grade); });
    const pb = $('pilotbox');
    pb.classList.toggle('off', pl.state === 'none');
    if (pl.state === 'none') pb.innerHTML = 'Sem prático: a manobra é por sua conta';
    else if (pl.state === 'called') pb.innerHTML = pl.eta > 0 ? `${pl.name} embarca em ${fmtTime(pl.eta).slice(3)}` : '<span class="neg">Lancha ao costado: reduza para 7 nós</span>';
    else {
      const helmOk = Math.round(s.rudderOrder / D2R) === pl.helm, telOk = s.telegraph === pl.tel;
      const hd = pl.helm === 0 ? 'A MEIO' : `${pl.helm < 0 ? 'BB' : 'BE'} ${Math.abs(pl.helm)}`;
      pb.innerHTML = `Ordens do prático<br>leme <span class="big ${helmOk ? '' : 'neg'}">${hd}</span><br>máquina <span class="${telOk ? '' : 'neg'}"><b>${TELEGRAPH_LABELS[pl.tel]}</b></span>`;
    }

    $('tugbox').style.display = entry ? '' : 'none';
    document.querySelectorAll<HTMLElement>('.tug').forEach(el => {
      const t = g.tugs[+el.dataset.tug!];
      el.querySelector<HTMLElement>('[data-tcall]')!.style.display = t.state === 'none' ? '' : 'none';
      el.querySelectorAll<HTMLButtonElement>('[data-tmode]').forEach(b => {
        b.style.display = t.state === 'none' ? 'none' : '';
        b.disabled = t.state !== 'fast'; b.classList.toggle('on', t.state === 'fast' && t.mode === b.dataset.tmode);
      });
      el.querySelector<HTMLElement>('select')!.style.display = t.state === 'none' ? 'none' : '';
      el.querySelector<HTMLElement>('.tugst')!.textContent = t.status();
    });

    const a = g.anchor;
    $('anchor').innerHTML = a.state === 'stowed' ? 'Ferro a bordo, pronto a largar'
      : a.state === 'lost' ? '<span class="neg">FERRO PERDIDO</span>'
      : `${a.state === 'heaving' ? 'Virando' : a.paid < a.target - 0.5 ? 'Arriando' : 'Fundeado'}: ${(a.paid / SHACKLE).toFixed(1)} quartéis<br>tensão ${(a.tension / 1000).toFixed(0)} kN ${a.dragging ? '<span class="neg">GARRANDO</span>' : ''}${g.scenario === 'fundeio' && g.holdTime > 0 ? `<br>confirmando: ${Math.max(0, 45 - g.holdTime).toFixed(0)} s` : ''}`;

    this.chart(this.cChart, 150, 245, false);
    this.big.hidden = !this.bigChart;
    if (this.bigChart) { const c = this.big.getContext('2d')!; this.chart(c, 600, 980, true); }

    if (g.msgs.length !== this.logCount || (g.msgs.length === 60)) {
      const last = g.msgs[g.msgs.length - 1];
      const key = g.msgs.length + (last ? last.t : 0);
      if (key !== this.logCount) {
        this.logCount = key;
        const log = $('log');
        log.innerHTML = g.msgs.slice(-6).map(m => `<div class="${m.level}"><span class="t">${fmtTime(m.t)}</span> <b>${m.who}:</b> ${m.text}</div>`).join('');
      }
    }
  }

  private dial(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    c.fillStyle = '#05080b'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.strokeStyle = '#45525e'; c.lineWidth = 2; c.stroke();
  }

  private compass(c: CanvasRenderingContext2D, hdg: number) {
    const S = 118, cx = S / 2, cy = S / 2, r = 54;
    c.clearRect(0, 0, S, S); this.dial(c, cx, cy, r);
    c.save(); c.translate(cx, cy); c.rotate(-hdg);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '9px ui-monospace, monospace';
    for (let a = 0; a < 360; a += 10) {
      c.save(); c.rotate(a * D2R);
      c.strokeStyle = '#d8e2ea'; c.lineWidth = a % 30 === 0 ? 1.5 : 0.7;
      c.beginPath(); c.moveTo(0, -r + 2); c.lineTo(0, -r + (a % 30 === 0 ? 9 : 5)); c.stroke();
      if (a % 30 === 0) { c.fillStyle = a === 0 ? '#ff5a4a' : '#d8e2ea'; c.fillText(a === 0 ? 'N' : a === 90 ? 'E' : a === 180 ? 'S' : a === 270 ? 'W' : String(a / 10), 0, -r + 16); }
      c.restore();
    }
    c.restore();
    c.strokeStyle = '#ffd76a'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy - r - 2); c.lineTo(cx, cy - r + 12); c.stroke();
    c.fillStyle = '#ffd76a'; c.font = 'bold 17px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(deg3(hdg) + '°', cx, cy);
  }

  private wind(c: CanvasRenderingContext2D, dir: number, spd: number) {
    const S = 118, cx = S / 2, cy = S / 2, r = 54;
    c.clearRect(0, 0, S, S); this.dial(c, cx, cy, r);
    c.fillStyle = '#3a4854'; c.beginPath(); c.moveTo(cx, cy - 24); c.lineTo(cx + 7, cy - 10); c.lineTo(cx + 7, cy + 22); c.lineTo(cx - 7, cy + 22); c.lineTo(cx - 7, cy - 10); c.closePath(); c.fill();
    c.save(); c.translate(cx, cy); c.rotate(dir);
    c.fillStyle = '#7dd3ff'; c.beginPath(); c.moveTo(0, -r + 20); c.lineTo(6, -r + 4); c.lineTo(-6, -r + 4); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#7dd3ff'; c.font = 'bold 13px ui-monospace, monospace'; c.textAlign = 'center';
    c.fillText(`${(spd / KN).toFixed(0)} nós`, cx, cy + 40);
    c.fillStyle = '#7f93a3'; c.font = '8px ui-monospace, monospace'; c.fillText('relativo', cx, cy + 50);
  }

  private rudder(c: CanvasRenderingContext2D, actual: number, order: number, pending: boolean) {
    const Wd = 220, H = 96, cx = Wd / 2, cy = 8, r = 76, k = 1.6 * D2R;
    c.clearRect(0, 0, Wd, H);
    c.fillStyle = '#05080b'; c.fillRect(0, 0, Wd, H);
    const pt = (deg: number, rr: number): [number, number] => [cx + rr * Math.sin(deg * k), cy + rr * Math.cos(deg * k)];
    c.lineWidth = 6;
    c.strokeStyle = '#8f2f2a'; c.beginPath(); c.arc(cx, cy, r, Math.PI / 2, Math.PI / 2 + 35 * k); c.stroke();
    c.strokeStyle = '#237a41'; c.beginPath(); c.arc(cx, cy, r, Math.PI / 2 - 35 * k, Math.PI / 2); c.stroke();
    c.font = '9px ui-monospace, monospace'; c.textAlign = 'center'; c.fillStyle = '#d8e2ea'; c.strokeStyle = '#d8e2ea'; c.lineWidth = 1;
    for (let d = -35; d <= 35; d += 5) {
      const [x1, y1] = pt(d, r - 6), [x2, y2] = pt(d, r + 4);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      if (d % 10 === 0 || Math.abs(d) === 35) { const [tx, ty] = pt(d, r - 14); c.fillText(String(Math.abs(d)), tx, ty + 3); }
    }
    const [ox, oy] = pt(order, r + 8);
    c.fillStyle = pending && Math.floor(performance.now() / 200) % 2 ? '#7a6630' : '#ffd76a'; c.beginPath(); c.arc(ox, oy, 3.5, 0, TAU); c.fill();
    const [ax, ay] = pt(actual, r - 2);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(ax, ay); c.stroke();
    c.fillStyle = '#ffd76a'; c.textAlign = 'left'; c.fillText(`ordem ${Math.abs(order).toFixed(0)}° ${order > 0 ? 'BE' : order < 0 ? 'BB' : ''}`, 4, 12);
    c.fillStyle = '#fff'; c.textAlign = 'right'; c.fillText(`real ${Math.abs(actual).toFixed(0)}° ${actual > 0.5 ? 'BE' : actual < -0.5 ? 'BB' : ''}`, Wd - 4, 12);
  }

  private rpm(c: CanvasRenderingContext2D, rpm: number, order: number, max: number) {
    const Wd = 150, H = 92, cx = Wd / 2, cy = 74, r = 60;
    c.clearRect(0, 0, Wd, H); c.fillStyle = '#05080b'; c.fillRect(0, 0, Wd, H);
    const ang = (v: number) => -Math.PI / 2 + (v / max) * (Math.PI / 2 - 0.15);
    c.lineWidth = 5;
    c.strokeStyle = '#8f2f2a'; c.beginPath(); c.arc(cx, cy, r, ang(-max) - Math.PI / 2 + Math.PI / 2, ang(0)); c.stroke();
    c.strokeStyle = '#237a41'; c.beginPath(); c.arc(cx, cy, r, ang(0), ang(max)); c.stroke();
    const line = (v: number, r1: number, r2: number, col: string, w: number) => {
      const a = ang(v); c.strokeStyle = col; c.lineWidth = w;
      c.beginPath(); c.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)); c.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)); c.stroke();
    };
    for (let v = -max; v <= max; v += 30) line(v, r - 7, r + 3, '#d8e2ea', 1);
    line(order, r - 2, r + 8, '#ffd76a', 3);
    line(rpm, 0, r - 6, '#fff', 3);
    c.fillStyle = '#fff'; c.font = 'bold 13px ui-monospace, monospace'; c.textAlign = 'center';
    c.fillText(`${rpm.toFixed(0)} rpm`, cx, cy + 14);
  }

  private echoDraw(c: CanvasRenderingContext2D, ukc: number) {
    const Wd = 216, H = 92, max = 15;
    c.clearRect(0, 0, Wd, H); c.fillStyle = '#04101c'; c.fillRect(0, 0, Wd, H);
    c.strokeStyle = '#12304a'; c.lineWidth = 1; c.fillStyle = '#3f6a8a'; c.font = '8px ui-monospace, monospace'; c.textAlign = 'left';
    for (const m of [5, 10]) { const y = 6 + (m / max) * (H - 10); c.beginPath(); c.moveTo(0, y); c.lineTo(Wd, y); c.stroke(); c.fillText(m + ' m', 2, y - 2); }
    c.fillStyle = '#c98a3a';
    this.echo.forEach((v, i) => { const y = 6 + (Math.max(0, Math.min(max, v)) / max) * (H - 10); c.fillRect(i * 2, y, 2, H - y); });
    c.fillStyle = '#d8e2ea'; c.fillRect(0, 4, Wd, 2);
    const alarm = ukc < 1.5;
    c.fillStyle = alarm ? '#ff5a4a' : '#7dffb0'; c.font = 'bold 20px ui-monospace, monospace'; c.textAlign = 'right';
    c.fillText(`${Math.max(0, ukc).toFixed(1)} m`, Wd - 6, 30);
    if (alarm && Math.floor(performance.now() / 400) % 2) { c.font = 'bold 10px ui-monospace, monospace'; c.fillText('ALARME', Wd - 6, 44); }
  }

  private chart(c: CanvasRenderingContext2D, w: number, h: number, big: boolean) {
    const g = this.g, B = W.BOUNDS, sx = w / (B.x1 - B.x0), sy = h / (B.y1 - B.y0);
    const X = (x: number) => (x - B.x0) * sx, Y = (y: number) => (B.y1 - y) * sy;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.chartBase, 0, 0, w, h);
    c.fillStyle = '#e9dfc455'; c.fillRect(0, 0, w, h);
    // eixo do canal
    c.strokeStyle = '#ffffff99'; c.setLineDash([4, 4]); c.lineWidth = 1; c.beginPath();
    W.CENTER.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke(); c.setLineDash([]);
    // fundeadouro e berço
    c.strokeStyle = '#c42fa0'; c.setLineDash([3, 3]); c.beginPath(); c.arc(X(W.ANCHORAGE.x), Y(W.ANCHORAGE.y), W.ANCHORAGE.r * sx, 0, TAU); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#ffe14a'; c.fillRect(X(W.QUAY.cx) - 2, Y(W.QUAY.cy + W.QUAY.half), 4, W.QUAY.half * 2 * sy);
    for (const b of W.BUOYS) {
      c.fillStyle = b.kind === 'red' ? '#e23b3b' : b.kind === 'green' ? '#18a04a' : '#111';
      c.fillRect(X(b.x) - (big ? 3 : 1.5), Y(b.y) - (big ? 3 : 1.5), big ? 6 : 3, big ? 6 : 3);
    }
    if (big) {
      c.font = '10px ui-monospace, monospace'; c.textAlign = 'center';
      for (let x = B.x0 + 300; x < B.x1; x += 400) for (let y = B.y0 + 300; y < B.y1; y += 400) {
        const d = W.depth(x, y); if (d <= 0) continue;
        c.fillStyle = d < 6 ? '#7a1f1f' : '#0b2238'; c.fillText(d.toFixed(d < 10 ? 1 : 0), X(x), Y(y));
      }
      c.fillStyle = '#3a2a1a'; c.font = 'italic 11px ui-monospace, monospace';
      for (const n of W.SHOAL_NAMES) c.fillText(n.name, X(n.x), Y(n.y) - 8);
      c.font = 'bold 13px ui-monospace, monospace';
      c.fillText('SANTOS', X(-1900), Y(900)); c.fillText('GUARUJÁ', X(1500), Y(200)); c.fillText('BAÍA DE SANTOS', X(-1500), Y(-2600));
      c.fillStyle = '#7a1f7a'; c.fillText('FUNDEADOURO', X(W.ANCHORAGE.x), Y(W.ANCHORAGE.y));
      c.fillStyle = '#3a2a1a'; c.font = '10px ui-monospace, monospace'; c.textAlign = 'left';
      c.fillText('Carta estilizada: NÃO USAR PARA NAVEGAÇÃO. Sondagens em metros.', 8, h - 8);
    }
    if (g.equip.gps) {
      const s = g.s;
      c.save(); c.translate(X(s.x), Y(s.y));
      if (g.sog > 0.2) { const cg = g.cog, len = g.sog * 180 * sx; c.strokeStyle = '#000'; c.beginPath(); c.moveTo(0, 0); c.lineTo(len * Math.sin(cg), -len * Math.cos(cg)); c.stroke(); }
      c.rotate(s.psi); const k = big ? 2 : 1;
      c.fillStyle = '#ff3b2f'; c.strokeStyle = '#000'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -7 * k); c.lineTo(4 * k, 5 * k); c.lineTo(-4 * k, 5 * k); c.closePath(); c.fill(); c.stroke();
      c.restore();
    } else if (big) {
      c.fillStyle = '#7a1f1f'; c.font = '11px ui-monospace, monospace'; c.textAlign = 'left';
      c.fillText('Sem GPS: situe-se pelas boias e pela costa.', 8, 16);
    }
  }
}
