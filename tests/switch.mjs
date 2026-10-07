// Run: node tests/switch.mjs   (see tests/_env.mjs for the Playwright and Chrome settings)
import { launch, serve, sleep, tally, OUT, devices } from "./_env.mjs";
const server = serve(8791), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver/.test(m.text())) { errs.push(m.text().slice(0, 200)); } });
await page.goto(URL);
await page.waitForSelector("#ovButton");
await page.click("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });

// scene: kind = "carrier" (opponent stands on the ball), "loose" (ball lying still), "rolling" (ball rolling to the teammate)
const scene = (opts) => page.evaluate((o) => {
	const F = window.__ff;
	F.timeLeft = 1e9; F.freeze = 0; F.autoSwitchMode = o.mode; F.manualLock = 0; F.switchCd = 0; F.autoHold = 0; F.steerSwitchDone = false;
	const FW = F.FW, FH = F.FH;
	const q = F.outfield(1)[3], mine = F.outfield(0), m = mine[2], d = mine[5];
	for (const p of F.players) { p.vx = p.vy = 0; p.lunge = 0; p.lungeCd = 0; p.kickCd = 0; }
	for (const p of F.outfield(1)) { if (p !== q) { p.x = FW - 60; p.y = 40 + 30 * F.outfield(1).indexOf(p); } }
	for (const p of mine) { if (p !== m && p !== d) { p.x = 60; p.y = 40 + 30 * mine.indexOf(p); } }
	q.x = FW * 0.5; q.y = FH / 2; q.dir = Math.PI;
	if (o.far) { m.x = FW * 0.75; m.y = FH - 40; } else { m.x = q.x - (o.mDist || 160); m.y = q.y + 120; }
	if (o.bothClose) { m.x = q.x - 70 + 20 - 35; m.y = q.y + 18; }   // your man 35 from where the loose ball lies
	m.sprintFuel = 1; m.sprintOut = false;
	d.x = q.x - (o.dDist !== undefined ? o.dDist : 70); d.y = q.y + 10;
	F.ball.z = 0; F.ball.vz = 0; F.ball.vx = F.ball.vy = 0;
	if (o.kind === "carrier") { F.ball.owner = q; F.ball.x = q.x - 18; F.ball.y = q.y; }
	else { F.ball.owner = null; q.x = FW - 60; q.y = FH - 40; F.ball.x = d.x + (o.ballDx !== undefined ? o.ballDx : 20); F.ball.y = d.y; if (o.kind === "rolling") { F.ball.vx = -2.2; F.ball.vy = 0; F.ball.x = d.x + 90; } }
	F.ctrl = F.players.indexOf(m); F.possTeam = 1; F.lastSwitchKind = "";
	const arrows = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
	const setDir = (dx, dy) => { const n = Math.hypot(dx, dy) || 1; const want = { ArrowLeft: dx / n < -0.38, ArrowRight: dx / n > 0.38, ArrowUp: dy / n < -0.38, ArrowDown: dy / n > 0.38 }; for (const k in want) { if (want[k] !== arrows[k]) { arrows[k] = want[k]; F.key(k, want[k]); } } };
	const tgt = () => F.ball.owner || F.ball;
	if (o.steer) { setDir(tgt().x - m.x, tgt().y - m.y); } else { setDir(0, 0); F.steerAt = -1000; }
	let involuntary = 0, kinds = [], ran = 0, firstAt = -1, to = null;
	const qx = q.x, qy = q.y;
	for (let i = 0; i < o.frames; i++) {
		ran++;
		if (o.kind === "carrier" && !o.far && !(F.ball.owner && F.ball.owner.team === 0)) { F.ball.owner = q; q.x = qx; q.y = qy; q.vx = q.vy = 0; F.ball.x = qx - 18; F.ball.y = qy; F.ball.z = 0; F.ball.vx = F.ball.vy = 0; }
		const h0 = F.human();
		if (o.steer) { const t = tgt(); setDir(t.x - h0.x, t.y - h0.y); } else { setDir(0, 0); }
		F.step(1);
		const o2 = F.ball.owner;
		if (F.human() !== h0) {
			if (!(o2 && o2.team === 0 && o2 === F.human() && F.lastSwitchKind !== "near")) { involuntary++; kinds.push(F.lastSwitchKind); }
			if (firstAt < 0) { firstAt = ran; to = F.human() === d ? "d" : F.human() === m ? "m" : "other"; }
			if (!o.keepGoing) { break; }
		}
	}
	setDir(0, 0);
	return { involuntary, kinds, ran, firstAt, to, autoHold: F.autoHold, state: F.state, owner: F.ball.owner ? (F.ball.owner.team === 0 ? (F.ball.owner === d ? "d" : "mine") : "theirs") : "loose", humanIsD: F.human() === d };
}, opts);

// 1. The reported case: a loose ball at a teammate's feet, your man 200 away steering toward it.
let r = await scene({ mode: "assisted", kind: "loose", steer: true, frames: 60 });
check("Assisted + steering: loose ball at a teammate's feet hands you that teammate within a quarter second", r.to === "d" && r.firstAt > 0 && r.firstAt <= 15 && r.kinds[0] === "near", JSON.stringify(r));
r = await scene({ mode: "assisted", kind: "loose", steer: false, frames: 60 });
check("Assisted + idle: same, at once", r.to === "d" && r.firstAt > 0 && r.firstAt <= 15, JSON.stringify(r));
// 2. A ball rolling to the teammate: you get him as it arrives, before his first touch.
r = await scene({ mode: "assisted", kind: "rolling", steer: true, frames: 90 });
check("Assisted + steering: a ball rolling to a teammate gives you him before it arrives", r.to === "d" && r.firstAt > 0 && r.firstAt <= 45 && r.kinds[0] === "near", JSON.stringify(r));
// 3. Manual never switches by itself (until the teammate's first touch, which is the old rule).
r = await scene({ mode: "manual", kind: "loose", steer: true, frames: 40, ballDx: 60 });
check("Manual only: no near-ball switch", r.involuntary === 0 || (r.kinds.length && r.kinds.every(k => k !== "near")), JSON.stringify(r));
// 4. Aggressive gets it too.
r = await scene({ mode: "aggressive", kind: "loose", steer: true, frames: 60 });
check("Aggressive + steering: near-ball switch", r.to === "d" && r.firstAt <= 15, JSON.stringify(r));
// 5. Your own man nearly on the ball too: left alone.
r = await scene({ mode: "assisted", kind: "loose", steer: true, frames: 30, bothClose: true, ballDx: 20 });
check("Both close to the ball: your man is left alone (no near switch)", !r.kinds.includes("near"), JSON.stringify(r));
// 6. The earlier guarantees still hold: a carrier standing 70 from a teammate, you 200 away steering.
r = await scene({ mode: "assisted", kind: "carrier", steer: true, frames: 120 });
check("Assisted + steering toward a carrier: no yank until a teammate is on the ball, then he is yours within a second", r.involuntary === 1 && r.kinds[0] === "near" && r.firstAt > 10 && r.firstAt <= 60 && r.state === "play", JSON.stringify(r));
r = await scene({ mode: "assisted", kind: "carrier", steer: false, frames: 120 });
check("Assisted idle: the clearly better defender is picked", r.involuntary === 1 && r.kinds[0] === "idle", JSON.stringify(r));
r = await scene({ mode: "manual", kind: "carrier", steer: false, frames: 120 });
check("Manual only: never switches by itself", r.involuntary === 0, JSON.stringify(r));
r = await scene({ mode: "aggressive", kind: "carrier", steer: true, frames: 120 });
check("Aggressive: switches even while steering", r.involuntary === 1 && r.kinds[0] === "aggressive", JSON.stringify(r));
r = await scene({ mode: "assisted", kind: "carrier", steer: true, frames: 120, far: true });
check("Assisted: a man far from the play is swapped within half a second while steering", r.involuntary === 1 && r.kinds[0] === "rescue" && r.ran <= 30, JSON.stringify(r));
// 7. No ping-pong: after the near switch, keep steering; control stays with d for a second.
r = await scene({ mode: "assisted", kind: "loose", steer: true, frames: 75, keepGoing: true });
check("After a near switch control stays put (no ping-pong in the next second)", r.to === "d" && r.involuntary <= 1 && r.humanIsD, JSON.stringify(r));
check("no console errors in the switch checks", errs.length === 0, errs.join(" | "));

// 8. Sanity: a stretch of real play on auto-pilot runs clean.
const sane = await page.evaluate(() => { const F = window.__ff; F.autoPilot = true; F.timeLeft = 1e9; F.freeze = 0; let sw = 0, last = F.ctrl; for (let i = 0; i < 3600; i++) { F.step(1); if (F.ctrl !== last) { sw++; last = F.ctrl; } } F.autoPilot = false; return { sw, state: F.state, score: F.score }; });
check("a minute of play on auto-pilot runs without errors", errs.length === 0 && sane.state === "play", JSON.stringify(sane) + " " + errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
