// Run: node tests/look.mjs   The TV camera in 3D, the broadcast HUD and the goal replay.
import { launch, serve, sleep, tally, OUT, devices } from "./_env.mjs";
const server = serve(8797), URL = server.url;
const { check, done } = tally();
const browser = await launch();

async function open (label, opts, init = {}) {
	const ctx = await browser.newContext(opts), page = await ctx.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	page.on("console", m => { if (m.type() === "error" && !/GL Driver/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
	await page.addInitScript(kv => { for (const [ k, v ] of Object.entries(kv)) { localStorage.setItem(k, v); } }, init);
	await page.goto(URL); await sleep(1500);
	await page.click("#ovButton"); await sleep(6500);
	return { ctx, page, errs, label };
}
// Both touchlines and the ball in the picture, the 3D canvas showing, the shot the TV one.
const framing = page => page.evaluate(() => {
	const F = window.__ff, G = F.G3, P = (x, y) => { const v = new window.THREE.Vector3(x, 0, y).project(G.cam); return [ v.x, v.y ]; };
	const bp = G.ball.position, far = P(bp.x, 0), near = P(bp.x, F.FH), b = P(bp.x, bp.z);
	const in1 = p => Math.abs(p[0]) <= 1.02 && Math.abs(p[1]) <= 1.02;
	return { cam: F.camMode, v3: F.view3D, shot: G.shot, canvas3d: !document.getElementById("pitch3d").hidden, far, near, b, farIn: in1(far), nearIn: in1(near), ballIn: in1(b), fov: G.cam.fov };
});

for (const [ label, opts ] of [
	[ "desktop", { viewport: { width: 1280, height: 720 } } ],
	[ "landscape phone", { ...devices["iPhone 13"], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } ],
	[ "portrait phone", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } ]
]) {
	const { ctx, page, errs } = await open(label, opts, { "ff-cam2": "tv" });
	for (let i = 0; i < 40 && (await page.evaluate(() => window.__ff.G3.shot)) !== "tv"; i++) { await sleep(250); }   // past any set piece's own shot
	const f = await framing(page);
	await page.screenshot({ path: `${OUT}/look-tv-${label.replace(/ /g, "-")}.png` });
	check(`${label}: the TV camera draws the 3D scene with the TV shot`, f.cam === "tv" && f.v3 && f.shot === "tv" && f.canvas3d, JSON.stringify(f));
	check(`${label}: the far touchline and the ball are in the picture${label === "portrait phone" ? "" : ", the near touchline too"}`, f.farIn && f.ballIn && (label === "portrait phone" || f.nearIn), JSON.stringify(f));
	check(`${label}: no console errors`, errs.length === 0, errs.join(" | "));
	await ctx.close();
}

// The default on a wide screen is TV; the saved choice survives a reload; C still reaches overhead and the 3D close camera.
{
	const { ctx, page, errs } = await open("desktop", { viewport: { width: 1280, height: 720 } });
	const first = await page.evaluate(() => window.__ff.camMode);
	check("a wide screen with no saved camera starts on the TV camera", first === "tv", first);
	// The pan is smooth: teleport the ball to the other end and watch the camera's speed along the line.
	const pan = await page.evaluate(async () => {
		const F = window.__ff, G = F.G3; F.freeze = 0; F.timeLeft = 1e9;
		const me = F.outfield(0)[5]; F.ball.owner = me; me.x = 200; me.y = F.FH / 2; me.vx = me.vy = 0;
		await new Promise(r => setTimeout(r, 1500));
		let last = G.cam.position.x, lastT = performance.now(), maxV = 0, maxTilt = 0, lastLook = null;
		me.x = F.FW - 200; me.y = 80;
		await new Promise(res => { const t0 = performance.now(); function f (t) { F.ball.owner = me; me.x = F.FW - 200; me.y = 80; me.vx = me.vy = 0; const dt = (t - lastT) / 1000; if (dt > 0.1) { maxV = Math.max(maxV, Math.abs(G.cam.position.x - last) / dt); last = G.cam.position.x; lastT = t; } if (t - t0 < 1500) { requestAnimationFrame(f); } else { res(); } } requestAnimationFrame(f); });
		return { maxV: Math.round(maxV), FW: F.FW, x: Math.round(G.cam.position.x), shot: G.shot };
	});
	check("the TV camera glides: never faster than about two thirds of the pitch a second", pan.shot === "tv" && pan.maxV > 50 && pan.maxV <= pan.FW * 0.7, JSON.stringify(pan));
	await page.keyboard.press("c"); await sleep(300);
	const a = await page.evaluate(() => [ window.__ff.camMode, window.__ff.G3.shot, localStorage.getItem("ff-cam2") ]);
	await page.keyboard.press("c"); await sleep(300);
	const b = await page.evaluate(() => [ window.__ff.camMode, document.getElementById("pitch3d").hidden, localStorage.getItem("ff-cam2") ]);
	check("C goes TV, 3D close, overhead, and saves each pick; overhead hides the 3D canvas", a[0] === "3d" && a[2] === "3d" && b[0] === "top" && b[1] === true && b[2] === "top", JSON.stringify({ a, b }));
	await page.keyboard.press("c"); await sleep(200);
	await page.reload(); await sleep(1500);
	const saved = await page.evaluate(() => window.__ff.camMode);
	check("the saved TV choice survives a reload", saved === "tv", saved);
	check("camera switching: no console errors", errs.length === 0, errs.join(" | "));
	await ctx.close();
}

// Light holds its 30 a second with the TV camera, in 3D, and can step its resolution down.
{
	const { ctx, page, errs } = await open("light", { viewport: { width: 1280, height: 720 } }, { "ff-cam2": "tv", "ff-gfx": "light" });
	const r = await page.evaluate(async () => {
		const F = window.__ff, d0 = F.drawn, t0 = performance.now();
		await new Promise(r => setTimeout(r, 2500));
		return { fps: (F.drawn - d0) / ((performance.now() - t0) / 1000), gfx: F.gfxLevel, v3: F.view3D, shot: F.G3.shot, dyn: F.dynTick3D && F.dyn ? F.dyn.min : null };
	});
	check("Light with the TV camera: still the 3D picture, at about 30 a second", r.gfx === "light" && r.v3 && !!r.shot && r.fps >= 26 && r.fps <= 32, JSON.stringify(r));
	const step = await page.evaluate(() => { const F = window.__ff; F.dynSet(0.8); return { s: F.dynScale, v3: F.view3D }; });
	check("Light can draw the 3D picture with fewer pixels instead of leaving 3D", step.s === 0.8 && step.v3, JSON.stringify(step));
	check("Light: no console errors", errs.length === 0, errs.join(" | "));
	await ctx.close();
}

await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
