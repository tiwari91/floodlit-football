// Run: node tests/challenge.mjs   (the Challenge Cup: 18m-challenge-cup.js)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8821), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });

// Before a ball is kicked: the card is on the Cups tab with the first night and who enters.
const before = await page.evaluate(() => {
	const F = window.__ff, t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Cups/i.test(x.textContent.trim())); t.click();
	const card = document.querySelector(".lg-chall");
	return { card: card ? card.textContent : "", teams: F.TEAMS.length };
});
check("the Challenge Cup has its card on the Cups tab, with the third round's night and who enters", /Challenge Cup/.test(before.card) && /third round, drawn after matchday 8/.test(before.card) && /\d+ clubs, \d+ of them from below the division/.test(before.card), before.card.slice(0, 200));

// A whole season simulated: five rounds down to one winner; every club of the division and every one below it (up to twelve) enters.
const s = await page.evaluate(() => {
	const F = window.__ff; F.simSeasonAllTest();
	const L = F.league, c = L.chall;
	const all = c.rounds.flatMap(r => r.ties), entrants = new Set(c.rounds[0].ties.flatMap(t => [ t.h, t.a ]));
	return {
		rounds: c.rounds.map(r => [ r.name, r.ties.length ]), entrants: entrants.size + (c.rounds[0].byes || []).length, below: c.below.length,
		belowAll: Math.min(12, F.TEAMS.length - L.members.length),   // members includes you (id 0)
		belowDomestic: c.below.every(i => i > 0 && i < F.TEAMS.length && !L.members.includes(i)),
		winner: c.winner,
		replays: all.filter(t => t.replay).length, replayLate: c.rounds.filter(r => r.k >= 2).some(r => r.ties.some(t => t.replay)),
		card: document.querySelector(".lg-chall") ? document.querySelector(".lg-chall").textContent : ""
	};
});
check("five rounds: the third cuts the field to sixteen, then 8, 4, 2 and 1 ties", s.rounds.length === 5 && JSON.stringify(s.rounds.slice(1).map(r => r[1])) === "[8,4,2,1]" && s.rounds[0][1] === s.entrants - 16, JSON.stringify(s.rounds));
check("every club of the division enters, with the domestic clubs from below it", s.entrants === 20 + s.below && s.below === s.belowAll && s.below > 0 && s.belowDomestic, JSON.stringify(s));
check("there is a winner at the end of the season", Number.isInteger(s.winner) && s.winner >= 0, JSON.stringify(s.winner));
check("replays only in the first two rounds", !s.replayLate, JSON.stringify(s));

// Many cups (the draw only, from the cup code): replays happen, and so do giant-killings.
const many = await page.evaluate(() => {
	const F = window.__ff; let replays = 0, shocks = 0;
	for (let i = 0; i < 6; i++) { F.nextSeasonTest(); F.simSeasonAllTest(); const c = F.league.chall; const all = c.rounds.flatMap(r => r.ties); replays += all.filter(t => t.replay).length; shocks += all.filter(t => c.below.includes(t.win) && !c.below.includes(t.win === t.h ? t.a : t.h)).length; }
	return { replays, shocks, season: F.league.season };
});
check("over six seasons there are replays and giant-killings", many.replays > 0 && many.shocks > 0, JSON.stringify(many));

check("Challenge Cup: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
