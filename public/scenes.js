// Big-screen animations for the 50 picture questions.
//
// Every scene is `async (stage, data, ctx)`. The stage is a 16:9 box with
// `container-type: size`, so sizes use cqh/cqw units and positions use %.
// ctx.sleep() throws once the scene is torn down, which stops the animation.

const STOP = Symbol('stop');

function makeCtx(stage) {
  const ctx = {
    alive: () => stage.isConnected && !stage.dataset.stopped,
    async sleep(ms) {
      await new Promise((r) => setTimeout(r, ms));
      if (!ctx.alive()) throw STOP;
    },
    // Run fn(i) at each time in `times` (ms from now). Resolves after the last one.
    async schedule(times, fn) {
      const t0 = performance.now();
      for (let i = 0; i < times.length; i++) {
        const wait = t0 + times[i] - performance.now();
        if (wait > 0) await ctx.sleep(wait);
        else if (!ctx.alive()) throw STOP;
        fn(i);
      }
    },
  };
  return ctx;
}

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pickr = (list) => list[Math.floor(Math.random() * list.length)];
const shuffled = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function put(parent, content, { x = 50, y = 50, size = 8, z, cls, style } = {}) {
  const el = document.createElement('div');
  el.className = 's-item' + (cls ? ' ' + cls : '');
  if (content instanceof Node) el.append(content);
  else el.textContent = content;
  Object.assign(el.style, { left: x + '%', top: y + '%', fontSize: size + 'cqh' }, z != null ? { zIndex: z } : {}, style || {});
  parent.append(el);
  return el;
}

function box(parent, { x, y, w, h, bg, radius, z, cls, style } = {}) {
  const el = document.createElement('div');
  el.className = 's-box' + (cls ? ' ' + cls : '');
  Object.assign(el.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' }, bg ? { background: bg } : {}, radius != null ? { borderRadius: radius } : {}, z != null ? { zIndex: z } : {}, style || {});
  parent.append(el);
  return el;
}

const anim = (el, frames, opts) => el.animate(frames, typeof opts === 'number' ? { duration: opts, fill: 'forwards' } : { fill: 'forwards', ...opts }).finished.catch(() => {});
const C = (x, y, extra = '') => ({ transform: `translate(-50%, -50%) ${extra}`, left: x + '%', top: y + '%' });

// Jittered-grid positions so things spread out but don't line up neatly.
function scatter(n, { x0 = 6, x1 = 94, y0 = 10, y1 = 90, jitter = 0.35 } = {}) {
  const aspect = ((x1 - x0) * 16) / ((y1 - y0) * 9);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * aspect)));
  const rows = Math.ceil(n / cols) + (n > 6 ? 1 : 0);
  const cells = shuffled([...Array(cols * rows).keys()]).slice(0, n);
  const cw = (x1 - x0) / cols;
  const ch = (y1 - y0) / rows;
  return cells.map((c) => ({
    x: x0 + (c % cols + 0.5 + rand(-jitter, jitter)) * cw,
    y: y0 + (Math.floor(c / cols) + 0.5 + rand(-jitter, jitter)) * ch,
  }));
}

function cover(stage, text = '\u{1F648}', sub = '') {
  const el = document.createElement('div');
  el.className = 's-cover';
  el.innerHTML = `<div class="s-cover-big"></div><div class="s-cover-sub"></div>`;
  el.firstChild.textContent = text;
  el.lastChild.textContent = sub;
  stage.append(el);
  anim(el, [{ opacity: 0 }, { opacity: 1 }], 350);
  return el;
}

const BG = {
  sky: 'linear-gradient(#7ec8ff, #c9ecff)',
  night: 'radial-gradient(ellipse at 50% 120%, #2b2a6b, #0a0a1f 70%)',
  grass: 'linear-gradient(#9fe0ff 0 55%, #6cc76a 55%)',
  water: 'linear-gradient(#3fb4e6, #1b5f9e)',
  dirt: 'linear-gradient(#e7c79a, #c79b62)',
  stage: 'radial-gradient(ellipse at 50% 40%, #463c8c, #17132f 75%)',
  paper: '#fbf7ec',
};

function dieFace(n, sizeCqh) {
  const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n];
  const el = document.createElement('div');
  el.className = 's-die';
  el.style.width = el.style.height = sizeCqh + 'cqh';
  for (let i = 0; i < 9; i++) {
    const p = document.createElement('i');
    if (pips.includes(i)) p.className = 'on';
    el.append(p);
  }
  return el;
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function svgLayer(stage, viewBox = '0 0 160 90') {
  const svg = svgEl('svg', { viewBox, class: 's-svg' });
  stage.append(svg);
  return svg;
}

