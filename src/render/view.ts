// Vista do mundo: 3D low-poly, câmera ortográfica isométrica, render em baixa
// resolução ampliado sem suavização (pixel art). Sim (x leste, y norte) -> Three (x, altura, -y).
import * as THREE from 'three';
import { Game } from '../game/game';
import { bodyToWorld, ShipParams } from '../sim/ship';
import * as W from '../world/santos';

const PX = 3;                         // tamanho do pixel na tela
const ZOOMS = [0.6, 1.2, 2.4, 4.8, 9.6]; // metros por pixel
const ELEV = Math.atan(1 / Math.SQRT2);  // isométrica verdadeira

export class View {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -6000, 12000);
  private ship = new THREE.Group();
  private chain: THREE.Line;
  private mark = box(5, 5, 5, 0xffd21a);
  private shipKey = '';
  private tugs: { mesh: THREE.Group; line: THREE.Line }[] = [];
  private others: { mesh: THREE.Group; line: THREE.Line }[] = [];
  private wake: THREE.Mesh[] = [];
  private wakeI = 0; private wakeT = 0;
  private buoys: THREE.Group[] = [];
  private bob = 0;
  quarter = 0; zoomI = 2; top = false;

  constructor(private el: HTMLElement, grid: Float32Array, p: ShipParams) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setClearColor(0x16304f);
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.imageRendering = 'pixelated';
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    sun.position.set(-0.6, 1, 0.35);
    this.scene.add(sun);

    this.scene.add(makeWater(grid), makeLand(grid), makeTown(), makeQuay(), makeZones());
    for (const b of W.BUOYS) { const m = makeBuoy(b.kind); m.position.set(b.x, 0, -b.y); this.buoys.push(m); this.scene.add(m); }
    this.ship.add(makeShip(p)); this.shipKey = `${p.L}/${p.T.toFixed(1)}`;
    this.scene.add(this.ship);

    this.chain = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0x20242c }),
    );
    this.chain.frustumCulled = false;
    this.scene.add(this.chain, this.mark);

    for (let i = 0; i < 2; i++) {
      const mesh = makeTug(), line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf2e6b0 }));
      line.frustumCulled = false; mesh.visible = line.visible = false;
      this.tugs.push({ mesh, line }); this.scene.add(mesh, line);
    }
    const wg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0, depthWrite: false }));
      m.position.y = 0.15; this.wake.push(m); this.scene.add(m);
    }
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
  }

  private resize() {
    const w = Math.max(80, Math.floor(this.el.clientWidth / PX)), h = Math.max(60, Math.floor(this.el.clientHeight / PX));
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
  }
  rotate(dir: number) { this.quarter = (this.quarter + dir + 4) % 4; }
  zoom(dir: number) { this.zoomI = Math.max(0, Math.min(ZOOMS.length - 1, this.zoomI + dir)); }
  get compassDeg() { return this.top ? 0 : (this.quarter * 90 + 45) % 360; }

  render(g: Game, dt: number) {
    const s = g.s;
    // trocou de navio ou de carga: refaz o casco
    const key = `${g.p.L}/${g.p.T.toFixed(1)}`;
    if (key !== this.shipKey) { this.shipKey = key; this.ship.clear(); this.ship.add(makeShip(g.p, 0x1d2733, g.p.L / 90)); }
    this.bob += dt;
    this.ship.position.set(s.x, -0.4 * s.squat, -s.y);
    this.ship.rotation.y = -s.psi;
    this.ship.rotation.z = Math.max(-0.08, Math.min(0.08, -s.r * s.u * 0.25)); // banda na guinada
    this.buoys.forEach((b, i) => {
      b.rotation.z = g.hitBuoys.has(i) ? 1.2 : 0.08 * Math.sin(this.bob * 1.3 + i);
    });

    // esteira
    this.wakeT -= dt * g.warp;
    if (this.wakeT <= 0 && Math.abs(s.u) > 0.4 && g.status === 'running' && !g.paused) {
      this.wakeT = 9 / Math.max(1, Math.abs(s.u));
      const m = this.wake[this.wakeI = (this.wakeI + 1) % this.wake.length];
      const [wx, wy] = bodyToWorld(s, (s.u > 0 ? -1 : 1) * (g.p.L / 2 + 1), 0);
      m.position.set(wx, 0.15, -wy); m.rotation.y = -s.psi;
      m.scale.set(8 + 10 * Math.abs(s.n), 1, 5); (m.material as THREE.MeshBasicMaterial).opacity = 0.75;
    }
    for (const m of this.wake) {
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat.opacity > 0 && !g.paused) { mat.opacity = Math.max(0, mat.opacity - dt * g.warp * 0.02); m.scale.x += dt * g.warp * 0.35; }
    }

    // outros navios
    while (this.others.length < g.traffic.length) {
      const o = g.traffic[this.others.length];
      const mesh = makeShip({ L: o.L, B: o.B, T: 0 } as ShipParams, o.color, o.L / 90), line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x20242c }));
      line.frustumCulled = false; this.others.push({ mesh, line }); this.scene.add(mesh, line);
    }
    this.others.forEach((v, i) => {
      const o = g.traffic[i];
      v.mesh.visible = !!o && o.active; v.line.visible = v.mesh.visible && o.kind === 'anchored';
      if (!o) return;
      v.mesh.position.set(o.x, 0, -o.y); v.mesh.rotation.y = -o.psi;
      if (v.line.visible) {
        const pos = v.line.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, o.x + Math.sin(o.psi) * o.L * 0.47, 4, -(o.y + Math.cos(o.psi) * o.L * 0.47)); pos.setXYZ(1, o.ax, 0.5, -o.ay); pos.needsUpdate = true;
      }
    });

    // rebocadores
    g.tugs.forEach((t, i) => {
      const v = this.tugs[i];
      v.mesh.visible = t.state !== 'none' && g.scenario === 'entrada'; v.line.visible = v.mesh.visible && t.line;
      v.mesh.position.set(t.x, 0, -t.y); v.mesh.rotation.y = -t.psi;
      if (v.line.visible) {
        const [ax, ay] = bodyToWorld(s, t.xf, g.p.B / 2 - 0.5), pos = v.line.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, t.x, 3, -t.y); pos.setXYZ(1, ax, 3.5, -ay); pos.needsUpdate = true;
      }
    });

    // amarra
    const a = g.anchor;
    this.chain.visible = this.mark.visible = a.state === 'down' || a.state === 'heaving';
    this.mark.position.set(a.ax, 1.5, -a.ay); // boia de arinque: onde o ferro está
    if (this.chain.visible) {
      const [bx, by] = bodyToWorld(s, g.geo.bow, 0);
      const pos = this.chain.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, bx, 3, -by); pos.setXYZ(1, a.ax, 1, -a.ay); pos.needsUpdate = true;
    }

    // câmera
    const mpp = ZOOMS[this.zoomI];
    const size = this.renderer.getSize(new THREE.Vector2());
    const c = this.cam;
    c.left = -size.x * mpp / 2; c.right = size.x * mpp / 2; c.top = size.y * mpp / 2; c.bottom = -size.y * mpp / 2;
    c.updateProjectionMatrix();
    const target = new THREE.Vector3(s.x, 0, -s.y);
    if (this.top) {
      c.up.set(0, 0, -1);
      c.position.set(target.x, 3000, target.z);
    } else {
      const az = this.quarter * Math.PI / 2 + Math.PI / 4;
      c.up.set(0, 1, 0);
      c.position.set(target.x + 3000 * Math.cos(ELEV) * Math.sin(az), 3000 * Math.sin(ELEV), target.z + 3000 * Math.cos(ELEV) * Math.cos(az));
    }
    c.lookAt(target);
    // prende a câmera à grade de pixels para a costa não tremer
    c.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
    const ox = c.position.dot(right), oy = c.position.dot(up);
    c.position.addScaledVector(right, Math.round(ox / mpp) * mpp - ox).addScaledVector(up, Math.round(oy / mpp) * mpp - oy);
    this.renderer.render(this.scene, c);
  }
}

