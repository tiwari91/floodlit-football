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
	[ ...c.squad, ...c.bench ].forEach(x => { x.contract = 3; });
	const keep = c.squad[1], sulk = c.squad[2];
	keep.contract = 1; keep.morale = 80; keep.age = 26; keep.role = "key";
	sulk.contract = 1; sulk.morale = 20; sulk.age = 26; sulk.role = "key";
	c.budget = 5;
	const done = F.assistRun("test");
	return { done, keep: keep.contract, sulk: sulk.contract, budget: c.budget, note: F.lastDeal, stored: localStorage.getItem("ff-assist") };
});
check("contracts: the happy key man in his last year signs on, the unhappy one is left alone", contracts.keep === 3 && contracts.sulk === 1 && contracts.budget <= 5 && /Assistant \(test\)/.test(contracts.note), JSON.stringify(contracts));
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
	c.budget = F.renewPlan(star, c).fee + 0.5;   // one deal plus the reserve
	const done = F.assistRun("test");
	return { done, star: star.contract, squadMan: squadMan.contract, note: F.lastDeal };
});
check("contracts: the most valuable player is signed first and the shortfall is reported", priority.star === 4 && priority.squadMan === 1 && /Not signed yet: /.test(priority.note), JSON.stringify(priority));
const leftOut = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	for (const pl of [ ...c.squad, ...c.bench ]) { pl.contract = 3; }
	const dud = c.bench[2], old = c.bench[3], sulk = c.bench[4];
	dud.contract = 1; dud.morale = 80; dud.age = 27; dud.pac = dud.sho = dud.pas = dud.def = 40; dud.pot = 42; dud.role = "";
	old.contract = 1; old.morale = 80; old.age = 34; old.pac = old.sho = old.pas = old.def = 70; old.role = "";
	sulk.contract = 1; sulk.morale = 25; sulk.age = 27;
	c.budget = 9;
	const done = F.assistRun("test"), rep = F.league.assistReport;
	return { done, dud: dud.contract, old: old.contract, sulk: sulk.contract, letGo: [ dud.letGo, old.letGo, !!sulk.letGo ], leaving: rep.leaving, unsigned: rep.unsigned.map(u => u.text), names: [ dud.name, old.name, sulk.name ] };
});
check("contracts: a 40-rated squad man and a 34-year-old reserve are let go on a free, the unhappy one is listed as not signed and why", leftOut.dud === 1 && leftOut.old === 1 && leftOut.sulk === 1 && leftOut.letGo.join() === "true,true,false" && leftOut.leaving.some(l => l.startsWith(leftOut.names[0]) && /leaves on a free/.test(l)) && leftOut.leaving.some(l => l.startsWith(leftOut.names[1]) && /34 and not in the side/.test(l)) && leftOut.unsigned.some(u => u.startsWith(leftOut.names[2]) && /unhappy/.test(u) && /deal ends this summer/.test(u)), JSON.stringify(leftOut));

