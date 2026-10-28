// Run: node tests/happy.mjs   (player happiness: final-year renewals, "wants out", transfer requests, listing)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8801), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });

// A happy final-year player renews; an unhappy one refuses, is marked and gets a notice.
const r = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg); d.issues = []; c.budget = 30;
	const [ a, b ] = c.bench.filter(p => p.pos !== "gk");
	for (const p of [ a, b ]) { p.contract = 1; p.age = 26; p.wantsOut = false; p.leaving = ""; p.benched = 0; }
	a.morale = 80; b.morale = 30;
	F.finalYearReview(c);
	const deal = F.renewDeal(a, c), no = F.renewDeal(b, c);
	const notice = d.issues.find(i => i.kind === "contract" && i.name === b.name);
	F.showTab && 0;
	return { aLeaving: a.leaving, bLeaving: b.leaving, ok: deal.ok, aContract: a.contract, no: no.ok, why: no.why, notice: notice && notice.text, wants: notice && notice.wantsOut };
});
check("a happy final-year player renews", r.ok && r.aContract > 1 && !r.aLeaving, JSON.stringify(r));
check("an unhappy one refuses, with a 'wants to leave' notice", !r.no && !!r.bLeaving && /leave/.test(r.notice || "") && r.wants, JSON.stringify(r));

// The squad table marks him; the summer rollover lets him go.
const sq = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, p = c.bench.find(x => x.leaving);
	F.renderLeague && F.renderLeague();
	const marked = [ ...document.querySelectorAll(".wants-out") ].length;
	p.morale = 30; const gone = F.rolloverClub(c);
	return { marked, gone: gone.includes(p.name) };
});
check("the squad tab marks him and he leaves at the end of the season", sq.marked > 0 && sq.gone, JSON.stringify(sq));

// Sustained unhappiness: a transfer request; accept lists him and draws a bid; refuse costs morale.
const q = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg), out = {};
	const [ a, b ] = c.bench.filter(p => p.pos !== "gk");
	for (const p of [ a, b ]) { p.contract = 4; p.age = 27; p.wantsOut = false; p.listed = false; p.leaving = ""; p.morale = 20; p.unhappy = 0; p.benched = 0; }
	d.issues = [];
	for (let i = 0; i < 4; i++) { a.morale = 20; b.morale = 20; F.dramaAfterMatch(new Set([ ...c.squad, ...c.bench ].filter(p => p !== a && p !== b).map(p => p.name)), 0, 0, () => 1); }
	const ia = d.issues.find(i => i.kind === "request" && i.name === a.name), ib = d.issues.find(i => i.kind === "request" && i.name === b.name);
	out.req = !!ia && a.wantsOut;
	if (ia) { F.resolveIssue(ia.id, "accept"); }
	out.listed = a.listed;
	if (ib) { b.morale = 50; F.resolveIssue(ib.id, "refuse"); out.refused = b.morale; out.still = b.wantsOut; }
	lg.bidsIn = []; F.windowEvents("test");
	out.bid = lg.bidsIn.some(x => x.name === a.name);
	return out;
});
check("weeks of low morale make a transfer request", q.req, JSON.stringify(q));
check("accepting lists him and a club bids", q.listed && q.bid, JSON.stringify(q));
check("refusing costs morale and he stays", q.refused < 50 && q.still === false, JSON.stringify(q));

// Old saves: players without the new fields still work.
const old = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club; for (const p of [ ...c.squad, ...c.bench ]) { delete p.leaving; delete p.unhappy; }
	F.ensureDrama(F.league); F.dramaAfterMatch(new Set(), 0, 0, () => 1); return [ ...c.squad, ...c.bench ].every(p => typeof p.leaving === "string" && Number.isFinite(p.unhappy));
});
check("old saves load with the new fields filled in", old);
check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
