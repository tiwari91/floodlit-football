// Run: node tests/intl.mjs   National teams: squads picked from the save, their strength, the Nations card.
import { launch, serve, tally, showTab } from "./_env.mjs";
const server = serve(8813), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 200)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.nationSquads, null, { timeout: 60000 });

const sq = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, list = F.nationSquads(lg), pool = F.intlPool(lg);
	const P = F.POS_OF_SLOT, ovr = p => F.ovrOf ? F.ovrOf(p) : 0;
	const bad = [];
	for (const s of list) {
		if (s.xi.length !== 11 || s.xi.some((e, i) => e.pl.pos !== P[i])) { bad.push(`${s.nat} shape`); }
		if ([ ...s.xi, ...s.bench ].some(e => e.pl.nat !== s.nat)) { bad.push(`${s.nat} nat`); }
		if (!(s.str >= 1 && s.str <= 5)) { bad.push(`${s.nat} str ${s.str}`); }
		if (s.bench.length > 5) { bad.push(`${s.nat} bench`); }
		// The best player in the save at each position is in the eleven.
		for (const pos of [ "gk", "def", "mid", "fwd" ]) {
			const best = pool.filter(e => e.pl.nat === s.nat && e.pl.pos === pos).sort((a, b) => ovr(b.pl) - ovr(a.pl))[0];
			const same = (a, b) => a.name === b.name && a.pos === b.pos && ovr(a) === ovr(b);
			if (best && !s.xi.some(e => same(e.pl, best.pl))) { bad.push(`${s.nat} best ${pos}`); }
		}
		if (s.ident.name !== F.NATIONS[s.nat][0] || s.ident.short !== s.nat || !s.ident.color || !s.ident.color2) { bad.push(`${s.nat} ident`); }
	}
	const sorted = list.every((s, i) => i === 0 || list[i - 1].ovr >= s.ovr);
	return { n: list.length, nations: Object.keys(F.NATIONS).length, bad, sorted, same: F.nationSquads(lg) === list, inv: F.strOfOvr(71) === 3 && F.strOfOvr(85) === 5 && F.strOfOvr(40) === 1 };
});
check("every country has a squad, eleven by position plus a bench, only its own players", sq.n === sq.nations && sq.bad.length === 0, JSON.stringify(sq.bad.slice(0, 8)));
check("the best player in each position makes the eleven, and the list runs strongest first", sq.sorted && !sq.bad.some(b => / best /.test(b)), JSON.stringify(sq));
check("strength maps back onto the 1..5 scale the way cpuOvr maps it out", sq.inv);
check("the squads are cached for the half-season", sq.same);

// Your own player of another nationality, made the best in the save: he is picked, and the cache notices.
const yours = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, pl = lg.club.squad[9];
	const before = F.nationSquads(lg);
	Object.assign(pl, { nat: "URU", pac: 96, sho: 96, pas: 96, def: 60, name: "Test Striker" });
	const after = F.nationSquads(lg), s = after.find(x => x.nat === "URU");
	return { rebuilt: before !== after, picked: s.xi.some(e => e.pl === pl && e.own), fwd: s.xi[9].pl === pl || s.xi[10].pl === pl };
});
check("your own player is called up when he is the best (and the cache rebuilds)", yours.rebuilt && yours.picked && yours.fwd, JSON.stringify(yours));

// A country with nobody in the save: eleven uncapped players, a weak side.
const empty = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, pool = F.intlPool(lg);
	const nat = "JPN", s = F.pickNation(nat, pool.filter(e => e.pl.nat !== nat), lg);
	return { nat, filled: s.filled, count: s.count, str: s.str, gen: s.xi.every(e => e.gen) };
});
check("a country with no players in the save is filled with uncapped players and stays weak", (empty.filled === 11 && empty.count === 0 && empty.gen && empty.str <= 2.5), JSON.stringify(empty));

// The Nations card on the Cups tab, and it fits a phone.
await showTab(page, "cups");
const card = await page.evaluate(() => { window.__ff.renderLeague(); const c = document.querySelector(".lg-nations"); return c ? { rows: c.querySelectorAll(".nat-list > li").length, h: c.querySelector("h4").textContent } : null; });
check("the Cups tab has a Nations card with a row per country", card && card.h === "Nations" && card.rows === sq.nations, JSON.stringify(card));
await page.setViewportSize({ width: 390, height: 844 });
const phone = await page.evaluate(() => { const c = document.querySelector(".lg-nations"); c.querySelector("details").open = true; return { sw: c.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth <= window.innerWidth }; });
check("the Nations card fits a phone screen", phone.sw <= phone.cw + 1 && phone.doc, JSON.stringify(phone));