// Renewals in order of value to the side, on terms that fit the man.
const prio = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club, all = [ ...c.squad, ...c.bench ];
	F.setAssist("contracts");
	all.forEach(x => { x.contract = 3; x.morale = 70; x.age = 26; x.role = ""; x.pac = x.sho = x.pas = x.def = 65; x.pot = 65; });
	const set = (pl, o, age, role) => { pl.pac = pl.sho = pl.pas = pl.def = o; pl.age = age; pl.contract = 1; pl.role = role; pl.pot = o; };
	const young = c.squad[9], vet = c.squad[7], fringe = c.bench[2], old = c.bench[3];
	set(young, 80, 23, "key"); set(vet, 76, 31, "first"); set(fringe, 66, 27, "rotation"); set(old, 70, 33, "rotation");
	const w = [ young, vet, fringe, old ].map(p => F.renewWorth(p, c)), pl = [ young, vet, fringe, old ].map(p => F.renewPlan(p, c));
	return { w, pl: pl.map(p => ({ keep: p.keep, years: p.years, rise: p.rise, fee: p.fee, free: !!p.free })) };
});
check("renewal order: the young key man, then the 31-year-old starter, then the squad men", prio.w[0] > prio.w[1] && prio.w[1] > prio.w[2] && prio.w[1] > prio.w[3], JSON.stringify(prio.w));
check("terms: three seasons for the young key man, one for the 31-year-old, one cheaper season for the fringe man, a free for the 33-year-old reserve", prio.pl[0].years === 3 && prio.pl[0].rise === 1.2 && prio.pl[1].years === 1 && prio.pl[2].keep && prio.pl[2].years === 1 && prio.pl[2].rise <= 1 && !prio.pl[3].keep && prio.pl[3].free, JSON.stringify(prio.pl));
// The report in plain words: who renewed for how long and at what wage, who hasn't, when, why, and what next.
const report = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, all = [ ...c.squad, ...c.bench ];
	lg.round = 24; lg.bidsIn = [];
	all.forEach(x => { x.contract = 3; x.morale = 70; x.age = 26; x.role = ""; });
	const set = (pl, o, age, role) => { pl.pac = pl.sho = pl.pas = pl.def = o; pl.age = age; pl.contract = 1; pl.role = role; pl.pot = o; };
	set(c.squad[9], 82, 24, "key"); set(c.squad[5], 78, 27, "key"); set(c.squad[3], 74, 30, "first"); set(c.squad[7], 72, 33, "first"); set(c.bench[1], 64, 34, "rotation");
	c.budget = 1.2;
	F.setAssist("contracts"); F.assistRun("this week"); F.renderLeagueTest();
	const rep = lg.assistReport, p = document.getElementById("assistNote");
	return { rep, text: p.innerText, buttons: [ ...p.querySelectorAll("button") ].map(b => b.textContent), first: rep.renewed[0] || "", star: c.squad[9].name, note: lg.assistNote };
});
check("the report names who renewed, for how long and at what wage, the most important first", report.rep.renewed.length >= 1 && report.first.startsWith(report.star) && report.rep.renewed.every(r => /: \d more seasons? at £[\d.]+k\/wk/.test(r)), JSON.stringify(report.rep.renewed));
check("unsigned men are listed with when their deal ends and why, and what to do next", report.rep.unsigned.length >= 1 && report.rep.unsigned.every(u => /deal ends this summer, 14 games left/.test(u.text) && /needs £[\d.]+m to sign|unhappy/.test(u.text)) && report.rep.next.length >= 1 && report.buttons.some(b => /Show in the squad list/.test(b)), JSON.stringify({ u: report.rep.unsigned, next: report.rep.next, b: report.buttons }));
check("no jargon and no £0.0m in the note", !/your call|reserve spent|£0\.0m|kept for wages\)/.test(report.text + report.note), report.text);
// A man the assistant lets go leaves in the summer even though he'd take the standard deal.
const letGo = await page.evaluate(() => {
	const F = window.__ff, c = F.league.club;
	F.setAssist("contracts");
	const pl = c.bench[4]; pl.contract = 1; pl.morale = 80; pl.age = 30; pl.letGo = true;
	const keep = c.bench[3]; keep.contract = 1; keep.morale = 80; keep.age = 30; keep.letGo = false;
	const gone = F.rolloverClub(c);
	return { gone, name: pl.name, kept: keep.name };
});
check("a player the assistant let go leaves on a free at the rollover; a happy one without the flag stays", letGo.gone.includes(letGo.name) && !letGo.gone.includes(letGo.kept), JSON.stringify(letGo));
// Short of money with transfers on and a window open: a squad man is sold to pay for the deals; never the only keeper.
const fund = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, all = () => [ ...c.squad, ...c.bench ];
	lg.round = 0; lg.bidsIn = []; c.market = [];
	all().forEach(x => { x.contract = 3; x.morale = 70; x.age = 26; x.role = ""; x.pac = x.sho = x.pas = x.def = 66; x.pot = 66; });
	const star = c.squad[9]; star.pac = star.sho = star.pas = star.def = 84; star.contract = 1; star.age = 25; star.role = "first";
	const spare = c.bench.find(x => x.pos !== "gk"); spare.pac = spare.sho = spare.pas = spare.def = 70; spare.contract = 3;
	const fee = F.renewPlan(star, c).fee; c.budget = 0.45;
	F.setAssist("both"); const done = F.assistRun("window");
	const gks = all().filter(x => x.pos === "gk").length;
	return { done, fee, starContract: star.contract, sold: lg.assistReport && lg.assistReport.sold, gks, budget: c.budget };
});
check("short of money in a window, with transfers on, a squad man is sold and the key deal is done", fund.starContract >= 3 && fund.sold.length >= 1 && fund.gks >= 1 && fund.budget >= 0, JSON.stringify(fund));

