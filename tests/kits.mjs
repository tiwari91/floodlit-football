// Run: node tests/kits.mjs   (every team colour on screen comes from the club's own kit, an option file's included)
// Every name and colour here is invented for the test.
import { launch, serve, tally } from "./_env.mjs";
const server = serve(8809), URL = server.url;
process.on("exit", () => server.stop());
const { check, done } = tally();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage(), errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
const ready = async () => { await page.waitForSelector("#ovButton"); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.applyOptionFile && window.__ff.setOpponent, null, { timeout: 60000 }); };

// Twenty distinctive kits, none of them near the amber default, each with a second colour well apart.
const SHIRTS = [ "#7b2fbe", "#0f8f7a", "#c2185b", "#2a4dd0", "#5a3e1b", "#00838f", "#8e24aa", "#3949ab", "#ad1457", "#00695c", "#4527a0", "#1565c0", "#6d4c41", "#283593", "#00897b", "#880e4f", "#512da8", "#0277bd", "#4e342e", "#1a237e" ];
const SECONDS = [ "#e8f86a", "#ff9ec7", "#c6ff8a", "#ffd0a0", "#9ef0ff", "#fff4a8", "#b8ffd8", "#ffb3a7", "#d0ffb0", "#ffe08a", "#a8ffe8", "#ffc2f0", "#e0ffa0", "#ffd9b0", "#f0b0ff", "#b0f0ff", "#ffeab0", "#c0ffc0", "#b8d8ff", "#ffc0c0" ];
const L = "abcdefghijklmnopqrstuvwxyz";
const word = (n, k) => L[n % 26].toUpperCase() + L[(n * 7 + k) % 26] + L[(n * 3 + 5) % 26] + L[(n + k * 11) % 26] + "o";
const file = { kind: "floodlit-option-file", version: 2, leagues: { ENG: { clubs: SHIRTS.map((color, i) => ({ slot: i + 1, name: `Kit Test ${word(i + 40, 3)}`, short: `Kit${i + 1}`, color, color2: SECONDS[i], ground: `Test Ground ${i + 1}` })) } } };
const rgb = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
try {
	await page.goto(URL); await ready();
	const applied = await page.evaluate(t => {
		const F = window.__ff, lg = F.league;
		F.clearLeagueFile();
		const r = F.readOptionFile(t, lg);
		if (r.error) { return { err: r.error }; }
		F.applyOptionFile(lg, r, "now", true); F.afterEdit(); F.renderLeague();
		const byName = Object.fromEntries(JSON.parse(t).leagues.ENG.clubs.map(c => [ c.name, c ]));
		const members = lg.members.filter(id => id !== 0).map(id => F.TEAMS[id]);
		const wrong = members.filter(c => byName[c.name] && (c.color !== byName[c.name].color || c.color2 !== byName[c.name].color2 || c.pattern !== "plain")).map(c => c.name);
		return { n: members.filter(c => byName[c.name]).length, wrong };
	}, JSON.stringify(file)).catch(e => ({ err: String(e) }));
	check("the file's clubs take its shirt and second colours, in a plain kit", !applied.err && applied.n === 19 && !applied.wrong.length, JSON.stringify(applied));

	// The league table's badges: each club's shirt with its second colour.
	const badges = await page.evaluate(() => {
		const F = window.__ff, out = [];
		for (const tr of document.querySelectorAll("#lgBody tr")) {
			const d = tr.querySelector(".dot"); if (!d) { continue; }
			const c = F.TEAMS.find(t => tr.textContent.includes(t.name)); if (!c) { continue; }
			out.push({ ok: d.dataset.kit === c.color && d.style.background.replace(/\s/g, "").includes(c.color2 === c.color ? "" : "linear-gradient"), name: c.name });
		}
		return { n: out.length, bad: out.filter(o => !o.ok).map(o => o.name) };
	});
	check("every badge in the table is the club's own shirt and second colour", badges.n >= 20 && !badges.bad.length, JSON.stringify(badges));

	// Into the match: the opponent wears the file's kit on the pitch, the scoreboard and the momentum bar.
	const fx = await page.evaluate(() => window.__ff.currentFixture());
	await page.click("#ovButton"); await page.waitForFunction(() => window.__ff.state === "play" || window.__ff.state === "intro" || window.__ff.state === "countdown", null, { timeout: 60000 });
	const live = await page.evaluate(fx => {
		const F = window.__ff, o = F.TEAMS[fx.opp], cs = getComputedStyle(document.documentElement), chip = s => getComputedStyle(document.querySelector(`.scorebug .chip.${s}`)).backgroundColor;
		return { opp: o.color, opp2: o.color2, kit: F.kits[1].outfield, second: F.kits[1].second, cssOpp: cs.getPropertyValue("--opp").trim(), left: chip("l"), right: chip("r"), you: F.kits[0].outfield, youCss: cs.getPropertyValue("--you-kit").trim(), home: fx.home };
	}, fx);
	const oppChip = live.home ? live.right : live.left;
	check("the opponent plays in the file's shirt and second colour", live.kit === live.opp && live.second === live.opp2 && live.cssOpp === live.opp, JSON.stringify(live));
	check("the scoreboard chip is the opponent's own shirt", oppChip === rgb(live.opp), JSON.stringify({ oppChip, want: rgb(live.opp) }));

	// The file's ground names: the pre-match card, the line-ups header, the kick-off welcome, fixtures and club cards.
	const venue = await page.evaluate(fx => {
		const F = window.__ff, host = fx.home ? F.YOU : F.TEAMS[fx.opp], away = F.league.members.find(id => id !== 0 && id !== fx.opp);
		F.welcomeCall();
		const up = [ ...document.querySelectorAll("#lgUpcoming .venue") ].map(e => e.textContent);
		const cards = [ ...document.querySelectorAll("#clubGrid .club-card") ].map(c => c.textContent);
		return { want: host.ground, ground: F.matchGround(), header: (document.querySelector("#bcLineups .bc-venue") || {}).textContent || "", said: F.lastCommentary && F.lastCommentary.text, kind: F.lastCommentary && F.lastCommentary.kind,
			up, fileGrounds: F.league.members.filter(id => id !== 0).map(id => F.TEAMS[id].ground), cardHas: cards.some(t => t.includes(F.TEAMS[away].ground)), awayGround: F.TEAMS[away].ground };
	}, fx);
	check("the match is at the host's ground, named on the line-ups header and in the welcome", venue.ground === venue.want && venue.header.startsWith(venue.want) && venue.kind === "welcome" && venue.said.includes(venue.want), JSON.stringify(venue));
	check("the file's grounds name the clubs' homes in fixtures and on the club cards", venue.fileGrounds.every(g => /^Test Ground \d+$/.test(g)) && venue.up.length >= 3 && venue.up.some(g => /^Test Ground/.test(g)) && venue.cardHas, JSON.stringify({ up: venue.up, cards: venue.cardHas }));

	// Your club's colours (an edit, a file or a move abroad) are your kit too, and the UI follows them.
	const mine = await page.evaluate(fx => {
		const F = window.__ff, lg = F.league, t = F.clubTargets().find(x => x.kind === "club" && x.id === 0);
		const r = F.editClub(lg, t, { color: "#2e8b57", color2: "#ffe4b5" });
		F.setOpponent(F.TEAMS[fx.opp], true);
		const cs = getComputedStyle(document.documentElement);
		return { r, kit: F.kits[0].outfield, second: F.kits[0].second, css: cs.getPropertyValue("--you-kit").trim(), bar: getComputedStyle(document.getElementById("bugFill")).backgroundColor };
	}, fx);
	check("your kit is your club's own colours, and the momentum bar wears them", mine.r && mine.r.ok && mine.kit === "#2e8b57" && mine.second === "#ffe4b5" && mine.css === "#2e8b57" && mine.bar === rgb("#2e8b57"), JSON.stringify(mine));

	// A clash: the away side changes to its second kit.
	const clash = await page.evaluate(() => {
		const F = window.__ff, them = { name: "Clash Test", short: "Clash", color: "#2f8a59", color2: "#f4f0e0", str: 3 };
		F.setOpponent(them, true); const a = { shirt: F.kits[1].outfield, you: F.kits[0].outfield };
		F.setOpponent(them, false); const b = { shirt: F.kits[1].outfield, you: F.kits[0].outfield };
		return { a, b };
	});
	check("on a clash at your ground they wear their second kit; at theirs you wear yours", clash.a.shirt === "#f4f0e0" && clash.a.you === "#2e8b57" && clash.b.shirt === "#2f8a59" && clash.b.you === "#ffe4b5", JSON.stringify(clash));
	check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} catch (e) {
	check("the run finished", false, String(e && e.stack || e).slice(0, 400));
}
await browser.close();
server.stop();
process.exit(done() ? 1 : 0);