await page.setViewportSize({ width: 1440, height: 900 });

/* ---------- Phase B/C: the breaks, the job, playing an international ---------- */
// The calendar: season 1 is a qualifying season, three breaks clear of every cup night, every country in a group of 5 or 6.
const cal = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.intlComp(lg), cc = F.CC_NIGHTS.map(n => n.r), all = C.groups.flat();
	const games = n => C.games.filter(g => g.h === n || g.a === n).length;
	return { season: lg.season, kind: C.kind, breaks: F.INTL_BREAKS, clash: F.INTL_BREAKS.filter(r => F.CUP_NIGHTS.includes(r) || cc.includes(r)), nightR: [ ...new Set(C.nights.map(n => n.r)) ],
		sizes: C.groups.map(g => g.length), all: all.length, uniq: new Set(all).size, nations: Object.keys(F.NATIONS).length,
		rr: C.groups.every(g => g.every(n => games(n) === g.length - 1)), fx: !!(F.currentFixture() && !F.currentFixture().intl) };
});
check("three international breaks a season, after matchdays 9, 20 and 30, never on a cup or continental night", cal.breaks.join() === "9,20,30" && cal.clash.length === 0 && cal.nightR.join() === "9,20,30", JSON.stringify(cal));
check("an odd season is qualifiers: every country once, in groups of 5 or 6, each playing the rest of its group", cal.kind === "q" && cal.season % 2 === 1 && cal.sizes.every(n => n >= 5 && n <= 6) && cal.all === cal.nations && cal.uniq === cal.nations && cal.rr, JSON.stringify(cal));
check("before the first break the next fixture is the league's", cal.fx);

// No job: at the first break the other countries' games are played out, two a side, and the Cups tab shows the tables.
const brk = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.intlComp(lg), r0 = lg.round;
	lg.round = 9; F.intlNight();
	const played = C.games.filter(g => g.hg !== undefined).length, due = C.games.filter(g => g.n < 2).length;
	const fx = F.currentFixture();
	F.renderLeague();
	const card = document.querySelector("#lgExtras .lg-intl"), rows = card ? [ ...card.querySelectorAll(".intl-table tr:not(:first-child)") ] : [];
	const ps = rows.map(r => Number(r.children[1].textContent)), names = rows.map(r => r.children[0].textContent.replace(/^\d+ /, ""));
	const want = names.map(nm => { const nat = Object.keys(F.NATIONS).find(k => F.NATIONS[k][0] === nm); return C.games.filter(g => g.n < 2 && (g.h === nat || g.a === nat)).length; });
	const match = ps.every((p, i) => p === want[i]);
	lg.round = r0;
	return { night: C.night, played, due, fx: fx && !fx.intl, title: card && card.querySelector("h4").textContent, detail: card && card.querySelector(".detail").textContent, rows: rows.length, ps: [ ...new Set(ps) ], match };
});
check("at a break the other countries' games are simulated, and without a job the league goes on", brk.night === 2 && brk.played === brk.due && brk.fx, JSON.stringify(brk));
check("the Cups tab's International card shows every group table, two games each (one in a group of five with a bye)", brk.title === "International" && brk.rows === cal.nations && brk.match && brk.ps.includes(2), JSON.stringify(brk));
const ov = await page.evaluate(async () => { window.__ff.syncHub(); await new Promise(r => requestAnimationFrame(r)); return [ ...document.querySelectorAll("#panel-overview .ov-cups li") ].map(li => li.textContent).find(t => /^International/.test(t)) || null; });
check("the Overview has a line for the international breaks", !!ov && /International break after matchday 20/.test(ov), ov);

// An offer: one at most, from a country within about one star of your standing.
const off = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, o = F.intlOffers(3, () => 0.01, true), rep = F.intlRep(lg, 3);
	const none = (() => { const keep = lg.intl.nat; lg.intl.nat = "BRA"; const x = F.intlOffers(3, () => 0.01, true).length; lg.intl.nat = keep; return x; })();
	return { n: o.length, near: o.every(x => Math.abs(x.str - rep) <= 1), rep, none, o };
});
check("after a season a country may offer you its job: one offer, within a star of your standing; none while you hold one", off.n === 1 && off.near && off.none === 0, JSON.stringify(off));