// ---------------------------------------------------------------- mundo

function sampleGrid(grid: Float32Array, x: number, y: number) {
  const fx = Math.max(0, Math.min(W.NX - 0.001, (x - W.BOUNDS.x0) / W.CELL)), fy = Math.max(0, Math.min(W.NY - 0.001, (y - W.BOUNDS.y0) / W.CELL));
  const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, n = W.NX + 1;
  const a = grid[j * n + i], b = grid[j * n + i + 1], c = grid[(j + 1) * n + i], d = grid[(j + 1) * n + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Água: textura com as faixas de profundidade, pontilhada nas bordas. */
export function makeWaterCanvas(grid: Float32Array, cell = 5): HTMLCanvasElement {
  const w = (W.BOUNDS.x1 - W.BOUNDS.x0) / cell, h = (W.BOUNDS.y1 - W.BOUNDS.y0) / cell;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let d = sampleGrid(grid, W.BOUNDS.x0 + (i + 0.5) * cell, W.BOUNDS.y1 - (j + 0.5) * cell);
    if (d > 0 && (i + j) % 2 === 0) d += 0.5; // pontilhado entre faixas
    const [r, g, b] = W.depthColor(d), k = (j * w + i) * 4;
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
function makeWater(grid: Float32Array) {
  const tex = new THREE.CanvasTexture(makeWaterCanvas(grid));
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(W.BOUNDS.x1 - W.BOUNDS.x0, W.BOUNDS.y1 - W.BOUNDS.y0).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set((W.BOUNDS.x0 + W.BOUNDS.x1) / 2, 0, -(W.BOUNDS.y0 + W.BOUNDS.y1) / 2);
  return m;
}

function makeLand(grid: Float32Array) {
  const n = W.NX + 1;
  const geo = new THREE.PlaneGeometry(W.BOUNDS.x1 - W.BOUNDS.x0, W.BOUNDS.y1 - W.BOUNDS.y0, W.NX, W.NY).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const i = k % n, jTop = Math.floor(k / n), j = W.NY - jTop; // a malha começa pelo norte
    const d = grid[j * n + i];
    let shore = false;
    for (let dj = -2; dj <= 2 && !shore; dj++) for (let di = -2; di <= 2; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && ii <= W.NX && jj >= 0 && jj <= W.NY && grid[jj * n + ii] > 0) { shore = true; break; }
    }
    const h = d > 0 ? -3 : -d;
    pos.setY(k, d > 0 ? -3 : (shore ? Math.min(h, 1.2) : h));
    const noise = ((i * 73 + j * 151) % 17) / 17;
    if (shore) c.setRGB(0.87, 0.78, 0.58);
    else if (h > 40) c.setRGB(0.2 + 0.05 * noise, 0.42 + 0.06 * noise, 0.22);
    else if (h > 8) c.setRGB(0.27 + 0.05 * noise, 0.52 + 0.06 * noise, 0.25);
    else c.setRGB(0.45 + 0.05 * noise, 0.6 + 0.05 * noise, 0.36);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.position.set((W.BOUNDS.x0 + W.BOUNDS.x1) / 2, 0, -(W.BOUNDS.y0 + W.BOUNDS.y1) / 2);
  return m;
}

/** Cidade de Santos e bairros: caixas instanciadas. */
function makeTown() {
  const spots: [number, number, number, number][] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let x = W.BOUNDS.x0 + 40; x < W.BOUNDS.x1; x += 70) for (let y = W.BOUNDS.y0 + 40; y < W.BOUNDS.y1; y += 70) {
    const d = W.depth(x, y), jx = x + (rnd() - 0.5) * 30, jy = y + (rnd() - 0.5) * 30, pick = rnd(), tall = rnd();
    if (d > -2 || d < -6) continue;                 // só em terra plana
    const [qa, qb] = W.quayLocal(x, y);
    if (Math.abs(qa) < W.QUAY.half + 60 && qb > -130) continue; // área do cais
    if (W.depth(x + 60, y) > 0 || W.depth(x - 60, y) > 0 || W.depth(x, y + 60) > 0 || W.depth(x, y - 60) > 0) continue;
    const santos = x < 150 && y < 2600;
    if (pick > (santos ? 0.7 : 0.22)) continue;
    const beachfront = santos && y < 0;
    spots.push([jx, jy, beachfront ? 25 + tall * 45 : 6 + tall * tall * 22, rnd()]);
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), spots.length);
  const m = new THREE.Matrix4(), palette = [0xe9e2d0, 0xcfc8b8, 0xb9c4cc, 0xe0b48a, 0xa8a39a, 0xf4efe6];
  spots.forEach(([x, y, h, r], i) => {
    const w = 22 + r * 20;
    m.makeScale(w, h, 22 + (1 - r) * 20).setPosition(x, 2.5 + h / 2, -y);
    mesh.setMatrixAt(i, m); mesh.setColorAt(i, new THREE.Color(palette[Math.floor(r * palette.length)]));
  });
  return mesh;
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); return m;
}

