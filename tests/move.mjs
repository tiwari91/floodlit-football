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
// 3D figures turn, they don't snap: the drawn facing never swings faster than ~16 rad/s even when the
// simulation swings p.dir round in a frame. Every player has his own running style; the ball is near true size close up.
const feel = await page.evaluate(() => new Promise(res => {
	const F = window.__ff; for (let i = 0; i < 3000 && F.state !== "play"; i++) { F.step(1); }
	F.freeze = 0;
	const prev = new Map(); let max = 0, n = 0, last = performance.now(), snaps = 0;
	const tick = () => {
		const now = performance.now(), dts = (now - last) / 1000; last = now;
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
const tired = await page.evaluate(() => new Promise(res => {
	const F = window.__ff; for (let i = 0; i < 3000 && F.state !== "play"; i++) { F.step(1); } F.freeze = 0;
	const keep = F.players.map(p => p.sta); for (const p of F.players) { p.sta = 0.3; }
	let n = 0, bent = 0;
	const tick = () => { F.players.forEach((p, i) => { const r = F.G3.fig.rigOf && F.G3.fig.rigOf.get(p); if (r && F.state === "play" && F.freeze <= 0 && r.spine.rotation.z > 0.55) { bent++; } }); if (++n < 90) { requestAnimationFrame(tick); } else { F.players.forEach((p, i) => { p.sta = keep[i]; }); res({ bent }); } };
	requestAnimationFrame(tick);
}));
check("exhausted players stay upright in open play (no bending over mid-match)", tired.bent === 0, JSON.stringify(tired));
// Through balls (W) go forward to a teammate ahead of you, preferring runners, and you take control of him.
const tb = await page.evaluate(() => {
	const F = window.__ff, out = { n: 0, ahead: 0, ctrl: 0, withAhead: 0 };
	for (let t = 0; t < 40 && out.n < 15; t++) {
		for (let i = 0; i < 4000 && F.state !== "play"; i++) { F.step(1); }
		F.freeze = 0; F.timeLeft = 1e9;
		const me = F.human();
		F.ball.owner = me; F.ball.z = 0; F.possTeam = 0; me.dir = 0;
		for (let i = 0; i < 60; i++) { F.step(1); }
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
const huddle = await page.evaluate(async () => {
	const F = window.__ff, G3 = F.G3;
	F.state === "play" || (F.state = "play"); F.freeze = 0; F.forceGoal(0);
	for (let i = 0; i < 60 && F.state !== "goal"; i++) { F.step(1); }
	let h = null;
	for (let i = 0; i < 1500 && F.state === "goal" && !h; i++) { F.step(1); h = F.players.find(p => (p.hug || 0) > 0.5) || null; }
	if (!h) { return { hug: false }; }
	await new Promise(r => setTimeout(r, 120));
	const r = G3.fig.rigOf.get(h), o = r.chest.getWorldPosition(r.chest.position.clone()), root = r.root.getWorldPosition(r.root.position.clone());
	const fwd = r.root.localToWorld(r.root.position.clone().set(1, 0, 0)).sub(root).normalize();
	return { hug: true, fwd: [ 0, 1 ].map(j => +r.ha[j].getWorldPosition(r.ha[j].position.clone()).sub(o).dot(fwd).toFixed(1)) };
});
check("in a goal huddle the hugging players' hands are in front of them", !huddle.hug || huddle.fwd.every(v => v > 2), JSON.stringify(huddle));
// Standing, the hands hang at his sides, outside the line of the shoulders, never tucked in behind the shorts.
const sides = await page.evaluate(async () => {
	const F = window.__ff, G3 = F.G3, out = [];
	for (let i = 0; i < 4000 && F.state !== "play"; i++) { F.step(1); }
	F.freeze = 0;
	for (let k = 0; k < 60 && out.length < 40; k++) {
		await new Promise(r => setTimeout(r, 40));
		F.players.forEach((p, i) => {
			const r = G3.fig && G3.fig.rigOf && G3.fig.rigOf.get(p);
			if (!r || p.role === "gk" || Math.hypot(p.vx || 0, p.vy || 0) > 0.3 || p.kickA > 0 || (p.celebA || 0) > 0 || p.headHands > 0 || p.fistPump > 0 || F.staOf(p) < 0.6 || F.ball.owner === p) { return; }
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
	await new Promise(r => setTimeout(r, 450));
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
check("a late winner: a wild celebration, the losing side slumps, and the commentator calls the drama", lateWin.mood === "wild" && (lateWin.style === 1 || lateWin.style === 2) && lateWin.maxCel > 0.5 && lateWin.slump > 0.5 && lateWin.hh > 0 && lateWin.comm === "lateWin" && /Late winner/.test(lateWin.cap || ""), JSON.stringify(lateWin));
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
	const base = pose(null, 99), th = pose("thigh", 11), ch = pose("chest", 11), so = pose("sole", 9), ins = pose("inside", 9), hv = pose("heavy", 9);
	rc.turnTo = Math.PI * 0.9; const tu = pose("turn", 9);
	out.thigh = +(th.kn.y - th.kn2.y).toFixed(2);
	out.chest = +((ch.head.x - ch.hips.x) - (base.head.x - base.hips.x)).toFixed(2);
	out.sole = { up: +(so.an.y - so.an2.y).toFixed(2), fwd: +(so.an.x - base.an.x).toFixed(2), toeUp: +(so.toe.y - so.an.y).toFixed(2) };
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
check("first-touch poses (forward = toe = +x): thigh up, chest leans back, heavy lunges forward, sole forward and toes up, inside of the foot turned out, a turn opens the hips", ft.thigh > 3 && ft.chest < -0.8 && ft.sole.up > 1.5 && ft.sole.fwd > 1 && ft.sole.toeUp > 0.5 && ft.inside.toeOut * ft.inside.side > 0.8 && ft.heavy > 1 && ft.heavyLean > 0.5 && ft.turn > 0.2, JSON.stringify(ft));
check("a heavy first touch: the ball runs a step away from him", ft.heavyK === "heavy" && ft.heavyFar > 27, JSON.stringify({ k: ft.heavyK, far: ft.heavyFar }));
check("no errors after the woodwork checks (and no 3D failure)", errs.length === 0 && !errs.some(e => /3D view failed/.test(e)), errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
