// Run: node tests/europe.mjs   (three European competitions and who goes into each: 18f)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8824), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });

// A finished season with the table in a chosen order (each club beats every club below it), the two cup
// winners chosen, and qualification run. Returns who went where.
const qualify = (yourPos, challWinnerPos, cupWinnerPos) => page.evaluate(([ yp, cw, lw ]) => {
	const F = window.__ff, lg = F.league;
	const others = lg.members.filter(i => i !== 0), order = others.slice(0, yp - 1).concat([ 0 ], others.slice(yp - 1));
	const games = [];
	for (let i = 0; i < order.length; i++) { for (let j = i + 1; j < order.length; j++) { games.push([ order[i], order[j], 1, 0 ]); } }
	lg.results = [ games ]; lg.round = lg.fixtures.length;
	lg.chall = { v: 1, season: lg.season, alive: [], below: [], rounds: [], out: null, winner: order[cw - 1] };
	lg.cup = { v: 1, season: lg.season, alive: [], rounds: [], out: null, winner: order[lw - 1] };
	lg.club.contQual = null;
	F.contQualify();
	const q = lg.club.contQual, pos = id => order.indexOf(id) + 1;
	return { tier: q.tier, ids: q.ids.map(pos), season: q.season, news: lg.news.slice(-400) };
}, [ yourPos, challWinnerPos, cupWinnerPos ]);

let r = await qualify(3, 10, 12);
check("top four: you're in the Continental Champions Cup with the other three", r.tier === 1 && JSON.stringify(r.ids) === "[1,2,3,4]", JSON.stringify(r));
r = await qualify(5, 10, 12);
check("fifth: the Continental League, with the Challenge Cup winners (10th)", r.tier === 2 && JSON.stringify(r.ids) === "[5,10]", JSON.stringify(r));
r = await qualify(6, 10, 12);
check("sixth: the Continental Conference, with the League Cup winners (12th)", r.tier === 3 && JSON.stringify(r.ids) === "[6,12]", JSON.stringify(r));
r = await qualify(14, 14, 12);
check("winning the Challenge Cup from 14th puts you in the Continental League", r.tier === 2 && JSON.stringify(r.ids) === "[5,14]", JSON.stringify(r));
r = await qualify(6, 2, 12);
check("Challenge Cup winners already in the top four: their place goes down the table, to sixth", r.tier === 2 && JSON.stringify(r.ids) === "[5,6]", JSON.stringify(r));
r = await qualify(7, 2, 3);
check("both cup winners already qualified: the places go to fifth, sixth and seventh", r.tier === 3 && JSON.stringify(r.ids) === "[7,8]", JSON.stringify(r));
check("the news lists all three competitions", /Continental Champions Cup: .*Continental League: .*Continental Conference: /.test(r.news), r.news);

// The draw for a lower tier: same format, weaker clubs from abroad, and its own name on the Cups tab.
const draw = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const avgAbroad = C => { const f = C.clubs.filter(c => c.id === undefined); return f.reduce((t, c) => t + c.str, 0) / f.length; };
	const s = lg.season, mk = tier => { lg.season = s; lg.round = 0; delete lg.cont; lg.club.contQual = { season: s, ids: [ 0, lg.members[5] ], tier }; return F.ensureCont(lg); };
	const c1 = mk(1), a1 = avgAbroad(c1), c3 = mk(3), a3 = avgAbroad(c3), c2 = mk(2), a2 = avgAbroad(c2);
	F.renderLeagueTest();
	const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Cups/i.test(x.textContent.trim())); t.click();
	const card = document.querySelector(".lg-cont");
	return { tier: c2.tier, clubs: c2.clubs.length, groups: c2.groups.length, a1: +a1.toFixed(2), a2: +a2.toFixed(2), a3: +a3.toFixed(2), title: card ? card.querySelector("h4").textContent : "" };
});
check("a Continental League draw: thirty-two clubs in eight groups, as the Champions Cup", draw.tier === 2 && draw.clubs === 32 && draw.groups === 8, JSON.stringify(draw));
check("clubs from abroad are weaker the lower the tier", draw.a1 > draw.a2 && draw.a2 > draw.a3, JSON.stringify(draw));
check("the Cups tab names the competition you're in", /Continental League/.test(draw.title), draw.title);

// Prize money: a share of the Champions Cup's.
const pay = await page.evaluate(() => { const F = window.__ff, lg = F.league, C = lg.cont, before = lg.club.budget; F.contSimAll && F.contSimAll(); return { earned: C.earned || 0, tier: C.tier }; });
check("a lower tier pays prize money too", pay.earned > 0, JSON.stringify(pay));

check("Europe: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
