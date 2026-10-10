// Run: node tests/move.mjs   (see tests/_env.mjs for the Playwright and Chrome settings)
import { launch, serve, sleep, tally, OUT, devices } from "./_env.mjs";
const server = serve(8797), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
await page.goto(URL); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });

// A clear run: opponents parked in a far corner, the human on the ball in open grass.
const run = (opts) => page.evaluate(async (o) => {
	const F = window.__ff; F.freeze = 0; F.timeLeft = 1e9; F.autoSwitchMode = "manual"; F.manualLock = 1e9;
	const me = F.human(); const FW = F.FW, FH = F.FH;
	for (const q of F.players) { q.vx = q.vy = 0; q.lunge = 0; q.lungeCd = 0; q.kickCd = 0; if (q !== me) { q.x = q.team === 1 ? FW - 40 : 40; q.y = 30 + 20 * F.players.indexOf(q); } }
	me.x = FW * 0.25; me.y = FH / 2; me.dir = 0; me.sprintFuel = 1; me.sprintOut = false; me.sprintAmt = 0; me.plant = 0;
	F.ball.owner = me; F.ball.x = me.x + 18; F.ball.y = me.y; F.ball.vx = F.ball.vy = 0; F.ball.z = 0; F.possTeam = 0;
	F.key("ArrowRight", true); if (o.sprint) { F.key("KeyE", true); }
	const d = [], v = []; let lost = 0, plantSeen = 0;
	for (let i = 0; i < o.frames; i++) {
		F.step(1);
		for (const q of F.players) { if (q !== me) { q.x = q.team === 1 ? FW - 40 : 40; q.y = 30 + 20 * F.players.indexOf(q); q.vx = q.vy = 0; } }   // everyone else stays parked
		if (F.ball.owner !== me) { lost++; }
		d.push(Math.hypot(F.ball.x - me.x, F.ball.y - me.y)); v.push(Math.hypot(me.vx, me.vy));
	}
	F.key("ArrowRight", false); F.key("KeyE", false);
	// let go at speed: he plants before he is still
	const v0 = Math.hypot(me.vx, me.vy);
	for (let i = 0; i < 12; i++) { F.step(1); if (me.plant > 0) { plantSeen++; } }
	const late = d.slice(60);
	const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
	return { lost, min: Math.min(...late).toFixed(1), max: Math.max(...late).toFixed(1), mean: mean(late).toFixed(1), speed: mean(v.slice(60)).toFixed(2), touchPh: me.touchPh, v0: v0.toFixed(2), plantSeen, wobble: (Math.max(...late) - Math.min(...late)).toFixed(1), nan: late.some(x => !Number.isFinite(x)) };
}, opts);
const jog = await run({ frames: 240, sprint: false });
check("jog: the ball is knocked ahead and caught up with (it moves between touches, stays within reach)", jog.lost === 0 && !jog.nan && jog.min >= 14 && jog.max <= 42 && jog.wobble >= 2, JSON.stringify(jog));
check("letting go at speed plants him (weight back) before he stops", jog.v0 > 1.6 && jog.plantSeen > 0, JSON.stringify({ v0: jog.v0, plantSeen: jog.plantSeen }));
const sprint = await run({ frames: 240, sprint: true });
check("sprint: faster, and the ball runs further ahead than at a jog", sprint.lost === 0 && !sprint.nan && Number(sprint.speed) > Number(jog.speed) && Number(sprint.max) > Number(jog.max) && sprint.max <= 46, JSON.stringify(sprint));
check("possession is never lost with nobody near", jog.lost === 0 && sprint.lost === 0);
// A defender standing in the path: a heavy touch can be nicked, a normal one usually not.
const steal = await page.evaluate(async () => {
	const F = window.__ff; const me = F.human(); const FW = F.FW, FH = F.FH;
	let lostS = 0, lostJ = 0;
	for (const sprint of [ true, false ]) {
		for (let trial = 0; trial < 12; trial++) {
			F.freeze = 0; F.state === "play";
			for (const q of F.players) { q.vx = q.vy = 0; q.kickCd = 0; q.slideAI = 0; if (q !== me) { q.x = q.team === 1 ? FW - 40 : 40; q.y = 30 + 20 * F.players.indexOf(q); } }
			const def = F.outfield(1)[3]; def.x = FW * 0.5; def.y = FH / 2; def.kickCd = 0;
			me.x = FW * 0.5 - 150; me.y = FH / 2; me.dir = 0; me.vx = me.vy = 0; me.sprintFuel = 1; me.sprintOut = false; me.sprintAmt = sprint ? 1 : 0; me.gotAt = -1000;
			F.ball.owner = me; F.ball.x = me.x + 18; F.ball.y = me.y; F.ball.vx = F.ball.vy = 0; F.possTeam = 0;
			F.key("ArrowRight", true); if (sprint) { F.key("KeyE", true); }
			let lost = false;
			for (let i = 0; i < 90; i++) { F.step(1); def.x = FW * 0.5; def.y = FH / 2; def.vx = def.vy = 0; if (F.ball.owner !== me) { lost = true; break; } }
			F.key("ArrowRight", false); F.key("KeyE", false);
			if (lost) { if (sprint) { lostS++; } else { lostJ++; } }
		}
	}
	return { lostS, lostJ };
});
check("running straight into a defender can cost the ball (the sim still contests it)", steal.lostS + steal.lostJ > 0, JSON.stringify(steal));
// 3D: a frame renders with the new pose code and nothing throws
await page.evaluate(() => { const F = window.__ff; F.freeze = 0; });
for (let i = 0; i < 3 && (await page.evaluate(() => window.__ff.camMode)) !== "3d"; i++) { await page.keyboard.press("c"); await sleep(400); }
await page.waitForFunction(() => window.THREE && window.__ff.G3 && window.__ff.G3.renderer, null, { timeout: 30000 }).catch(() => {});
await sleep(2500);
const cam = await page.evaluate(() => window.__ff.camMode);
const three = await page.evaluate(() => ({ rev: window.THREE && window.THREE.REVISION, renderer: !!(window.__ff.G3 && window.__ff.G3.renderer), lost: window.__ff.G3 && window.__ff.G3.lost }));
check("three.js loaded as a module at the new revision and the renderer is up", three.rev && Number(three.rev) >= 186 && three.renderer && !three.lost, JSON.stringify(three));
await page.keyboard.down("ArrowRight"); await sleep(1200);
await page.screenshot({ path: `${OUT}/3d-run.png` });
await page.keyboard.up("ArrowRight");
check("3D camera renders with the new poses, no errors", cam === "3d" && errs.length === 0, `cam=${cam} ${errs.join(" | ")}`);
// Faces: every player has a valid look (face cell 0-7, a hair colour, a known style), and it is
// fixed by name: clearing the cached look rebuilds exactly the same one.
const looks = await page.evaluate(async () => {
	const ps = window.__ff.players, before = ps.map(p => JSON.stringify(p.look));
	for (const p of ps) { p.look = null; }
	await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // the next frame draws them, rebuilding each look
	return ps.map((p, i) => ({ a: before[i], b: JSON.stringify(p.look), face: p.look ? p.look.face : -1, hair: p.look ? p.look.hair : null, style: p.look ? p.look.style : null }));
});
check("every player has a face, hair colour and style", looks.length > 0 && looks.every(l => l.face >= 0 && l.face < 8 && /^#/.test(l.hair || "") && [ "short", "crop", "curly", "afro", "long", "tied", "buzz", "shaved" ].includes(l.style)), JSON.stringify(looks.filter(l => !(l.face >= 0 && l.face < 8 && l.hair)).slice(0, 2)));
check("a player's look is fixed by name (same after a rebuild)", looks.every(l => l.a === l.b), JSON.stringify(looks.filter(l => l.a !== l.b).slice(0, 1)));
// Brace and hat-trick captions: the same man scoring again is named in the goal caption.
const caps = await page.evaluate(() => { const F = window.__ff, out = []; F.autoPilot = false; F.timeLeft = 1e9; for (let k = 0; k < 3; k++) { F.freeze = 0; F.forceGoal(0); const s0 = F.score[0]; for (let i = 0; i < 200 && F.score[0] === s0; i++) { F.step(1); } out.push(F.lastCaption && F.lastCaption.sub); for (let i = 0; i < 3000 && F.state !== "play"; i++) { F.step(1); } } return out; });
check("same scorer: first goal plain, then Brace, then Hat-trick", caps.length === 3 && !/Brace|Hat-trick/.test(caps[0]) && /Brace/.test(caps[1]) && /Hat-trick/.test(caps[2]), JSON.stringify(caps));
// The score bug clock is always a sane mm:ss, even with the test-sized timeLeft above (once read "16666666:36").
const clk = await page.evaluate(() => { const F = window.__ff; F.forceGoal(0); for (let i = 0; i < 5; i++) { F.step(1); } return { shown: document.getElementById("clock").textContent, f: [ F.fmtClock(1e9, 180), F.fmtClock(NaN, 180), F.fmtClock(-5, 180), F.fmtClock(95.2, 180), F.fmtClock(1e12) ] }; });
check("score bug clock stays mm:ss within the match length", /^\d{2}:\d{2}$/.test(clk.shown) && clk.f.join() === "03:00,00:00,00:00,01:36,99:59", JSON.stringify(clk));
// The first-match coach mark showed once (ff-coach stored) and "Got it" dismisses it.
const coach = await page.evaluate(() => { const el = document.getElementById("coachMark"), stored = localStorage.getItem("ff-coach"); el.hidden = false; document.getElementById("coachClose").click(); return { stored, hidden: el.hidden }; });
check("first-match coach mark is stored as shown and dismissable", coach.stored === "1" && coach.hidden === true, JSON.stringify(coach));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
