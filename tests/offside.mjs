// Offside, the two commentators and the terrace chants.
// Run: node tests/offside.mjs
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8807); const browser = await launch();
const { check, done } = tally();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
await ctx.addInitScript(() => { try { localStorage.setItem("ff-diff", "normal"); localStorage.setItem("ff-mode", "friendly"); } catch (e) { /* none */ } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(server.url, { timeout: 90000 }); await page.waitForSelector("#ovButton"); await page.click("#ovButton");
await page.waitForFunction(() => window.__ff && window.__ff.state === "play", null, { timeout: 90000 });

// A controlled picture: the back line (all but the keeper) at defLine, the receiver at manX, the passer at
// kickX with the ball. The pass is played and the receiver takes it (or heads it), and we see what is given.
const scene = await page.evaluate(() => {
	const F = window.__ff, FW = F.FW, FH = F.FH;
	const r = Math.random;
	function play ({ defLine, manX, kickX, restart, head, volley }) {
		F.state = "play"; F.freeze = 0;
		const ours = F.outfield(0), theirs = F.players.filter(q => q.team === 1);
		const k = ours[0], m = ours[1];
		F.players.forEach((q, i) => { q.kickCd = 0; q.jump = 0; q.x = q.team === 0 ? FW * 0.3 : FW * 0.2 + (i % 3) * 10; q.y = 80 + (i % 9) * 60; q.vx = q.vy = 0; });
		theirs.forEach((q, i) => { q.x = q.role === "gk" ? FW - 30 : FW * defLine; q.y = 90 + i * 55; });
		k.x = FW * kickX; k.y = FH / 2; m.x = FW * manX; m.y = FH / 2 + 120;
		F.ball.x = k.x + 8; F.ball.y = k.y; F.ball.z = 0;
		const before = F.tally.offsides[0];
		F.kickTest(k, m.x, m.y, 8, restart);
		const marked = F.offside.team === 0 && F.offside.set.has(m);
		Math.random = () => (head ? 0.05 : 0.9);   // never the tight-call review: a straight decision (and in the air, he goes for it)
		try {
			if (volley) { F.kickTest(m, FW - 10, FH / 2, 12); }   // first time, before he ever has it
			else if (head) {
				F.ball.x = m.x + 4; F.ball.y = m.y; F.ball.z = 20; F.ball.vz = -1; F.ball.vx = F.ball.vy = 0; F.ball.kickedAt = F.frame - 10;
				F.players.forEach(q => { if (q !== m) { q.kickCd = 30; } });
				F.aerialTest(0);
			} else { F.gainBallTest(m); }
		} finally { Math.random = r; }
		const called = F.tally.offsides[0] - before;
		return { marked, called, owner: F.ball.owner === m, fk: F.setPieceKind, banner: document.getElementById("banner").textContent, indirect: !!(F.setPiece && F.setPiece.indirect) };
	}
	return {
		off: play({ defLine: 0.7, manX: 0.8, kickX: 0.6 }),
		on: play({ defLine: 0.7, manX: 0.66, kickX: 0.6 }),
		ownHalf: play({ defLine: 0.35, manX: 0.45, kickX: 0.3 }),
		behindBall: play({ defLine: 0.6, manX: 0.7, kickX: 0.75 }),
		throwIn: play({ defLine: 0.7, manX: 0.8, kickX: 0.6, restart: "throw" }),
		corner: play({ defLine: 0.7, manX: 0.8, kickX: 0.6, restart: "corner" }),
		freeKick: play({ defLine: 0.7, manX: 0.8, kickX: 0.6, restart: "free" }),
		header: play({ defLine: 0.7, manX: 0.8, kickX: 0.6, head: true }),
		volley: play({ defLine: 0.7, manX: 0.8, kickX: 0.6, volley: true })
	};
});
check("a pass to a man beyond the second-last defender and the ball, in their half: offside, an indirect free kick, the banner", scene.off.marked && scene.off.called === 1 && !scene.off.owner && scene.off.fk === "free" && scene.off.indirect && /Offside/.test(scene.off.banner), JSON.stringify(scene.off));
check("onside (behind the line): play on, he has the ball", !scene.on.marked && scene.on.called === 0 && scene.on.owner, JSON.stringify(scene.on));
check("in his own half: never offside", !scene.ownHalf.marked && scene.ownHalf.called === 0 && scene.ownHalf.owner, JSON.stringify(scene.ownHalf));
check("level with or behind the ball: not offside", !scene.behindBall.marked && scene.behindBall.called === 0, JSON.stringify(scene.behindBall));
check("no offside from a throw-in or a corner", scene.throwIn.called === 0 && scene.corner.called === 0 && scene.throwIn.owner && scene.corner.owner, JSON.stringify([ scene.throwIn, scene.corner ]));
check("a free kick can play a man offside", scene.freeKick.called === 1, JSON.stringify(scene.freeKick));
check("a first-time shot from an offside position is offside too", scene.volley.marked && scene.volley.called === 1, JSON.stringify(scene.volley));
check("heading it from an offside position is offside too", scene.header.marked && scene.header.called === 1, JSON.stringify(scene.header));

// The two commentators: the lead calls the moment, the co-commentator follows a beat later; names on screen.
const comm = await page.evaluate(async () => {
	const F = window.__ff, r = Math.random;
	F.state = "play"; F.freeze = 0;
	for (const id of [ "lowerThird", "commLine" ]) { const e = document.getElementById(id); if (e) { e.hidden = true; } }
	F.commReset();
	const p = F.outfield(0)[3], gk = F.players.find(q => q.role === "gk" && q.team === 1);
	Math.random = () => 0.01;
	try { F.moment("save", p, { keeper: gk, shooter: p }); } finally { Math.random = r; }
	const first = { who: (document.getElementById("commWho") || {}).textContent, text: document.getElementById("commText").textContent, by: F.lastCommentary && F.lastCommentary.who };
	await new Promise(res => setTimeout(res, 3100));
	const second = { who: (document.getElementById("commWho") || {}).textContent, text: document.getElementById("commText").textContent, by: F.lastColour && F.lastColour.who, kind: F.lastColour && F.lastColour.kind, lead: F.lastCommentary && F.lastCommentary.who };
	const shouts = new Set();
	for (let i = 0; i < 12; i++) { shouts.add(F.goalShout("A. Test", 0)); }
	return { first, second, names: F.CALLERS.map(c => c.name), shouts: shouts.size, colourPools: Object.keys(F.COLOUR).length };
});
check("two commentators: the lead calls it with his name on the line, the co-commentator comes in after", comm.first.who === "Halden" && comm.first.by === comm.names[0] && comm.second.who === "Marlow" && comm.second.by === comm.names[1] && comm.second.kind === "save" && comm.second.lead === comm.names[0] && comm.second.text !== comm.first.text, JSON.stringify(comm));
check("goal calls vary, and the co-commentator has lines for every kind of moment", comm.shouts >= 4 && comm.colourPools >= 15, JSON.stringify({ shouts: comm.shouts, pools: comm.colourPools }));

// The chants: several kinds, never the same one twice running from the same end, pitched and paced differently.
const chants = await page.evaluate(() => {
	const F = window.__ff;
	for (let i = 0; i < 16; i++) { F.chantTest(i % 4 === 3); }
	const log = F.chantLogTest(), home = log.filter(c => !c.away), away = log.filter(c => c.away);
	const repeats = [ home, away ].reduce((n, l) => n + l.filter((c, i) => i > 0 && c.kind === l[i - 1].kind).length, 0);
	return { kinds: [ ...new Set(log.map(c => c.kind)) ], repeats, shifts: new Set(log.map(c => c.shift)).size, tempos: new Set(log.map(c => c.tempo.toFixed(2))).size, n: log.length };
});
check("terrace chants: at least three kinds, none twice running from one end, varied pitch and pace", chants.kinds.length >= 3 && chants.repeats === 0 && chants.shifts >= 2 && chants.tempos >= 4, JSON.stringify(chants));
check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));

await ctx.close(); await browser.close(); server.stop();
process.exit(done() ? 1 : 0);
