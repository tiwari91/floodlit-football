// Balance check: N autopilot matches, averaged (goals, turnovers, passes, completion, woodwork, first-touch kinds).
// Run: node tests/balance.mjs [N=40] [page=index]   (page: an .html at the repo root or under tests/out, e.g. an older build)
// Batches of 40 swing by several points of completion from run to run; compare 100+ matches before concluding.
// Without FF_DIFF it plays your league club's first fixture. FF_DIFF=easy|normal|hard plays a friendly against that opponent, FF_YOU=1..5 the strength of your own friendly side (default 3,
// the same as a normal opponent), FF_PAR=n plays n matches at once. W-D-L is from your side's point of view.
import fs from "node:fs";
import { launch, serve, root } from "./_env.mjs";
const N = +process.argv[2] || 40, which = process.argv[3] || "index";
const server = serve(8861 + Math.floor(Math.random() * 60)); const browser = await launch();
const url = server.url.replace("index.html", fs.existsSync(`${root}/${which}.html`) ? `${which}.html` : `tests/out/${which}.html`);
const all = [], PAR = Math.max(1, +process.env.FF_PAR || 1);
let next = 0;
async function one () {
	const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
	await ctx.addInitScript(([ d, y ]) => { try { if (d) { localStorage.setItem("ff-diff", d); localStorage.setItem("ff-mode", "friendly"); } if (y) { localStorage.setItem("ff-test-you", y); } } catch (e) { /* none */ } }, [ process.env.FF_DIFF || "", process.env.FF_YOU || "" ]);
	const page = await ctx.newPage();
	await page.goto(url, { timeout: 90000 }); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
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
		const t = F.tally, rt = [ 0, 1 ].map(tm => { const o = F.players.filter(q => q.team === tm && q.role !== "gk"), g = F.players.find(q => q.team === tm && q.role === "gk"), m = k => o.reduce((s, q) => s + (q.attr ? q.attr[k] : 65), 0) / o.length; return [ m("pas"), m("sho"), m("def"), g && g.attr ? g.attr.def : 65 ]; });
		return { steps, state: F.state, score: F.score.slice(), turn, kinds, passes: F.stats.passes + F.oppStats.passes, completed: F.stats.completed + F.oppStats.completed, wood: t.woodwork || 0, rt, shots: t.shots.slice(), poss: F.possFrames[0] / Math.max(1, F.possFrames[0] + F.possFrames[1]), gkind: [ 0, 1 ].map(tm => [ t.headGoals[tm], t.cornerGoals[tm], t.fkGoals[tm], t.penGoals[tm] ]), pc: [ F.stats, F.oppStats ].map(x => x.passes ? x.completed / x.passes : 0) };
	}));
	await ctx.close();
}
// A page that will not load (a busy local server) is tried again rather than ending the run.
let retries = 0;
await Promise.all(Array.from({ length: PAR }, async () => { while (next < N) { next++; for (let k = 0; ; k++) { try { await one(); break; } catch (e) { retries++; if (k >= 2) { throw e; } } } } }));
if (retries) { console.log(`(${retries} page loads retried)`); }
const sum = k => all.reduce((s, r) => s + (typeof k === "function" ? k(r) : r[k]), 0) / all.length;
const kinds = {}; for (const r of all) { for (const [ k, v ] of Object.entries(r.kinds)) { kinds[k] = (kinds[k] || 0) + v / all.length; } }
const W = all.filter(r => r.score[0] > r.score[1]).length, L = all.filter(r => r.score[0] < r.score[1]).length;
console.log(which, process.env.FF_DIFF || "-", process.env.FF_YOU || "-", JSON.stringify({ n: all.length, wdl: `${W}-${all.length - W - L}-${L}`, draws: (100 * (all.length - W - L) / all.length).toFixed(0) + "%", gf: sum(r => r.score[0]).toFixed(2), ga: sum(r => r.score[1]).toFixed(2), ended: all.filter(r => r.state === "full").length, goals: sum(r => r.score[0] + r.score[1]).toFixed(2), turnovers: sum("turn").toFixed(1), passes: sum("passes").toFixed(1), completed: sum("completed").toFixed(1), pct: (100 * sum("completed") / sum("passes")).toFixed(1), wood: sum("wood").toFixed(2), rt: [ 0, 1 ].map(tm => [ 0, 1, 2, 3 ].map(k => +sum(r => r.rt[tm][k]).toFixed(1)).join("/")), shots: [ 0, 1 ].map(tm => +sum(r => r.shots[tm]).toFixed(1)), poss: +(100 * sum("poss")).toFixed(1), setGoals: [ 0, 1 ].map(tm => [ 0, 1, 2, 3 ].map(k => +sum(r => r.gkind[tm][k]).toFixed(2)).join("/")), pc: [ 0, 1 ].map(tm => +(100 * sum(r => r.pc[tm])).toFixed(1)), kinds: Object.fromEntries(Object.entries(kinds).map(([ k, v ]) => [ k, +v.toFixed(1) ])) }));
await browser.close(); server.stop();
