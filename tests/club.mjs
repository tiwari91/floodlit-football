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
const leftOut = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	for (const pl of [ ...c.squad, ...c.bench ]) { pl.contract = 3; }
	const dud = c.bench[2], old = c.bench[3], sulk = c.bench[4];
	dud.contract = 1; dud.morale = 80; dud.age = 27; dud.pac = dud.sho = dud.pas = dud.def = 40; dud.pot = 42; dud.role = "";
	old.contract = 1; old.morale = 80; old.age = 34; old.pac = old.sho = old.pas = old.def = 70; old.role = "";
	sulk.contract = 1; sulk.morale = 25; sulk.age = 27;
	c.budget = 9;
	const done = F.assistRun("test");
	return { done, dud: dud.contract, old: old.contract, sulk: sulk.contract, names: [ dud.name, old.name, sulk.name ] };
});
check("contracts: every last-year player who will talk is renewed, squad men and veterans included; only the unhappy one is left and the note says so", leftOut.dud === 3 && leftOut.old === 3 && leftOut.sulk === 1 && leftOut.done.some(d => /left to run down/.test(d) && d.includes(leftOut.names[2]) && /unhappy/.test(d) && !d.includes(leftOut.names[0])), JSON.stringify(leftOut));

// Offers for the manager: a title-winner hears from the big clubs, a bottom finisher only from below.
const offers = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const top = F.offerJobs(1).map(o => ({ id: o.id, str: o.str, below: o.below, kind: o.kind, abroad: o.abroad, name: o.name, member: lg.members.includes(o.id) }));
	const bottom = F.offerJobs(20).map(o => ({ id: o.id, str: o.str, below: o.below, member: lg.members.includes(o.id) }));
	return { top, bottom, career: lg.career, title: document.getElementById("jobsTitle").hidden, items: document.querySelectorAll("#jobOffers li").length };
});
const topHome = offers.top.filter(o => o.kind !== "abroad"), topAbroad = offers.top.filter(o => o.kind === "abroad");
check("a top-four finish brings one or two offers from strong clubs in the division, plus one from abroad", topHome.length >= 1 && topHome.length <= 2 && topHome.every(o => o.member && o.str >= 3) && topAbroad.length === 1 && topAbroad[0].abroad && topAbroad[0].name, JSON.stringify(offers.top));
check("a bottom finish brings one offer, from the division below", offers.bottom.length === 1 && offers.bottom.every(o => o.below && !o.member), JSON.stringify(offers.bottom));
const taken = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const offer = F.offerJobs(1)[0], target = F.TEAMS[offer.id], targetName = target.name, oldName = F.YOU.name, oldSquad = lg.club.squad.slice();
	lg.club.upgrades.training = 2; lg.club.staff.scout = { name: "Test Scout", lvl: 4, nat: "ENG", wage: 0.1 }; lg.club.training = { focus: "attack", load: "hard" };
	F.league.round = lg.fixtures.length;
	F.renderLeagueTest();
	const shown = document.querySelectorAll("#jobOffers li").length;
	const tags = [ ...document.querySelectorAll("#jobOffers .pos") ].map(x => x.textContent), pickShown = [ ...document.querySelectorAll("#jobOffers .ratings") ].some(x => /agent's pick/.test(x.textContent));
	const best = F.bestOffer(lg.jobOffers);
	const ok = F.takeJob(offer.id);
	const c = lg.club;
	const carried = { training: c.upgrades.training, coaching: c.upgrades.coaching, scout: c.staff.scout && c.staff.scout.name, focus: c.training && c.training.focus, base: Math.max(0, Math.min(3, Math.round(offer.str) - 2)), tags, best, pickShown };
	return { ok, shown, carried, youNow: F.YOU.name, targetNow: target.name, targetName, oldName, budget: c.budget, offerBudget: offer.budget, squad: c.squad.length, bench: c.bench.length, fresh: c.squad.every(p => !oldSquad.includes(p)), offersLeft: (lg.jobOffers || []).length, clubs: lg.career.clubs, career: document.getElementById("careerLine").textContent };
});
check("taking a job swaps you into that club: name, squad and budget, and your old club keeps its name", taken.ok && taken.shown >= 1 && taken.youNow === taken.targetName && taken.targetNow === taken.oldName && taken.budget === taken.offerBudget && taken.squad === 11 && taken.bench === 7 && taken.fresh && taken.offersLeft === 0 && taken.clubs.length === 2, JSON.stringify(taken));
check("the career line records seasons, best finish and clubs", /Career: .*best finish 1st/.test(taken.career), taken.career);
check("your staff, training plan and facilities come with you, and the new club's facilities match its standing", taken.carried.scout === "Test Scout" && taken.carried.focus === "attack" && taken.carried.training === Math.max(2, taken.carried.base) && taken.carried.coaching === taken.carried.base, JSON.stringify(taken.carried));
check("with several offers the agent marks the best move and says why", taken.carried.best && taken.carried.tags.filter(t => t === "BEST MOVE").length === 1 && taken.carried.pickShown, JSON.stringify(taken.carried));
// The move survives a reload: identities ride along with the league save.
await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const persisted = await page.evaluate(() => ({ you: window.__ff.YOU.name, old: window.__ff.TEAMS.some(t => t.name === "Floodlit FC"), budget: window.__ff.league.club.budget }));
check("after a reload you are still the new club and your old club keeps its name", persisted.you === taken.targetName && persisted.old && persisted.budget === taken.offerBudget, JSON.stringify(persisted));

