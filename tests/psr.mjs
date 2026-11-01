// Run: node tests/psr.mjs   (owner investment each summer and the spending rules: 18l-owner-and-psr.js)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8818), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const openTransfers = () => page.evaluate(() => { const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Transfers/i.test(x.textContent.trim())); t.click(); });

// A new career: the owner's offer is in the transfer window's box.
await openTransfers(); await page.waitForTimeout(300);
const offer = await page.evaluate(() => ({ text: (document.getElementById("ownerBox") || {}).textContent || "", amt: window.__ff.league.ownerOffer, budget: window.__ff.league.club.budget }));
check("in the summer the owner offers money, shown under the window's note", offer.amt > 0 && /The owner offers £\d/.test(offer.text) && /Spending rules: no losses/.test(offer.text), JSON.stringify(offer));

// Take it: the budget grows and the money is booked as the owner's, not as a profit.
await page.click("#ownerBox .owner-acts button:first-child"); await page.waitForTimeout(300);
const took = await page.evaluate(() => { const c = window.__ff.league.club; return { budget: c.budget, owner: c.psr.owner, offer: window.__ff.league.ownerOffer, box: document.getElementById("ownerBox").textContent }; });
check("taking it adds it to the budget and books it as the owner's money", Math.abs(took.budget - offer.budget - offer.amt) < 0.11 && Math.abs(took.owner - offer.amt) < 0.11 && !took.offer && !/The owner offers/.test(took.box), JSON.stringify(took));
check("owner money is not counted as a loss or a profit", /Spending rules: no losses/.test(took.box), took.box);

// Two loss-making seasons on the books and a third spent hard: over £105m, so points come off next season.
const after = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	c.psr.seasons = [ -2, -2 ];
	c.psr.start = c.budget + 12;   // this season: far more spent than a season earns (a season earns about £100m)
	F.simSeasonAllTest(); F.nextSeasonTest();
	const L = F.league;
	return { season: L.season, deduct: L.deduct || 0, news: L.news, seasons: L.club.psr.seasons, offer: L.ownerOffer };
});
check("over the limit: the next season starts with points taken off and the news says why", after.season === 2 && after.deduct >= 4 && after.deduct <= 10 && /taken \d+ points off you for breaking the spending rules/.test(after.news), JSON.stringify(after));
check("the breach is punished once: the three-season count starts again", after.seasons.length === 0, JSON.stringify(after.seasons));
check("a new summer brings a new offer from the owner", after.offer > 0, JSON.stringify(after));

const table = await page.evaluate(() => { const F = window.__ff; F.renderLeagueTest(); const name = F.TEAMS[0].name; const me = [ ...document.querySelectorAll("tr, li") ].filter(r => r.textContent.includes(name)).map(r => r.textContent.replace(/\s+/g, " ")).find(t => /-\d/.test(t)); return me || ""; });
check("in the table your club starts below zero", /-\d/.test(table), table);

// Within the limit: no deduction.
const fine = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	c.psr.seasons = [ -0.5, 0.3 ]; c.psr.start = c.budget + 0.5; c.psr.owner = 0;
	F.simSeasonAllTest(); F.nextSeasonTest();
	return { season: F.league.season, deduct: F.league.deduct || 0 };
});
check("losses inside the limit cost nothing", fine.season === 3 && fine.deduct === 0, JSON.stringify(fine));

check("owner and spending rules: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
