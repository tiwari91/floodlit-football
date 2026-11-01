// Run: node tests/firstpick.mjs   A new career starts with "Choose your club": every club, one click, never again.
import { launch, serve, tally, OUT } from "./_env.mjs";
const server = serve(8860), TEST_URL = server.url, PLAIN = TEST_URL.replace("?test", "");
process.on("exit", () => server.stop());
const { check, done } = tally();
import fs from "node:fs";
import { root } from "./_env.mjs";
if (/const CHAMPIONS = true/.test(fs.readFileSync(`${root}/index.html`, "utf8"))) { console.log("skipped: Floodlit Champions has its own club picker\n\n0 passed, 0 failed"); process.exit(0); }
const browser = await launch();

// 1. A real visitor (no ?test), fresh browser: the picker comes first.
{
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	await page.goto(PLAIN);
	await page.waitForSelector("#firstPick .fp-club", { timeout: 60000 });
	const info = await page.evaluate(() => ({
		n: document.querySelectorAll("#firstPick .fp-club").length,
		groups: document.querySelectorAll("#firstPick .fp-group").length,
		keep: !!document.getElementById("fpKeep"),
		names: [ ...document.querySelectorAll("#firstPick .fp-name") ].map(e => e.textContent)
	}));
	check("a fresh visit opens Choose your club, with every club as a card and a Keep Floodlit FC button", info.n >= 15 && info.keep && info.groups === 2, JSON.stringify({ n: info.n, groups: info.groups }));
	check("Floodlit FC itself is not among the cards", !info.names.includes("Floodlit FC"));
	await page.screenshot({ path: `${OUT}/firstpick-desktop.png` });
	// Pick the strongest club: no reputation needed for the first job.
	const pick = info.names[0];
	await page.click("#firstPick .fp-club >> nth=0");
	await page.waitForFunction(() => !document.getElementById("firstPick"));
	const after = await page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem("ff-league") || "null"), due: localStorage.getItem("ff-pick-due"), card: document.getElementById("ovText").textContent + " " + document.getElementById("ovTitle").textContent }));
	const ident = after.saved && after.saved.ident;
	check("one click starts the career at that club (the save carries its name)", ident && ident.you && ident.you.name === pick, pick);
	check("the choice is remembered: the picker is not due any more", after.due === null);
	await page.screenshot({ path: `${OUT}/firstpick-after.png` });
	await page.reload();
	await page.waitForSelector("#ovTitle");
	await page.waitForTimeout(1500);
	check("after a reload the picker does not come back", !(await page.$("#firstPick")));
	const again = await page.evaluate(() => (JSON.parse(localStorage.getItem("ff-league")).ident || {}).you);
	check("and you are still the club you picked", again && again.name === pick, JSON.stringify(again).slice(0, 80));
	check("no page errors (visit)", errs.length === 0, errs.join(" | "));
	await ctx.close();
}

// 2. Keep Floodlit FC closes it and keeps the default club; it stays closed after a reload.
{
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	await page.goto(PLAIN);
	await page.waitForSelector("#firstPick .fp-club", { timeout: 60000 });
	const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
	check("on a phone the picker fits the width", fits);
	await page.screenshot({ path: `${OUT}/firstpick-phone.png` });
	await page.click("#fpKeep");
	await page.waitForFunction(() => !document.getElementById("firstPick"));
	const kept = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("ff-league") || "{}"); return s.ident && s.ident.you ? s.ident.you.name : null; });
	check("Keep Floodlit FC keeps the default club", kept === null || kept === "Floodlit FC", String(kept));
	await page.reload(); await page.waitForSelector("#ovTitle"); await page.waitForTimeout(1500);
	check("and the picker stays closed after a reload", !(await page.$("#firstPick")));
	check("no page errors (keep)", errs.length === 0, errs.join(" | "));
	await ctx.close();
}

// 3. Test runs (?test) are never blocked by it; with &pick they can drive it through the hook.
{
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	await page.goto(TEST_URL);
	await page.waitForFunction(() => window.__ff && window.__ff.league, null, { timeout: 60000 });
	check("with ?test the picker never shows", !(await page.$("#firstPick")));
	await page.goto(TEST_URL + "&pick");
	await page.waitForFunction(() => window.__ff && window.__ff.league, null, { timeout: 60000 });
	await page.evaluate(() => { localStorage.clear(); });
	await page.reload();
	await page.waitForFunction(() => window.__ff && window.__ff.league, null, { timeout: 60000 });
	await page.waitForSelector("#firstPick .fp-club");
	// Keys pressed while it is open never reach the game behind it.
	await page.keyboard.press("Space"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
	check("Space and Enter while choosing do not kick off the match", await page.evaluate(() => window.__ff.state === "intro" && !!document.getElementById("firstPick")), await page.evaluate(() => window.__ff.state));
	// A club from the division below: still allowed, and you take it into this division.
	const below = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, btn = [ ...document.querySelectorAll("#firstPick .fp-club") ].find(b => !lg.members.includes(Number(b.dataset.id)));
		if (!btn) { return null; }
		const name = btn.querySelector(".fp-name").textContent; btn.click();
		return { name, you: lg.club && F.league.career, now: document.getElementById("firstPick") ? "open" : "closed", clubs: F.league.career && F.league.career.clubs };
	});
	check("a club from the division below can be picked too", below && below.now === "closed" && below.clubs && below.clubs.length === 1 && below.clubs[0] === below.name, JSON.stringify(below));
	check("no page errors (test hook)", errs.length === 0, errs.join(" | "));
	await ctx.close();
}

await browser.close();
process.exit(done() ? 1 : 0);
