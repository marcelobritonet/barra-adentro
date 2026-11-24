import { Sound } from './audio/sound';
import { Panel } from './bridge/panel';
import { BERTH, berthSpeedKn, Game, Scenario } from './game/game';
import { makeWaterCanvas, View } from './render/view';
import { D2R } from './sim/ship';
import { KN, TELEGRAPH_LABELS } from './sim/ship';
import * as W from './world/santos';
import { buildGrid } from './world/santos';
import { TIDE_PRESETS, TidePreset } from './world/tide';
import { berthBusy } from './game/traffic';
import { BLIND_BONUS, Sky, SKY } from './game/career';
import { buy, buyShip, CREW, CrewId, Level, loadCareer, maxStars, newCareer, offers, PARTS, PartId, repFor, salaries, saveCareer, shipCost, SHIP_REP } from './game/career';
import { ShipClass, SHIPS } from './sim/ship';

const game = new Game();
const grid = buildGrid();
const view = new View(document.getElementById('world')!, grid, game.p);
const panel = new Panel(game, grid, makeWaterCanvas(grid, 20));
const sound = new Sound();
addEventListener('pointerdown', () => sound.unlock(), true);
addEventListener('keydown', () => sound.unlock(), true);
const overlay = document.getElementById('overlay')!;
const mission = document.getElementById('mission')!;
const help = document.getElementById('help')!;
const warpflag = document.getElementById('warpflag')!;
const fogEl = document.getElementById('fog')!, skyflag = document.getElementById('skyflag')!;
let fogCss = '';

// equipamentos ligados ficam guardados entre partidas
const EQ_KEY = 'barra-adentro.equip';
try { Object.assign(game.equip, JSON.parse(localStorage.getItem(EQ_KEY) ?? '{}')); } catch { /* sem armazenamento */ }
let eqSaved = JSON.stringify(game.equip);
function setAllEquip(on: boolean) { for (const k of Object.keys(game.equip) as (keyof typeof game.equip)[]) game.equip[k] = on; }
const north = document.getElementById('north')!;

