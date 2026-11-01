// Run: node tests/abroad.mjs   (the transfer search reaches every league abroad: 18q-search-abroad.js)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8836), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
const boot = async () => { await page.waitForSelector("#ovButton"); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 }); };
await page.goto(URL); await boot();
// Open the transfers tab on "Any player, any club" and search with a club filter.
const search = (club, name = "") => page.evaluate(async ([ cl, nm ]) => {
	const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Transfers/i.test(x.textContent.trim())); t.click();
	const tabBtn = [ ...document.querySelectorAll("#mkTabs button") ].find(b => /any club/i.test(b.textContent)); if (tabBtn) { tabBtn.click(); }
	await new Promise(r => setTimeout(r, 200));
	const sel = document.getElementById("mkqClub"); sel.value = cl; document.getElementById("mkqName").value = nm;
	document.getElementById("mkqGo").click(); await new Promise(r => setTimeout(r, 300));
	const rows = [ ...document.querySelectorAll("#winMarket li") ].filter(li => li.querySelector(".bids"));
	return { groups: [ ...document.getElementById("mkqClub").querySelectorAll("optgroup") ].map(g => g.label), rows: rows.map(li => li.textContent.replace(/\s+/g, " ").slice(0, 200)), value: document.getElementById("mkqClub").value };
}, [ club, name ]);

const es = await search("n:ESP");
check("the club list has a group for every country abroad, Spain among them", es.groups.some(g => /^Abroad: Spain/.test(g)) && es.groups.filter(g => /^Abroad:/.test(g)).length >= 15, JSON.stringify(es.groups.slice(0, 6)));
check("Spain · every club finds players at Spanish clubs, marked as abroad", es.value === "n:ESP" && es.rows.length > 0 && es.rows.every(r => /Abroad: Spain/.test(r)), JSON.stringify(es.rows.slice(0, 2)));
const br = await search("n:BRA");
check("a Brazilian club's player is marked as needing a work permit", br.rows.length > 0 && br.rows.every(r => /Abroad: Brazil · work permit needed/.test(r)), JSON.stringify(br.rows.slice(0, 1)));

// Buy one from Spain at the asking price: he joins your squad, from his club, and leaves the search.
await page.evaluate(() => { const c = window.__ff.league.club; c.budget = 60; [ ...c.squad, ...c.bench ].forEach(p => { p.nat = "ENG"; }); });   // enough money, and room under the homegrown rule (18n), before the list is drawn
await search("n:ESP");
const buy = await page.evaluate(async () => {
	const F = window.__ff, c = F.league.club;
	const li = [ ...document.querySelectorAll("#winMarket li") ].find(x => x.querySelector(".bids") && /Abroad: Spain/.test(x.textContent));
	const who = li.querySelector(".who").textContent.split(" · ")[0];
	li.querySelector(".bids button").click(); await new Promise(r => setTimeout(r, 300));
	return { who, signed: [ ...c.squad, ...c.bench ].some(p => p.name === who), note: document.getElementById("winNote").textContent.slice(0, 160) };
});
check("a bid at the asking price signs him from Spain", buy.signed, JSON.stringify(buy));
const again = await search("n:ESP", buy.who);
check("once he's yours he no longer shows in the search", again.rows.length === 0, JSON.stringify(again.rows.slice(0, 1)));

// A league file that names a Spanish club and one of its players: the search uses them as they are.
await page.evaluate(() => {
	localStorage.setItem("ff-leaguefile", JSON.stringify({ leagues: { ESP: { clubs: [ { name: "Club Prueba", slot: 1, players: [ { slot: 9, name: "Q. Pruebador", nat: "ESP" } ] } ] } }, cup: {} }));
});
await page.reload(); await boot();
const lf = await search("a:ESP:1");
const opts = await page.evaluate(() => [ ...document.querySelectorAll("#mkqClub option") ].map(o => o.textContent));
check("a league file's Spanish club is in the club list by its own name", opts.includes("Club Prueba"), JSON.stringify(opts.filter(o => /Prueba|Spain/.test(o))));
check("and its player is found there by his own name", lf.rows.some(r => /Q\. Pruebador/.test(r) && /Club Prueba/.test(r)), JSON.stringify(lf.rows.slice(0, 3)));

check("search abroad: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