// The commentator calls the goals that change a game: the equaliser, a lead taken late, a comeback from
// two down, an own goal; leaves the late drama and the hat-trick to the celebration; red cards have lines.
const calls = await page.evaluate(() => {
	const F = window.__ff, g = (team, min, text) => ({ team, min, kind: "goal", text });
	const call = (log) => { const c = F.goalCall(log, log.length - 1); return c ? `${c.kind}:${c.name}` : null; };
	return {
		eq: call([ g(1, 10, "A. Rook"), g(0, 30, "B. Hale") ]),
		ahead: call([ g(0, 65, "B. Hale") ]),
		early: call([ g(0, 12, "B. Hale") ]),
		comeback: call([ g(1, 10, "A"), g(1, 20, "A"), g(0, 50, "C. Dunn"), g(0, 60, "C. Dunn (header)") ]),
		own: call([ g(0, 33, "D. Moss (own goal)") ]),
		late: call([ g(1, 10, "A"), g(0, 85, "E. Ward") ]),
		pools: [ "equaliser", "ahead", "comeback", "own", "red", "red2" ].map(k => (F.COMM[k] || []).length)
	};
});
check("the big goals get their own call; late drama is left to the celebration", calls.eq === "equaliser:B. Hale" && calls.ahead === "ahead:B. Hale" && calls.early === null && calls.comeback === "comeback:C. Dunn" && calls.own === "own:D. Moss" && calls.late === null && calls.pools.every(n => n >= 3), JSON.stringify(calls));