/** Lista de passos da missão, com o passo atual em destaque. */
function steps(): [string, boolean][] {
  const s = game.s;
  if (game.scenario === 'entrada') {
    const n = W.nearest(s.x, s.y), b = game.berth(), done = game.result?.ok === true;
    return [
      [`Pedir entrada ao VTS no ponto de chamada, a ${Math.round((W.S_MOUTH - W.CALL_POINT_S) / 100) * 100} m da barra (aba Rádio)`, game.vts === 'ok'],
      ['Berço livre: aguardar ou pedir pelo rádio que o navio largue', !berthBusy(game)],
      ['Cruzar a barra; dali em diante, máximo de 8 nós', n.s > W.S_MOUTH],
      ['Primeira curva a bombordo; cruzar com o navio que sai, bombordo com bombordo', n.s > W.TURNS[3].s + 150],
      ['Segunda curva a bombordo', n.s > W.TURNS[4].s + 150],
      ...(W.QUAY.id === 'ilha' ? [['Terceira curva a bombordo, passando pelo Cais de Santos', n.s > W.TURNS[5].s + 150] as [string, boolean]] : []),
      ...(game.headOut ? (() => {
        const out = Math.atan2(W.QUAY.tx, W.QUAY.ty); let e = Math.abs(s.psi - out); if (e > Math.PI) e = 2 * Math.PI - e;
        const inBasin = Math.hypot(s.x - W.BASIN.x, s.y - W.BASIN.y) < W.BASIN.r, turned = e < 0.5 && n.s > W.QUAY_S - 200;
        return [['Passar do cais e parar na bacia de evolução', inBasin || turned || done || game.mooring > 0], ['Girar o navio: proa para o mar', turned || done || game.mooring > 0]] as [string, boolean][];
      })() : []),
      [`Encostar a proa no berço amarelo (${W.QUAY.name}), por ${W.QUAY.side > 0 ? 'bombordo' : 'boreste'}`, done || game.mooring > 0 || (Math.abs(b.along) <= BERTH.alongMax && b.bow <= BERTH.bowMax)],
      ['Passar as espias (M): os cabos acertam a posição', done || game.mooring > 0],
    ];
  }
  if (game.scenario === 'contrabordo') {
    const b = game.berth(), o = game.sts!, done = game.result?.ok === true || game.mooring > 0;
    const dist = Math.hypot(o.x - s.x, o.y - s.y);
    let dh = Math.abs(s.psi - o.psi); if (dh > Math.PI) dh = 2 * Math.PI - dh;
    return [
      [`Chegar ao N/M ${o.name}, pela popa dele`, done || dist < 450],
      ['Emparelhar pelo boreste dele: paralelo, a menos de 40 m', done || (Math.abs(b.along) < 120 && Math.min(b.bow, b.stern) < 40 && dh < 0.3)],
      ['Encostar a proa nas defensas, a meia-nau dele, quase parado', done || (game.canMoor)],
      ['Passar as espias (M)', done],
    ];
  }
  const a = game.anchor, inZone = Math.hypot(s.x - W.ANCHORAGE.x, s.y - W.ANCHORAGE.y) < W.ANCHORAGE.r, down = a.state === 'down';
  return [
    ['Chegar ao fundeadouro (círculo rosa, a noroeste)', inZone || down],
    ['Tirar o seguimento: menos de 3 nós para largar', down || (inZone && game.sog < 3 * KN)],
    ['Largar o ferro (F)', down],
    ['Aguardar o ferro unhar, com o navio parado', game.holdTime > 0 || game.result?.ok === true],
  ];
}
let missionHtml = '';
function drawMission() {
  const st = steps(), cur = st.findIndex(x => !x[1]);
  const html = `<b>${game.scenario === 'entrada' ? 'Entrada e atracação' : game.scenario === 'contrabordo' ? 'A contrabordo' : 'Fundeio'}</b>` + st.map(([t, d], i) => `<div class="${d ? 'done' : i === cur ? 'now' : ''}">${d ? '✓' : i === cur ? '▶' : '·'} ${t}</div>`).join('');
  if (html !== missionHtml) {
    mission.innerHTML = missionHtml = html;
    // a faixa do prático fica logo abaixo da lista, seja ela curta ou longa
    document.getElementById('pilothud')!.style.top = `${mission.offsetTop + mission.offsetHeight + 10}px`;
  }
}
help.innerHTML = `<h2>AJUDA</h2><p>Clique ou aperte <kbd>H</kbd> para fechar.</p><div class="cols">
  <div><h3>Comandos</h3><table>
    <tr><td><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></td><td>Leme 5° a bombordo / boreste</td></tr>
    <tr><td><kbd>Espaço</kbd></td><td>Leme a meio</td></tr>
    <tr><td><kbd>W</kbd> <kbd>S</kbd> / <kbd>↑</kbd> <kbd>↓</kbd></td><td>Telégrafo: mais adiante / mais a ré</td></tr>
    <tr><td><kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd></td><td>Impelidor de proa: bombordo / zero / boreste</td></tr>
    <tr><td><kbd>F</kbd> <kbd>G</kbd></td><td>Largar / virar o ferro</td></tr>
    <tr><td><kbd>M</kbd></td><td>Passar espias</td></tr>
    <tr><td><kbd>1</kbd>–<kbd>4</kbd>, <kbd>P</kbd></td><td>Tempo 1×, 2×, 4×, 8× / pausa</td></tr>
    <tr><td><kbd>Q</kbd> <kbd>E</kbd>, <kbd>Z</kbd> <kbd>X</kbd></td><td>Girar a vista / zoom</td></tr>
    <tr><td>Arrastar, <kbd>V</kbd></td><td>Arrastar a vista com o mouse para olhar adiante / voltar a centrar no navio</td></tr>
    <tr><td><kbd>C</kbd>, <kbd>T</kbd></td><td>Carta grande / vista superior de teste</td></tr>
    <tr><td><kbd>O</kbd></td><td>Plano de viagem: rumos, velocidades e pontos de guinada</td></tr>
    <tr><td><kbd>B</kbd>, <kbd>N</kbd></td><td>Apito do navio / ligar e desligar o som</td></tr>
  </table></div>
  <div><h3>O que lembrar</h3><table>
    <tr><td>Ordem ≠ efeito</td><td>A máquina leva 6 s para começar a cumprir e 47 s até meia força; o leme, 2 s e mais 19 s até 35°.</td></tr>
    <tr><td>Quebrar a guinada</td><td>Depois de pôr o leme a meio o navio ainda gira dezenas de graus. Use leme contrário antes de chegar ao rumo.</td></tr>
    <tr><td>Leme precisa de água</td><td>Sem seguimento e sem máquina adiante, o leme não governa. Um toque de máquina com leme carregado gira o navio.</td></tr>
    <tr><td>Ar de partida</td><td>Cada partida ou inversão gasta uma de 5 cargas; elas voltam devagar.</td></tr>
    <tr><td>Balizamento</td><td>Entrando: boia encarnada a boreste, verde a bombordo.</td></tr>
    <tr><td>Rebocadores</td><td>Só passam o cabo abaixo de 5 nós. Empurrar leva para bombordo, que é o lado do cais.</td></tr>
    <tr><td>Atracar</td><td>Chegue em ângulo raso seguindo as velocidades do plano. Com a proa a 15 m das defensas e menos de 0,8 nó, passe as espias: os cabos trazem o navio. Encostar de lado a mais de 0,4 nó dá multa.</td></tr>
    <tr><td>Confiança</td><td>Erros e sustos derrubam; manobras limpas levantam. Ela muda a rapidez das ordens e os avisos.</td></tr>
  </table></div>
  <div><h3>O que a janela mostra</h3><table>
    <tr><td>Farol de alinhamento</td><td>Torre listrada no fim de cada reta. Luz branca: você está no eixo. Encarnada: abriu para boreste, o lado das boias encarnadas. Verde: abriu para bombordo.</td></tr>
    <tr><td>Boias</td><td>Deitam para onde a corrente corre e deixam um rastro a jusante. Quanto mais deitadas, mais corrente.</td></tr>
    <tr><td>Fumaça</td><td>Vai com o vento verdadeiro. Sai preta quando a máquina está ganhando rotação.</td></tr>
    <tr><td>Esteira</td><td>Mostra o caminho que a popa fez: curva na guinada, torta quando o navio está derivando.</td></tr>
    <tr><td>Marola de proa</td><td>Cresce com a velocidade na água.</td></tr>
  </table></div></div>`;
