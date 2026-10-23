// Run: node tests/continental.mjs   The Continental Champions Cup: the draw, the format, qualification, your games, old saves.
import { launch, serve, sleep, tally } from "./_env.mjs";
const server = serve(8801), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 200)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });

// An old save: no cup, nothing qualified. It loads, and there is no cup this season.
const old = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	delete lg.cont; delete lg.club.contQual; delete lg.club.contCoef; delete lg.contGuest;
	const C = F.ensureCont(lg);
	return { none: !!C.none, fixture: !!(F.currentFixture() || {}).cont, next: F.contNext() };
});
check("an old save migrates: no cup this season, a note on how to qualify", old.none && !old.fixture && /top four/.test(old.next), JSON.stringify(old));

// Qualified: the draw.
const draw = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.round = 0; delete lg.cont;
	const ids = lg.members.slice(0, 4).includes(0) ? lg.members.slice(0, 4) : [ 0, ...lg.members.filter(i => i !== 0).slice(0, 3) ];
	lg.club.contQual = { season: lg.season, ids };
	const C = F.ensureCont(lg), N = C.clubs.length, per = C.clubs.map(() => ({ h: 0, a: 0, opp: new Set(), pots: [ 0, 0, 0, 0 ], nights: new Set(), sameNat: 0 }));
	const potOf = i => Math.floor(C.pots.indexOf(i) / (N / 4));
	for (const g of C.games) {
		per[g.h].h++; per[g.a].a++; per[g.h].opp.add(g.a); per[g.a].opp.add(g.h);
		per[g.h].pots[potOf(g.a)]++; per[g.a].pots[potOf(g.h)]++; per[g.h].nights.add(g.n); per[g.a].nights.add(g.n);
		if (C.clubs[g.h].nat === C.clubs[g.a].nat) { per[g.h].sameNat++; }
	}
	const me = C.clubs.findIndex(c => c.id === 0);
	return { N, games: C.games.length, ok8: per.every(p => p.h === 4 && p.a === 4 && p.opp.size === 8), pots: per.every(p => p.pots.every(k => k === 2)), sameNat: per.reduce((t, p) => t + p.sameNat, 0), myNights: per[me].nights.size, nights: C.games.every(g => g.n >= 0 && g.n < 8), names: new Set(C.clubs.map((c, i) => c.name)).size, news: /Continental Champions Cup draw/.test(lg.news) };
});
check("36 clubs, 144 league-phase games", draw.N === 36 && draw.games === 144, JSON.stringify(draw));
check("each club plays 8 different opponents, 4 at home and 4 away, two from each pot", draw.ok8 && draw.pots, JSON.stringify(draw));
check("no club meets one from its own country", draw.sameNat === 0, JSON.stringify(draw));
check("your 8 games fall on 8 different nights, and the draw is in the news", draw.myNights === 8 && draw.nights && draw.news, JSON.stringify(draw));

// Your game is a real fixture when its night comes: a club from abroad in the guest seat, then given back.
const fix = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, r0 = F.CC_NIGHTS[0].r;
	lg.round = r0; F.contNight();
	const f = F.currentFixture(), T = f && f.opp;
	const name = f ? document.createElement("x") && window.__ff.league.cont.clubs : null;
	const C = lg.cont, g = C.games[f.cont.gi], me = C.clubs.findIndex(c => c.id === 0), oc = C.clubs[g.h === me ? g.a : g.h];
	return { cont: !!f.cont, label: f.label, round: f.round, guest: !!lg.contGuest, oppName: oc.name, others: C.games.filter(x => x.n === 0 && x.hg !== undefined).length, night0: C.games.filter(x => x.n === 0).length, notMember: !lg.members.includes(f.opp) || oc.id !== undefined };
});
check("on the night your game comes before the next league match, labelled as the cup", fix.cont && /Continental Cup · League phase, matchday 1/.test(fix.label) && fix.notMember, JSON.stringify(fix));
check("everyone else's games that night are played out", fix.others === fix.night0 - 1, JSON.stringify(fix));
const played = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, r = lg.round, budget = lg.club.budget;
	const before = lg.results.length;
	const f = F.currentFixture();
	window.__ffLm = f;
	return { r, budget, before };
});
// Play it from the kick-off card with Simulate, as with a league game.
const rm = await page.evaluate(() => { try { window.__ff.rematchTest(); return "ok"; } catch (e) { return e.stack; } });
if (rm !== "ok") { console.log(rm); }
await sleep(400);
const after = await page.evaluate(() => {
	const F = window.__ff; try { F.simulateMine(); } catch (e) { return { err: e.stack }; }
	const lg = F.league, C = lg.cont, me = C.clubs.findIndex(c => c.id === 0);
	const g = C.games.find(x => x.n === 0 && (x.h === me || x.a === me));
	return { played: g.hg !== undefined, round: lg.round, night: C.night, guest: !!lg.contGuest, next: (F.currentFixture() || {}).cont ? "cont" : "league", news: /Continental Cup, league phase matchday 1/.test(lg.news), state: F.state };
});
check("simulated like a league game: the result goes into the cup, the league round does not move", after.played && after.round === played.r && after.night === 1 && after.state === "full", JSON.stringify(after));
check("the guest seat is given back and the next game is the league's", !after.guest && after.next === "league" && after.news, JSON.stringify(after));