// The window: a For you shortlist with the gain shown, one-click buying and scouting.
const foryou = await page.evaluate(async () => {
	const F = window.__ff, c = F.league.club, lg = F.league;
	lg.round = 0;
	const weakSlot = F.slotsFor(lg.fmt).filter(i => i > 0 && c.squad[i]).map(i => [ i, F.ovrNow(c.squad[i]) ]).sort((a, b) => a[1] - b[1])[0][0], weak = c.squad[weakSlot];
	weak.pac = weak.sho = weak.pas = weak.def = 60;   // a clear hole for the shortlist to fill
	const m = c.market[0]; m.pos = weak.pos; m.region = "home"; m.scouted = true; m.bids = 0; m.pac = m.sho = m.pas = m.def = 90; m.age = 24; m.ask = 0.7;
	const m2 = c.market[1]; m2.pos = weak.pos; m2.region = "europe"; m2.scouted = false; m2.bids = 0; m2.pac = m2.sho = m2.pas = m2.def = 88; m2.age = 25; m2.ask = 0.9;
	c.budget = 3; c.scoutLeft = 2; if (c.staff && c.staff.scout) { c.staff.scout.lvl = 1; }   // a modest scout, so the European pick is only an estimate
	F.renderLeagueTest();
	const tabs = [ ...document.querySelectorAll("#mkTabs button") ].map(b => [ b.textContent, b.getAttribute("aria-pressed") ]);
	const rows = [ ...document.querySelectorAll("#winMarket li") ].map(li => li.textContent);
	const acts = [ ...document.querySelectorAll("#mkActions button") ].map(b => [ b.textContent, b.disabled ]);
	const needs = document.getElementById("mkScout").textContent;
	document.querySelectorAll("#mkActions button")[1].click(); await new Promise(r => setTimeout(r, 300));
	const scouted = c.market.includes(m2) ? m2.scouted : "sold";
	document.querySelectorAll("#mkActions button")[0].click(); await new Promise(r => setTimeout(r, 300));
	return { tabs: tabs.slice(0, 2), firstRowHasGain: rows.length > 0 && /\+\d+ on /.test(rows[0]), acts, needs: /^Needs: /.test(needs), scouted, signed: [ ...c.squad, ...c.bench ].some(p => p.name === m.name), note: F.lastDeal, budget: c.budget, diag: { m: m.name, m2: m2.name, pos: weak.pos, assist: F.assistMode, log: (c.log || []).slice(-5), atPos: [ ...c.squad, ...c.bench ].filter(p => p.pos === weak.pos).map(p => `${p.name}:${F.ovrNow(p)}`), market: c.market.slice(0, 3).map(p => p.name) } };
});
check("the window opens on a For you shortlist with the gain over the starter it replaces, and a needs line", foryou.tabs[0][0] === "For you" && foryou.tabs[0][1] === "true" && foryou.firstRowHasGain && foryou.needs, JSON.stringify(foryou));
check("Scout the shortlist spends a report on the unscouted pick, and Sign the best for me buys the step-up", foryou.scouted === true && foryou.signed && /^Assistant: signed/.test(foryou.note) && foryou.budget >= 0, JSON.stringify(foryou));
check("a second signing in the same position replaces the weakest man there, never the first signing", !foryou.diag.log.some(l => l.includes(`; ${foryou.diag.m} (`)), JSON.stringify(foryou.diag.log));

