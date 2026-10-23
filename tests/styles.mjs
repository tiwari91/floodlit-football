// Run: node tests/styles.mjs   League and country styles (05a): squads tilt by league, strength per tier stays put,
// a player keeps a little of his own country's game, squads are deterministic, saves load.
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8803), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 200)); } });
const ready = () => page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.styleOf, null, { timeout: 60000 });
await page.goto(URL); await page.waitForSelector("#ovButton"); await ready();

// Every country in the game has a style, with the fields the generator reads.
const cover = await page.evaluate(() => {
	const F = window.__ff, missing = [];
	for (const nat of Object.keys(F.NAT_STYLE)) { const s = F.styleOf(nat); if (!s || !s.tag || s.r.length !== 4 || !(s.sp > 0) || !(s.lvl >= 1 && s.lvl <= 5)) { missing.push(nat); } }
	return { n: Object.keys(F.NAT_STYLE).length, missing };
});
check("all 32 countries have a style profile", cover.n === 32 && !cover.missing.length, JSON.stringify(cover));

// The league's squads at each tier, styled for a country, against the old unstyled generator on the same seeds.
const stats = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, NATS = [ "ENG", "ESP", "ITA", "GER", "FRA", "NED", "POR", "BRA", "ARG", "USA", "NGA", "JPN" ];
	const sl = F.slotsFor(lg.fmt), ovr = p => { const w = F.OVR_W[p.pos]; return Math.round(p.pac * w[0] + p.sho * w[1] + p.pas * w[2] + p.def * w[3]); };
	const had = lg.ident ? { ...lg.ident } : null;
	lg.ident = lg.ident || {};
	const plain = (id, str) => {   // cpuSquad as it was before styles
		let h = (id * 7919 + lg.season * 104729) % 2147483647 || 1;
		const rnd = () => { h = (h * 48271) % 2147483647; return h / 2147483647; };
		return F.POS_OF_SLOT.map((pos, i) => F.genPlayer(pos, 50 + str * 7 + Math.round((rnd() * 2 - 1) * 4) + (i === 9 || i === 2 ? 3 : 0), null, rnd, false));
	};
	const out = { tiers: {}, tilt: {}, plainTiers: [] };
	for (let str = 1; str <= 5; str++) {
		let t = 0, n = 0;
		for (let id = 500; id < 900; id++) { const sq = plain(id, str); for (const i of sl) { t += ovr(sq[i]); n++; } }
		out.plainTiers.push(t / n);
	}
	for (const nat of NATS) {
		lg.ident.country = nat === "ENG" ? undefined : nat;
		const sum = { pac: 0, sho: 0, pas: 0, def: 0, n: 0, age: 0, na: 0 }, tiers = [];
		for (let str = 1; str <= 5; str++) {
			let t = 0, n = 0;
			for (let id = 500; id < 900; id++) {
				const sq = F.cpuSquad(id, str);
				for (const i of sl) { t += ovr(sq[i]); n++; }
				for (const p of sq) { sum.age += p.age; sum.na++; if (p.pos !== "gk") { for (const k of [ "pac", "sho", "pas", "def" ]) { sum[k] += p[k]; } sum.n++; } }
			}
			tiers.push(t / n);
		}
		out.tiers[nat] = tiers;
		out.tilt[nat] = { pac: sum.pac / sum.n, sho: sum.sho / sum.n, pas: sum.pas / sum.n, def: sum.def / sum.n, age: sum.age / sum.na };
	}
	if (had) { lg.ident = had; } else { delete lg.ident.country; }
	return out;
});
const r1 = v => v.toFixed(1);
console.log("country  PAC   SHO   PAS   DEF   age   | XI overall by tier 1..5");
console.log(`(none)                                  | ${stats.plainTiers.map(r1).join(" ")}`);
for (const [ nat, t ] of Object.entries(stats.tilt)) { console.log(`${nat}      ${r1(t.pac)}  ${r1(t.sho)}  ${r1(t.pas)}  ${r1(t.def)}  ${r1(t.age)}  | ${stats.tiers[nat].map(r1).join(" ")}`); }
const T = stats.tilt;
check("pace: the English-style league is quicker than the Italian-style one", T.ENG.pac > T.ITA.pac + 1.5, `${r1(T.ENG.pac)} vs ${r1(T.ITA.pac)}`);
check("passing: the Spanish-style league passes better than the English and Italian ones", T.ESP.pas > T.ENG.pas + 1.5 && T.ESP.pas > T.ITA.pas + 1, `${r1(T.ESP.pas)} vs ${r1(T.ENG.pas)} / ${r1(T.ITA.pas)}`);
check("defending: the Italian-style league defends best", Object.keys(T).every(n => n === "ITA" || T.ITA.def > T[n].def), JSON.stringify(Object.fromEntries(Object.entries(T).map(([ n, t ]) => [ n, r1(t.def) ]))));
check("flair: the Brazilian-style league shoots more and defends less than the Italian one", T.BRA.sho > T.ITA.sho && T.BRA.def < T.ITA.def - 3, `${r1(T.BRA.sho)}/${r1(T.BRA.def)} vs ${r1(T.ITA.sho)}/${r1(T.ITA.def)}`);
check("age: Dutch-style squads are younger than Italian-style ones", T.NED.age < T.ITA.age - 2, `${r1(T.NED.age)} vs ${r1(T.ITA.age)}`);
const worst = Math.max(...Object.values(stats.tiers).flatMap(t => t.map((v, i) => Math.abs(v - stats.plainTiers[i]))));
check("strength per tier unchanged: every style's XI overall within 0.6 of the old generator at every tier", worst < 0.6, `worst gap ${worst.toFixed(2)}`);