function makeQuay() {
  const Q = W.QUAY, g = new THREE.Group();
  g.position.set(Q.cx, 0, -Q.cy);
  g.rotation.y = -Math.atan2(Q.tx, Q.ty); // -Z local = ao longo do cais; +X local = para a água
  g.add(box(70, 3.2, Q.half * 2, 0x8f9499, -35, 1.6, 0));           // plataforma
  g.add(box(1.2, 2.4, Q.half * 2, 0x23262b, 0.6, 1.8, 0));           // defensas
  for (const z of [-110, 0, 110]) g.add(box(34, 13, 80, 0xb9a48a, -50, 9.5, z), box(36, 2, 82, 0x7c4a3a, -50, 17, z));
  for (const z of [-60, 55]) {                                        // guindastes
    g.add(box(6, 28, 6, 0xe0a020, -9, 17, z), box(34, 3, 4, 0xe0a020, 2, 30, z), box(8, 6, 8, 0xf2f2f2, -9, 33, z));
  }
  for (let z = -Q.half + 10; z < Q.half; z += 32) g.add(box(1.4, 1.4, 1.4, 0x2b2b2b, -2.5, 3.9, z)); // cabeços
  // marcação do berço
  const pts = [[2, 55], [18, 55], [18, -55], [2, -55]].map(([x, z]) => new THREE.Vector3(x, 0.3, z));
  const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffe14a }));
  g.add(loop);
  return g;
}

