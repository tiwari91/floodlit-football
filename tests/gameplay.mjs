// Gameplay checks (runs in behind, offside, the back line, tactics, tactics saved with the match).
// Run: node tests/gameplay.mjs [matches=8]   Friendlies against a normal side, played by the autopilot.
import { launch, serve, tally } from "./_env.mjs";
const N = +process.argv[2] || 8;
const server = serve(8801); const browser = await launch();
const { check, done } = tally();
async function open (init) {
	const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
	await ctx.addInitScript(() => { try { localStorage.setItem("ff-diff", "normal"); localStorage.setItem("ff-mode", "friendly"); } catch (e) { /* none */ } });
	const page = await ctx.newPage();
	await page.goto(server.url, { timeout: 90000 }); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });
	if (init) { await page.evaluate(init); }
	return { ctx, page };
}

// 1. Runs in behind and offside, over whole matches.
let bursts = 0, thru = 0, off = 0, goals = 0, spread = [], spreadN = 0;
for (let i = 0; i < N; i++) {
	const { ctx, page } = await open();
	const r = await page.evaluate(() => {
		const F = window.__ff; F.autoPilot = true;
		let steps = 0, sp = 0, spn = 0;
		while (steps < 40000 && F.state !== "full") {
			if (F.state === "half") { const b = document.getElementById("ovButton"); if (b) { b.click(); } }
			F.step(1); steps++;
			// The back line while defending in open play: how far apart in depth its men stand.
			if (steps % 20 === 0 && F.state === "play" && F.ball.owner && F.ball.owner.team === 0 && F.ball.owner.role !== "gk") {
				const d = F.players.filter(p => p.team === 1 && p.role === "def").map(p => p.x);
				if (d.length >= 3) { const m = d.reduce((s, x) => s + x, 0) / d.length; sp += Math.sqrt(d.reduce((s, x) => s + (x - m) * (x - m), 0) / d.length); spn++; }
			}
		}
		const t = F.tally;
		return { bursts: t.bursts || 0, thru: t.thru || 0, off: t.offsides[0] + t.offsides[1], goals: F.score[0] + F.score[1], sp: spn ? sp / spn / F.FW : 0 };
	});
	bursts += r.bursts; thru += r.thru; off += r.off; goals += r.goals; spread.push(r.sp); spreadN++;
	await ctx.close();
}
console.log(`per match: bursts ${(bursts / N).toFixed(1)}, through balls ${(thru / N).toFixed(1)}, offsides ${(off / N).toFixed(2)}, goals ${(goals / N).toFixed(2)}`);
check("runners burst in behind", bursts / N >= 1, (bursts / N).toFixed(1));
check("through balls are played into the space", thru / N >= 2, (thru / N).toFixed(1));
check("some runs are caught offside, not too many", off / N >= 0.1 && off / N <= 3, (off / N).toFixed(2));
check("goals stay realistic", goals / N >= 0.6 && goals / N <= 3.2, (goals / N).toFixed(2));
const msp = spread.reduce((s, x) => s + x, 0) / spreadN;
check("the back line keeps its shape in depth while defending", msp < 0.06, `spread ${(100 * msp).toFixed(1)}% of the pitch`);

// 2. A high press against a low block: higher up, and more tired, over the same stretch.
async function pressRun (pr) {
	const { ctx, page } = await open(() => { window.__ff.autoPilot = true; });
	const r = await page.evaluate(pr => {
		const F = window.__ff; F.pressI[1] = pr; F.setLine(1, pr === "high" ? "high" : "deep");
		let depth = 0, n = 0;
		for (let s = 0; s < 7000 && F.state !== "full"; s++) {
			if (F.state === "half") { const b = document.getElementById("ovButton"); if (b) { b.click(); } }
			F.pressI[1] = pr;   // (the computer would otherwise change it by the score)
			F.step(1);
			if (s % 15 === 0 && F.state === "play" && F.ball.owner && F.ball.owner.team === 0) { depth += F.teamShapeInfo(1).defX / F.FW; n++; }
		}
		const o = F.players.filter(p => p.team === 1 && p.role !== "gk");
		return { depth: n ? depth / n : 0, sta: o.reduce((s, p) => s + p.sta, 0) / o.length };
	}, pr);
	await ctx.close();
	return r;
}
const hi = [ await pressRun("high"), await pressRun("high") ], lo = [ await pressRun("low"), await pressRun("low") ];
const avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / a.length;
console.log(`high press: line at ${(100 * avg(hi, "depth")).toFixed(1)}%, stamina ${avg(hi, "sta").toFixed(3)}; low block: line at ${(100 * avg(lo, "depth")).toFixed(1)}%, stamina ${avg(lo, "sta").toFixed(3)}`);
check("a high press holds its line higher than a low block", avg(hi, "depth") > avg(lo, "depth") + 0.04);
check("a high press tires a side more than a low block", avg(hi, "sta") < avg(lo, "sta"));

// 3. The instructions are saved with a match in progress and come back after a refresh.
{
	const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
	await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("seen")) { localStorage.setItem("ff-diff", "normal"); localStorage.setItem("ff-mode", "friendly"); sessionStorage.setItem("seen", "1"); } } catch (e) { /* none */ } });
	const page = await ctx.newPage();
	await page.goto(server.url); await page.click("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.state === "play");
	await page.evaluate(() => { const F = window.__ff; F.autoPilot = true; F.step(400); F.pressI[1] = "low"; F.styleI[1] = "counter"; F.saveLive(); });
	await page.reload(); await page.waitForFunction(() => window.__ff);
	const r = await page.evaluate(() => [ window.__ff.pressI[1], window.__ff.styleI[1] ]);
	check("the computer's instructions survive a refresh", r[0] === "low" && r[1] === "counter", r.join(" "));
	await ctx.close();
}
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