// The cup: twenty clubs down to one over five cup nights, level ties settled by extra time and penalties.
const cup = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	lg.cup = null; lg.round = 0;
	const c = F.ensureCup(lg), start = c.alive.length, sizes = [];
	for (const r of F.CUP_NIGHTS) { lg.round = r; F.cupNight(); sizes.push(lg.cup.alive.length); }
	const ties = lg.cup.rounds.flatMap(x => x.ties), level = ties.filter(t => t.et);
	let pens = 0, pensOk = true;
	for (let i = 0; i < 300; i++) { const p = F.cupPens(3, 3); pens++; if (p[0] === p[1]) { pensOk = false; } }
	F.renderExtras();
	const box = document.getElementById("lgExtras");
	return { start, sizes, winner: lg.cup.winner, rounds: lg.cup.rounds.map(x => [ x.name, x.ties.length ]), level: level.length, settled: ties.every(t => t.win === t.h || t.win === t.a) && level.every(t => t.hg !== t.ag || (t.pens && t.pens[0] !== t.pens[1])), pensOk, card: box ? box.innerText : "" };
});
check("the cup: 20 clubs, a first round to 16, then 8, 4, 2 and a winner", cup.start === 20 && cup.sizes.join() === "16,8,4,2,1" && cup.winner !== null && cup.rounds.map(r => r[1]).join() === "4,8,4,2,1", JSON.stringify(cup));
check("level ties go to extra time and then penalties, which always find a winner", cup.settled && cup.pensOk, JSON.stringify({ level: cup.level }));
check("the League panel shows the cup", /League Cup/.test(cup.card) && /Final|won the cup|Out in the/.test(cup.card), cup.card.slice(0, 200));
// Awards at the end of the season, and the academy's intake, promotion and release.
const extras = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, all = [ ...c.squad, ...c.bench ];
	lg.round = lg.fixtures.length;
	all.forEach((pl, i) => { pl.apps = 20; pl.rn = 20; pl.rsum = 20 * (6.5 + i * 0.01); pl.goals = 0; });
	c.squad[9].goals = 14; c.squad[2].rsum = 20 * 8.1; c.bench[0].age = 19; c.bench[0].rsum = 20 * 7.4;
	const aw = F.seasonAwards();
	c.academy = undefined;
	const fresh = F.youthIntake(c);
	const n = c.academy.length, kid = c.academy[0];
	while (c.bench.length > 6) { c.bench.pop(); }
	const promoted = F.promoteYouth(kid.name), onBench = c.bench.some(p => p.name === kid.name);
	const other = c.academy[0], released = F.releaseYouth(other.name);
	F.renderExtras();
	return { aw, fresh, n, kid: { age: kid.age, pot: kid.pot, role: kid.role }, promoted, onBench, released, left: c.academy.length, star: c.squad[2].name, scorer: c.squad[9].name, young: c.bench.find(p => p.age === 19) && c.bench.find(p => p.age === 19).name, card: document.getElementById("lgExtras").innerText };
});
check("season awards: player of the season, top scorer, young player and manager", extras.aw.player.name === extras.star && extras.aw.scorer.name === extras.scorer && /14 goals/.test(extras.aw.scorer.what) && extras.aw.young && extras.aw.manager && /Season \d+ awards/.test(extras.card), JSON.stringify(extras.aw));
check("the academy: two or three prospects each summer with room to grow, promoted to the bench or released", extras.n >= 2 && extras.n <= 3 && extras.kid.age <= 17 && extras.kid.pot >= 64 && extras.promoted && extras.onBench && extras.released && extras.left === extras.n - 2 && /Academy/.test(extras.card), JSON.stringify(extras));
// An old save with no cup, awards or academy loads cleanly mid-season.
const oldSave = await (async () => {
	await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("ff-league")); delete raw.cup; delete raw.awards; delete raw.club.academy; raw.round = 15; raw.results = raw.results.slice(0, 15); localStorage.setItem("ff-league", JSON.stringify(raw)); });
	await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	return page.evaluate(() => { const F = window.__ff; F.renderLeagueTest(); return { cup: F.league.cup && (F.league.cup.none ? "none" : "cup"), card: (document.getElementById("lgExtras") || {}).innerText || "" }; });
})();
const oldNote = await (async () => {
	await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("ff-league")); raw.assistNote = "Assistant (your call, reserve spent): O. Osei signed on to 3 seasons; no money yet for new deals for U. Ruiz (£0.0m is kept for wages)."; delete raw.assistReport; localStorage.setItem("ff-league", JSON.stringify(raw)); localStorage.setItem("ff-assist", "contracts"); });
	await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	return page.evaluate(() => { window.__ff.renderLeagueTest(); return document.getElementById("assistNote").innerText; });
})();
check("an old save's jargon note is not shown after the update", !/your call|reserve spent|£0\.0m/.test(oldNote), oldNote);
check("an old save mid-season loads with no cup this season and an empty academy, no errors", oldSave.cup === "none" && /starts again next season/.test(oldSave.card) && /Academy/.test(oldSave.card), JSON.stringify(oldSave));

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
// Abroad, the other clubs are that country's, with its league's name, and it all survives a reload.
const foreign = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, opps = lg.members.filter(id => id !== 0).map(id => F.TEAMS[id].name);
	return { div: F.divisionName(), country: lg.ident && lg.ident.country, opps, english: opps.filter(n => /Rovers|Wanderers|Albion|Athletic$|Harriers|Borough/.test(n)), grounds: lg.members.filter(id => id !== 0).slice(0, 3).map(id => F.TEAMS[id].ground), unique: new Set(opps).size === opps.length, head: document.getElementById("lgDivName").textContent };
});
check("moving to Spain makes the whole division Spanish: Primera División, Spanish clubs and grounds, no English names", foreign.country === "ESP" && /^Primera División \(Spain\)$/.test(foreign.div) && foreign.english.length === 0 && foreign.unique && foreign.grounds.every(g => /^Estadio de /.test(g)) && foreign.head === foreign.div, JSON.stringify(foreign));
// An older save, already abroad with the home clubs around it, is repaired when it loads.
const repaired = await (async () => {
	await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("ff-league")); raw.ident = { you: { ...raw.ident.you, name: "AS Vence", short: "AS" }, clubs: {} }; localStorage.setItem("ff-league", JSON.stringify(raw)); });
	await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	return page.evaluate(() => { const F = window.__ff, lg = F.league; return { you: F.YOU.name, div: F.divisionName(), opps: lg.members.filter(id => id !== 0).slice(0, 5).map(id => F.TEAMS[id].name), country: lg.ident.country }; });
})();
check("an older save at AS Vence with English clubs around it loads as Ligue 1 with French clubs", repaired.you === "AS Vence" && repaired.country === "FRA" && /^Ligue 1/.test(repaired.div) && repaired.opps.every(n => !/Rovers|Wanderers|Albion|Harriers|Borough/.test(n)), JSON.stringify(repaired));

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
check("the January alert names the important players in their last year", keys.alerted.length >= 1 && /Deals up at the end of the season \(\d+ games left\)/.test(keys.news), JSON.stringify(keys));
check("with the assistant off, a key starter is still kept on in the summer when the money is there", keys.kept.length >= 1 && keys.after.contract >= 2 && keys.after.budget < 5 && /kept on before their deals ran out/.test(keys.after.note), JSON.stringify(keys));
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
check("after it acts the note reports what it did", note.did.length >= 1 && /Renewed: .* more seasons? at £[\d.]+k\/wk/.test(note.active), note.active);
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
	const yes = [ ...p.querySelectorAll("button") ].find(b => /Spend the wage money/.test(b.textContent)); if (yes) { yes.click(); } await new Promise(r => setTimeout(r, 300));
	return { done, short, btns, after: { contracts: three.map(x => x.contract), budget: c.budget, note: lg.assistNote, cleared: !lg.assistShort, btnsLeft: [ ...p.querySelectorAll("button") ].map(b => b.textContent) } };
});
check("short of money, the note asks the manager with the sums and two choices", ask.short && ask.short.names.length >= 1 && /Spend the wage money \(£0\.[1-4]m\)/.test(ask.btns[0][0]) && ask.btns.some(b => /Show in the squad list/.test(b[0])) && /Leave them/.test(ask.btns[ask.btns.length - 1][0]), JSON.stringify({ short: ask.short, btns: ask.btns }));
check("Renew anyway spends the reserve on the deals it reaches and clears the question", ask.after.contracts.filter(x => x >= 2).length > ask.done.filter(d => /^renewed /.test(d)).length && ask.after.budget >= 0 && /^Assistant \(using the wage money\): Renewed /.test(ask.after.note) && !/£0\.0m|your call|reserve spent/.test(ask.after.note) && ask.after.cleared && !ask.after.btnsLeft.some(b => /Spend the wage money|Leave them/.test(b)), JSON.stringify(ask.after));
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
// Careers end: retirement in the summer, one-year deals for veterans, none in a player's last season,
// and an old save with impossible ages is cleaned up when it loads.
const ages = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club;
	const all = () => [ ...c.squad, ...c.bench ];
	all().forEach(x => { x.age = 25; x.contract = 3; x.morale = 70; });
	const vet = c.squad[2], gk = all().find(x => x.pos === "gk"), old37 = c.squad[3];
	vet.age = 33; vet.contract = 1; old37.age = 37; old37.contract = 1; gk.age = 37; gk.contract = 1;
	c.budget = 20;
	const vetDeal = F.renewDeal(vet, c), oldDeal = F.renewDeal(old37, c), gkDeal = F.renewDeal(gk, c);
	// a save with players of 42, 50 and 52
	const s = all(); s[4].age = 42; s[5].age = 50; s[6].age = 52; const names = [ s[4].name, s[5].name, s[6].name ];
	const gone = F.retireVeterans(c, false);
	const max = Math.max(...all().map(x => x.age));
	// many summers: nobody outfield passes 37, no keeper 39
	let worstOut = 0, worstGk = 0;
	for (let y = 0; y < 30; y++) { all().forEach(x => { x.age++; }); F.retireVeterans(c, true); all().forEach(x => { if (x.pos === "gk") { worstGk = Math.max(worstGk, x.age); } else { worstOut = Math.max(worstOut, x.age); } }); }
	return { vet: [ vetDeal.ok, vet.contract ], old: [ oldDeal.ok, oldDeal.why ], gk: [ gkDeal.ok, gk.contract ], gone, names, max, size: [ c.squad.length, c.bench.length ], worstOut, worstGk };
});
check("a 33-year-old renews for one more season only", ages.vet[0] && ages.vet[1] === 2, JSON.stringify(ages.vet));
check("a 37-year-old outfielder gets no new deal: he is retiring", !ages.old[0] && /retiring/.test(ages.old[1]), JSON.stringify(ages.old));
check("keepers last longer: a 37-year-old keeper still renews", ages.gk[0] && ages.gk[1] === 2, JSON.stringify(ages.gk));
check("players of 42, 50 and 52 retire at once and the academy fills the squad", ages.names.every(n => ages.gone.some(g => g.startsWith(n))) && ages.max <= 39 && ages.size[0] === 11 && ages.size[1] >= 5, JSON.stringify(ages));
const loaded = await (async () => {
	await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("ff-league")); raw.club.squad[4].age = 52; raw.club.bench[0].age = 50; raw.news = ""; localStorage.setItem("ff-league", JSON.stringify(raw)); });
	await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	return page.evaluate(() => { const c = window.__ff.league.club, all = [ ...c.squad, ...c.bench ]; return { max: Math.max(...all.map(x => x.age)), news: window.__ff.league.news, xi: c.squad.length }; });
})();
check("a saved league with a 52-year-old loads cleanly: he and the 50-year-old retire, the news says so", loaded.max <= 39 && /Retired: .*\(52\).*\(50\)|Retired: .*\(50\).*\(52\)/.test(loaded.news) && loaded.xi === 11, JSON.stringify(loaded));
check("over thirty summers nobody plays past 37, no keeper past 39", ages.worstOut <= 37 && ages.worstGk <= 39, JSON.stringify(ages));

