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
// Animation (drawing only), measured on the rig: planted feet don't slide, the boot meets the ball on the
// frame it goes, a diving keeper's gloves and a header's head go to the ball.
const anim = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), out = {};
	for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }
	F.freeze = 0;
	const p = F.outfield(0)[2], keep = [ p.x, p.y, p.vx, p.vy, p.dir, p.stride, p.runAmt, p.shuf ], owner = F.ball.owner;
	Object.assign(p, { kickA: 0, windUp: 0, lunge: 0, slideAI: 0, fall: 0, celebA: 0, jump: 0, dive: 0, plant: 0, recv: 0, jockW: 0, shieldW: 0, sta: 1, sprintAmt: 0 });
	F.ball.owner = null; F.ball.x = 30; F.ball.y = 30; F.ball.z = 0;
	// Skating: a planted sole's ground speed against his own, running forward and backpedalling.
	for (const [ name, vx, dir ] of [ [ "run", 2.6, 0 ], [ "back", 1.3, Math.PI ] ]) {
		p.x = F.FW / 2; p.y = F.FH / 2; p.dir = dir; p.vx = vx; p.vy = 0; p.stride = 0; p.runAmt = 0.6; p.shuf = name === "back" ? 1 : 0;
		const g = p.build, hist = [];
		for (let f = 0; f < 90; f++) {
			p.stride += Math.PI * 2 * (0.95 + 0.5 * vx) / g.stride * (1 + 0.35 * p.shuf) / 60; p.x += vx;
			const r = F.poseProbe(p, 1);
			hist.push([ 0, 1 ].map(i => { const v = r.an[i].position.clone().set(0.8, -0.8, 0); r.an[i].localToWorld(v); return [ v.x, v.y, v.z ]; }));
		}
		let n = 0, slip = 0;
		for (let f = 31; f < hist.length; f++) { for (let i = 0; i < 2; i++) { if (hist[f][i][1] < 0.3 && hist[f - 1][i][1] < 0.3) { n++; slip += Math.hypot(hist[f][i][0] - hist[f - 1][i][0], hist[f][i][2] - hist[f - 1][i][2]); } } }
		out[name] = { planted: n, slip: +(slip / Math.max(1, n) / vx).toFixed(2) };
	}
	[ p.x, p.y, p.vx, p.vy, p.dir, p.stride, p.runAmt, p.shuf ] = keep; F.ball.owner = owner;
	return out;
});
check("running and backpedalling, a planted boot stays put (sliding under a sixth of his speed)", anim.run.planted > 10 && anim.run.slip < 0.17 && anim.back.planted > 10 && anim.back.slip < 0.17, JSON.stringify(anim));
const strike = await page.evaluate(() => {
	const F = window.__ff, out = {};
	for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }
	F.freeze = 0; F.timeLeft = 1e9; F.autoSwitchMode = "manual"; F.manualLock = 1e9;
	const me = F.human(), FW = F.FW, FH = F.FH;
	const park = () => { for (const q of F.players) { if (q !== me && q.role !== "gk") { q.x = q.team === 1 ? FW - 60 : 60; q.y = 30 + 20 * F.players.indexOf(q); q.vx = q.vy = 0; } } };
	park(); me.x = FW * 0.62; me.y = FH / 2 + 30; me.dir = 0; me.vx = 1.5; me.vy = 0; me.kickCd = 0; me.windUp = 0; me.kickA = 0;
	F.ball.owner = me; F.ball.x = me.x + 18; F.ball.y = me.y; F.ball.z = 0; F.possTeam = 0;
	F.key("ArrowRight", true);
	for (let i = 0; i < 30; i++) { park(); F.step(1); }
	F.press("KeyD"); for (let i = 0; i < 25; i++) { park(); F.step(1); } F.release("KeyD");
	const kf = me.build && me.build.left ? 0 : 1, rows = [];
	for (let i = 0; i < 20; i++) {
		park(); F.step(1);
		const r = F.poseProbe(me, 1), br = F.G3.ballR || 2.6, b = { x: F.ball.x, y: (F.ball.z || 0) * 0.71 + br, z: F.ball.y };
		let d = 1e9; for (const [ bx, by, bz ] of [ [ -1.2, -0.3, 0 ], [ 0, -0.3, 0 ], [ 1.2, -0.3, 0 ], [ 2.4, -0.3, 0 ], [ 3.3, -0.4, 0 ], [ 1, 0.2, 0.7 ], [ 1, 0.2, -0.7 ], [ 2, 0.1, 0.6 ], [ 2, 0.1, -0.6 ] ]) { const v = r.an[kf].position.clone().set(bx, by, bz); r.an[kf].localToWorld(v); d = Math.min(d, Math.hypot(v.x - b.x, v.y - b.y, v.z - b.z) - br); }
		rows.push({ kickA: me.kickA || 0, own: F.ball.owner === me, d });
	}
	F.key("ArrowRight", false);
	const ci = rows.findIndex(r => r.kickA === 15 && !r.own);
	return { gap: ci > 0 ? +rows[ci - 1].d.toFixed(1) : null, wound: ci > 1 ? +rows[ci - 2].d.toFixed(1) : null };
});
check("a shot: the boot is at the ball on the last frame before it goes (and back from it the frame before)", strike.gap !== null && strike.gap < 2 && strike.wound > strike.gap + 2, JSON.stringify(strike));
const save = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), res = [];
	for (const [ z, vz, side ] of [ [ 0, 0, -1 ], [ 14, 1.2, 1 ] ]) {
		// Open play, not a restart still being taken (the keeper walking to a goal kick doesn't dive).
		for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }
		F.freeze = 0;
		const gk = F.players.find(q => q.role === "gk" && q.team === 1), me = F.human(), FW = F.FW, FH = F.FH;
		const park = () => { for (const q of F.players) { if (q !== gk) { q.x = q.team === 1 ? FW - 400 : 300; q.y = 30 + 20 * F.players.indexOf(q); q.vx = q.vy = 0; } } };
		park(); gk.x = FW - 22; gk.y = FH / 2; gk.vx = gk.vy = 0; gk.dive = 0; gk.diveCd = 0; gk.kickCd = 0; gk.dir = Math.PI;
		const B = F.ball, ty = FH / 2 + side * (F.GOAL_B - F.GOAL_T) * 0.2, x0 = FW - 230;
		B.owner = null; B.x = x0; B.y = FH / 2; B.z = z; B.vz = vz; B.vx = 13; B.vy = (ty - FH / 2) / ((FW - 20 - x0) / 13); B.lastBy = me; B.shot = true; B.kickedAt = F.frame; B.curlT = 0; B.dipG = 0; B.beaten = null; B.pen = null;
		let best = 1e9, dove = false; const tr = [];
		for (let f = 0; f < 30 && F.state === "play" && B.owner !== gk; f++) {
			F.step(1); park(); if (gk.dive > 0) { dove = true; }
			tr.push([ Math.round(B.x - gk.x), Math.round(B.y - gk.y), Math.round(B.z || 0), F.state, B.owner ? B.owner.role : "-" ]);
			const r = F.poseProbe(gk, 1), b = { x: B.x, y: (B.z || 0) * 0.71, z: B.y };
			// (or the frame he holds it: a keeper square to the shot catches it at full reach, about 31 out, and the
			// window used to miss that frame: the check failed about 1 run in 10)
			if (Math.abs(B.x - gk.x) < 30 || B.owner === gk) { for (const k of [ 0, 1 ]) { const h = W(r.ha[k]); best = Math.min(best, Math.hypot(h.x - b.x, h.y - b.y, h.z - b.z)); } }
		}
		for (let i = 0; i < 600 && F.state !== "play"; i++) { F.step(1); }
		res.push({ dove, reach: +best.toFixed(1), tr: best > 1e8 ? tr.slice(0, 20) : undefined });
	}
	return res;
});
check("a diving keeper stretches to the ball: gloves within 24 of it as it reaches him (they stayed 34 to 40 away)", save.every(s => s.dove && s.reach < 24), JSON.stringify(save));
// Faces: every player has a valid look (face cell 0-15, a hair colour, a known style), and it is
// fixed by name: clearing the cached look rebuilds exactly the same one.
const looks = await page.evaluate(async () => {
	const ps = window.__ff.players, before = ps.map(p => JSON.stringify(p.look));
	for (const p of ps) { p.look = null; }
	await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // the next frame draws them, rebuilding each look
	return ps.map((p, i) => ({ a: before[i], b: JSON.stringify(p.look), face: p.look ? p.look.face : -1, hair: p.look ? p.look.hair : null, style: p.look ? p.look.style : null }));
});
check("every player has a face, hair colour and style", looks.length > 0 && looks.every(l => l.face >= 0 && l.face < 16 && /^#/.test(l.hair || "") && [ "short", "crop", "curly", "afro", "long", "tied", "buzz", "shaved" ].includes(l.style)), JSON.stringify(looks.filter(l => !(l.face >= 0 && l.face < 16 && l.hair)).slice(0, 2)));
check("a player's look is fixed by name (same after a rebuild)", looks.every(l => l.a === l.b), JSON.stringify(looks.filter(l => l.a !== l.b).slice(0, 1)));
// Brace and hat-trick captions: the same man scoring again is named in the goal caption.
const caps = await page.evaluate(() => { const F = window.__ff, out = []; F.autoPilot = false; F.timeLeft = 1e9; for (let k = 0; k < 3; k++) { F.freeze = 0; F.forceGoal(0); const s0 = F.score[0]; for (let i = 0; i < 200 && F.score[0] === s0; i++) { F.step(1); } out.push(F.lastCaption && F.lastCaption.sub); for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); } } return out; });
check("same scorer: first goal plain, then Brace, then Hat-trick", caps.length === 3 && !/Brace|Hat-trick/.test(caps[0]) && /Brace/.test(caps[1]) && /Hat-trick/.test(caps[2]), JSON.stringify(caps));
// The score bug clock is always a sane mm:ss, even with the test-sized timeLeft above (once read "16666666:36").
const clk = await page.evaluate(() => { const F = window.__ff; F.forceGoal(0); for (let i = 0; i < 5; i++) { F.step(1); } return { shown: document.getElementById("clock").textContent, f: [ F.fmtClock(1e9, 180), F.fmtClock(NaN, 180), F.fmtClock(-5, 180), F.fmtClock(95.2, 180), F.fmtClock(1e12) ] }; });
check("score bug clock stays mm:ss within the match length", /^\d{2}:\d{2}$/.test(clk.shown) && clk.f.join() === "03:00,00:00,00:00,01:36,99:59", JSON.stringify(clk));
// The first-match coach mark showed once (ff-coach stored) and "Got it" dismisses it.
const coach = await page.evaluate(() => { const el = document.getElementById("coachMark"), stored = localStorage.getItem("ff-coach"); el.hidden = false; document.getElementById("coachClose").click(); return { stored, hidden: el.hidden }; });
check("first-match coach mark is stored as shown and dismissable", coach.stored === "1" && coach.hidden === true, JSON.stringify(coach));
// 3D figures turn, they don't snap: the drawn facing never swings faster than ~16 rad/s even when the
// simulation swings p.dir round in a frame. Every player has his own running style; the ball is near true size close up.
const feel = await page.evaluate(() => new Promise(res => {
	const F = window.__ff; for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }
	F.freeze = 0;
	const prev = new Map(); let max = 0, n = 0, snaps = 0;
	const tick = () => {
		// Per drawn frame: the game's own frame time for the frame whose facing we read (wall-clock gaps
		// between these callbacks jitter on a busy machine and made this flaky).
		const dts = F.frameDt / 1000;
		const st = F.G3 && F.G3.fig && F.G3.fig.yawSt;
		for (const p of F.players) {
			const y = st && st.get(p) ? st.get(p).yaw : null;
			const acting = p.kickA > 0 || p.slideAI > 0 || p.lunge > 0 || p.dive > 0 || p.fall > 0 || p.throwA > 0 || (p.z || 0) > 0 || p.jump > 0;   // actions snap to the play on purpose
			if (acting) { prev.delete(p); continue; }
			if (y !== null && prev.has(p) && dts > 0) { const d = Math.abs(Math.atan2(Math.sin(y - prev.get(p)), Math.cos(y - prev.get(p)))); if (d < 1.5) { max = Math.max(max, d / dts); } else { snaps++; } }
			if (y !== null) { prev.set(p, y); }
		}
		if (++n < 240) { requestAnimationFrame(tick); } else {
			const arms = new Set(F.players.map(p => p.build && p.build.arm && p.build.arm.toFixed(2)));
			res({ max: +max.toFixed(1), snaps, styles: arms.size, ballR: F.G3.ballR });
		}
	};
	requestAnimationFrame(tick);
}));
check("3D facing turns smoothly (no drawn turn faster than ~17 rad/s)", feel.max > 0 && feel.max <= 17 && feel.snaps <= 2, JSON.stringify(feel));
const aim = await page.evaluate(() => new Promise(res => {
	const F = window.__ff, prevK = new Map(), errs = []; let n = 0;
	const tick = () => {
		const st = F.G3.fig.yawSt;
		for (const p of F.players) { const k = p.kickA || 0, was = prevK.get(p) || 0; prevK.set(p, k); if (k > 0 && was > 0 && st.get(p)) { const d = p.dir - st.get(p).yaw; errs.push(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))); } }
		if (++n < 600) { requestAnimationFrame(tick); } else { errs.sort((a, b) => a - b); res({ kicks: errs.length, med: errs.length ? errs[errs.length >> 1] : 0 }); }
	};
	requestAnimationFrame(tick);
}));
check("kicking, the drawn body faces where the ball goes (the turn smoothing steps aside)", aim.med < 0.3, JSON.stringify(aim));
check("players run in their own styles, and the 3D ball stays between true size and gantry size", feel.styles >= 8 && feel.ballR >= 2.4 && feel.ballR <= 5, JSON.stringify(feel));
// Matchday dressing: the home ends get a banner and waving flags; a home goal throws ticker tape.
const dress = await page.evaluate(async () => {
	const F = window.__ff, G = F.G3; const flags = G.endFlags ? G.endFlags.length : 0, banners = G.endBanners ? G.endBanners.length : 0;
	const a0 = G.endFlags && G.endFlags[0] ? G.endFlags[0].cloth.geometry.attributes.position.array.at(-1) : 0;
	await new Promise(r => setTimeout(r, 300));
	const a1 = G.endFlags && G.endFlags[0] ? G.endFlags[0].cloth.geometry.attributes.position.array.at(-1) : 0;
	return { flags, banners, waves: a0 !== a1, drawMs: +F.drawMs.toFixed(2) };
});
// Exhausted players stay upright in open play (they bend over only at a stoppage): posed on a spare figure,
// so it no longer depends on catching a sprinting man mid-lean. Every action is cleared, the wind-up for a pass
// included: borrowed mid-wind-up (likelier on a slow run) he counts as acting and never takes the tired pose.
const tired = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone());
	for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }
	const fz = F.freeze; F.freeze = 0;
	const p = F.outfield(0)[3], keep = [ p.sta, p.vx, p.vy, p.runAmt ], owner = F.ball.owner;
	Object.assign(p, { kickA: 0, windUp: 0, lunge: 0, slideAI: 0, fall: 0, celebA: 0, celebK: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, kneel: 0, hug: 0, sulk: 0, plant: 0, recv: 0, recvK: null, vx: 0, vy: 0, runAmt: 0, sprintAmt: 0, jockW: 0, shieldW: 0, shuf: 0 });
	if (owner === p) { F.ball.owner = null; }
	const lean = () => { const r = F.poseProbe(p, 1), inv = r.root.matrixWorld.clone().invert(), hp = W(r.hips).applyMatrix4(inv), nk = W(r.neck).applyMatrix4(inv); return +(Math.atan2(nk.x - hp.x, nk.y - hp.y) * 57.3).toFixed(1); };
	p.sta = 1; const fresh = lean(); p.sta = 0.3; const open = lean(); F.freeze = 30; const stop = lean(); F.freeze = fz;
	[ p.sta, p.vx, p.vy, p.runAmt ] = keep; F.ball.owner = owner;
	return { fresh, open, stop, bent: open - fresh > 6 ? 1 : 0 };
});
check("exhausted players stay upright in open play (no bending over mid-match), and bend over at a stoppage", tired.bent === 0 && tired.stop > tired.open + 15, JSON.stringify(tired));
// Through balls (W) go forward to a teammate ahead of you, preferring runners, and you take control of him.
const tb = await page.evaluate(() => {
	const F = window.__ff, out = { n: 0, ahead: 0, ctrl: 0, withAhead: 0 };
	for (let t = 0; t < 80 && out.n < 15; t++) {
		for (let i = 0; i < 4000 && F.state !== "play"; i++) { F.step(1); }
		F.freeze = 0; F.timeLeft = 1e9;
		const me = F.human();
		F.ball.owner = me; F.ball.z = 0; F.possTeam = 0; me.dir = 0;
		const clear = () => { for (const q of F.players) { if (q.team === 1 && Math.hypot(q.x - me.x, q.y - me.y) < 120) { q.x = Math.min(F.FW - 20, me.x + 220); q.vx = q.vy = 0; } } };   // nobody tackles him while he sets up
		for (let i = 0; i < 60; i++) { clear(); F.step(1); }
		if (F.ball.owner !== me || F.state !== "play") { continue; }
		const anyAhead = F.players.some(q => q.team === 0 && q.role !== "gk" && q !== me && q.x > me.x + 60 && Math.hypot(q.x - me.x, q.y - me.y) < 450);
		F.press("KeyW"); F.step(1); F.release("KeyW");
		const tgt = F.players[F.ctrl];
		if (tgt === me) { continue; }
		out.n++; if (anyAhead) { out.withAhead++; if (tgt.x > me.x) { out.ahead++; } }
		if (F.receiver === tgt) { out.ctrl++; }
	}
	return out;
});
check("through balls go forward to a runner when one is ahead, and control follows the ball", tb.n >= 8 && tb.ahead >= tb.withAhead * 0.8 && tb.ctrl === tb.n, JSON.stringify(tb));
// A loose ball arriving at one of your players far from your man: control goes to him as it gets there.
const arrive = await page.evaluate(() => {
	const F = window.__ff, out = { n: 0, ok: 0 };
	for (let t = 0; t < 8; t++) {
		for (let i = 0; i < 4000 && F.state !== "play"; i++) { F.step(1); }
		F.freeze = 0; F.timeLeft = 1e9; F.autoSwitchMode = "assisted";
		const me = F.human(), mates = F.outfield(0).filter(q => q !== me), m = mates[t % mates.length];
		for (const q of F.players) { if (q !== m) { q.x = q.team === 0 ? 60 : F.FW - 60; q.y = 40 + F.players.indexOf(q) * 20; q.vx = q.vy = 0; } }
		me.x = F.FW * 0.2; me.y = F.FH * 0.9;
		m.x = F.FW * 0.55; m.y = F.FH * 0.4; m.vx = m.vy = 0;
		F.ball.owner = null; F.ball.z = 0; F.ball.x = m.x - 160; F.ball.y = m.y; F.ball.vx = 5; F.ball.vy = 0;
		let got = false;
		for (let i = 0; i < 60; i++) { F.step(1); if (F.players[F.ctrl] === m) { got = true; break; } }
		out.n++; if (got) { out.ok++; }
	}
	return out;
});
check("a loose ball arriving at a teammate hands you control of him", arrive.ok >= arrive.n - 1, JSON.stringify(arrive));
// Running arms swing from straight down, not from the leaning torso: the upper arm never trails far behind.
const swing = await page.evaluate(async () => {
	const F = window.__ff, G3 = F.G3, out = [];
	for (let i = 0; i < 4000 && F.state !== "play"; i++) { F.step(1); }
	for (let k = 0; k < 40; k++) {
		await new Promise(r => setTimeout(r, 40));
		F.players.forEach((p, i) => {
			const r = G3.fig && G3.fig.rigOf && G3.fig.rigOf.get(p);
			if (!r || p.role === "gk" || Math.hypot(p.vx || 0, p.vy || 0) < 1.2) { return; }
			const o = r.root.getWorldPosition(r.root.position.clone()), fwd = r.root.localToWorld(r.root.position.clone().set(1, 0, 0)).sub(o).normalize();
			for (let j = 0; j < 2; j++) {
				const ua = r.el[j].getWorldPosition(r.el[j].position.clone()).sub(r.sh[j].getWorldPosition(r.sh[j].position.clone()));
				out.push(Math.atan2(-ua.dot(fwd), -ua.y));
			}
		});
	}
	out.sort((a, b) => a - b);
	return { n: out.length, p98: +(out[Math.floor(out.length * 0.98)] || 0).toFixed(2) };
});
check("running, the upper arm stays within about 25 degrees behind vertical (no hands off the back)", swing.n > 100 && swing.p98 < 0.45, JSON.stringify(swing));
// A goal huddle: team-mates' hands go forward round the scorer, never behind their own backs.
// Posed on a spare figure (in a live huddle a team-mate may be mid-jump, arms out wide), through the hug's bounce.
const huddle = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), p = F.outfield(0)[1];
	const keep = [ p.celebA, p.hug, p.idlePh ];
	Object.assign(p, { kickA: 0, lunge: 0, slideAI: 0, fall: 0, celebK: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, kneel: 0, sulk: 0, plant: 0, recv: 0, recvK: null, celebA: 1, hug: 1 });
	let min = 1e9;
	for (let k = 0; k < 12; k++) {
		p.idlePh = k * 0.37;
		const r = F.poseProbe(p, 1), inv = r.root.matrixWorld.clone().invert(), ch = W(r.chest).applyMatrix4(inv);
		for (let j = 0; j < 2; j++) { min = Math.min(min, W(r.ha[j]).applyMatrix4(inv).x - ch.x); }
	}
	[ p.celebA, p.hug, p.idlePh ] = keep;
	return { hug: true, min: +min.toFixed(1) };
});
check("in a goal huddle the hugging players' hands are in front of them", huddle.min > 2, JSON.stringify(huddle));
// Standing, the hands hang at his sides, outside the line of the shoulders, never tucked in behind the shorts.
const sides = await page.evaluate(async () => {
	const F = window.__ff, G3 = F.G3, out = [];
	for (let i = 0; i < 4000 && F.state !== "play"; i++) { F.step(1); }
	F.freeze = 0;
	// Only a man who has stood still for five samples in a row: one who has just stopped is still mid-stride in the
	// pose (an arm swinging across him), and on a busy machine fewer frames pass between samples to settle it.
	const stillFor = new Map();
	for (let k = 0; k < 300 && out.length < 40; k++) {   // live play: wait (up to 12 s) until some stand still
		await new Promise(r => setTimeout(r, 40));
		F.players.forEach((p, i) => {
			const r = G3.fig && G3.fig.rigOf && G3.fig.rigOf.get(p);
			const n = Math.hypot(p.vx || 0, p.vy || 0) > 0.3 ? 0 : (stillFor.get(p) || 0) + 1; stillFor.set(p, n);
			if (!r || p.role === "gk" || n < 5 || p.kickA > 0 || (p.celebA || 0) > 0 || p.headHands > 0 || p.fistPump > 0 || F.staOf(p) < 0.6 || F.ball.owner === p) { return; }
			const hip = r.hips.getWorldPosition(r.hips.position.clone()), o = r.root.getWorldPosition(r.root.position.clone());
			const side = r.root.localToWorld(r.root.position.clone().set(0, 0, 1)).sub(o).normalize();
			for (let j = 0; j < 2; j++) {
				const h = Math.abs(r.ha[j].getWorldPosition(r.ha[j].position.clone()).sub(hip).dot(side)), sh = Math.abs(r.sh[j].getWorldPosition(r.sh[j].position.clone()).sub(hip).dot(side));
				out.push(h - sh);
			}
		});
	}
	out.sort((a, b) => a - b);
	return { n: out.length, p10: +(out[Math.floor(out.length * 0.1)] || 0).toFixed(2) };
});
check("standing, the hands hang outside the shoulders, not in behind the shorts", sides.n >= 10 && sides.p10 > -0.3, JSON.stringify(sides));
// Big moments: a near miss puts the shooter's hands on his head and the commentator says so, once.
const mom = await page.evaluate(async () => {
	const F = window.__ff, G3 = F.G3, W = n => n.getWorldPosition(n.position.clone());
	F.state === "play" || (F.state = "play"); F.freeze = 0;
	for (const id of [ "lowerThird", "commLine" ]) { const e = document.getElementById(id); if (e) { e.hidden = true; } }
	const p = F.outfield(0).find(q => !(q.jump > 0) && !(q.kickA > 0) && !(q.fall > 0) && F.ball.owner !== q) || F.outfield(0)[2];
	p.jump = 0;
	F.commReset(); F.moment("near", p);
	const line = document.getElementById("commLine"), shown = !line.hidden, text = document.getElementById("commText").textContent;
	F.moment("save", F.outfield(0)[1], { keeper: F.players.find(q => q.role === "gk" && q.team === 1) });
	const second = document.getElementById("commText").textContent;
	// The page's clock is held and the match stepped here: on a busy machine 450 ms of real time could be
	// too few frames for the hands to get there (or the play could carry him off), which made this flaky.
	F.hold = true;
	F.step(20);
	const d0 = F.drawn;
	for (let i = 0; i < 100 && F.drawn < d0 + 25; i++) { await new Promise(r => setTimeout(r, 50)); }
	F.hold = false;
	const r = G3.fig.rigOf.get(p), top = W(r.head).y + 1.4;
	const d = [ 0, 1 ].map(j => { const h = W(r.ha[j]), hd = W(r.head); return +Math.hypot(h.x - hd.x, h.y - top, h.z - hd.z).toFixed(1); });
	return { shown, named: text.includes(p.name || "") && text.length > 8, oneAtATime: second === text, kind: F.lastCommentary && F.lastCommentary.kind, d, hh: p.headHands, shz: [0,1].map(j => +r.sh[j].rotation.z.toFixed(2)), el: [0,1].map(j => +r.el[j].rotation.z.toFixed(2)), run: +(p.runAmt || 0).toFixed(2), jump: p.jump, idx: F.players.indexOf(p), n: G3.fig.n, st: F.state, kick: p.kickA, fall: p.fall, cel: p.celebA, own: F.ball.owner === p };
});
check("a near miss: one commentary line naming the shooter, and his hands go to his head", mom.shown && mom.named && mom.oneAtATime && mom.kind === "near" && mom.d.every(v => v < 4), JSON.stringify(mom));
// Shielding, jockeying and receiving: players placed by hand and posed on a spare figure at once.
const pos3 = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), out = {};
	F.state === "play" || (F.state = "play");
	const c = F.outfield(0)[3], o1 = F.outfield(1)[3], j = F.outfield(1)[1], rc = F.outfield(0)[2];
	const keep = F.players.map(q => [ q, q.x, q.y, q.vx, q.vy, q.dir, q.runAmt, q.jockW, q.shieldW ]), owner = F.ball.owner;
	const calm = q => Object.assign(q, { kickA: 0, lunge: 0, slideAI: 0, fall: 0, celebA: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0 });
	for (const q of [ c, o1, j, rc ]) { calm(q); }
	for (const q of F.players) { q.x = 40 + (F.players.indexOf(q) % 6) * 10; q.y = 40 + Math.floor(F.players.indexOf(q) / 6) * 10; q.vx = q.vy = 0; q.runAmt = 0; q.jockW = 0; q.shieldW = 0; }
	c.x = F.FW / 2; c.y = F.FH / 2; c.dir = 0; F.ball.owner = c;
	// shielding: a man at his left shoulder, a touch behind
	o1.x = c.x - 8; o1.y = c.y + 18;
	let r = F.poseProbe(c);
	const op = { x: o1.x, y: 15, z: o1.y, isVector3: true };
	out.shield = { w: +(c.shieldW || 0).toFixed(2), ext: c.shieldSide, hand: [ 0, 1 ].map(k => +Math.hypot(W(r.ha[k]).x - op.x, W(r.ha[k]).z - op.z).toFixed(1)) };
	// jockeying: 35 in front of the carrier, facing him, against the same man well away
	o1.x = 40; o1.y = 40;
	j.x = c.x + 150; j.y = c.y; j.dir = Math.PI; j.jockW = 0;
	const hip0 = W(F.poseProbe(j).hips).y;
	j.x = c.x + 35; j.jockW = 0;
	r = F.poseProbe(j);
	out.jockey = { w: +(j.jockW || 0).toFixed(2), drop: +(hip0 - W(r.hips).y).toFixed(2) };
	// receiving a ground pass: the receiving foot comes up, against the same man without it
	F.ball.owner = rc; rc.recv = 0; rc.recvK = null;
	const f = rc.build && rc.build.left ? 0 : 1;
	r = F.poseProbe(rc, 1); const a0 = W(r.an[f]).y;
	rc.recv = 1; rc.gotAt = F.frame - 9;
	r = F.poseProbe(rc, 1);
	out.recv = { lift: +(W(r.an[f]).y - a0).toFixed(2) };
	rc.recv = 0;
	for (const [ q, x, y, vx, vy, d, ra, jw, sw ] of keep) { Object.assign(q, { x, y, vx, vy, dir: d, runAmt: ra, jockW: jw, shieldW: sw }); }
	F.ball.owner = owner;
	return out;
});
check("shielding: low, and the arm nearest the challenger goes out to hold him off", pos3.shield && pos3.shield.w > 0.6 && Math.min(...pos3.shield.hand) === pos3.shield.hand[pos3.shield.ext], JSON.stringify({ s: pos3.shield, pd: pos3.pd }));
check("jockeying: the defender sinks into a crouch facing the carrier", pos3.jockey && pos3.jockey.w > 0.6 && pos3.jockey.drop > 0.6, JSON.stringify(pos3.jockey));
check("receiving a pass along the ground: the receiving foot comes up to meet it", pos3.recv && pos3.recv.lift > 0.5, JSON.stringify(pos3.recv));
check("home ends dressed: banners and big flags that wave", dress.banners >= 1 && dress.flags >= 3 && dress.waves, JSON.stringify(dress));
// The woodwork: a ball just wide of a post or just over the bar comes back off the frame (and only those).
const wood = await page.evaluate(() => {
	const F = window.__ff, out = {}, B = F.ball, FW = F.FW, FH = F.FH, T = F.GOAL_T, Bt = F.GOAL_B;
	for (const id of [ "lowerThird", "commLine" ]) { const e = document.getElementById(id); if (e) { e.hidden = true; } }
	for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }   // a live ball to start from (not a restart being taken)
	F.freeze = 0;
	for (const g of F.players.filter(q => q.role === "gk")) { g.y = 20; g.vx = g.vy = 0; }
	const sh = F.outfield(0)[F.outfield(0).length - 1];
	const fire = (y, z, vx, vy = 0, vz = 0) => {
		F.commReset(); for (const id of [ "lowerThird", "commLine" ]) { document.getElementById(id).hidden = true; }
		sh.headHands = 0; B.owner = null; B.woodAt = -999; B.x = FW - 1.3 * vx; B.y = y - vy * 1.3; B.z = z; B.vx = vx; B.vy = vy; B.vz = vz; B.curlT = 0; B.dipG = 0;
		B.lastBy = sh; B.shot = true; B.kickedAt = F.frame; B.indirect = null; B.pen = null;
		const s0 = F.score.slice();
		for (let i = 0; i < 8 && F.state === "play" && !F.setPiece; i++) { F.stepBallTest(); if (B.woodAt > -999) { break; } }
		return { wood: B.wood && B.woodAt > -999 ? B.wood : null, vx: +B.vx.toFixed(2), x: +B.x.toFixed(1), z: +(B.z || 0).toFixed(1), state: F.state, sp: F.setPieceKind, goal: F.score[0] > s0[0], kind: F.lastCommentary && F.lastCommentary.kind, hh: sh.headHands };
	};
	out.post = fire(T - 1, 4, 12, 0.6);
	B.wood = null; out.inPost = fire(T + 2.5, 4, 13);
	B.wood = null; out.bar = fire(FH / 2 + 10, 57.5, 12, 0, 0.2);
	B.wood = null; out.fast = fire(Bt + 3, 2, 18, -0.5);
	B.wood = null; out.wide = fire(T - 40, 2, 12);
	// The pure check: nothing that crosses the line inside the mouth, under the bar, ever counts as woodwork.
	let bad = 0;
	for (let y = T + 4.01; y < Bt - 4; y += 3) { for (let z = 0; z <= 55; z += 5) { for (const vy of [ -3, 0, 3 ]) { if (F.woodworkHit(false, FW + 6, y + vy * 0.5, z, 12, vy, 0) || F.woodworkHit(true, -6, y + vy * 0.5, z, -12, vy, 0)) { bad++; } } } }
	out.bad = bad;
	return out;
});
check("woodwork: a shot just wide hits the post, comes back into play, commentary and hands on head", wood.post.wood === "post" && wood.post.vx < 0 && wood.post.state === "play" && !wood.post.sp && wood.post.kind === "woodwork" && wood.post.hh > 0, JSON.stringify(wood.post));
check("woodwork: inside edge of the post (already going out) and a frame-skipping 18/frame shot rebound too", wood.inPost.wood === "post" && wood.inPost.vx < 0 && wood.fast.wood === "post" && wood.fast.vx < 0 && wood.fast.state === "play", JSON.stringify({ i: wood.inPost, f: wood.fast }));
check("woodwork: just over the bar drops down and back out, 'bar' commentary", wood.bar.wood === "bar" && wood.bar.vx < 0 && wood.bar.z <= 55 && wood.bar.state === "play" && wood.bar.kind === "bar", JSON.stringify(wood.bar));
check("woodwork: a ball well wide is just out (goal kick or corner), and no ball going in is ever counted as woodwork", wood.wide.wood === null && (wood.wide.sp === "goalkick" || wood.wide.sp === "corner") && wood.bad === 0, JSON.stringify({ w: wood.wide, bad: wood.bad }));
const woodGoal = await page.evaluate(() => {
	const F = window.__ff, B = F.ball, FW = F.FW;
	if (F.setPiece) { F.step(400); }
	F.freeze = 0; const sh = F.outfield(0)[F.outfield(0).length - 1], s0 = F.score[0];
	for (const g of F.players.filter(q => q.role === "gk")) { g.y = 20; g.vx = g.vy = 0; }
	B.owner = null; B.woodAt = -999; B.wood = null; B.x = FW - 36; B.y = F.GOAL_T + 5; B.z = 3; B.vx = 12; B.vy = 0; B.vz = 0; B.lastBy = sh; B.shot = true; B.kickedAt = F.frame; B.indirect = null;
	for (let i = 0; i < 8 && F.state === "play"; i++) { F.stepBallTest(); }
	return { st: F.state, goal: F.score[0] - s0, wood: B.wood, sp: F.setPieceKind };
});
check("woodwork: a shot just inside the post goes in (never deflected)", woodGoal.st === "goal" && woodGoal.goal === 1 && !woodGoal.wood, JSON.stringify(woodGoal));
await page.evaluate(() => { const F = window.__ff; for (let i = 0; i < 1500 && F.state === "goal"; i++) { F.step(1); } });
// Celebrations that fit the moment: the plan from the minute and the score, then played out.
const plan = await page.evaluate(() => {
	const F = window.__ff, P = c => F.celebPlan(c, () => 0.3);
	return { win: P({ minute: 86, diff: 0, goals: 1 }), eq: P({ minute: 90, diff: -1, goals: 1 }), cons: P({ minute: 40, diff: -3, goals: 1 }), opener: P({ minute: 12, diff: 0, goals: 1, first: true }), hat: P({ minute: 60, diff: 1, goals: 3 }), comfy: P({ minute: 85, diff: 2, goals: 1 }), ownLate: P({ minute: 85, diff: 0, goals: 1, own: true }) };
});
check("celebration plan: a late winner or equaliser is wild, a 3-0 consolation muted, an opener standard, a hat-trick special", plan.win.mood === "wild" && plan.win.comm === "lateWin" && plan.eq.mood === "wild" && plan.eq.comm === "lateEq" && plan.cons.mood === "muted" && plan.opener.mood === "opener" && plan.hat.mood === "special" && plan.hat.style === 5 && plan.comfy.mood === "standard" && plan.comfy.sulk === "normal" && plan.ownLate.mood === "wild", JSON.stringify(plan));
const goalAt = (sc, frac) => page.evaluate(async ([ sc, frac ]) => {
	const F = window.__ff;
	for (let i = 0; i < 1500 && F.state !== "play"; i++) { F.step(1); }
	if (F.setPiece) { F.step(400); }
	F.score[0] = sc[0]; F.score[1] = sc[1]; F.timeLeft = F.matchLen * frac; F.freeze = 0;
	F.forceGoal(0);
	for (let i = 0; i < 20 && F.state === "play"; i++) { F.step(1); }
	const C = F.celeb, hero = C && C.hero, out = { st: F.state, mood: C && C.mood, style: C && C.style };
	if (!C) { return out; }
	const hide = () => { for (const id of [ "lowerThird" ]) { document.getElementById(id).hidden = true; } };
	const c0 = Math.hypot(hero.x - F.FW / 2, hero.y - F.FH / 2);
	let maxHug = 0, maxCel = 0, slump = 0, hh = 0, grabbed = false, comm = null;
	F.commReset(); const at0 = F.lastCommentary ? F.lastCommentary.at : -1, fresh = () => F.lastCommentary && F.lastCommentary.at !== at0 && /^late/.test(F.lastCommentary.kind);
	for (let i = 0; i < 260 && F.state === "goal"; i++) {
		F.step(1); hide();
		for (const p of F.players) { if (p.team === 0 && p !== hero) { maxHug = Math.max(maxHug, p.hug || 0); } if (p.team === 0) { maxCel = Math.max(maxCel, p.celebA || 0); } if (p.team === 1) { slump = Math.max(slump, p.kneel || 0); if (p.headHands > 0) { hh++; } } }
		if (F.ball.owner === hero) { grabbed = true; }
		if (!comm && fresh()) { comm = F.lastCommentary; }
	}
	for (let i = 0; i < 900 && F.state === "goal" && !comm; i++) { F.step(1); hide(); if (fresh()) { comm = F.lastCommentary; } }
	Object.assign(out, { maxHug: +maxHug.toFixed(2), maxCel: +maxCel.toFixed(2), slump: +slump.toFixed(2), hh, grabbed, toCentre: +(c0 - Math.hypot(hero.x - F.FW / 2, hero.y - F.FH / 2)).toFixed(0), comm: comm && comm.kind, text: comm && comm.text, cap: F.lastCaption && F.lastCaption.sub });
	for (let i = 0; i < 1500 && F.state === "goal"; i++) { F.step(1); }
	return out;
}, [ sc, frac ]);
const lateWin = await goalAt([ 1, 1 ], 0.06);
check("a late winner: a wild celebration, the losing side slumps, and the commentator calls the drama", lateWin.mood === "wild" && [ 1, 2, 6 ].includes(lateWin.style) && lateWin.maxCel > 0.5 && lateWin.slump > 0.5 && lateWin.hh > 0 && lateWin.comm === "lateWin" && /Late winner/.test(lateWin.cap || ""), JSON.stringify(lateWin));
const cons = await goalAt([ 0, 3 ], 0.5);
check("a 3-0 consolation: muted, he grabs the ball and runs it back to the centre, nobody celebrates", cons.mood === "muted" && cons.grabbed && cons.toCentre > 40 && cons.maxCel < 0.15 && cons.maxHug < 0.05 && !cons.comm, JSON.stringify(cons));
const sky = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), p = F.outfield(0)[2];
	const keep = { celebA: p.celebA, celebK: p.celebK, kneel: p.kneel, hug: p.hug };
	Object.assign(p, { kickA: 0, lunge: 0, fall: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, celebA: 1, celebK: 5, kneel: 0, hug: 0, sulk: 0 });
	const r = F.poseProbe(p, 40), head = W(r.head), hands = [ 0, 1 ].map(k => W(r.ha[k]));
	const rootInv = r.root.matrixWorld.clone().invert(), loc = hands.map(h => h.clone().applyMatrix4(rootInv)), hl = head.clone().applyMatrix4(rootInv);
	Object.assign(p, keep);
	return { up: hands.map(h => +(h.y - head.y).toFixed(1)), side: loc.map(v => +v.z.toFixed(1)), fwd: loc.map(v => +(v.x - hl.x).toFixed(1)) };
});
check("brace / hat-trick pose: both hands above the head, on their own sides, not behind him", sky.up.every(v => v > 3) && sky.side[0] * sky.side[1] < 0 && sky.fwd.every(v => v > -3), JSON.stringify(sky));
// First touch: how he takes it depends on the ball's height and pace, his technique and his position.
const rk = await page.evaluate(() => {
	const F = window.__ff, K = (c, r = 0.99) => F.recvKind(Object.assign({ z: 0, spd: 8, pas: 70, seed: 0.6, play: false, back: false, space: false, human: false, wet: false }, c), () => r);
	return { chest: K({ z: 30 }), thigh: K({ z: 18 }), low: K({ z: 6 }), sole: K({ spd: 4, seed: 0.2 }), hard: K({ spd: 10, seed: 0.2 }), inside: K({ spd: 5, seed: 0.8 }), turn: K({ back: true, space: true }), turnYou: K({ back: true, space: true, human: true }), turnTight: K({ back: true }), heavy: K({ pas: 40 }, 0.05), neat: K({ pas: 90, spd: 5 }, 0.05) };
});
check("first touch: chest high, thigh mid-height, sole or inside of the foot along the ground, a turn with space behind, a heavy touch for poor technique", rk.chest === "chest" && rk.thigh === "thigh" && rk.low !== "thigh" && rk.sole === "sole" && rk.hard === "inside" && rk.inside === "inside" && rk.turn === "turn" && rk.turnYou !== "turn" && rk.turnTight !== "turn" && rk.heavy === "heavy" && rk.neat !== "heavy", JSON.stringify(rk));
const ft = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), out = {};
	for (let i = 0; i < 1500 && F.state !== "play"; i++) { F.step(1); }
	const rc = F.outfield(0)[2], f = rc.build && rc.build.left ? 0 : 1, owner = F.ball.owner;
	const keep = [ rc.x, rc.y, rc.dir, rc.vx, rc.vy, rc.runAmt ];
	Object.assign(rc, { kickA: 0, lunge: 0, slideAI: 0, fall: 0, celebA: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, jockW: 0, shieldW: 0, vx: 0, vy: 0, runAmt: 0, sulk: 0, kneel: 0, hug: 0 });
	rc.x = F.FW / 2; rc.y = F.FH / 2; rc.dir = 0;
	for (const q of F.players) { if (q !== rc) { q.x = 40 + (F.players.indexOf(q) % 6) * 10; q.y = 40 + Math.floor(F.players.indexOf(q) / 6) * 10; q.vx = q.vy = 0; } }
	F.ball.owner = rc;
	const pose = (k, at) => { rc.recv = k ? 1 : 0; rc.recvK = k; rc.gotAt = F.frame - at; const r = F.poseProbe(rc, 1), inv = r.root.matrixWorld.clone().invert(), L = n => W(n).applyMatrix4(inv);
		const toe = r.an[f].position.clone().set(4, 0, 0); r.an[f].localToWorld(toe); toe.applyMatrix4(inv);
		return { kn: L(r.kn[f]), an: L(r.an[f]), kn2: L(r.kn[1 - f]), an2: L(r.an[1 - f]), hip: L(r.hip[f]), hips: L(r.hips), head: L(r.head), toe, chestY: r.chest.rotation.y, hipsY: r.hips.rotation.y }; };
	rc.idlePh = 0; rc.stride = 0;
	const base = pose(null, 99), th = pose("thigh", 11), ch = pose("chest", 11), so = pose("sole", 9), ins = pose("inside", 9), hv = pose("heavy", 9);
	rc.turnTo = Math.PI * 0.9; const tu = pose("turn", 9);
	out.thigh = +(th.kn.y - th.kn2.y).toFixed(2);
	out.chest = +((ch.head.x - ch.hips.x) - (base.head.x - base.hips.x)).toFixed(2);
	out.sole = { up: +(so.an.y - Math.min(base.an.y, base.an2.y, so.an2.y)).toFixed(2), fwd: +(so.an.x - base.an.x).toFixed(2), toeUp: +(so.toe.y - so.an.y).toFixed(2) };
	out.inside = { side: Math.sign(ins.hip.z), toeOut: +((ins.toe.z - ins.an.z) - (base.toe.z - base.an.z)).toFixed(2) };
	out.heavy = +(hv.an.x - base.an.x).toFixed(2); out.heavyLean = +((hv.head.x - hv.hips.x) - (base.head.x - base.hips.x)).toFixed(2);
	out.turn = +Math.abs(tu.hipsY - base.hipsY).toFixed(2);
	// a heavy touch in play: the ball runs further from him for a moment
	rc.recvK = null; rc.recv = 0;
	const team = F.outfield(0), mate = team.find(q => q !== rc);
	const R = Math.random; Math.random = () => 0.001;
	let far = 0;
	try {
		F.freeze = 0; F.ball.owner = null; F.ball.x = rc.x + 10; F.ball.y = rc.y; F.ball.z = 0; F.ball.vx = -6; F.ball.vy = 0; F.ball.vz = 0; F.ball.lastBy = mate; F.ball.kickedAt = F.frame - 30; F.ball.shot = false;
		if (rc.attr) { rc.attr.pas = 35; }
		F.gainBallTest(rc);
	} finally { Math.random = R; }
	out.heavyK = rc.recvK;
	for (let i = 0; i < 6; i++) { F.step(1); far = Math.max(far, Math.hypot(F.ball.x - rc.x, F.ball.y - rc.y)); }
	out.heavyFar = +far.toFixed(1);
	[ rc.x, rc.y, rc.dir, rc.vx, rc.vy, rc.runAmt ] = keep; rc.recvK = null; rc.recv = 0;
	return out;
});
check("first-touch poses (forward = toe = +x): thigh up, chest leans back, heavy lunges forward, sole forward and toes up, inside of the foot turned out, a turn opens the hips", ft.thigh > 3 && ft.chest < -0.8 && ft.sole.up > 1 && ft.sole.fwd > 1 && ft.sole.toeUp > 0.5 && ft.inside.toeOut * ft.inside.side > 0.8 && ft.heavy > 1 && ft.heavyLean > 0.5 && ft.turn > 0.2, JSON.stringify(ft));
check("a heavy first touch: the ball runs a step away from him", ft.heavyK === "heavy" && ft.heavyFar > 27, JSON.stringify({ k: ft.heavyK, far: ft.heavyFar }));
const sulk = await page.evaluate(() => {
	const F = window.__ff, p = F.outfield(0)[2], W = n => n.getWorldPosition(n.position.clone());
	const keep = [ p.sulk, p.recvK, p.recv ];
	Object.assign(p, { kickA: 0, lunge: 0, fall: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, celebA: 0, kneel: 0, hug: 0, recv: 0, recvK: null });
	const m = s => { p.sulk = s; const r = F.poseProbe(p, 1), inv = r.root.matrixWorld.clone().invert(), L = n => W(n).applyMatrix4(inv); const face = r.head.position.clone().set(2.1, 1.9, 0); r.head.localToWorld(face); face.applyMatrix4(inv); const hd = L(r.head), hp = L(r.hips); return { headFwd: hd.x - hp.x, faceUp: face.y - hd.y }; };
	const a = m(0), b = m(1); [ p.sulk, p.recvK, p.recv ] = keep;
	return { fwd: +(b.headFwd - a.headFwd).toFixed(2), faceUp: +(b.faceUp - a.faceUp).toFixed(2) };
});
check("beaten (sulk): head bowed forward and the face toward the grass, not the sky", sulk.fwd > 1 && sulk.faceUp < -0.5, JSON.stringify(sulk));
// Spine and neck signs, measured: forward is +x (toe, nose); -z on the spine leans him forward, +z on the
// neck tips the head back. Each pose that leans or looks somewhere is checked for the right way round.
const lean = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone());
	for (let i = 0; i < 1500 && F.state !== "play"; i++) { F.step(1); }
	const p = F.outfield(0)[2], gk = F.players.find(q => q.role === "gk" && q.team === 1), c = F.outfield(1)[3];
	const keepAll = F.players.map(q => [ q, q.x, q.y, q.vx, q.vy, q.dir, q.runAmt, q.sta ]), owner = F.ball.owner, fz = F.freeze;
	const calm = q => Object.assign(q, { kickA: 0, lunge: 0, slideAI: 0, fall: 0, celebA: 0, celebK: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, kneel: 0, hug: 0, sulk: 0, plant: 0, recv: 0, recvK: null, vx: 0, vy: 0, runAmt: 0, sprintAmt: 0, jockW: 0, shieldW: 0, sta: 1, shuf: 0 });
	const M = (q, n = 1, bn = 0) => { const r = F.poseProbe(q, n, bn), inv = r.root.matrixWorld.clone().invert(), L = v => v.applyMatrix4(inv); const hp = L(W(r.hips)), nk = L(W(r.neck)), hd = L(W(r.head)); const face = r.head.position.clone().set(2.1, 1.9, 0); r.head.localToWorld(face); L(face);
		return { lean: +(Math.atan2(nk.x - hp.x, nk.y - hp.y) * 57.3).toFixed(1), up: +(Math.atan2(face.y - hd.y - 1.63, face.x - hd.x) * 57.3).toFixed(1), hy: +hd.y.toFixed(1), hx: +(hd.x - hp.x).toFixed(1) }; };
	for (const q of F.players) { q.x = 40 + (F.players.indexOf(q) % 6) * 10; q.y = 40 + Math.floor(F.players.indexOf(q) / 6) * 10; q.vx = q.vy = 0; }
	const out = {};
	F.ball.owner = null;
	calm(p); p.x = F.FW / 2; p.y = F.FH / 2; p.dir = 0; out.stand = M(p);
	calm(p); p.runAmt = 1; p.vx = 2.6; p.stride = 1; out.run = M(p);
	calm(p); p.runAmt = 1; p.vx = 3.4; p.sprintAmt = 1; p.stride = 1; out.sprint = M(p);
	calm(p); p.plant = 10; out.plant = M(p);
	calm(p); p.sta = 0.2; F.freeze = 30; out.tired = M(p); F.freeze = fz;
	calm(p); p.celebA = 1; p.kneel = 1; out.kneel = M(p);
	calm(p); p.headHands = 60; out.near = M(p);
	calm(p); p.celebA = 1; p.hug = 1; out.hug = M(p);
	// a header, timed from the ball: in the air with the head cocked six frames before it arrives, snapped through it just after
	{ const B = F.ball, keepB = [ B.x, B.y, B.z, B.vx, B.vy, B.vz, B.lastBy ]; calm(p); B.owner = null; B.lastBy = c; B.vy = 0; B.vx = 4; B.y = p.y;
		B.x = p.x - 24; B.vz = 0; B.z = 51.3; out.hdEarly = M(p); B.x = p.x + 4; B.vz = -2; B.z = 43.2; out.hdSnap = M(p); [ B.x, B.y, B.z, B.vx, B.vy, B.vz, B.lastBy ] = keepB; }
	calm(p); c.x = p.x + 35; c.y = p.y; c.dir = Math.PI; calm(c); F.ball.owner = c; out.jockey = M(p, 30);
	calm(p); calm(c); F.ball.owner = p; c.x = p.x - 8; c.y = p.y + 18; out.shield = M(p, 30);
	calm(p); p.recv = 1; p.recvK = "chest"; p.gotAt = F.frame - 11; out.chest = M(p); p.recv = 0; p.recvK = null;
	F.ball.owner = null; calm(gk); gk.x = 30; gk.y = F.FH / 2; gk.dir = 0; out.gkStand = M(gk); out.gkSet = M(gk, 1, 1);
	for (const [ q, x, y, vx, vy, d, ra, st ] of keepAll) { Object.assign(q, { x, y, vx, vy, dir: d, runAmt: ra, sta: st }); calm(q); q.sta = st; }
	F.ball.owner = owner;
	return out;
});
const L = lean;
check("rig signs: running leans forward, a sprint further, eyes still up the pitch (not at the sky or the grass)", L.run.lean > 8 && L.sprint.lean > L.run.lean + 3 && L.sprint.up > -15 && L.sprint.up < 10, JSON.stringify({ s: L.stand, r: L.run, sp: L.sprint }));
check("rig signs: tired at a stoppage he bends over (head lower and forward); planting he sits back", L.tired.lean > L.stand.lean + 15 && L.tired.hy < L.stand.hy - 1 && L.plant.lean < L.stand.lean - 6, JSON.stringify({ t: L.tired, p: L.plant }));
check("rig signs: knee slide arches back, a near miss looks up at the sky, a hug leans in", L.kneel.lean < -10 && L.near.up > L.stand.up + 8 && L.hug.lean > L.stand.lean + 8, JSON.stringify({ k: L.kneel, n: L.near, h: L.hug }));
check("rig signs: jockeying and shielding lean in; chest control leans back; a header snaps forward; the keeper's set leans forward", L.jockey.lean > L.stand.lean + 3 && L.shield.lean > L.stand.lean + 2 && L.chest.lean < L.stand.lean - 5 && L.hdSnap.lean > L.hdEarly.lean + 8 && L.gkSet.lean > L.gkStand.lean + 8, JSON.stringify({ j: L.jockey, s: L.shield, c: L.chest, he: L.hdEarly, hs: L.hdSnap, g0: L.gkStand, g1: L.gkSet }));
const shirt = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), p = F.outfield(0)[2];
	const keep = { celebA: p.celebA, celebK: p.celebK, kneel: p.kneel, hug: p.hug };
	Object.assign(p, { kickA: 0, lunge: 0, fall: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, celebA: 1, celebK: 6, kneel: 0, hug: 0, sulk: 0, recv: 0, recvK: null });
	const r = F.poseProbe(p, 30), inv = r.root.matrixWorld.clone().invert(), L = n => W(n).applyMatrix4(inv), hd = L(r.head), ch = L(r.chest);
	const out = { flag: !!r.shirtHead, up: [ 0, 1 ].map(k => +(L(r.ha[k]).y - hd.y).toFixed(1)), side: [ 0, 1 ].map(k => +(L(r.ha[k]).z - hd.z).toFixed(1)), fwd: [ 0, 1 ].map(k => +(L(r.ha[k]).x - ch.x).toFixed(1)), elbowOut: [ 0, 1 ].map(k => +(Math.abs(L(r.el[k]).z) - Math.abs(L(r.sh[k]).z)).toFixed(1)), elbowUp: [ 0, 1 ].map(k => +(L(r.el[k]).y - L(r.sh[k]).y).toFixed(1)) };
	Object.assign(p, keep);
	return out;
});
check("shirt over the head: hands up at the crown on their own sides, elbows high and wide, not behind him; the head drawn in the shirt", shirt.flag && shirt.up.every(v => v > 0) && shirt.side[0] * shirt.side[1] < 0 && shirt.side.every(v => Math.abs(v) < 6) && shirt.fwd.every(v => v > -3) && shirt.elbowOut.every(v => v > 1) && shirt.elbowUp.every(v => v > 1), JSON.stringify(shirt));
const bench = await page.evaluate(async () => {
	const F = window.__ff;
	for (let i = 0; i < 1500 && F.state !== "play"; i++) { F.step(1); }
	F.staffReact("goal", { team: 0, wild: true, mgr: 0 });
	const set = !!F.staff3[0].runOn;
	await new Promise(r => setTimeout(r, 1800));
	const b = F.staff3[0].bench, onPitch = b.filter(q => q.y < F.FH).length, up = Math.max(...b.map(q => q.celebA || 0)), ran = Math.max(...b.map(q => Math.abs(q.vx || 0)));
	return { set, onPitch, up: +up.toFixed(2), ran: +ran.toFixed(2) };
});
check("a late winner: the bench runs on to the touchline, arms up", bench.set && bench.onPitch >= 3 && bench.up > 0.5, JSON.stringify(bench));
// The touchline staff: each gesture measured on the rig (hx: hand ahead of the chest, hy: above the head
// centre, hout: beyond his own shoulder, hd: hands apart, lean: forward is positive).
const staff = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone());
	const M = r => { const inv = r.root.matrixWorld.clone().invert(), L = n => W(n).applyMatrix4(inv), hp = L(r.hips), nk = L(r.neck), hd = L(r.head), ch = L(r.chest);
		const arm = k => { const sg = Math.sign(L(r.sh[k]).z) || 1, h = L(r.ha[k]), sh = L(r.sh[k]); return { hx: +(h.x - ch.x).toFixed(1), hy: +(h.y - hd.y).toFixed(1), hout: +(h.z * sg - Math.abs(sh.z)).toFixed(1) }; };
		const a = [ arm(0), arm(1) ], h0 = L(r.ha[0]), h1 = L(r.ha[1]);
		return { lean: +(Math.atan2(nk.x - hp.x, nk.y - hp.y) * 57.3).toFixed(0), a, hd: +h0.distanceTo(h1).toFixed(1) }; };
	const o = {};
	for (const g of [ "up", "head", "clap", "protest", "point", "" ]) { o[g || "idle"] = M(F.staffProbe(g, { ph: 0.3 })); }
	o.sprint = M(F.staffProbe("sprint", { ph: 0.1, run: 1, celebA: 1 })); o.knees = M(F.staffProbe("sprint", { kneel: 1, celebA: 1 }));
	o.sit = M(F.staffProbe("bench", { st: 0 })); o.stand = M(F.staffProbe("bench", { st: 1 }));
	return o;
});
const both = (g, f) => staff[g].a.every(f);
check("staff 'up': both arms up and out wide, not crossed or behind", both("up", a => a.hy > 2 && a.hout > 2 && a.hx > -2), JSON.stringify(staff.up));
check("staff 'head': hands on his head (over it, beside it, not behind)", both("head", a => a.hy > 0 && Math.abs(a.hx) < 3) && staff.head.hd < 4, JSON.stringify(staff.head));
check("staff 'clap': hands meet in front of his chest", staff.clap.hd < 2 && both("clap", a => a.hx > 4 && a.hy > -8), JSON.stringify(staff.clap));
check("staff 'protest': arms out in front of him, palms up", both("protest", a => a.hx > 4 && a.hout > 1), JSON.stringify(staff.protest));
check("staff 'point': the arm points out ahead of him", staff.point.a[1].hx > 9 && Math.abs(staff.point.a[1].hy) < 8, JSON.stringify(staff.point));
check("staff idle: hands behind his back, together", both("idle", a => a.hx < -1) && staff.idle.hd < 3, JSON.stringify(staff.idle));
check("staff sprint: fists pumping in front, leaning into the run; on his knees arms up and out, arched back", both("sprint", a => a.hx > 4) && staff.sprint.lean > 5 && both("knees", a => a.hy > 2 && a.hout > 2) && staff.knees.lean < -5, JSON.stringify({ s: staff.sprint, k: staff.knees }));
check("bench: sitting leans forward, hands on his thighs; standing, arms up and out", staff.sit.lean > 5 && both("sit", a => a.hx > 3) && both("stand", a => a.hy > 2 && a.hout > 2), JSON.stringify({ s: staff.sit, u: staff.stand }));
// Faces: a modelled head (a chin below and ahead of the ear line, a skull longer than it is wide), the
// hair on the skull's own surface, and only the dark painted marks left at the gantry camera's distance.
const face = await page.evaluate(() => {
	const F = window.__ff, G3 = F.G3, I = F.headInfo(), hp = G3.fig.parts.head.geometry.attributes.position, hr = G3.fig.parts.hair.geometry.attributes.position;
	let chin = null, xmin = 1e9, xmax = -1e9, zmax = 0, ymax = -1e9;
	for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); zmax = Math.max(zmax, Math.abs(z)); ymax = Math.max(ymax, y); if (Math.abs(z) < 0.3 && y < I.ear[1] - 1.5 && (!chin || x > chin[0])) { chin = [ x, y ]; } }   // the chin: the most forward point of the face well below the ear
	let same = 0; for (let i = 0; i < hp.count; i++) { if (Math.abs(hp.getX(i) - hr.getX(i)) + Math.abs(hp.getY(i) - hr.getY(i)) + Math.abs(hp.getZ(i) - hr.getZ(i)) < 1e-4) { same++; } }
	const c = G3.cam.position, d = F.players.map(p => { const r = G3.fig.rigOf.get(p); return r ? r.head.getWorldPosition(r.head.position.clone()).distanceTo(c) : 1e9; });
	return { chinBelowEar: +(I.ear[1] - chin[1]).toFixed(2), chinAheadOfEar: +(chin[0] - I.ear[0]).toFixed(2), len: +((xmax - xmin) / 2).toFixed(2), wid: +zmax.toFixed(2), hairOnSkull: same === hp.count, shortHair: I.styles.short[0], fade: I.fade, pale: I.pale, camNear: Math.round(Math.min(...d)), cam: G3.camKind || null };
});
check("faces: a jaw and chin below and ahead of the ear line, a skull longer than wide (not a ball)", face.chinBelowEar > 1.5 && face.chinAheadOfEar > 1.5 && face.wid < face.len * 0.92, JSON.stringify(face));
check("faces: the hair sits on the skull's own surface (short hair a few tenths thick, no helmet)", face.hairOnSkull && face.shortHair <= 0.3, JSON.stringify(face));
check("faces: the pale marks (whites of the eyes) are gone well before the default camera; brows, eyes and mouth still read there", face.pale[1] * 2 < face.camNear && face.fade[2] > face.camNear, JSON.stringify(face));
const mates = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), p = F.outfield(0)[2], keep = { celebA: p.celebA, hug: p.hug };
	Object.assign(p, { kickA: 0, lunge: 0, fall: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, celebK: 0, kneel: 0, hug: 0, sulk: 0, recv: 0, recvK: null, celebA: 0.7 });
	const r = F.poseProbe(p, 1), inv = r.root.matrixWorld.clone().invert(), L = n => W(n).applyMatrix4(inv);
	const out = [ 0, 1 ].map(k => +(L(r.ha[k]).y - L(r.sh[k]).y).toFixed(1));
	Object.assign(p, keep);
	return { handAboveShoulder: out };
});
check("goal huddle: team-mates' arms are up (hands above the shoulders), not stuck out level", mates.handAboveShoulder.every(v => v > 4), JSON.stringify(mates));
// Raised arms, measured (past horizontal the sideways sign reverses): each pose's hands where they belong.
const raised = await page.evaluate(() => {
	const F = window.__ff, W = n => n.getWorldPosition(n.position.clone()), p = F.outfield(0)[2], keep = { celebA: p.celebA, celebK: p.celebK, throwA: p.throwA };
	const calm = () => Object.assign(p, { kickA: 0, lunge: 0, slideAI: 0, fall: 0, celebA: 0, celebK: 0, jump: 0, throwA: 0, dive: 0, headHands: 0, fistPump: 0, kneel: 0, hug: 0, sulk: 0, plant: 0, recv: 0, recvK: null, vx: 0, vy: 0, runAmt: 0 });
	const M = r => { const inv = r.root.matrixWorld.clone().invert(), L = n => W(n).applyMatrix4(inv), hd = L(r.head), ch = L(r.chest);
		const arm = k => { const sg = Math.sign(L(r.sh[k]).z) || 1, h = L(r.ha[k]), sh = L(r.sh[k]); return { hx: +(h.x - ch.x).toFixed(1), hy: +(h.y - hd.y).toFixed(1), hout: +(h.z * sg - Math.abs(sh.z)).toFixed(1) }; };
		return { a: [ arm(0), arm(1) ], hd: +L(r.ha[0]).distanceTo(L(r.ha[1])).toFixed(1) }; };
	const o = {}, owner = F.ball.owner; F.ball.owner = null;
	calm(); p.celebA = 1; p.celebK = 5; o.sky = M(F.poseProbe(p, 30));
	calm(); p.celebA = 1; o.up = M(F.poseProbe(p, 30));
	calm(); p.celebA = 1; p.celebK = 3; p.idlePh = 0.2; o.fist = M(F.poseProbe(p, 30));
	calm(); p.celebA = 1; p.celebK = 4; o.badge = M(F.poseProbe(p, 30));
	calm(); p.throwA = 15; o.throwBack = M(F.poseProbe(p, 1)); p.throwA = 4; o.throwFwd = M(F.poseProbe(p, 1));
	calm(); Object.assign(p, keep); F.ball.owner = owner;
	o.blank = F.faceCell({ face: 3 }, { shirtHead: true, cel: 1 }); o.open = F.faceCell({ face: 3 }, { shirtHead: false, cel: 1 });
	return o;
});
const R2 = raised, all2 = (k, f) => R2[k].a.every(f);
check("arms to the sky: both hands above the head and outside the shoulders", all2("sky", a => a.hy > 4 && a.hout > 1), JSON.stringify(R2.sky));
check("celebrating: arms up and out, not behind him", all2("up", a => a.hy > 2 && a.hout > 3 && a.hx > -2), JSON.stringify(R2.up));
check("fist pump: the fist up in front of him, the other arm in front", R2.fist.a[1].hx > 2 && R2.fist.a[1].hy > -5 && R2.fist.a[0].hx > 2, JSON.stringify(R2.fist));
check("badge kiss: one hand at his mouth in front, the other arm up pointing forward", R2.badge.a[0].hx > 2 && R2.badge.a[0].hy > -6 && Math.abs(R2.badge.a[0].hout) < 3 && R2.badge.a[1].hx > 3 && R2.badge.a[1].hy > 1, JSON.stringify(R2.badge));
check("throw-in: the ball behind his head with the hands together, then out in front", all2("throwBack", a => a.hy > 2 && a.hx < 0) && all2("throwFwd", a => a.hx > 5) && R2.throwBack.hd < 9, JSON.stringify({ b: R2.throwBack, f: R2.throwFwd }));
check("shirt over the head: no face painted on it", R2.blank === -1 && R2.open === 19, JSON.stringify({ b: R2.blank, o: R2.open }));
// The stretcher in 3D: two medics carry it (real figures, not the flat 2D marks), hands at the handles.
const st3 = await page.evaluate(async () => {
	const F = window.__ff; F.freeze = 0; F.timeLeft = 1e9; F.autoPilot = true;
	if (F.state !== "play") { return { skip: F.state }; }
	F.injureTest(0, true);
	const s = [], wait = ms => new Promise(r => setTimeout(r, ms));
	for (let i = 0; i < 60 && F.stretcher; i++) {
		await wait(60);
		const Fg = F.G3.fig; if (!Fg.medicRigs || !Fg.stretch || !Fg.stretch.visible) { s.push({ n: F.stretcher ? F.stretcher.n : -1, medics: 0 }); continue; }
		const P = Fg.stretch.position, V = new P.constructor(); let worst = 0;
		for (const r of Fg.medicRigs) { for (const k of [ 0, 1 ]) { r.ha[k].getWorldPosition(V); const dz = Math.abs(V.z - P.z); worst = Math.max(worst, Math.hypot(V.x - P.x - Math.sign(V.x - P.x) * 5, V.y - P.y, Math.max(0, dz - 19), Math.max(0, 14 - dz)));   /* on a pole, near its end */ } }
		let over = 0;   /* the man on it: head and feet within its length (only once he is on it, at full height) */
		const rr = P.y > 14 && F.stretcher && F.stretcher.n > 110 ? Fg.rigOf.get(F.stretcher.p) : null;
		if (rr) { for (const j of [ rr.head, rr.an[0], rr.an[1] ]) { j.getWorldPosition(V); over = Math.max(over, Math.abs(V.z - P.z) - 19); } }
		s.push({ n: F.stretcher ? F.stretcher.n : -1, medics: Fg.medicRigs.length, worst, h: P.y, shot: F.G3.shot, over, rode: !!rr });
	}
	F.autoPilot = false;
	const carried = s.filter(x => x.medics && x.h > 14);   // at full carrying height (not mid set-down)
	return { rode: s.filter(x => x.rode).length, over: Math.max(...s.map(x => x.over || 0)).toFixed(1), n: s.length, drawn: s.filter(x => x.medics === 2).length, maxCarry: Math.max(...carried.map(x => x.worst)).toFixed(1), shot: s.filter(x => x.shot === "stretcher").length, carried: carried.length };
});
check("stretcher (3D): two medics carry it with their hands at the handles, he lies within it, and the camera goes to it", !st3.skip && st3.rode > 5 && Number(st3.over) <= 0 && st3.drawn >= st3.n * 0.8 && st3.carried > 5 && Number(st3.maxCarry) < 3 && st3.shot > 5, JSON.stringify(st3));
// Replays: the ball is drawn where it was then (not in the hands of whoever holds it now), on screen and
// standing out from the grass, in both goal-replay angles and in each kind of weather, and in a replay on demand.
const rpBall = await page.evaluate(async () => {
	const F = window.__ff, G = F.G3, out = [];
	if (F.camMode !== "3d" || !G.renderer) { return { skip: true }; }
	const look = (tag) => {
		const b = G.ball, gl = G.renderer.getContext(), p = b.position.clone().project(G.cam);
		G.renderer.render(G.scene, G.cam);
		const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = Math.round((p.x + 1) / 2 * W), py = Math.round((p.y + 1) / 2 * H);
		const rad = Math.max(2, Math.round(b.scale.x * 5 / Math.tan(G.cam.fov * Math.PI / 360) / b.position.distanceTo(G.cam.position) * H / 2));
		const at = (x, y) => { const a = new Uint8Array(4); gl.readPixels(clamp(Math.round(x), 0, W - 1), clamp(Math.round(y), 0, H - 1), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
		const ringPx = [ 0, 1, 2, 3, 4, 5, 6, 7 ].map(k => at(px + Math.cos(k * 0.785) * rad * 4, py + Math.sin(k * 0.785) * rad * 4));
		const med = [ 0, 1, 2 ].map(c => ringPx.map(a => a[c]).sort((a, b) => a - b)[4]), cd = a => Math.hypot(a[0] - med[0], a[1] - med[1], a[2] - med[2]);
		let hi = 0; for (let dx = -1; dx <= 1; dx++) { for (let dy = -1; dy <= 1; dy++) { hi = Math.max(hi, cd(at(px + dx * (rad >> 1), py + dy * (rad >> 1)))); } }
		const ring = 0;   // (colour distance from the grass around it)
		// the drawn ball against the replayed one (ends may be swapped: compare across the pitch, and its depth)
		const near = Math.min(Math.abs(b.position.x - F.ball.x), Math.abs(b.position.x - (F.FW - F.ball.x))) < 30 && Math.abs(b.position.z - F.ball.y) < 30;
		out.push({ tag, on: Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95 && p.z < 1, near, vis: b.visible, pop: Math.round(hi - ring), rad });
	};
	const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
	const weathers = [ {}, { fog: true }, { snow: true }, {} ];
	for (let g = 0; g < 4; g++) {
		const w = weathers[g], keep = {}; for (const k of [ "fog", "snow" ]) { keep[k] = F.cond[k]; F.cond[k] = !!w[k]; } G.stadiumKey = "";
		for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }
		F.timeLeft = 1e9; F.autoPilot = true; F.step(240); F.autoPilot = false; F.freeze = 0;
		F.forceGoal(g % 2);
		for (let i = 0; i < 600 && !F.replayOn; i++) { F.step(1); }
		window.__ffCam3D = () => { window.__ffCam3D = null; look(`goal${g}`); };
		for (let n = 0; n < 6 && F.replayOn; n++) { await new Promise(r => setTimeout(r, 300)); window.__ffCam3D = window.__ffCam3D || (() => { window.__ffCam3D = null; look(`goal${g}${JSON.stringify(w)}`); }); }
		window.__ffCam3D = null;
		for (let i = 0; i < 3000 && (F.state !== "play" || F.setPiece || F.restartWalk); i++) { F.step(1); }
		Object.assign(F.cond, keep); G.stadiumKey = "";
	}
	return { n: out.length, bad: out.filter(o => !o.on || !o.near || !o.vis || o.pop < 60) };
});
check("replay (3D): the ball is drawn where it was in the clip, on screen and standing out, in both angles and any weather", !rpBall.skip && rpBall.n >= 12 && rpBall.bad.length === 0, JSON.stringify(rpBall));
check("no errors after the woodwork checks (and no 3D failure)", errs.length === 0 && !errs.some(e => /3D view failed/.test(e)), errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
