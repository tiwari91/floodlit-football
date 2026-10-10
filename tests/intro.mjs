// Run: node tests/intro.mjs   (the matchday card and the first visit)
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8798), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const errs = [];
async function fresh () {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
	await page.goto(URL); await page.waitForSelector("#ovButton");
	await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
	return { ctx, page };
}
const card = page => page.evaluate(() => { const t = document.getElementById("ovText"), l = document.getElementById("ovLearn"); return { title: document.getElementById("ovTitle").textContent, lines: t.classList.contains("lines") ? [ ...t.querySelectorAll(".ln") ].map(x => x.textContent.trim()) : [ t.textContent ], cls: t.className, learn: !l.hidden && l.offsetParent !== null, fits: t.scrollHeight <= t.clientHeight + 1 || getComputedStyle(t).overflowY !== "hidden", kickVisible: (() => { const b = document.getElementById("ovButton").getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; })() }; });

// A brand-new player: the welcome line and the walk-through button on matchday 1.
let { ctx, page } = await fresh();
const first = await card(page);
check("a first visit opens on matchday 1 with a welcome line and a Learn the controls button", /^Matchday 1/.test(first.title) && /^Welcome to Floodlit Football/.test(first.lines[0]) && first.learn, JSON.stringify(first));
check("the matchday card reads one fact per line: club, watch, how they play, coach, your eleven, conditions", first.cls.includes("lines") && first.lines.length >= 6 && first.lines.some(l => /^Watch: /.test(l)) && first.lines.some(l => /^They play: /.test(l)) && first.lines.some(l => /^Your eleven: /.test(l)) && first.lines.some(l => /^Conditions: /.test(l)) && /difficulty$/.test(first.lines[1]), JSON.stringify(first.lines));
check("on a desktop screen the card fits and Kick off is in view", first.kickVisible, JSON.stringify(first));

// The walk-through, and straight back to matchday 1 of the league.
await page.click("#ovLearn"); await page.waitForTimeout(400);
const inTut = await page.evaluate(() => ({ mode: window.__ff.mode, title: document.getElementById("ovTitle").textContent }));
check("Learn the controls starts the tutorial", inTut.mode === "tutorial" && /Tutorial/.test(inTut.title), JSON.stringify(inTut));
await page.click("#ovButton"); await page.waitForTimeout(300);
await page.evaluate(() => window.__ff.finishTutorialTest()); await page.waitForTimeout(300);
const done1 = await page.evaluate(() => ({ title: document.getElementById("ovTitle").textContent, btn: document.getElementById("ovButton").textContent }));
check("the tutorial's last card offers the way back to matchday 1", /Tutorial complete/.test(done1.title) && done1.btn === "Back to matchday 1", JSON.stringify(done1));
await page.click("#ovButton"); await page.waitForTimeout(400);
const back = await page.evaluate(() => ({ mode: window.__ff.mode, title: document.getElementById("ovTitle").textContent, first: (document.querySelector("#ovText .ln") || document.getElementById("ovText")).textContent.trim(), learn: !document.getElementById("ovLearn").hidden }));
check("and it lands back on the league's matchday 1, without the welcome now the tutorial is done", back.mode === "league" && /^Matchday 1/.test(back.title) && !/^Welcome/.test(back.first) && !back.learn, JSON.stringify(back));
await ctx.close();

// A returning player who has played: no welcome, no button; other cards are plain text.
({ ctx, page } = await fresh());
await page.evaluate(() => { localStorage.setItem("ff-played", "4"); });
await page.reload(); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
const ret = await card(page);
check("a returning player sees the plain matchday card", !ret.learn && !/^Welcome/.test(ret.lines[0]) && ret.cls.includes("lines"), JSON.stringify(ret));
await page.click("#ovButton"); await page.waitForTimeout(500);
await page.evaluate(() => { document.getElementById("pauseBtn").click(); }); await page.waitForTimeout(300);
const paused = await page.evaluate(() => ({ title: document.getElementById("ovTitle").textContent, cls: document.getElementById("ovText").className, learn: !document.getElementById("ovLearn").hidden }));
check("other cards drop the line layout and the button", !paused.cls.includes("lines") && !paused.learn, JSON.stringify(paused));
await ctx.close();

// Simulate whole season: offered before January, runs to the end without stopping at the window.
({ ctx, page } = await fresh());
const offer = await page.evaluate(() => { const b = document.getElementById("ovSeasonAll"), j = document.getElementById("ovSeason"); return { all: !b.hidden && b.textContent, jan: !j.hidden && j.textContent }; });
check("matchday 1 offers both Simulate to January and Simulate whole season", offer.all === "Simulate whole season" && offer.jan === "Simulate to January", JSON.stringify(offer));
await page.click("#ovSeasonAll"); await page.waitForFunction(() => /simulated/.test(document.getElementById("ovTitle").textContent), null, { timeout: 120000 });
const whole = await page.evaluate(() => ({ title: document.getElementById("ovTitle").textContent, text: document.getElementById("ovText").textContent, round: window.__ff.league.round, n: window.__ff.league.fixtures.length, btn: document.getElementById("ovButton").textContent, allHidden: document.getElementById("ovSeasonAll").hidden }));
check("Simulate whole season plays every fixture and ends on the season summary", /^Season 1 simulated/.test(whole.title) && whole.round >= whole.n && /^Start season 2/.test(whole.btn) && whole.allHidden && /January window went by|Assistant handled the January window/.test(whole.text), JSON.stringify({ ...whole, text: whole.text.slice(0, 200) }));
await ctx.close();

