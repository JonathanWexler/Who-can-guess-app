// Cloudflare Pages front door for whocanguess.pages.dev.
// Everything (pages, room codes, QR codes, WebSockets) is handled by the
// "guess" Worker, reached through the GAME service binding, so both
// addresses share the same game and rooms.
export default {
  fetch(request, env) {
    return env.GAME.fetch(request);
  },
};
