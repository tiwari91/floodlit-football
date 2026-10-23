// Run: node tests/ceremony.mjs   The trophy ceremony: it starts, it can be skipped, it leaves nothing behind.
// FF_SHOTS=<dir> also saves a picture of each part.
import { launch, serve, sleep, tally } from "./_env.mjs";
const server = serve(8800), URL = server.url;
process.on("exit", () => server.stop());   // never leave the server behind, even on a failure
const { check, done } = tally();
const browser = await launch();
const SHOTS = process.env.FF_SHOTS || "";
const snap = async (page, path) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.locator("#pitchwrap").screenshot({ path }); };

async function open (gfx, extra = {}) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...extra });
	const page = await ctx.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 200)); } });
	await page.addInitScript(g => { localStorage.setItem("ff-cam2", "tv"); if (g) { localStorage.setItem("ff-gfx", g); } }, gfx);
	await page.goto(URL); await page.waitForSelector("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	if (gfx) { await page.evaluate(g => window.__ff.setGfx(g), gfx); }
	await page.click("#ovButton");
	// Both halves cut short: the whistle, the half-time card, the whistle again.
	for (let half = 0; half < 3; half++) {
		await page.waitForFunction(() => [ "play", "half", "full" ].includes(window.__ff.state), null, { timeout: 60000 });
		const st = await page.evaluate(() => window.__ff.state);
		if (st === "full") { break; }
		if (st === "half") { await page.click("#ovButton"); await page.waitForFunction(() => window.__ff.state === "play", null, { timeout: 30000 }); }
		await page.evaluate(() => { window.__ff.timeLeft = 0.05; });
		await page.waitForFunction(() => window.__ff.state !== "play", null, { timeout: 60000 });
	}
	await page.waitForFunction(() => window.__ff.state === "full", null, { timeout: 30000 });
	await sleep(800);
	return { ctx, page, errs };
}
const mem = page => page.evaluate(() => { const G = window.__ff.G3, m = G.renderer.info.memory; return { geo: m.geometries, tex: m.textures, kids: G.scene.children.length }; });
const drawRate = page => page.evaluate(async () => { const F = window.__ff, d0 = F.drawn, t0 = performance.now(); await new Promise(r => setTimeout(r, 2500)); return { fps: Math.round((F.drawn - d0) / ((performance.now() - t0) / 1000)), ms: +F.drawMs.toFixed(2) }; });

