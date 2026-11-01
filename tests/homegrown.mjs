// Run: node tests/homegrown.mjs   (the homegrown rule: 18n-homegrown.js)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8827), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const note = () => page.evaluate(() => { const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Transfers/i.test(x.textContent.trim())); t.click(); return document.getElementById("winNote").textContent; });

const first = await note();
const n0 = Number((first.match(/Homegrown rule: (\d+) of 12/) || [])[1]);
check("the transfer window says how many of the twelve places are used", Number.isInteger(n0) && n0 >= 0 && n0 <= 18, first.slice(-220));

// Set up: eleven homegrown seniors... then exactly twelve who aren't, with a free bench place.
const setup = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club, all = [ ...c.squad, ...c.bench ];
	all.forEach((pl, i) => { pl.age = 25; pl.academy = false; pl.nat = i < 12 ? "BRA" : "ENG"; });
	c.bench.pop();   // a free bench place: a signing adds a player, nobody makes way
	c.budget = 50;
	return { players: c.squad.length + c.bench.length, market: c.market.length };
});
const sign = (nat, age) => page.evaluate(([ n, a ]) => {
	const F = window.__ff, c = F.league.club, pl = c.market[0];
	pl.nat = n; pl.age = a; pl.academy = false; delete pl.cpuClub; delete pl.cpuSlot;
	const name = pl.name, before = c.squad.length + c.bench.length;
	F.signPlayer(0);
	const inSquad = [ ...c.squad, ...c.bench ].some(p => p.name === name);
	if (inSquad) { const i = c.bench.findIndex(p => p.name === name); if (i >= 0) { c.bench.splice(i, 1); } }   // free the place again for the next try
	return { name, inSquad, note: document.getElementById("winNote").textContent };
}, [ nat, age ]);

const foreign = await sign("ARG", 26);
check("at twelve, a senior signing who isn't homegrown is refused, and the note says why", !foreign.inSquad && /homegrown rule: you already have 12 of the 12 places/i.test(foreign.note), JSON.stringify(foreign).slice(0, 300));
const home = await sign("ENG", 26);
check("a homegrown signing goes through", home.inSquad, JSON.stringify(home).slice(0, 200));
const young = await sign("ARG", 20);
check("an under-21 from abroad goes through: under-21s don't count", young.inSquad, JSON.stringify(young).slice(0, 200));
const full = await note();
check("the note says the places are full", /12 of 12 places.*full/.test(full), full.slice(-200));

// An older save already over the limit may still swap one for one.
const over = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	[ ...c.squad, ...c.bench ].forEach(pl => { pl.nat = "BRA"; pl.age = 27; pl.academy = false; });
	while (c.bench.length < 7) { c.bench.push({ ...c.squad[1], name: "Spare " + c.bench.length }); }
	const pl = c.market[0]; pl.nat = "ARG"; pl.age = 26; delete pl.cpuClub; delete pl.cpuSlot;
	const name = pl.name; F.signPlayer(0);
	return { inSquad: [ ...c.squad, ...c.bench ].some(p => p.name === name) };
});
check("a squad already over the limit can still replace one foreign player with another", over.inSquad, JSON.stringify(over));

// Academy graduates are homegrown whatever their passport: one more of them frees a place.
const acad = await page.evaluate(() => { const F = window.__ff, c = F.league.club, before = [ ...c.squad, ...c.bench ].filter(p => p.age > 21 && !p.academy).length; c.squad[2].academy = true; F.renderLeagueTest(); const t = [ ...document.querySelectorAll("[role=tab]") ].find(x => /^Transfers/i.test(x.textContent.trim())); t.click(); return { before, note: document.getElementById("winNote").textContent }; });
check("an academy graduate from abroad counts as homegrown", new RegExp(`Homegrown rule: ${acad.before - 1} of 12`).test(acad.note), acad.note.slice(-160));
check("homegrown rule: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
