// Run: node tests/nothree.mjs   (three.js cannot load: the match still starts, on the 2D cameras)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8815), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
async function run (mode) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.on("pageerror", e => errs.push(mode + " pageerror: " + e.message));
	// fail: the CDN refuses at once; hang: it never answers (a dead network)
	await page.route(/three\.module/, route => (mode === "fail" ? route.abort("failed") : new Promise(() => {})));
	await page.goto(URL); await page.waitForSelector("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	await page.click("#ovButton");
	const t0 = await page.evaluate(() => document.getElementById("clock").textContent);
	await page.waitForTimeout(mode === "hang" ? 20000 : 4000);
	const after = await page.evaluate(() => ({ clock: document.getElementById("clock").textContent, card: !document.getElementById("overlay").hidden && getComputedStyle(document.getElementById("overlay")).display !== "none", three: !!window.THREE }));
	await ctx.close();
	return { t0, ...after };
}
const fail = await run("fail");
check("three.js refused: Kick off starts the match on the 2D cameras (the clock runs)", fail.clock !== fail.t0 && !fail.three, JSON.stringify(fail));
const hang = await run("hang");
check("three.js never answers: the match starts within 20 s (the clock runs)", hang.clock !== hang.t0, JSON.stringify(hang));
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
