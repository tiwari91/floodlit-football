// Run: node tests/drama.mjs   (the dressing room: rows, refusals, transfer requests, flare-ups, old saves)
import { launch, serve, tally, OUT } from "./_env.mjs";
const server = serve(8800), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });

// Layout: the view and sound cards are a label column and a controls column, the same height side by side,
// with every control the same height; the league header's buttons sit in one row.
const layout = await page.evaluate(() => {
	document.body.classList.add("more");
	const box = e => e.getBoundingClientRect(), r1 = v => Math.round(v);
	const cards = [ ...document.querySelectorAll(".bargroup.rows") ];
	const cols = cards.map(c => ({ labels: new Set([ ...c.querySelectorAll(".row-label") ].map(e => r1(box(e).left))).size, ctls: new Set([ ...c.querySelectorAll(".row-ctl") ].map(e => r1(box(e).left))).size, rows: c.querySelectorAll(".row-label").length, ctlRows: c.querySelectorAll(".row-ctl").length }));
	const heights = new Set([ ...document.querySelectorAll(".bargroup.rows button, .bargroup.rows select") ].filter(e => box(e).height > 0).map(e => r1(box(e).height)));
	const tops = cards.map(c => r1(box(c).top)), hs = cards.map(c => r1(box(c).height));
	const hb = [ ...document.querySelectorAll(".lg-actions button") ].map(b => ({ top: r1(box(b).top), h: r1(box(b).height) }));
	return { n: cards.length, cols, heights: [ ...heights ], tops, hs, head: { tops: new Set(hb.map(b => b.top)).size, hs: new Set(hb.map(b => b.h)).size, n: hb.length } };
});
check("settings cards: one label column and one controls column each, every row labelled", layout.n === 2 && layout.cols.every(c => c.labels === 1 && c.ctls === 1 && c.rows === c.ctlRows), JSON.stringify(layout.cols));
check("settings cards: every button and select the same height, the two cards level and the same height", layout.heights.length === 1 && layout.tops[0] === layout.tops[1] && layout.hs[0] === layout.hs[1], JSON.stringify(layout));
check("league header: the five buttons in one row, the same height", layout.head.n === 5 && layout.head.tops === 1 && layout.head.hs === 1, JSON.stringify(layout.head));
await page.evaluate(() => document.body.classList.remove("more"));

// Every player has a temper, and the league a dressing room.
const base = await page.evaluate(() => { const F = window.__ff, lg = F.league, all = [ ...lg.club.squad, ...lg.club.bench ]; return { room: lg.drama && lg.drama.room, tempers: all.every(p => Number.isFinite(p.temper) && p.temper >= 20 && p.temper < 90), spread: new Set(all.map(p => p.temper >= 75)).size }; });
check("a new league has a dressing room and every player a temper", base.room === 70 && base.tempers, JSON.stringify(base));

