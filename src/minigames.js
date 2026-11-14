// Mini guessing games.
//
// Every mini-game boils down to "guess a number": the server knows the true
// answer, each player submits a guess, and points are awarded by how close
// they got. What changes from game to game is what the player gets to see
// before guessing (the "stimulus") — and players holding the EDGE get a
// slightly better look (more time, an extra clue, slower blinks...).
//
// create(rng) returns:
//   answer        the true value
//   stimulus      what a normal player's phone receives
//   edgeStimulus  what an EDGE holder's phone receives
//   reveal        extra info the host screen shows when the answer is revealed

const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// A window of `width` that contains `value`, randomly positioned, inside [min,max].
function windowAround(rng, value, width, min, max) {
  let low = value - randInt(rng, 0, width);
  low = clamp(low, min, max - width);
  return { low, high: low + width };
}

const DOT_COLORS = ['#ff5d73', '#ffb347', '#ffe156', '#5ce1e6', '#7b9cff', '#c38bff', '#6be38f'];

const ESTIMATES = [
  { q: 'How many keys are on a standard piano?', answer: 88, tolerance: 50 },
  { q: 'How many bones are in the adult human body?', answer: 206, tolerance: 120 },
  { q: 'In what year was the first iPhone released?', answer: 2007, tolerance: 15 },
  { q: 'How many countries are members of the United Nations?', answer: 193, tolerance: 90 },
  { q: 'How tall is the Eiffel Tower, in meters?', answer: 330, tolerance: 200 },
  { q: 'How tall is Mount Everest, in meters?', answer: 8849, tolerance: 4000 },
  { q: 'How many Earth days long is one year on Mars?', answer: 687, tolerance: 350 },
  { q: 'In what year did the Titanic sink?', answer: 1912, tolerance: 30 },
  { q: 'How many hearts does an octopus have?', answer: 3, tolerance: 4 },
  { q: 'How many minutes are in one week?', answer: 10080, tolerance: 6000 },
  { q: 'How many elements are on the periodic table?', answer: 118, tolerance: 70 },
  { q: 'In what year did Wikipedia launch?', answer: 2001, tolerance: 12 },
  { q: 'How many feet are in a mile?', answer: 5280, tolerance: 3000 },
  { q: 'What percent of Earth’s surface is covered by water?', answer: 71, tolerance: 35 },
  { q: 'How long is a marathon, in kilometers (rounded)?', answer: 42, tolerance: 25 },
  { q: 'What is the boiling point of water in °F?', answer: 212, tolerance: 100 },
  { q: 'How fast does sound travel in air, in meters per second?', answer: 343, tolerance: 250 },
  { q: 'How many teeth does a typical adult have (including wisdom teeth)?', answer: 32, tolerance: 20 },
  { q: 'How many legs does a lobster have?', answer: 10, tolerance: 8 },
  { q: 'How many squares are on a chessboard?', answer: 64, tolerance: 40 },
];