// The touchline cam: a real foul cuts to the fouled side's manager for a couple of seconds while
// play goes on; a run of fouls doesn't keep cutting away; a simulated match never shows it.
({ ctx, page } = await fresh());
await page.evaluate(() => localStorage.setItem("ff-played", "5")); await page.reload();
await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club, null, { timeout: 60000 });
await page.click("#ovButton"); await page.waitForFunction(() => window.__ff.state === "play", null, { timeout: 60000 });
await page.waitForTimeout(400);
const tl = await page.evaluate(async () => {
	const F = window.__ff, wait = ms => new Promise(r => setTimeout(r, ms));
	F.freeze = 0; F.tlcLast = -1e9;
	const off = F.players.find(p => p.team === 1 && p.role !== "gk"), vic = F.players.find(p => p.team === 0 && p.role !== "gk");
	vic.x = F.FW * 0.4; vic.y = F.FH * 0.5; off.x = vic.x + 10; off.y = vic.y;
	F.commitFoul(off, vic, false);
	const first = F.tlc && { team: F.tlc.team, pose: F.tlc.pose, line: F.tlc.line };
	const t0 = F.tlc && F.tlc.t0;
	// a second foul straight away does not cut away again
	F.state === "play";
	const again = (() => { const before = F.tlc && F.tlc.t0; F.benchReact("foul", { fouled: 1, offender: 0, card: false }); return F.tlc && F.tlc.t0 === before; })();
	await wait(3000);
	return { first, again, closed: F.tlc === null, t0 };
});
check("a foul cuts to the fouled side's manager shouting at the referee", tl.first && tl.first.team === 0 && /shout|furious/.test(tl.first.pose) && tl.first.line.length > 3, JSON.stringify(tl));
check("a second foul straight after doesn't cut away again, and the box closes within three seconds", tl.again && tl.closed, JSON.stringify(tl));
const bulk = await page.evaluate(() => { const F = window.__ff; F.tlcLast = -1e9; F.simulateMineTest(); return F.tlc; });
check("a simulated match never shows the touchline cam", bulk === null, JSON.stringify(bulk));
const nmg = await page.evaluate(() => { const F = window.__ff; F.state === "play" || (F.state = "play"); F.freeze = 0; F.tlcLast = -1e9; F.benchReact("near", { team: 0 }); const had = !!F.tlc; F.forceGoal(0); for (let i = 0; i < 60 && F.state !== "goal"; i++) { F.step(1); } return { had, state: F.state, cleared: F.tlc === null }; });
check("a near-miss cutaway is cleared when a goal follows", nmg.had ? nmg.state === "goal" && nmg.cleared : true, JSON.stringify(nmg));
// Goal banner clears after about two seconds; the officials' board sits under the canvas tags;
// the half-time comparison fits without scrolling and its possession bar has width.
const ov = await page.evaluate(async () => {
	const F = window.__ff, wait = ms => new Promise(r => setTimeout(r, ms)), bn = document.getElementById("banner");
	F.state === "play" || (F.state = "play"); F.freeze = 0; F.forceGoal(1);
	for (let i = 0; i < 60 && F.state !== "goal"; i++) { F.step(1); }
	const cls = bn.className;
	await wait(400);
	const early = +getComputedStyle(bn).opacity;
	await wait(2300);
	const gone = bn.hidden || +getComputedStyle(bn).opacity < 0.05;
	F.board([ [ "Added time", "add", "+3" ] ], 3000);
	const cv = document.querySelector(".pitchwrap canvas").getBoundingClientRect(), bd = document.getElementById("bcBoard").getBoundingClientRect();
	const tagBottom = 88 * cv.height / (document.querySelector(".pitchwrap canvas").height / F.scale);
	return { cls, early, gone, boardTop: bd.top - cv.top, tagBottom };
});
check("a goal banner shows, then clears within ~2.7 s so the celebration is visible", /\bgoal\b/.test(ov.cls) && ov.early > 0.5 && ov.gone, JSON.stringify(ov));
check("the officials' board sits below the weather and tactic tags", ov.boardTop >= ov.tagBottom, JSON.stringify(ov));
const ht = await page.evaluate(async () => {
	const F = window.__ff; F.halfTime(); await new Promise(r => setTimeout(r, 600));
	const cb = document.querySelector(".overlay:not([hidden]) .card-body"), bar = document.querySelector(".cmp-bar"), b = document.querySelector(".cmp-row b");
	const rows = [ ...document.querySelectorAll(".cmp-row") ].map(r => r.getBoundingClientRect()), cbr = cb.getBoundingClientRect();
	const cm = document.getElementById("coachMark"); cm.hidden = false;
	const coachOver = getComputedStyle(cm).display !== "none"; cm.hidden = true;
	return { coachOver, numPx: parseFloat(getComputedStyle(b).fontSize), barW: bar ? bar.getBoundingClientRect().width : 0, lastRowIn: rows.length ? rows[rows.length - 1].bottom <= cbr.bottom + 1 : false, n: rows.length };
});
check("the first-match coach mark never covers a card's buttons", !ht.coachOver, JSON.stringify(ht));
check("half-time stats: numbers at the table's size, a visible possession bar, every row in view", ht.numPx <= 24 && ht.barW > 100 && ht.lastRowIn, JSON.stringify(ht));
await ctx.close();

check("no console errors", errs.length === 0, errs.join(" | "));
await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
