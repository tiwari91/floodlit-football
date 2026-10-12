// Balance check: N autopilot matches, averaged (goals, turnovers, passes, completion, woodwork, first-touch kinds).
// Run: node tests/balance.mjs [N=40] [page=index]   (page: an .html at the repo root or under tests/out, e.g. an older build)
// Batches of 40 swing by several points of completion from run to run; compare 100+ matches before concluding.
import fs from "node:fs";
import { launch, serve, root } from "./_env.mjs";
const N = +process.argv[2] || 40, which = process.argv[3] || "index";
const server = serve(8861 + Math.floor(Math.random() * 60)); const browser = await launch();
const url = server.url.replace("index.html", fs.existsSync(`${root}/${which}.html`) ? `${which}.html` : `tests/out/${which}.html`);
const all = [];
for (let m = 0; m < N; m++) {
	const page = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
	await page.goto(url); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });
	all.push(await page.evaluate(() => {
		const F = window.__ff; F.autoPilot = true; F.camMode !== "tv";
		let turn = 0, last = F.possTeam, heavy = 0, kinds = {}, steps = 0, stuck = 0;
		const seen = new Set();
		while (steps < 40000) {
			const st = F.state;
			if (st === "full") { break; }
			if (st === "half") { stuck++; if (stuck > 5) { const b = document.getElementById("ovButton"); if (b) { b.click(); } stuck = 0; } F.step(1); steps++; continue; }
			F.step(1); steps++;
			if (F.possTeam !== last && F.possTeam >= 0) { turn++; last = F.possTeam; }
			const o = F.ball.owner;
			if (o && o.gotAt === F.frame - 1 && o.recv && !seen.has(o.gotAt + ":" + o.name)) { seen.add(o.gotAt + ":" + o.name); const k = o.recvK || "none"; kinds[k] = (kinds[k] || 0) + 1; }
		}
		const t = F.tally;
		return { steps, state: F.state, score: F.score.slice(), turn, kinds, passes: F.stats.passes + F.oppStats.passes, completed: F.stats.completed + F.oppStats.completed, wood: t.woodwork || 0 };
	}));
	await page.close();
}
const sum = k => all.reduce((s, r) => s + (typeof k === "function" ? k(r) : r[k]), 0) / all.length;
const kinds = {}; for (const r of all) { for (const [ k, v ] of Object.entries(r.kinds)) { kinds[k] = (kinds[k] || 0) + v / all.length; } }
console.log(which, JSON.stringify({ n: all.length, ended: all.filter(r => r.state === "full").length, goals: sum(r => r.score[0] + r.score[1]).toFixed(2), turnovers: sum("turn").toFixed(1), passes: sum("passes").toFixed(1), completed: sum("completed").toFixed(1), pct: (100 * sum("completed") / sum("passes")).toFixed(1), wood: sum("wood").toFixed(2), kinds: Object.fromEntries(Object.entries(kinds).map(([ k, v ]) => [ k, +v.toFixed(1) ])) }));
await browser.close(); server.stop();