help.addEventListener('click', () => { help.hidden = true; });
// ---------------------------------------------------------------- plano de viagem
const planEl = document.getElementById('plan')!, planBox = document.getElementById('planbox')!;
const c3 = (c: number) => String(Math.round((c + 360) % 360) % 360).padStart(3, '0') + '°';
const dec = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
/** Abre o plano de bordo. No começo da viagem o jogo fica parado até zarpar. */
function showPlan(briefing: boolean) {
  const pl = game.plan;
  const rows = pl.steps.map((st, i) => `<tr class="${st.turn ? 'turn' : ''}"><td class="n">${i + 1}</td><td>${st.title}</td>
    <td class="num">${st.course !== undefined ? c3(st.course) : ''}</td><td class="num">${st.dist !== undefined ? Math.round(st.dist / 10) * 10 + ' m' : ''}</td>
    <td>${st.tel !== undefined ? TELEGRAPH_LABELS[st.tel].toLowerCase() : ''}</td><td class="num">${st.sog !== undefined ? dec(st.sog / KN) + ' nós' : ''}</td>
    <td class="num">${st.min !== undefined ? Math.round(st.min) + ' min' : ''}</td><td class="act">${st.action}</td></tr>`).join('');
  const total = pl.steps.reduce((a, st) => a + (st.min ?? 0), 0);
  planEl.innerHTML = `<canvas width="360" height="588"></canvas><div class="body">
    <h2>${pl.title}</h2>
    <table><tr><th>Nº</th><th>Perna</th><th>Rumo</th><th>Dist.</th><th>Máquina</th><th>No fundo</th><th>Tempo</th><th>Ao fim da perna</th></tr>${rows}</table>
    ${total ? `<p>Tempo previsto até o berço: <b>${Math.round(total)} min</b>, sem contar a atracação. Na carta: a derrota a lápis e, em vermelho, onde começa cada guinada.</p>` : ''}
    ${pl.calls.length ? `<table><tr><th>Rádio: onde chamar</th><th>O quê</th><th>Por quê ali</th></tr>${pl.calls.map(c => `<tr><td>${c.where}</td><td class="act">${c.what}</td><td>${c.why}</td></tr>`).join('')}</table>` : ''}
    <ul>${pl.notes.map(n => `<li>${n}</li>`).join('')}</ul>
    <div class="btns">${briefing ? '<button data-plan="go" class="on">⚓ Zarpar</button><button data-plan="back">Voltar ao porto</button>' : '<button data-plan="close" class="on">Fechar (O)</button>'}</div>
  </div>`;
  panel.drawChart(planEl.querySelector('canvas')!.getContext('2d')!, 360, 588);
  planEl.hidden = false;
}
planEl.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  if (b.dataset.plan === 'back') { planEl.hidden = true; game.status = 'menu'; game.paused = false; return menu(); }
  planEl.hidden = true; game.paused = false;
});
let planHtml = '';
/** Na aproximação do berço: a velocidade que o plano pede para a distância em que o navio está. */
function berthLine() {
  if (game.scenario === 'fundeio' || game.mooring > 0) return '';
  const b = game.berth(), d = Math.abs(b.along);
  if (d > 420 || Math.min(b.bow, b.stern) > 220) return '';
  const want = berthSpeedKn(d), have = game.sog / KN, fast = have > want * 1.25 + 0.1;
  const can = game.canMoor;
  return `<div class="${fast ? '' : 'next'}">${fast ? '<span class="now">RÁPIDO</span> ' : ''}Atracação: a ${Math.round(d / 10) * 10} m do berço o plano pede ${dec(want)} nó; você está com ${dec(have)}</div>` + (can ? '<div><span class="now">PODE PASSAR AS ESPIAS (M)</span></div>' : '');
}
/** Quadro com a perna atual do plano e a próxima ação. */
function drawPlanBox() {
  if (game.status !== 'running' || !game.hasPlan) { planBox.hidden = true; return; }
  const pl = game.plan, s = game.s, i = game.planStep, st = pl.steps[i], hasPos = game.equip.gps || game.equip.ecdis;
  let html: string;
  if (game.scenario !== 'entrada') {
    html = `<b>Plano</b>` + pl.steps.map((x, k) => `<div>${k + 1}. ${x.action}</div>`).join('') + berthLine();
  } else {
    const n = W.nearest(s.x, s.y), t = st.turn, endS = st.s + (st.dist ?? 0);
    let hdg = s.psi * 180 / Math.PI;
    const left = (to: number) => Math.abs(((to - hdg + 540) % 360) - 180);
    const turning = t && n.s >= t.s - 5 && left(t.to) > 2;
    html = `<b>Plano · perna ${i + 1} de ${pl.steps.length} · ${st.title}</b>
      <div class="steer">Governar ${c3(st.course!)} · ${TELEGRAPH_LABELS[st.tel!].toLowerCase()}</div>
      <div>previsto ${dec(st.sog! / KN)} nós no fundo</div>`;
    if (turning) html += `<div><span class="now">GUINANDO para ${c3(t!.to)}</span> quebrar com leme contrário aos ${c3(t!.to - Math.sign(t!.helm) * t!.counter)}${left(t!.to) <= t!.counter + 1 ? ' — <b style="display:inline;color:#ffcf6a">AGORA</b>' : ''}</div>`;
    else html += `<div class="next">Depois: ${st.action}</div>`;
    if (hasPos) {
      const d = (t && !turning ? t.s : endS) - n.s;
      if (d > 0) html += `<div class="gps">GPS: faltam ${Math.round(d / 10) * 10} m${game.sog > 0.3 ? ` (${dec(d / game.sog / 60)} min)` : ''} para ${t && !turning ? 'começar a guinada' : 'o fim da perna'}</div>`;
    } else html += `<div class="dim">Sem GPS: vá pelas boias; a proa avisa a de referência.</div>`;
    if (game.vts === 'none') html += n.s >= W.CALL_POINT_S ? `<div><span class="now">RÁDIO: pedir entrada ao VTS agora</span></div>` : `<div class="next">Rádio: pedir entrada ao VTS no ponto de chamada${hasPos ? `, em ${Math.round((W.CALL_POINT_S - n.s) / 10) * 10} m` : ', marcado na carta'}</div>`;
    else if (game.vts === 'asked') html += `<div class="next">Rádio: aguardando o VTS. Não passar da linha de espera.</div>`;
    const toBerth = (W.QUAY.base ?? W.QUAY).s - n.s;
    if (!game.headOut && toBerth > 0 && toBerth < pl.stopAt + 250) html += `<div class="next">Parada: máquina parada a ${Math.round(pl.stopAt / 10) * 10} m do berço${hasPos ? ` (faltam ${Math.round(toBerth / 10) * 10} m)` : ''}</div>`;
    html += berthLine();
  }
  if (html !== planHtml) planBox.innerHTML = planHtml = html;
  planBox.hidden = false;
}

