// Run: node tests/worldcup.mjs   The World Championship: 16 qualify, groups of four, knockouts, the break calendar, old saves.
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8831), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(URL); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.intlComp, null, { timeout: 60000 });

// Qualifying (season 1): play it out; sixteen go through.
const q = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.intlComp(lg), n = Object.keys(F.NATIONS).length;
	lg.round = 30; F.intlNight();
	return { kind: C.kind, n, qn: C.qn, done: C.done, q: C.qualified.length, uniq: new Set(C.qualified).size, next: lg.intl.next && lg.intl.next.nats.length, news: /World Championship/.test(lg.news) };
});
check("qualifying sends 16 of the 32 countries to the World Championship", q.kind === "q" && q.n === 32 && q.qn === 16 && q.done && q.q === 16 && q.uniq === 16 && q.next === 16, JSON.stringify(q));

// Season 2: the finals, drawn into four groups of four.
const t = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.round = lg.fixtures.length; F.nextSeasonTest();
	const L = F.league, T = F.intlComp(L), cc = F.CC_NIGHTS.map(n => n.r), nights = T.nights.map(n => n.r);
	const pots = T.groups.every(g => g.length === 4), all = T.groups.flat();
	return { season: L.season, kind: T.kind, groups: T.groups.length, pots, uniq: new Set(all).size, teams: T.teams.length, games: T.games.length, rr: T.groups.every((g, gi) => g.every(a => g.every(b => a === b || T.games.filter(x => x.grp === gi && ((x.h === a && x.a === b) || (x.h === b && x.a === a))).length === 1))), nights: T.nights.map(n => n.stage + n.r).join(), clash: nights.filter(r => F.CUP_NIGHTS.includes(r) || cc.includes(r)), neutral: T.games.every(g => g.neutral), news: /groups of four/.test(L.news) };
});
check("an even season draws the finals: 16 countries in 4 groups of 4, a single round-robin each", t.season === 2 && t.kind === "t" && t.groups === 4 && t.pots && t.uniq === 16 && t.teams === 16 && t.games === 24 && t.rr && t.news, JSON.stringify(t));
check("the stages fit the three breaks (9, 20, 30) and no cup or continental night", t.nights === "g9,g9,g20,qf20,sf30,f30" && t.clash.length === 0 && t.neutral, JSON.stringify(t));

// Play it through: groups, the top two go on, quarter-finals, semi-finals, a final.
const f = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, T = F.intlComp(lg);
	lg.round = 30; F.intlNight();
	const tabs = T.groups.map((_, gi) => F.intlGroupTable(T, gi)), top2 = tabs.flatMap(x => [ x[0].nat, x[1].nat ]);
	const qf = T.games.filter(g => g.stage === "qf"), sf = T.games.filter(g => g.stage === "sf"), fin = T.games.filter(g => g.stage === "f");
	const winners = tabs.map(x => x[0].nat), runners = tabs.map(x => x[1].nat);
	F.renderLeague();
	const card = document.querySelector(".lg-intl");
	return { done: T.done, winner: !!T.winner, played: tabs.every(x => x.every(r => r.p === 3)), qf: qf.length, qfIn: qf.every(g => top2.includes(g.h) && top2.includes(g.a)), pairing: qf.every(g => winners.includes(g.h) !== winners.includes(g.a)) && qf.every(g => tabs.findIndex(x => x.some(r => r.nat === g.h)) !== tabs.findIndex(x => x.some(r => r.nat === g.a))), sf: sf.length, f: fin.length, tables: card ? card.querySelectorAll(".intl-table").length : 0, text: card ? card.textContent.includes("Final") : false };
});
check("each group plays 3 games and the top two go through", f.played && f.qf === 4 && f.qfIn, JSON.stringify(f));
check("quarter-finals pair a group winner with another group's runner-up, then semi-finals and a final to a winner", f.pairing && f.sf === 2 && f.f === 1 && f.done && f.winner, JSON.stringify(f));
check("the Cups tab shows the four group tables and the bracket", f.tables === 4 && f.text, JSON.stringify(f));

// An old save in the middle of the eight-team tournament (no groups) still plays out.
const old = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.round = lg.fixtures.length; F.nextSeasonTest();
	const L = F.league, nats = F.nationSquads(L).slice(0, 8).map(s => s.nat);
	L.intl.comp = { v: 1, season: L.season, kind: "t", teams: nats, games: [ [ 0, 7 ], [ 3, 4 ], [ 1, 6 ], [ 2, 5 ] ].map(([ x, y ]) => ({ h: nats[x], a: nats[y], n: 0, stage: "qf", neutral: true })), nights: [ { r: 30, stage: "qf" }, { r: 30, stage: "sf" }, { r: 30, stage: "f" } ], night: 0, done: false, winner: null };
	let err = ""; try { F.ensureIntl && 0; L.round = 30; F.intlNight(); F.renderLeague(); } catch (e) { err = e.message; }
	const T = F.intlComp(L);
	return { err, kind: T.kind, done: T.done, winner: !!T.winner };
});
check("a save made in the old eight-team format loads and plays out its tournament", !old.err && old.kind === "t" && old.done && old.winner, JSON.stringify(old));
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
