// Run: node tests/flare-rate.mjs [matches]   (not part of run.mjs: plays whole matches on the real engine,
// both sides on autopilot, and counts the bad fouls and the flare-ups; prints the rate)
import { launch, serve } from "./_env.mjs";
const N = Number(process.argv[2] || 10);
const server = serve(8801), URL = server.url;
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
await page.goto(URL); await page.waitForSelector("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.league, null, { timeout: 60000 });
const per = [];
const t0 = Date.now();
for (let m = 0; m < N; m++) {
	await page.evaluate(() => { window.__ff.flaresLive = true; document.getElementById("ovButton").click(); });
	await page.waitForFunction(() => window.__ff.state === "play", null, { timeout: 60000 });
	const r = await page.evaluate(() => {
		const F = window.__ff, s0 = { ...F.flareStats };
		F.autoPilot = true;
		for (let k = 0; k < 200000 && F.state !== "full"; k++) {
			if (F.state === "half") { document.getElementById("ovButton").click(); }
			if (F.state === "goal" || F.state === "play" || F.state === "half") { F.step(1); } else if (F.state === "paused") { document.getElementById("ovButton").click(); } else { F.step(1); }
		}
		const s = F.flareStats;
		return { state: F.state, tackles: s.tackles - s0.tackles, cards: F.matchLog.filter(e => e.kind === "yellow" || e.kind === "red").length, len: F.matchLen, fouls: s.fouls - s0.fouls, chances: s.chances - s0.chances, flares: s.flares - s0.flares };
	});
	per.push(r);
	if (process.env.FF_VERBOSE) console.log(`match ${m + 1}: ${JSON.stringify(r)} after ${Math.round((Date.now() - t0) / 1000)}s`);
	await page.evaluate(() => { const b = document.getElementById("ovButton"); if (b) { b.click(); } });
	await page.waitForTimeout(300);
}
const sum = k => per.reduce((t, r) => t + r[k], 0);
console.log(JSON.stringify({ matches: N, secs: Math.round((Date.now() - t0) / 1000), fouls: sum("fouls"), badFouls: sum("chances"), flares: sum("flares"), perMatch: per.map(r => r.chances).join(""), withFlare: per.filter(r => r.flares > 0).length, states: [ ...new Set(per.map(r => r.state)) ] }));
await browser.close(); server.stop();