// The agent: January approaches, agreeing to one, and it heading the season-end offers.
const agent = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const offers = F.agentApproaches("January");
	const home = offers.find(o => o.kind === "home");
	F.renderLeagueTest();
	const shown = document.querySelectorAll("#agentOffers li").length, title = document.getElementById("agentTitle").hidden;
	const key = home ? `club:${home.id}` : null;
	const ok = key ? F.agreeApproach(key) : false;
	const end = F.offerJobs(10);
	return { n: offers.length, kinds: offers.map(o => o.kind), shown, title, ok, agreedFirst: end[0] && end[0].agreed === true && end[0].id === (home && home.id), agreedCleared: !lg.agreed };
});
check("the agent brings January approaches, shown under Your agent", agent.n >= 1 && agent.kinds.includes("home") && agent.shown === agent.n && !agent.title, JSON.stringify(agent));
check("an agreed approach heads the season-end offers", agent.ok && agent.agreedFirst && agent.agreedCleared, JSON.stringify(agent));

// Abroad: a new identity, a fresh squad from the region, a new league, the career kept.
const abroad = await page.evaluate(() => {
	const F = window.__ff, clubsBefore = ((F.league.career && F.league.career.clubs) || []).length;
	F.moveAbroad({ abroad: "europe", kind: "abroad", nat: "ESP", name: "Ribera CF", str: 3, budget: 4 });
	const lg = F.league, c = lg.club;
	return { you: F.YOU.name, season: lg.season, round: lg.round, budget: c.budget, clubsBefore, clubs: lg.career.clubs, ident: lg.ident && lg.ident.you && lg.ident.you.name };
});
check("moving abroad gives a Spanish club, a fresh league and the career carried over", abroad.you === "Ribera CF" && abroad.season === 1 && abroad.round === 0 && abroad.budget === 4 && abroad.clubs.length === abroad.clubsBefore + 1 && /Ribera CF/.test(abroad.clubs[abroad.clubs.length - 1]) && abroad.ident === "Ribera CF", JSON.stringify(abroad));
await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const abroadKept = await page.evaluate(() => ({ you: window.__ff.YOU.name, season: window.__ff.league.season }));
check("the move abroad survives a reload", abroadKept.you === "Ribera CF" && abroadKept.season === 1, JSON.stringify(abroadKept));

