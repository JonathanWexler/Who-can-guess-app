const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { Room } = require('./room');

const PORT = Number(process.env.PORT) || 3000;
const ROOM_IDLE_MS = 1000 * 60 * 60 * 2; // drop rooms idle for 2 hours

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/host', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'host.html')));
app.get('/play', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'play.html')));

/** @type {Map<string, Room>} */
const rooms = new Map();

// No vowels or look-alike characters, so codes never spell anything or get misread.
const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ';
function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const emitTo = (socketId, event, payload) => io.to(socketId).emit(event, payload);
const reply = (cb, payload) => typeof cb === 'function' && cb(payload);

io.on('connection', (socket) => {
  let room = null;
  let role = null; // 'host' | 'player'
  let playerId = null;

  const hostOnly = (fn) => (...args) => {
    const cb = args[args.length - 1];
    if (!room || role !== 'host') return reply(cb, { error: 'Only the host can do that.' });
    room.lastActivity = Date.now();
    fn(...args);
  };

  socket.on('host:create', (_payload, cb) => {
    const code = newCode();
    room = new Room(code, { emitTo });
    rooms.set(code, room);
    role = 'host';
    room.hostSocketId = socket.id;
    reply(cb, { code, hostToken: room.hostToken });
    room.broadcast();
  });

  socket.on('host:resume', ({ code, hostToken } = {}, cb) => {
    const r = rooms.get(String(code || '').toUpperCase());
    if (!r || r.hostToken !== hostToken) return reply(cb, { error: 'Room not found.' });
    room = r;
    role = 'host';
    room.hostSocketId = socket.id;
    reply(cb, { code: room.code, hostToken: room.hostToken });
    room.broadcast();
  });

  socket.on('host:start', hostOnly(({ rounds } = {}, cb) => reply(cb, room.start(rounds))));
  socket.on('host:next', hostOnly((_p, cb) => {
    if (room.phase === 'reveal') room.nextRound();
    else if (room.phase === 'intro') room.beginPlaying();
    else if (room.phase === 'playing') room.reveal();
    reply(cb, {});
  }));
  socket.on('host:lobby', hostOnly((_p, cb) => { room.backToLobby(); reply(cb, {}); }));
  socket.on('host:kick', hostOnly(({ playerId: id } = {}, cb) => { room.kick(id); reply(cb, {}); }));

  socket.on('player:join', ({ code, name, playerId: savedId } = {}, cb) => {
    const r = rooms.get(String(code || '').trim().toUpperCase());
    if (!r) return reply(cb, { error: 'No room with that code.' });
    const result = r.join({ playerId: savedId, name, socketId: socket.id });
    if (result.error) return reply(cb, result);
    room = r;
    role = 'player';
    playerId = result.player.id;
    reply(cb, { code: r.code, playerId });
  });

  socket.on('player:guess', ({ value } = {}, cb) => {
    if (!room || role !== 'player') return reply(cb, { error: 'Join a room first.' });
    room.lastActivity = Date.now();
    reply(cb, room.submitGuess(playerId, value));
  });

  socket.on('player:leave', (_p, cb) => {
    if (room && role === 'player') room.kick(playerId);
    room = null;
    role = null;
    reply(cb, {});
  });

  socket.on('disconnect', () => {
    if (room) room.disconnectSocket(socket.id);
  });
});

setInterval(() => {
  const cutoff = Date.now() - ROOM_IDLE_MS;
  for (const [code, r] of rooms) {
    if (r.lastActivity < cutoff) {
      r.destroy();
      rooms.delete(code);
    }
  }
}, 60_000).unref();

server.listen(PORT, () => {
  console.log(`Who Can Guess? running at http://localhost:${PORT}`);
  console.log(`  Host screen:  http://localhost:${PORT}/host`);
  console.log(`  Players join: http://localhost:${PORT}/play`);
});
