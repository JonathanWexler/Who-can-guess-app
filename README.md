# Who Can Guess?

A party game of quick **mini guessing games**. Everyone plays every round on their own phone,
the closest guess scores the most, and the best guesser each round **earns the ⚡ EDGE**:
a slight advantage in the next round.

## How it plays

1. Open **`/host`** on a TV or laptop everyone can see. It shows a 4-letter room code.
2. Everyone opens **`/play`** on their phone and joins with the code and a name.
3. The host picks the number of rounds and hits **Start**.
4. Each round is a random mini-game. Everyone guesses at the same time on their phone.
5. The TV reveals the answer, everyone's guesses and the points, then shows who earned the EDGE.

### Mini-games

| Game | What you do | What the ⚡ EDGE gives you |
| --- | --- | --- |
| 🔴 Dot Flash | Count dots flashed on screen | 3s look instead of 1.5s |
| 📊 Fill Level | Guess how full a bar was | Longer look at the bar |
| 📐 Angle Eye | Guess the angle of a flashed line | Longer look, plus tick marks |
| ⏱️ Blind Stopwatch | Stop a clock at a target time after it goes blank | Clock stays visible longer |
| 💡 Blink Count | Count a fast-blinking light | Slower blinks |
| 🔢 Mystery Number | Guess 1–100 from a clue | A second, sharper clue |
| 🎯 Ballpark | Estimate a trivia answer | A hint range containing the answer |

### Scoring

- Up to **1,000 pts** for closeness (scaled to each game's tolerance).
- **+250** for the closest guess of the round (it has to be within range).
- **+250** more for a bull's-eye.

### The EDGE

- After each round, the best finisher earns the EDGE for the next round
  (1 player with 3–5 players, 2 players with 6+; ties at the cutoff all earn it).
- If you **used** the EDGE this round you can't earn it again right away. It goes to the
  best player who played without it, so it keeps moving around the room.
- Head-to-head (2-player) games have no EDGE.

## Running it

```bash
npm install
npm start          # http://localhost:3000
npm test
```

Players need to reach the host machine. On a home network, use the host computer's LAN IP
(e.g. `http://192.168.1.20:3000/play`). Set `PORT` to change the port.

## Project layout

```
src/server.js      Express + Socket.IO server, room codes, socket events
src/room.js        Room state machine: lobby → intro → playing → reveal → final
src/minigames.js   The mini-games: each one builds an answer, a normal view and an EDGE view
src/scoring.js     Points and EDGE-earning rules
public/            Landing page, host (TV) screen, player (phone) screen
test/              node:test unit tests
```

### Adding a mini-game

Add an entry to `MINIGAMES` in `src/minigames.js` with a `create(rng)` that returns
`{ answer, tolerance, stimulus, edgeStimulus }`. If it needs a new kind of visual, render it
in `runPeek()` in `public/play.js`.
