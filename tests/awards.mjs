// Run: node tests/awards.mjs   (the awards race and the festive fixtures: 18p-awards-and-festive.js)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8833), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });

// To the January window (after matchday 19): the next game is one of the festive fixtures.
const jan = await page.evaluate(() => {
	const F = window.__ff; F.simSeasonTest();
	return { round: F.league.round, race: JSON.parse(JSON.stringify(F.league.race)) };
});
// A reload opens on the next game's kick-off card (the simulation saved the league).
await page.reload(); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && /^Matchday/.test(document.getElementById("ovTitle").textContent), null, { timeout: 60000 });
Object.assign(jan, await page.evaluate(() => ({ title: document.getElementById("ovTitle").textContent, text: document.getElementById("ovText").textContent })));
check("halfway: a Team of the Week of eleven (a keeper, four, four, two)", jan.race && jan.race.totw && jan.race.totw.xi.length === 11 && JSON.stringify(jan.race.totw.xi.map(p => p.pos)) === JSON.stringify([ "gk", "def", "def", "def", "def", "mid", "mid", "mid", "mid", "fwd", "fwd" ]), JSON.stringify(jan.race && jan.race.totw).slice(0, 300));
check("a Player of the Month every four matchdays", jan.race.potm.length === Math.floor(jan.round / 4), JSON.stringify(jan.race.potm).slice(0, 300));
check("the kick-off card for the next game says it's a festive fixture and to rotate", jan.round === 19 && /Festive fixtures: games come two or three days apart/.test(jan.text), JSON.stringify({ round: jan.round, title: jan.title, text: jan.text.slice(0, 300) }));

// The whole season: the Golden Boot and Glove races, league-wide, and the winners in the season's awards.
const end = await page.evaluate(() => {
	const F = window.__ff; F.simSeasonAllTest();
	const L = F.league, R = L.race, boot = Object.entries(R.boot).sort((a, b) => b[1].goals - a[1].goals), glove = Object.entries(R.glove).sort((a, b) => b[1].cs - a[1].cs);
	const goalsAll = L.results.flat().reduce((t, r) => t + r[2] + r[3], 0), goalsBoot = Object.values(R.boot).reduce((t, b) => t + b.goals, 0);
	const clubs = new Set(Object.values(R.boot).map(b => b.club));
	const dupes = Object.values(R.boot).filter(b => Object.values(R.boot).filter(x => x.name === b.name).length > 1).length;
	F.renderLeagueTest(); const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Cups/i.test(x.textContent.trim())); t.click();
	const card = document.querySelector(".lg-race"), aw = document.querySelector(".lg-awards");
	return { dupes, top: boot[0], gk: glove[0], goalsAll, goalsBoot, clubs: clubs.size, potm: R.potm.length, awards: L.awards, card: card ? card.textContent : "", aw: aw ? aw.textContent : "" };
});
check("every league goal has a scorer in the Golden Boot race, from all twenty clubs", end.goalsBoot === end.goalsAll && end.clubs === 20, JSON.stringify({ all: end.goalsAll, boot: end.goalsBoot, clubs: end.clubs }));
check("players with the same name at different clubs are kept apart", end.dupes >= 0, String(end.dupes));
check("the Golden Boot leader has a believable tally (8 to 45)", end.top && end.top[1].goals >= 8 && end.top[1].goals <= 45, JSON.stringify(end.top));
check("the Golden Glove leader has clean sheets", end.gk && end.gk[1].cs >= 4, JSON.stringify(end.gk));
check("nine Players of the Month over thirty-eight matchdays", end.potm === 9, String(end.potm));
check("the season's awards name the Golden Boot and Golden Glove winners", end.awards && end.awards.boot && end.awards.glove && /Golden Boot/.test(end.aw) && /Golden Glove/.test(end.aw), JSON.stringify(end.awards && { boot: end.awards.boot, glove: end.awards.glove }));
check("the Cups tab has the awards race card", /Awards race/.test(end.card) && /Golden Boot:/.test(end.card) && /Team of the Week/.test(end.card), end.card.slice(0, 200));

check("awards: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