// Nationality lean, determinism, the continental guest.
const misc = await page.evaluate(() => {
	const F = window.__ff, lg = F.league;
	const seeded = s => { let h = s; return () => { h = (h * 48271) % 2147483647; return h / 2147483647; }; };
	const lean = { bra: { sho: 0, def: 0 }, eng: { sho: 0, def: 0 } };
	for (let s = 1; s < 1500; s++) {
		for (const [ k, nat ] of [ [ "bra", "BRA" ], [ "eng", "ENG" ] ]) { const p = F.genPlayer("fwd", 60 + (s % 20) + (s % 7) / 7, `X${s}`, seeded(s), { lg: "ENG", nat }); lean[k].sho += p.sho; lean[k].def += p.def; }
	}
	const strip = sq => JSON.stringify(sq.map(p => [ p.name, p.pos, p.pac, p.sho, p.pas, p.def, p.age, p.trait, p.nat ]));
	const det = strip(F.cpuSquad(5, 3)) === strip(F.cpuSquad(5, 3));
	const keepG = lg.contGuest, keepC = lg.cont;
	lg.contGuest = { slot: 7, key: "Test Club", nat: "ESP" };
	const guest = F.clubNat(7), other = F.clubNat(6);
	lg.contGuest = { slot: 7, key: "Old Guest" }; lg.cont = { clubs: [ { name: "Old Guest", nat: "ITA" } ] };
	const oldGuest = F.clubNat(7);
	lg.contGuest = { slot: 7, key: "Nobody" };
	const noNat = F.clubNat(7);
	lg.contGuest = keepG; lg.cont = keepC;
	const exact = (() => { let bad = 0; for (let s = 1; s < 400; s++) { for (const pos of [ "gk", "def", "mid", "fwd" ]) { const a = F.genPlayer(pos, 60 + (s % 25), `Y${s}`, seeded(s), false), b = { ...a }; F.applyTilt(b, pos, [ 4, -2, 3, -5 ]); const o = p => { const w = F.OVR_W[p.pos]; return Math.round(p.pac * w[0] + p.sho * w[1] + p.pas * w[2] + p.def * w[3]); }; if (o(a) !== o({ ...b, pos })) { bad++; } } } return bad; })();
	return { lean: { bra: { sho: lean.bra.sho / 1499, def: lean.bra.def / 1499 }, eng: { sho: lean.eng.sho / 1499, def: lean.eng.def / 1499 } }, det, guest, other, oldGuest, noNat, home: F.leagueNat(), exact };
});
check("a Brazilian in an English-style league keeps some flair: more shooting, less defending than an Englishman", misc.lean.bra.sho > misc.lean.eng.sho + 0.2 && misc.lean.bra.def < misc.lean.eng.def - 0.8, JSON.stringify(misc.lean));
check("a tilt never changes a player's overall", misc.exact === 0, `${misc.exact} changed`);
check("the computer's squads are deterministic", misc.det);
check("a continental guest plays its own country's game; older saves without its nat fall back safely", misc.guest === "ESP" && misc.other === misc.home && misc.oldGuest === "ITA" && misc.noNat === misc.home, JSON.stringify(misc));

// The UI line, then a save and a reload: stored players come back exactly as they were.
const ui = await page.evaluate(() => { const F = window.__ff; F.renderLeague(); return { note: document.getElementById("clubsNote").textContent, title: document.getElementById("lgDivName").title, market: [ ...document.querySelectorAll("#league .swap") ].map(e => e.textContent).find(t => /style:/.test(t)) || "" }; });
check("the league shows its style in one line", /League style: high-tempo, physical\./.test(ui.note) && /level 5 of 5/.test(ui.title), JSON.stringify(ui));
const before = await page.evaluate(() => { const F = window.__ff, c = F.league.club; F.saveLeague(); return JSON.stringify([ ...c.squad, ...c.bench ].map(p => [ p.name, p.pac, p.sho, p.pas, p.def, p.age, p.trait, p.nat ])); });
await page.reload(); await page.waitForSelector("#ovButton"); await ready();
const after = await page.evaluate(() => { const c = window.__ff.league.club; return JSON.stringify([ ...c.squad, ...c.bench ].map(p => [ p.name, p.pac, p.sho, p.pas, p.def, p.age, p.trait, p.nat ])); });
check("a save reloads with every stored player unchanged", before === after);
check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
