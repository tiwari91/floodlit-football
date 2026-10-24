// Run: node tests/intl.mjs   National teams: squads picked from the save, their strength, the Nations card.
import { launch, serve, tally, showTab } from "./_env.mjs";
const server = serve(8813), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 200)); } });
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.nationSquads, null, { timeout: 60000 });

const sq = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, list = F.nationSquads(lg), pool = F.intlPool(lg);
	const P = F.POS_OF_SLOT, ovr = p => F.ovrOf ? F.ovrOf(p) : 0;
	const bad = [];
	for (const s of list) {
		if (s.xi.length !== 11 || s.xi.some((e, i) => e.pl.pos !== P[i])) { bad.push(`${s.nat} shape`); }
		if ([ ...s.xi, ...s.bench ].some(e => e.pl.nat !== s.nat)) { bad.push(`${s.nat} nat`); }
		if (!(s.str >= 1 && s.str <= 5)) { bad.push(`${s.nat} str ${s.str}`); }
		if (s.bench.length > 5) { bad.push(`${s.nat} bench`); }
		// The best player in the save at each position is in the eleven.
		for (const pos of [ "gk", "def", "mid", "fwd" ]) {
			const best = pool.filter(e => e.pl.nat === s.nat && e.pl.pos === pos).sort((a, b) => ovr(b.pl) - ovr(a.pl))[0];
			const same = (a, b) => a.name === b.name && a.pos === b.pos && ovr(a) === ovr(b);
			if (best && !s.xi.some(e => same(e.pl, best.pl))) { bad.push(`${s.nat} best ${pos}`); }
		}
		if (s.ident.name !== F.NATIONS[s.nat][0] || s.ident.short !== s.nat || !s.ident.color || !s.ident.color2) { bad.push(`${s.nat} ident`); }
	}
	const sorted = list.every((s, i) => i === 0 || list[i - 1].ovr >= s.ovr);
	return { n: list.length, nations: Object.keys(F.NATIONS).length, bad, sorted, same: F.nationSquads(lg) === list, inv: F.strOfOvr(71) === 3 && F.strOfOvr(85) === 5 && F.strOfOvr(40) === 1 };
});
check("every country has a squad, eleven by position plus a bench, only its own players", sq.n === sq.nations && sq.bad.length === 0, JSON.stringify(sq.bad.slice(0, 8)));
check("the best player in each position makes the eleven, and the list runs strongest first", sq.sorted && !sq.bad.some(b => / best /.test(b)), JSON.stringify(sq));
check("strength maps back onto the 1..5 scale the way cpuOvr maps it out", sq.inv);
check("the squads are cached for the half-season", sq.same);

// Your own player of another nationality, made the best in the save: he is picked, and the cache notices.
const yours = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, pl = lg.club.squad[9];
	const before = F.nationSquads(lg);
	Object.assign(pl, { nat: "URU", pac: 96, sho: 96, pas: 96, def: 60, name: "Test Striker" });
	const after = F.nationSquads(lg), s = after.find(x => x.nat === "URU");
	return { rebuilt: before !== after, picked: s.xi.some(e => e.pl === pl && e.own), fwd: s.xi[9].pl === pl || s.xi[10].pl === pl };
});
check("your own player is called up when he is the best (and the cache rebuilds)", yours.rebuilt && yours.picked && yours.fwd, JSON.stringify(yours));

// A country with nobody in the save: eleven uncapped players, a weak side.
const empty = await page.evaluate(() => {
	const F = window.__ff, lg = F.league, pool = F.intlPool(lg);
	const nat = "JPN", s = F.pickNation(nat, pool.filter(e => e.pl.nat !== nat), lg);
	return { nat, filled: s.filled, count: s.count, str: s.str, gen: s.xi.every(e => e.gen) };
});
check("a country with no players in the save is filled with uncapped players and stays weak", (empty.filled === 11 && empty.count === 0 && empty.gen && empty.str <= 2.5), JSON.stringify(empty));

// The Nations card on the Cups tab, and it fits a phone.
await showTab(page, "cups");
const card = await page.evaluate(() => { window.__ff.renderLeague(); const c = document.querySelector(".lg-nations"); return c ? { rows: c.querySelectorAll(".nat-list > li").length, h: c.querySelector("h4").textContent } : null; });
check("the Cups tab has a Nations card with a row per country", card && card.h === "Nations" && card.rows === sq.nations, JSON.stringify(card));
await page.setViewportSize({ width: 390, height: 844 });
const phone = await page.evaluate(() => { const c = document.querySelector(".lg-nations"); c.querySelector("details").open = true; return { sw: c.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth <= window.innerWidth }; });
check("the Nations card fits a phone screen", phone.sw <= phone.cw + 1 && phone.doc, JSON.stringify(phone));

check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close();
process.exit(done() ? 1 : 0);
