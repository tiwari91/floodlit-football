// Run: node tests/phone.mjs   (see tests/_env.mjs for the Playwright and Chrome settings)
import { launch, serve, sleep, tally, OUT, devices } from "./_env.mjs";
const server = serve(8795), URL = server.url;
const { check, done } = tally();
const browser = await launch();

async function phone (label, viewport) {
	const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	const errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	page.on("console", m => { if (m.type() === "error" && !/GL Driver/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
	await page.goto(URL); await sleep(1500);
	const head = await page.evaluate(() => ({ title: document.title, headTitle: !!document.querySelector("head > title"), bodyTitle: !!document.querySelector("body title"), icons: document.querySelectorAll("link[rel='icon']").length, og: !!document.querySelector("meta[property='og:title']"), pageH: document.documentElement.scrollHeight, more: getComputedStyle(document.getElementById("moreBtn")).display, groups: getComputedStyle(document.querySelector(".bargroups")).display, league: getComputedStyle(document.getElementById("league")).display, card: document.querySelector(".card").getBoundingClientRect().top, toggle: document.getElementById("menuToggle").getBoundingClientRect().bottom }));
	await page.screenshot({ path: `${OUT}/${label}-menu.png` });
	return { ctx, page, errs, head };
}

// ---- portrait ----
{
	const { ctx, page, errs, head } = await phone("portrait", { width: 390, height: 844 });
	check("portrait: one <title>, in the head, one icon, Open Graph present", head.headTitle && !head.bodyTitle && head.icons === 1 && head.og && head.title === "Floodlit Football", JSON.stringify(head));
	check("portrait: settings, league and help hidden behind More", head.more !== "none" && head.groups === "none" && head.league === "none", `more=${head.more} groups=${head.groups} league=${head.league}`);
	check("portrait: page is far shorter than before (was 18,513 px)", head.pageH < 6000, `scrollHeight=${head.pageH}`);
	check("portrait: the kick-off card starts under the Show menu button", head.card >= head.toggle - 1, `card.top=${head.card.toFixed(0)} toggle.bottom=${head.toggle.toFixed(0)}`);
	await page.tap("#moreBtn"); await sleep(300);
	const opened = await page.evaluate(() => ({ groups: getComputedStyle(document.querySelector(".bargroups")).display, label: document.getElementById("moreBtn").textContent, stored: localStorage.getItem("ff-more") }));
	check("portrait: More opens the drawer and remembers it", opened.groups !== "none" && opened.label === "Less" && opened.stored === "1", JSON.stringify(opened));
	await page.tap("#moreBtn"); await sleep(200);
	// kick off and look at the overhead picture
	await page.tap("#ovButton"); await sleep(6500);
	await page.screenshot({ path: `${OUT}/portrait-match.png` });
	const view = await page.evaluate(() => { const F = window.__ff; return { cam: F.camMode, state: F.state, FW: F.FW, FH: F.FH, w: document.getElementById("pitch").width, h: document.getElementById("pitch").height, cw: document.getElementById("pitchwrap").getBoundingClientRect().width, ch: document.getElementById("pitchwrap").getBoundingClientRect().height }; });
	check("portrait: overhead camera on a taller-than-wide pitch area", view.cam === "top" && view.h > view.w && view.state === "play", JSON.stringify(view));
	// With the picture on its side, holding "down" moves your man along the pitch (x), not across it.
	const move = await page.evaluate(async () => { const F = window.__ff; F.freeze = 0; F.timeLeft = 1e9; const me = F.outfield(0)[5]; F.ctrl = F.players.indexOf(me); F.manualLock = 1e9; me.vx = me.vy = 0; me.x = F.FW * 0.4; me.y = F.FH / 2; F.ball.owner = me; F.ball.x = me.x + 18; F.ball.y = me.y; F.ball.vx = F.ball.vy = 0; const x0 = me.x, y0 = me.y; /* an outfielder on the ball in open grass: a keeper holding it does not move */ F.key("ArrowDown", true); for (let i = 0; i < 40; i++) { F.step(1); } F.key("ArrowDown", false); return { dx: me.x - x0, dy: me.y - y0, swapped: F.possTeam, half: F.timeLeft }; });
	check("portrait: joystick down moves the player along the pitch (x), not across it (y)", move.dx > 8 && Math.abs(move.dy) < Math.abs(move.dx) * 0.6, JSON.stringify(move));
	check("portrait: no console errors", errs.length === 0, errs.join(" | "));
	// Frame cap: never more than 60 pictures a second, and a 120 Hz tick is skipped.
	// Headless Chrome ticks rAF at 60 or, under load, 30: the game must draw once per tick, never more than 60 a second.
	const fps = await page.evaluate(async () => { const F = window.__ff; const d0 = F.drawn, t0 = performance.now(); let raf = 0; await new Promise(res => { function f (t) { raf++; if (t - t0 < 2000) { requestAnimationFrame(f); } else { res(); } } requestAnimationFrame(f); }); const secs = (performance.now() - t0) / 1000; return { perSec: (F.drawn - d0) / secs, rafPerSec: raf / secs, at120: F.frameDue(108.33, 100), at60: F.frameDue(116.67, 100), at59: F.frameDue(116.0, 100) }; });
	check("draws are capped at 60 a second and keep pace with the display (120 Hz ticks skipped, 60 Hz ticks kept)", fps.perSec <= 62 && fps.perSec >= Math.min(60, fps.rafPerSec) * 0.9 && !fps.at120 && fps.at60 && fps.at59, JSON.stringify(fps));
	await ctx.close();
}
// ---- landscape ----
{
	const { ctx, page, errs } = await phone("landscape", { width: 844, height: 390 });
	await page.tap("#ovButton"); await sleep(6500);
	const geo = await page.evaluate(() => { const t = document.getElementById("bcTicker"); const pads = document.querySelector(".pads").getBoundingClientRect(); const tr = t.getBoundingClientRect(); return { tickerHidden: t.hidden, tickerTop: tr.top, padsBottom: pads.bottom, touchTop: document.getElementById("touch").getBoundingClientRect().top, big: document.body.classList.contains("big") }; });
	await page.screenshot({ path: `${OUT}/landscape-match.png` });
	if (!geo.tickerHidden) {
		check("landscape: the touch pads sit above the results ticker", geo.padsBottom <= geo.tickerTop + 1, JSON.stringify(geo));
	} else {
		// force the ticker on and re-measure
		const g2 = await page.evaluate(() => { const t = document.getElementById("bcTicker"); t.hidden = false; const pads = document.querySelector(".pads").getBoundingClientRect(); return { tickerTop: t.getBoundingClientRect().top, padsBottom: pads.bottom }; });
		check("landscape: the touch pads sit above the results ticker", g2.padsBottom <= g2.tickerTop + 1, JSON.stringify(g2));
	}
	check("landscape: no console errors", errs.length === 0, errs.join(" | "));
	await ctx.close();
}
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
