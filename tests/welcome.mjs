// Run: node tests/welcome.mjs   (the "floodlights on" intro over the page: 00-intro.js)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8812), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
async function open (query) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
	await page.goto(URL + (query ? "&" + query : ""));   // URL already carries ?test await page.waitForSelector("#ovButton");
	return { ctx, page };
}
const state = page => page.evaluate(() => ({ intro: !!document.getElementById("intro"), card: !!document.querySelector("#intro.card-on"), title: document.getElementById("ovTitle").textContent }));

// Automated browsers (these suites) never see it unless asked.
let { ctx, page } = await open("");
check("an automated browser opens straight on the page, no intro", !(await state(page)).intro);
await ctx.close();

// ?intro shows it: the scene plays and the title card comes up.
({ ctx, page } = await open("intro"));
check("?intro shows the intro over the page", (await state(page)).intro);
await page.waitForSelector("#intro.card-on", { timeout: 8000 }).catch(() => {});
check("the title card comes up within a few seconds", (await state(page)).card);
const before = (await state(page)).title;
// The key that closes it is not a game input: Space and Enter must not press the matchday card's button.
await page.keyboard.press("Space"); await page.waitForTimeout(600);
const after = await state(page);
check("any key closes the intro and it leaves the page", !after.intro, JSON.stringify(after));
check("the closing key does not reach the game (the matchday card is still there)", after.title === before, JSON.stringify({ before, after: after.title }));
await ctx.close();

// A click on Skip closes it too.
({ ctx, page } = await open("intro"));
await page.click("#intro .intro-skip"); await page.waitForTimeout(600);
check("Skip closes it", !(await state(page)).intro);
await ctx.close();

// ?nointro wins over everything.
({ ctx, page } = await open("intro&nointro"));
check("?nointro keeps it away", !(await state(page)).intro);
await ctx.close();

check("welcome: no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
