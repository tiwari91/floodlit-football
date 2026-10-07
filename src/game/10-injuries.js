	/* ---------- injuries ----------
	   A knock: he limps on (slower, weaker shot) and misses a game or two. A serious one: play stops,
	   the stretcher comes on and he's carried off; he misses weeks (matchdays). Heavy tackles cause
	   most of them, "get stuck in" more than anyone; a player running on empty can pull something. */
	const INJURIES = {
		knock: [ [ "dead leg", 1, 1 ], [ "ankle knock", 1, 2 ], [ "bruised shin", 1, 1 ], [ "tight calf", 1, 2 ] ],
		serious: [ [ "hamstring strain", 2, 4 ], [ "ankle ligaments", 3, 6 ], [ "groin strain", 2, 4 ], [ "knee ligaments", 5, 9 ], [ "broken toe", 3, 5 ] ]
	};
	function rollInjury (serious) {
		const list = INJURIES[serious ? "serious" : "knock"], [ type, lo, hi ] = list[Math.floor(Math.random() * list.length)];
		return { type, games: lo + Math.floor(Math.random() * (hi - lo + 1)), serious: !!serious };
	}
	const injLabel = pl => (pl.injType ? `${pl.injType} · ` : "");
	function noteInjury (p, info) {
		p.injured = true; p.injInfo = info;
		if (p.team === 0 && p.name && league && league.club && leagueMatch) { if (!matchInjuries.includes(p.name)) { matchInjuries.push(p.name); } matchInjInfo[p.name] = info; }
		if (p.attr) { p.attr = { ...p.attr, pac: Math.round(p.attr.pac * 0.85), sho: Math.round(p.attr.sho * 0.92) }; }
		logEvent(p.team, "injury", `${p.name || "Player"} (${info.type}${info.serious ? ", stretchered off" : ""})`);
	}
	// The stretcher: two medics jog on from the near touchline, lift him and carry him off.
	let stretcher = null;
	function startStretcher (p, after) {
		const side = p.y < FH / 2 ? -26 : FH + 26;
		stretcher = { p, n: 0, from: { x: clamp(p.x, 40, FW - 40), y: side }, after, at: { x: p.x, y: p.y } };
		freeze = 1; freezeKind = "stretcher";
		charging = false;
		caption("Injury", "red", p.name || (p.team === 0 ? "Your player" : opp.short), `${p.injInfo ? cap(p.injInfo.type) : "Injured"} · stretchered off`, p.team);
		$("announce").textContent = `${p.name || "A player"} is hurt. The stretcher is coming on.`;
		if (typeof crowdReact === "function") { crowdReact("near", 1 - p.team); }
	}
	const STRETCH_T = [ 70, 40, 90 ];   // jog on, lift, carry off
	function stretcherPos () {
		const s = stretcher;
		if (!s) { return null; }
		const n = s.n, [ a, b, c ] = STRETCH_T;
		const lerp = (u, v, k) => ({ x: u.x + (v.x - u.x) * k, y: u.y + (v.y - u.y) * k });
		if (n < a) { return { ...lerp(s.from, s.at, n / a), carry: false }; }
		if (n < a + b) { return { ...s.at, carry: n > a + b * 0.5 }; }
		return { ...lerp(s.at, s.from, Math.min(1, (n - a - b) / c)), carry: true };
	}
	function stepStretcher () {
		const s = stretcher;
		if (!s) { freeze = 0; return; }
		s.n++;
		if (players.includes(s.p)) { s.p.fall = Math.max(s.p.fall || 0, 20); s.p.vx = s.p.vy = 0; const q = stretcherPos(); if (q && q.carry) { s.p.x = q.x; s.p.y = clamp(q.y, -20, FH + 20); } }
		if (s.n < STRETCH_T[0] + STRETCH_T[1] + STRETCH_T[2]) { return; }
		stretcher = null;
		const p = s.p;
		p.x = s.at.x; p.y = s.at.y; p.fall = 0;
		injuredOff(p);
		freeze = 40; freezeKind = "free";
		if (s.after) { s.after(); }
	}
	// Off he goes: a substitute comes on if there's one left, otherwise his side plays a man short.
	function injuredOff (p) {
		if (!players.includes(p)) { return; }
		if (p.team === 1) {
			if (cpuSubs > 0) { cpuSub(p, p.role, "injured"); p.x = clamp(p.x, 12, FW - 12); p.y = clamp(p.y, 12, FH - 12); return; }
		} else if (subsLeft > 0 && !tut) {
			const pool = subPool(), pick = pool.filter(pl => pl.pos === p.role).sort((a, b) => ovrNow(b) - ovrNow(a))[0] || pool.sort((a, b) => ovrNow(b) - ovrNow(a))[0];
			if (pick) { makeSub(p, pick); p.x = clamp(p.x, 12, FW - 12); p.y = clamp(p.y, 12, FH - 12); toast("Change made for the injury", "#7fd49b"); return; }
		}
		// Nobody left to bring on: down to ten (or fewer).
		const i = players.indexOf(p), cur = players[ctrl];
		if (ball.owner === p) { ball.owner = null; }
		if (receiver === p) { receiver = null; }
		players.splice(i, 1);
		dismissed.push([ p.team, p.idx ]);
		ctrl = players.indexOf(cur);
		if (ctrl < 0) { const mates = outfield(0); ctrl = players.indexOf(mates[0]); }
		toast(`${p.team === 0 ? "You're" : `${opp.short} are`} down to ${team(p.team).length}`, "#de4f5a");
	}
	let matchCards = [];      // { sqi, kind: "y" | "r2" | "r" } for your players this match
	let dismissed = [];       // [ team, idx ] of everyone sent off this match
	// Substitutions: five changes a match. Who has come on and gone off (by name), and
	// the computer's own changes, which it only makes for injuries.
	const SUBS_MAX = 5;
	let subLog = [];   // [ idx, name ] of each change, so a refreshed match keeps them
	// What happened, minute by minute: { min, team, kind, text }. Goals for your players by name.
	let matchLog = [], matchGoals = [];
	const minuteNow = () => clamp(Math.ceil((1 - timeLeft / Math.max(1, matchLen)) * 90), 1, 90);
	const logEvent = (team, kind, text, min = minuteNow()) => { matchLog.push({ min, team, kind, text }); };
	let subsLeft = SUBS_MAX, cpuSubs = SUBS_MAX, cameOn = [], wentOff = [], subPick = {}, genericBench = null;
