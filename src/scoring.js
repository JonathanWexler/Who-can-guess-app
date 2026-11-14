// Scoring rules.
//
// Questions: one guess each, exactly right = QUESTION_POINTS, wrong = 0.
// Act-offs: everyone who isn't acting votes. The winner gets ACT_WIN_POINTS,
// the other actor gets ACT_BRAVE_POINTS for getting up there. A tie splits it.
//
// The EDGE (earned by winning an act-off, lasts for the next set of questions):
// one wrong answer is crossed out on your phone, so you pick from 3 instead of 4.

const QUESTION_POINTS = 1000;
const ACT_WIN_POINTS = 1500;
const ACT_BRAVE_POINTS = 500;
const ACT_TIE_POINTS = 1000;
const EDGE_WIGGLE = 1;

function isCorrect({ kind, answer }, guess, hasEdge = false) {
  if (typeof guess !== 'number' || !Number.isFinite(guess)) return false;
  if (kind === 'choice') return guess === answer;
  return guess === answer || (hasEdge && Math.abs(guess - answer) <= EDGE_WIGGLE);
}

/**
 * @param {string[]} actors two player ids
 * @param {Map<string,string>|Object} votes voterId -> actorId
 * @returns {{tally: Record<string, number>, winners: string[], points: Record<string, number>}}
 */
function scoreActOff(actors, votes) {
  const tally = Object.fromEntries(actors.map((id) => [id, 0]));
  for (const choice of votes instanceof Map ? votes.values() : Object.values(votes)) {
    if (choice in tally) tally[choice] += 1;
  }
  return scoreTally(actors, tally);
}

/**
 * 2-player act-offs: each actor rates the OTHER one 1–5 stars.
 * @param {string[]} actors
 * @param {Map<string,number>} ratings raterId -> stars given to the other actor
 */
function scoreRatings(actors, ratings) {
  const [a, b] = actors;
  return scoreTally(actors, { [a]: ratings.get(b) || 0, [b]: ratings.get(a) || 0 });
}

function scoreTally(actors, tally) {
  const [a, b] = actors;
  let winners;
  if (tally[a] === tally[b]) winners = [a, b];
  else winners = [tally[a] > tally[b] ? a : b];
  const points = {};
  for (const id of actors) {
    points[id] = winners.length === 2 ? ACT_TIE_POINTS : winners.includes(id) ? ACT_WIN_POINTS : ACT_BRAVE_POINTS;
  }
  return { tally, winners, points };
}

module.exports = { isCorrect, scoreActOff, scoreRatings, QUESTION_POINTS, ACT_WIN_POINTS, ACT_BRAVE_POINTS, ACT_TIE_POINTS, EDGE_WIGGLE };
