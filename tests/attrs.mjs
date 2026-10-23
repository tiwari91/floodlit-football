// Dribbling and physical: sensible defaults for players without them, and on the pitch a good dribbler
// beats more men and a strong man wins more duels and headers.
// Run: node tests/attrs.mjs [steps=9000]   Friendlies played by the autopilot, ratings set on the pitch.
import { launch, serve, tally } from "./_env.mjs";
const STEPS = +process.argv[2] || 9000;
const server = serve(8831); const browser = await launch();
const { check, done } = tally();
async function open () {
	const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
	await ctx.addInitScript(() => { try { localStorage.setItem("ff-diff", "normal"); localStorage.setItem("ff-mode", "friendly"); } catch (e) { /* none */ } });
	const page = await ctx.newPage();
	await page.goto(server.url, { timeout: 90000 }); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });
	return { ctx, page };
}
try {
	// 1. Defaults: an old save's player (no dri or phy) gets them from his ratings and position; nothing is
	// written to him and his overall does not move. Set values win.
	{
		const { ctx, page } = await open();
		const d = await page.evaluate(() => {
			const F = window.__ff;
			const fwd = { name: "T. Oldsave", pos: "fwd", pac: 82, sho: 80, pas: 70, def: 40, age: 25 }, o0 = F.ovrOf(fwd);
			F.ensurePlayer(fwd);
			const cb = F.ensurePlayer({ name: "D. Stopper", pos: "def", pac: 60, sho: 45, pas: 58, def: 84, age: 27 });
			const gen = Array.from({ length: 240 }, (_, i) => F.genPlayer([ "def", "mid", "fwd" ][i % 3], 70));
			const mean = (a, f) => a.reduce((s, p) => s + f(p), 0) / a.length;
			return {
				o0, o1: F.ovrOf(fwd), stored: "dri" in fwd || "phy" in fwd, f: [ F.driOf(fwd), F.phyOf(fwd) ], c: [ F.driOf(cb), F.phyOf(cb) ],
				set: [ F.driOf({ ...fwd, dri: 91 }), F.phyOf({ ...fwd, phy: 33 }) ], bad: (() => { const p = F.ensurePlayer({ name: "X", pos: "mid", pac: 60, sho: 60, pas: 60, def: 60, dri: "x" }); return "dri" in p; })(),
				g: [ mean(gen, F.driOf), mean(gen, F.phyOf) ], pos: [ "def", "mid", "fwd" ].map(ps => { const a = gen.filter(p => p.pos === ps); return `${ps} ${Math.round(mean(a, F.driOf))}/${Math.round(mean(a, F.phyOf))}`; }).join(", "), range: gen.every(p => [ F.driOf(p), F.phyOf(p) ].every(v => Number.isInteger(v) && v >= 30 && v <= 96)),
				attr: F.players.filter(p => p.team === 1 && p.attr).every(p => Number.isFinite(p.attr.dri) && Number.isFinite(p.attr.phy))
			};
		});
		console.log(`generated at 70, dribbling/physical by position: ${d.pos}`);
		check("an old save's player keeps his overall and nothing is written to him", d.o0 === d.o1 && !d.stored, JSON.stringify(d));
		check("defaults follow the player: a quick forward dribbles better, a centre-back is stronger", d.f[0] > d.c[0] + 10 && d.c[1] > d.f[1] + 5, JSON.stringify([ d.f, d.c ]));
		check("set values win; a bad one is dropped for the derived value", d.set[0] === 91 && d.set[1] === 33 && !d.bad);
		check("generated players: dribbling and physical in range, around a typical 60-80", d.range && d.g.every(v => v > 60 && v < 80), JSON.stringify(d.g));
		check("the men on the pitch carry dribbling and physical", d.attr);
		await ctx.close();
	}

	// One stretch of play with team 0's outfield at one dribbling or physical and team 1's at another.
	async function run (dri0, phy0, phy1, dribble) {
		const { ctx, page } = await open();
		const r = await page.evaluate(([ dri0, phy0, phy1, dribble, STEPS ]) => {
			const F = window.__ff; F.autoPilot = true; F.dribbleTest = dribble;
			const set = () => { for (const p of F.players) { if (p.role === "gk" || !p.attr) { continue; } p.attr.dri = p.team === 0 ? dri0 : 70; p.attr.phy = p.team === 0 ? phy0 : phy1; } };
			let carry = 0;
			for (let s = 0; s < STEPS && F.state !== "full"; s++) {
				if (F.state === "half") { const b = document.getElementById("ovButton"); if (b) { b.click(); } }
				if (s % 30 === 0) { set(); }
				F.step(1);
				const o = F.ball.owner;
				if (o && o.team === 0 && o.role !== "gk" && F.state === "play") { carry++; }
			}
			const by = F.tally.by || {}, sum = (t, k) => Object.entries(by).filter(([ key ]) => key.startsWith(`${t}-`)).reduce((s, [ , v ]) => s + (v[k] || 0), 0);
			return { carry, tk1: sum(1, "tackle"), tk0: sum(0, "tackle"), air0: sum(0, "air"), air1: sum(1, "air"), goals: F.score[0] };
		}, [ dri0, phy0, phy1, dribble, STEPS ]);
		await ctx.close();
		return r;
	}
	const add = (a, b) => Object.fromEntries(Object.keys(a).map(k => [ k, a[k] + b[k] ]));

	// 2. Take-ons: your side only ever runs at goal. High dribbling is dispossessed less often per second on the ball.
	const hi = add(await run(92, 76, 76, true), await run(92, 76, 76, true)), lo = add(await run(40, 76, 76, true), await run(40, 76, 76, true));
	const rate = r => (1000 * r.tk1) / Math.max(1, r.carry);
	console.log(`dribblers: dri 92 lost it ${rate(hi).toFixed(2)} times per 1000 frames on the ball (${hi.tk1}/${hi.carry}, ${hi.goals} goals); dri 40 ${rate(lo).toFixed(2)} (${lo.tk1}/${lo.carry}, ${lo.goals} goals)`);
	check("a high-dribbling carrier beats defenders more often than a low one", rate(hi) < rate(lo) * 0.8, `${rate(hi).toFixed(2)} vs ${rate(lo).toFixed(2)}`);
	check("and carries it further: more time on the ball before he loses it", hi.carry / Math.max(1, hi.tk1) > lo.carry / Math.max(1, lo.tk1));

	// 3. Physical: the strong side wins a bigger share of headers and tackles than the weak side does.
	const strong = add(await run(70, 92, 50, false), await run(70, 92, 50, false)), weak = add(await run(70, 50, 92, false), await run(70, 50, 92, false));
	const airS = r => r.air0 / Math.max(1, r.air0 + r.air1), tkS = r => r.tk0 / Math.max(1, r.tk0 + r.tk1);
	console.log(`physical: strong side won ${(100 * airS(strong)).toFixed(0)}% of headers (${strong.air0 + strong.air1}) and ${(100 * tkS(strong)).toFixed(0)}% of tackles; weak side ${(100 * airS(weak)).toFixed(0)}% (${weak.air0 + weak.air1}) and ${(100 * tkS(weak)).toFixed(0)}%`);
	check("high physical wins more headers", airS(strong) > airS(weak) + 0.08, `${airS(strong).toFixed(2)} vs ${airS(weak).toFixed(2)}`);
	check("high physical wins more duels for the ball", tkS(strong) > tkS(weak), `${tkS(strong).toFixed(2)} vs ${tkS(weak).toFixed(2)}`);
} finally {
	await browser.close(); server.stop();
}
process.exit(done() ? 1 : 0);
