// Cloudflare Worker entry.
//
//   /api/new-room   → picks a free 4-letter room code
//   /ws/<CODE>      → WebSocket into that room's Durable Object
//   /qr.svg?url=…   → QR code for the join link
//   everything else → the pages in /public, bundled into the Worker as text
//
// Each room is one Durable Object (GameRoom) holding the same Room state
// machine the tests exercise (src/room.js), so all players in a room talk to
// the same in-memory game.

import { Room } from '../src/room.js';
import { create as createQR } from 'qrcode/lib/core/qrcode.js';
import { render as renderSvg } from 'qrcode/lib/renderer/svg-tag.js';
import { PAGES } from './pages.generated.js';

// No vowels or look-alike characters, so codes never spell anything or get misread.
const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/new-room' && request.method === 'POST') {
      for (let i = 0; i < 20; i++) {
        const code = newCode();
        const res = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/claim', { method: 'POST' });
        if (res.ok) return json({ code });
      }
      return json({ error: 'Could not find a free room code, try again.' }, 503);
    }

    if (url.pathname === '/api/info') return json({ publicUrl: env.PUBLIC_URL || null, lan: [] });

    const ws = url.pathname.match(/^\/ws\/([A-Za-z]{4})$/);
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const code = ws[1].toUpperCase();
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(`https://room/ws?code=${code}`, request);
    }

    if (url.pathname === '/qr.svg') {
      const target = url.searchParams.get('url') || '';
      if (!/^https?:\/\/[^\s]{1,300}$/.test(target)) return new Response('Bad url', { status: 400 });
      const svg = await new Promise((resolve, reject) =>
        renderSvg(createQR(target, { errorCorrectionLevel: 'M' }), { margin: 1, color: { dark: '#14112b', light: '#ffffff' } }, (err, out) => (err ? reject(err) : resolve(out))));
      return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } });
    }

    const page = PAGES[url.pathname];
    if (page) return new Response(page[0], { headers: { 'content-type': page[1], 'cache-control': 'no-cache' } });
    return new Response('Not found', { status: 404 });
  },
};

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.claimed = false;
    this.sockets = new Map(); // socketId -> WebSocket
    this.room = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/claim') {
      // A room is free if nobody has claimed it, or its old game was abandoned.
      const stale = this.room && Date.now() - this.room.lastActivity > 1000 * 60 * 60 * 2 && this.sockets.size === 0;
      if (this.claimed && !stale) return new Response('taken', { status: 409 });
      this.room?.destroy();
      this.claimed = true;
      this.room = null;
      return new Response('ok');
    }

    if (url.pathname === '/ws') {
      const code = url.searchParams.get('code');
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.attach(server, code);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  emitTo(socketId, event, payload) {
    const ws = this.sockets.get(socketId);
    if (!ws) return;
    try {
      ws.send(JSON.stringify({ t: 'event', event, payload }));
    } catch {
      this.sockets.delete(socketId);
    }
  }

  attach(ws, code) {
    const socketId = crypto.randomUUID();
    this.sockets.set(socketId, ws);
    const conn = { role: null, playerId: null };

    const reply = (id, payload) => {
      if (id == null) return;
      try { ws.send(JSON.stringify({ t: 'ack', id, payload: payload || {} })); } catch {}
    };

    ws.addEventListener('message', (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch { return; }
      if (data.t !== 'emit') return;
      const { event, payload = {}, id } = data;
      try {
        reply(id, this.handle(event, payload, conn, socketId, code));
      } catch (e) {
        console.error('handler error', event, e);
        reply(id, { error: 'Something went wrong.' });
      }
    });

    const gone = () => {
      this.sockets.delete(socketId);
      this.room?.disconnectSocket(socketId);
    };
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
  }

  // Same events the original Socket.IO server handled.
  handle(event, payload, conn, socketId, code) {
    const room = this.room;
    if (room) room.lastActivity = Date.now();

    if (event === 'host:create') {
      if (room && room.hostSocketId && this.sockets.has(room.hostSocketId)) return { error: 'This room already has a host.' };
      if (!this.claimed) return { error: 'Room not found.' };
      this.room = new Room(code, { emitTo: (sid, ev, p) => this.emitTo(sid, ev, p) });
      this.room.hostSocketId = socketId;
      conn.role = 'host';
      this.room.broadcast();
      return { code, hostToken: this.room.hostToken };
    }
    if (event === 'host:resume') {
      if (!room || room.hostToken !== payload.hostToken) return { error: 'Room not found.' };
      room.hostSocketId = socketId;
      conn.role = 'host';
      room.broadcast();
      return { code: room.code, hostToken: room.hostToken };
    }

    if (event.startsWith('host:')) {
      // The TV screen, or the host player (first to join) from their phone.
      const allowed = conn.role === 'host' || (conn.role === 'player' && room?.canControl(conn.playerId));
      if (!room || !allowed) return { error: 'Only the host can do that.' };
      switch (event) {
        case 'host:configure': room.configure(payload); return {};
        case 'host:start': return room.start();
        case 'host:next': room.advance(); return {};
        case 'host:reroll-actors': room.rerollActors(); return {};
        case 'host:reroll-prompt': room.rerollPrompt(); return {};
        case 'host:skip-actoff': room.skipActOff(); return {};
        case 'host:lobby': room.backToLobby(); return {};
        case 'host:kick': room.kick(payload.playerId); return {};
        default: return { error: 'Unknown action.' };
      }
    }

    if (event === 'player:join') {
      if (!room) return { error: 'No room with that code.' };
      const result = room.join({ playerId: payload.playerId, name: payload.name, socketId });
      if (result.error) return result;
      conn.role = 'player';
      conn.playerId = result.player.id;
      return { code: room.code, playerId: result.player.id };
    }

    if (!room || conn.role !== 'player') return { error: 'Join a room first.' };
    switch (event) {
      case 'player:guess': return room.submitGuess(conn.playerId, payload.value);
      case 'player:vote': return room.submitVote(conn.playerId, payload.actorId);
      case 'player:rate': return room.submitRating(conn.playerId, payload.stars);
      case 'player:sabotage': return room.sabotage(conn.playerId, payload.targetId);
      case 'player:leave': room.kick(conn.playerId); conn.role = null; return {};
      default: return { error: 'Unknown action.' };
    }
  }
}
