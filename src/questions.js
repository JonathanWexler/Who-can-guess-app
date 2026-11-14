// The 50 picture questions.
//
// Each question plays an animation on the big screen and asks everyone ONE
// thing. Players get one locked-in guess; it has to be exactly right.
//
//   kind: 'number'  → players type a whole number
//   kind: 'choice'  → players tap one of the options
//
// create(rng) returns:
//   answer    the correct number, or the index of the correct option
//   options   (choice only) [{ label, emoji?, color? }]
//   data      everything the host screen needs to draw the animation
//   watchMs   how long the animation needs before the 20s answer window
//   prompt    (optional) overrides the question text for this round
//
// Answer-relevant randomness lives here on the server; the host screen only
// adds cosmetic randomness (positions, wobbles) when it draws.

const int = (rng, a, b) => Math.floor(rng() * (b - a + 1)) + a;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
function shuffle(rng, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sample = (rng, list, n) => shuffle(rng, list).slice(0, n);

// n event times (ms), each gap random in [minGap, maxGap].
function beats(rng, n, minGap, maxGap, start = 800) {
  const out = [];
  let t = start;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += int(rng, minGap, maxGap);
  }
  return out;
}
const last = (arr) => arr[arr.length - 1];

// Choice question with the correct option shuffled among distractors.
function choice(rng, correct, distractors) {
  const options = shuffle(rng, [correct, ...distractors]);
  return { options, answer: options.indexOf(correct) };
}

const COLORS = {
  Red: '#ff4b4b', Orange: '#ff9a1f', Yellow: '#ffd93b', Green: '#3ccf5a', Blue: '#3b8bff',
  Purple: '#a35bff', Pink: '#ff8ad8', Gray: '#9a9a9a', 'Light blue': '#9fd8ff', Brown: '#8b5a2b', White: '#ffffff', Black: '#222222',
};
const colorOpt = (name) => ({ label: name, color: COLORS[name] });