{
	const { ctx, page, errs } = await open("high");
	const before = await mem(page);
	const started = await page.evaluate(() => { const F = window.__ff; F.celebrateTrophy("league trophy"); return F.ceremonyInfo(); });
	check("the ceremony starts after a title is won", started.on && started.phase === "stage" && started.team >= 5 && started.tEnd > 25 && started.tEnd < 50, JSON.stringify(started));
	const shot = async (name, t) => {
		await page.evaluate(t => window.__ff.ceremonySeek(t), t); await sleep(1100);
		const info = await page.evaluate(() => window.__ff.ceremonyInfo());
		if (SHOTS) { await snap(page, `${SHOTS}/${name}.png`); }
		return info;
	};
	const st = await shot("ceremony-1-stage", 1.4);
	check("first the stage, with the full-time card out of the way", st.phase === "stage" && await page.evaluate(() => document.getElementById("overlay").hidden), JSON.stringify(st));
	const md = await shot("ceremony-2-medals", started.tLift - 6);
	check("then the medals, one man at a time", md.phase === "medals" && md.medals > 0 && md.medals < md.team && /medal|captain/i.test(md.caption), JSON.stringify(md));
	const lf = await shot("ceremony-3-lift", started.tLift + 1.6);
	check("then the lift, every man with a medal", lf.phase === "lift" && lf.medals === lf.team && /lifts/.test(lf.caption), JSON.stringify(lf));
	const perfLift = await drawRate(page);
	await shot("ceremony-3b-sweep", started.tLift + 5);
	const pr = await shot("ceremony-4-parade", started.tParade + 2.5);
	check("then the open-top bus", pr.phase === "parade" && /parade/i.test(pr.caption), JSON.stringify(pr));
	const perfParade = await drawRate(page);
	console.log(`High: lift ${JSON.stringify(perfLift)}, parade ${JSON.stringify(perfParade)}`);
	await page.keyboard.press("Enter");
	await sleep(300);
	const after = await page.evaluate(() => { const F = window.__ff, G = F.G3; return { info: F.ceremonyInfo(), last: F.lastCeremony(), state: F.state, overlay: !document.getElementById("overlay").hidden, trophy: !document.getElementById("ovTrophy").hidden, cer: !!G.scene.getObjectByName("ceremony"), stadium: G.stadium.visible, caps: document.querySelectorAll(".cer-cap").length }; });
	check("a key skips it (and does nothing else), and the full-time card comes back with the trophy", !after.info.on && after.last.why === "skip" && after.state === "full" && after.overlay && after.trophy && after.caps === 0, JSON.stringify(after));
	await sleep(600);
	const m2 = await mem(page);
	check("nothing is left behind in the scene or on the GPU", m2.kids === before.kids && m2.geo <= before.geo && m2.tex <= before.tex && !after.cer && after.stadium, `before ${JSON.stringify(before)} after ${JSON.stringify(m2)}`);
	// A tap skips it too; and a cup won on the night joins the title in the same ceremony.
	const both = await page.evaluate(() => { const F = window.__ff; F.queueTrophy("League Cup"); F.celebrateTrophy("league trophy"); F.trophyDue(); return F.ceremonyInfo(); });
	check("a League Cup won the same night joins the ceremony", both.on && both.what.join("|") === "league trophy|League Cup", JSON.stringify(both));
	await page.mouse.click(400, 300); await sleep(300);
	const tapped = await page.evaluate(() => window.__ff.lastCeremony());
	check("a tap skips it", tapped.why === "skip", JSON.stringify(tapped));
	// It plays to the end on its own.
	await page.evaluate(() => { const F = window.__ff; F.celebrateTrophy("Continental Champions Cup"); F.ceremonySeek(F.ceremonyInfo().tEnd - 0.4); });
	await sleep(1500);
	const ended = await page.evaluate(() => ({ info: window.__ff.ceremonyInfo(), last: window.__ff.lastCeremony() }));
	check("left alone it ends by itself", !ended.info.on && ended.last.why === "done", JSON.stringify(ended));
	const m3 = await mem(page);
	check("still nothing left behind after three ceremonies", m3.kids === before.kids && m3.geo <= before.geo && m3.tex <= before.tex, `before ${JSON.stringify(before)} after ${JSON.stringify(m3)}`);
	check("no console errors (High)", errs.length === 0, errs.join(" | "));
	await ctx.close();
}
{
	const { ctx, page, errs } = await open("light");
	const s = await page.evaluate(() => { const F = window.__ff; F.celebrateTrophy("League Cup"); return F.ceremonyInfo(); });
	await sleep(500);
	await page.evaluate(t => window.__ff.ceremonySeek(t), s.tLift + 1.5); await sleep(800);
	const lift = await drawRate(page);
	if (SHOTS) { await snap(page, `${SHOTS}/ceremony-light-lift.png`); }
	await page.evaluate(t => window.__ff.ceremonySeek(t), s.tParade + 3); await sleep(800);
	const parade = await drawRate(page);
	if (SHOTS) { await snap(page, `${SHOTS}/ceremony-light-parade.png`); }
	console.log(`Light: lift ${JSON.stringify(lift)}, parade ${JSON.stringify(parade)}`);
	const light = await page.evaluate(() => window.__ff.ceremonyInfo());
	check("Light draws a simpler ceremony (fewer objects) and holds 30 frames a second", light.on && lift.fps >= 24 && parade.fps >= 24, JSON.stringify({ light, lift, parade }));
	await page.keyboard.press("Escape");
	check("no console errors (Light)", errs.length === 0, errs.join(" | "));
	await ctx.close();
}
{
	// Reduced motion: one still picture of the lift, until a key.
	const { ctx, page, errs } = await open("", { reducedMotion: "reduce" });
	const r = await page.evaluate(async () => { const F = window.__ff; F.celebrateTrophy("league trophy"); await new Promise(r => setTimeout(r, 1500)); return F.ceremonyInfo(); });
	if (SHOTS) { await snap(page, `${SHOTS}/ceremony-reduced-motion.png`); }
	check("with reduced motion it is a still of the lift", r.on && r.phase === "still" && r.medals === r.team, JSON.stringify(r));
	await page.keyboard.press("Space"); await sleep(200);
	check("and a key closes it", !(await page.evaluate(() => window.__ff.ceremonyInfo().on)));
	check("no console errors (reduced motion)", errs.length === 0, errs.join(" | "));
	await ctx.close();
}
{
	// The overhead camera keeps the card and the fireworks.
	const { ctx, page, errs } = await open("");
	const o = await page.evaluate(async () => { const F = window.__ff; F.setCam("top"); await new Promise(r => setTimeout(r, 300)); F.celebrateTrophy("league trophy"); return { info: F.ceremonyInfo(), card: !document.getElementById("ovTrophy").hidden, fw: !!F.fireworks }; });
	check("in the overhead camera the trophy card and fireworks stand in", !o.info.on && o.card && o.fw, JSON.stringify(o));
	check("no console errors (overhead)", errs.length === 0, errs.join(" | "));
	await ctx.close();
}
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
