// Run: node tests/buyanyclub.mjs   Buy from any club: search every computer club, bid through the normal rules, the window.
import { launch, serve, tally, showTab } from "./_env.mjs";
const server = serve(8830), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(URL); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.showTab, null, { timeout: 60000 });
await showTab(page, "transfers");
const rows = () => page.evaluate(() => [ ...document.querySelectorAll("#winMarket li") ].map(li => li.textContent));
await page.evaluate(() => { const lg = window.__ff.league; lg.round = 0; lg.club.budget = 60; window.__ff.renderLeagueTest(); });
await page.click("#mkTabs button:last-child");
check("the transfers screen has an Any club search with its five filters", await page.evaluate(() => [ "mkqName", "mkqPos", "mkqMin", "mkqClub", "mkqMax", "mkqGo" ].every(id => !!document.getElementById(id))));
const all = await rows();
check("with no filter it lists players from other clubs, best first, with their club and a price", all.length > 5 && /£\d/.test(all[0]) && /OVR \d+/.test(all[0]), all[0]);

// Filters
await page.selectOption("#mkqPos", "gk"); await page.fill("#mkqMin", "60"); await page.click("#mkqGo");
const gks = await page.evaluate(() => [ ...document.querySelectorAll("#winMarket li .pos") ].map(e => e.textContent));
check("position and minimum rating narrow the list", gks.length > 0 && gks.every(p => p === "GK"), JSON.stringify(gks.slice(0, 5)));
await page.selectOption("#mkqPos", ""); await page.fill("#mkqMin", "0");
const club = await page.evaluate(() => { const o = [ ...document.querySelectorAll("#mkqClub option") ][3]; return { v: o.value, t: o.textContent }; });
await page.selectOption("#mkqClub", club.v); await page.click("#mkqGo");
const cl = await rows();
check("the club filter shows only that club's players", cl.length > 5 && cl.slice(0, -1).every(t => t.includes(club.t)), club.t);
await page.selectOption("#mkqClub", ""); await page.fill("#mkqMax", "0.5"); await page.click("#mkqGo");
const cheap = await page.evaluate(() => [ ...document.querySelectorAll("#winMarket .bids button:first-child") ].map(b => Number(b.textContent.replace(/[^0-9.]/g, "")) || 0));
check("the maximum price hides dearer players", cheap.every(p => p <= 0.5), JSON.stringify(cheap.slice(0, 5)));
await page.fill("#mkqMax", ""); await page.fill("#mkqName", "zzzzqq"); await page.click("#mkqGo");
check("a name that matches nobody says so", /Nobody matches/.test((await rows()).join("")));
await page.fill("#mkqName", "");

// Buy the best player at the asking price.
await page.click("#mkqGo");
const before = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club, li = document.querySelector("#winMarket li");
	const name = li.querySelector(".who").textContent.split(" · ")[0], club = li.querySelectorAll(".swap")[0].textContent;
	const id = Number([ ...document.querySelectorAll("#mkqClub option") ].find(o => o.textContent === club).value);
	return { name, club, id, budget: c.budget };
});
await page.click("#winMarket li .bids button:first-child");
const after = await page.evaluate(([ name, id ]) => {
	const F = window.__ff, c = F.league.club;
	return { mine: [ ...c.squad, ...c.bench ].some(p => p.name === name), budget: c.budget, theirs: F.cpuSquad(id, F.getStr(id)).some(p => p.name === name), size: F.cpuSquad(id, F.getStr(id)).length, deal: document.getElementById("winNote").textContent };
}, [ before.name, before.id ]);
check("a bid at the asking price signs him: he is in your squad and the money is gone", after.mine && after.budget < before.budget, JSON.stringify(after));
check("his club no longer has him but still has a full eleven", !after.theirs && after.size === 11, JSON.stringify(after));
check("the signing is announced", /Signed/.test(after.deal));

// A cheeky offer can be turned down and the price rises, through the same rules as the market.
await page.evaluate(() => { const orig = Math.random; Math.random = () => 0.99; window.__rnd = orig; });
const b4 = await page.evaluate(() => { document.getElementById("mkqGo").click(); return [ ...document.querySelectorAll("#winMarket li .bids button:nth-child(2)") ].length; });
await page.click("#winMarket li .bids button:nth-child(2)");
const ask = await page.evaluate(() => { Math.random = window.__rnd; const m = window.__ff.league.club.market.filter(p => Number.isInteger(p.cpuClub)); return { n: m.length, bids: m[0] && m[0].bids, deal: document.getElementById("winNote").textContent }; });
check("a low offer that is refused is remembered: the price rises, the same talks as the market", b4 > 0 && ask.n === 1 && ask.bids === 1 && /turned down/.test(ask.deal), JSON.stringify(ask));

// Outside the window nothing can be bought.
await page.evaluate(() => { const lg = window.__ff.league; lg.round = 3; window.__ff.renderLeagueTest(); });
const closed = await page.evaluate(() => ({ hidden: document.getElementById("winMarket").hidden }));
check("with the window shut the market, search included, is closed", closed.hidden);
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
