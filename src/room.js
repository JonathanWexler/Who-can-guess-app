const crypto = require('node:crypto');
const { BY_ID, describe, buildPlaylist } = require('./minigames');
const { scoreRound, edgeSlots } = require('./scoring');

const PLAYER_COLORS = ['#ff5d73', '#ffb347', '#ffe156', '#6be38f', '#5ce1e6', '#7b9cff', '#c38bff', '#ff8ad8', '#b8f05a', '#f0a07a', '#9fe7ff', '#e0e0e0'];
const MAX_PLAYERS = 12;
const INTRO_MS = 6000;
const ANSWER_MS = 20000;

class Room {
  /**
   * @param {string} code
   * @param {{emitTo:(socketId:string, event:string, payload:any)=>void, rng?:()=>number, timers?:{setTimeout:Function, clearTimeout:Function}, now?:()=>number}} deps
   */
  constructor(code, deps) {
    this.code = code;
    this.hostToken = crypto.randomUUID();
    this.hostSocketId = null;
    this.emitTo = deps.emitTo;
    this.rng = deps.rng || Math.random;
    this.timers = deps.timers || { setTimeout, clearTimeout };
    this.now = deps.now || Date.now;
    this.players = new Map();
    this.phase = 'lobby';
    this.totalRounds = 6;
    this.playlist = [];
    this.roundIndex = -1;
    this.round = null;
    this.timer = null;
    this.lastActivity = this.now();
  }

  // ---- players -----------------------------------------------------------