const SCENES = {
  // ---------------------------------------------------------------- counting
  async balloons(stage, d, ctx) {
    stage.style.background = BG.sky;
    const els = scatter(d.count, { y0: 8, y1: 92 }).map(({ x, y }) =>
      put(stage, '\u{1F388}', { x, y, size: 9, cls: 'bob', style: { filter: `hue-rotate(${randi(0, 360)}deg) saturate(1.3)`, animationDelay: `${rand(0, 2)}s` } }));
    await ctx.sleep(d.intactMs);
    for (const el of shuffled(els)) {
      el.textContent = '\u{1F4A5}';
      el.style.filter = 'none';
      anim(el, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' }], 350).then(() => el.remove());
      await ctx.sleep(d.popEveryMs);
    }
  },

  async blinks(stage, d, ctx) {
    stage.style.background = 'radial-gradient(circle, #ffe7a8, #f3b562)';
    const face = box(stage, { x: 30, y: 8, w: 40, h: 84, bg: '#ffd23f', radius: '50%', cls: 'face' });
    face.style.boxShadow = 'inset -2cqh -3cqh 0 rgba(0,0,0,.08)';
    const eyes = [32, 68].map((ex) => {
      const eye = box(face, { x: ex - 11, y: 28, w: 22, h: 26, bg: '#fff', radius: '50%', style: { border: '0.6cqh solid #3a2a00' } });
      const pupil = box(eye, { x: 32, y: 32, w: 36, h: 36, bg: '#2a1f00', radius: '50%' });
      return { eye, pupil };
    });
    const mouth = box(face, { x: 35, y: 68, w: 30, h: 8, bg: '#8a3b12', radius: '0 0 50cqh 50cqh' });
    const look = setInterval(() => {
      const [dx, dy] = [rand(-20, 20), rand(-15, 15)];
      eyes.forEach(({ pupil }) => anim(pupil, [{ transform: `translate(${dx}%, ${dy}%)` }], 250));
    }, 900);
    try {
      await ctx.schedule(d.times, () => eyes.forEach(({ eye }) => eye.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.06)' }, { transform: 'scaleY(1)' }], 170)));
      await ctx.sleep(400);
    } finally {
      clearInterval(look);
    }
    eyes.forEach(({ eye }) => anim(eye, [{ transform: 'scale(1.35)' }], 300));
    anim(mouth, [{ height: '14%', borderRadius: '50%' }], 300);
  },

  async sheep(stage, d, ctx) {
    stage.style.background = BG.grass;
    const fence = box(stage, { x: 46, y: 58, w: 8, h: 22, z: 2, cls: 'fence' });
    fence.innerHTML = '<i></i><i></i><i></i>';
    await ctx.schedule(d.times, (i) => {
      const el = put(stage, d.seq[i] === 's' ? '\u{1F411}' : '\u{1F410}', { x: 110, y: 68, size: 13, z: 3 });
      anim(el, [
        { ...C(110, 68), offset: 0 },
        { ...C(62, 68), offset: 0.38 },
        { ...C(50, 38, 'rotate(-12deg)'), offset: 0.5 },
        { ...C(38, 68), offset: 0.62 },
        { ...C(-12, 68), offset: 1 },
      ], { duration: 1900 }).then(() => el.remove());
    });
    await ctx.sleep(1900);
  },

  async jellybeans(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#ffe3f1, #ffc4e1)';
    box(stage, { x: 36, y: 46, w: 28, h: 50, z: 4, cls: 'jar' }).innerHTML = '<span>CANDY</span>';
    await ctx.schedule(d.times, () => {
      const x = rand(42, 58);
      const el = put(stage, pickr(['\u{1F36C}', '\u{1F36C}', '\u{1F36D}', '\u{1F36B}']), { x, y: -8, size: 7, z: 3, style: { filter: `hue-rotate(${randi(0, 360)}deg)` } });
      anim(el, [{ ...C(x, -8, 'rotate(0deg)') }, { ...C(x, 60, `rotate(${randi(-200, 200)}deg)`) }], { duration: 650, easing: 'ease-in' }).then(() => el.remove());
    });
    await ctx.sleep(800);
  },

  async bounces(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#bfe6ff 0 82%, #7a5c3a 82%)';
    const total = d.gaps.reduce((a, b) => a + b, 0) + 900;
    const lane = box(stage, { x: 8, y: 0, w: 0.1, h: 100 });
    const ball = put(lane, '⚽', { x: 0, y: 15, size: 12 });
    anim(lane, [{ left: '8%' }, { left: '90%' }], { duration: total, easing: 'linear' });
    let top = 15;
    for (const g of d.gaps) {
      await anim(ball, [{ top: top + '%', transform: 'translate(-50%,-50%)' }, { top: '75%', transform: 'translate(-50%,-50%) scale(1.15, 0.8)' }], { duration: g / 2, easing: 'ease-in' });
      if (!ctx.alive()) throw STOP;
      top = rand(15, 55);
      await anim(ball, [{ top: '75%', transform: 'translate(-50%,-50%) scale(1.15,0.8)' }, { top: top + '%', transform: 'translate(-50%,-50%)' }], { duration: g / 2, easing: 'ease-out' });
      if (!ctx.alive()) throw STOP;
    }
    await anim(ball, [{ top: top + '%' }, { top: '-20%' }], 500);
  },

  async fishtank(stage, d, ctx) {
    stage.style.background = BG.water;
    for (let i = 0; i < 6; i++) put(stage, pickr(['\u{1FAB8}', '\u{1F33F}', '\u{1FAA8}']), { x: rand(5, 95), y: 90, size: 10, style: { opacity: 0.8 } });
    for (let i = 0; i < d.count; i++) {
      const y = rand(10, 82);
      const [a, b] = [rand(5, 45), rand(55, 95)];
      const el = put(stage, pickr(['\u{1F420}', '\u{1F41F}', '\u{1F421}']), { x: a, y, size: rand(7, 11) });
      el.animate([
        { left: a + '%', top: y + '%', transform: 'translate(-50%,-50%) scaleX(-1)', offset: 0 },
        { left: b + '%', top: y + rand(-6, 6) + '%', transform: 'translate(-50%,-50%) scaleX(-1)', offset: 0.49 },
        { left: b + '%', top: y + rand(-6, 6) + '%', transform: 'translate(-50%,-50%) scaleX(1)', offset: 0.5 },
        { left: a + '%', top: y + '%', transform: 'translate(-50%,-50%) scaleX(1)', offset: 1 },
      ], { duration: rand(5000, 9000), iterations: Infinity, delay: -rand(0, 8000) });
    }
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F4A1}', 'Lights out!');
  },

  async fireworks(stage, d, ctx) {
    stage.style.background = BG.night;
    box(stage, { x: 0, y: 85, w: 100, h: 15, bg: '#05050f' });
    await ctx.schedule(d.times, () => {
      const x = rand(10, 90);
      const y = rand(15, 55);
      const el = put(stage, pickr(['\u{1F386}', '\u{1F387}']), { x, y, size: rand(16, 26), style: { filter: `hue-rotate(${randi(0, 360)}deg)` } });
      anim(el, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(0.1)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.3 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4)' }], 1000).then(() => el.remove());
    });
    await ctx.sleep(1000);
  },

  async shootingstars(stage, d, ctx) {
    stage.style.background = BG.night;
    for (let i = 0; i < 45; i++) put(stage, '✦', { x: rand(2, 98), y: rand(2, 95), size: rand(1.5, 3.5), cls: 'twinkle', style: { color: '#fffbe0', animationDelay: `${rand(0, 3)}s` } });
    put(stage, '\u{1F30D}', { x: 50, y: 118, size: 60 });
    await ctx.schedule(d.times, () => {
      const x = rand(30, 95);
      const y = rand(5, 40);
      const el = box(stage, { x, y, w: 14, h: 0.8, cls: 'streak' });
      anim(el, [{ transform: 'rotate(-30deg) translateX(0)', opacity: 1 }, { transform: 'rotate(-30deg) translateX(-180%)', opacity: 0 }], { duration: 700, easing: 'ease-in' }).then(() => el.remove());
    });
    await ctx.sleep(800);
  },

  async ducks(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#a5dcff 0 50%, #79c86b 50% 70%, #4aa3d8 70%)';
    await ctx.schedule(d.times, () => {
      const y = rand(58, 66);
      const el = put(stage, '\u{1F986}', { x: 110, y, size: 11, cls: 'waddle' });
      anim(el, [{ left: '110%' }, { left: '-10%' }], { duration: d.crossMs, easing: 'linear' }).then(() => el.remove());
    });
    await ctx.sleep(d.crossMs);
  },

  async popcorn(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#ffefc2, #ffd27a)';
    box(stage, { x: 34, y: 66, w: 32, h: 30, bg: '#4b4b5a', radius: '0 0 6cqh 6cqh', z: 3 });
    box(stage, { x: 31, y: 63, w: 38, h: 6, bg: '#6a6a7c', radius: '2cqh', z: 4 });
    await ctx.schedule(d.times, () => {
      const x = rand(40, 60);
      const el = put(stage, '\u{1F37F}', { x, y: 68, size: 8, z: 2 });
      const tx = x + rand(-30, 30);
      anim(el, [{ ...C(x, 68) }, { ...C((x + tx) / 2, rand(5, 30), `rotate(${randi(-180, 180)}deg)`), offset: 0.5 }, { ...C(tx, 70, 'rotate(360deg)'), opacity: 0 }], { duration: 1100, easing: 'ease-out' }).then(() => el.remove());
    });
    await ctx.sleep(1100);
  },

  async froghops(stage, d, ctx) {
    stage.style.background = BG.water;
    for (let i = 0; i < 8; i++) box(stage, { x: 4 + i * 12, y: 66 + rand(-4, 4), w: 10, h: 10, bg: '#3fae4a', radius: '50%' });
    let x = 10;
    const frog = put(stage, '\u{1F438}', { x, y: 66, size: 12, z: 2 });
    await ctx.schedule(d.times, () => {
      let nx;
      do { nx = rand(8, 92); } while (Math.abs(nx - x) < 15);
      anim(frog, [{ ...C(x, 66) }, { ...C((x + nx) / 2, rand(20, 40)), offset: 0.5 }, { ...C(nx, 66) }], { duration: 330, easing: 'ease-in-out' });
      x = nx;
    });
    await ctx.sleep(500);
    frog.textContent = '\u{1F4A6}';
  },

  async cookie(stage, d, ctx) {
    const bg = '#b9ddff';
    stage.style.background = bg;
    const ck = box(stage, { x: 31, y: 10, w: 38, h: 80, bg: '#d9a35b', radius: '50%', cls: 'cookie' });
    for (let i = 0; i < 12; i++) box(ck, { x: rand(15, 75), y: rand(15, 75), w: 8, h: 8, bg: '#4a2a12', radius: '40%' });
    const muncher = put(stage, '\u{1F62E}', { x: 85, y: 50, size: 16 });
    await ctx.schedule(d.times, () => {
      const a = rand(0, Math.PI * 2);
      const bite = box(ck, { x: 50 + Math.cos(a) * 46 - 13, y: 50 + Math.sin(a) * 46 - 13, w: 26, h: 26, bg, radius: '50%' });
      anim(bite, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], 120);
      muncher.textContent = '\u{1F60B}';
      setTimeout(() => (muncher.textContent = '\u{1F62E}'), 250);
    });
    await ctx.sleep(500);
    await anim(ck, [{ transform: 'translateX(0)' }, { transform: 'translateX(-150%) rotate(-90deg)' }], 600);
  },

  async pinksnow(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#24305e, #4a5a9a)';
    await ctx.schedule(d.times, (i) => {
      const x = rand(4, 96);
      const el = put(stage, '❅', { x, y: -6, size: rand(5, 8), style: { color: d.seq[i] ? '#ff5fbf' : '#ffffff', textShadow: '0 0 1cqh rgba(255,255,255,.6)' } });
      anim(el, [{ ...C(x, -6, 'rotate(0)') }, { ...C(x + rand(-8, 8), 108, `rotate(${randi(-360, 360)}deg)`) }], { duration: d.fallMs, easing: 'linear' }).then(() => el.remove());
    });
    await ctx.sleep(d.fallMs);
  },

  async apples(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#e9f7d8, #c4e8a0)';
    scatter(d.items.length).forEach(({ x, y }, i) => put(stage, d.items[i], { x, y, size: 8.5, style: { transform: `translate(-50%,-50%) rotate(${randi(-30, 30)}deg)` } }));
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F9FA}', 'Time’s up!');
  },

  async ladybug(stage, d, ctx) {
    stage.style.background = 'radial-gradient(circle, #8fdc6a, #3e9a3a)';
    const bug = box(stage, { x: 32, y: 12, w: 36, h: 80, cls: 'ladybug' });
    box(bug, { x: 30, y: -12, w: 40, h: 30, bg: '#111', radius: '50% 50% 30% 30%' });
    const body = box(bug, { x: 0, y: 5, w: 100, h: 95, bg: '#e8262b', radius: '50%' });
    box(body, { x: 49.3, y: 2, w: 1.4, h: 96, bg: '#111' });
    const spots = [];
    let guard = 0;
    while (spots.length < d.spots && guard++ < 5000) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 40;
      const p = { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
      if (Math.abs(p.x - 50) < 5) continue;
      if (spots.every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 12)) spots.push(p);
    }
    for (const s of spots) box(body, { x: s.x - 4.5, y: s.y - 4.5, w: 9, h: 9, bg: '#111', radius: '50%' });
    await ctx.sleep(d.showMs);
    await anim(bug, [{ transform: 'none' }, { transform: 'translate(80%, -140%) scale(0.2) rotate(40deg)' }], { duration: 900, easing: 'ease-in' });
  },

  async dominoes(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#f6e7cb, #d8b98c)';
    const perRow = 11;
    const rows = Math.ceil(d.count / perRow);
    const els = [];
    for (let i = 0; i < d.count; i++) {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const col = r % 2 === 0 ? c : perRow - 1 - c;
      const x = 8 + col * (84 / (perRow - 1)) + rand(-1, 1);
      const y = 20 + r * (60 / Math.max(1, rows - 1 || 1)) + (rows === 1 ? 25 : 0);
      els.push({ el: put(stage, '', { x, y, size: 1, cls: 'domino' }), dir: r % 2 === 0 ? 1 : -1 });
    }
    await ctx.sleep(d.standMs);
    for (const { el, dir } of els) {
      anim(el, [{ transform: 'translate(-50%,-50%) rotate(0deg)' }, { transform: `translate(-50%,-50%) rotate(${dir * 75}deg)` }], { duration: 220, easing: 'ease-in' });
      await ctx.sleep(d.stepMs);
    }
    await ctx.sleep(500);
    els.forEach(({ el }) => anim(el, [{ opacity: 1 }, { opacity: 0 }], 400));
  },

  async train(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#bde7ff 0 62%, #8a6b4a 62% 66%, #6db35f 66%)';
    const row = document.createElement('div');
    row.className = 's-row';
    row.style.fontSize = '11cqh';
    row.textContent = '\u{1F682}' + d.cars.join('');
    row.style.top = '50%';
    stage.append(row);
    const sw = stage.clientWidth;
    await anim(row, [{ transform: `translate(${sw}px, -50%)` }, { transform: `translate(${-row.offsetWidth}px, -50%)` }], { duration: d.crossMs, easing: 'linear' });
  },

  async elevator(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#dfe8f5, #b8c6dd)';
    const shaft = box(stage, { x: 8, y: 4, w: 18, h: 92, bg: '#5a6478', radius: '1cqh' });
    for (let f = 1; f <= 15; f++) box(shaft, { x: 0, y: 100 - (f / 15) * 100, w: 100, h: 0.4, bg: '#8893a8' });
    const floorTop = (f) => 100 - (f / 15) * 100;
    const car = box(shaft, { x: 10, y: floorTop(d.start), w: 80, h: 100 / 15, bg: '#ffd23f', radius: '0.6cqh', style: { boxShadow: 'inset 0 0 0 0.5cqh #b38f00' } });
    car.textContent = '\u{1F9CD}';
    Object.assign(car.style, { display: 'grid', placeItems: 'center', fontSize: '4cqh' });
    const card = put(stage, '', { x: 62, y: 50, size: 9, cls: 's-card' });
    card.textContent = `Start: floor ${d.start}`;
    await ctx.sleep(1500);
    let floor = d.start;
    for (const m of d.moves) {
      card.textContent = m > 0 ? `⬆️ Up ${m}` : `⬇️ Down ${-m}`;
      anim(card, [{ transform: 'translate(-50%,-50%) scale(.6)' }, { transform: 'translate(-50%,-50%) scale(1)' }], 250);
      floor += m;
      anim(car, [{ top: floorTop(floor) + '%' }], { duration: 1200, easing: 'ease-in-out' });
      await ctx.sleep(d.stepMs);
    }
    card.textContent = 'Ding! \u{1F514}';
  },

  async bus(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#bfe6ff 0 70%, #555 70% 72%, #888 72%)';
    const bus = put(stage, '\u{1F68C}', { x: 50, y: 55, size: 40, z: 3 });
    const sign = put(stage, `${d.start} riders on board`, { x: 50, y: 12, size: 7, cls: 's-card' });
    const people = ['\u{1F9CD}', '\u{1F9CD}‍♀️', '\u{1F9D2}', '\u{1F475}', '\u{1F474}', '\u{1F9D1}'];
    await ctx.sleep(2000);
    for (let s = 0; s < d.stops.length; s++) {
      const { on, off } = d.stops[s];
      sign.textContent = `\u{1F68F} Stop ${s + 1}`;
      await anim(bus, [{ ...C(50, 55, 'rotate(-2deg)') }, { ...C(50, 55, 'rotate(0)') }], 300);
      for (let i = 0; i < off; i++) {
        const p = put(stage, pickr(people), { x: 45, y: 62, size: 10, z: 2 });
        anim(p, [{ left: '45%' }, { left: '-8%' }], 900).then(() => p.remove());
        await ctx.sleep(d.perPersonMs);
      }
      for (let i = 0; i < on; i++) {
        const p = put(stage, pickr(people), { x: 108, y: 62, size: 10, z: 4 });
        anim(p, [{ left: '108%' }, { left: '55%', opacity: 1, offset: 0.9 }, { left: '52%', opacity: 0 }], 900).then(() => p.remove());
        await ctx.sleep(d.perPersonMs);
      }
      await ctx.sleep(d.pauseMs);
    }
    sign.textContent = '\u{1F68C} Last stop!';
  },

  async tally(stage, d, ctx) {
    stage.style.background = BG.paper;
    const groups = [];
    for (let left = d.count; left > 0; left -= 5) groups.push(Math.min(5, left));
    scatter(groups.length, { x0: 8, x1: 92, y0: 12, y1: 88 }).forEach(({ x, y }, i) => {
      const n = groups[i];
      const svg = svgEl('svg', { viewBox: '0 0 40 40', class: 's-tally' });
      for (let k = 0; k < Math.min(4, n); k++) svg.append(svgEl('line', { x1: 6 + k * 8, y1: 4, x2: 6 + k * 8 + rand(-1, 1), y2: 36, stroke: '#222', 'stroke-width': 3, 'stroke-linecap': 'round' }));
      if (n === 5) svg.append(svgEl('line', { x1: 1, y1: 30, x2: 36, y2: 8, stroke: '#c22', 'stroke-width': 3, 'stroke-linecap': 'round' }));
      const el = put(stage, svg, { x, y, size: 1, style: { transform: `translate(-50%,-50%) rotate(${randi(-25, 25)}deg)` } });
      Object.assign(el.style, { width: '13cqh', height: '13cqh' });
    });
    await ctx.sleep(d.showMs);
    cover(stage, '✏️', 'Pencils down!');
  },

  async gems(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#3a2a6e, #1c1440)';
    put(stage, '\u{1F48E} = 5    ⭐ = 2    \u{1FA99} = 1', { x: 50, y: 10, size: 7, cls: 's-card' });
    const chest = put(stage, '\u{1F9F0}', { x: 50, y: 78, size: 28, z: 3 });
    await ctx.sleep(1000);
    for (const g of d.seq) {
      const x = rand(42, 58);
      const el = put(stage, g, { x, y: 18, size: 10, z: 2 });
      await anim(el, [{ ...C(x, 18) }, { ...C(50, 74, 'scale(.6)') }], { duration: d.stepMs - 150, easing: 'ease-in' });
      el.remove();
      anim(chest, [{ transform: 'translate(-50%,-50%) scale(1.08)' }, { transform: 'translate(-50%,-50%) scale(1)' }], 150);
      await ctx.sleep(150);
    }
  },

  async dice(stage, d, ctx) {
    stage.style.background = 'radial-gradient(circle, #1f8a4c, #0d4d2a)';
    const n = d.faces.length;
    const els = d.faces.map((_, i) => put(stage, dieFace(1, 22), { x: 50 + (i - (n - 1) / 2) * 22, y: 50, size: 1 }));
    const t0 = performance.now();
    while (performance.now() - t0 < d.rollMs) {
      els.forEach((el) => {
        el.replaceChildren(dieFace(randi(1, 6), 22));
        el.style.transform = `translate(-50%,-50%) rotate(${randi(-40, 40)}deg)`;
      });
      await ctx.sleep(90);
    }
    els.forEach((el, i) => {
      el.replaceChildren(dieFace(d.faces[i], 22));
      el.style.transform = `translate(-50%,-50%) rotate(${randi(-10, 10)}deg)`;
    });
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F3B2}', 'Cup over the dice!');
  },

  async cups(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#fff3e0, #ffd59e)';
    const n = d.rows.length;
    d.rows.forEach((rows, p) => {
      const cx = n === 1 ? 50 : p === 0 ? 28 : 72;
      const w = n === 1 ? 9 : 6.5;
      for (let r = 0; r < rows; r++) {
        const count = rows - r;
        for (let c = 0; c < count; c++) {
          const x = cx + (c - (count - 1) / 2) * w;
          const y = 88 - r * 12;
          put(stage, '', { x, y, size: 1, cls: 'cup', style: { width: w * 0.9 + 'cqw', height: '11.5cqh', background: pickr(['#e63946', '#e63946', '#f4a261', '#2a9d8f']) } });
        }
      }
    });
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F964}', 'Crash!');
  },

  async hamsters(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#9fe0ff 0 18%, #6cc76a 18%)';
    const holes = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) holes.push({ x: 25 + c * 25, y: 35 + r * 22 });
    holes.forEach((h) => box(stage, { x: h.x - 8, y: h.y + 3, w: 16, h: 9, bg: '#3b2a1a', radius: '50%', z: 1 }));
    await ctx.schedule(d.events.map((e) => e.t), (i) => {
      const h = holes[d.events[i].hole];
      const wrap = box(stage, { x: h.x - 8, y: h.y - 14, w: 16, h: 22, z: 2, style: { overflow: 'hidden' } });
      const ham = put(wrap, '\u{1F439}', { x: 50, y: 140, size: 11 });
      anim(ham, [{ top: '140%' }, { top: '45%', offset: 0.35 }, { top: '45%', offset: 0.65 }, { top: '140%' }], 550).then(() => wrap.remove());
    });
    await ctx.sleep(700);
  },

  async ufo(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#141a3d 0 70%, #2d5a2a 70%)';
    for (let i = 0; i < 25; i++) put(stage, '✦', { x: rand(0, 100), y: rand(0, 60), size: 2, style: { color: '#fff' } });
    const ufo = put(stage, '\u{1F6F8}', { x: 50, y: 14, size: 16, z: 4 });
    const all = shuffled([...d.seq.map((k) => ({ k, go: true })), ...Array(d.stayCows).fill({ k: 'cow', go: false }), ...Array(d.stayChickens).fill({ k: 'chicken', go: false })]);
    const xs = scatter(all.length, { x0: 6, x1: 94, y0: 78, y1: 79 }).map((p) => p.x).sort((a, b) => a - b);
    const animals = all.map((a, i) => ({ ...a, x: xs[i], el: put(stage, a.k === 'cow' ? '\u{1F404}' : '\u{1F414}', { x: xs[i], y: 82, size: a.k === 'cow' ? 10 : 7, z: 2 }) }));
    let ux = 50;
    await ctx.sleep(1000);
    for (const kind of d.seq) {
      const target = animals.find((a) => a.go && a.k === kind && !a.taken);
      target.taken = true;
      await anim(ufo, [{ left: ux + '%' }, { left: target.x + '%' }], { duration: 250, easing: 'ease-in-out' });
      ux = target.x;
      const beam = box(stage, { x: ux - 6, y: 18, w: 12, h: 70, z: 1, cls: 'beam' });
      await anim(target.el, [{ top: '82%', transform: 'translate(-50%,-50%) scale(1)' }, { top: '18%', transform: 'translate(-50%,-50%) scale(.3) rotate(180deg)' }], { duration: 450, easing: 'ease-in' });
      target.el.remove();
      beam.remove();
      await ctx.sleep(d.stepMs - 700);
    }
    anim(ufo, [{ left: ux + '%', top: '14%' }, { left: '120%', top: '-10%' }], 600);
  },

  async ants(stage, d, ctx) {
    stage.style.background = BG.dirt;
    put(stage, '\u{1F35E}', { x: 95, y: 50, size: 20 });
    put(stage, '\u{1F573}️', { x: 4, y: 55, size: 14 });
    await ctx.schedule(d.times, (i) => {
      const y = rand(30, 78);
      const ant = document.createElement('div');
      ant.className = 's-ant';
      ant.innerHTML = d.seq[i] ? '<span class="crumb">\u{1F35E}</span><span>\u{1F41C}</span>' : '<span>\u{1F41C}</span>';
      const el = put(stage, ant, { x: 100, y, size: 7 });
      anim(el, [{ left: '100%' }, { left: '-6%' }], { duration: d.crossMs * rand(0.85, 1.1), easing: 'linear' }).then(() => el.remove());
    });
    await ctx.sleep(d.crossMs * 1.1);
  },

  async windows(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#0d1033, #2b2f6b)';
    const bld = box(stage, { x: 30, y: 6, w: 40, h: 94, bg: '#3a3a4a', radius: '1cqh 1cqh 0 0' });
    const wins = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) wins.push(box(bld, { x: 6 + c * 18.4, y: 4 + r * 15.5, w: 14, h: 11, bg: '#1d1d28', radius: '0.4cqh', cls: 'win' }));
    const set = (i, on) => wins[i].classList.toggle('lit', on);
    const t0 = performance.now();
    while (performance.now() - t0 < d.flickerMs) {
      for (let k = 0; k < 3; k++) set(randi(0, 29), Math.random() < 0.5);
      await ctx.sleep(110);
    }
    wins.forEach((_, i) => set(i, d.final.includes(i)));
    await ctx.sleep(d.holdMs);
    wins.forEach((_, i) => set(i, false));
    cover(stage, '⚡', 'Blackout!');
  },

  async stroop(stage, d, ctx) {
    stage.style.background = '#f4f1ea';
    d.words.forEach((w, i) => {
      put(stage, w.word, { x: 12 + (i % 4) * 25.3, y: 10 + Math.floor(i / 4) * 16, size: 8, style: { color: w.ink, fontWeight: 800, letterSpacing: '.03em' } });
    });
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F3A8}', 'Eyes up!');
  },

  async traffic(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#9fd3ff, #e9f6ff)';
    box(stage, { x: 48.5, y: 70, w: 3, h: 30, bg: '#333' });
    const body = box(stage, { x: 41, y: 4, w: 18, h: 70, bg: '#222', radius: '3cqh' });
    const colors = { red: '#ff3b30', yellow: '#ffcc00', green: '#2ee05a' };
    const lamps = Object.fromEntries(['red', 'yellow', 'green'].map((c, i) => [c, box(body, { x: 15, y: 5 + i * 31, w: 70, h: 27, bg: '#3b3b3b', radius: '50%' })]));
    await ctx.sleep(800);
    for (const c of d.seq) {
      Object.entries(lamps).forEach(([k, el]) => {
        el.style.background = k === c ? colors[k] : '#3b3b3b';
        el.style.boxShadow = k === c ? `0 0 4cqh ${colors[k]}` : 'none';
      });
      await ctx.sleep(d.stepMs);
    }
    Object.values(lamps).forEach((el) => { el.style.background = '#3b3b3b'; el.style.boxShadow = 'none'; });
  },

  async spotdiff(stage, d, ctx) {
    stage.style.background = '#efe9ff';
    [d.left, d.right].forEach((grid, side) => {
      const panel = box(stage, { x: side ? 52 : 2, y: 6, w: 46, h: 88, bg: '#fff', radius: '2cqh', style: { boxShadow: '0 1cqh 0 rgba(0,0,0,.15)' } });
      grid.forEach((e, i) => put(panel, e, { x: 12 + (i % 5) * 19, y: 14 + Math.floor(i / 5) * 24, size: 10 }));
    });
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F50D}', 'Time’s up!');
  },

  async scale(stage, d) {
    stage.style.background = 'linear-gradient(#fff8e6, #ffe2a8)';
    const drawScale = (y, left, right) => {
      box(stage, { x: 49, y: y + 4, w: 2, h: 22, bg: '#6b4b2a' });
      box(stage, { x: 20, y: y + 2, w: 60, h: 1.6, bg: '#6b4b2a', radius: '1cqh' });
      box(stage, { x: 14, y: y, w: 24, h: 3, bg: '#9a7b52', radius: '0 0 3cqh 3cqh' });
      box(stage, { x: 62, y: y, w: 24, h: 3, bg: '#9a7b52', radius: '0 0 3cqh 3cqh' });
      put(stage, left, { x: 26, y: y - 7, size: 9 });
      put(stage, right, { x: 74, y: y - 7, size: right.length > 8 ? 6 : 9 });
    };
    drawScale(30, d.big, d.small.repeat(d.k));
    drawScale(76, d.big.repeat(d.m), '❓');
  },

  async numberrain(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#1b1b4a, #3c2d7a)';
    const big = put(stage, `Start with ${d.start}`, { x: 50, y: 50, size: 16, style: { color: '#fff', fontWeight: 800 } });
    await ctx.sleep(1500);
    for (const op of d.ops) {
      big.textContent = op > 0 ? `+ ${op}` : `− ${-op}`;
      big.style.color = op > 0 ? '#6be38f' : '#ff6b6b';
      await anim(big, [{ ...C(50, -10), opacity: 1 }, { ...C(50, 50), opacity: 1, offset: 0.3 }, { ...C(50, 50), opacity: 1, offset: 0.85 }, { ...C(50, 110), opacity: 0 }], d.stepMs);
    }
    big.textContent = '= ?';
    big.style.color = '#ffd23f';
    anim(big, [{ ...C(50, 50), opacity: 1 }], 10);
  },

  async pizza(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#ffe9e0, #ffcbb5)';
    const svg = svgLayer(stage, '0 0 160 90');
    const cx = 70, cy = 45, R = 38;
    const wedges = [];
    for (let i = 0; i < d.slices; i++) {
      const a0 = (i / d.slices) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / d.slices) * Math.PI * 2 - Math.PI / 2;
      const g = svgEl('g');
      g.append(svgEl('path', { d: `M${cx},${cy} L${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} A${R},${R} 0 0 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)} Z`, fill: '#ffc94d', stroke: '#d98a1f', 'stroke-width': 1.6 }));
      const am = (a0 + a1) / 2;
      g.append(svgEl('circle', { cx: cx + R * 0.6 * Math.cos(am), cy: cy + R * 0.6 * Math.sin(am), r: 3.2, fill: '#c0392b' }));
      svg.append(g);
      wedges.push(g);
    }
    const dino = put(stage, '\u{1F996}', { x: 88, y: 55, size: 30 });
    await ctx.sleep(2800);
    await ctx.schedule(d.times.map((t) => t - 2800), (i) => {
      const w = wedges[d.eatOrder[i]];
      anim(dino, [{ ...C(88, 55) }, { ...C(76, 52, 'rotate(-10deg)'), offset: 0.5 }, { ...C(88, 55) }], 400);
      w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    });
    await ctx.sleep(600);
    const lid = box(stage, { x: 14, y: -100, w: 60, h: 100, bg: '#c9a06a', radius: '1cqh', z: 5, style: { boxShadow: 'inset 0 0 0 1cqh #a87f48' } });
    lid.innerHTML = '<div class="s-lid">PIZZA</div>';
    await anim(lid, [{ top: '-100%' }, { top: '0%' }], { duration: 500, easing: 'ease-in' });
  },

  async rocket(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#0b0b2e, #3a2f7a 80%, #555 80%)';
    const rocket = put(stage, '\u{1F680}', { x: 82, y: 70, size: 24, style: { transform: 'translate(-50%,-50%) rotate(-45deg)' } });
    const num = put(stage, '', { x: 40, y: 45, size: 40, style: { color: '#ffd23f', fontWeight: 800 } });
    await ctx.sleep(800);
    for (let n = 10; n >= 1; n--) {
      if (n === d.skipped) continue;
      num.textContent = n;
      anim(num, [{ transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0.4 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], 200);
      await ctx.sleep(d.stepMs);
    }
    num.textContent = 'LIFTOFF!';
    num.style.fontSize = '14cqh';
    await anim(rocket, [{ top: '70%' }, { top: '-30%' }], { duration: 1200, easing: 'ease-in' });
  },

  async oddtile(stage, d, ctx) {
    stage.style.background = '#e9f2ff';
    for (let i = 0; i < 20; i++) {
      const t = box(stage, { x: 7 + (i % 5) * 17.5, y: 4 + Math.floor(i / 5) * 23.5, w: 15, h: 21, bg: '#fff', radius: '1.5cqh', cls: 'tile' });
      t.innerHTML = `<b>${i + 1}</b>`;
      put(t, i === d.index ? d.odd : d.base, { x: 55, y: 55, size: 11 });
    }
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F9E9}', 'Which number was it?');
  },

  async cardflip(stage, d, ctx) {
    stage.style.background = 'radial-gradient(circle, #2a7a4a, #124428)';
    const cards = d.animals.map((a, i) => {
      const c = box(stage, { x: 9 + (i % 4) * 21.5, y: 8 + Math.floor(i / 4) * 46, w: 17, h: 38, cls: 'card' });
      c.innerHTML = `<div class="front"></div><div class="back">?</div><b>${i + 1}</b>`;
      c.firstChild.textContent = a;
      return c;
    });
    await ctx.sleep(d.showMs);
    for (const c of cards) {
      c.classList.add('flipped');
      await ctx.sleep(80);
    }
  },

  async shapes(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#1d1b3a, #34306b)';
    const colors = ['#ff5d73', '#ffb347', '#ffe156', '#6be38f', '#5ce1e6', '#7b9cff', '#c38bff'];
    scatter(d.shapes.length, { y0: 8, y1: 92 }).forEach(({ x, y }, i) => {
      const el = put(stage, '', { x, y, size: 1, cls: 'shape ' + d.shapes[i], style: { background: pickr(colors) } });
      el.animate([{ transform: 'translate(-50%,-50%) rotate(0deg)' }, { transform: `translate(calc(-50% + ${rand(-4, 4)}cqw), calc(-50% + ${rand(-4, 4)}cqh)) rotate(${pickr([-1, 1]) * 360}deg)` }], { duration: rand(4000, 8000), iterations: Infinity, direction: 'alternate' });
    });
    await ctx.sleep(d.showMs);
    cover(stage, '\u{1F53A}', 'Shapes gone!');
  },

  // ---------------------------------------------------------------- choices
  async shellgame(stage, d, ctx) {
    stage.style.background = 'radial-gradient(circle, #a0522d, #5a2d12)';
    const X = [25, 50, 75];
    const ball = put(stage, '', { x: X[d.start], y: 72, size: 1, cls: 'ball' });
    const cups = X.map((x) => put(stage, '', { x, y: 40, size: 1, cls: 'shell', z: 2 }));
    await ctx.sleep(1600);
    await Promise.all(cups.map((c, i) => anim(c, [{ ...C(X[i], 40) }, { ...C(X[i], 66) }], 500)));
    ball.style.opacity = 0;
    await ctx.sleep(500);
    const at = [0, 1, 2]; // at[pos] = cup index sitting at screen position pos
    for (const [a, b] of d.swaps) {
      const ca = cups[at[a]];
      const cb = cups[at[b]];
      const mid = (X[a] + X[b]) / 2;
      anim(ca, [{ ...C(X[a], 66) }, { ...C(mid, 56) }, { ...C(X[b], 66) }], { duration: d.speedMs - 40, easing: 'ease-in-out' });
      anim(cb, [{ ...C(X[b], 66) }, { ...C(mid, 76) }, { ...C(X[a], 66) }], { duration: d.speedMs - 40, easing: 'ease-in-out' });
      [at[a], at[b]] = [at[b], at[a]];
      await ctx.sleep(d.speedMs);
    }
  },

  async photofinish(stage, d, ctx) {
    stage.style.background = 'repeating-linear-gradient(#c96a3a 0 22%, #f3e6d0 22% 23%)';
    box(stage, { x: 8, y: 0, w: 1.5, h: 100, cls: 'finish' });
    const runners = d.racers.map((e, i) => put(stage, e, { x: 92, y: 12 + i * 23, size: 15 }));
    runners.forEach((el, i) => {
      const prog = [0, ...d.checkpoints[i], 1];
      el.animate(prog.map((p, k) => ({ left: 92 - p * 84 + '%', offset: k / (prog.length - 1) })), { duration: d.finishMs[i], fill: 'forwards', easing: 'linear' });
    });
    await ctx.sleep(Math.max(...d.finishMs) + 200);
    cover(stage, '\u{1F4F8}', 'Photo finish!');
  },

  async shadow(stage, d) {
    stage.style.background = 'radial-gradient(circle at 50% 50%, #fffbe0 0 30%, #f0d77a 45%, #3a3020 75%)';
    const el = put(stage, d.emoji, { x: 50, y: 50, size: 60, cls: 'silhouette' });
    el.animate([{ transform: 'translate(-50%,-50%) rotate(-4deg)' }, { transform: 'translate(-50%,-50%) rotate(4deg)' }], { duration: 2500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  },

  async zoom(stage, d) {
    stage.style.background = '#fff';
    // Animate the real font size (not a transform) so the emoji is redrawn crisply as it shrinks.
    const el = put(stage, d.emoji, { x: 50, y: 50, size: 70 });
    el.style.transform = `translate(-${d.originX}%, -${d.originY}%)`;
    el.animate([{ fontSize: '900cqh' }, { fontSize: '260cqh', offset: 0.35 }, { fontSize: '120cqh' }], { duration: 20000, fill: 'forwards', easing: 'ease-out' });
  },

  async missing(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#fff4d6, #ffe0a3)';
    const draw = (items) => items.map((e, i) => put(stage, e, { x: 14 + (i % 4) * 24, y: 30 + Math.floor(i / 4) * 40, size: 20 }));
    let els = draw(d.items);
    await ctx.sleep(d.showMs);
    els.forEach((e) => e.remove());
    const c = cover(stage, '\u{1F440}', 'Blink!');
    await ctx.sleep(d.blankMs);
    c.remove();
    els = draw(d.after);
  },

  async paint(stage, d, ctx) {
    stage.style.background = '#f7f4ff';
    const can = (x, color, name) => {
      const el = box(stage, { x: x - 9, y: 8, w: 18, h: 34, bg: '#c9c9d6', radius: '1cqh 1cqh 3cqh 3cqh', cls: 'can' });
      box(el, { x: 8, y: 6, w: 84, h: 26, bg: color, radius: '50%', style: { border: '0.4cqh solid rgba(0,0,0,.2)' } });
      put(stage, name, { x, y: 47, size: 6, style: { fontWeight: 700, color: '#333' } });
      return el;
    };
    can(22, d.a, d.aName);
    can(78, d.b, d.bName);
    put(stage, '+', { x: 50, y: 25, size: 14, style: { color: '#333', fontWeight: 800 } });
    const bowl = box(stage, { x: 32, y: 56, w: 36, h: 40, bg: '#d6d6e4', radius: '0 0 50% 50%', style: { overflow: 'hidden', border: '0.8cqh solid #9a9ab0' } });
    const swirl = box(bowl, { x: 10, y: -60, w: 80, h: 140, radius: '50%' });
    swirl.style.background = `conic-gradient(${d.a} 0 25%, ${d.b} 0 50%, ${d.a} 0 75%, ${d.b} 0)`;
    swirl.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 3000, iterations: Infinity });
    for (const [x, c] of [[24, d.a], [76, d.b]]) {
      const stream = box(stage, { x: x - 1.5, y: 30, w: 3, h: 30, bg: c, radius: '2cqh' });
      stream.animate([{ transform: 'scaleY(0)', transformOrigin: 'top' }, { transform: 'scaleY(1)', transformOrigin: 'top' }], { duration: 600, fill: 'forwards' });
      stream.style.rotate = x < 50 ? '-35deg' : '35deg';
      stream.style.transformOrigin = 'top';
    }
    put(stage, '❓', { x: 50, y: 76, size: 14, z: 3 });
  },

  async illusion(stage, d) {
    stage.style.background = '#fff';
    const svg = svgLayer(stage);
    const big = 1.12;
    if (d.type === 'lines') {
      const lenTop = 70 * (d.diff > 0 ? big : 1);
      const lenBot = 70 * (d.diff < 0 ? big : 1);
      const line = (y, len, outward) => {
        const x1 = 80 - len / 2;
        const x2 = 80 + len / 2;
        const f = 9 * (outward ? -1 : 1);
        svg.append(svgEl('line', { x1, y1: y, x2, y2: y, stroke: '#222', 'stroke-width': 2.2 }));
        for (const [x, s] of [[x1, 1], [x2, -1]]) {
          svg.append(svgEl('line', { x1: x, y1: y, x2: x + s * f, y2: y - 7, stroke: '#222', 'stroke-width': 2.2 }));
          svg.append(svgEl('line', { x1: x, y1: y, x2: x + s * f, y2: y + 7, stroke: '#222', 'stroke-width': 2.2 }));
        }
      };
      line(28, lenTop, true);
      line(64, lenBot, false);
    } else {
      const rl = 9 * (d.diff > 0 ? big : 1);
      const rr = 9 * (d.diff < 0 ? big : 1);
      svg.append(svgEl('circle', { cx: 45, cy: 45, r: rl, fill: '#ff8c1a' }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        svg.append(svgEl('circle', { cx: 45 + Math.cos(a) * 26, cy: 45 + Math.sin(a) * 26, r: 13, fill: '#8a93a6' }));
      }
      svg.append(svgEl('circle', { cx: 118, cy: 45, r: rr, fill: '#ff8c1a' }));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        svg.append(svgEl('circle', { cx: 118 + Math.cos(a) * 15, cy: 45 + Math.sin(a) * 15, r: 3.6, fill: '#8a93a6' }));
      }
    }
  },

  async clock(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#e6f0ff, #c2d6ff)';
    const svg = svgLayer(stage, '0 0 160 90');
    svg.append(svgEl('circle', { cx: 80, cy: 45, r: 40, fill: '#fff', stroke: '#2b2b4a', 'stroke-width': 3 }));
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const t = svgEl('text', { x: 80 + Math.cos(a) * 32, y: 45 + Math.sin(a) * 32 + 3, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 700, fill: '#2b2b4a' });
      t.textContent = i;
      svg.append(t);
    }
    const hand = (len, w, color) => {
      const l = svgEl('line', { x1: 80, y1: 45, x2: 80, y2: 45 - len, stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' });
      l.style.transformOrigin = '80px 45px';
      svg.append(l);
      return l;
    };
    const hh = hand(20, 3.6, '#2b2b4a');
    const mh = hand(30, 2.4, '#e63946');
    svg.append(svgEl('circle', { cx: 80, cy: 45, r: 2.5, fill: '#2b2b4a' }));
    const hourDeg = ((d.h % 12) + d.m / 60) * 30;
    const minDeg = d.m * 6;
    // Spin into place, then hold, then hide.
    hh.animate([{ transform: `rotate(${hourDeg - 720}deg)` }, { transform: `rotate(${hourDeg}deg)` }], { duration: 900, fill: 'forwards', easing: 'ease-out' });
    mh.animate([{ transform: `rotate(${minDeg - 2160}deg)` }, { transform: `rotate(${minDeg}deg)` }], { duration: 900, fill: 'forwards', easing: 'ease-out' });
    await ctx.sleep(900 + d.showMs);
    cover(stage, '\u{1F570}️', 'Tick tock!');
  },

  async pattern(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#fdf2ff, #e8d5ff)';
    const n = d.seq.length + 1;
    const w = 90 / n;
    for (let i = 0; i < d.seq.length; i++) {
      const el = put(stage, d.seq[i], { x: 5 + w * (i + 0.5), y: 50, size: Math.min(16, w * 1.6), style: { fontWeight: 800, color: '#3a2a6e' } });
      anim(el, [{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }], 250);
      await ctx.sleep(d.stepMs);
    }
    const q = put(stage, '❓', { x: 5 + w * (n - 0.5), y: 50, size: Math.min(16, w * 1.6) });
    q.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.2)' }], { duration: 600, iterations: Infinity, direction: 'alternate' });
  },

  async whomoved(stage, d, ctx) {
    stage.style.background = BG.stage;
    box(stage, { x: 0, y: 72, w: 100, h: 28, bg: '#6b3f1f' });
    const draw = (list) => list.map((e, i) => put(stage, e, { x: 10 + i * 16, y: 58, size: 16 }));
    let els = draw(d.animals);
    await ctx.sleep(d.showMs);
    const curtain = box(stage, { x: 0, y: -100, w: 100, h: 100, cls: 'curtain', z: 5 });
    await anim(curtain, [{ top: '-100%' }, { top: '0%' }], 400);
    els.forEach((e) => e.remove());
    els = draw(d.after);
    await ctx.sleep(d.curtainMs - 400);
    await anim(curtain, [{ top: '0%' }, { top: '-100%' }], 400);
  },

  async rebus(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#fff6c9, #ffd86b)';
    const parts = [[d.a, 22], ['+', 40], [d.b, 58], ['=', 74], ['❓', 88]];
    for (const [t, x] of parts) {
      const el = put(stage, t, { x, y: 50, size: t.length === 1 && /[+=]/.test(t) ? 14 : 26, style: { fontWeight: 800, color: '#5a3d00' } });
      anim(el, [{ transform: 'translate(-50%,-50%) scale(0) rotate(-30deg)' }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)' }], { duration: 350, easing: 'cubic-bezier(.3,1.6,.6,1)' });
      await ctx.sleep(350);
    }
  },

  async rainbow(stage, d) {
    stage.style.background = BG.sky;
    const svg = svgLayer(stage);
    d.bands.forEach((color, i) => {
      const r = 68 - i * 7;
      svg.append(svgEl('path', { d: `M${80 - r},84 A${r},${r} 0 0 1 ${80 + r},84`, fill: 'none', stroke: i === d.missing ? 'transparent' : color, 'stroke-width': 7 }));
    });
    put(stage, '☁️', { x: 14, y: 86, size: 26 });
    put(stage, '☁️', { x: 86, y: 86, size: 26 });
  },

  async towers(stage, d, ctx) {
    stage.style.background = 'linear-gradient(#dff3ff, #a9dcff)';
    box(stage, { x: 0, y: 94, w: 100, h: 6, bg: '#6b8e4e' });
    const xs = [20, 40, 60, 80];
    const heights = [0, 0, 0, 0];
    const blockH = 6;
    await ctx.sleep(600);
    for (const i of d.drops) {
      const top = 94 - (heights[i] + 1) * blockH;
      heights[i] += 1;
      const b = box(stage, { x: xs[i] - 6, y: top, w: 12, h: blockH, bg: d.colors[i], radius: '0.5cqh', style: { boxShadow: 'inset 0 -0.6cqh 0 rgba(0,0,0,.2)' } });
      anim(b, [{ top: '-8%' }, { top: top + '%' }], { duration: Math.min(220, d.stepMs), easing: 'ease-in' });
      await ctx.sleep(d.stepMs);
    }
    await ctx.sleep(d.holdMs);
    cover(stage, '\u{1F32B}️', 'Foggy!');
  },
};

// Plays a scene; quietly stops when the stage is removed.
async function playScene(stage, id, data) {
  const scene = SCENES[id];
  if (!scene) {
    stage.append(Object.assign(document.createElement('div'), { className: 's-cover', textContent: '?' }));
    return;
  }
  try {
    await scene(stage, data, makeCtx(stage));
  } catch (e) {
    if (e !== STOP) console.error('scene error', id, e);
  }
}
