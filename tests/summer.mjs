// Run: node tests/summer.mjs   The summer finals: in a finals season the breaks are friendlies and the tournament follows the league.
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8841), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(URL); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.intlComp, null, { timeout: 60000 });

// Season 2 is the World Championship: a club manager with no country. The Overview says when it starts.
const club = await page.evaluate(() => {
	const F = window.__ff;
	F.league.round = F.league.fixtures.length; F.nextSeasonTest();
	const L = F.league, C = F.intlComp(L), R = L.fixtures.length;
	L.round = 9; F.renderLeague();
	const ov = F.intlNext(L), card = document.querySelector("#lgExtras .lg-intl .detail").textContent;
	L.round = 30; F.intlNight();
	const early = { night: C.night, played: C.games.filter(g => g.hg !== undefined).length };
	L.round = R; F.intlNight();
	const held = { night: C.night, played: C.games.filter(g => g.hg !== undefined).length };
	F.renderLeague();
	const next = document.getElementById("lgNext").textContent;
	const day = document.getElementById("sumDay"), all = document.getElementById("sumAll");
	day && day.click();
	return { season: L.season, tour: C.tour, summer: C.summer === true, nights: [ ...new Set(C.nights.map(n => n.r)) ].join(), ov, card, early, held, next, hasBtns: !!(day && all), afterDay: C.night, pending: !!F.intlSummer(F.league) };
});
check("a finals season draws a summer tournament: every day is after the last league matchday", club.season === 2 && club.tour === "wc" && club.summer && club.nights === "38", JSON.stringify(club));
check("the Overview line says when it starts", /^After the league season: World Championship finals/.test(club.ov) && club.card === club.ov, JSON.stringify(club));
check("nothing is played at the breaks; after matchday 38 the card says the tournament is on, held for the player", club.early.night === 0 && club.early.played === 0 && club.held.night === 0 && club.held.played === 0 && /World Championship is on/.test(club.next) && /Group [A-D]: /.test(club.next) && club.hasBtns, JSON.stringify(club));
check("Follow plays one day of the tournament", club.afterDay === 1 && club.pending, JSON.stringify(club));
const fin = await page.evaluate(() => {
	const F = window.__ff, L = F.league, C = F.intlComp(L), s0 = L.season;
	F.renderLeague();
	const cups = document.querySelector("#lgExtras .lg-intl").textContent;
	F.newMatchTest();
	document.getElementById("ovButton").click();   // Start season N+1: plays out what is left first
	return { s0, done: C.done, winner: !!C.winner, season: F.league.season, cups: /summer finals/.test(cups), tables: C.groups.every((_, gi) => F.intlGroupTable(C, gi).every(r => r.p === 3)) };
});
check("starting the next season plays out the rest of the tournament first (a winner, a full table), then rolls over", fin.done && fin.winner && fin.tables && fin.season === fin.s0 + 1 && fin.cups, JSON.stringify(fin));

// Simulate button, then the rollover.
const sim = await page.evaluate(() => {
	const F = window.__ff, L0 = F.league;
	const q = F.intlComp(L0);   // season 3: qualifiers, nothing in the summer
	F.league.round = F.league.fixtures.length; F.nextSeasonTest();   // season 4: the European Nations Cup
	const L = F.league, C = F.intlComp(L);
	L.round = L.fixtures.length; F.intlNight(); F.renderLeague();
	document.getElementById("sumAll").click();
	return { q: q.kind, tour: C.tour, summer: C.summer === true, done: C.done, winner: !!C.winner, sumGone: !document.getElementById("sumAll") };
});
check("the European Nations Cup is a summer event too, and Simulate runs it to a winner", sim.q === "q" && sim.tour === "eu" && sim.summer && sim.done && sim.winner && sim.sumGone, JSON.stringify(sim));

