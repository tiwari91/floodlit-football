// Run: node tests/edit.mjs   (edit mode and option files: renames persist, round-trip, reject, revert)
// FF_SHOTS=<dir> also saves screenshots of the editor and the import preview there.
import fs from "node:fs";
import path from "node:path";
import { launch, serve, tally, OUT, showTab } from "./_env.mjs";
const server = serve(8793), URL = server.url;
const { check, done } = tally();
const SHOTS = process.env.FF_SHOTS || OUT;
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/GL Driver|ERR_NETWORK/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
const ready = async () => { await page.waitForSelector("#ovButton"); await page.waitForFunction(() => window.__ff && window.__ff.league && window.__ff.league.club && window.__ff.openEditor, null, { timeout: 60000 }); };
try {
	await page.goto(URL); await ready();

	// An old save: no player ids, no edits. It loads, and every player is given an id.
	await page.evaluate(() => {
		const lg = JSON.parse(JSON.stringify(window.__ff.league));
		for (const pl of [ ...lg.club.squad, ...lg.club.bench, ...(lg.club.market || []) ]) { delete pl.id; }
		delete lg.edits;
		localStorage.setItem("ff-league", JSON.stringify(lg));
		localStorage.removeItem("ff-edits");
	});
	await page.reload(); await ready();
	const old = await page.evaluate(() => { const c = window.__ff.league.club, all = [ ...c.squad, ...c.bench ]; return { ids: all.filter(p => typeof p.id === "string" && p.id).length, n: all.length, unique: new Set(all.map(p => p.id)).size, edits: window.__ff.league.edits }; });
	check("an old save loads and every player gets a stable id", old.ids === old.n && old.unique === old.n && old.edits && Object.keys(old.edits.clubs).length === 0, JSON.stringify({ ...old, edits: !!old.edits }));

	// The help line and the way in.
	const help = await page.evaluate(() => ({ btn: !!document.getElementById("lgEdit"), help: document.querySelector("#editSheet .ed-help").textContent }));
	check("the League panel has Edit names and the editor says players are invented", help.btn && /ships with invented players/.test(help.help), JSON.stringify(help));

	// Edit a club through the editor.
	const orig = await page.evaluate(() => ({ club: window.__ff.TEAMS[1].name, player: window.__ff.league.club.squad[9].name, id: window.__ff.league.club.squad[9].id, buyer: window.__ff.league.members.find(id => id > 1) }));
	await showTab(page, "settings");
	await page.click("#lgEdit");
	await page.selectOption("#edClubSel", "1");
	await page.fill("#edClubName", "Port Wexham");
	await page.fill("#edClubShort", "Wexham");
	await page.fill("#edClubColor", "#2255aa");
	await page.click("#edClubSave"); await page.waitForTimeout(300);
	await page.screenshot({ path: path.join(SHOTS, "editor-clubs.png") });
	const club = await page.evaluate(() => ({ t: { ...window.__ff.TEAMS[1] }, ident: JSON.stringify(window.__ff.league.ident || {}) }));
	check("a club edit renames the club, its short name and kit", club.t.name === "Port Wexham" && club.t.short === "Wexham" && club.t.color === "#2255aa" && club.t.text, JSON.stringify(club.t));
	check("the club edit stays out of the save's identities (Revert stays exact)", !/Port Wexham/.test(club.ident), club.ident);

	// Validation.
	const bad = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, t = F.clubTargets()[2];
		return [ F.editClub(lg, t, { name: "Port Wexham" }), F.editClub(lg, t, { color: "red" }), F.editClub(lg, t, { name: "x".repeat(40) }), F.editPlayer(lg, "you", 1, { name: lg.club.squad[2].name }), F.editPlayer(lg, "you", 1, { name: "R2-D2" }), F.editPlayer(lg, "you", 1, { shirt: 140 }) ].map(r => r.error || "ok");
	});
	check("duplicates, bad colours, long names, bad characters and numbers are refused", bad.every(e => e !== "ok"), JSON.stringify(bad));

	// Edit a player through the editor: name, number, foot, look.
	await page.click('#editTabs button[data-tab="players"]');
	await page.selectOption("#edWhere", "you");
	await page.selectOption("#edPlayerSel", "9");
	await page.fill("#edPName", "T. Okonkwo-Vale");
	await page.fill("#edPShirt", "77");
	await page.selectOption("#edPFoot", "left");
	await page.selectOption("#edPStyle", "afro");
	await page.click("#edPSave");
	await page.screenshot({ path: path.join(SHOTS, "editor-players.png") });
	const pl = await page.evaluate(() => { const F = window.__ff, q = F.league.club.squad[9], mp = F.players.find(p => p.team === 0 && p.name === q.name); return { name: q.name, shirt: q.shirt, foot: q.foot, lk: q.lk, orig: q.orig, num: mp && mp.num, lookEd: mp && mp.lookEd }; });
	check("a player edit sets name, number, foot and look", pl.name === "T. Okonkwo-Vale" && pl.shirt === 77 && pl.foot === "left" && pl.lk.style === "afro" && pl.orig.name === orig.player, JSON.stringify(pl));
	check("the match side wears his number and look", pl.num === 77 && pl.lookEd && pl.lookEd.style === "afro", JSON.stringify({ num: pl.num, lookEd: pl.lookEd }));

	// Ratings only change with custom ratings on.
	const rat = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, q = lg.club.squad[5], before = q.pac;
		F.editPlayer(lg, "you", 5, { pac: 95 });
		const off = q.pac;
		F.setCustomRatings(lg, true); F.editPlayer(lg, "you", 5, { pac: 95 }); const on = q.pac;
		F.setCustomRatings(lg, false);
		return { before, off, on };
	});
	check("ratings are only edited with custom ratings on", rat.off === rat.before && rat.on === 95, JSON.stringify(rat));

	// A computer squad, by club and slot.
	const slot = await page.evaluate(id => {
		const F = window.__ff, lg = F.league;
		lg.cpuIn = {};   // no signings in the way of the slot
		const r = F.editPlayer(lg, String(id), 3, { name: "Q. Marrowby" }); F.afterEdit();
		return { r, name: F.cpuSquad(id, F.getStr(id))[3].name };
	}, orig.buyer);
	check("a computer club's player is edited by slot", slot.r.ok && slot.name === "Q. Marrowby", JSON.stringify(slot));

	// Persist after a reload.
	await page.evaluate(() => { window.__ff.closeEditor(); });
	await page.reload(); await ready();
	const after = await page.evaluate(id => { const F = window.__ff; return { club: F.TEAMS[1].name, color: F.TEAMS[1].color, player: F.league.club.squad[9].name, shirt: F.league.club.squad[9].shirt, slot: F.cpuSquad(id, F.getStr(id))[3].name }; }, orig.buyer);
	check("club and player edits persist after a reload", after.club === "Port Wexham" && after.color === "#2255aa" && after.player === "T. Okonkwo-Vale" && after.shirt === 77 && after.slot === "Q. Marrowby", JSON.stringify(after));

	// Export, revert, import: the round trip.
	const trip = await page.evaluate(([ origClub, origPlayer ]) => {
		const F = window.__ff, lg = F.league, file = F.buildOptionFile(lg), text = JSON.stringify(file);
		const n = F.revertEdits(lg);
		const reverted = { club: F.TEAMS[1].name, player: lg.club.squad[9].name, shirt: lg.club.squad[9].shirt, stored: localStorage.getItem("ff-edits") };
		const read = F.readOptionFile(text, lg);
		F.applyOptionFile(lg, read, "now", false);
		return { file, bytes: text.length, n, reverted, sum: read.sum, lines: F.previewText(read.sum), back: { club: F.TEAMS[1].name, player: lg.club.squad[9].name, shirt: lg.club.squad[9].shirt }, origClub, origPlayer };
	}, [ orig.club, orig.player ]);
	check("revert puts the default names back", trip.reverted.club === orig.club && trip.reverted.player === orig.player && trip.reverted.shirt === undefined && trip.reverted.stored === null, JSON.stringify(trip.reverted));
	check("the option file is small and versioned", trip.file.kind === "floodlit-option-file" && trip.file.version === 2 && trip.bytes < 2000, `${trip.bytes} bytes`);
	check("export then import brings every edit back", trip.back.club === "Port Wexham" && trip.back.player === "T. Okonkwo-Vale" && trip.back.shirt === 77 && trip.sum.clubs === 1 && trip.sum.players === 2, JSON.stringify({ back: trip.back, sum: trip.sum }));
	check("the preview says what the file renames", /^This file renames 1 club and 2 players\.$/.test(trip.lines[0]), trip.lines[0]);

	// Dribbling and physical: set with custom ratings, out to a file and back; left alone, never written.
	const dp = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, q = lg.club.squad[6], d0 = F.driOf(q);
		F.setCustomRatings(lg, true); F.editPlayer(lg, "you", 6, { dri: 93, phy: 41 });
		const file = F.buildOptionFile(lg), text = JSON.stringify(file);
		F.resetPlayer(lg, "you", 6); const gone = [ q.dri, q.phy, F.driOf(q) === d0 ];
		F.applyOptionFile(lg, F.readOptionFile(text, lg), "now", true);
		const back = [ q.dri, q.phy ], others = !/"dri"|"phy"/.test(text.replace(/"dri":93,|"phy":41/g, ""));
		F.resetPlayer(lg, "you", 6); F.setCustomRatings(lg, false);   // only this player: the edits above are still in use below
		return { gone, back, others };
	});
	check("dribbling and physical round-trip through the option file; unset, none are written", dp.gone[0] === undefined && dp.gone[1] === undefined && dp.gone[2] && dp.back[0] === 93 && dp.back[1] === 41 && dp.others, JSON.stringify(dp));

	// Malformed and foreign files are refused with a plain message; unknown entries are ignored.
	const rej = await page.evaluate(() => {
		const F = window.__ff, lg = F.league, r = t => F.readOptionFile(t, lg);
		const unk = r('{"kind":"floodlit-option-file","version":1,"clubs":{"Nowhere Town":{"name":"X Town"},"__proto__":{"name":"Evil"}},"players":{"nobody":{"name":"A. Ghost"}},"extra":1}');
		return {
			json: r("{ not json").error, kind: r('{"kind":"something-else"}').error, season: r(JSON.stringify({ app: "floodlit-football", v: 1, league: {} })).error,
			newer: r('{"kind":"floodlit-option-file","version":9}').error, damaged: r('{"kind":"floodlit-option-file","version":1,"clubs":[1,2]}').error,
			big: r(" ".repeat(8000001)).error, unknown: unk.sum, unknownLines: F.previewText(unk.sum), proto: ({}).name
		};
	});
	check("a file that isn't JSON is refused", /isn't valid JSON/.test(rej.json || ""), rej.json);
	check("a file of another kind, a saved season, a newer version and a damaged file are refused", /isn't a Floodlit option file/.test(rej.kind || "") && /Import league/.test(rej.season || "") && /newer version/.test(rej.newer || "") && /damaged/.test(rej.damaged || "") && /too big/.test(rej.big || ""), JSON.stringify(rej));
	check("unknown entries are ignored with a summary, and nothing leaks into objects", rej.unknown.clubs === 0 && rej.unknown.players === 0 && rej.unknown.unknown === 2 && rej.unknown.extra === 1 && /Ignored:/.test(rej.unknownLines.join(" ")) && rej.proto === undefined, JSON.stringify(rej.unknownLines));

	// The import preview, through the file picker.
	await page.evaluate(() => { window.__ff.league.cpuIn = {}; window.__ff.openEditor("file"); });
	await page.setInputFiles("#editFile", { name: "edits.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ kind: "floodlit-option-file", version: 1, clubs: { "Millbrook Rovers": { name: "Millbrook Town", color: "#7a1f3d" } }, slots: { "Millbrook Rovers#9": { name: "J. Penhallow", pac: 90 } }, players: { gone: { name: "N. One" } } })) });
	await page.waitForSelector("#edApplyNow"); await page.waitForTimeout(500);   // the card slides in
	await page.screenshot({ path: path.join(SHOTS, "import-preview.png") });
	const pv = await page.evaluate(() => document.getElementById("edPreview").textContent);
	check("the import preview counts and summarises", /renames 1 club and 1 player/.test(pv) && /Ignored: 1 entry/.test(pv) && /custom ratings/.test(pv), pv);
	await page.click("#edApplyNow");
	const applied = await page.evaluate(() => { const F = window.__ff, id = F.TEAMS.findIndex(t => t.name === "Millbrook Town"); return { id, pac: id > 0 ? F.cpuSquad(id, F.getStr(id))[9].pac : null, name: id > 0 ? F.cpuSquad(id, F.getStr(id))[9].name : null, raw: id > 0 ? F.editsOf(F.league).slots["Millbrook Rovers#9"] : null }; });
	check("applied without its ratings unless asked", applied.id > 0 && applied.name === "J. Penhallow" && applied.raw && applied.raw.pac === undefined, JSON.stringify(applied));
	await page.evaluate(() => window.__ff.closeEditor());

	// An edited player keeps his name, number and look after a transfer.
	const sold = await page.evaluate(buyer => {
		const F = window.__ff, lg = F.league, q = lg.club.squad.find(p => p.name === "T. Okonkwo-Vale");
		lg.round = 0;
		q.listed = true;   // up for sale, so he won't refuse a smaller club (18e)
		F.sellPlayer(q.name, 3, buyer);
		const ins = (lg.cpuIn[buyer] || []).find(d => d.pl.name === "T. Okonkwo-Vale"), sq = F.cpuSquad(buyer, F.getStr(buyer));
		return { gone: !lg.club.squad.some(p => p.name === "T. Okonkwo-Vale"), inCpu: !!ins, carried: ins && { id: ins.pl.id, shirt: ins.pl.shirt, lk: ins.pl.lk }, inSquad: sq.some(p => p.name === "T. Okonkwo-Vale") };
	}, orig.buyer);
	check("an edited player keeps his edited name after a transfer", sold.gone && sold.inCpu && sold.inSquad && sold.carried.shirt === 77 && sold.carried.lk.style === "afro" && sold.carried.id === orig.id, JSON.stringify(sold));

	// The next season: club and slot edits carry on.
	const next = await page.evaluate(id => {
		const F = window.__ff, lg = F.league;
		F.editPlayer(lg, "you", 2, { name: "D. Ferncastle" });
		F.newSeason(lg.fmt);
		const L = F.league;
		const signed = (L.cpuIn[id] || []).some(d => d.slot === 3);   // a summer signing takes the slot over
		return { season: L.season, club: F.TEAMS[1].name, slot: signed ? "Q. Marrowby" : F.cpuSquad(id, F.getStr(id))[3].name, mine: [ ...L.club.squad, ...L.club.bench ].some(p => p.name === "D. Ferncastle"), edits: Object.keys(L.edits.clubs).length };
	}, orig.buyer);
	check("edits survive a season rollover", next.season >= 2 && next.club === "Port Wexham" && next.slot === "Q. Marrowby" && next.mine && next.edits === 2, JSON.stringify(next));

	// Revert, then reload: still the defaults.
	await page.evaluate(() => { const F = window.__ff; F.revertEdits(F.league); F.league.updated = Date.now(); localStorage.setItem("ff-league", JSON.stringify(F.league)); });
	await page.reload(); await ready();
	const rv = await page.evaluate(id => { const F = window.__ff; return { club: F.TEAMS[1].name, mill: F.TEAMS.some(t => t.name === "Millbrook Town"), slot: F.cpuSquad(id, F.getStr(id))[3].name, ferns: [ ...F.league.club.squad, ...F.league.club.bench ].some(p => p.name === "D. Ferncastle") }; }, orig.buyer);
	check("after Revert and a reload everything is back to default", rv.club === orig.club && !rv.mill && rv.slot !== "Q. Marrowby" && !rv.ferns, JSON.stringify(rv));

	check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} catch (e) {
	check("the edit-mode run finished", false, String(e && e.stack || e).slice(0, 400));
} finally {
	await browser.close();
	server.stop();
}
process.exit(done() ? 1 : 0);
