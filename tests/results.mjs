// Run: node tests/results.mjs   (Floodlit Live: which finished matches get posted, and how)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8870), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
try {
	const page = await browser.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	await page.addInitScript(() => { window.__calls = []; window.fetch = (u, o) => { window.__calls.push([ u, o ]); return Promise.resolve(new Response("{}", { status: 202 })); }; });
	await page.goto(URL);
	await page.waitForFunction(() => window.__ff && window.__ff.resultPayload, null, { timeout: 60000 });

	const p = await page.evaluate(() => {
		const P = window.__ff.resultPayload;
		return {
			league: P({ mode: "league", sim: false, score: [ 3, 1 ], len: 300 }),
			friendly: P({ mode: "friendly", sim: false, score: [ 0, 2 ], len: 1200 }),
			sim: P({ mode: "league", sim: true, score: [ 1, 0 ], len: 300 }),
			tutorial: P({ mode: "tutorial", sim: false, score: [ 1, 0 ], len: 300 }),
			corners: P({ mode: "corners", sim: false, score: [ 1, 0 ], len: 300 }),
			badLen: P({ mode: "league", sim: false, score: [ 1, 0 ], len: 240 }),
			badGoals: P({ mode: "league", sim: false, score: [ 100, 0 ], len: 300 })
		};
	});
	check("a played league match gives goals from your side, mode and length", JSON.stringify(p.league) === JSON.stringify({ goalsFor: 3, goalsAgainst: 1, mode: "league", lengthSeconds: 300 }), JSON.stringify(p.league));
	check("a played friendly is posted too", p.friendly && p.friendly.mode === "friendly" && p.friendly.goalsAgainst === 2 && p.friendly.lengthSeconds === 1200, JSON.stringify(p.friendly));
	check("simulated, tutorial and corner-shootout results are not", p.sim === null && p.tutorial === null && p.corners === null);
	check("out-of-range length or goals are not", p.badLen === null && p.badGoals === null);

	const off = await page.evaluate(() => { window.__calls = []; window.__ff.sendResult("", { goalsFor: 1, goalsAgainst: 0, mode: "league", lengthSeconds: 300 }); return window.__calls.length; });
	check("with the endpoint empty no request is made", off === 0, String(off));
	const on = await page.evaluate(() => {
		window.__calls = []; window.__ff.sendResult("https://api.example/", { goalsFor: 1, goalsAgainst: 0, mode: "league", lengthSeconds: 300 });
		const [ u, o ] = window.__calls[0] || [];
		return { n: window.__calls.length, u, method: o && o.method, type: o && o.headers["Content-Type"], keepalive: o && o.keepalive, signal: !!(o && o.signal), body: o && JSON.parse(o.body) };
	});
	check("with an endpoint set it POSTs JSON to /matches with keepalive and a timeout signal",
		on.n === 1 && on.u === "https://api.example/matches" && on.method === "POST" && on.type === "application/json" && on.keepalive === true && on.signal && on.body.goalsFor === 1, JSON.stringify(on));
	const failing = await page.evaluate(async () => {
		window.fetch = () => Promise.reject(new TypeError("offline"));
		window.__ff.sendResult("https://api.example", { goalsFor: 0, goalsAgainst: 0, mode: "friendly", lengthSeconds: 120 });
		await new Promise(r => setTimeout(r, 50));
		return true;
	});
	check("a failed request is swallowed", failing && errs.length === 0, errs.join("; "));

	await page.waitForFunction(() => window.__ff.league && window.__ff.league.club && window.__ff.state === "intro", null, { timeout: 60000 });
	// The live game ships with the endpoint off: finishing a match sends nothing.
	const live = await page.evaluate(async () => {
		window.__calls = [];
		window.fetch = (u, o) => { window.__calls.push([ u, o ]); return Promise.resolve(new Response("{}")); };
		const before = window.__ff.state;
		window.__ff.simulateMineTest();
		return { before, state: window.__ff.state, n: window.__calls.filter(([ u ]) => /\/matches$/.test(String(u))).length };
	});
	check("a finished match with the endpoint off makes no results call", live.state === "full" && live.n === 0, JSON.stringify(live));
	check("no page errors", errs.length === 0, errs.join("; "));
} finally {
	await browser.close();
}
process.exit(done() ? 1 : 0);
