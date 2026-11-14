// Scoring and EDGE rules.
//
// Points: up to 1000 for closeness (linear, 0 once you're `tolerance` away),
// plus a +250 bonus for the closest guess(es) of the round (if they were
// within tolerance at all), plus +250 more
// for a bull's-eye (exact answer).
//
// The EDGE: after every round, the best finisher(s) earn the EDGE for the next
// round — a slight advantage in whatever mini-game comes up. To stop a runaway
// leader, a player who *used* the EDGE this round can't earn it again
// immediately; it goes to the best finisher(s) who played without it.

const MAX_POINTS = 1000;
const WINNER_BONUS = 250;
const EXACT_BONUS = 250;

function closenessPoints(error, tolerance) {
  if (!Number.isFinite(error)) return 0;
  return Math.round(MAX_POINTS * Math.max(0, 1 - error / tolerance));
}

// How many players earn the EDGE each round.
function edgeSlots(playerCount) {
  if (playerCount <= 2) return 0; // head-to-head: no edge, it'd be too swingy
  if (playerCount <= 5) return 1;
  return 2;
}

// Avoid floating point noise on things like 6.1 - 6.0.
const roundError = (n) => Math.round(n * 1000) / 1000;

/**
 * @param {object} args
 * @param {number} args.answer
 * @param {number} args.tolerance
 * @param {Array<{id:string, guess:number|null, hadEdge:boolean}>} args.entries
 * @returns {{results: Array, edgeEarners: string[]}}
 */
function scoreRound({ answer, tolerance, entries }) {
  const results = entries.map((e) => {
    const guessed = typeof e.guess === 'number' && Number.isFinite(e.guess);
    const error = guessed ? roundError(Math.abs(e.guess - answer)) : Infinity;
    return { id: e.id, guess: guessed ? e.guess : null, error, hadEdge: !!e.hadEdge, points: closenessPoints(error, tolerance), winner: false, exact: false };
  });

  // Only guesses that were actually in the ballpark can win the round.
  const guessedResults = results.filter((r) => r.guess !== null && r.error < tolerance);
  if (guessedResults.length) {
    const best = Math.min(...guessedResults.map((r) => r.error));
    for (const r of guessedResults) {
      if (r.error === best) {
        r.winner = true;
        r.points += WINNER_BONUS;
      }
      if (r.error === 0) {
        r.exact = true;
        r.points += EXACT_BONUS;
      }
    }
  }

  // Sort: closest first, non-guessers last; stable by original order on ties.
  results.sort((a, b) => a.error - b.error);

  const slots = edgeSlots(entries.length);
  const eligible = results.filter((r) => r.guess !== null && !r.hadEdge && r.error < tolerance);
  const edgeEarners = [];
  if (slots > 0 && eligible.length) {
    // Take the top `slots` eligible players, but include anyone tied with the last slot.
    const cutoff = eligible[Math.min(slots, eligible.length) - 1].error;
    for (const r of eligible) if (r.error <= cutoff) edgeEarners.push(r.id);
  }

  return { results, edgeEarners };
}

module.exports = { scoreRound, closenessPoints, edgeSlots, MAX_POINTS, WINNER_BONUS, EXACT_BONUS };