const QUESTIONS = [
  // ---------------------------------------------------------------- counting
  {
    id: 'balloons', title: 'Balloon Pop', emoji: '\u{1F388}', kind: 'number',
    prompt: 'How many balloons were there BEFORE they started popping?',
    create(rng) {
      const count = int(rng, 40, 65);
      return { answer: count, data: { count, intactMs: 5000, popEveryMs: 280 }, watchMs: 5000 };
    },
  },
  {
    id: 'blinks', title: 'Blink-Off', emoji: '\u{1F440}', kind: 'number',
    prompt: 'How many times did they blink?',
    create(rng) {
      const n = int(rng, 8, 20);
      const times = beats(rng, n, 250, 1100, 1200);
      return { answer: n, data: { times }, watchMs: last(times) + 1800 };
    },
  },
  {
    id: 'sheep', title: 'Counting Sheep', emoji: '\u{1F411}', kind: 'number',
    prompt: 'How many SHEEP jumped the fence? (Goats don’t count!)',
    create(rng) {
      const sheep = int(rng, 8, 17);
      const seq = shuffle(rng, [...Array(sheep).fill('s'), ...Array(int(rng, 2, 6)).fill('g')]);
      const times = beats(rng, seq.length, 450, 900);
      return { answer: sheep, data: { seq, times }, watchMs: last(times) + 2000 };
    },
  },
  {
    id: 'jellybeans', title: 'Candy Jar', emoji: '\u{1F36C}', kind: 'number',
    prompt: 'How many candies dropped into the jar?',
    create(rng) {
      const n = int(rng, 15, 32);
      const times = beats(rng, n, 150, 420);
      return { answer: n, data: { times }, watchMs: last(times) + 1500 };
    },
  },
  {
    id: 'bounces', title: 'Super Bouncy Ball', emoji: '⚽', kind: 'number',
    prompt: 'How many times did the ball bounce?',
    create(rng) {
      const n = int(rng, 6, 15);
      const gaps = Array.from({ length: n }, () => int(rng, 300, 900));
      return { answer: n, data: { gaps }, watchMs: gaps.reduce((a, b) => a + b, 0) + 1800 };
    },
  },
  {
    id: 'fishtank', title: 'Fish Tank', emoji: '\u{1F420}', kind: 'number',
    prompt: 'How many fish were swimming in the tank?',
    create(rng) {
      const n = int(rng, 10, 22);
      return { answer: n, data: { count: n, showMs: 8000 }, watchMs: 8000 };
    },
  },
  {
    id: 'fireworks', title: 'Fireworks Show', emoji: '\u{1F386}', kind: 'number',
    prompt: 'How many fireworks went off?',
    create(rng) {
      const n = int(rng, 6, 15);
      const times = beats(rng, n, 60, 1200);
      return { answer: n, data: { times }, watchMs: last(times) + 1800 };
    },
  },
  {
    id: 'shootingstars', title: 'Shooting Stars', emoji: '\u{1F320}', kind: 'number',
    prompt: 'How many shooting stars zoomed across the sky?',
    create(rng) {
      const n = int(rng, 4, 12);
      const times = beats(rng, n, 300, 1500);
      return { answer: n, data: { times }, watchMs: last(times) + 1500 };
    },
  },
  {
    id: 'ducks', title: 'Duck Parade', emoji: '\u{1F986}', kind: 'number',
    prompt: 'How many ducks waddled by?',
    create(rng) {
      const n = int(rng, 10, 25);
      const times = beats(rng, n, 180, 650, 300);
      return { answer: n, data: { times, crossMs: 3600 }, watchMs: last(times) + 3800 };
    },
  },
  {
    id: 'popcorn', title: 'Popcorn Party', emoji: '\u{1F37F}', kind: 'number',
    prompt: 'How many kernels popped?',
    create(rng) {
      const n = int(rng, 15, 32);
      const times = beats(rng, n, 40, 600);
      return { answer: n, data: { times }, watchMs: last(times) + 1500 };
    },
  },
  {
    id: 'froghops', title: 'Hoppy Frog', emoji: '\u{1F438}', kind: 'number',
    prompt: 'How many hops did the frog take?',
    create(rng) {
      const n = int(rng, 6, 16);
      const times = beats(rng, n, 350, 1000);
      return { answer: n, data: { times }, watchMs: last(times) + 1600 };
    },
  },
  {
    id: 'cookie', title: 'Cookie Monster Munch', emoji: '\u{1F36A}', kind: 'number',
    prompt: 'How many bites were taken out of the cookie?',
    create(rng) {
      const n = int(rng, 5, 12);
      const times = beats(rng, n, 400, 1000);
      return { answer: n, data: { times }, watchMs: last(times) + 1800 };
    },
  },
  {
    id: 'pinksnow', title: 'Pink Snow', emoji: '❄️', kind: 'number',
    prompt: 'How many PINK snowflakes fell?',
    create(rng) {
      const pink = int(rng, 6, 15);
      const seq = shuffle(rng, [...Array(pink).fill(true), ...Array(int(rng, 30, 45)).fill(false)]);
      const times = beats(rng, seq.length, 80, 260);
      return { answer: pink, data: { seq, times, fallMs: 3800 }, watchMs: last(times) + 3800 };
    },
  },
  {
    id: 'apples', title: 'Apple Picker', emoji: '\u{1F34E}', kind: 'number',
    prompt: 'How many RED APPLES were in the picture?',
    create(rng) {
      const apples = int(rng, 8, 20);
      const others = Array.from({ length: int(rng, 16, 26) }, () => pick(rng, ['\u{1F353}', '\u{1F352}', '\u{1F345}', '\u{1F351}', '\u{1F34A}', '\u{1F350}', '\u{1F34F}']));
      return { answer: apples, data: { items: shuffle(rng, [...Array(apples).fill('\u{1F34E}'), ...others]), showMs: 6000 }, watchMs: 6000 };
    },
  },
  {
    id: 'ladybug', title: 'Ladybug Spots', emoji: '\u{1F41E}', kind: 'number',
    prompt: 'How many spots did the ladybug have?',
    create(rng) {
      const spots = int(rng, 10, 26);
      return { answer: spots, data: { spots, showMs: 6000 }, watchMs: 7000 };
    },
  },
  {
    id: 'dominoes', title: 'Domino Topple', emoji: '\u{1F0CF}', kind: 'number',
    prompt: 'How many dominoes fell over?',
    create(rng) {
      const n = int(rng, 12, 30);
      return { answer: n, data: { count: n, standMs: 2500, stepMs: 130 }, watchMs: 2500 + n * 130 + 1500 };
    },
  },
  {
    id: 'train', title: 'Choo-Choo Count', emoji: '\u{1F682}', kind: 'number',
    prompt: 'How many train cars went by? (Don’t count the engine!)',
    create(rng) {
      const cars = int(rng, 8, 20);
      return { answer: cars, data: { cars: Array.from({ length: cars }, () => pick(rng, ['\u{1F683}', '\u{1F683}', '\u{1F68B}'])), crossMs: 5200 }, watchMs: 6000 };
    },
  },
  {
    id: 'elevator', title: 'Elevator Ride', emoji: '\u{1F6D7}', kind: 'number',
    prompt: 'Which floor did the elevator end up on?',
    create(rng) {
      const start = int(rng, 1, 5);
      let floor = start;
      const moves = [];
      for (let i = 0; i < int(rng, 4, 6); i++) {
        let m;
        do { m = pick(rng, [1, 2, 3, 4, 5]) * (rng() < 0.55 ? 1 : -1); } while (floor + m < 1 || floor + m > 15);
        moves.push(m);
        floor += m;
      }
      return { answer: floor, data: { start, moves, stepMs: 2000 }, watchMs: 1500 + moves.length * 2000 + 500 };
    },
  },
  {
    id: 'bus', title: 'The Bus Stop', emoji: '\u{1F68C}', kind: 'number',
    prompt: 'How many people are on the bus at the end?',
    create(rng) {
      let riders = int(rng, 3, 8);
      const start = riders;
      const stops = [];
      for (let i = 0; i < 3; i++) {
        const off = int(rng, 0, Math.min(riders, 4));
        const on = int(rng, 0, 4);
        riders += on - off;
        stops.push({ off, on });
      }
      return { answer: riders, data: { start, stops, perPersonMs: 300, pauseMs: 1100 }, watchMs: 2200 + stops.reduce((t, s) => t + 1400 + (s.on + s.off) * 300, 0) };
    },
  },
  {
    id: 'tally', title: 'Tally Flash', emoji: '✏️', kind: 'number',
    prompt: 'How many tally marks were there in total?',
    create(rng) {
      const n = int(rng, 17, 43);
      return { answer: n, data: { count: n, showMs: 4000 }, watchMs: 4000 };
    },
  },
  {
    id: 'gems', title: 'Treasure Chest', emoji: '\u{1F48E}', kind: 'number',
    prompt: 'How many points are in the treasure chest? (\u{1F48E} = 5, ⭐ = 2, \u{1FA99} = 1)',
    create(rng) {
      const seq = Array.from({ length: int(rng, 6, 11) }, () => pick(rng, ['\u{1F48E}', '⭐', '⭐', '\u{1FA99}', '\u{1FA99}']));
      const value = { '\u{1F48E}': 5, '⭐': 2, '\u{1FA99}': 1 };
      return { answer: seq.reduce((t, g) => t + value[g], 0), data: { seq, stepMs: 900 }, watchMs: 1000 + seq.length * 900 + 800 };
    },
  },
  {
    id: 'dice', title: 'Dice Roll', emoji: '\u{1F3B2}', kind: 'number',
    prompt: 'What did all the dice add up to?',
    create(rng) {
      const faces = Array.from({ length: int(rng, 3, 4) }, () => int(rng, 1, 6));
      return { answer: faces.reduce((a, b) => a + b, 0), data: { faces, rollMs: 1500, showMs: 2500 }, watchMs: 4600 };
    },
  },
  {
    id: 'cups', title: 'Cup Pyramid', emoji: '\u{1F964}', kind: 'number',
    prompt: 'How many cups were in the pyramids?',
    create(rng) {
      const rows = Array.from({ length: int(rng, 1, 2) }, () => int(rng, 3, 7));
      return { answer: rows.reduce((t, r) => t + (r * (r + 1)) / 2, 0), data: { rows, showMs: 4000 }, watchMs: 4000 };
    },
  },
  {
    id: 'hamsters', title: 'Pop-Up Hamsters', emoji: '\u{1F439}', kind: 'number',
    prompt: 'How many times did a hamster pop up?',
    create(rng) {
      const n = int(rng, 10, 20);
      const times = beats(rng, n, 150, 800);
      return { answer: n, data: { events: times.map((t) => ({ t, hole: int(rng, 0, 8) })) }, watchMs: last(times) + 1500 };
    },
  },
  {
    id: 'ufo', title: 'UFO Farm Visit', emoji: '\u{1F6F8}', kind: 'number',
    prompt: 'How many COWS got beamed up into the UFO?',
    create(rng) {
      const cows = int(rng, 4, 10);
      const seq = shuffle(rng, [...Array(cows).fill('cow'), ...Array(int(rng, 2, 5)).fill('chicken')]);
      return { answer: cows, data: { seq, stayCows: int(rng, 2, 4), stayChickens: int(rng, 1, 3), stepMs: 850 }, watchMs: 1200 + seq.length * 850 + 1000 };
    },
  },
  {
    id: 'ants', title: 'Ant Picnic', emoji: '\u{1F41C}', kind: 'number',
    prompt: 'How many ants were carrying bread crumbs?',
    create(rng) {
      const carriers = int(rng, 5, 13);
      const seq = shuffle(rng, [...Array(carriers).fill(true), ...Array(int(rng, 10, 16)).fill(false)]);
      const times = beats(rng, seq.length, 200, 500, 300);
      return { answer: carriers, data: { seq, times, crossMs: 3500 }, watchMs: last(times) + 3700 };
    },
  },
  {
    id: 'windows', title: 'Lights Out', emoji: '\u{1F3E2}', kind: 'number',
    prompt: 'How many windows were lit up right before the blackout?',
    create(rng) {
      const lit = int(rng, 6, 15);
      return { answer: lit, data: { final: sample(rng, [...Array(30).keys()], lit), flickerMs: 5000, holdMs: 2500 }, watchMs: 7700 };
    },
  },
  {
    id: 'stroop', title: 'Tricky Colors', emoji: '\u{1F3A8}', kind: 'number',
    prompt: 'How many words were written in BLUE ink? (Not the word BLUE — the color of the letters!)',
    create(rng) {
      const names = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE'];
      const inkOf = { RED: 'Red', BLUE: 'Blue', GREEN: 'Green', YELLOW: 'Yellow', PURPLE: 'Purple', ORANGE: 'Orange' };
      const blue = int(rng, 5, 11);
      const inks = shuffle(rng, [...Array(blue).fill('Blue'), ...Array.from({ length: 24 - blue }, () => pick(rng, ['Red', 'Green', 'Yellow', 'Purple', 'Orange']))]);
      // Lots of the word "BLUE" in other colors to trip people up.
      const words = inks.map((ink) => ({ word: rng() < 0.35 ? 'BLUE' : pick(rng, names.filter((n) => inkOf[n] !== ink)), ink: COLORS[ink] }));
      return { answer: blue, data: { words, showMs: 8000 }, watchMs: 8000 };
    },
  },
  {
    id: 'traffic', title: 'Traffic Light Chaos', emoji: '\u{1F6A6}', kind: 'number',
    prompt: 'How many times did the light turn GREEN?',
    create(rng) {
      const seq = [];
      const len = int(rng, 18, 26);
      while (seq.length < len) {
        const c = pick(rng, ['red', 'yellow', 'green']);
        if (c !== seq[seq.length - 1]) seq.push(c);
      }
      const stepMs = int(rng, 380, 600);
      return { answer: seq.filter((c) => c === 'green').length, data: { seq, stepMs }, watchMs: 800 + len * stepMs + 800 };
    },
  },
  {
    id: 'spotdiff', title: 'Spot the Difference', emoji: '\u{1F50D}', kind: 'number',
    prompt: 'How many differences are there between the two pictures?',
    create(rng) {
      const pool = ['\u{1F431}', '\u{1F436}', '\u{1F42D}', '\u{1F430}', '\u{1F98A}', '\u{1F43B}', '\u{1F43C}', '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F42E}', '\u{1F437}', '\u{1F438}', '\u{1F435}', '\u{1F414}', '\u{1F427}'];
      const left = Array.from({ length: 20 }, () => pick(rng, pool));
      const right = [...left];
      const diffs = int(rng, 3, 7);
      for (const i of sample(rng, [...Array(20).keys()], diffs)) right[i] = pick(rng, pool.filter((e) => e !== left[i]));
      return { answer: diffs, data: { left, right, showMs: 12000 }, watchMs: 12000 };
    },
  },
  {
    id: 'scale', title: 'Balance Scale', emoji: '⚖️', kind: 'number',
    prompt: '',
    create(rng) {
      const [big, small] = pick(rng, [['\u{1F349}', '\u{1F34E}'], ['\u{1F418}', '\u{1F415}'], ['\u{1F383}', '\u{1F34B}'], ['\u{1F995}', '\u{1F98A}']]);
      const k = int(rng, 2, 5);
      const m = int(rng, 2, 4);
      return { answer: k * m, prompt: `If one ${big} weighs the same as ${k} ${small}, how many ${small} balance ${m} ${big}?`, data: { big, small, k, m }, watchMs: 3000 };
    },
  },
  {
    id: 'numberrain', title: 'Number Rain', emoji: '\u{1F522}', kind: 'number',
    prompt: 'Keep a running total! What number do you end up with?',
    create(rng) {
      let total = int(rng, 2, 9);
      const start = total;
      const ops = [];
      for (let i = 0; i < int(rng, 4, 5); i++) {
        const plus = rng() < 0.6 || total < 3;
        const n = plus ? int(rng, 1, 9) : int(rng, 1, Math.min(5, total));
        ops.push(plus ? n : -n);
        total += plus ? n : -n;
      }
      return { answer: total, data: { start, ops, stepMs: 1500 }, watchMs: 1500 + ops.length * 1500 + 500 };
    },
  },
  {
    id: 'pizza', title: 'Dino Pizza Party', emoji: '\u{1F355}', kind: 'number',
    prompt: 'How many pizza slices were LEFT when the box closed?',
    create(rng) {
      const slices = pick(rng, [6, 8, 10, 12]);
      const eaten = int(rng, 2, slices - 2);
      const times = beats(rng, eaten, 450, 1000, 2800);
      return { answer: slices - eaten, data: { slices, eatOrder: sample(rng, [...Array(slices).keys()], eaten), times }, watchMs: last(times) + 1600 };
    },
  },
  {
    id: 'rocket', title: 'Countdown Glitch', emoji: '\u{1F680}', kind: 'number',
    prompt: 'The countdown skipped a number. Which one?',
    create(rng) {
      const skipped = int(rng, 2, 9);
      return { answer: skipped, data: { skipped, stepMs: 520 }, watchMs: 800 + 9 * 520 + 1800 };
    },
  },
  {
    id: 'oddtile', title: 'Odd One Out', emoji: '\u{1F9E9}', kind: 'number',
    prompt: 'One tile is different. What number was on it?',
    create(rng) {
      const pair = pick(rng, [['\u{1F600}', '\u{1F603}'], ['\u{1F642}', '\u{1F643}'], ['\u{1F43B}', '\u{1F428}'], ['⭐', '\u{1F31F}'], ['\u{1F34E}', '\u{1F345}'], ['\u{1F499}', '\u{1F49C}'], ['\u{1F550}', '\u{1F551}'], ['\u{1F431}', '\u{1F42F}'], ['\u{1F34A}', '\u{1F351}']]);
      const index = int(rng, 0, 19);
      return { answer: index + 1, data: { base: pair[0], odd: pair[1], index, showMs: 7000 }, watchMs: 7000 };
    },
  },
  {
    id: 'cardflip', title: 'Card Memory', emoji: '\u{1F0CF}', kind: 'number',
    prompt: '',
    create(rng) {
      const animals = sample(rng, ['\u{1F438}', '\u{1F98A}', '\u{1F43C}', '\u{1F984}', '\u{1F419}', '\u{1F98B}', '\u{1F422}', '\u{1F427}', '\u{1F42C}', '\u{1F981}', '\u{1F99C}', '\u{1F994}'], 8);
      const target = int(rng, 0, 7);
      return { answer: target + 1, prompt: `Which card number was the ${animals[target]} hiding under?`, data: { animals, showMs: 4000 }, watchMs: 5000 };
    },
  },
  {
    id: 'shapes', title: 'Shape Storm', emoji: '\u{1F53A}', kind: 'number',
    prompt: 'How many TRIANGLES were floating around?',
    create(rng) {
      const tri = int(rng, 6, 14);
      const shapes = shuffle(rng, [...Array(tri).fill('triangle'), ...Array.from({ length: int(rng, 16, 24) }, () => pick(rng, ['circle', 'square', 'star', 'diamond']))]);
      return { answer: tri, data: { shapes, showMs: 7000 }, watchMs: 7000 };
    },
  },

  // ---------------------------------------------------------------- choices
  {
    id: 'shellgame', title: 'Shell Game', emoji: '\u{1F964}', kind: 'choice',
    prompt: 'Which cup is the ball under? (Cups are numbered 1\u20134 from the left.)',
    create(rng) {
      const start = int(rng, 0, 3);
      const swaps = Array.from({ length: int(rng, 6, 10) }, () => sample(rng, [0, 1, 2, 3], 2));
      let pos = start;
      for (const [a, b] of swaps) pos = pos === a ? b : pos === b ? a : pos;
      const speedMs = int(rng, 380, 560);
      return {
        answer: pos,
        options: [{ label: 'Cup 1' }, { label: 'Cup 2' }, { label: 'Cup 3' }, { label: 'Cup 4' }],
        data: { start, swaps, speedMs },
        watchMs: 2600 + swaps.length * speedMs + 600,
      };
    },
  },
  {
    id: 'photofinish', title: 'Photo Finish', emoji: '\u{1F3C1}', kind: 'choice',
    prompt: 'Who crossed the finish line FIRST?',
    create(rng) {
      const pool = [['\u{1F422}', 'Turtle'], ['\u{1F407}', 'Rabbit'], ['\u{1F40C}', 'Snail'], ['\u{1F994}', 'Hedgehog'], ['\u{1F40E}', 'Horse'], ['\u{1F415}', 'Dog'], ['\u{1F408}', 'Cat'], ['\u{1F986}', 'Duck'], ['\u{1F416}', 'Pig'], ['\u{1F401}', 'Mouse']];
      const racers = sample(rng, pool, 4);
      const winner = int(rng, 0, 3);
      const base = 6000;
      const finishMs = racers.map((_, i) => (i === winner ? base : base + int(rng, 60, 320)));
      // Progress checkpoints (fraction of the race at 20%, 40%, 60%, 80% of each racer's time),
      // jumbled so the lead changes along the way.
      const checkpoints = racers.map(() => [0.12, 0.35, 0.55, 0.78].map((p) => +(p + (rng() - 0.5) * 0.18).toFixed(3)));
      return {
        ...choice(rng, racers[winner], racers.filter((_, i) => i !== winner)),
        data: { racers: racers.map(([emoji]) => emoji), finishMs, checkpoints },
        watchMs: base + 1800,
      };
    },
    // options need {label, emoji}; mapped in finalize()
  },
  {
    id: 'shadow', title: 'Mystery Shadow', emoji: '\u{1F526}', kind: 'choice',
    prompt: 'Whose shadow is this?',
    create(rng) {
      const pool = [['\u{1F418}', 'Elephant'], ['\u{1F992}', 'Giraffe'], ['\u{1F407}', 'Rabbit'], ['\u{1F422}', 'Turtle'], ['\u{1F980}', 'Crab'], ['\u{1F419}', 'Octopus'], ['\u{1F98B}', 'Butterfly'], ['\u{1F40C}', 'Snail'], ['\u{1F998}', 'Kangaroo'], ['\u{1F9A9}', 'Flamingo'], ['\u{1F42A}', 'Camel'], ['\u{1F995}', 'Dinosaur'], ['\u{1F43F}️', 'Squirrel'], ['\u{1F994}', 'Hedgehog'], ['\u{1F413}', 'Rooster'], ['\u{1F988}', 'Shark'], ['\u{1F40A}', 'Crocodile'], ['\u{1F99C}', 'Parrot'], ['\u{1F40E}', 'Horse'], ['\u{1F989}', 'Owl']];
      const [correct, ...others] = sample(rng, pool, 4);
      return { ...choice(rng, correct, others), data: { emoji: correct[0] }, watchMs: 0 };
    },
  },
  {
    id: 'zoom', title: 'Super Zoom', emoji: '\u{1F50E}', kind: 'choice',
    prompt: 'What is this a super close-up of?',
    create(rng) {
      const pool = [['\u{1F355}', 'Pizza'], ['\u{1F6B2}', 'Bicycle'], ['\u{1F3B8}', 'Guitar'], ['\u{1F369}', 'Donut'], ['\u{1F335}', 'Cactus'], ['\u{1F354}', 'Burger'], ['\u{1F3F0}', 'Castle'], ['⚽', 'Soccer ball'], ['\u{1F984}', 'Unicorn'], ['\u{1F382}', 'Birthday cake'], ['\u{1F681}', 'Helicopter'], ['\u{1F349}', 'Watermelon'], ['\u{1F43C}', 'Panda'], ['\u{1F33B}', 'Sunflower'], ['\u{1F353}', 'Strawberry'], ['\u{1F993}', 'Zebra'], ['\u{1F42F}', 'Tiger'], ['\u{1F383}', 'Pumpkin'], ['\u{1F34D}', 'Pineapple'], ['\u{1F99A}', 'Peacock'], ['\u{1F680}', 'Rocket'], ['\u{1F308}', 'Rainbow']];
      const [correct, ...others] = sample(rng, pool, 4);
      return { ...choice(rng, correct, others), data: { emoji: correct[0], originX: int(rng, 30, 70), originY: int(rng, 30, 70) }, watchMs: 0 };
    },
  },
  {
    id: 'missing', title: 'What’s Missing?', emoji: '❓', kind: 'choice',
    prompt: 'Which thing disappeared?',
    create(rng) {
      const pool = ['\u{1F680}', '\u{1F3B8}', '\u{1F36D}', '\u{1F9F8}', '\u{1F45F}', '\u{1F3A9}', '\u{1F511}', '\u{1F4F7}', '\u{1F308}', '\u{1F370}', '⚽', '\u{1F9C1}', '\u{1F3B2}', '\u{1F33A}', '\u{1F4DA}', '\u{1F9F2}', '⏰', '\u{1F453}'];
      const items = sample(rng, pool, 8);
      const gone = int(rng, 0, 7);
      const others = sample(rng, items.filter((_, i) => i !== gone), 3);
      const toOpt = (e) => ({ label: '', emoji: e });
      const c = choice(rng, toOpt(items[gone]), others.map(toOpt));
      return { ...c, data: { items, after: shuffle(rng, items.filter((_, i) => i !== gone)), showMs: 5000, blankMs: 1200 }, watchMs: 6500 };
    },
  },
  {
    id: 'paint', title: 'Paint Mixer', emoji: '\u{1F58C}️', kind: 'choice',
    prompt: 'What color do you get when you mix these paints?',
    create(rng) {
      const mixes = [['Red', 'Yellow', 'Orange'], ['Blue', 'Yellow', 'Green'], ['Red', 'Blue', 'Purple'], ['Red', 'White', 'Pink'], ['Black', 'White', 'Gray'], ['Blue', 'White', 'Light blue'], ['Red', 'Green', 'Brown']];
      const [a, b, result] = pick(rng, mixes);
      const others = sample(rng, ['Orange', 'Green', 'Purple', 'Pink', 'Gray', 'Light blue', 'Brown'].filter((c) => c !== result), 3);
      return { ...choice(rng, colorOpt(result), others.map(colorOpt)), data: { a: COLORS[a], b: COLORS[b], aName: a, bName: b }, watchMs: 3000 };
    },
  },
  {
    id: 'illusion', title: 'Eye Tricks', emoji: '\u{1F635}\u200D\u{1F4AB}', kind: 'choice',
    prompt: '',
    create(rng) {
      const type = pick(rng, ['lines', 'circles']);
      // Half the time they're all exactly the same size, which is the trick!
      const bigger = rng() < 0.5 ? -1 : int(rng, 0, 2);
      const styles = shuffle(rng, ['big', 'small', 'plain']); // what surrounds each item
      const noun = type === 'lines' ? 'Line' : 'Circle';
      return {
        answer: bigger === -1 ? 3 : bigger,
        options: [{ label: `${noun} A` }, { label: `${noun} B` }, { label: `${noun} C` }, { label: 'They\u2019re all the same', emoji: '\u{1F7F0}' }],
        prompt: type === 'lines' ? 'Which line is the LONGEST?' : 'Which ORANGE circle is the BIGGEST?',
        data: { type, bigger, styles },
        watchMs: 0,
      };
    },
  },
  {
    id: 'clock', title: 'Quick Clock', emoji: '\u{1F570}️', kind: 'choice',
    prompt: 'What time did the clock show?',
    create(rng) {
      const h = int(rng, 1, 12);
      const m = int(rng, 0, 11) * 5;
      const fmt = (hh, mm) => `${hh}:${String(mm).padStart(2, '0')}`;
      const wrap = (hh) => ((hh + 11) % 12) + 1;
      const cands = [fmt(m === 0 ? 12 : m / 5, (h * 5) % 60), fmt(wrap(h + 1), m), fmt(wrap(h - 1), m), fmt(h, (m + 10) % 60), fmt(h, (m + 50) % 60), fmt(wrap(h + 6), m)];
      const correct = fmt(h, m);
      const others = [...new Set(cands.filter((c) => c !== correct))].slice(0, 3);
      const c = choice(rng, { label: correct }, sample(rng, others, 3).map((label) => ({ label })));
      return { ...c, data: { h, m, showMs: 3500 }, watchMs: 4500 };
    },
  },
  {
    id: 'pattern', title: 'What Comes Next?', emoji: '\u{1F501}', kind: 'choice',
    prompt: 'What comes next in the pattern?',
    create(rng) {
      const kinds = [
        () => { const [a, b] = sample(rng, ['\u{1F534}', '\u{1F535}', '\u{1F7E2}', '\u{1F7E1}', '\u{1F7E3}'], 2); return { seq: [a, b, a, b, a, b, a], next: b, pool: ['\u{1F534}', '\u{1F535}', '\u{1F7E2}', '\u{1F7E1}', '\u{1F7E3}'] }; },
        () => { const [a, b, c] = sample(rng, ['\u{1F34E}', '\u{1F34C}', '\u{1F347}', '\u{1F352}', '\u{1F34B}'], 3); return { seq: [a, b, c, a, b, c, a, b], next: c, pool: ['\u{1F34E}', '\u{1F34C}', '\u{1F347}', '\u{1F352}', '\u{1F34B}'] }; },
        () => { const [a, b] = sample(rng, ['\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F430}'], 2); return { seq: [a, a, b, a, a, b, a, a], next: b, pool: ['\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F430}'] }; },
        () => { const s = int(rng, 1, 9); const k = int(rng, 2, 6); const seq = [0, 1, 2, 3, 4].map((i) => String(s + i * k)); const n = s + 5 * k; return { seq, next: String(n), pool: [n - 1, n + 1, n + k, n - k, n + 2].map(String) }; },
        () => { const s = pick(rng, [1, 2, 3]); const seq = [0, 1, 2, 3, 4].map((i) => String(s * 2 ** i)); const n = s * 32; return { seq, next: String(n), pool: [n - s * 8, n + s * 8, n + 2, n / 2 + s * 4].map(String) }; },
        () => ({ seq: ['⬆️', '➡️', '⬇️', '⬅️', '⬆️', '➡️'], next: '⬇️', pool: ['⬆️', '➡️', '⬅️', '↖️'] }),
        () => ({ seq: ['\u{1F311}', '\u{1F312}', '\u{1F313}', '\u{1F314}'], next: '\u{1F315}', pool: ['\u{1F311}', '\u{1F313}', '\u{1F316}', '\u{1F318}'] }),
        () => ({ seq: ['\u{1F550}', '\u{1F552}', '\u{1F554}', '\u{1F556}'], next: '\u{1F558}', pool: ['\u{1F557}', '\u{1F559}', '\u{1F55B}', '\u{1F551}'] }),
      ];
      const p = pick(rng, kinds)();
      const others = sample(rng, [...new Set(p.pool.filter((x) => x !== p.next))], 3);
      const opt = (x) => (/^\d+$/.test(x) ? { label: x } : { label: '', emoji: x });
      return { ...choice(rng, opt(p.next), others.map(opt)), data: { seq: p.seq, stepMs: 550 }, watchMs: p.seq.length * 550 + 500 };
    },
  },
  {
    id: 'whomoved', title: 'Who Moved?', emoji: '\u{1F3AD}', kind: 'choice',
    prompt: 'Two animals swapped places. Which two?',
    create(rng) {
      const animals = sample(rng, ['\u{1F436}', '\u{1F431}', '\u{1F98A}', '\u{1F43C}', '\u{1F438}', '\u{1F437}', '\u{1F981}', '\u{1F42E}', '\u{1F430}', '\u{1F428}'], 6);
      const [i, j] = sample(rng, [0, 1, 2, 3, 4, 5], 2);
      const after = [...animals];
      [after[i], after[j]] = [after[j], after[i]];
      const pairLabel = (a, b) => ({ label: '', emoji: `${animals[a]} & ${animals[b]}` });
      const wrong = [];
      while (wrong.length < 3) {
        const [a, b] = sample(rng, [0, 1, 2, 3, 4, 5], 2).sort();
        const key = `${a}-${b}`;
        if (key !== [i, j].sort().join('-') && !wrong.some((w) => w.key === key)) wrong.push({ key, a, b });
      }
      return { ...choice(rng, pairLabel(i, j), wrong.map((w) => pairLabel(w.a, w.b))), data: { animals, after, showMs: 4500, curtainMs: 1500 }, watchMs: 6500 };
    },
  },
  {
    id: 'rebus', title: 'Emoji Mash-Up', emoji: '➕', kind: 'choice',
    prompt: 'Put the pictures together. What word do they make?',
    create(rng) {
      const list = [['⭐', '\u{1F41F}', 'Starfish'], ['☀️', '\u{1F33C}', 'Sunflower'], ['\u{1F9C8}', '\u{1FAB0}', 'Butterfly'], ['❄️', '\u{1F468}', 'Snowman'], ['\u{1F327}️', '\u{1F9E5}', 'Raincoat'], ['\u{1F40E}', '\u{1F45E}', 'Horseshoe'], ['\u{1F4A7}', '\u{1F348}', 'Watermelon'], ['\u{1F431}', '\u{1F41F}', 'Catfish'], ['\u{1F436}', '\u{1F3E0}', 'Doghouse'], ['\u{1F9B6}', '⚽', 'Football'], ['☀️', '\u{1F453}', 'Sunglasses'], ['\u{1F33D}', '\u{1F436}', 'Corn dog'], ['☕', '\u{1F382}', 'Cupcake'], ['\u{1F319}', '\u{1F4A1}', 'Moonlight'], ['\u{1F525}', '\u{1FAB0}', 'Firefly'], ['\u{1F36F}', '\u{1F41D}', 'Honeybee'], ['\u{1F95C}', '\u{1F9C8}', 'Peanut butter']];
      const [correct, ...others] = sample(rng, list, 4);
      return { ...choice(rng, { label: correct[2] }, others.map((o) => ({ label: o[2] }))), data: { a: correct[0], b: correct[1] }, watchMs: 2000 };
    },
  },
  {
    id: 'rainbow', title: 'Broken Rainbow', emoji: '\u{1F308}', kind: 'choice',
    prompt: 'Which color is missing from the rainbow?',
    create(rng) {
      const bands = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'];
      const missing = int(rng, 0, 5);
      const others = sample(rng, bands.filter((_, i) => i !== missing), 3);
      return { ...choice(rng, colorOpt(bands[missing]), others.map(colorOpt)), data: { bands: bands.map((b) => COLORS[b]), missing }, watchMs: 2500 };
    },
  },
  {
    id: 'towers', title: 'Tower Race', emoji: '\u{1F9F1}', kind: 'choice',
    prompt: 'Which tower ended up the TALLEST?',
    create(rng) {
      const names = [['Red', 'A'], ['Blue', 'B'], ['Green', 'C'], ['Yellow', 'D']];
      const winner = int(rng, 0, 3);
      const top = int(rng, 9, 13);
      const heights = names.map((_, i) => (i === winner ? top : top - int(rng, 1, 3)));
      const drops = shuffle(rng, heights.flatMap((h, i) => Array(h).fill(i)));
      const stepMs = Math.round(7000 / drops.length);
      return {
        answer: winner,
        options: names.map(([c]) => colorOpt(c)),
        data: { colors: names.map(([c]) => COLORS[c]), drops, stepMs, holdMs: 700 },
        watchMs: 600 + drops.length * stepMs + 700 + 500,
      };
    },
  },
];

