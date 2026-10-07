// Run: node tests/club.mjs   (the assistant manager: contracts, bids and signings)
import { launch, serve, sleep, tally } from "./_env.mjs";
const server = serve(8799), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });

const setting = await page.evaluate(() => ({ mode: window.__ff.assistMode, sel: document.getElementById("assist").value, options: [ ...document.getElementById("assist").options ].map(o => o.value) }));
check("the Assistant setting exists under Your team and starts off", setting.mode === "off" && setting.sel === "off" && setting.options.join(",") === "off,contracts,transfers,both", JSON.stringify(setting));

// Contracts: a happy first-teamer in his last year is signed on; a sulking one is left; a reserve of money is kept.
const contracts = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	F.setAssist("contracts");
	const keep = c.squad[1], sulk = c.squad[2];
	keep.contract = 1; keep.morale = 80; keep.age = 26; keep.role = "key";
	sulk.contract = 1; sulk.morale = 20; sulk.age = 26; sulk.role = "key";
	c.budget = 5;
	const done = F.assistRun("test");
	return { done, keep: keep.contract, sulk: sulk.contract, budget: c.budget, note: F.lastDeal, stored: localStorage.getItem("ff-assist") };
});
check("contracts: the happy key man in his last year signs on, the unhappy one is left alone", contracts.keep === 3 && contracts.sulk === 1 && contracts.budget < 5 && /Assistant \(test\)/.test(contracts.note), JSON.stringify(contracts));
check("the setting is remembered", contracts.stored === "contracts");
const broke = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club, pl = c.bench[0];
	pl.contract = 1; pl.morale = 80; pl.age = 24; pl.role = "key"; pl.pac = pl.sho = pl.pas = pl.def = 85; c.budget = 0.45;   // a valuable man: his fee is real money
	F.assistRun("test");
	return { contract: pl.contract, budget: c.budget };
});
check("contracts: nothing is signed when it would eat the wage reserve", broke.contract === 1 && broke.budget === 0.45, JSON.stringify(broke));

// Transfers, in an open window: a rich bid for a bench man is taken, a cheap bid for a key man refused,
// and a known step-up on the market is signed at the asking price.
const transfers = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club, lg = F.league;
	F.setAssist("transfers");
	lg.round = 0;
	const squadOvr = c.squad.map((p, i) => [ i, F.ovrNow(p) ]).filter(([ i ]) => i > 0).sort((a, b) => a[1] - b[1]);
	const weakSlot = squadOvr[0][0], weak = c.squad[weakSlot];
	const seller = c.bench[1], star = c.squad[0] && F.ovrNow(c.squad[0]) ? c.squad.slice(1).sort((a, b) => F.ovrNow(b) - F.ovrNow(a))[0] : c.squad[1];
	lg.bidsIn = [ { name: seller.name, club: lg.members.find(id => id !== 0), fee: Math.round(F.valueOf(seller) * 2 * 10) / 10 }, { name: star.name, club: lg.members.find(id => id !== 0), fee: Math.round(F.valueOf(star) * 0.5 * 10) / 10 } ];
	const m = c.market[0];
	m.pos = weak.pos; m.region = "home"; m.scouted = true; m.bids = 0; m.pac = m.sho = m.pas = m.def = 92; m.age = 25; m.ask = 0.6; delete m.adapt;
	c.budget = 3;
	const before = { sellerIn: true, open: F.windowOpen() };
	const done = F.assistRun("window");
	const pool = [ ...c.squad, ...c.bench ];
	return { done, open: before.open, sellerGone: !pool.some(p => p.name === seller.name), starKept: pool.some(p => p.name === star.name), signed: pool.some(p => p.name === m.name), budget: c.budget, bids: lg.bidsIn.length };
});
check("transfers: the rich bid for a reserve is taken, the cheap bid for a star refused", transfers.open && transfers.sellerGone && transfers.starKept && transfers.bids === 0, JSON.stringify(transfers));
check("transfers: a scouted step-up on the market is signed at the asking price", transfers.signed && transfers.done.some(d => /^signed/.test(d)), JSON.stringify(transfers));
const shut = await page.evaluate(() => { const F = window.__ff, c = F.league.club; F.league.round = 5; c.budget = 9; const m = c.market[0]; if (m) { m.region = "home"; m.pac = m.sho = m.pas = m.def = 95; m.ask = 0.3; m.bids = 0; } return { open: F.windowOpen(), done: F.assistRun("closed") }; });
check("transfers: nothing happens while the window is shut", !shut.open && shut.done.length === 0, JSON.stringify(shut));
const off = await page.evaluate(() => { const F = window.__ff, c = F.league.club; F.setAssist("off"); F.league.round = 0; c.squad[3].contract = 1; c.squad[3].morale = 90; c.budget = 9; return F.assistRun("off"); });
check("off: the assistant does nothing", off.length === 0, JSON.stringify(off));