// Pick a country from a group of six (it plays on every night), make one of your own players its best, and offer it to you.
const pick = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.intlComp(lg), g6 = C.groups.find(g => g.length === 6);
	const nat = g6.find(n => C.games.some(g => g.n === 2 && (g.h === n || g.a === n)) && C.games.some(g => g.n === 3 && (g.h === n || g.a === n)));
	const pl = lg.club.squad[10];
	Object.assign(pl, { nat, pac: 97, sho: 97, pas: 90, def: 60, fit: 100, inj: 0, ban: 0, name: "Capped Forward" });
	lg.intl.offers = [ { nat, str: F.nationSquad(nat, lg).str, season: lg.season } ];
	F.renderLeague();
	return { nat, name: F.NATIONS[nat][0], club: F.YOU.name };
});
await showTab(page, "club");
const acc = await page.evaluate(() => {
	const F = window.__ff, li = [ ...document.querySelectorAll("#jobOffers li") ].find(x => /NATIONAL/.test(x.textContent));
	const title = !document.getElementById("jobsTitle").hidden;
	if (!li) { return { li: false }; }
	const card = li.textContent;
	[ ...li.querySelectorAll("button") ].find(b => b.textContent === "Accept").click();
	return { li: true, title, card, only: F.league.intl.only === true, nat: F.league.intl.nat, club: F.YOU.name, offers: F.league.intl.offers.length, job: document.getElementById("intlJob").textContent, resign: !!document.getElementById("intlResign") };
});
check("the international offer is an Accept/Decline card under Club > Career that says you leave the club; accepting leaves it", acc.li && acc.title && acc.nat === pick.nat && acc.only && acc.offers === 0 && acc.resign && acc.job.includes(pick.name) && acc.job.includes("no club") && acc.card.includes(`leave ${pick.club} to manage ${pick.name} full-time`), JSON.stringify(acc));

// The Squad tab's International card: auto-pick by default; leave your own man out and he is not called up.
await showTab(page, "squad");
const sqc = await page.evaluate(() => {
	const F = window.__ff; for (const p of [ ...F.league.club.squad, ...F.league.club.bench ]) { if (p.name === "Capped Forward") { p.inj = 0; p.ban = 0; } } F.renderLeague();
	const box = document.getElementById("intlSquad"), names = () => [ ...box.querySelectorAll("ol.nat-xi li .who") ].map(e => e.textContent);
	const auto = box.querySelector("#intlAuto").getAttribute("aria-pressed"), had = names().some(t => t.startsWith("Capped Forward"));
	const btn = [ ...box.querySelectorAll(".intl-selist li button") ].find(b => b.closest("li").textContent.includes("Capped Forward"));
	btn.click();
	const left = !F.intlCallUp(F.league).xi.some(e => e.pl.name === "Capped Forward"), auto2 = box.querySelector("#intlAuto").getAttribute("aria-pressed");
	box.querySelector("#intlAuto").click();
	const back = F.intlCallUp(F.league).xi.some(e => e.pl.name === "Capped Forward");
	return { shown: !box.hidden, auto, had, left, auto2, back, auto3: box.querySelector("#intlAuto").getAttribute("aria-pressed") };
});
check("the Squad tab has an International card: best XI by default, your own players can be left out and recalled", sqc.shown && sqc.auto === "true" && sqc.had && sqc.left && sqc.auto2 === "false" && sqc.back && sqc.auto3 === "true", JSON.stringify(sqc));

// The second break: your qualifier comes before the league, in your national kit with your national squad, and the league resumes after.
const play = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.intlComp(lg), nat = lg.intl.nat, natName = F.NATIONS[nat][0];
	const clubName = F.YOU.name, clubColor = F.YOU.color, nationNames = new Set(Object.values(F.NATIONS).map(n => n[0]));
	lg.round = 20; for (let i = 0; i < lg.round; i++) { lg.results[i] = lg.results[i] || []; } F.intlNight();
	const out = { games: [] };
	const fx = F.currentFixture();
	out.first = { intl: !!fx.intl, label: fx.label, opp: F.TEAMS[fx.opp].name, oppNat: fx.intl && F.NATIONS[fx.intl.nat][0] };
	const fitBefore = lg.club.squad[10].fit;
	for (let k = 0; k < 2; k++) {
		F.newMatchTest();
		const lm = F.leagueMatch, side = F.intlSide;
		const mine = F.players.filter(p => p.team === 0).map(p => p.name), xi = new Set(side.club.squad.map(p => p.name));
		out.games.push({ intl: !!(lm && lm.intl), you: F.YOU.name, kit: F.YOU.color === F.nationIdent(nat).color && F.kits[0].outfield !== undefined, xi: mine.every(n => xi.has(n)), capped: mine.includes("Capped Forward"), opp: F.TEAMS[lm.opp].name });
		F.simulateMineTest();
	}
	const after = F.currentFixture();
	out.after = { intl: !!after.intl, round: after.round, lgRound: lg.round, night: C.night, you: F.YOU.name };
	out.leftover = F.TEAMS.map(t => t.name).filter(n => nationNames.has(n));
	out.fit = [ fitBefore, lg.club.squad[10].fit ];
	out.mineP = F.intlGroupTable(C, C.groups.findIndex(g => g.includes(nat))).find(r => r.nat === nat).p;
	out.record = lg.intl.record.length;
	out.natName = natName; out.clubName = clubName;
	F.readyTest();
	return out;
});
check("at the second break your qualifier comes before the league, labelled, against the other country in the guest seat", play.first.intl && /^International · Qualifier, Group [A-F]$/.test(play.first.label) && play.first.opp === play.first.oppNat, JSON.stringify(play.first));
check("the international is played in your national kit and name, with your national squad (your own capped man in it)", play.games.length === 2 && play.games.every(g => g.intl && g.you === play.natName && g.kit && g.xi) && play.games[0].capped, JSON.stringify(play.games));
check("after the break the league resumes: same matchday, your club's name back, no country left in the clubs list", !play.after.intl && play.after.round === 20 && play.after.lgRound === 20 && play.leftover.length === 0, JSON.stringify({ after: play.after, leftover: play.leftover }));
check("your group table counts your games, and your record keeps them", play.mineP === 4 && play.record === 2, JSON.stringify(play));
check("with no club, an international costs nobody's fitness", play.fit[1] === play.fit[0], JSON.stringify(play.fit));

