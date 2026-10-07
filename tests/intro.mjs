// Run: node tests/intro.mjs   (the matchday card and the first visit)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8798), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
async function fresh () {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
	await page.goto(URL); await page.waitForSelector("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	return { ctx, page };
}
const card = page => page.evaluate(() => { const t = document.getElementById("ovText"), l = document.getElementById("ovLearn"); return { title: document.getElementById("ovTitle").textContent, lines: t.classList.contains("lines") ? [ ...t.querySelectorAll(".ln") ].map(x => x.textContent.trim()) : [ t.textContent ], cls: t.className, learn: !l.hidden && l.offsetParent !== null, fits: t.scrollHeight <= t.clientHeight + 1 || getComputedStyle(t).overflowY !== "hidden", kickVisible: (() => { const b = document.getElementById("ovButton").getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; })() }; });

// A brand-new player: the welcome line and the walk-through button on matchday 1.
let { ctx, page } = await fresh();
const first = await card(page);
check("a first visit opens on matchday 1 with a welcome line and a Learn the controls button", /^Matchday 1/.test(first.title) && /^Welcome to Floodlit Football/.test(first.lines[0]) && first.learn, JSON.stringify(first));
check("the matchday card reads one fact per line: club, watch, how they play, coach, your eleven, conditions", first.cls.includes("lines") && first.lines.length >= 6 && first.lines.some(l => /^Watch: /.test(l)) && first.lines.some(l => /^They play: /.test(l)) && first.lines.some(l => /^Your eleven: /.test(l)) && first.lines.some(l => /^Conditions: /.test(l)) && /difficulty$/.test(first.lines[1]), JSON.stringify(first.lines));
check("on a desktop screen the card fits and Kick off is in view", first.kickVisible, JSON.stringify(first));

// The walk-through, and straight back to matchday 1 of the league.
await page.click("#ovLearn"); await page.waitForTimeout(400);
const inTut = await page.evaluate(() => ({ mode: window.__ff.mode, title: document.getElementById("ovTitle").textContent }));
check("Learn the controls starts the tutorial", inTut.mode === "tutorial" && /Tutorial/.test(inTut.title), JSON.stringify(inTut));
await page.click("#ovButton"); await page.waitForTimeout(300);
await page.evaluate(() => window.__ff.finishTutorialTest()); await page.waitForTimeout(300);
const done1 = await page.evaluate(() => ({ title: document.getElementById("ovTitle").textContent, btn: document.getElementById("ovButton").textContent }));
check("the tutorial's last card offers the way back to matchday 1", /Tutorial complete/.test(done1.title) && done1.btn === "Back to matchday 1", JSON.stringify(done1));
await page.click("#ovButton"); await page.waitForTimeout(400);
const back = await page.evaluate(() => ({ mode: window.__ff.mode, title: document.getElementById("ovTitle").textContent, first: (document.querySelector("#ovText .ln") || document.getElementById("ovText")).textContent.trim(), learn: !document.getElementById("ovLearn").hidden }));
check("and it lands back on the league's matchday 1, without the welcome now the tutorial is done", back.mode === "league" && /^Matchday 1/.test(back.title) && !/^Welcome/.test(back.first) && !back.learn, JSON.stringify(back));
await ctx.close();

// A returning player who has played: no welcome, no button; other cards are plain text.
({ ctx, page } = await fresh());
await page.evaluate(() => { localStorage.setItem("ff-played", "4"); });
await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const ret = await card(page);
check("a returning player sees the plain matchday card", !ret.learn && !/^Welcome/.test(ret.lines[0]) && ret.cls.includes("lines"), JSON.stringify(ret));
await page.click("#ovButton"); await page.waitForTimeout(500);
await page.evaluate(() => { document.getElementById("pauseBtn").click(); }); await page.waitForTimeout(300);
const paused = await page.evaluate(() => ({ title: document.getElementById("ovTitle").textContent, cls: document.getElementById("ovText").className, learn: !document.getElementById("ovLearn").hidden }));
check("other cards drop the line layout and the button", !paused.cls.includes("lines") && !paused.learn, JSON.stringify(paused));
await ctx.close();

check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
