// Passadiço: instrumentos e comandos. Regra: sem o equipamento, a informação não aparece.
import { Game } from '../game/game';
import { PILOTS, PilotGrade } from '../game/pilot';
import { TUG_FEE, TUG_PER_MIN, TugMode } from '../game/tugs';
import { berthShip, slowAhead } from '../game/traffic';
import { SHACKLE } from '../sim/anchor';
import { D2R, KN, TELEGRAPH, TELEGRAPH_LABELS, TELEGRAPH_STOP } from '../sim/ship';
import * as W from '../world/santos';
import { tideText } from '../world/tide';
import { drawDoppler, Ecdis, ECDIS_SCALES, Radar, RADAR_RANGES } from './mfd';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const TAU = Math.PI * 2;
const MFD = 236;
type MfdMode = 'carta' | 'ecdis' | 'radar';
const EQUIP: [keyof Game['equip'], string][] = [
  ['gps', 'GPS'], ['rot', 'Indicador de guinada'], ['radar', 'Radar'], ['ecdis', 'ECDIS'], ['doppler', 'Doppler de atracação'], ['thruster', 'Impelidor de proa'],
];

function canvas(id: string, w: number, h: number) {
  const c = $<HTMLCanvasElement>(id);
  c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d')!; ctx.scale(2, 2);
  return ctx;
}
const fmtTime = (t: number) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}`;
const deg3 = (rad: number) => String(Math.round(((rad / D2R) % 360 + 360) % 360) % 360).padStart(3, '0');

export class Panel {
  private cCompass; private cRudder; private cRpm; private cWind; private cEcho; private cDoppler; private cMfd;
  private big: HTMLCanvasElement;
  private echo: number[] = []; private echoT = 0;
  private hdgShown = 0; private logCount = -1;
  private radar = new Radar(MFD); private ecdis: Ecdis;
  mfd: MfdMode = 'carta'; tab = 'radio';
  bigChart = false;

  constructor(private g: Game, private grid: Float32Array, private chartBase: HTMLCanvasElement) {
    this.ecdis = new Ecdis(grid, g.p.T + 1.5);
    $('bridge').innerHTML = `
      <div id="topbar" class="inst">
        <div id="clock"></div>
        ${[1, 2, 4, 8].map(w => `<button data-warp="${w}" title="Acelerar o tempo (teclas 1 a 4)">${w}×</button>`).join('')}
        <button id="pause" title="Pausa (P)">Pausa</button>
        <div id="trustbox" title="Confiança da tripulação: muda a rapidez das ordens e os avisos"><span>Confiança <span id="trustnote"></span></span><div id="trustbar"><i></i><b id="trustfill"></b></div></div>
      </div>
      <div class="inst" id="tidebox" title="A carta mostra a profundidade na baixa-mar de referência; a maré soma água por cima"><b>MARÉ</b> <span id="tide"></span></div>
      <div class="row">
        <div class="inst"><h4>Agulha</h4><canvas id="cCompass"></canvas></div>
        <div class="inst" style="flex:1.25">
          <h4>Odômetro, na água</h4><div class="lcd"><span class="big" id="stw">0.0</span> <span class="unit">nós</span></div>
          <h4>GPS, no fundo</h4><div class="lcd" id="gps"></div>
          <h4>Taxa de guinada</h4><div class="lcd" id="rot"></div>
        </div>
        <div class="inst"><h4>Anemômetro</h4><canvas id="cWind"></canvas></div>
      </div>
      <div class="row">
        <div class="inst" style="flex:1.6">
          <h4>Leme (A D, espaço)</h4><canvas id="cRudder"></canvas>
          <input id="helm" type="range" min="-35" max="35" step="1" value="0" />
          <div id="helmrow"><button data-helm="-35">BB 35</button><button data-helm="-10">BB 10</button><button data-helm="0">MEIO</button><button data-helm="10">BE 10</button><button data-helm="35">BE 35</button></div>
        </div>
        <div class="inst">
          <h4>Telégrafo (W S)</h4>
          <div id="telegraph">${TELEGRAPH_LABELS.map((l, i) => `<button data-tel="${i}" class="${i > TELEGRAPH_STOP ? 'ahead' : i < TELEGRAPH_STOP ? 'astern' : 'stop'}">${l}</button>`).join('')}</div>
        </div>
        <div class="inst" style="flex:0.95"><h4>Tacômetro</h4><canvas id="cRpm"></canvas><h4 style="margin-top:6px">Ar de partida</h4><div class="lcd" id="air"></div></div>
      </div>
      <div class="row">
        <div class="inst"><h4>Ecobatímetro</h4><canvas id="cEcho"></canvas></div>
        <div class="inst"><h4>Doppler</h4><canvas id="cDoppler"></canvas></div>
        <div class="inst" id="thrbox"><h4>Impelidor (J K L)</h4>
          <div id="thrbar"><i></i><b id="thrfill"></b></div>
          <div id="thrrow">${[[-1, '◀◀'], [-0.5, '◀'], [0, '0'], [0.5, '▶'], [1, '▶▶']].map(([v, l]) => `<button data-thr="${v}">${l}</button>`).join('')}</div>
          <div class="unit" id="thrnote"></div>
        </div>
      </div>
      <div class="row" id="lower">
        <div class="inst" id="mfd">
          <div class="tabs">
            <button data-mfd="carta">Carta</button><button data-mfd="ecdis">ECDIS</button><button data-mfd="radar">Radar</button>
            <span class="sp"></span><button data-mfdz="-1" title="Afastar">−</button><button data-mfdz="1" title="Aproximar">+</button><button id="mfdmode" title="Norte ou proa para cima">N</button>
          </div>
          <canvas id="cMfd"></canvas>
        </div>
        <div class="inst" id="ops">
          <div class="tabs"><button data-tab="radio">Rádio</button><button data-tab="tugs">Reboc.</button><button data-tab="deck">Convés</button><button data-tab="equip">Equip.</button></div>
          <div class="tab" data-pane="radio">
            <div id="vhf">
              <button id="vts">Santos VTS: pedir entrada</button>
              <button id="callship"></button>
              <button id="calldredge"></button>
              <button data-pilot="padrao">Prático · R$ ${PILOTS.padrao.fee.toLocaleString('pt-BR')} · ${Math.round(PILOTS.padrao.eta / 60)} min</button>
              <button data-pilot="senior">Prático sênior · R$ ${PILOTS.senior.fee.toLocaleString('pt-BR')} · ${Math.round(PILOTS.senior.eta / 60)} min</button>
            </div>
            <div class="lcd" id="pilotbox"></div>
            <div class="unit" id="radionote">O VTS autoriza a entrada. O prático é opcional e só dá ordens.</div>
          </div>
          <div class="tab" data-pane="tugs" style="display:none">
            <div class="unit">Saída R$ ${TUG_FEE.toLocaleString('pt-BR')} + R$ ${TUG_PER_MIN}/min com cabo. Empurrar leva o navio para bombordo.</div>
            ${g.tugs.map((t, i) => `<div class="tug" data-tug="${i}">
              <div class="tugname"><b>${t.name}</b> · ${t.where} <span class="tugst"></span></div>
              <button data-tcall="1">Chamar</button>
              <button data-tmode="push">◀ Empurrar</button><button data-tmode="stop">Parar</button><button data-tmode="pull">Puxar ▶</button>${i === 1 ? '<button data-tmode="brake">Segurar</button>' : ''}
              <select data-tpow="1">${[10, 25, 50, 100].map(p => `<option value="${p / 100}" ${p === 25 ? 'selected' : ''}>${p}%</option>`).join('')}</select>
            </div>`).join('')}
          </div>
          <div class="tab" data-pane="deck" style="display:none">
            <h4>Molinete</h4>
            <div class="lcd" id="anchor"></div>
            <div class="btnrow">
              <select id="shackles">${[2, 3, 4, 5, 6].map(n => `<option ${n === 4 ? 'selected' : ''} value="${n}">${n} quartéis</option>`).join('')}</select>
              <button id="letgo" class="danger">Largar (F)</button><button id="heave">Virar (G)</button>
            </div>
            <h4 style="margin-top:10px">Atracação</h4>
            <div class="lcd" id="berthbox"></div>
            <button id="moor">Passar espias (M)</button>
          </div>
          <div class="tab" data-pane="equip" style="display:none">
            <div class="unit" id="equipnote"></div>
            ${EQUIP.map(([k, l]) => `<label class="sw"><input type="checkbox" data-eq="${k}"> ${l}</label>`).join('')}
          </div>
        </div>
      </div>`;

    this.cCompass = canvas('cCompass', 112, 112); this.cWind = canvas('cWind', 112, 112);
    this.cRudder = canvas('cRudder', 210, 92); this.cRpm = canvas('cRpm', 124, 78);
    this.cEcho = canvas('cEcho', 150, 78); this.cDoppler = canvas('cDoppler', 140, 78);
    this.cMfd = canvas('cMfd', MFD, MFD);
    this.big = $<HTMLCanvasElement>('bigchart'); this.big.width = 600; this.big.height = 980;

    const br = $('bridge');
    br.addEventListener('click', e => {
      const t = (e.target as HTMLElement).closest('button'); if (!t) return;
      if (t.dataset.tel) g.setTelegraph(+t.dataset.tel);
      if (t.dataset.helm) g.setRudderDeg(+t.dataset.helm);
      if (t.dataset.warp) g.warp = +t.dataset.warp;
      if (t.dataset.thr) g.setThruster(+t.dataset.thr);
      if (t.dataset.mfd) this.mfd = t.dataset.mfd as MfdMode;
      if (t.dataset.mfdz) this.zoomMfd(+t.dataset.mfdz);
      if (t.id === 'mfdmode') this.ecdis.headUp = !this.ecdis.headUp;
      if (t.dataset.tab) this.tab = t.dataset.tab;
      if (t.id === 'pause') g.paused = !g.paused;
      if (t.id === 'letgo') g.letGoAnchor();
      if (t.id === 'heave') g.heaveAnchor();
      if (t.id === 'moor') g.moor();
      if (t.id === 'vts') g.callVTS();
      if (t.id === 'callship') g.callShip();
      if (t.id === 'calldredge') g.callDredge();
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
    // depois de escolher numa lista o foco ficava preso nela e o teclado parava de comandar o navio
    br.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => sel.blur()));
    br.querySelectorAll<HTMLInputElement>('[data-eq]').forEach(cb => cb.addEventListener('change', () => {
      g.equip[cb.dataset.eq as keyof Game['equip']] = cb.checked;
      if (cb.checked && (cb.dataset.eq === 'radar' || cb.dataset.eq === 'ecdis')) this.mfd = cb.dataset.eq;
    }));
  }

  zoomMfd(d: number) {
    if (this.mfd === 'radar') this.radar.rangeI = Math.max(0, Math.min(RADAR_RANGES.length - 1, this.radar.rangeI - d));
    if (this.mfd === 'ecdis') this.ecdis.scaleI = Math.max(0, Math.min(ECDIS_SCALES.length - 1, this.ecdis.scaleI - d));
  }
  reset() {
    this.echo = []; this.logCount = -1; this.hdgShown = this.g.s.psi; this.radar.reset();
    // o contorno de segurança depende do calado do navio e da carga desta viagem
    const old = this.ecdis; this.ecdis = new Ecdis(this.grid, this.g.p.T + 1.5); this.ecdis.scaleI = old.scaleI; this.ecdis.headUp = old.headUp;
  }

  update(dt: number) {
    const g = this.g, s = g.s, p = g.p;
    $('clock').textContent = `${fmtTime(g.time)}${g.paused ? ' PAUSA' : ''}`;
    document.querySelectorAll<HTMLElement>('[data-warp]').forEach(b => b.classList.toggle('on', +b.dataset.warp! === g.warp));
    $('pause').classList.toggle('on', g.paused);
    document.querySelectorAll<HTMLElement>('[data-tel]').forEach(b => {
      const i = +b.dataset.tel!;
      b.classList.toggle('on', i === s.telAck);
      b.classList.toggle('pending', i === s.telegraph && i !== s.telAck);
    });
    const full = Math.floor(s.air + 1e-6);
    $('air').innerHTML = `<span class="${s.noAir ? 'neg' : ''}">${'●'.repeat(full)}${'○'.repeat(p.airStarts - full)}</span>${s.noAir ? ' SEM AR' : ''}`;
    const helm = $<HTMLInputElement>('helm');
    if (document.activeElement !== helm) helm.value = String(Math.round(s.rudderOrder / D2R));

    const tf = $('trustfill'), tr = g.trust;
    tf.style.left = (tr >= 0 ? 50 : 50 + tr / 2) + '%'; tf.style.width = Math.abs(tr) / 2 + '%';
    tf.style.background = tr >= 0 ? '#2fb85a' : '#e23b3b';
    const fresh = g.time - g.trustNoteAt < 12 && g.trustNote;
    $('trustnote').textContent = fresh ? g.trustNote : `${tr > 0 ? '+' : ''}${Math.round(tr)}`;
    $('trustnote').className = fresh ? (g.trustNote[0] === '▲' ? 'pos' : 'neg') : 'dim';

    const tt = tideText(g.tide); if ($('tide').textContent !== tt) $('tide').textContent = tt;
    $('stw').textContent = (s.stw / KN).toFixed(1);
    const gps = $('gps'), hasPos = g.equip.gps || g.equip.ecdis;
    gps.classList.toggle('off', !hasPos);
    gps.innerHTML = hasPos
      ? `<span class="big">${(g.sog / KN).toFixed(1)}</span> <span class="unit">nós</span> rumo ${g.sog > 0.1 ? deg3(g.cog) : '---'}°`
      : `<span class="big">--.-</span> não instalado`;
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
    if (this.echoT > 1.5 && g.status === 'running' && !g.paused) { this.echoT = 0; this.echo.push(g.ukcMin); if (this.echo.length > 75) this.echo.shift(); }
    this.echoDraw(this.cEcho, g.status === 'menu' ? 99 : g.ukcMin);
    drawDoppler(this.cDoppler, 140, 78, g);

    // --- impelidor de proa
    const thr = g.equip.thruster, tb = $('thrfill');
    $('thrbox').classList.toggle('offbox', !thr);
    tb.style.left = (s.thruster >= 0 ? 50 : 50 + s.thruster * 50) + '%'; tb.style.width = Math.abs(s.thruster) * 50 + '%';
    document.querySelectorAll<HTMLButtonElement>('[data-thr]').forEach(b => { b.disabled = !thr; b.classList.toggle('on', thr && +b.dataset.thr! === s.thrusterOrder); });
    $('thrnote').textContent = !thr ? 'não instalado' : `rende ${Math.round(s.thrusterEff * 100)}% a ${(Math.abs(s.stw) / KN).toFixed(1)} nós`;

    // --- tela multifunção
    if (this.mfd !== 'carta' && !g.equip[this.mfd]) {
      const c = this.cMfd; c.fillStyle = '#05080b'; c.fillRect(0, 0, MFD, MFD);
      c.fillStyle = '#2f4a3c'; c.font = '12px ui-monospace, monospace'; c.textAlign = 'center';
      c.fillText(`${this.mfd.toUpperCase()} não instalado`, MFD / 2, MFD / 2 - 4); c.fillText('ligue na aba Equip.', MFD / 2, MFD / 2 + 12);
    } else if (this.mfd === 'radar') this.radar.draw(this.cMfd, g, dt);
    else if (this.mfd === 'ecdis') this.ecdis.draw(this.cMfd, MFD, g, this.chartBase);
    else {
      const c = this.cMfd, cw = Math.round(MFD * (W.BOUNDS.x1 - W.BOUNDS.x0) / (W.BOUNDS.y1 - W.BOUNDS.y0));
      c.fillStyle = '#e9dfc4'; c.fillRect(0, 0, MFD, MFD);
      c.save(); c.translate((MFD - cw) / 2, 0); this.chart(c, cw, MFD, false); c.restore();
      c.fillStyle = '#3a2a1a'; c.font = '9px ui-monospace, monospace'; c.textAlign = 'left'; c.fillText('C amplia', 4, MFD - 5);
    }
    document.querySelectorAll<HTMLElement>('[data-mfd]').forEach(b => b.classList.toggle('on', b.dataset.mfd === this.mfd));
    $('mfdmode').textContent = this.ecdis.headUp ? 'P' : 'N';
    $<HTMLButtonElement>('mfdmode').disabled = this.mfd !== 'ecdis';
    document.querySelectorAll<HTMLButtonElement>('[data-mfdz]').forEach(b => { b.disabled = this.mfd === 'carta'; });

    // --- abas de operação
    const bk = g.scenario !== 'fundeio' ? g.berth() : null;
    const alert: Record<string, boolean> = {
      radio: g.scenario === 'entrada' && (g.vts === 'none' || (g.vts === 'ok' && !!berthShip(g) && berthShip(g)!.phase === 'berthed' && !berthShip(g)!.asked && g.time < 600) || (g.pilot.state === 'aboard' && (Math.round(s.rudderOrder / D2R) !== g.pilot.helm || s.telegraph !== g.pilot.tel))),
      tugs: g.tugs.some(t => t.state === 'waiting'),
      deck: g.anchor.dragging || (!!bk && Math.abs(bk.along) < 60 && bk.bow < 10 && g.mooring <= 0),
      equip: false,
    };
    document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === this.tab); b.classList.toggle('alert', alert[b.dataset.tab!] && b.dataset.tab !== this.tab); });
    document.querySelectorAll<HTMLElement>('[data-pane]').forEach(el => { el.style.display = el.dataset.pane === this.tab ? '' : 'none'; });
    document.querySelectorAll<HTMLInputElement>('[data-eq]').forEach(cb => { cb.checked = g.equip[cb.dataset.eq as keyof Game['equip']]; cb.disabled = !g.free; });
    $('equipnote').textContent = g.free ? 'Modo livre: ligue e desligue à vontade.' : 'Carreira: o que está ligado foi comprado na oficina do porto.';

    const entry = g.scenario === 'entrada', pl = g.pilot;
    const vts = $<HTMLButtonElement>('vts');
    vts.disabled = g.vts !== 'none' || !entry; vts.classList.toggle('on', g.vts === 'ok' && entry);
    vts.textContent = !entry ? 'VTS: não se aplica' : g.vts === 'none' ? 'Santos VTS: pedir entrada' : g.vts === 'asked' ? 'VTS: aguardando resposta…' : 'VTS: entrada autorizada';
    const bs = berthShip(g), cs = $<HTMLButtonElement>('callship');
    cs.style.display = entry && bs ? '' : 'none';
    if (entry && bs) {
      cs.disabled = bs.phase !== 'berthed' || bs.asked; cs.classList.toggle('on', bs.phase === 'gone' || bs.phase === 'underway');
      const left = Math.max(0, bs.departAt - g.time);
      cs.textContent = bs.phase === 'berthed' ? (bs.asked ? `${bs.name}: larga em ${fmtTime(left).slice(3)}` : `${bs.name} no berço (larga em ${Math.ceil(left / 60)} min): pedir que largue`)
        : bs.phase === 'unberthing' ? `${bs.name}: largando do cais` : bs.phase === 'underway' ? `${bs.name}: saindo pelo canal, berço livre` : 'Berço livre';
    }
    const dg = slowAhead(g), cd = $<HTMLButtonElement>('calldredge');
    cd.style.display = entry && dg ? '' : 'none';
    if (entry && dg) {
      const left = dg.yieldUntil - g.time;
      cd.disabled = left > 0; cd.classList.toggle('on', left > 0);
      cd.textContent = left > 0 ? `Draga ${dg.name}: fora do canal por ${fmtTime(left).slice(3)}` : `Draga ${dg.name} à frente, a 2 nós: pedir passagem`;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-pilot]').forEach(b => { b.disabled = pl.state !== 'none' || !entry; b.classList.toggle('on', pl.state !== 'none' && b.dataset.pilot === pl.grade); });
    const pb = $('pilotbox');
    pb.classList.toggle('off', pl.state === 'none');
    if (pl.state === 'none') pb.innerHTML = 'Sem prático: a manobra é por sua conta';
    else if (pl.state === 'called') pb.innerHTML = pl.eta > 0 ? `${pl.name} embarca em ${fmtTime(pl.eta).slice(3)}` : '<span class="neg">Lancha ao costado: reduza para 7 nós</span>';
    else if (pl.handsOff) pb.innerHTML = '<span class="neg">O prático devolveu a manobra</span><br>gire o navio na bacia; ele retoma com a proa para o mar';
    else {
      const helmOk = Math.round(s.rudderOrder / D2R) === pl.helm, telOk = s.telegraph === pl.tel;
      const hd = pl.helm === 0 ? 'A MEIO' : `${pl.helm < 0 ? 'BB' : 'BE'} ${Math.abs(pl.helm)}`;
      pb.innerHTML = `Ordens do prático<br>leme <span class="big ${helmOk ? '' : 'neg'}">${hd}</span><br>máquina <span class="${telOk ? '' : 'neg'}"><b>${TELEGRAPH_LABELS[pl.tel]}</b></span>`;
    }
    // faixa com as ordens do prático sobre a vista
    const hud = $('pilothud');
    if (pl.state === 'aboard' && g.status === 'running' && pl.handsOff) {
      hud.hidden = false; hud.innerHTML = `<small>${pl.name}</small><span class="todo">O GIRO É COM O SENHOR</span>`;
    } else if (pl.state === 'aboard' && g.status === 'running') {
      const helmOk = Math.round(s.rudderOrder / D2R) === pl.helm, telOk = s.telegraph === pl.tel;
      const hd = pl.helm === 0 ? 'LEME A MEIO' : `${pl.helm < 0 ? 'BOMBORDO' : 'BORESTE'} ${Math.abs(pl.helm)}`;
      hud.hidden = false;
      hud.innerHTML = `<small>${pl.name}</small><span class="${helmOk ? 'ok' : 'todo'}">${hd}</span><span class="${telOk ? 'ok' : 'todo'}">${TELEGRAPH_LABELS[pl.tel]}</span>`;
    } else hud.hidden = true;

    document.querySelectorAll<HTMLElement>('.tug').forEach(el => {
      const t = g.tugs[+el.dataset.tug!];
      el.querySelector<HTMLButtonElement>('[data-tcall]')!.style.display = t.state === 'none' ? '' : 'none';
      el.querySelector<HTMLButtonElement>('[data-tcall]')!.disabled = !entry;
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
      : `${a.state === 'heaving' ? `Virando (${Math.floor(g.heaveLeft / 60)}:${String(Math.floor(g.heaveLeft % 60)).padStart(2, '0')})` : a.paid < a.target - 0.5 ? 'Arriando' : 'Fundeado'}: ${(a.paid / SHACKLE).toFixed(1)} quartéis<br>tensão ${(a.tension / 1000).toFixed(0)} kN ${a.dragging ? '<span class="neg">GARRANDO</span>' : ''}${g.scenario === 'fundeio' && g.holdTime > 0 ? `<br>confirmando: ${Math.max(0, 45 - g.holdTime).toFixed(0)} s` : ''}`;
    const bb = $('berthbox');
    if (g.scenario === 'fundeio') bb.innerHTML = 'não se aplica';
    else if (g.mooring > 0) bb.innerHTML = 'Passando espias…';
    else {
      const b = g.berth(), near = Math.abs(b.along) < 400 && Math.min(b.bow, b.stern) < 150;
      bb.classList.toggle('off', !near);
      bb.innerHTML = near ? `${W.QUAY.name}: ${Math.abs(b.along).toFixed(0)} m ${b.along > 0 ? 'passado' : 'a vante'}<br>por ${W.QUAY.side > 0 ? 'bombordo' : 'boreste'}; proa ≤ 8 m, popa ≤ 35 m, parado` : `${W.QUAY.name}, por ${W.QUAY.side > 0 ? 'bombordo' : 'boreste'} seu: ainda longe`;
    }

    this.big.hidden = !this.bigChart;
    if (this.bigChart) { const c = this.big.getContext('2d')!; this.chart(c, 600, 980, true); }

    const last = g.msgs[g.msgs.length - 1], key = g.msgs.length + (last ? last.t : 0);
    if (key !== this.logCount) {
      this.logCount = key;
      $('log').innerHTML = g.msgs.slice(-6).map(m => `<div class="${m.level}"><span class="t">${fmtTime(m.t)}</span> <b>${m.who}:</b> ${m.text}</div>`).join('');
    }
  }

  private dial(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    c.fillStyle = '#05080b'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.strokeStyle = '#45525e'; c.lineWidth = 2; c.stroke();
  }

  private compass(c: CanvasRenderingContext2D, hdg: number) {
    const S = 112, cx = S / 2, cy = S / 2, r = 51;
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
    const S = 112, cx = S / 2, cy = S / 2, r = 51;
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
    const Wd = 210, H = 92, cx = Wd / 2, cy = 8, r = 72, k = 1.6 * D2R;
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
    const Wd = 124, H = 78, cx = Wd / 2, cy = 62, r = 50;
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
    const Wd = 150, H = 78, max = 15;
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
    c.strokeStyle = '#1f5f99'; c.setLineDash([2, 3]); c.beginPath(); c.arc(X(W.BASIN.x), Y(W.BASIN.y), W.BASIN.r * sx, 0, TAU); c.stroke(); c.setLineDash([]);
    for (const q of W.QUAYS) {
      c.strokeStyle = q.id === W.QUAY.id && g.scenario === 'entrada' ? '#ffe14a' : '#6b5a3a'; c.lineWidth = big ? 5 : 3;
      c.beginPath(); c.moveTo(X(q.cx - q.tx * q.half), Y(q.cy - q.ty * q.half)); c.lineTo(X(q.cx + q.tx * q.half), Y(q.cy + q.ty * q.half)); c.stroke();
    }
    c.lineWidth = 1;
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
      c.fillStyle = '#3a2a1a'; c.font = '10px ui-monospace, monospace';
      for (const q of W.QUAYS) c.fillText(q.name, X(q.cx - q.nx * 260), Y(q.cy - q.ny * 260));
      c.fillText('Bacia de evolução', X(W.BASIN.x), Y(W.BASIN.y + W.BASIN.r + 60));
      c.fillStyle = '#3a2a1a'; c.font = '10px ui-monospace, monospace'; c.textAlign = 'left';
      c.fillText('Carta estilizada: NÃO USAR PARA NAVEGAÇÃO. Sondagens em metros.', 8, h - 8);
    }
    if (g.equip.gps || g.equip.ecdis) {
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