// The FA's choice: a club abroad while you manage a country.
await showTab(page, "club");
const fa = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.jobOffers = [ { abroad: "europe", kind: "abroad", nat: "ESP", name: "Puerto Test", str: 3, budget: 5, season: lg.season } ];
	F.renderLeague();
	const li = [ ...document.querySelectorAll("#jobOffers li") ].find(x => /Puerto Test/.test(x.textContent));
	[ ...li.querySelectorAll("button") ].find(b => b.textContent === "Move abroad").click();
	const ask = [ ...document.querySelectorAll("#jobOffers li") ].find(x => /can't manage a club and a country/.test(x.textContent));
	const stay = ask && [ ...ask.querySelectorAll("button") ].find(b => /^Stay with/.test(b.textContent));
	const still = F.YOU.name;
	if (stay) { stay.click(); }
	return { ask: !!ask, still, nat: lg.intl.nat, offers: lg.jobOffers.length, you: F.YOU.name };
});
check("taking a club job abroad while you manage a country: the FA asks you to choose; staying turns the club down", fa.ask && fa.nat === pick.nat && fa.offers === 0, JSON.stringify(fa));

// Saves: the job survives export and import; an old save without it loads with no job and no breaks; a damaged one is cleaned.
const sv = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const file = JSON.parse(JSON.stringify({ app: "floodlit-football", v: 1, league: lg }));
	const ok = F.validLeague(file.league), copy = F.ensureClub(file.league);
	const old = JSON.parse(JSON.stringify(lg)); delete old.intl;
	const oldOk = F.validLeague(old), o2 = F.ensureClub(old);
	const bad = JSON.parse(JSON.stringify(lg)); bad.intl = { v: 1, nat: "XXX", offers: "x", comp: { v: 1, season: lg.season, kind: "q", games: [ { h: "ZZZ" } ], nights: [] } };
	const b2 = F.ensureClub(bad);
	F.ensureClub(lg);   // back to the live save's identities
	return { ok, nat: copy.intl.nat, games: copy.intl.comp.games.length, played: copy.intl.comp.games.filter(g => g.hg !== undefined).length, live: lg.intl.comp.games.filter(g => g.hg !== undefined).length,
		oldOk, oldNat: o2.intl.nat, oldNone: !!o2.intl.comp.none, oldNext: F.intlNext(o2), badNat: b2.intl.nat, badNone: !!b2.intl.comp.none, badOffers: Array.isArray(b2.intl.offers) };
});
check("export and import carry the national job and the competition", sv.ok && sv.nat === pick.nat && sv.games > 0 && sv.played === sv.live, JSON.stringify(sv));
check("an old save loads with no national job and no breaks until next season; a damaged one is cleaned", sv.oldOk && sv.oldNat === null && sv.oldNone && /No internationals this season/.test(sv.oldNext) && sv.badNat === null && sv.badNone && sv.badOffers, JSON.stringify(sv));

