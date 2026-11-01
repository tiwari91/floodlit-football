// Run: node tests/rules.mjs   (the Premier League's suspension rules: banFor in 14-league)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8839), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.banFor, null, { timeout: 60000 });
const b = await page.evaluate(() => {
	const f = window.__ff.banFor;
	return {
		red: f("r", 0, 10), second: f("r2", 2, 10),
		y4: f("y", 4, 10), y5early: f("y", 5, 19), y5late: f("y", 5, 20),
		y10early: f("y", 10, 32), y10late: f("y", 10, 33), y15: f("y", 15, 37), y6: f("y", 6, 12)
	};
});
check("a straight red is a three-game ban", b.red === 3, JSON.stringify(b));
check("a second yellow is a one-game ban", b.second === 1, JSON.stringify(b));
check("the fifth yellow by matchday 19 is a one-game ban; after it, nothing", b.y5early === 1 && b.y5late === 0 && b.y4 === 0 && b.y6 === 0, JSON.stringify(b));
check("the tenth yellow by matchday 32 is two games; after it, nothing", b.y10early === 2 && b.y10late === 0, JSON.stringify(b));
check("the fifteenth yellow is three games", b.y15 === 3, JSON.stringify(b));
const help = await page.evaluate(() => document.body.innerHTML.includes("a straight red is a three-game ban"));
check("How to play explains the new bans", help);
check("rules: no page errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
