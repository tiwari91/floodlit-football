	/* ---------- flare-ups ----------
	   After a bad foul, a hot-head on the fouled side can go looking for the man who did it. They
	   square up and push, a couple from each side pile in, teammates pull them apart and the referee
	   steps in: a yellow for both, or a red for violent conduct when two hot-heads go at it. Rare:
	   at most one a match, and most matches have none. p.flare counts the frames down for the
	   figures (face off and push in 3D, a red ring in 2D); p.flareGather draws teammates in. */
	let flareLog = null;   // the match log of the last flare-up: one a match
	const FLARE_T = 170;
	function flareUp (off, vic, behind, card, o = {}) {
		if (!off || !vic || bulkSim || tut || (typeof shoot !== "undefined" && shoot) || !players.includes(off)) { return null; }
		if (!o.force && (flareLog === matchLog || !(behind || card))) { return null; }
		const rnd = o.rnd || Math.random;
		// The fouled side's nearest hot-head: the victim himself if he's on his feet, else the closest of the rest.
		const mates = team(vic.team).filter(p => p !== off && p.role !== "gk" && players.includes(p)).sort((a, b) => dist(a, off) - dist(b, off)).slice(0, 3);
		const mate = mates.slice().sort((a, b) => temperOf(b) - temperOf(a))[0];
		if (!mate) { return null; }
		const heat = (temperOf(mate) + temperOf(off)) / 110;
		if (!o.force && rnd() > 0.06 * heat) { return null; }
		flareLog = matchLog;
		const pair = [ mate, off ];
		for (const [ a, b ] of [ pair, pair.slice().reverse() ]) { a.flare = FLARE_T; a.flareWith = b; a.flareGather = null; }
		const mid = { x: (mate.x + off.x) / 2, y: (mate.y + off.y) / 2 };
		for (const t of [ 0, 1 ]) {
			team(t).filter(p => !pair.includes(p) && p.role !== "gk").sort((a, b) => dist(a, mid) - dist(b, mid)).slice(0, 2).forEach(p => { p.flareGather = mid; p.flare = FLARE_T; p.flareWith = null; });
		}
		// The referee: both booked, or a red for the one who threw the push when both have tempers.
		const bothHot = temperOf(mate) >= 75 && temperOf(off) >= 75, violent = bothHot && rnd() < 0.35;
		const booked = [], sent = [];
		const book = p => {
			const mark = kind => { if (p.team === 0 && p.name && leagueMatch) { matchCards.push({ name: p.name, kind }); } };
			if (p.role === "gk") { return; }
			if (violent && p === mate && team(p.team).length - 1 >= (N === 11 ? 7 : 3)) { sent.push(p); mark("r"); logEvent(p.team, "red", `${p.name || "Player"} (violent conduct)`); return; }
			if (p === off && card) { return; }   // already booked for the foul
			p.yellow = (p.yellow || 0) + 1;
			if (p.yellow >= 2 && team(p.team).length - 1 >= (N === 11 ? 7 : 3)) { sent.push(p); mark("r2"); logEvent(p.team, "red", `${p.name || "Player"} (second yellow)`); return; }
			booked.push(p); mark("y"); logEvent(p.team, "yellow", `${p.name || "Player"}`);
		};
		if (!o.noCards) { book(mate); book(off); }
		const nm = p => p.name || (p.team === 0 ? "your man" : `their No. ${p.num}`);
		const line = sent.length
			? `${nm(mate)} shoves ${nm(off)} and the referee shows him red for violent conduct.`
			: `${nm(mate)} and ${nm(off)} go head to head. Teammates pull them apart and the referee books ${booked.length === 2 ? "both of them" : booked.length ? nm(booked[0]) : "nobody, this time"}.`;
		if (typeof commWait !== "undefined") { commWait = { kind: "flare", n: nm(mate), m: nm(off), team: mate.team, until: performance.now() + 14000 }; }
		if (typeof caption === "function") { setTimeout(() => { if (state === "play" || state === "paused") { caption(sent.length ? "Red card" : "Flare-up", sent.length ? "red" : "yellow", `${nm(mate)} and ${nm(off)}`, sent.length ? "Violent conduct" : "Pushing and shoving", mate.team); } }, 1800); }
		$("announce").textContent = line;
		for (const p of sent) { if (players.includes(p)) { sendOff(p); } }
		return { mate, off, booked, sent, line };
	}
	// Each frame: the two face off and lean in; the others drift toward them. Called from the commentary tick.
	function flareTick () {
		for (const p of players) {
			if (!(p.flare > 0)) { continue; }
			p.flare--;
			const w = p.flareWith, g = p.flareGather;
			if (w && players.includes(w)) {
				const d = dist(p, w), a = Math.atan2(w.y - p.y, w.x - p.x);
				p.dir = a;
				if (d > 16) { p.x += Math.cos(a) * Math.min(1.2, (d - 16) / 2); p.y += Math.sin(a) * Math.min(1.2, (d - 16) / 2); }
			} else if (g) {
				const d = Math.hypot(g.x - p.x, g.y - p.y), a = Math.atan2(g.y - p.y, g.x - p.x);
				p.dir = a;
				if (d > 34) { p.x += Math.cos(a) * 0.9; p.y += Math.sin(a) * 0.9; }
			}
			if (p.flare <= 0) { p.flareWith = null; p.flareGather = null; }
		}
	}