// The last break and the end of qualifying: sixteen go through (the six group winners first), and the job carries into an even season's tournament.
const q = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, C = F.intlComp(lg);
	lg.round = 30; for (let i = 0; i < lg.round; i++) { lg.results[i] = lg.results[i] || []; } F.intlNight();
	let guard = 0;
	while (F.currentFixture() && F.currentFixture().intl && guard++ < 3) { F.newMatchTest(); F.simulateMineTest(); }
	const winners = C.groups.map((g, i) => F.intlGroupTable(C, i)[0].nat);
	const res = { done: C.done, q: C.qualified.slice(), winnersIn: winners.every(w => C.qualified.includes(w)), next: lg.intl.next, nat: lg.intl.nat, missed: lg.intl.missed };
	lg.round = lg.fixtures.length;
	F.nextSeasonTest();
	const L = F.league, T = F.intlComp(L);
	res.s2 = { season: L.season, kind: T.kind, teams: T.teams, nat: L.intl.nat, record: L.intl.record.length, r: [ ...new Set(T.nights.map(n => n.r)) ], groups: T.groups.length, neutral: T.games.every(g => g.neutral) };
	return res;
});
check("qualifying ends at the last break: sixteen countries through, every group winner among them", q.done && q.q.length === 16 && new Set(q.q).size === 16 && q.winnersIn && q.next && q.next.nats.join() === q.q.join(), JSON.stringify(q));
check("the national job and record carry into the next season, an even one: the sixteen qualifiers' World Championship over the three breaks, at neutral grounds", q.s2.season % 2 === 0 && q.s2.kind === "t" && q.s2.nat === pick.nat && q.s2.record >= 3 && q.s2.teams.slice().sort().join() === q.q.slice().sort().join() && q.s2.r.join() === "9,20,30" && q.s2.groups === 4 && q.s2.neutral, JSON.stringify(q.s2));

// The tournament plays out to a winner (your games through the match flow if you are in it), one round a night.
const t = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, T = F.intlComp(lg);
	lg.round = 30; for (let i = 0; i < lg.round; i++) { lg.results[i] = lg.results[i] || []; } F.intlNight();
	let guard = 0;
	while (F.currentFixture() && F.currentFixture().intl && guard++ < 12) { F.newMatchTest(); F.simulateMineTest(); }
	F.renderLeague();
	const card = document.querySelector("#lgExtras .lg-intl");
	return { done: T.done, winner: T.winner, sf: T.games.filter(g => g.stage === "sf").length, f: T.games.filter(g => g.stage === "f").length, card: card && card.textContent.includes("Final"), detail: card && card.querySelector(".detail").textContent };
});
check("the World Championship runs groups, quarter-finals, semi-finals and a final to a winner, and the Cups card shows the bracket", t.done && !!t.winner && t.sf === 2 && t.f === 1 && t.card && /won the World Championship/.test(t.detail), JSON.stringify(t));

// Winning the tournament: its own trophy on the stage, not the league's.
const tro = await page.evaluate(async () => {
	const F = window.__ff;
	F.readyTest(); F.state = "full";
	F.queueTrophy("World Championship"); F.trophyDue();
	await new Promise(r => setTimeout(r, 2500));
	const t = document.getElementById("ovTrophyText"), cap = [ ...document.querySelectorAll("#overlay, #ovTrophy, .cer-caption, #cerCaption") ].map(e => e.textContent).join(" ");
	return { text: (t && t.textContent) || "", cap: /World Championship/i.test(cap) || /World Championship/i.test(document.body.innerText) };
});
check("winning the tournament puts its own trophy on the stage", tro.cap, JSON.stringify(tro));
await page.evaluate(() => { const F = window.__ff; F.readyTest(); });

// Two missed tournaments in a row and the FA lets you go.
const sack = await page.evaluate(() => {
	const F = window.__ff;
	F.league.round = F.league.fixtures.length; F.nextSeasonTest();
	const lg = F.league, C = F.intlComp(lg); if (!lg.intl.nat || (C.tour === "eu" && !F.NATIONS[lg.intl.nat][1].match(/home|europe/))) { lg.intl.nat = "NED"; }
	const nat = lg.intl.nat;
	if (C.kind !== "q") { return { kind: C.kind }; }
	lg.intl.missed = 1;
	for (const g of C.games) { if (g.hg === undefined) { [ g.hg, g.ag ] = g.h === nat ? [ 0, 3 ] : g.a === nat ? [ 3, 0 ] : [ 1, 1 ]; } }
	C.night = C.nights.length - 1; lg.round = 30; for (let i = 0; i < lg.round; i++) { lg.results[i] = lg.results[i] || []; } F.intlNight();
	return { kind: C.kind, done: C.done, out: !C.qualified.includes(nat), nat: lg.intl.nat, news: /let you go/.test(lg.news) };
});
check("two missed tournaments in a row and the FA lets you go", sack.kind === "q" && sack.done && sack.out && sack.nat === null && sack.news, JSON.stringify(sack));