// Important players never just walk: a heads-up, then kept on in the summer with the assistant off.
const keys = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club;
	F.setAssist("off");
	[ ...c.squad, ...c.bench ].forEach(p => { p.contract = 3; });
	const star = c.squad.slice().sort((a, b) => F.ovrNow(b) - F.ovrNow(a))[0];
	star.contract = 1; star.morale = 45; star.age = 34;   // the free re-sign in rollover needs morale 50 and under 34, so this one would walk
	c.budget = 5;
	const alerted = F.contractAlerts().map(p => p.name);
	const news = lg.news;
	const kept = F.keyContracts(c);
	const after = { contract: star.contract, budget: c.budget, note: F.lastDeal };
	c.budget = 0.3; star.contract = 1;
	const skint = F.keyContracts(c);
	return { role: F.roleOf(star, c), alerted, news, kept, after, skint, skintNote: F.lastDeal };
});
check("the January alert names the important players in their last year", keys.alerted.length >= 1 && /Contracts ending for/.test(keys.news), JSON.stringify(keys));
check("with the assistant off, a key starter is still kept on in the summer when the money is there", keys.kept.length >= 1 && keys.after.contract >= 3 && keys.after.budget < 5 && /kept on before their deals ran out/.test(keys.after.note), JSON.stringify(keys));
// The assistant always says something under its control: what it did, or why there was nothing to do.
const note = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, p = document.getElementById("assistNote");
	F.setAssist("off"); F.renderLeagueTest();
	const off = p.textContent;
	[ ...c.squad, ...c.bench ].forEach(x => { x.contract = 3; }); lg.bidsIn = []; lg.round = 5;
	F.setAssist("both"); const done = F.assistRun("test"); F.renderLeagueTest();
	const idle = p.textContent;
	c.squad[1].contract = 1; c.squad[1].morale = 70; c.squad[1].age = 27; c.budget = 5;
	const did = F.assistRun("test"); F.renderLeagueTest();
	return { off, done, idle, did, active: p.textContent };
});
check("with the assistant off the note says what you handle yourself", /^Off: you renew contracts/.test(note.off), note.off);
check("with nothing to do the note says so and why", note.done.length === 0 && /nothing to do right now \(nobody is in the last year of his deal; no bids in; the window is closed/.test(note.idle), note.idle);
check("after it acts the note reports what it did", note.did.length >= 1 && /^Assistant \(test\): .* signed on to/.test(note.active), note.active);
// Short of money, the assistant asks the manager: renew anyway (spend the reserve) or leave them.
const ask = await page.evaluate(async () => {
	const F = window.__ff, lg = F.league, c = lg.club, p = document.getElementById("assistNote");
	F.setAssist("contracts");
	[ ...c.squad, ...c.bench ].forEach(x => { x.contract = 3; x.morale = 70; x.age = 26; });
	const three = c.squad.slice(0, 3); three.forEach(x => { x.contract = 1; });
	const fees = three.map(x => Math.round(F.valueOf(x) * 0.15 * 10) / 10);
	c.budget = Math.round((fees[0] + 0.3) * 10) / 10;   // one deal clears the reserve, the next two do not
	const done = F.assistRun("test"); F.renderLeagueTest();
	const short = lg.assistShort, btns = [ ...p.querySelectorAll("button") ].map(b => [ b.textContent, b.disabled ]);
	const yes = p.querySelector("button"); yes.click(); await new Promise(r => setTimeout(r, 300));
	return { done, short, btns, after: { contracts: three.map(x => x.contract), budget: c.budget, note: lg.assistNote, cleared: !lg.assistShort, btnsLeft: p.querySelectorAll("button").length } };
});
check("short of money, the note asks the manager with the sums and two choices", ask.short && ask.short.names.length >= 1 && ask.btns.length === 2 && /Renew anyway/.test(ask.btns[0][0]) && /Leave them/.test(ask.btns[1][0]), JSON.stringify({ short: ask.short, btns: ask.btns }));
check("Renew anyway spends the reserve on the deals it reaches and clears the question", ask.after.contracts.filter(x => x >= 3).length > ask.done.filter(d => / signed on to /.test(d)).length && ask.after.budget >= 0 && /your call, reserve spent/.test(ask.after.note) && ask.after.cleared && ask.after.btnsLeft === 0, JSON.stringify(ask.after));
// A question left unanswered at season's end is settled by the summer, not left hanging.
const summer = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club;
	[ ...c.squad, ...c.bench ].forEach(x => { x.contract = 3; x.morale = 70; x.age = 26; });
	const two = c.squad.slice(0, 2); two.forEach(x => { x.contract = 1; }); two[1].morale = 30;   // one is kept on standard terms, the sulker walks
	c.budget = 0.3;
	F.assistRun("test"); F.renderLeagueTest();
	const asked = !!lg.assistShort, names = two.map(x => x.name);
	lg.round = lg.fixtures.length; F.nextSeasonTest(); F.renderLeagueTest();
	const p = document.getElementById("assistNote");
	return { asked, names, short: F.league.assistShort, note: F.league.assistNote, buttons: p.querySelectorAll("button").length, kept: [ ...F.league.club.squad, ...F.league.club.bench ].some(x => x.name === names[0]) };
});
check("the summer settles an open question: kept on standard terms or gone, no stale buttons", summer.asked && !summer.short && summer.buttons === 0 && summer.kept && new RegExp(`kept ${summer.names[0].replace(".", "\\.")} on standard terms`).test(summer.note), JSON.stringify(summer));
check("and the note says who could not be kept when the money is short", keys.skint.length === 0 && /no money to keep/.test(keys.skintNote), JSON.stringify(keys));
check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
