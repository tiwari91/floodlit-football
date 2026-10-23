// Run: node tests/leaguefile.mjs   (version 2 option files: whole leagues, the continental cup, playing in another league)
// Every name here is invented for the test.
import fs from "node:fs";
import path from "node:path";
import { launch, serve, tally, root } from "./_env.mjs";
const server = serve(8805), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const spec = JSON.parse(fs.readFileSync(path.join(root, "docs", "option-file-schema.json"), "utf8"));
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: false });
const page = await ctx.newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 200)); } });
const ready = async () => { await page.waitForSelector("#ovButton"); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.switchLeague, null, { timeout: 60000 }); };

// Invented names: letters only, so they pass the player-name check.
const L = "abcdefghijklmnopqrstuvwxyz";
const word = (n, k) => L[n % 26].toUpperCase() + L[(n * 7 + k) % 26] + L[(n * 3 + 5) % 26] + L[(n + k * 11) % 26] + "o";
const players = (seed, n = 11) => Array.from({ length: n }, (_, j) => ({ slot: j, name: `${word(seed + j, 1)} ${word(seed * 3 + j, 2)}`, nat: "ENG", shirt: j + 1, foot: j % 3 ? "right" : "left", pos: [ "gk", "def", "def", "def", "def", "mid", "mid", "mid", "mid", "fwd", "fwd" ][j], age: 20 + j, trait: j === 9 ? "poacher" : "", lk: { skin: "#c68a5e", hair: "#1b1410", style: "short", face: j }, pac: 70, sho: 60 + j, pas: 70, def: 50 }));
const league = (tag, n, seed) => ({ clubs: Array.from({ length: n }, (_, i) => ({ slot: i + 1, name: `${tag} Club ${word(seed + i, 3)}`, short: `${tag}${i + 1}`, color: "#1d4fa0", color2: "#ffffff", ground: `${tag} Ground ${i + 1}`, manager: `${word(seed + i, 4)} ${word(seed + i, 5)}`, managerNat: "ITA", players: players(seed + i * 13) })) });
const v2 = {
	kind: "floodlit-option-file", version: 2, customRatings: true,
	leagues: { ENG: league("Eng", 20, 100), ESP: league("Esp", 20, 300), SCO: league("Sco", 2, 500) },
	cup: { GER: [ 1, 2, 3, 4 ].map(i => ({ name: `Ger Cup ${word(i, 6)}`, short: `Ger${i}`, color: "#c8102e", color2: "#ffffff", ground: `Ger Ground ${i}`, manager: `Coach ${word(i, 7)}`, players: players(700 + i * 13) })) },
	futureSection: {}
};
try {
	await page.goto(URL); await ready();

	// The spec matches the game, so the agent writing a file from it gets the slots right.
	const facts = await page.evaluate(() => { const F = window.__ff; return { nats: F.LEAGUE_NATS, pos: F.POS_OF_SLOT, bench: F.BENCH_POS, cc: F.CC_NATIONS, strs: F.CLUB_STRS, rivals: F.RIVALS, slots: F.TEAMS.length - 1, natl: Object.keys(F.NATIONS), looks: F.LOOKS, traits: F.TRAIT_KEYS }; });
	const ccSeats = Object.fromEntries(facts.cc.filter(c => c[1]).map(c => [ c[0], c[1] ]));
	check("the spec matches the game: countries, slots, positions, strengths, derbies, cup seats, looks",
		JSON.stringify(Object.keys(spec.leagueCountries)) === JSON.stringify(facts.nats) && JSON.stringify(spec.squad.positionBySlot) === JSON.stringify(facts.pos) &&
		JSON.stringify(spec.squad.yourBenchPositions) === JSON.stringify(facts.bench) && spec.league.slotCount === facts.slots &&
		JSON.stringify(Object.values(spec.league.startingStrengthBySlot)) === JSON.stringify(facts.strs) && JSON.stringify(spec.league.derbiesBySlot) === JSON.stringify(facts.rivals) &&
		JSON.stringify(spec.cup.seatsByCountry) === JSON.stringify(ccSeats) && JSON.stringify(spec.nationalities) === JSON.stringify(facts.natl) &&
		JSON.stringify(spec.look.skin) === JSON.stringify(facts.looks.skin) && JSON.stringify(spec.look.style) === JSON.stringify(facts.looks.style) && JSON.stringify(Object.keys(spec.traits)) === JSON.stringify(facts.traits), JSON.stringify({ nats: facts.nats.length, seats: ccSeats }));

	// A career abroad, in Spain, with no file yet.
	await page.evaluate(() => { window.__ff.clearLeagueFile(); return window.__ff.switchLeague("ESP", { mode: "new" }); });
	const spain = await page.evaluate(() => ({ nat: window.__ff.leagueCountry(window.__ff.league), name: window.__ff.TEAMS[1].name }));
	check("Play in another league starts a career in Spain", spain.nat === "ESP" && !/Club/.test(spain.name), JSON.stringify(spain));

	// The v2 file imports: per-country counts, the unknown country named, the way to England shown.
	const read = await page.evaluate(t => { const F = window.__ff, r = F.readOptionFile(t, F.league); return { err: r.error, lines: r.sum ? F.previewText(r.sum) : [] }; }, JSON.stringify(v2));
	const pv = read.lines.join(" ");
	check("a v2 file with two countries and cup clubs reads, with per-country counts", !read.err && /England 20 clubs \/ 220 players; Spain 20 clubs \/ 220 players; Continental cup 4 clubs/.test(pv), pv);
	check("the preview names the unknown country and says where England shows", /SCO/.test(pv) && /Play in another league/.test(pv) && /section/.test(pv), pv);

	// Applied while abroad: Spain's clubs and players are the file's at once.
	const applied = await page.evaluate(t => {
		const F = window.__ff, lg = F.league, r = F.readOptionFile(t, lg);
		const kept = F.applyOptionFile(lg, r, "now", true); F.afterEdit();
		const sq = F.cpuSquad(1, F.getStr(1));
		return { kept, names: lg.members.filter(i => i).map(i => F.TEAMS[i].name), mgr: F.TEAMS[1].manager, p0: sq[0].name, p9: { ...sq[9] }, stored: !!localStorage.getItem("ff-leaguefile") };
	}, JSON.stringify(v2));
	check("applying it while abroad shows the file's clubs in that league", applied.kept && applied.stored && applied.names.every(n => /^Esp Club/.test(n)), JSON.stringify(applied.names.slice(0, 3)));
	check("their squads are the file's eleven, with age, trait, ratings and the manager", /^[A-Z]/.test(applied.p0) && applied.p9.trait === "poacher" && applied.p9.age === 29 && applied.p9.sho === 69 && /\w/.test(applied.mgr || ""), JSON.stringify({ p9: applied.p9.name, mgr: applied.mgr }));
	const panel = await page.evaluate(() => { window.__ff.renderLeagueTest(); return document.getElementById("clubGrid").textContent; });
	check("the club card shows the manager", /Manager \w+ \w+ \(Italy\)/.test(panel), panel.slice(0, 120));

	// The cup: England takes Spain's seats from the file, Germany's guests are the file's cup clubs.
	const cup = await page.evaluate(() => {
		const F = window.__ff, lg = F.league;
		const C = F.drawCont(lg, [ 0, ...lg.members.filter(i => i).slice(0, 3) ]);
		return { n: C.clubs.length, eng: C.clubs.filter(c => c.nat === "ENG").map(c => c.name), ger: C.clubs.filter(c => c.nat === "GER").map(c => c.name), mgr: (C.clubs.find(c => c.nat === "GER") || {}).manager };
	});
	check("the cup uses file clubs: England from the league file, Germany from the cup list", cup.n === 36 && cup.eng.length === 4 && cup.eng.every(n => /^Eng Club/.test(n)) && cup.ger.every(n => /^Ger Cup/.test(n)) && cup.ger.length === 4 && !!cup.mgr, JSON.stringify(cup));
	const guest = await page.evaluate(() => { const F = window.__ff, ov = F.fileOverlay(F.league); return Object.keys(ov.slots).some(k => /^Ger Cup .+#9$/.test(k)) && Object.keys(ov.slots).some(k => /^Eng Club .+#0$/.test(k)); });
	check("cup guests' players are found by the guest's name", guest);

	// Reload: the file stays in this browser, the Spanish clubs stay renamed.
	await page.reload(); await ready();
	const after = await page.evaluate(() => ({ nat: window.__ff.leagueCountry(window.__ff.league), name: window.__ff.TEAMS[1].name, ident: JSON.stringify(window.__ff.league.ident) }));
	check("after a reload the league file still applies, and the save's identities hold no file names", after.nat === "ESP" && /^Esp Club/.test(after.name) && !/Esp Club/.test(after.ident), after.name);

	// Play in England at one of the file's clubs, through the Leagues tab.
	await page.evaluate(() => window.__ff.openEditor("leagues"));
	await page.selectOption("#lsNat", "ENG");
	await page.selectOption("#lsClub", "4");
	await page.uncheck("#lsBackup");
	await page.click("#lsGo"); await page.click("#lsGo"); await page.waitForTimeout(400);
	const eng = await page.evaluate(() => { const F = window.__ff, lg = F.league; return { nat: F.leagueCountry(lg), you: F.TEAMS[0].name, div: lg.members.filter(i => i).map(i => F.TEAMS[i].name), squad0: lg.club.squad[0].name, n: lg.club.squad.length + lg.club.bench.length }; });
	check("the Leagues tab starts a career in England at a file club", eng.nat === "ENG" && /^Eng Club/.test(eng.you) && eng.n === 18, JSON.stringify({ you: eng.you, n: eng.n }));
	check("the division is all file clubs: the twentieth fills the place you left", eng.div.length === 19 && eng.div.every(n => /^Eng Club/.test(n)) && !eng.div.includes(eng.you), JSON.stringify(eng.div.filter(n => !/^Eng Club/.test(n))));

	// Move your club, keeping its squad, to another league.
	const moved = await page.evaluate(() => { const F = window.__ff, before = F.league.club.squad.map(p => p.id).join(); const r = F.switchLeague("GER", { mode: "move" }); return { r, nat: F.leagueCountry(F.league), same: F.league.club.squad.map(p => p.id).join() === before, you: F.TEAMS[0].name, cq: F.league.club.contQual }; });
	check("moving your club keeps the squad and its name, in the new league", moved.r.ok && moved.nat === "GER" && moved.same && /^Eng Club/.test(moved.you) && !moved.cq, JSON.stringify(moved));

	const clash = await page.evaluate(() => { const F = window.__ff, lg = F.league, C = F.drawCont(lg, [ 0, ...lg.members.filter(i => i).slice(0, 3) ]), names = C.clubs.map(c => (c.id !== undefined ? F.TEAMS[c.id].name : c.name).toLowerCase()); return { n: C.clubs.length, dup: names.length - new Set(names).size, eng: C.clubs.filter(c => c.nat === "ENG").length }; });
	check("abroad with a club from the file, the cup never draws a guest with your club's name", clash.n === 36 && clash.dup === 0 && clash.eng === 4, JSON.stringify(clash));

	// A v1 file still works.
	const v1 = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, base = F.clubTargets()[2].base;
		const r = F.readOptionFile(JSON.stringify({ kind: "floodlit-option-file", version: 1, clubs: { [base]: { name: "Version One Town" } }, slots: { [`${base}#9`]: { name: "Vee Onesmith" } } }), lg);
		F.applyOptionFile(lg, r, "now", false); F.afterEdit();
		return { err: r.error, name: F.TEAMS[2].name, p: F.cpuSquad(2, F.getStr(2))[9].name };
	});
	check("a v1 file still imports and applies", !v1.err && v1.name === "Version One Town" && v1.p === "Vee Onesmith", JSON.stringify(v1));

	// Malformed input is refused or skipped.
	const bad = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, rd = o => F.readOptionFile(typeof o === "string" ? o : JSON.stringify(o), lg);
		const K = "floodlit-option-file";
		const out = [ rd("{nope"), rd({ kind: K, version: 3 }), rd({ kind: K, version: 2, leagues: [] }), rd({ kind: "x" }) ].map(r => r.error || "ok");
		const skip = rd({ kind: K, version: 2, leagues: { ENG: { clubs: [ { slot: 0, name: "Zero Slot" }, { slot: 3, name: "<b>" }, { slot: 5, name: "Fine Club", color: "red", players: [ { name: "R2-D2" }, { name: "Ok Name", age: 70 } ] } ] }, XYZ: { clubs: [] } }, cup: { ESP: "no" } });
		return { out, n: skip.sum.countries, bad: skip.sum.bad, unk: skip.sum.unknownNats };
	});
	check("malformed files are refused, bad entries skipped and counted", bad.out.every(e => e !== "ok") && bad.n.length === 1 && bad.n[0].clubs === 1 && bad.n[0].players === 1 && bad.bad >= 5 && bad.unk.includes("XYZ"), JSON.stringify(bad));

	// An old save (before league files): no ident country, no edits; it loads and plays at home.
	await page.evaluate(() => {
		const lg = JSON.parse(JSON.stringify(window.__ff.league));
		delete lg.edits; delete lg.ident;
		localStorage.setItem("ff-league", JSON.stringify(lg));
		localStorage.removeItem("ff-leaguefile");
	});
	await page.reload(); await ready();
	const old = await page.evaluate(() => ({ nat: window.__ff.leagueCountry(window.__ff.league), n: window.__ff.league.members.length, t1: window.__ff.TEAMS[1].name }));
	check("an old save loads", old.nat === "ENG" && old.n === 20 && !!old.t1, JSON.stringify(old));
	check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} catch (e) {
	check("the run finished", false, String(e && e.stack || e).slice(0, 400));
}
await browser.close();
server.stop();
process.exit(done() ? 1 : 0);