// Resigning, from the Club tab.
await showTab(page, "club");
const rs = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.intl.offers = [ { nat: "NED", str: 3, season: lg.season } ]; F.acceptIntl("NED"); F.renderLeague();
	const b = document.getElementById("intlResign"), had = lg.intl.nat;
	if (b) { b.click(); }
	return { had, nat: lg.intl.nat, between: /between jobs/.test(document.getElementById("intlJob").textContent), offers: lg.jobOffers.length };
});
check("you can resign the national job from the Club tab; with no club you are told to pick one of the offers", rs.had === "NED" && rs.nat === null && rs.between && rs.offers > 0, JSON.stringify(rs));


// Country only: no club. Fresh season, accept a job, and look at what the player sees.
const only = await page.evaluate(() => {
	const F = window.__ff; F.league.jobOffers = []; F.league.intl.only = false; F.league.intl.nat = null;
	F.league.round = F.league.fixtures.length; F.nextSeasonTest();
	const lg = F.league, club = F.YOU.name, C = F.intlComp(lg); window.__onlyNat = C.kind === "t" ? C.teams[0] : C.groups[0][0]; window.__onlyName = F.NATIONS[window.__onlyNat][0];
	lg.intl.offers = [ { nat: window.__onlyNat, str: 3, season: lg.season } ]; F.renderLeague();
	const card = [ ...document.querySelectorAll("#jobOffers li") ].find(x => /NATIONAL/.test(x.textContent));
	const said = card ? card.textContent : "";
	[ ...card.querySelectorAll("button") ].find(b => b.textContent === "Accept").click();
	const fx = F.leagueMatch, I = lg.intl;
	return { club, name: window.__onlyName, said, only: I.only, nat: I.nat, intl: !!(fx && fx.intl), round: lg.round, played: lg.results.filter(r => r && r.length).length, news: /full-time/.test(lg.news), career: lg.career.clubs.join("|"), ov: document.querySelector("#lgNext").textContent };
});
check("accepting a national job: the card says you leave the club, and you are unattached from it", only.said.includes(`leave ${only.club} to manage ${only.name} full-time`) && only.only && only.nat === only.nat && /national team/.test(only.career) && only.news, JSON.stringify(only));
check("in country-only mode the next fixture is the international and the league matchdays before it were simulated; the Overview shows the country and the competition", only.intl && only.round >= 9 && only.played >= 9 && /Italy|International break|qualifier/i.test(only.ov), JSON.stringify(only));
const tabs = {};
for (const k of [ "transfers", "club", "squad" ]) {
	await showTab(page, k);
	tabs[k] = await page.evaluate(k => { const n = document.getElementById({ transfers: "transfersNoClub", club: "clubNoClub", squad: "sqNoClub" }[k]); const box = document.getElementById({ transfers: "transfersBox", club: "assistCard", squad: "sqBox" }[k]); return { note: !n.hidden && new RegExp(`You manage ${window.__onlyName}\\. No club duties`).test(n.textContent), hid: box.hidden, intl: k !== "squad" || !document.getElementById("intlSquad").hidden }; }, k);
}
check("Transfers, Club and Squad show the no-club note instead of club tools (the Squad tab keeps the national squad)", Object.values(tabs).every(x => x.note && x.hid && x.intl), JSON.stringify(tabs));
const own = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, pl = F.intlCallUp(lg).xi[3].pl, nm = pl.name, cnt = () => F.intlCallUp(lg).xi.filter(e => e.pl.name === nm).length, before = cnt(), box = document.getElementById("intlSquad");
	const li = [ ...box.querySelectorAll(".intl-selist li") ].find(x => x.textContent.includes(nm)), btn = li && li.querySelector("button");
	btn && btn.click();
	return { btn: !!btn, nm, left: cnt() < before, inj: pl.inj };
});
check("any player of your nationality can be left out of the national squad", own.btn && own.left, JSON.stringify(own));
const sim = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, season = lg.season;
	F.simSeasonAllTest();
	return { done: F.league.round >= F.league.fixtures.length, rec: F.league.intl.record.length, nat: F.league.intl.nat, only: F.league.intl.only, same: F.league.season === season };
});
check("simulate whole season works in country mode: the league ends and your internationals were played", sim.done && sim.rec >= 1 && sim.nat === only.nat && sim.only && sim.same, JSON.stringify(sim));
// Squad selection: a call-up of 23 with position, rating, club, form and fitness; only those called up can play.
await showTab(page, "squad");
const cu = await page.evaluate(() => {
	const F = window.__ff, box = document.getElementById("intlSquad"), I = F.league.intl;
	document.getElementById("intlAuto").click();
	const rows = () => [ ...box.querySelectorAll(".intl-selist li") ];
	const head = box.querySelector(".intl-sel .eyebrow").textContent, first = rows()[0].textContent, n0 = F.intlCalled(F.league).length;
	const playing = () => new Set([ ...F.intlCallUp(F.league).xi, ...F.intlCallUp(F.league).bench ].map(e => e.pl.name));
	const victim = F.intlCalled(F.league).find(n => F.intlCallUp(F.league).xi.some(e => e.pl.name === n && !e.gen));
	rows().find(r => r.textContent.includes(victim)).querySelector("button").click();
	const out = !playing().has(victim), n1 = F.intlCalled(F.league).length, sel = I.sel.length;
	rows().find(r => r.textContent.includes(victim)).querySelector("button").click();
	return { head, first, n0, victim, out, n1, sel, back: F.intlCalled(F.league).includes(victim), total: rows().length };
});
check("Squad selection lists the eligible players with position, rating, club, form and fitness; the manager drops and calls up, max 23, and a player dropped cannot play", /called up/.test(cu.head) && /form/.test(cu.first) && /fit \d+%/.test(cu.first) && cu.n0 <= 23 && cu.n0 >= 11 && cu.out && cu.n1 === cu.n0 - 1 && cu.back, JSON.stringify(cu));
// The bar's button is the one next step on every tab, and never starts a club match.
await page.evaluate(() => { window.__ff.simSeasonAllTest(); });
const tabBtn = {};
for (const t of [ "overview", "squad", "league", "cups" ]) {
	await showTab(page, t); await page.waitForTimeout(300);
	tabBtn[t] = await page.evaluate(() => { const b = document.getElementById("restartBtn"), r = b.getBoundingClientRect(); return { label: b.textContent, vis: !b.hidden && r.width > 0, s: window.__ff.league.season }; });
}
check("country only, season complete: the bar button reads Start season N+1 on Overview, Squad, League and Cups", Object.values(tabBtn).every(x => x.vis && x.label === `Start season ${x.s + 1}`), JSON.stringify(tabBtn));
await page.evaluate(() => document.getElementById("restartBtn").click());
const nb = await page.evaluate(() => { const F = window.__ff; return { s: F.league.season, label: document.getElementById("restartBtn").textContent, intl: !!(F.leagueMatch && F.leagueMatch.intl), round: F.league.round }; });
await page.waitForTimeout(300);
const nb2 = await page.evaluate(() => ({ label: document.getElementById("restartBtn").textContent }));
check("country only: the bar button rolls the season over and leads to an international, never a club match", nb.s === tabBtn.squad.s + 1 && (nb.intl || nb.round >= 9) && /Restart match|Next international/.test(nb2.label), JSON.stringify({ nb, nb2 }));
// The user's bug: at "Season N complete" the START SEASON N+1 button did nothing (country only).
const btnRoll = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, s0 = lg.season;
	F.simSeasonAllTest();
	lg.intl.lastNote = "Spain won the European Nations Cup."; lg.intl.titles = (lg.intl.titles || 0) + 1;
	F.renderLeague();
	return { s0, done: F.league.round >= F.league.fixtures.length };
});
await page.evaluate(() => { const F = window.__ff; F.newMatchTest(); document.getElementById("ovButton").click(); });   // first press: the "complete" card
const btnRoll2 = await page.evaluate(() => { const b = document.getElementById("ovButton"); return { label: b.textContent, shown: !document.getElementById("overlay").hidden, season: window.__ff.league.season }; });
await page.evaluate(() => document.getElementById("ovButton").click());
const btnRoll3 = await page.evaluate(() => { const F = window.__ff, lg = F.league; return { season: lg.season, only: lg.intl.only, nat: lg.intl.nat, round: lg.round, intl: !!(F.leagueMatch && F.leagueMatch.intl) }; });
check("country only: clicking Start season N+1 at season complete rolls over and leads to the next international", btnRoll.done && btnRoll3.season === btnRoll.s0 + 1 && btnRoll3.only && btnRoll3.nat === only.nat && (btnRoll3.intl || btnRoll3.round >= 9), JSON.stringify({ btnRoll, btnRoll2, btnRoll3 }));
const roll = await page.evaluate(() => {
	const F = window.__ff; F.nextSeasonTest();
	const lg = F.league;
	return { season: lg.season, nat: lg.intl.nat, only: lg.intl.only, round: lg.round, intl: !!(F.leagueMatch && F.leagueMatch.intl), comp: !F.intlComp(lg).none };
});
check("season rollover keeps the country job, draws the next competition and runs to the first international", roll.nat === only.nat && roll.only && roll.comp && (roll.intl || roll.round >= 9), JSON.stringify(roll));
const take = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, id = lg.members.find(i => i !== 0);
	lg.jobOffers = [ { id, kind: "home", str: 3, budget: 4, below: false, season: lg.season } ]; F.renderLeague();
	const li = [ ...document.querySelectorAll("#jobOffers li") ].find(x => /JOB/.test(x.querySelector(".pos").textContent));
	[ ...li.querySelectorAll("button") ].find(b => b.textContent === "Take the job").click();
	const ask = [ ...document.querySelectorAll("#jobOffers li") ].find(x => /can't manage a club and a country/.test(x.textContent)), still = lg.intl.nat;
	[ ...ask.querySelectorAll("button") ].find(b => b.textContent === "Take the club job").click();
	F.renderLeague();
	return { still, nat: lg.intl.nat, only: lg.intl.only, club: F.YOU.name === F.TEAMS[id].name, tabs: !document.getElementById("sqBox").hidden && document.getElementById("sqNoClub").hidden };
});
check("taking a club offer while you manage a country asks once, then ends the national job and puts you back in club mode", take.still === only.nat && take.nat === null && !take.only && take.tabs, JSON.stringify(take));
const leg = await page.evaluate(() => {
	const F = window.__ff, out = {};
	for (const keepCountry of [ false, true ]) {
		const lg = F.league; lg.jobOffers = []; lg.intl.nat = "NED"; lg.intl.only = false;
		F.ensureClub(lg); F.renderLeague();
		const card = [ ...document.querySelectorAll("#jobOffers li") ].find(x => /can't manage both/.test(x.textContent)), seen = !!card;
		document.getElementById(keepCountry ? "intlKeepCountry" : "intlKeepClub").click();
		out[keepCountry ? "country" : "club"] = { seen, nat: F.league.intl.nat, only: F.league.intl.only, cardGone: ![ ...document.querySelectorAll("#jobOffers li") ].some(x => /can't manage both/.test(x.textContent)) };
	}
	return out;
});
check("an old save holding both jobs shows the choice card; keeping the club ends the national job, keeping the country leaves the club", leg.club.seen && leg.club.nat === null && !leg.club.only && leg.club.cardGone && leg.country.seen && leg.country.nat === "NED" && leg.country.only && leg.country.cardGone, JSON.stringify(leg));

// No real names: every national manager's name comes from the game's own name tables.
const mg = await page.evaluate(() => {
	const F = window.__ff, { FIRST, SURNAMES } = F.nameTables;
	return Object.keys(F.NATIONS).map(n => F.intlManager(n)).filter(m => { const [ a, ...b ] = m.split(" "); return !FIRST.includes(a) || !SURNAMES.includes(b.join(" ")); });
});
check("every national manager's name is generated from the name tables", mg.length === 0, JSON.stringify(mg));

// An option file's nations section: checked like a club's fields, then the country wears it.
const of = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const r = F.readOptionFile(JSON.stringify({ kind: "floodlit-option-file", version: 2, nations: { ITA: { color: "#123456", ground: "Test Arena" }, XXX: { color: "#111111" }, BRA: { color: "red" } } }), lg);
	if (r.error) { return { error: r.error }; }
	F.applyOptionFile(lg, r, "now", false);
	const id = F.nationIdent("ITA"), sq = F.nationSquad("ITA", lg), out = F.buildOptionFile(lg);
	return { n: r.sum.nations, unknown: r.sum.unknown, bad: r.sum.bad, color: id.color, ground: id.ground, cached: sq.ident.color, file: out.nations && out.nations.ITA, preview: F.previewText(r.sum).join(" ") };
});
check("an option file can set a country's kit and ground; unknown countries and bad colours are skipped", of.n === 1 && of.unknown === 1 && of.bad === 1 && of.color === "#123456" && of.ground === "Test Arena" && of.cached === "#123456" && of.file && of.file.ground === "Test Arena" && /national team/.test(of.preview), JSON.stringify(of));

// Phones: the International cards fit.
await page.evaluate(() => { const F = window.__ff, lg = F.league; lg.intl.offers = [ { nat: "NED", str: 3, season: lg.season } ]; F.acceptIntl("NED"); F.renderLeague(); });
await page.setViewportSize({ width: 390, height: 844 });
await showTab(page, "cups");
const ph1 = await page.evaluate(() => { const c = document.querySelector(".lg-intl"); return { sw: c.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth <= window.innerWidth }; });
await showTab(page, "squad");
const ph2 = await page.evaluate(() => { const c = document.getElementById("intlSquad"); return { shown: !c.hidden, sw: c.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth <= window.innerWidth }; });
check("the International cards fit a phone screen", ph1.sw <= ph1.cw + 1 && ph1.doc && ph2.shown && ph2.sw <= ph2.cw + 1 && ph2.doc, JSON.stringify({ ph1, ph2 }));

check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
