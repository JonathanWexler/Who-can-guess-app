# Who Can Guess?

A party game for kids (7–15) and grown-ups. A big screen plays quick animated
**picture questions**: count the balloons before they pop, count the blinks, spot the
pink snowflakes. Everyone taps **one of 4 answers** on their phone. Every few questions, two
random players get up for an **act-off**, and everyone else votes for who did it better.

## How a game goes

1. Open **https://whocanguess.pages.dev** on a TV or laptop. That's it: a room is created and
   its **QR code** shows up right away.
2. Everyone scans the QR code with their phone and types their name. The TV shows each name
   as people join.
3. **The first person to scan is the host 👑.** They play like everyone else, and their phone also
   has the host controls: pick 3 or 4 questions between act-offs and 2–5 rounds, then **Start**.
   They also tap **Next**, **Done acting** and **Play again** during the game. If the host's phone
   is gone for 30 seconds, the crown passes to the next player.
4. **Picture question:** the big screen shows a title card, then the animation. Phones show
   the question with **4 answer buttons**. There's a 20-second answer window after the
   animation, and you get **one tap** (no take-backs).
   - The big screen only shows **who has answered**, never who was right.
   - Each phone privately shows ✅ or ❌ and the correct answer.
5. **Act-off** (after every 3–4 questions): two random players come up and act out the same
   silly prompt ("A penguin who is late for school"). There's **no time limit**. The host taps
   *Done acting*, and everyone else votes on their phone. The host can reroll the actors or
   the prompt.
6. Scores are revealed after each act-off, then the next round starts.

### 😈 Sabotage

Every player gets **2 sabotages per round** (between act-offs) to use during questions:

- Tap **😈 Sabotage someone** on your phone and pick a player who hasn't answered yet.
- An evil smiley bounces over their answer buttons until they **tap it 3 times** (it jumps
  after every tap). It clears itself after 10 seconds so nobody is locked out completely.
- The TV shows "😈 Leo sabotaged Maya!". Each player can only be hit once per question,
  and you can't sabotage yourself. You can use both on one question (on two different
  people) or spread them out. Unused sabotages don't carry over.

### Points

| | |
|---|---|
| Right answer | 1,000 |
| Win an act-off | 1,500 |
| Lose an act-off (for being brave) | 500 |
| Tied act-off | 1,000 each |

### ⚡ The EDGE

Winning an act-off earns a slight advantage for the **next round of questions**: on every
question, **one wrong answer is crossed out** on your phone, so you pick from 3 instead of 4.

## The 50 picture questions

All visuals are drawn live with CSS, SVG and emoji. No photos are downloaded, so there's
nothing to license, it works offline, and every question is randomized each time it's played.

Every question has **4 answers**. For the counting questions, the 3 wrong answers are close
calls about 6% apart (57 balloons → 51 / 54 / **57** / 63), and the right answer is equally
likely to be in any position.

**How many? (37):** Balloon Pop (they pop while you think!), Blink-Off, Counting
Sheep (goats don't count), Candy Jar, Super Bouncy Ball, Fish Tank, Fireworks Show, Shooting
Stars, Duck Parade, Popcorn Party, Hoppy Frog, Cookie Monster Munch, Pink Snow, Apple
Picker, Ladybug Spots, Domino Topple, Choo-Choo Count, Elevator Ride, The Bus Stop, Tally
Flash, Treasure Chest, Dice Roll, Cup Pyramid, Pop-Up Hamsters, UFO Farm Visit, Ant Picnic,
Lights Out, Tricky Colors, Traffic Light Chaos, Spot the Difference, Balance Scale, Number
Rain, Dino Pizza Party, Countdown Glitch, Odd One Out, Card Memory, Shape Storm.

**Which one? (13):** Shell Game, Photo Finish, Mystery Shadow, Super Zoom, What's
Missing?, Paint Mixer, Eye Tricks (optical illusions), Quick Clock, What Comes Next?, Who
Moved?, Emoji Mash-Up, Broken Rainbow, Tower Race.

There are also **60 act-off prompts** in `src/actprompts.js`.

## Running it

**Live:** https://whocanguess.pages.dev (open it on the TV and scan the QR code)
Also at https://guess.jwexman.workers.dev — both addresses share the same game and rooms.

It runs on Cloudflare Workers, with one Durable Object per room holding the game state.

```bash
npm install
npm start        # local copy at http://localhost:8787 (wrangler dev)
npm test
npm run deploy        # publish the game Worker ("guess")
npm run deploy:pages  # publish the whocanguess.pages.dev front (pages/_worker.js)
```

To publish under a different name, change `"name"` in `wrangler.jsonc`.

## Project layout

```
worker/index.js     Cloudflare Worker: pages, room codes, QR codes, GameRoom Durable Object
public/socket.js    Small WebSocket client used by the TV and phone pages
scripts/bundle-pages.js  Packs public/ into the Worker at build time
pages/_worker.js    whocanguess.pages.dev: forwards everything to the "guess" Worker
src/room.js         Game flow: lobby → question → answer → … → act-off → vote → results → final
src/questions.js    The 50 questions: each makes a random answer + data for the animation
src/actprompts.js   Act-off prompts
src/scoring.js      Right/wrong checking, act-off scoring, EDGE rules
public/host.js      Big-screen UI
public/scenes.js    The 50 big-screen animations
public/play.js      Phone UI (answer buttons, voting, host controls)
test/               node:test tests
```

### Adding a question

1. Add an entry to `QUESTIONS` in `src/questions.js` with `create(rng)` returning
   `{ answer, data, watchMs }` (plus `options` for multiple choice).
2. Add an animation with the same id to `SCENES` in `public/scenes.js`.
   `npm test` checks that every question has one.
