// Main-thread CPU of a friendly on Light graphics, played in real time by the autopilot.
// Run: node tests/cpu.mjs [seconds=25] [page=index] [runs=3]   Reports busy % of one core (script, and all tasks),
// Compare before/after on the same machine, nothing else heavy running.
import fs from "node:fs";
import { launch, serve, root, sleep } from "./_env.mjs";
const SECS = +process.argv[2] || 25, which = process.argv[3] || "index", RUNS = +process.argv[4] || 3;
const server = serve(8971); const browser = await launch();
const url = server.url.replace("index.html", fs.existsSync(`${root}/${which}.html`) ? `${which}.html` : `tests/out/${which}.html`);
const res = [];
for (let r = 0; r < RUNS; r++) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	await ctx.addInitScript(() => { try { localStorage.setItem("ff-diff", "normal"); localStorage.setItem("ff-mode", "friendly"); localStorage.setItem("ff-gfx", "light"); } catch (e) { /* none */ } });
	const page = await ctx.newPage();
	await page.goto(url, { timeout: 90000 }); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });
	await page.evaluate(() => { window.__ff.autoPilot = true; });
	const cdp = await ctx.newCDPSession(page); await cdp.send("Performance.enable");
	await sleep(3000);
	const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [ m.name, m.value ]));
	const f0 = await page.evaluate(() => window.__ff.frame);
	const t0 = Date.now();
	// Keep the match going through stoppages: click on through half time if it comes.
	const end = t0 + SECS * 1000;
	while (Date.now() < end) { await sleep(1000); await page.evaluate(() => { if (window.__ff.state === "half") { const b = document.getElementById("ovButton"); if (b) { b.click(); } } }); }
	const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [ m.name, m.value ]));
	const f1 = await page.evaluate(() => window.__ff.frame);
	const wall = (Date.now() - t0) / 1000;
	res.push({ script: 100 * (m1.ScriptDuration - m0.ScriptDuration) / wall, task: 100 * (m1.TaskDuration - m0.TaskDuration) / wall, fps: (f1 - f0) / wall });
	await ctx.close();
}
const avg = k => (res.reduce((s, r) => s + r[k], 0) / res.length).toFixed(1);
console.log(which, JSON.stringify({ runs: res.map(r => [ r.script.toFixed(1), r.task.toFixed(1) ]), script: avg("script"), task: avg("task"), simSteps: avg("fps") }));
await browser.close(); server.stop();