const MINIGAMES = [
  {
    id: 'dots',
    title: 'Dot Flash',
    emoji: '\u{1F534}',
    instructions: 'A bunch of dots will flash on your screen. How many were there?',
    edgeText: 'Twice as long to look at the dots.',
    input: { kind: 'number', min: 0, max: 200, step: 1, unit: 'dots' },
    create(rng) {
      const count = randInt(rng, 18, 60);
      const dots = Array.from({ length: count }, () => ({
        x: +(rng() * 92 + 4).toFixed(1),
        y: +(rng() * 92 + 4).toFixed(1),
        r: +(rng() * 2 + 2).toFixed(1),
        c: pick(rng, DOT_COLORS),
      }));
      return {
        answer: count,
        tolerance: Math.max(10, Math.round(count * 0.6)),
        stimulus: { type: 'dots', dots, showMs: 1500 },
        edgeStimulus: { type: 'dots', dots, showMs: 3000 },
      };
    },
  },
  {
    id: 'bar',
    title: 'Fill Level',
    emoji: '\u{1F4CA}',
    instructions: 'A bar will flash partly filled. What percent full was it?',
    edgeText: 'A much longer look at the bar.',
    input: { kind: 'slider', min: 0, max: 100, step: 1, unit: '%' },
    create(rng) {
      const percent = randInt(rng, 4, 96);
      return {
        answer: percent,
        tolerance: 35,
        stimulus: { type: 'bar', percent, showMs: 800 },
        edgeStimulus: { type: 'bar', percent, showMs: 2200 },
      };
    },
  },
  {
    id: 'angle',
    title: 'Angle Eye',
    emoji: '\u{1F4D0}',
    instructions: 'A line will flash at an angle. How many degrees was it (0–180)?',
    edgeText: 'A longer look, plus tick marks.',
    input: { kind: 'slider', min: 0, max: 180, step: 1, unit: '°' },
    create(rng) {
      const degrees = randInt(rng, 8, 172);
      return {
        answer: degrees,
        tolerance: 60,
        stimulus: { type: 'angle', degrees, showMs: 1000, ticks: false },
        edgeStimulus: { type: 'angle', degrees, showMs: 2200, ticks: true },
      };
    },
  },
  {
    id: 'stopwatch',
    title: 'Blind Stopwatch',
    emoji: '⏱️',
    instructions: 'Start the stopwatch and stop it as close to the target time as you can. The clock disappears after a moment!',
    edgeText: 'The clock stays visible longer before it vanishes.',
    input: { kind: 'stopwatch', unit: 's' },
    create(rng) {
      const target = randInt(rng, 40, 99) / 10;
      return {
        answer: target,
        tolerance: 3,
        stimulus: { type: 'stopwatch', target, visibleMs: 1200 },
        edgeStimulus: { type: 'stopwatch', target, visibleMs: 3200 },
      };
    },
  },
  {
    id: 'blinks',
    title: 'Blink Count',
    emoji: '\u{1F4A1}',
    instructions: 'A light will blink really fast. Count the blinks!',
    edgeText: 'The light blinks at a slower pace.',
    input: { kind: 'number', min: 0, max: 100, step: 1, unit: 'blinks' },
    create(rng) {
      const count = randInt(rng, 9, 24);
      return {
        answer: count,
        tolerance: Math.max(6, Math.round(count * 0.6)),
        stimulus: { type: 'blinks', count, intervalMs: 170 },
        edgeStimulus: { type: 'blinks', count, intervalMs: 320 },
      };
    },
  },
  {
    id: 'mystery',
    title: 'Mystery Number',
    emoji: '\u{1F522}',
    instructions: 'I’m thinking of a number from 1 to 100. Use the clue to guess it.',
    edgeText: 'A second, sharper clue.',
    input: { kind: 'number', min: 1, max: 100, step: 1, unit: '' },
    create(rng) {
      const answer = randInt(rng, 1, 100);
      const wide = windowAround(rng, answer, 50, 1, 100);
      const narrow = windowAround(rng, answer, 16, 1, 100);
      const parity = answer % 2 === 0 ? 'even' : 'odd';
      const clues = [`It’s between ${wide.low} and ${wide.high}.`];
      return {
        answer,
        tolerance: 50,
        stimulus: { type: 'clues', clues },
        edgeStimulus: {
          type: 'clues',
          clues: [...clues, `EDGE CLUE: it’s ${parity}, between ${narrow.low} and ${narrow.high}.`],
        },
      };
    },
  },
  {
    id: 'estimate',
    title: 'Ballpark',
    emoji: '\u{1F3AF}',
    instructions: 'Answer a trivia question with your best estimate.',
    edgeText: 'A hint range that contains the answer.',
    input: { kind: 'number', min: 0, max: 1000000, step: 1, unit: '' },
    create(rng) {
      const item = pick(rng, ESTIMATES);
      const width = Math.max(2, Math.round(item.tolerance * 0.5));
      const hint = windowAround(rng, item.answer, width, 0, Number.MAX_SAFE_INTEGER);
      return {
        answer: item.answer,
        tolerance: item.tolerance,
        stimulus: { type: 'question', question: item.q },
        edgeStimulus: {
          type: 'question',
          question: item.q,
          hint: `EDGE HINT: it’s between ${hint.low} and ${hint.high}.`,
        },
        reveal: item.q,
      };
    },
  },
];

const BY_ID = Object.fromEntries(MINIGAMES.map((g) => [g.id, g]));

// Public description of a game (no answers), safe to send to clients.
function describe(game) {
  const { id, title, emoji, instructions, edgeText, input } = game;
  return { id, title, emoji, instructions, edgeText, input };
}

// Build a playlist of `rounds` games, cycling through shuffled decks so the
// same game never appears twice in a row and every game shows up before repeats.
function buildPlaylist(rounds, rng = Math.random) {
  const list = [];
  while (list.length < rounds) {
    const deck = MINIGAMES.map((g) => g.id);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    if (list.length && deck[0] === list[list.length - 1]) deck.push(deck.shift());
    list.push(...deck);
  }
  return list.slice(0, rounds);
}

module.exports = { MINIGAMES, BY_ID, ESTIMATES, describe, buildPlaylist, windowAround };
