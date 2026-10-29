// Corners: the box is set (runners, markers, zones, the edge man), the computer's runners
// set off just before the strike and bend their runs, the taker always delivers, a short one comes
// now and then (never in a small-sided game or a shootout), and the plan ends once the ball is won.
// Run: node tests/corners.mjs
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8813); const browser = await launch();
const { check, done } = tally();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
await ctx.addInitScript(() => { try { localStorage.setItem("ff-diff", "normal"); localStorage.setItem("ff-mode", "friendly"); } catch (e) { /* none */ } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(server.url, { timeout: 90000 }); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });

const r = await page.evaluate(() => {
	const F = window.__ff;
	F.autoPilot = true;
	const out = { roles: null, bend: 0, preRun: 0, delivered: 0, short: 0, n: 0, maxWait: 0, cleared: 0, stuck: 0 };
	for (let i = 0; i < 40; i++) {
		if (F.state !== "play") { break; }
		F.cornerTest(1, i % 2 === 0);
		const cp = F.cornerPlan;
		if (!cp) { continue; }
		out.n++;
		const kinds = {};
		for (const v of cp.role.values()) { kinds[v.kind] = (kinds[v.kind] || 0) + 1; }
		if (!out.roles) { out.roles = kinds; }
		// Follow one runner: how far does his path stray from the straight line start -> aim?
		const [ man, role ] = [ ...cp.role ].find(([ , v ]) => v.kind === "run");
		const [ sx, sy ] = role.start, [ ax, ay ] = role.aim, L = Math.hypot(ax - sx, ay - sy) || 1;
		let dev = 0, f = 0, ranEarly = false;
		const taker = F.setPiece && F.setPiece.taker, sh0 = F.tally.shortCorners || 0;
		while (f < 400) {
			F.step(1); f++;
			if (F.cornerPlan === cp && cp.running && !cp.delivered && F.ball.owner === taker) { ranEarly = true; }
			if (F.cornerPlan !== cp || cp.delivered) { break; }
			dev = Math.max(dev, Math.abs((man.x - sx) * (ay - sy) - (man.y - sy) * (ax - sx)) / L);
		}
		out.maxWait = Math.max(out.maxWait, f);
		if (ranEarly) { out.preRun++; }
		if (cp.delivered) { out.delivered++; } else if ((F.tally.shortCorners || 0) > sh0) { out.short++; } else { out.stuck++; }
		if (dev > 10) { out.bend++; }
		// Play it out: the plan must not outlive the ball being won.
		let g = 0;
		while (g < 300 && F.cornerPlan === cp) { F.step(1); g++; }
		if (F.cornerPlan !== cp) { out.cleared++; }
		if (F.state !== "play") { break; }
	}
	return out;
});
check("a corner sets the box: runners, markers, zones, and the edge man", r.roles && r.roles.run >= 3 && r.roles.mark >= 3 && r.roles.zone >= 1 && r.roles.edge === 1, JSON.stringify(r.roles));
check("the computer's taker always plays it within a few seconds", r.stuck === 0 && r.maxWait < 200 && r.delivered + r.short === r.n, JSON.stringify(r));
check("the runners set off before the ball is struck", r.preRun >= r.delivered * 0.9, JSON.stringify(r));
check("most runs bend away from the straight line", r.bend >= r.n * 0.5, JSON.stringify(r));
check("a short corner now and then, but mostly crosses", r.short >= 1 && r.short <= r.n * 0.4, JSON.stringify(r));
check("the corner plan ends once the ball is won or dead", r.cleared === r.n, JSON.stringify(r));

// Over more corners the short man turns up (he is a role, not a one-off).
const s = await page.evaluate(() => {
	const F = window.__ff;
	const kinds = new Set();
	for (let i = 0; i < 30; i++) {
		F.cornerTest(1, true);
		const cp = F.cornerPlan;
		if (cp) { for (const v of cp.role.values()) { kinds.add(v.kind); } }
		for (let f = 0; f < 120 && F.cornerPlan === cp; f++) { F.step(1); }
	}
	return { kinds: [ ...kinds ] };
});
check("the short man is a role a corner can use", s.kinds.includes("short"), JSON.stringify(s));
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exitCode = done() ? 1 : 0;
