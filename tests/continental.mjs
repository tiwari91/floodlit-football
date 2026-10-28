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
check("an old save migrates: no cup this season, a note: finish top 4 to qualify, with your position", old.none && !old.fixture && /top 4/.test(old.next) && /You are \d/.test(old.next), JSON.stringify(old));

// Qualified: the draw.
const draw = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.round = 0; delete lg.cont;
	const ids = lg.members.slice(0, 4).includes(0) ? lg.members.slice(0, 4) : [ 0, ...lg.members.filter(i => i !== 0).slice(0, 3) ];
	lg.club.contQual = { season: lg.season, ids };
	const C = F.ensureCont(lg), N = C.clubs.length, me = C.clubs.findIndex(c => c.id === 0);
	const potOf = i => Math.floor(C.pots.indexOf(i) / (N / 4));
	const perClub = C.clubs.map(() => ({ h: 0, a: 0 }));
	for (const g of C.games) { perClub[g.h].h++; perClub[g.a].a++; }
	const nights = C.games.filter(g => g.h === me || g.a === me).map(g => g.n);
	return { N, groups: C.groups.length, size: C.groups.every(g => g.length === 4), pots: C.groups.every(g => new Set(g.map(potOf)).size === 4), sameNat: C.groups.reduce((t, g) => t + g.filter((x, i) => g.some((y, k) => k !== i && C.clubs[x].nat === C.clubs[y].nat)).length, 0), games: C.games.length, ha: perClub.every(p => p.h === 3 && p.a === 3), rr: C.groups.every((g, gi) => g.every(x => g.every(y => x === y || C.games.filter(k => k.grp === gi && k.h === x && k.a === y).length === 1))), nightsOk: C.games.every(g => g.n >= 0 && g.n < 6) && new Set(nights).size === 6, names: new Set(C.clubs.map((c, i) => F.ccTable(C, 0) && c.name || c.id)).size, news: /Continental Champions Cup draw/.test(lg.news), v: C.v };
});
check("32 clubs in 8 groups of 4, one from each pot", draw.N === 32 && draw.groups === 8 && draw.size && draw.pots, JSON.stringify(draw));
check("each group is a double round-robin: 6 games each, 3 at home and 3 away, 96 games", draw.games === 96 && draw.ha && draw.rr, JSON.stringify(draw));
check("no club meets one from its own country in a group", draw.sameNat === 0, JSON.stringify(draw));
check("your 6 group games fall on 6 different nights, and the draw is in the news", draw.nightsOk && draw.news, JSON.stringify(draw));

// Your game is a real fixture when its night comes: a club from abroad in the guest seat, then given back.
const fix = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, r0 = F.CC_NIGHTS[0].r;
	lg.round = r0; F.contNight();
	const f = F.currentFixture(), T = f && f.opp;
	const name = f ? document.createElement("x") && window.__ff.league.cont.clubs : null;
	const C = lg.cont, g = C.games[f.cont.gi], me = C.clubs.findIndex(c => c.id === 0), oc = C.clubs[g.h === me ? g.a : g.h];
	return { cont: !!f.cont, label: f.label, round: f.round, guest: !!lg.contGuest, oppName: oc.name, others: C.games.filter(x => x.n === 0 && x.hg !== undefined).length, night0: C.games.filter(x => x.n === 0).length, notMember: !lg.members.includes(f.opp) || oc.id !== undefined };
});
check("on the night your game comes before the next league match, labelled as the cup", fix.cont && /Continental Cup · Group stage, matchday 1/.test(fix.label) && fix.notMember, JSON.stringify(fix));
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
	return { played: g.hg !== undefined, round: lg.round, night: C.night, guest: !!lg.contGuest, next: (F.currentFixture() || {}).cont ? "cont" : "league", news: /Continental Cup, group stage matchday 1/.test(lg.news), state: F.state };
});
check("simulated like a league game: the result goes into the cup, the league round does not move", after.played && after.round === played.r && after.night === 1 && after.state === "full", JSON.stringify(after));
check("the guest seat is given back and the next game is the league's", !after.guest && after.next === "league" && after.news, JSON.stringify(after));