// A star left out, a run on the bench, a man out of position and a hammering all become problems.
const after = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg);
	d.issues = []; d.room = 70;
	const slots = F.slotsFor(lg.fmt), star = c.squad[slots[1]], benchMan = c.bench.find(p => p.pos !== "gk");
	star.role = "key"; star.injured = false; star.benched = 0;
	benchMan.age = 26; benchMan.benched = 3; benchMan.wantsOut = false; benchMan.pac = benchMan.sho = benchMan.pas = benchMan.def = 80;
	const played = new Set(slots.map(i => c.squad[i].name).filter(n => n !== star.name));
	const m0 = star.morale;
	const made = F.dramaAfterMatch(played, 0, 4, () => 0);
	return { kinds: made.map(x => x.kind), dropped: d.issues.some(i => i.kind === "dropped" && i.name === star.name), request: benchMan.wantsOut && d.issues.some(i => i.kind === "request" && i.name === benchMan.name), row: d.issues.some(i => i.kind === "row"), room: d.room, starMorale: [ m0, star.morale ], text: d.issues.map(i => i.text) };
});
check("a star left out complains in public and loses morale", after.dropped && after.starMorale[1] < after.starMorale[0], JSON.stringify(after));
check("four games on the bench: a transfer request", after.request, JSON.stringify(after.kinds));
check("a 0-4 hammering: a dressing-room row and a worse mood", after.row && after.room < 70, JSON.stringify({ room: after.room, kinds: after.kinds }));
check("the problems read plainly", after.text.every(t => t.length > 30 && !/\{|undefined|NaN/.test(t)), after.text.join(" | "));

// Out of position: a grumble, then a refusal.
const oop = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg), slots = F.slotsFor(lg.fmt);
	d.issues = [];
	const i = slots.find(k => F.league.club.squad[k].pos === "mid") ?? slots[slots.length - 2];
	const pl = c.squad[i]; pl.pos = "fwd" === pl.pos ? "def" : "fwd"; pl.oopN = 2; pl.posPromise = false;
	const played = new Set(slots.map(k => c.squad[k].name));
	F.dramaAfterMatch(played, 1, 1, () => 0.99);
	const is = d.issues.find(x => x.kind === "oop" && x.name === pl.name);
	return { refuses: pl.refusesPos, text: is && is.text };
});
check("played out of position a third time, he refuses to play there", !!oop.refuses && /won't play/.test(oop.text || ""), JSON.stringify(oop));

// Each choice has consequences for morale, the dressing room and form.
const choices = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg), out = {};
	for (const ch of [ "talk", "back", "fine", "drop" ]) {
		d.issues = []; d.room = 60;
		const pl = c.squad[F.slotsFor(lg.fmt)[2]];
		pl.morale = 60; pl.form = [ 6.5 ]; pl.temper = 50;
		const b0 = c.budget;
		d.issues.push({ id: ++d.seq, kind: "row", name: pl.name, text: "test row in the dressing room after the game" });
		const note = F.resolveIssue(d.seq, ch);
		out[ch] = { morale: pl.morale, room: d.room, form: pl.form[0], budget: Math.round((c.budget - b0) * 1000), inSide: c.squad.includes(pl), note, left: d.issues.length };
		if (ch === "drop" && !out[ch].inSide) { const j = c.bench.indexOf(pl), k = c.squad.findIndex((q, n) => F.slotsFor(lg.fmt).includes(n) && q.pos === pl.pos); if (j >= 0 && k >= 0) { const q = c.squad[k]; c.squad[k] = pl; c.bench[j] = q; } }
	}
	return out;
});
check("talking to him lifts his morale and the room", choices.talk.morale > 60 && choices.talk.room > 60 && choices.talk.left === 0, JSON.stringify(choices.talk));
check("a fine costs him morale and form, the club gets a week's wages", choices.fine.morale < 60 && choices.fine.form < 6.5 && choices.fine.budget > 0, JSON.stringify(choices.fine));
check("dropping him takes him out of the side", !choices.drop.inSide && choices.drop.morale < 60, JSON.stringify(choices.drop));
check("backing yourself after a row steadies the room", choices.back.room > 60 && choices.back.morale < 60, JSON.stringify(choices.back));

// Refusals: a contract, a move to a smaller club, a move far from home. Each says why and what to do.
const refuse = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg), slots = F.slotsFor(lg.fmt);
	d.issues = []; c.budget = 20;
	const out = c.bench.find(p => p.pos !== "gk"); out.wantsOut = true; out.contract = 1; out.morale = 60; out.age = 25;
	const r1 = F.renewDeal(out, c);
	const key = c.squad[slots[3]]; key.role = "key"; key.morale = 50; key.age = 26; key.contract = 1; key.wantsOut = false; delete key.askPaid;
	const r2 = F.renewDeal(key, c);
	const ask = d.issues.find(i => i.kind === "contract" && i.name === key.name);
	const note = F.resolveIssue(ask.id, "pay");
	const happy = c.squad[slots[4]]; happy.role = "key"; happy.morale = 80; happy.contract = 1; happy.age = 26; happy.wantsOut = false;
	const r3 = F.renewDeal(happy, c);
	return { r1, r2, payNote: note, keyContract: key.contract, r3: r3.ok };
});
check("a player who has asked to leave won't sign, and says what to do", !refuse.r1.ok && /asked to leave/.test(refuse.r1.why) && /sell him/.test(refuse.r1.why), refuse.r1.why);
check("an unsettled key man wants a bigger rise; paying it gets him signed", !refuse.r2.ok && /wants more money/.test(refuse.r2.why) && refuse.keyContract > 1, JSON.stringify(refuse));
check("a happy key man still signs as before", refuse.r3);