  join({ playerId, name, socketId }) {
    this.lastActivity = this.now();
    const existing = playerId && this.players.get(playerId);
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      this.broadcast();
      return { player: existing };
    }
    name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
    if (!name) return { error: 'Please enter a name.' };
    if (this.players.size >= MAX_PLAYERS) return { error: 'This room is full.' };
    const taken = [...this.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) return { error: 'That name is taken in this room.' };
    const used = new Set([...this.players.values()].map((p) => p.color));
    const player = {
      id: crypto.randomUUID(),
      name,
      color: PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0],
      score: 0,
      edge: false,
      edgesEarned: 0,
      socketId,
      connected: true,
    };
    this.players.set(player.id, player);
    this.broadcast();
    return { player };
  }

  kick(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    this.players.delete(playerId);
    if (p.socketId) this.emitTo(p.socketId, 'kicked', {});
    if (this.round) this.round.guesses.delete(playerId);
    this.broadcast();
    this.maybeEndRoundEarly();
  }

  disconnectSocket(socketId) {
    if (socketId === this.hostSocketId) this.hostSocketId = null;
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.connected = false;
        p.socketId = null;
      }
    }
    this.broadcast();
  }

  connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  // ---- game flow ---------------------------------------------------------

  start(rounds) {
    if (this.phase !== 'lobby' && this.phase !== 'final') return { error: 'Game already running.' };
    if (this.players.size < 1) return { error: 'Need at least one player.' };
    this.totalRounds = Math.max(1, Math.min(20, Number(rounds) || 6));
    this.playlist = buildPlaylist(this.totalRounds, this.rng);
    this.roundIndex = -1;
    for (const p of this.players.values()) {
      p.score = 0;
      p.edge = false;
      p.edgesEarned = 0;
    }
    this.nextRound();
    return {};
  }

  nextRound() {
    this.clearTimer();
    this.roundIndex += 1;
    if (this.roundIndex >= this.playlist.length) {
      this.phase = 'final';
      this.round = null;
      this.broadcast();
      return;
    }
    const game = BY_ID[this.playlist[this.roundIndex]];
    const made = game.create(this.rng);
    this.round = {
      game,
      ...made,
      guesses: new Map(),
      edgeHolders: new Set([...this.players.values()].filter((p) => p.edge).map((p) => p.id)),
      endsAt: null,
      results: null,
      edgeEarners: [],
    };
    this.phase = 'intro';
    this.broadcast();
    this.timer = this.timers.setTimeout(() => this.beginPlaying(), INTRO_MS);
  }

  // Longest time any stimulus takes to show, so everyone gets the same thinking time after it.
  stimulusMs() {
    const s = this.round.edgeStimulus;
    if (s.type === 'dots' || s.type === 'bar' || s.type === 'angle') return s.showMs;
    if (s.type === 'blinks') return s.count * s.intervalMs * 2 + 600;
    if (s.type === 'stopwatch') return s.target * 1000 + 5000;
    return 0;
  }

  beginPlaying() {
    this.clearTimer();
    if (!this.round) return;
    this.phase = 'playing';
    const duration = ANSWER_MS + this.stimulusMs();
    this.round.endsAt = this.now() + duration;
    this.broadcast();
    this.timer = this.timers.setTimeout(() => this.reveal(), duration);
  }

  submitGuess(playerId, value) {
    if (this.phase !== 'playing' || !this.players.has(playerId)) return { error: 'Not accepting guesses right now.' };
    const n = Number(value);
    if (!Number.isFinite(n)) return { error: 'Guess must be a number.' };
    const { min = -Infinity, max = Infinity } = this.round.game.input;
    this.round.guesses.set(playerId, Math.max(min, Math.min(max, Math.round(n * 100) / 100)));
    this.broadcast();
    this.maybeEndRoundEarly();
    return {};
  }

  maybeEndRoundEarly() {
    if (this.phase !== 'playing') return;
    const active = this.connectedPlayers();
    if (active.length && active.every((p) => this.round.guesses.has(p.id))) {
      // Small pause so the last submitter sees their "locked in" state.
      this.clearTimer();
      this.timer = this.timers.setTimeout(() => this.reveal(), 800);
    }
  }

  reveal() {
    this.clearTimer();
    if (this.phase !== 'playing') return;
    const r = this.round;
    const entries = [...this.players.values()].map((p) => ({
      id: p.id,
      guess: r.guesses.has(p.id) ? r.guesses.get(p.id) : null,
      hadEdge: r.edgeHolders.has(p.id),
    }));
    const { results, edgeEarners } = scoreRound({ answer: r.answer, tolerance: r.tolerance, entries });
    r.results = results;
    r.edgeEarners = edgeEarners;
    for (const res of results) {
      const p = this.players.get(res.id);
      if (p) p.score += res.points;
    }
    const isLastRound = this.roundIndex >= this.playlist.length - 1;
    for (const p of this.players.values()) {
      p.edge = !isLastRound && edgeEarners.includes(p.id);
      if (p.edge) p.edgesEarned += 1;
    }
    this.phase = 'reveal';
    this.broadcast();
  }

  backToLobby() {
    this.clearTimer();
    this.phase = 'lobby';
    this.round = null;
    this.roundIndex = -1;
    for (const p of this.players.values()) p.edge = false;
    this.broadcast();
  }

  clearTimer() {
    if (this.timer) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  destroy() {
    this.clearTimer();
  }

  // ---- views -------------------------------------------------------------

  standings() {
    return [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, edge: p.edge, edgesEarned: p.edgesEarned, connected: p.connected }))
      .sort((a, b) => b.score - a.score);
  }

  publicRound() {
    const r = this.round;
    if (!r) return null;
    const base = {
      number: this.roundIndex + 1,
      total: this.playlist.length,
      game: describe(r.game),
      edgeHolders: [...r.edgeHolders],
      submitted: [...r.guesses.keys()],
      endsInMs: r.endsAt ? Math.max(0, r.endsAt - this.now()) : null,
    };
    if (this.phase === 'reveal') {
      base.answer = r.answer;
      base.revealText = r.reveal || null;
      base.results = r.results;
      base.edgeEarners = r.edgeEarners;
      base.isLast = this.roundIndex >= this.playlist.length - 1;
    }
    return base;
  }

  hostView() {
    return {
      code: this.code,
      phase: this.phase,
      totalRounds: this.totalRounds,
      edgeSlots: edgeSlots(this.players.size),
      players: this.standings(),
      round: this.publicRound(),
    };
  }

  playerView(player) {
    const view = { ...this.hostView(), you: { id: player.id, name: player.name, color: player.color, score: player.score, edge: player.edge } };
    const r = this.round;
    if (r && this.phase === 'playing') {
      const hasEdge = r.edgeHolders.has(player.id);
      view.yourRound = {
        hasEdge,
        stimulus: hasEdge ? r.edgeStimulus : r.stimulus,
        submitted: r.guesses.has(player.id),
        guess: r.guesses.get(player.id) ?? null,
      };
    } else if (r && this.phase === 'intro') {
      view.yourRound = { hasEdge: r.edgeHolders.has(player.id) };
    }
    return view;
  }

  broadcast() {
    if (this.hostSocketId) this.emitTo(this.hostSocketId, 'state', this.hostView());
    for (const p of this.players.values()) {
      if (p.socketId) this.emitTo(p.socketId, 'state', this.playerView(p));
    }
  }
}

module.exports = { Room, MAX_PLAYERS, INTRO_MS, ANSWER_MS };