// Photo Finish options are emoji + name pairs; normalise into {label, emoji}.
for (const q of QUESTIONS) {
  const orig = q.create;
  q.create = (rng) => {
    const r = orig(rng);
    if (r.options) r.options = r.options.map((o) => (Array.isArray(o) ? { emoji: o[0], label: o[1] } : o));
    return r;
  };
}

// Turn a number answer into 4 choices: the right one plus 3 close calls,
// spaced about 6% of the answer apart. Where the right answer sits (lowest,
// highest, or in between) is random, so "pick the middle one" doesn't work.
function numberChoices(answer, rng) {
  const step = Math.max(1, Math.round(answer * 0.06));
  const roomBelow = Math.floor(answer / step);
  const below = Math.min(int(rng, 0, 3), roomBelow, 3);
  const values = [
    ...sample(rng, [1, 2, 3, 4].filter((k) => k <= roomBelow), below).map((k) => answer - k * step),
    answer,
    ...sample(rng, [1, 2, 3, 4], 3 - below).map((k) => answer + k * step),
  ].sort((a, b) => a - b);
  return { options: values.map((v) => ({ label: v.toLocaleString('en-US') })), answer: values.indexOf(answer) };
}

const BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

// Pick n question ids at random, avoiding ones in `avoid` when possible.
function pickQuestions(n, rng = Math.random, avoid = new Set()) {
  const fresh = shuffle(rng, QUESTIONS.map((q) => q.id).filter((id) => !avoid.has(id)));
  const stale = shuffle(rng, QUESTIONS.map((q) => q.id).filter((id) => avoid.has(id)));
  return [...fresh, ...stale].slice(0, n);
}

module.exports = { QUESTIONS, BY_ID, COLORS, pickQuestions, shuffle, numberChoices };