// Contracts go to the stars first: with money for one deal, the 90-rated forward gets it and the squad man waits.
const priority = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	F.setAssist("contracts");
	for (const pl of [ ...c.squad, ...c.bench ]) { pl.contract = 3; }
	const star = c.squad[9], squadMan = c.squad[1];
	star.contract = 1; star.morale = 80; star.age = 23; star.pac = star.sho = star.pas = star.def = 90; star.role = "key";
	squadMan.contract = 1; squadMan.morale = 80; squadMan.age = 29; squadMan.pac = squadMan.sho = squadMan.pas = squadMan.def = 80; squadMan.role = "first";   // a real fee, not pocket change
	c.budget = Math.round(F.valueOf(star) * 0.15 * 10) / 10 + 0.5;   // one deal plus the reserve
	const done = F.assistRun("test");
	return { done, star: star.contract, squadMan: squadMan.contract, note: F.lastDeal };
});
check("contracts: the most valuable player is signed first and the shortfall is reported", priority.star === 3 && priority.squadMan === 1 && /no money yet/.test(priority.note), JSON.stringify(priority));

// Offers for the manager: a title-winner hears from the big clubs, a bottom finisher only from below.
const offers = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const top = F.offerJobs(1).map(o => ({ id: o.id, str: o.str, below: o.below, member: lg.members.includes(o.id) }));
	const bottom = F.offerJobs(20).map(o => ({ id: o.id, str: o.str, below: o.below, member: lg.members.includes(o.id) }));
	return { top, bottom, career: lg.career, title: document.getElementById("jobsTitle").hidden, items: document.querySelectorAll("#jobOffers li").length };
});
check("a top-four finish brings one or two offers from strong clubs in the division", offers.top.length >= 1 && offers.top.length <= 2 && offers.top.every(o => o.member && o.str >= 3), JSON.stringify(offers.top));
check("a bottom finish brings one offer, from the division below", offers.bottom.length === 1 && offers.bottom.every(o => o.below && !o.member), JSON.stringify(offers.bottom));
const taken = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const offer = F.offerJobs(1)[0], target = F.TEAMS[offer.id], targetName = target.name, oldName = F.YOU.name, oldSquad = lg.club.squad.map(p => p.name);
	F.league.round = lg.fixtures.length;
	F.renderLeagueTest();
	const shown = document.querySelectorAll("#jobOffers li").length;
	const ok = F.takeJob(offer.id);
	const c = lg.club;
	return { ok, shown, youNow: F.YOU.name, targetNow: target.name, targetName, oldName, budget: c.budget, offerBudget: offer.budget, squad: c.squad.length, bench: c.bench.length, fresh: c.squad.every(p => !oldSquad.includes(p.name)), offersLeft: (lg.jobOffers || []).length, clubs: lg.career.clubs, career: document.getElementById("careerLine").textContent };
});
check("taking a job swaps you into that club: name, squad and budget, and your old club keeps its name", taken.ok && taken.shown >= 1 && taken.youNow === taken.targetName && taken.targetNow === taken.oldName && taken.budget === taken.offerBudget && taken.squad === 11 && taken.bench === 7 && taken.fresh && taken.offersLeft === 0 && taken.clubs.length === 2, JSON.stringify(taken));
check("the career line records seasons, best finish and clubs", /Career: .*best finish 1st/.test(taken.career), taken.career);
check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
