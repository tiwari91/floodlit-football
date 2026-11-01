// Run: node tests/loans.mjs   (loans out and in: 18o-loans.js)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8830), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const tab = name => page.evaluate(n => { const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => x.textContent.trim().toLowerCase().startsWith(n)); t.click(); }, name);

// A youngster on the bench goes out on loan, from his card on the Squad tab.
const young = await page.evaluate(() => { const F = window.__ff, c = F.league.club, pl = c.bench[0]; pl.age = 20; pl.pot = Math.max(pl.pot || 70, 85); F.renderLeagueTest(); return { name: pl.name, sum: pl.pac + pl.sho + pl.pas + pl.def, budget: c.budget }; });
await tab("squad"); await page.waitForTimeout(200);
await page.evaluate(n => { const row = [ ...document.querySelectorAll("tr") ].find(r => r.textContent.includes(n) && r.querySelector("button")); [ ...row.querySelectorAll("button") ].find(b => /⋯/.test(b.textContent)).click(); }, young.name);
await page.waitForTimeout(200);
const hasBtn = await page.evaluate(() => [ ...document.querySelectorAll(".pl-detail button") ].some(b => /Loan out for the season/.test(b.textContent)));
check("a player of 23 or under has a Loan out button on his card while the window is open", hasBtn);
await page.evaluate(() => [ ...document.querySelectorAll(".pl-detail button") ].find(b => /Loan out for the season/.test(b.textContent)).click());
await page.waitForTimeout(300);
const out = await page.evaluate(n => { const c = window.__ff.league.club; return { inSquad: [ ...c.squad, ...c.bench ].some(p => p.name === n), loaned: (c.loanedOut || []).map(L => L.pl.name), squad: c.squad.length, budget: c.budget }; }, young.name);
check("he leaves the squad and is listed as out on loan; the eleven stays full", !out.inSquad && out.loaned.includes(young.name) && out.squad === 11, JSON.stringify(out));

// A player on the market comes in on loan: a fee of a tenth of his value, onto the bench.
await tab("transfers"); await page.waitForTimeout(200);
const noteOut = await page.evaluate(() => document.getElementById("winNote").textContent);
check("the transfer window lists who is out on loan", new RegExp(`Out on loan: ${young.name}`).test(noteOut), noteOut.slice(-200));
const loanIn = await page.evaluate(() => {
	const c = window.__ff.league.club; while (c.bench.length >= 7) { c.bench.pop(); }
	window.__ff.renderLeagueTest();
	const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Transfers/i.test(x.textContent.trim())); t.click();
	const b = [ ...document.querySelectorAll("#winMarket button") ].find(x => /^Loan £/.test(x.textContent) && !x.disabled);
	if (!b) { return { none: true }; }
	const li = b.closest("li"), who = li.querySelector(".who").textContent.split(" · ")[0], before = c.budget;
	b.click();
	const pl = c.bench.find(p => p.name === who);
	return { who, joined: !!pl, loan: pl && pl.loan, spent: Math.round((before - c.budget) * 1000) / 1000 };
});
check("Loan joins the bench, flagged as a loan for this season, for a small fee", loanIn.joined && loanIn.loan && loanIn.loan.season >= 1 && loanIn.spent > 0 && loanIn.spent < 1, JSON.stringify(loanIn));

// The summer: the loan in goes back, the loan out comes home better.
const summer = await page.evaluate(([ n, sum0, inName ]) => {
	const F = window.__ff; F.simSeasonAllTest(); F.nextSeasonTest();
	const L = F.league, c = L.club, all = [ ...c.squad, ...c.bench ], back = all.find(p => p.name === n);
	return { season: L.season, backOnBench: !!back, better: back ? back.pac + back.sho + back.pas + back.def - sum0 : null, loanInGone: !all.some(p => p.name === inName), stillOut: (c.loanedOut || []).length, news: L.news };
}, [ young.name, young.sum, loanIn.who ]);
check("next summer the loan in goes back to his club", summer.season === 2 && summer.loanInGone, JSON.stringify(summer).slice(0, 300));
check("and the youngster comes home improved, onto the bench", summer.backOnBench && summer.better > 0 && summer.stillOut === 0 && /Back from loan and better for it/.test(summer.news), JSON.stringify(summer).slice(0, 400));

check("loans: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
