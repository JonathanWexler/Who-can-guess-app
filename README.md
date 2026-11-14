# Who Can Guess?

A party game for kids (7–15) and grown-ups. A big screen plays quick animated
**picture questions**: count the balloons before they pop, count the blinks, spot the
pink snowflakes. Everyone gets **one guess** on their phone. Every few questions, two
random players get up for an **act-off**, and everyone else votes for who did it better.

## How a game goes

1. Open **`/host`** on a TV or laptop. It shows a **QR code** and a 4-letter room code.
2. Everyone scans the QR code (or opens `/play`) on their phone and types their name.
3. The host picks **3 or 4 questions between act-offs** and **2–5 rounds**, then hits Start.
4. **Picture question:** the big screen shows a title card, then the animation. Phones show
   the question and a number keypad or answer buttons. There's a 20-second answer window
   after the animation, and you get **one locked-in guess**.
   - The big screen only shows **who has answered**, never who was right.
   - Each phone privately shows ✅ or ❌ and the correct answer.
5. **Act-off** (after every 3–4 questions): two random players come up and act out the same
   silly prompt ("A penguin who is late for school"). There's **no time limit**. The host taps
   *Done acting*, and everyone else votes on their phone. The host can reroll the actors or
   the prompt.
6. Scores are revealed after each act-off, then the next round starts.

### Points

| | |
|---|---|
| Right answer (exact) | 1,000 |
| Win an act-off | 1,500 |
| Lose an act-off (for being brave) | 500 |
| Tied act-off | 1,000 each |

### ⚡ The EDGE

Winning an act-off earns a slight advantage for the **next round of questions**:

- On number questions, being **off by one still counts** as right.
- On multiple-choice questions, **one wrong answer is crossed out** on your phone.

## The 50 picture questions

All visuals are drawn live with CSS, SVG and emoji. No photos are downloaded, so there's
nothing to license, it works offline, and every question is randomized each time it's played.

**Counting & tracking (37):** Balloon Pop (they pop while you think!), Blink-Off, Counting
Sheep (goats don't count), Candy Jar, Super Bouncy Ball, Fish Tank, Fireworks Show, Shooting
Stars, Duck Parade, Popcorn Party, Hoppy Frog, Cookie Monster Munch, Pink Snow, Apple
Picker, Ladybug Spots, Domino Topple, Choo-Choo Count, Elevator Ride, The Bus Stop, Tally
Flash, Treasure Chest, Dice Roll, Cup Pyramid, Pop-Up Hamsters, UFO Farm Visit, Ant Picnic,
Lights Out, Tricky Colors, Traffic Light Chaos, Spot the Difference, Balance Scale, Number
Rain, Dino Pizza Party, Countdown Glitch, Odd One Out, Card Memory, Shape Storm.

**Multiple choice (13):** Shell Game, Photo Finish, Mystery Shadow, Super Zoom, What's
Missing?, Paint Mixer, Eye Tricks (optical illusions), Quick Clock, What Comes Next?, Who
Moved?, Emoji Mash-Up, Broken Rainbow, Tower Race.

There are also **60 act-off prompts** in `src/actprompts.js`.

## Running it

**Live:** https://guess.jwexman.workers.dev (open `/host` on the TV and scan the QR code)

It runs on Cloudflare Workers, with one Durable Object per room holding the game state.

```bash
npm install
npm start        # local copy at http://localhost:8787 (wrangler dev)
npm test
npm run deploy   # publish to Cloudflare (needs a Workers API token)
```

To publish under a different name, change `"name"` in `wrangler.jsonc`.

## Project layout

```
worker/index.js     Cloudflare Worker: pages, room codes, QR codes, GameRoom Durable Object
public/socket.js    Small WebSocket client used by the TV and phone pages
scripts/bundle-pages.js  Packs public/ into the Worker at build time
src/room.js         Game flow: lobby → question → answer → … → act-off → vote → results → final
src/questions.js    The 50 questions: each makes a random answer + data for the animation
src/actprompts.js   Act-off prompts
src/scoring.js      Right/wrong checking, act-off scoring, EDGE rules
public/host.js      Big-screen UI
public/scenes.js    The 50 big-screen animations
public/play.js      Phone UI (keypad, choices, voting)
test/               node:test tests
```

### Adding a question

1. Add an entry to `QUESTIONS` in `src/questions.js` with `create(rng)` returning
   `{ answer, data, watchMs }` (plus `options` for multiple choice).
2. Add an animation with the same id to `SCENES` in `public/scenes.js`.
   `npm test` checks that every question has one.