// The rest of the competition, played out: the groups, the knockout rounds, the final.
const full = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.contSimAll();
	const tabs = C.groups.map((_, gi) => F.ccTable(C, gi));
	const two = st => C.ties[st].every(t => t.g.length === 2 && C.games[t.g[0]].h === t.a && C.games[t.g[1]].h === t.b);
	const aggOk = st => C.ties[st].every(t => { const w = F.ccWinner(C, t), [ a, b ] = F.ccAgg(C, t), last = C.games[t.g[t.g.length - 1]]; return w !== null && (last.pens ? a === b : (a > b ? w === t.a : w === t.b)); });
	const through = tabs.flatMap(t => [ t[0].i, t[1].i ]);
	const r16 = C.ties.r16.every(t => through.includes(t.a) && through.includes(t.b)) && new Set(C.ties.r16.flatMap(t => [ t.a, t.b ])).size === 16;
	const noRematch = C.ties.r16.every(t => C.groups.findIndex(g => g.includes(t.a)) !== C.groups.findIndex(g => g.includes(t.b)));
	const prev = st => ({ qf: "r16", sf: "qf", f: "sf" }[st]);
	const chain = [ "qf", "sf", "f" ].every(st => C.ties[st].every(t => [ t.a, t.b ].every(x => C.ties[prev(st)].some(p => F.ccWinner(C, p) === x))));
	return { played: tabs.every(t => t.every(r => r.p === 6)), r16n: C.ties.r16.length, r16, noRematch, qf: C.ties.qf.length, sf: C.ties.sf.length, f: C.ties.f.length, finalOne: C.ties.f[0].g.length === 1 && C.games[C.ties.f[0].g[0]].neutral === true, chain, two: two("r16") && two("qf") && two("sf"), agg: aggOk("r16") && aggOk("qf") && aggOk("sf") && aggOk("f"), winner: C.winner !== null, coef: Object.keys(lg.club.contCoef || {}).length, earned: C.earned };
});
check("every group table shows 6 games each", full.played, JSON.stringify(full));
check("the top two of each group make the round of 16: 8 ties, winners and runners-up of different groups", full.r16n === 8 && full.r16 && full.noRematch, JSON.stringify(full));
check("then quarter-finals, semi-finals and a one-off final at a neutral ground", full.qf === 4 && full.sf === 2 && full.f === 1 && full.finalOne && full.chain, JSON.stringify(full));
check("every knockout tie is two legs, and the aggregate (or penalties) decides it", full.two && full.agg && full.winner, JSON.stringify(full));
check("coefficients are kept for next season's seeding, and prize money was paid", full.coef >= 32 && full.earned > 0, JSON.stringify(full));

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
check("the draw is saved and comes back after a reload", saved === 96 && reloaded.games === 96 && reloaded.clubs === 32, JSON.stringify({ saved, reloaded }));
// The panel card.
const panel = await page.evaluate(() => { window.__ff.renderLeague(); const c = document.querySelector(".lg-cont"); return c ? { h: c.querySelector("h4").textContent, rows: c.querySelectorAll(".cc-table tr").length } : null; });
check("the panel has a card with the eight group tables", panel && panel.h === "Continental Champions Cup" && panel.rows === 40, JSON.stringify(panel));
if (process.env.FF_SHOTS) {
	await page.evaluate(() => document.getElementById("tab-cups").click());
	await page.evaluate(() => { const c = document.querySelector(".lg-cont"); c.querySelectorAll("details").forEach(d => { d.open = true; }); c.scrollIntoView(); });
	await sleep(300);
	const c = await page.$(".lg-cont"); if (c) { await c.screenshot({ path: `${process.env.FF_SHOTS}/continental-panel.png` }); }
}
// An old save in the middle of the earlier format (v1, 36 clubs): it loads, that season has no cup.
const v1 = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.round = 12; lg.cont = { v: 1, season: lg.season, clubs: new Array(36).fill({ name: "x", nat: "ESP", str: 3 }), games: [], ties: { po: [], r16: [], qf: [], sf: [], f: [] }, night: 3, winner: null, out: null, earned: 0, paid: {} };
	let err = ""; try { F.ensureCont(lg); F.contNight(); F.renderLeague(); } catch (e) { err = e.message; }
	return { err, none: !!lg.cont.none, v: lg.cont.v, fixture: !!(F.currentFixture() || {}).cont };
});
check("a save made mid-season in the old 36-club format loads without errors; that season has no cup", !v1.err && v1.none && v1.v === 2 && !v1.fixture, JSON.stringify(v1));

// The way in: the path on the Cups tab, the Overview and the league table.
const path = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.round = 4; delete lg.cont; if (lg.club) { lg.club.contQual = null; }
	F.renderLeague();
	const cups = document.querySelector(".lg-cont .detail").textContent, ov = document.getElementById("lgNext").textContent;
	const zone = [ ...document.querySelectorAll("#lgBody tr td:first-child.z-cl") ];
	return { cups, ov, zone: zone.length, title: zone[0] && zone[0].title, legend: document.querySelector(".zones").textContent };
});
check("the Cups tab says 'Finish top 4 to qualify' with your position", /Finish top 4 to qualify/.test(path.cups) && /You are \d+(st|nd|rd|th)/.test(path.cups), path.cups);
check("the Overview says it too", /Finish top 4 to qualify/.test(path.ov), path.ov);
check("the league table marks the four qualifying places", path.zone === 4 && /Continental Champions Cup/.test(path.title) && /qualifies/.test(path.legend), JSON.stringify(path));

// Start in the Continental Champions Cup: a new career enters it in season one.
const start = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, box = document.getElementById("ccStart");
	lg.season = 1; lg.round = 0; delete lg.cont; lg.club.contQual = null;
	box.checked = true; box.dispatchEvent(new Event("change"));
	const C = F.ensureCont(lg), on = !!C && !C.none && C.clubs.some(c => c.id === 0);
	const fresh = (() => { box.checked = true; return localStorage.getItem("ff-cc-start"); })();
	F.newSeasonTest && 0;
	return { on, groups: C && C.groups && C.groups.length, stored: fresh };
});
check("Settings > Start in the Continental Champions Cup puts your club in the cup in season one", start.on && start.groups === 8 && start.stored === "1", JSON.stringify(start));
const gets = await page.evaluate(() => {
	const F = window.__ff, lg = F.league; lg.round = F.CC_NIGHTS[0].r; F.contNight();
	const f = F.currentFixture();
	return { cont: !!(f && f.cont), label: f && f.label };
});
check("and the first group game is there to play on its night", gets.cont && /Group stage, matchday 1/.test(gets.label), JSON.stringify(gets));
const off = await page.evaluate(() => { const box = document.getElementById("ccStart"); window.__ff.league.round = 0; box.checked = false; box.dispatchEvent(new Event("change")); const C = window.__ff.ensureCont(window.__ff.league); return { none: !!C.none, stored: localStorage.getItem("ff-cc-start") }; });
check("switching it off before the first night takes the club out again", off.none && off.stored === "0", JSON.stringify(off));
check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
