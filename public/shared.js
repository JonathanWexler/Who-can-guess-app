// Tiny DOM helper: h('div.card', {onclick}, child, 'text', ...)
function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    }
    else if (k === 'class') el.className += ' ' + v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const svgNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

function formatNum(n) {
  if (n == null) return '—';
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function withUnit(n, unit) {
  if (n == null) return 'No guess';
  if (!unit) return formatNum(n);
  if (unit === '%' || unit === '°' || unit === 's') return formatNum(n) + unit;
  return formatNum(n) + ' ' + unit;
}

function swatch(color) {
  return h('span.dot', { style: { background: color } });
}

function edgeBadge(text = 'EDGE') {
  return h('span.edge-badge', '⚡ ' + text);
}

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// A countdown that keeps ticking between server updates.
function startCountdown(el, endsAt, { total } = {}) {
  const tick = () => {
    if (!el.isConnected) return clearInterval(id);
    const left = Math.max(0, endsAt - Date.now());
    if (el.classList.contains('mini-timer')) {
      el.firstChild.style.width = (total ? (left / total) * 100 : 0) + '%';
    } else {
      el.textContent = Math.ceil(left / 1000);
      el.classList.toggle('low', left < 5000);
    }
  };
  const id = setInterval(tick, 250);
  tick();
}

// The act-off prompt: "Act out this ANIMAL: 🦘 A kangaroo with the hiccups".
function promptBlock(prompt, { small = false } = {}) {
  if (!prompt) return null;
  const tag = prompt.kind === 'Animal' ? '\u{1F43E} Act out this ANIMAL' : '\u{1F9B8} Play this CHARACTER';
  return h('div.act-prompt-block' + (small ? '.small' : ''),
    h('div.act-kind', tag),
    h('div.act-emoji', prompt.emoji),
    h('div.act-prompt', prompt.text),
  );
}

const stars = (n) => '⭐'.repeat(n || 0) || '—';