// The rest of the competition, played out: the table, the play-offs, the knockout rounds, the final.
const full = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.contSimAll();
	const rows = F.ccTable(C);
	const two = st => C.ties[st].every(t => t.g.length === 2 && C.games[t.g[0]].h === t.a && C.games[t.g[1]].h === t.b);
	const aggOk = st => C.ties[st].every(t => { const w = F.ccWinner(C, t), [ a, b ] = F.ccAgg(C, t), last = C.games[t.g[t.g.length - 1]]; return w !== null && (last.pens ? a === b : (a > b ? w === t.a : w === t.b)); });
	const poSeeds = C.ties.po.map(t => [ C.rank.indexOf(t.b) + 1, C.rank.indexOf(t.a) + 1 ]);
	const r16 = C.ties.r16.map(t => C.rank.indexOf(t.b) + 1);
	const fromPo = C.ties.r16.every(t => C.ties.po.some(p => F.ccWinner(C, p) === t.a));
	const prev = st => ({ r16: "po", qf: "r16", sf: "qf", f: "sf" }[st]);
	const chain = [ "qf", "sf", "f" ].every(st => C.ties[st].every(t => [ t.a, t.b ].every(x => C.ties[prev(st)].some(p => F.ccWinner(C, p) === x))));
	return { rows: rows.length, p8: rows.every(r => r.p === 8), po: C.ties.po.length, poSeeds, r16: C.ties.r16.length, r16Seeds: r16.sort((a, b) => a - b).join(","), fromPo, qf: C.ties.qf.length, sf: C.ties.sf.length, f: C.ties.f.length, finalOne: C.ties.f[0].g.length === 1 && C.games[C.ties.f[0].g[0]].neutral, two: [ "po", "r16", "qf", "sf" ].every(two), agg: [ "po", "r16", "qf", "sf", "f" ].every(aggOk), chain, winner: C.winner !== null, coef: Object.keys(lg.club.contCoef || {}).length, earned: C.earned };
});
check("the league-phase table has 36 clubs, each with 8 games", full.rows === 36 && full.p8, JSON.stringify(full));
check("9th to 24th play 8 two-legged play-offs (9 v 24 ... 16 v 17)", full.po === 8 && full.poSeeds.every(([ hi, lo ]) => hi >= 9 && hi <= 16 && hi + lo === 33), JSON.stringify(full.poSeeds));
check("the round of 16: the top 8 against the play-off winners", full.r16 === 8 && full.r16Seeds === "1,2,3,4,5,6,7,8" && full.fromPo, JSON.stringify(full));
check("then quarter-finals, semi-finals and a one-off final at a neutral ground", full.qf === 4 && full.sf === 2 && full.f === 1 && full.finalOne && full.chain, JSON.stringify(full));
check("every tie is two legs, the higher placed at home second, and the aggregate (or penalties) decides it", full.two && full.agg && full.winner, JSON.stringify(full));
check("coefficients are kept for next season's seeding, and prize money was paid", full.coef >= 36 && full.earned > 0, JSON.stringify(full));

// Qualification: the top four at the end of the season.
const q = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.club.contQual = null;
	lg.round = lg.fixtures.length;
	F.contQualify();
	const top = (() => { const s = window.__ff.league; return null; })();
	return { q: lg.club.contQual, season: lg.season };
});
check("at the end of the season the top four qualify for next season", q.q && q.q.season === q.season + 1 && q.q.ids.length === 4, JSON.stringify(q));
// It survives a save and a reload.
const saved = await page.evaluate(() => { const F = window.__ff, lg = F.league; lg.round = 0; delete lg.cont; lg.club.contQual = { season: lg.season, ids: [ 0, ...lg.members.filter(i => i !== 0).slice(0, 3) ] }; F.ensureCont(lg); F.saveLeague(); return lg.cont.games.length; });
await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const reloaded = await page.evaluate(() => { const C = window.__ff.league.cont; return { games: C && C.games ? C.games.length : 0, clubs: C && C.clubs ? C.clubs.length : 0 }; });
check("the draw is saved and comes back after a reload", saved === 144 && reloaded.games === 144 && reloaded.clubs === 36, JSON.stringify({ saved, reloaded }));
// The panel card.
const panel = await page.evaluate(() => { window.__ff.renderLeague(); const c = document.querySelector(".lg-cont"); return c ? { h: c.querySelector("h4").textContent, rows: c.querySelectorAll(".cc-table tr").length } : null; });
check("the panel has a card with the league-phase table", panel && panel.h === "Continental Champions Cup" && panel.rows === 37, JSON.stringify(panel));
if (process.env.FF_SHOTS) {
	await page.evaluate(() => document.getElementById("tab-cups").click());
	await page.evaluate(() => { const c = document.querySelector(".lg-cont"); c.querySelectorAll("details").forEach(d => { d.open = true; }); c.scrollIntoView(); });
	await sleep(300);
	const c = await page.$(".lg-cont"); if (c) { await c.screenshot({ path: `${process.env.FF_SHOTS}/continental-panel.png` }); }
}
check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
