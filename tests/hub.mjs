// Run: node tests/hub.mjs   (the manager hub: the tabs under the pitch, their panels, badges and the phone layout)
import { launch, serve, tally, devices, showTab } from "./_env.mjs";
const server = serve(8804), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const TABS = [ "overview", "squad", "league", "cups", "transfers", "club", "settings", "help" ];
// What each panel must show once it is open.
const KEY = { overview: [ "lgNext", "lgDrama" ], squad: [ "lineup", "sqBody", "autoPick" ], league: [ "lgBody", "lgUpcoming", "lgForecast", "clubGrid" ], cups: [ "lgExtras" ], transfers: [ "winMarket", "mkTabs" ], club: [ "coachPanel", "staffList", "winUpgrades", "assist" ], settings: [ "lgNew", "lgEdit", "lgLeagues", "format", "level", "camBtn", "soundBtn" ], help: [ "panel-help" ] };
const ready = page => page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.showTab, null, { timeout: 60000 });
const seen = id => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0; };
try {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("ff-big", "0"); sessionStorage.setItem("seeded", "1"); } } catch (e) { /* storage blocked */ } });
	const page = await ctx.newPage();
	const errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	await page.goto(URL); await ready(page); await page.waitForTimeout(500);

	const a11y = await page.evaluate(() => {
		const tl = document.querySelector("[role=tablist]"), tabs = [ ...tl.querySelectorAll("[role=tab]") ];
		return { n: tabs.length, sel: tabs.filter(t => t.getAttribute("aria-selected") === "true").length, panels: tabs.every(t => { const p = document.getElementById(t.getAttribute("aria-controls")); return p && p.getAttribute("role") === "tabpanel" && p.getAttribute("aria-labelledby") === t.id; }), roving: tabs.filter(t => t.tabIndex === 0).length, matchBtns: document.getElementById("pauseBtn").compareDocumentPosition(tl) & Node.DOCUMENT_POSITION_FOLLOWING };
	});
	check("eight tabs in a tablist, one selected, each with its tabpanel, one tab in the tab order", a11y.n === 8 && a11y.sel === 1 && a11y.panels && a11y.roving === 1, JSON.stringify(a11y));
	check("the match buttons sit above the tabs, never inside one", !!a11y.matchBtns);

	const heights = {};
	for (const t of TABS) {
		await showTab(page, t);
		const r = await page.evaluate(([ t, ids, seenSrc ]) => {
			const seen = eval(seenSrc);
			const open = [ ...document.querySelectorAll("[role=tabpanel]") ].filter(p => !p.hidden).map(p => p.id);
			return { open, missing: ids.filter(id => !seen(id)), h: document.documentElement.scrollHeight };
		}, [ t, KEY[t], seen.toString() ]);
		heights[t] = r.h;
		check(`${t}: only its panel is open and its key content shows`, r.open.length === 1 && r.open[0] === `panel-${t}` && !r.missing.length, JSON.stringify(r));
	}
	const lineup = await page.evaluate(() => { document.getElementById("tab-squad").click(); const l = document.getElementById("lineup").getBoundingClientRect(); return { w: Math.round(l.width), h: Math.round(l.height) }; });
	check("the formation pitch draws at full size when its tab opens", lineup.w > 300 && lineup.h > 200, JSON.stringify(lineup));
	check("with a tab open the page is far shorter than the one long page (11,908 px)", heights.overview < 3000 && heights.squad < 4000 && heights.league < 4000, JSON.stringify(heights));

	// The assistant manager is the first card on the Club tab, and Settings > Your team points to it.
	await showTab(page, "club");
	const ac = await page.evaluate(() => {
		const grid = document.querySelector("#panel-club .club-grid-hub"), first = grid.firstElementChild;
		return { first: first.id, head: first.querySelector("h4").textContent, holds: first.contains(document.getElementById("assist")) };
	});
	check("the assistant manager is the first card on the Club tab, under its own heading", ac.first === "assistCard" && ac.head === "Assistant manager" && ac.holds, JSON.stringify(ac));
	await page.evaluate(() => window.__ff.setAssist("contracts"));
	await showTab(page, "settings");
	const link = await page.evaluate(() => { const b = document.getElementById("assistLink"); return { seen: b.getClientRects().length > 0, text: b.textContent, inTeam: !!b.closest("[aria-labelledby=bgTeam]") }; });
	await page.click("#assistLink"); await page.waitForTimeout(150);
	const went = await page.evaluate(() => ({ sel: document.querySelector("[role=tab][aria-selected=true]").id, focus: document.activeElement.id, state: document.getElementById("assistState").textContent }));
	check("Settings > Your team shows the assistant's mode and its shortcut lands on the setting in Club", link.seen && link.inTeam && /Contracts/.test(link.text) && went.sel === "tab-club" && went.focus === "assist" && went.state === "Contracts", JSON.stringify({ link, went }));
	await page.evaluate(() => window.__ff.setAssist("off"));

	// Arrow keys move along the tabs (and not the player); Home and End jump to the ends.
	await showTab(page, "squad");
	await page.focus("#tab-squad"); await page.keyboard.press("ArrowRight");
	const k1 = await page.evaluate(() => ({ focus: document.activeElement.id, sel: document.querySelector("[role=tab][aria-selected=true]").id }));
	await page.keyboard.press("End");
	const k2 = await page.evaluate(() => document.activeElement.id);
	await page.keyboard.press("ArrowRight");
	const k3 = await page.evaluate(() => document.activeElement.id);
	check("arrow keys, Home and End move the selection and focus along the tabs", k1.focus === "tab-league" && k1.sel === "tab-league" && k2 === "tab-help" && k3 === "tab-overview", JSON.stringify({ k1, k2, k3 }));

	// The tab you picked survives a reload.
	await showTab(page, "transfers");
	await page.reload(); await ready(page); await page.waitForTimeout(300);
	const kept = await page.evaluate(() => ({ sel: document.querySelector("[role=tab][aria-selected=true]").id, open: !document.getElementById("panel-transfers").hidden }));
	check("the selected tab is remembered across a reload", kept.sel === "tab-transfers" && kept.open, JSON.stringify(kept));

	// Badges: a dressing-room problem and a bid for one of your players.
	await page.evaluate(() => { const F = window.__ff, lg = F.league; F.ensureDrama(lg).issues = []; lg.bidsIn = []; F.renderLeagueTest(); return null; });
	await page.waitForTimeout(150);
	const b0 = await page.evaluate(() => ({ ov: document.getElementById("badge-overview").hidden, tr: document.getElementById("badge-transfers").hidden }));
	await page.evaluate(() => {
		const F = window.__ff, lg = F.league, c = lg.club, slots = F.slotsFor(lg.fmt);
		const played = new Set(slots.map(i => c.squad[i].name));
		F.dramaAfterMatch(played, 0, 4, () => 0);
		const pl = c.squad[slots[3]];
		lg.bidsIn = [ { name: pl.name, club: lg.members.find(id => id !== 0), fee: 3 } ];
		F.renderLeagueTest();
	});
	await page.waitForTimeout(150);
	const b1 = await page.evaluate(() => ({ ov: document.getElementById("badge-overview").textContent, tr: document.getElementById("badge-transfers").textContent, label: document.getElementById("tab-overview").getAttribute("aria-label") }));
	check("no badges when nothing waits; a count on Overview for a dressing-room issue and on Transfers for a bid", b0.ov && b0.tr && Number(b1.ov) >= 1 && b1.tr === "1" && /issue/.test(b1.label), JSON.stringify({ b0, b1 }));

	// A friendly has no league: only Settings and Help, and the match buttons stay.
	await page.click("#modeFriendly"); await page.waitForTimeout(300);
	const fr = await page.evaluate(() => ({ tabs: [ ...document.querySelectorAll("[role=tab]") ].filter(t => !t.hidden).map(t => t.dataset.tab), sel: document.querySelector("[role=tab][aria-selected=true]").dataset.tab, settings: document.getElementById("format").getClientRects().length > 0 }));
	check("in a friendly only Settings and Help remain, and the hub falls back to Settings", fr.tabs.join() === "settings,help" && fr.sel === "settings" && fr.settings, JSON.stringify(fr));
	await page.click("#modeLeague"); await page.waitForTimeout(300);
	const back = await page.evaluate(() => document.querySelector("[role=tab][aria-selected=true]").dataset.tab);
	check("back in the league, the remembered tab returns", back === "transfers", back);
	check("no page errors on the desktop", !errs.length, errs.join(" | "));
	await ctx.close();

	// A phone held upright: the tab bar scrolls sideways and no panel pushes the page wider.
	const pctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	await pctx.addInitScript(() => { try { localStorage.setItem("ff-big", "0"); localStorage.setItem("ff-more", "1"); } catch (e) { /* storage blocked */ } });
	const pp = await pctx.newPage();
	await pp.goto(URL); await ready(pp); await pp.waitForTimeout(500);
	const over = {};
	for (const t of TABS) { await showTab(pp, t); over[t] = await pp.evaluate(() => document.documentElement.scrollWidth - innerWidth); }
	const bar = await pp.evaluate(() => { const b = document.getElementById("hubTabs"); return { scrolls: b.scrollWidth > b.clientWidth, ox: getComputedStyle(b).overflowX }; });
	check("390 px: no tab pushes the page wider than the screen", Object.values(over).every(v => v <= 0), JSON.stringify(over));
	check("390 px: the tab bar scrolls sideways", bar.scrolls && bar.ox === "auto", JSON.stringify(bar));
	await pctx.close();
} finally {
	await browser.close(); server.stop();
}
process.exit(done() ? 1 : 0);