function makeZones() {
  const A = W.ANCHORAGE, pts: THREE.Vector3[] = [];
  for (let i = 0; i < 72; i += 2) for (const k of [i, i + 1]) {
    const a = (k / 72) * Math.PI * 2;
    pts.push(new THREE.Vector3(A.x + A.r * Math.sin(a), 0.3, -(A.y + A.r * Math.cos(a))));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff7ad9 }));
}

function makeBuoy(kind: string) {
  const g = new THREE.Group(), col = kind === 'red' ? 0xe23b3b : kind === 'green' ? 0x2fb85a : 0x1c1c1c;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 4, 6), new THREE.MeshLambertMaterial({ color: col })));
  const top = kind === 'red'
    ? new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 6), new THREE.MeshLambertMaterial({ color: col }))       // cônica
    : new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 8, 6), new THREE.MeshLambertMaterial({ color: kind === 'green' ? col : 0xe23b3b })); // cilíndrica
  top.position.y = 6.5; g.add(top);
  return g;
}

function makeTug() {
  const g = new THREE.Group();
  g.add(box(8, 3, 22, 0x1c1f24, 0, 0.9, 0), box(7, 0.4, 20, 0xa63a2e, 0, 2.5, 0));   // casco e convés
  g.add(box(6, 1.6, 2, 0x111111, 0, 1.6, -11.5));                                     // defensa de proa
  g.add(box(5.5, 4, 7, 0xf1f1ea, 0, 4.6, -3), box(5.7, 1.2, 7.2, 0x2a3d55, 0, 5.6, -3)); // casaria
  g.add(box(1.6, 3.5, 1.6, 0xe8c040, 0, 7.4, 1.5), box(1, 1.4, 1, 0x2b2b2b, 0, 3.4, 7));  // chaminé e gato de reboque
  return g;
}

function makeShip(p: ShipParams, hullColor = 0x1d2733, k = 1) {
  const g = new THREE.Group(), hb = p.B / 2, hl = p.L / 2;
  const outline = (inset: number) => {
    const b = hb - inset, l = hl - inset, sh = new THREE.Shape();
    sh.moveTo(0, l); sh.lineTo(b * 0.55, l - 9); sh.lineTo(b, l - 22); sh.lineTo(b, -l + 6);
    sh.lineTo(b * 0.7, -l); sh.lineTo(-b * 0.7, -l); sh.lineTo(-b, -l + 6); sh.lineTo(-b, l - 22); sh.lineTo(-b * 0.55, l - 9);
    sh.closePath(); return sh;
  };
  // borda livre: pontal menos calado (navio maior tem pontal maior); nos navios de cenário, um valor fixo
  const free = p.T > 0 ? Math.max(1.6, (p.L > 100 ? 11 : 8) - p.T) : 7;
  const ex = (inset: number, h: number, y: number, color: number) => {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(inset), { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color }));
    m.position.y = y; return m;
  };
  g.add(ex(0, 1.6, -0.6, 0x9c2b25));          // obras vivas
  g.add(ex(0, free - 1, 1, hullColor));       // costado
  g.add(ex(0.7, 0.3, free, 0x5e7d5a));        // convés
  const hw = p.B - 4.5, aft = hl - 12, n = Math.max(2, Math.round((p.L - 40) / 24)), span = (p.L - 44) / n;
  for (let i = 0; i < n; i++) g.add(box(hw, 1.6, span - 3, 0x3c5a48, 0, free + 1.1, -hl + 20 + span * (i + 0.5))); // escotilhas
  g.add(box(1, 12, 1, 0xe8c040, 0, free + 6, -hl + 20 + span));                                                     // pau de carga
  g.add(box(4, 2, 5, hullColor, 0, free + 1, -hl + 9));                                                              // castelo
  g.add(box(p.B - 2, 6 * k, 10, 0xf1f1ea, 0, free + 3 * k, aft), box(p.B, 2.6, 7, 0xf1f1ea, 0, free + 6 * k + 1.3, aft - 1.5)); // superestrutura + passadiço
  g.add(box(p.B - 3, 0.5, 4.5, 0x2a3d55, 0, free + 6 * k + 1.6, aft - 4.8));                                         // vidros
  g.add(box(3.2, 5, 3.2, 0xd9622b, 0, free + 6 * k + 3.5, aft + 4), box(3.4, 1, 3.4, 0x1a1a1a, 0, free + 6 * k + 6.4, aft + 4)); // chaminé
  g.add(box(0.6, 6, 0.6, 0xf1f1ea, 0, free + 6 * k + 5.5, aft - 2));                                                 // mastro
  return g;
}