// Weather follows the country: Spain and Morocco drier than home, the tropics wetter and stormier,
// hot countries play more at night, and the home league is as before.
const clim = await page.evaluate(() => {
	const F = window.__ff, out = {};
	for (const nat of [ undefined, "ESP", "MAR", "NGA", "NED", "MEX", "SWE" ]) {
		let rain = 0, heavy = 0, night = 0, wind = 0, n = 0, snow = 0, hot = 0;
		for (let i = 0; i < 60; i++) {
			const c = F.climateTest(38, nat);
			for (let r = 0; r < 38; r++) { n++; rain += c.weather[r] === "rain" || c.weather[r] === "heavy"; heavy += c.weather[r] === "heavy"; snow += c.weather[r] === "snow"; hot += c.weather[r] === "hot"; night += c.ko[r] === "night"; wind += c.wind[r].s; }
		}
		out[nat || "home"] = { rain: +(rain / n).toFixed(2), heavy: +(heavy / n).toFixed(2), night: +(night / n).toFixed(2), wind: +(wind / n).toFixed(1), snow: +(snow / n).toFixed(3), hot: +(hot / n).toFixed(2) };
	}
	out.options = [ ...document.querySelectorAll("#weather option") ].map(o => o.value);
	return out;
});
check("snow in a Swedish winter and now and then at home, never in Spain; heat in Morocco, never at home; both in the friendly picker",
	clim.SWE.snow > 0.05 && clim.home.snow > 0.005 && clim.home.snow < 0.04 && clim.ESP.snow === 0 && clim.MAR.hot > 0.3 && clim.home.hot === 0 && clim.options.includes("snow") && clim.options.includes("hot"),
	JSON.stringify(clim));
check("weather by country: Spain and Morocco drier, Nigeria stormier, the Dutch windier, hot countries at night",
	clim.ESP.rain < clim.home.rain * 0.6 && clim.MAR.rain < 0.12 && clim.NGA.heavy > clim.home.heavy && clim.NED.wind > clim.home.wind * 1.1 && clim.MEX.night > clim.home.night + 0.2 && Math.abs(clim.home.rain - 0.5) < 0.12,
	JSON.stringify(clim));

check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