function syncSound() { const b = document.querySelector<HTMLElement>('[data-cam="sound"]'); if (b) { b.textContent = sound.on ? 'Som' : 'Mudo'; b.classList.toggle('on', sound.on); } }
document.getElementById('camctl')!.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  const c = b.dataset.cam;
  if (c === 'rl') view.rotate(-1); if (c === 'rr') view.rotate(1); if (c === 'zi') view.zoom(-1); if (c === 'zo') view.zoom(1);
  if (c === 'center') view.recenter();
  if (c === 'chart') panel.bigChart = !panel.bigChart; if (c === 'help') help.hidden = !help.hidden;
  if (c === 'plan' && game.status === 'running') { if (planEl.hidden) showPlan(false); else planEl.hidden = true; }
  if (c === 'sound') { sound.toggle(); syncSound(); } if (c === 'horn') game.sound();
  b.blur();
});
const money = (v: number) => `<span class="${v >= 0 ? 'pos' : 'neg'}">${v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR')}</span>`;

const sign = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`;

// modo de jogo e carreira ficam guardados entre partidas
const FREE_KEY = 'barra-adentro.livre';
game.career = loadCareer();
try { game.free = localStorage.getItem(FREE_KEY) === '1'; } catch { /* sem armazenamento */ }
let portTab: 'contratos' | 'oficina' | 'tripulacao' | 'estaleiro' = 'contratos', portMsg = '', confirmNew = false;
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

function shopRows(kind: 'part' | 'crew') {
  const c = game.career;
  const row = (id: string, label: string, levels: Level[], have: number) => {
    const cur = levels[have], next = levels[have + 1];
    return `<tr><td><b>${label}</b><br><span class="have">${cur.name}</span><br><small>${cur.effect}${cur.salary ? ` · soldada ${brl(cur.salary)} por viagem` : ''}</small></td>
      <td>${next ? `<b>${next.name}</b><br><small>${next.effect}${next.salary ? ` · soldada ${brl(next.salary)} por viagem` : ''}</small>` : '<span class="pos">Melhor nível</span>'}</td>
      <td>${next ? `<button data-buy="${kind}:${id}" ${c.money < next.price ? 'disabled' : ''}>${kind === 'part' ? 'Comprar' : 'Contratar'}<br>${brl(next.price)}</button>` : ''}</td></tr>`;
  };
  if (kind === 'crew') return `<table class="shop">${(Object.keys(CREW) as CrewId[]).map(k => row(k, CREW[k].label, CREW[k].levels, c.crew[k])).join('')}</table>
    <p class="dim">Tripulante contratado recebe soldada a cada viagem. Se a confiança da tripulação terminar uma viagem em −60 ou menos, o melhor contratado desembarca.</p>`;
  const groups = ['Máquina e governo', 'Instrumentos'] as const;
  return groups.map(gr => `<h3>${gr}</h3><table class="shop">${(Object.keys(PARTS) as PartId[]).filter(k => PARTS[k].group === gr).map(k => row(k, PARTS[k].label, PARTS[k].levels, c.parts[k])).join('')}</table>`).join('');
}

function menu() {
  overlay.hidden = false;
  const c = game.career;
  const head = `<h1>BARRA ADENTRO</h1>
    <div class="modes"><button data-mode="career" class="${game.free ? '' : 'on'}">Carreira</button><button data-mode="free" class="${game.free ? 'on' : ''}">Modo livre</button>
      <span class="dim">${game.free ? 'Sem dinheiro: escolha cenário, maré e equipamentos à vontade.' : 'O navio já sai com o básico. A dificuldade vem do contrato e do navio; o dinheiro compra navios maiores e máquina melhor.'}</span></div>`;
  const foot = `<p class="dim">Confiança da tripulação: <b>${sign(game.trust)}</b> (−100 a +100) <button data-reset="1">Zerar</button> · Ajuda no jogo: <kbd>H</kbd> · A carta é estilizada e não serve para navegação.</p>`;
  if (game.free) {
    overlay.innerHTML = `<div class="card">${head}
      <p>Você comanda o <b>N/M Maré Mansa</b>, um costeiro de 90 m chegando à barra de Santos. O navio demora a obedecer: dê a ordem antes de precisar dela.</p>
      <div class="choices">
        <button data-sc="entrada">▶ Entrada e atracação<small>VTS, prático opcional, berço ocupado por um navio que precisa sair, cruzamento no canal, duas curvas e atracação por bombordo.</small></button>
        <button data-sc="fundeio">▶ Fundeio<small>Fundear entre os navios do fundeadouro externo. Mais curto, bom para aprender.</small></button>
        <button data-sc="contrabordo">▶ A contrabordo<small>Atracar no costado de um navio fundeado, que gira com o vento.</small></button>
      </div>
      <div class="preset">Navio: ${(Object.keys(SHIPS) as ShipClass[]).map(k => `<button data-freeship="${k}" class="${game.freeShip === k ? 'on' : ''}">${SHIPS[k].label}</button>`).join('')}</div>
      <div class="preset">Berço: ${W.QUAYS.map(q => `<button data-berth="${q.id}" class="${game.freeBerth === q.id ? 'on' : ''}">${q.name} (${q.side > 0 ? 'bombordo' : 'boreste'})</button>`).join('')}<button data-headout="1" class="${game.freeHeadOut ? 'on' : ''}" ${game.freeBerth === 'cais' ? '' : 'disabled'}>Aproado ao mar (girar na bacia)</button></div>
      <div class="preset">Céu: ${(Object.keys(SKY) as Sky[]).map(k => `<button data-sky="${k}" class="${game.freeSky === k ? 'on' : ''}">${SKY[k].label}</button>`).join('')}<span class="dim">${SKY[game.freeSky].hint}</span></div>
      <div class="preset">Maré: ${(Object.keys(TIDE_PRESETS) as TidePreset[]).map(k => `<button data-tide="${k}" class="${game.tidePreset === k ? 'on' : ''}">${TIDE_PRESETS[k].label}</button>`).join('')}</div>
      <p class="dim" style="margin-top:0">${TIDE_PRESETS[game.tidePreset].hint} A maré corre 2× mais rápido que a real.</p>
      <div class="preset">Equipamentos: <button data-eq="off" class="${Object.values(game.equip).some(Boolean) ? '' : 'on'}">À moda antiga (nada)</button><button data-eq="on" class="${Object.values(game.equip).every(Boolean) ? 'on' : ''}">Tudo ligado</button><span class="dim">(ou um a um, na aba Equip. do painel)</span></div>
      ${foot}</div>`;
    return;
  }
  const tabs = ([['contratos', 'Contratos'], ['oficina', 'Oficina'], ['tripulacao', 'Tripulação'], ['estaleiro', 'Estaleiro']] as const).map(([k, l]) => `<button data-port="${k}" class="${portTab === k ? 'on' : ''}">${l}</button>`).join('');
  const stars = maxStars(c), list = offers(c);
  const yard = `<table class="shop">${(Object.keys(SHIPS) as ShipClass[]).map(k => {
    const sh = SHIPS[k], mine = c.ship === k, cost = shipCost(c, k);
    return `<tr><td><b>${sh.label}</b>${mine ? ' <span class="have">· seu navio</span>' : ''}<br><small>${sh.blurb}</small></td>
      <td><small>${sh.L} × ${sh.B} m · calado ${String(sh.Tmin).replace('.', ',')} a ${String(sh.Tmax).replace('.', ',')} m · carga ${sh.capacity.toLocaleString('pt-BR')} t<br>${k === 'coaster' ? 'Fretes de tabela' : 'Fretes 2,6× maiores; prazo 15 min mais longo'}${SHIP_REP[k] ? ` · exige reputação ${SHIP_REP[k]}` : ''}</small></td>
      <td>${mine ? '' : `<button data-ship="${k}" ${c.money < cost || c.rep < SHIP_REP[k] ? 'disabled' : ''}>${cost >= 0 ? 'Comprar' : 'Trocar'}<br>${cost >= 0 ? brl(cost) : '+' + brl(-cost)}</button>`}</td></tr>`;
  }).join('')}</table><p class="dim">O navio antigo entra na troca por 60% do preço. Máquina, leme, ar e impelidor ficam com ele; instrumentos e tripulação vão com você.</p>`;
  const body = portTab === 'contratos'
    ? `<div class="contracts">${list.map(ct => { const locked = ct.stars > stars; return `<button data-contract="${ct.id}" ${locked ? 'disabled' : ''}>
        <span class="stars">${'★'.repeat(ct.stars)}${'☆'.repeat(5 - ct.stars)}${locked ? ` · exige reputação ${repFor(ct.stars)}` : ''}</span><b>${ct.title}</b><span class="pay">${brl(ct.freight)}</span>
        <small>${ct.cargo} · calado ${(SHIPS[c.ship].Tmin + (SHIPS[c.ship].Tmax - SHIPS[c.ship].Tmin) * ct.load).toFixed(1).replace('.', ',')} m · maré: ${TIDE_PRESETS[ct.tide].label.toLowerCase()} · prazo ${ct.parMin} min${ct.blind ? ` · <b class="sky" style="color:#ff9a8a">À MODA ANTIGA +${Math.round((BLIND_BONUS - 1) * 100)}%</b>` : ''}${ct.berth === 'ilha' ? ' · <b class="sky">TERMINAL DA ILHA</b>' : ''}${ct.headOut ? ' · <b class="sky">GIRO NA BACIA</b>' : ''}${ct.sky && ct.sky !== 'dia' ? ` · <b class="sky">${SKY[ct.sky].label.toUpperCase()} +${Math.round((SKY[ct.sky].bonus - 1) * 100)}%</b>` : ''}<br>${ct.note}${ct.sky && ct.sky !== 'dia' ? ' ' + SKY[ct.sky].hint : ''}${ct.blind ? ' Instrumentos eletrônicos apagados: só agulha, odômetro, ecobatímetro e o plano de bordo.' : ''}</small></button>`; }).join('')}</div>
       <p class="dim">As ofertas mudam a cada viagem. Entregar bem aumenta a reputação, que libera contratos com mais estrelas e navios maiores.</p>`
    : portTab === 'estaleiro' ? yard : shopRows(portTab === 'oficina' ? 'part' : 'crew');
  overlay.innerHTML = `<div class="card wide">${head}
    <div class="purse"><span>N/M Maré Mansa · ${SHIPS[c.ship].label} · ${c.voyages} viage${c.voyages === 1 ? 'm' : 'ns'} · reputação <b>${Math.round(c.rep)}</b></span><span>Caixa <b class="${c.money >= 0 ? 'pos' : 'neg'}">${brl(c.money)}</b>${salaries(c) ? ` · soldadas ${brl(salaries(c))} por viagem` : ''}</span></div>
    <div class="tabs">${tabs}<span class="sp"></span><button data-newcareer="1" class="${confirmNew ? 'danger' : ''}">${confirmNew ? 'Confirmar: apagar a carreira' : 'Recomeçar'}</button></div>
    ${portMsg ? `<p class="neg">${portMsg}</p>` : ''}
    ${body}
    ${foot}</div>`;
}
function showResult() {
  const r = game.result!;
  overlay.hidden = false;
  overlay.innerHTML = `<div class="card">
    <h2 class="${r.ok ? 'pos' : 'neg'}">${r.title}</h2>
    <p>${r.detail}</p>
    <table>${r.lines.map(([l, v]) => `<tr><td>${l}</td><td>${money(v)}</td></tr>`).join('')}
      <tr class="total"><td>Resultado da viagem</td><td>${money(r.total)}</td></tr>
      ${game.free ? '' : `<tr><td>Caixa</td><td>${money(game.career.money)}</td></tr><tr><td>Reputação</td><td><span class="${r.rep >= 0 ? 'pos' : 'neg'}">${sign(r.rep)}</span> → ${Math.round(game.career.rep)}</td></tr>`}
      <tr><td>Confiança da tripulação</td><td>${sign(r.trustBefore)} → <span class="${r.trustAfter >= r.trustBefore ? 'pos' : 'neg'}">${sign(r.trustAfter)}</span></td></tr></table>
    ${r.left ? '<p class="neg">A tripulação perdeu a confiança em você e alguém desembarcou. O substituto chega desconfiado.</p>' : ''}
    <div class="choices"><button data-again="1">↻ ${game.free ? 'Tentar de novo' : 'Repetir o contrato'}</button><button data-menu="1">${game.free ? '☰ Menu' : '⚓ Voltar ao porto'}</button></div>
  </div>`;
}
function launch(sc: Scenario) {
  game.start(sc); view.recenter();
  panel.reset(); overlay.hidden = true; shown = false; help.hidden = true;
  // antes de zarpar, o plano de bordo; o tempo só corre depois
  game.paused = true; showPlan(true);
}
overlay.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  const d = b.dataset;
  if (!d.newcareer) confirmNew = false;
  portMsg = '';
  if (d.menu) return menu();
  if (d.reset) { game.resetTrust(); return menu(); }
  if (d.eq) { setAllEquip(d.eq === 'on'); return menu(); }
  if (d.tide) { game.tidePreset = d.tide as TidePreset; return menu(); }
  if (d.mode) { game.free = d.mode === 'free'; try { localStorage.setItem(FREE_KEY, game.free ? '1' : '0'); } catch { /* sem armazenamento */ } return menu(); }
  if (d.port) { portTab = d.port as typeof portTab; return menu(); }
  if (d.buy) { const [kind, id] = d.buy.split(':'); portMsg = buy(game.career, kind as 'part' | 'crew', id) ?? ''; saveCareer(game.career); return menu(); }
  if (d.newcareer) { if (!confirmNew) { confirmNew = true; return menu(); } confirmNew = false; game.career = newCareer(); saveCareer(game.career); game.resetTrust(); return menu(); }
  if (d.contract) { const ct = offers(game.career).find(x => x.id === d.contract)!; game.contract = ct; return launch(ct.scenario); }
  if (d.ship) { portMsg = buyShip(game.career, d.ship as ShipClass) ?? ''; saveCareer(game.career); return menu(); }
  if (d.freeship) { game.freeShip = d.freeship as ShipClass; return menu(); }
  if (d.sky) { game.freeSky = d.sky as Sky; return menu(); }
  if (d.berth) { game.freeBerth = d.berth; return menu(); }
  if (d.headout) { game.freeHeadOut = !game.freeHeadOut; return menu(); }
  if (d.again) return launch(game.scenario); // repete o mesmo contrato, com a mesma oferta
  if (d.sc) { game.contract = null; return launch(d.sc as Scenario); }
});

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) return;
  if (e.target instanceof HTMLSelectElement) { if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Enter') return; e.target.blur(); }
  const k = e.key.toLowerCase(), s = game.s;
  const helm = (d: number) => game.setRudderDeg(Math.round(s.rudderOrder / D2R / 5) * 5 + d);
  if (k === 'a' || k === 'arrowleft') helm(-5);
  else if (k === 'd' || k === 'arrowright') helm(5);
  else if (k === ' ') game.setRudderDeg(0);
  else if (k === 'w' || k === 'arrowup') game.setTelegraph(s.telegraph + 1);
  else if (k === 's' || k === 'arrowdown') game.setTelegraph(s.telegraph - 1);
  else if (k === 'f') game.letGoAnchor();
  else if (k === 'g') game.heaveAnchor();
  else if (k === 'm') game.moor();
  else if (k === 'p') game.paused = !game.paused;
  else if ('1234'.includes(k)) game.warp = [1, 2, 4, 8][+k - 1];
  else if (k === 'q') view.rotate(-1);
  else if (k === 'e') view.rotate(1);
  else if (k === 'z') view.zoom(-1);
  else if (k === 'x') view.zoom(1);
  else if (k === 't') view.top = !view.top;
  else if (k === 'c') panel.bigChart = !panel.bigChart;
  else if (k === 'h') help.hidden = !help.hidden;
  else if (k === 'v' || k === 'home') view.recenter();
  else if (k === 'o' && game.status === 'running') { if (planEl.hidden) showPlan(false); else { planEl.hidden = true; game.paused = false; } }
  else if (k === 'b') game.sound();
  else if (k === 'n') { sound.toggle(); syncSound(); }
  else if (k === 'j') game.setThruster(Math.round((s.thrusterOrder - 0.25) * 4) / 4);
  else if (k === 'l') game.setThruster(Math.round((s.thrusterOrder + 0.25) * 4) / 4);
  else if (k === 'k') game.setThruster(0);
  else return;
  e.preventDefault();
});
// arrastar a vista com o mouse para olhar adiante; V ou o botão Centrar volta ao navio
{
  const worldEl = document.getElementById('world')!, centerBtn = document.querySelector<HTMLElement>('[data-cam="center"]')!;
  let dragging = false, lx = 0, ly = 0;
  worldEl.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).tagName !== 'CANVAS' || (e.target as HTMLElement).id === 'bigchart') return;
    dragging = true; lx = e.clientX; ly = e.clientY; worldEl.setPointerCapture(e.pointerId); worldEl.style.cursor = 'grabbing';
  });
  worldEl.addEventListener('pointermove', e => { if (!dragging) return; view.drag(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; centerBtn.hidden = !view.panned; });
  const end = () => { dragging = false; worldEl.style.cursor = ''; centerBtn.hidden = !view.panned; };
  worldEl.addEventListener('pointerup', end); worldEl.addEventListener('pointercancel', end);
  worldEl.addEventListener('dblclick', e => { if ((e.target as HTMLElement).tagName === 'CANVAS') { view.recenter(); centerBtn.hidden = true; } });
}
document.getElementById('world')!.addEventListener('wheel', e => { view.zoom(e.deltaY > 0 ? 1 : -1); e.preventDefault(); }, { passive: false });

// se o painel não couber na altura da janela, ele encolhe inteiro, sem rolagem
const bridge = document.getElementById('bridge')!;
function fit() {
  bridge.style.transform = ''; bridge.style.height = 'auto'; bridge.style.marginLeft = '';
  const k = Math.min(1, innerHeight / bridge.scrollHeight);
  bridge.style.transform = k < 1 ? `scale(${k})` : '';
  bridge.style.height = `${100 / k}%`;
  bridge.style.marginLeft = k < 1 ? `${-500 * (1 - k)}px` : '';
}
addEventListener('resize', fit); fit(); setTimeout(fit, 300);

let last = performance.now(), shown = false;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  game.update(dt);
  view.render(game, dt);
  sound.update(game, dt);
  panel.update(dt);
  north.style.transform = `rotate(${view.compassDeg}deg)`;
  if (game.status !== 'menu') drawMission();
  drawPlanBox();
  const cb = document.querySelector<HTMLElement>('[data-cam="center"]'); if (cb && cb.hidden === view.panned) cb.hidden = !view.panned;
  const flag = game.status === 'running' ? (game.paused ? 'PAUSA' : game.warp > 1 ? `TEMPO ${game.warp}×` : '') : '';
  warpflag.hidden = !flag; if (flag && warpflag.textContent !== flag) warpflag.textContent = flag;
  // nevoeiro: elipse de visibilidade em volta do navio, que fica sempre no centro da vista
  let css = '';
  if (game.sky === 'nevoeiro' && game.status !== 'menu') {
    const r = game.visibility / view.mpp * 3;
    css = `radial-gradient(ellipse ${r.toFixed(0)}px ${(r * view.squash).toFixed(0)}px at ${(view.shipAt.x * 100).toFixed(1)}% ${(view.shipAt.y * 100).toFixed(1)}%, rgba(196,206,212,0.18) 35%, rgba(196,206,212,0.97) 100%)`;
  }
  if (css !== fogCss) fogEl.style.background = fogCss = css;
  const skyTxt = game.status === 'menu' || game.sky === 'dia' ? '' : game.sky === 'noite' ? 'NOITE' : `NEVOEIRO · limite ${game.limitKn} nós`;
  skyflag.hidden = !skyTxt; if (skyTxt && skyflag.textContent !== skyTxt) skyflag.textContent = skyTxt;
  const eq = JSON.stringify(game.equip);
  if (eq !== eqSaved) { eqSaved = eq; try { localStorage.setItem(EQ_KEY, eq); } catch { /* sem armazenamento */ } }
  if (game.status === 'done' && !shown) { shown = true; showResult(); }
  requestAnimationFrame(frame);
}
menu(); syncSound();
requestAnimationFrame(frame);

// acesso para depuração e testes no navegador
Object.assign(window, { game, view, panel, W });