const market = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg);
	d.issues = []; lg.round = 0; c.budget = 30;
	let m = null;
	for (let k = 0; k < 400 && !m; k++) { const name = `Test Player ${k}`; if (F.signRefusal({ name, region: "samerica", age: 29, pos: "mid", pac: 70, sho: 70, pas: 70, def: 70, ask: 1 }, c, 1)) { m = name; } }
	const pl = c.market[0]; pl.name = m; pl.region = "samerica"; pl.age = 29; pl.ask = 1; pl.pac = pl.sho = pl.pas = pl.def = 72;
	F.signPlayer(0, 1);
	const refused = c.market.some(p => p.name === m), why = F.lastDeal, is = d.issues.find(i => i.kind === "signing" && i.name === m);
	F.resolveIssue(is.id, "offer");
	const signed = [ ...c.squad, ...c.bench ].some(p => p.name === m);
	return { refused, why, signed, offer: is.offer };
});
check("a player from far away won't come for the asking price, and says so", market.refused && /cold|far from home/.test(market.why) && /Offer/.test(market.why), market.why);
check("offering a quarter more brings him", market.signed && market.offer >= 1.25, JSON.stringify(market));

const sell = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, slots = F.slotsFor(lg.fmt);
	lg.round = 0;
	const pl = c.squad[slots[5]]; pl.role = "key"; pl.wantsOut = false; pl.listed = false;
	lg.clubStr = lg.clubStr.map(() => 5); const small = lg.members.find(id => id !== 0); lg.clubStr[small] = 0.5;
	const r = F.sellRefusal(pl, small);
	F.sellPlayer(pl.name, 2, small);
	const kept = c.squad.includes(pl);
	pl.wantsOut = true;
	const r2 = F.sellRefusal(pl, small);
	pl.wantsOut = false;
	return { why: r && r.why, kept, r2 };
});
check("a first-teamer won't drop down to a smaller club, and you're told how to move him on", sell.kept && /step down/.test(sell.why || "") && sell.r2 === null, JSON.stringify(sell));

