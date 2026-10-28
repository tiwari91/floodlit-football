// Run: node tests/euro.mjs   The European Nations Cup alternates with the World Championship; Europe only.
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8832), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(URL); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.intlComp, null, { timeout: 60000 });

// Season by season: play the breaks out and move on; note which competition each season holds.
const seasons = await page.evaluate(() => {
	const F = window.__ff, out = [];
	for (let k = 0; k < 6; k++) {
		const lg = F.league, C = F.intlComp(lg);
		const nats = C.kind === "q" ? C.groups.flat() : C.teams;
		lg.round = 30; F.intlNight();
		out.push({ season: lg.season, kind: C.kind, tour: C.tour, n: nats.length, allEurope: nats.every(n => [ "home", "europe" ].includes(F.NATIONS[n][1])), qn: C.qn, done: C.done, winner: C.winner || null, groups: C.groups.length, nights: C.nights.map(n => n.stage).join(), next: lg.intl.next ? lg.intl.next.nats.length : 0 });
		lg.round = lg.fixtures.length; F.nextSeasonTest();
	}
	return out;
});
const by = n => seasons.find(s => s.season === n);
check("season 1 qualifies for the World Championship: all 32 countries", by(1).kind === "q" && by(1).tour === "wc" && by(1).n === 32 && by(1).qn === 16, JSON.stringify(by(1)));
check("season 2 is the World Championship, 16 countries", by(2).kind === "t" && by(2).tour === "wc" && by(2).n === 16 && by(2).done && !!by(2).winner, JSON.stringify(by(2)));
check("season 3 is European qualifying: only the 16 European countries, in 4 groups, 8 go through", by(3).kind === "q" && by(3).tour === "eu" && by(3).n === 16 && by(3).allEurope && by(3).groups === 4 && by(3).qn === 8 && by(3).next === 8, JSON.stringify(by(3)));
check("season 4 is the European Nations Cup: 8 European countries, two groups, semi-finals and a final", by(4).kind === "t" && by(4).tour === "eu" && by(4).n === 8 && by(4).allEurope && by(4).groups === 2 && by(4).nights === "g,g,g,sf,f" && by(4).done && !!by(4).winner, JSON.stringify(by(4)));
check("season 5 qualifies for the World Championship again, and season 6 holds it", by(5).tour === "wc" && by(5).n === 32 && by(6).tour === "wc" && by(6).kind === "t" && by(6).n === 16, JSON.stringify([ by(5), by(6) ]));

// A non-European national job has no Euro: no fixtures, no missed tournament, and it says so.
const non = await page.evaluate(() => {
	const F = window.__ff;
	let guard = 0;
	while (F.intlComp(F.league).tour !== "eu" || F.intlComp(F.league).kind !== "q") { const lg = F.league; lg.round = lg.fixtures.length; F.nextSeasonTest(); if (guard++ > 6) { return { err: "never reached a European qualifying season" }; } }
	const lg = F.league, C = F.intlComp(lg);
	lg.intl.nat = "BRA"; lg.intl.missed = 1;
	lg.round = 9; F.intlNight();
	const fx = F.currentFixture(), text = F.intlNext(lg);
	lg.round = 30; F.intlNight();
	return { season: lg.season, tour: C.tour, brazilIn: C.groups.flat().includes("BRA"), fixture: !!(fx && fx.intl), text, missed: lg.intl.missed, job: lg.intl.nat, done: C.done };
});
check("a non-European national job gets no European qualifying: no fixture, a note, no missed tournament, the job stays", !non.err && !non.brazilIn && !non.fixture && /No European Nations Cup/.test(non.text) && non.missed === 1 && non.job === "BRA" && non.done, JSON.stringify(non));

// A European national job plays it.
const eu = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.round = lg.fixtures.length; F.nextSeasonTest();
	const L = F.league, T = F.intlComp(L);
	L.intl.nat = T.teams ? T.teams[0] : null;
	return { season: L.season, tour: T.tour, kind: T.kind, label: T.kind === "t" ? "" : "", news: /European Nations Cup/.test(L.news) };
});
check("the next season is the European Nations Cup finals and the news names it", eu.tour === "eu" && eu.kind === "t" && eu.news, JSON.stringify(eu));
const play = await page.evaluate(() => {
	const F = window.__ff, L = F.league, T = F.intlComp(L), me = T.teams[0];
	L.intl.nat = me; L.round = 9; F.intlNight();
	const fx = F.currentFixture();
	return { intl: !!(fx && fx.intl), label: fx && fx.label, text: F.intlNext(L) };
});
check("a European job's finals match is a real fixture, labelled with the competition", play.intl && /European Nations Cup, Group/.test(play.label), JSON.stringify(play));
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