// Country only, season 6 (a World Championship): friendlies at the breaks, the call-up, then the games on the match screen, then Start season 7.
const co = await page.evaluate(() => {
	const F = window.__ff;
	F.league.round = F.league.fixtures.length; F.nextSeasonTest();   // 5
	F.league.round = F.league.fixtures.length; F.nextSeasonTest();   // 6
	const L = F.league, C = F.intlComp(L), nat = C.teams[0];
	L.jobOffers = []; L.intl.nat = null; L.intl.offers = [ { nat, str: 3, season: L.season } ];
	F.acceptIntl(nat);
	const out = { season: L.season, tour: C.tour, nat, friendlies: 0, comp: 0 };
	let guard = 0;
	while (F.leagueMatch && F.leagueMatch.intl && !F.intlSummer(L) && guard++ < 8) {
		if (F.leagueMatch.intl.fr) { out.friendlies++; } else { out.comp++; }
		F.simulateMineTest(); F.newMatchTest();
	}
	out.round = L.round; out.night = C.night; out.summerFixture = !!(F.leagueMatch && F.leagueMatch.intl && !F.leagueMatch.intl.fr);
	out.callup = F.intlCallupDue(L);
	return out;
});
check("in a finals season the breaks offer only friendlies (country only)", co.tour === "wc" && co.friendlies === 3 && co.comp === 0 && co.night === 0, JSON.stringify(co));
const co2 = await page.evaluate(() => {
	const F = window.__ff, L = F.league, C = F.intlComp(L), s0 = L.season;
	const r = { round: L.round, R: L.fixtures.length, callup: F.intlCallupDue(L), blocked: F.intlSummerBlocked(L), label0: "" };
	document.getElementById("ovButton").click();   // first press: the 23-player call-up card
	r.card = document.getElementById("ovTitle") ? document.getElementById("ovTitle").textContent : "";
	r.btn = document.getElementById("ovButton").textContent; r.flag = C.callup === true; r.season1 = L.season;
	document.getElementById("restartBtn").click();   // "Next international": never a rollover before the final
	r.season2 = F.league.season; r.fix = !!(F.leagueMatch && F.leagueMatch.intl && !F.leagueMatch.intl.fr); r.lbl = F.leagueMatch && F.leagueMatch.label;
	let guard = 0; r.games = 0;
	while (F.intlSummer(L) && guard++ < 12) {
		F.newMatchTest();
		if (!(F.leagueMatch && F.leagueMatch.intl && !F.leagueMatch.intl.fr)) { r.stuck = true; break; }
		F.simulateMineTest(); r.games++;
		if (F.intlSummer(L)) { r.midSeason = F.league.season; }
	}
	r.done = C.done; r.winner = C.winner; r.btnEnd = document.getElementById("restartBtn").textContent;
	F.newMatchTest(); document.getElementById("ovButton").click();   // the complete card, Start season N+1
	r.next = F.league.season === s0 + 1; r.stillNat = F.league.intl.nat;
	return r;
});
check("country only: the call-up card comes before the first finals game", co2.callup && co2.blocked && co2.round === co2.R && /your squad/.test(co2.card) && co2.flag && co2.season1 === co2.season2, JSON.stringify(co2));
check("country only: your tournament games are real fixtures on the match screen, and the season does not roll over before the final", co2.fix && /World Championship/.test(co2.lbl) && co2.games >= 1 && !co2.stuck && (co2.midSeason === undefined || co2.midSeason === co2.season1), JSON.stringify(co2));
check("country only: the final done, the button reads Start season N+1 and rolls over with the job kept", co2.done && !!co2.winner && /Start season/.test(co2.btnEnd) && co2.next && !!co2.stillNat, JSON.stringify(co2));

// An old save in the middle of a finals season under the three-break schedule finishes the old way.
const old = await page.evaluate(() => {
	const F = window.__ff;
	F.league.intl.nat = null; F.league.intl.only = false;
	F.league.round = F.league.fixtures.length; F.nextSeasonTest();   // 8: Nations Cup finals (7 was the qualifiers)
	const L = F.league, C = F.intlComp(L);
	delete C.summer; C.nights.forEach((n, i) => { n.r = [ 9, 9, 20, 30, 30 ][i] || 30; });
	const raw = JSON.parse(JSON.stringify(L)); delete raw.intl.comp.summer;
	let err = ""; let C2 = null, text = "";
	try { L.intl = raw.intl; C2 = F.ensureIntl(L).comp; L.round = 20; text = F.intlNext(L); L.round = 9; F.intlNight(); const n9 = C2.night; L.round = 30; F.intlNight(); F.renderLeague(); return { err, kind: C2.kind, old: !C2.summer, text, n9, done: C2.done, winner: !!C2.winner, held: !!F.intlSummer(L) }; } catch (e) { err = e.message; }
	return { err };
});
check("an old mid-finals save loads and finishes its season over the breaks, no errors", !old.err && old.kind === "t" && old.old && old.n9 >= 1 && old.done && old.winner && !old.held && !/After the league season/.test(old.text), JSON.stringify(old));
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
