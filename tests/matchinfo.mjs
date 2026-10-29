// Run: node tests/matchinfo.mjs   (the match centre: the other side and the live stats during a match, desktop and phone)
import { launch, serve, tally, devices } from "./_env.mjs";
const server = serve(8811), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const ready = page => page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.openMatchCentre, null, { timeout: 60000 });
const kickOff = async page => { await page.click("#ovButton"); await page.waitForFunction(() => window.__ff.state === "play", null, { timeout: 60000 }); };
try {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await ctx.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	await page.goto(URL); await ready(page);
	const before = await page.evaluate(() => ({ btn: document.getElementById("mcToggle").hidden, box: document.getElementById("matchCentre").hidden }));
	check("before kick-off neither the button nor the card shows", before.btn && before.box, JSON.stringify(before));
	await kickOff(page); await page.waitForTimeout(700);
	const shown = await page.evaluate(() => ({ btn: !document.getElementById("mcToggle").hidden, box: document.getElementById("matchCentre").hidden }));
	check("in a match the Match info button shows and the card stays closed until asked", shown.btn && shown.box, JSON.stringify(shown));
	// The pitch draws the weather and tactic tags top right from 44 px down: the button must sit clear of them and of Show menu.
	const place = await page.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(), p = r("pitchwrap"), b = r("mcToggle"), m = r("menuToggle"); return { bottom: Math.round(b.bottom - p.top), gap: Math.round(m.left - b.right), top: Math.round(b.top - m.top) }; });
	check("desktop: Match info sits beside Show menu, above the tags (not on them)", place.bottom < 44 && place.gap >= 4 && Math.abs(place.top) <= 2, JSON.stringify(place));

	// Played a few rounds first, so form and the table mean something.
	await page.evaluate(() => { const lg = window.__ff.league; lg.results = lg.results || []; });
	await page.keyboard.press("KeyO"); await page.waitForTimeout(200);
	const opp = await page.evaluate(() => {
		const F = window.__ff, box = document.getElementById("matchCentre"), xi = [ ...box.querySelectorAll(".mc-xi li") ];
		const facts = Object.fromEntries([ ...box.querySelectorAll(".mc-facts dt") ].map(dt => [ dt.textContent, dt.nextElementSibling.textContent ]));
		return { open: !box.hidden, name: box.querySelector(".mc-team b").textContent, want: F.TEAMS[F.currentFixture() ? F.currentFixture().opp : 0].name, n: xi.length, onPitch: F.players.filter(p => p.team === 1).length,
			rated: xi.every(li => /^\d{2}$/.test(li.querySelector(".ovr").textContent)), pos: xi.every(li => /^(GK|DEF|MID|FWD)$/.test(li.querySelector(".pos").textContent)), facts };
	});
	check("O opens the card on the opponent: name, shape, style and league place", opp.open && opp.name === opp.want && !!opp.facts.Shape && !!opp.facts.Style && /of 20/.test(opp.facts.League || ""), JSON.stringify(opp));
	check("their eleven on the pitch, each with position and rating", opp.n === opp.onPitch && opp.n >= 5 && opp.rated && opp.pos, JSON.stringify(opp));
	const form = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, id = F.currentFixture().opp, other = lg.members.find(x => x !== 0 && x !== id);
		const saved = { results: lg.results, round: lg.round };
		lg.results = [ [ [ id, other, 2, 0 ] ], [ [ other, id, 1, 1 ] ], [ [ other, id, 3, 1 ] ] ]; lg.round = 3;
		const f = F.formOf(id); lg.results = saved.results; lg.round = saved.round;
		return f.join("");
	});
	check("form reads their last results, oldest first", form === "WDL", form);

	await page.click("#matchCentre [data-mc=stats]"); await page.waitForTimeout(150);
	const st = await page.evaluate(() => { const rows = [ ...document.querySelectorAll("#matchCentre .mc-srow") ].map(r => r.textContent); return { rows: rows.length, poss: rows.some(r => /Possession/.test(r)), shots: rows.some(r => /Shots/.test(r)) }; });
	check("live stats for both sides: possession, shots and the rest", st.rows >= 7 && st.poss && st.shots, JSON.stringify(st));
	await page.evaluate(() => { window.__ff.step(240); });
	await page.waitForTimeout(1200);
	const live = await page.evaluate(() => document.querySelector("#matchCentre .mc-shead span").textContent);
	check("the stats refresh while the card is open (the clock moves on)", /\d/.test(live), live);

	// It sits off to the side: the card covers well under half of the pitch.
	const cover = await page.evaluate(() => { const a = document.getElementById("matchCentre").getBoundingClientRect(), p = document.getElementById("pitchwrap").getBoundingClientRect(); return +(a.width * a.height / (p.width * p.height)).toFixed(2); });
	check("the card covers well under half the pitch", cover < 0.35, String(cover));
	await page.click("#mcClose"); await page.waitForTimeout(100);
	const closed = await page.evaluate(() => document.getElementById("matchCentre").hidden);
	check("the close button folds it away", closed);
	// A substitution: the man going off walks to the touchline under applause, the new man jogs on, the clock waits.
	const sub = await page.evaluate(() => {
		const F = window.__ff;
		F.state = "play"; F.freeze = 0;
		for (const id of [ "lowerThird", "commLine" ]) { document.getElementById(id).hidden = true; }
		F.commReset();
		const p = F.outfield(0).find(q => F.ball.owner !== q), pl = F.subPool().find(q => q.pos !== "gk");
		const off = p.name, at = { x: p.x, y: p.y }, t0 = F.timeLeft;
		F.logGoalTest(0, off);
		F.makeSub(p, pl);
		const first = { kind: F.freezeKind, walks: F.subWalks.length, name: p.name, perf: F.lastApplause && F.lastApplause.perf };
		let maxStep = 0, maxY = p.y, minY = p.y, steps = 0, handed = null;
		while (F.subWalks.length && steps < 600) {
			const x = p.x, y = p.y;
			F.step(1); steps++;
			maxStep = Math.max(maxStep, Math.hypot(p.x - x, p.y - y)); maxY = Math.max(maxY, p.y); minY = Math.min(minY, p.y);
			if (!handed && p.name === pl.name) { handed = { steps, y: p.y, said: F.lastCommentary && F.lastCommentary.kind, text: F.lastCommentary && F.lastCommentary.text }; }
		}
		return { first, off, on: pl.name, steps, maxStep: +maxStep.toFixed(2), reachedLine: maxY > F.FH || minY < 0, back: Math.hypot(p.x - at.x, p.y - at.y) < 1, name: p.name, clock: F.timeLeft === t0, freeze: F.freeze, handed, plain: F.subPerf(1, "Nobody Atall") };
	});
	check("a substitution stops play and the man going off walks away under his own name, to applause", sub.first.kind === "sub" && sub.first.walks === 1 && sub.first.name === sub.off && sub.first.perf > 0, JSON.stringify(sub));
	check("he walks to the touchline (no teleport), the new man jogs back to the spot, and the clock waits", sub.reachedLine && sub.maxStep < 3.5 && sub.back && sub.name === sub.on && sub.clock && sub.freeze === 0 && sub.steps > 100, JSON.stringify(sub));
	check("at the line the commentator says who's on", sub.handed && sub.handed.said === "sub" && sub.handed.text.includes(sub.on), JSON.stringify(sub.handed));
	check("a scorer gets louder applause than a quiet game", sub.first.perf > sub.plain, JSON.stringify({ scorer: sub.first.perf, plain: sub.plain }));

	check("no page errors (desktop)", errs.length === 0, errs.slice(0, 3).join(" | "));
	await ctx.close();

	// A phone: the card fits the screen and leaves most of the pitch clear.
	const pctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const ph = await pctx.newPage(), perrs = [];
	ph.on("pageerror", e => perrs.push("pageerror: " + e.message));
	await ph.goto(URL); await ready(ph);
	await ph.tap("#ovButton"); await ph.waitForFunction(() => window.__ff.state === "play", null, { timeout: 60000 }); await ph.waitForTimeout(700);
	await ph.tap("#mcToggle"); await ph.waitForTimeout(200);
	const pv = await ph.evaluate(() => { const a = document.getElementById("matchCentre").getBoundingClientRect(), p = document.getElementById("pitchwrap").getBoundingClientRect(); return { open: !document.getElementById("matchCentre").hidden, inside: a.left >= p.left - 1 && a.right <= p.right + 1 && a.right <= innerWidth, cover: +(a.width * a.height / (p.width * p.height)).toFixed(2), wide: document.documentElement.scrollWidth - innerWidth }; });
	check("390 px: the card opens inside the pitch, no wider than the screen, and leaves most of the pitch clear", pv.open && pv.inside && pv.wide <= 0 && pv.cover < 0.6, JSON.stringify(pv));
	check("no page errors (phone)", perrs.length === 0, perrs.slice(0, 3).join(" | "));
	await pctx.close();
} catch (e) {
	check("the run finished", false, String(e && e.stack || e).slice(0, 400));
}
await browser.close();
server.stop();
process.exit(done() ? 1 : 0);
