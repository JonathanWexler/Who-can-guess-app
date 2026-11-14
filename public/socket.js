// A tiny Socket.IO-style client over a plain WebSocket.
//   const socket = createSocket();
//   socket.on('state', fn); socket.on('connect', fn);
//   socket.connect('ABCD');                 // joins /ws/ABCD, reconnects automatically
//   socket.emit('player:guess', {value}, (reply) => …);
function createSocket() {
  const handlers = {};
  const pending = new Map();
  let ws = null;
  let code = null;
  let nextId = 1;
  let retry = 0;
  let timer = null;

  const fire = (event, payload) => (handlers[event] || []).forEach((fn) => fn(payload));

  function open() {
    clearTimeout(timer);
    if (ws) { ws.onclose = null; ws.close(); }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws/${code}`);
    ws.onopen = () => { retry = 0; fire('connect'); };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'ack') {
        const cb = pending.get(msg.id);
        pending.delete(msg.id);
        if (cb) cb(msg.payload);
      } else if (msg.t === 'event') {
        fire(msg.event, msg.payload);
      }
    };
    ws.onclose = () => {
      for (const cb of pending.values()) cb({ error: 'Connection lost, reconnecting…' });
      pending.clear();
      fire('disconnect');
      timer = setTimeout(open, Math.min(8000, 500 * 2 ** retry++));
    };
  }

  const socket = {
    on(event, fn) { (handlers[event] = handlers[event] || []).push(fn); },
    get connected() { return !!ws && ws.readyState === WebSocket.OPEN; },
    get code() { return code; },
    connect(newCode) {
      newCode = String(newCode || '').trim().toUpperCase();
      if (newCode === code && socket.connected) return Promise.resolve();
      code = newCode;
      return new Promise((resolve) => {
        const once = () => { handlers.connect = handlers.connect.filter((f) => f !== once); resolve(); };
        socket.on('connect', once);
        open();
      });
    },
    emit(event, payload, cb) {
      const id = nextId++;
      if (cb) pending.set(id, cb);
      if (!socket.connected) {
        pending.delete(id);
        if (cb) cb({ error: 'Not connected yet.' });
        return;
      }
      ws.send(JSON.stringify({ t: 'emit', event, payload: payload || {}, id }));
    },
  };
  return socket;
}