// The League panel shows the problems with the four choices.
await page.evaluate(() => {
	const F = window.__ff, lg = F.league, c = lg.club, d = F.ensureDrama(lg), slots = F.slotsFor(lg.fmt);
	d.issues = [];
	F.dramaAfterMatch(new Set(slots.slice(0, -1).map(i => c.squad[i].name)), 0, 3, () => 0);
	const sw = document.querySelector("[data-mode='league'], #modeLeague"); if (sw) { sw.click(); }
	F.renderDrama();
});
const ui = await page.evaluate(() => { const b = document.getElementById("lgDrama"); return b ? { text: b.textContent.slice(0, 300), buttons: [ ...b.querySelectorAll("button") ].map(x => x.textContent) } : null; });
check("the League panel lists the problems with talk, back, fine and drop", ui && [ "Talk to him", "Back yourself", "Fine him", "Drop him" ].every(l => ui.buttons.includes(l)), JSON.stringify(ui));
const shot = process.env.FF_SHOTS;
if (shot) { const box = await page.$("#lgDrama"); if (box) { await box.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${shot}/drama-panel.png` }); } }

// An old save with none of this loads cleanly and is filled in.
const old = await page.evaluate(() => {
	const lg = JSON.parse(JSON.stringify(window.__ff.league));
	delete lg.drama;
	for (const p of [ ...lg.club.squad, ...lg.club.bench ]) { delete p.temper; delete p.benched; delete p.wantsOut; delete p.oopN; }
	localStorage.setItem("ff-league", JSON.stringify(lg));
	return true;
});
await page.reload(); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const mig = await page.evaluate(() => { const lg = window.__ff.league; return { room: lg.drama && lg.drama.room, issues: lg.drama && Array.isArray(lg.drama.issues), tempers: [ ...lg.club.squad, ...lg.club.bench ].every(p => Number.isFinite(p.temper) && p.wantsOut === false) }; });
check("an old save without a dressing room loads and is filled in", old && mig.room === 70 && mig.issues && mig.tempers, JSON.stringify(mig));
const junk = await page.evaluate(() => { const F = window.__ff, lg = F.league; lg.drama = { issues: [ null, { kind: "nonsense" }, 5 ], room: "x", log: 3 }; const d = F.ensureDrama(lg); return { n: d.issues.length, room: d.room, log: Array.isArray(d.log) }; });
check("a damaged dressing room in a save is repaired, not a crash", junk.n === 0 && junk.room === 70 && junk.log, JSON.stringify(junk));

// Flare-ups, in a match: two players square up, others gather, the referee books them or sends one off.
await page.click("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });
const flare = await page.evaluate(() => {
	const F = window.__ff, r = F.commitFoulTest(0.99);
	if (!r) { return null; }
	const gathered = F.players.filter(p => p.flare > 0 && !p.flareWith && p.flareGather).length;
	const d0 = F.dist(r.mate, r.off);
	for (let k = 0; k < 40; k++) { F.flareTick(); }
	return { line: r.line, booked: r.booked.length, sent: r.sent.length, facing: r.mate.flare > 0 && r.mate.flareWith === r.off, gathered, closer: F.dist(r.mate, r.off) <= Math.max(17, d0), log: F.matchLog.slice(-3).map(e => e.kind) };
});
check("a flare-up: they face off, others gather, both are booked, with a line on it", flare && flare.facing && flare.gathered >= 2 && flare.booked === 2 && /pull them apart/.test(flare.line) && flare.log.filter(k => k === "yellow").length === 2, JSON.stringify(flare));
const once = await page.evaluate(() => { const F = window.__ff, o = F.outfield(1)[0], v = F.outfield(0)[0]; F.flaresLive = true; const r = F.flareUp(o, v, true, "Yellow card", { rnd: () => 0 }); F.flaresLive = false; return r; });
check("only one flare-up a match", once === null);
const red = await page.evaluate(() => {
	const F = window.__ff, off = F.outfield(1)[1], mates = F.outfield(0); mates.forEach(p => { p.temper = 85; }); off.temper = 85;
	const n0 = F.players.length, r = F.flareUp(off, mates[0], true, "", { force: true, rnd: () => 0 });
	return { line: r && r.line, sent: r && r.sent.length, gone: n0 - F.players.length };
});
check("two hot-heads: a red for violent conduct and he's off", red.sent === 1 && red.gone === 1 && /violent conduct/.test(red.line), JSON.stringify(red));
if (shot) { await page.evaluate(() => { const F = window.__ff, o = F.outfield(1)[2], v = F.outfield(0)[1]; F.flareUp(o, v, true, "", { force: true, noCards: true, rnd: () => 0.99 }); for (let k = 0; k < 30; k++) { F.flareTick(); } F.state === "play"; }); await page.waitForTimeout(500); await page.screenshot({ path: `${shot}/flare-up.png` }); }

// The flare-up rate, seeded: matches drawn with the fouls and crunching tackles per match measured on the
// real engine (tests/flare-rate.mjs, 300 autopilot matches) and the real tempers of the league's squads.
const rate = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
	const pois = l => { let k = 0, p = Math.exp(-l), s = p; const u = rnd(); while (u > s && k < 20) { k++; p *= l / k; s += p; } return k; };
	const tempers = [ ...lg.club.squad, ...lg.club.bench ].map(F.temperOf);
	const T = () => tempers[Math.floor(rnd() * tempers.length)];
	const M = 3000; let hit = 0;
	for (let m = 0; m < M; m++) {
		const events = [ ...Array(pois(0.12)).fill(1), ...Array(pois(0.23)).fill(0.5), ...Array(pois(0.58)).fill(0.25) ];
		if (events.some(w => rnd() < F.flareChance(Math.max(T(), T()), T(), w))) { hit++; }
	}
	return { rate: hit / M, oneIn: Math.round(M / Math.max(1, hit) * 10) / 10 };
});
check("flare-ups happen in about one match in six to eight (seeded model of the measured fouls)", rate.rate >= 1 / 10 && rate.rate <= 1 / 5, JSON.stringify(rate));

// The half-time row: behind at the break, a hot-head has a go; the choice changes his morale and his second half.
const ht = await page.evaluate(() => {
	const F = window.__ff, out = {};
	F.score[0] = 1; F.score[1] = 1;
	out.level = F.halfTimeRow({ force: true, rnd: () => 0 });
	F.score[0] = 0; F.score[1] = 3;
	out.calm = F.halfTimeRow({ force: true, rnd: () => 0.99 });
	const row = F.halfTimeRow({ force: true, rnd: () => 0 });
	out.text = row && row.text;
	out.buttons = [ ...document.querySelectorAll("#htRow button") ].map(b => b.textContent);
	const p = row && row.p, a0 = p && p.attr.sho, pl = [ ...F.league.club.squad, ...F.league.club.bench ].find(q => q.name === row.name), m0 = pl.morale;
	const r = F.resolveHalfTime("talk");
	out.talk = { morale: [ m0, r.morale ], sho: [ a0, r.attr && r.attr.sho ], again: F.resolveHalfTime("fine") };
	F.halfTimeRow({ force: true, rnd: () => 0 });
	const r2 = F.resolveHalfTime("drop");
	out.drop = { onPitch: r2.onPitch, note: r2.note };
	return out;
});
check("level at half-time, or a calm night: no row", ht.level === null && ht.calm === null, JSON.stringify(ht));
check("three down at half-time: a row on the half-time card with the four choices", /down/.test(ht.text || "") && [ "Talk to him", "Back yourself", "Fine him", "Drop him" ].every(l => ht.buttons.includes(l)), JSON.stringify(ht));
check("talking to him lifts his morale and his second half, and the choice is made once", ht.talk.morale[1] > ht.talk.morale[0] && ht.talk.sho[1] === Math.min(99, ht.talk.sho[0] + 2) && ht.talk.again === null, JSON.stringify(ht.talk));
check("dropping him at half-time takes him off", ht.drop.onPitch === false && /hooked at half-time/.test(ht.drop.note), JSON.stringify(ht.drop));
if (shot) { await page.evaluate(() => { const F = window.__ff; F.score[0] = 0; F.score[1] = 2; F.halfTime(); F.halfTimeRow({ force: true, rnd: () => 0 }); }); await page.waitForTimeout(400); await page.screenshot({ path: `${shot}/half-time-row.png` }); }

const voice = await page.evaluate(() => window.__ff.voiceState());
check("the commentary voice stays off and silent in the test mode", voice.on === false && voice.spoke === false && voice.button === false, JSON.stringify(voice));

const mus = await page.evaluate(() => { const F = window.__ff, a = F.musicState(); F.setMusicVol("quiet"); const b = F.musicState(), stored = localStorage.getItem("ff-music-vol"); F.setMusicVol("normal"); return { a, b, stored, g1: F.grooveBarTest(1), g2: F.grooveBarTest(2) }; });
check("three menu tracks take turns, with a saved music volume setting", mus.a.tracks.length === 3 && mus.a.sel && mus.b.level < mus.a.level && mus.stored === "quiet", JSON.stringify(mus));
check("the new tracks play a bar without errors", mus.g1 && mus.g2);

check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
