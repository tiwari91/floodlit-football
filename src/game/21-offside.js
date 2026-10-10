	/* ---------- offside ----------
	   Eleven-a-side only. When a player kicks the ball, any teammate who is in the
	   opponents' half and nearer their goal line than both the ball and the
	   second-last opponent is in an offside position. If one of them is the next
	   to touch it (before an opponent does), it is offside: a free kick to the
	   defenders from that spot. */
	let offside = { team: -1, set: new Set() };
	// Offside is played in every format unless you switch it off with the Offside button.
	let offsideRule = true;
	const offsideOn = () => offsideRule && !shoot;
	// The deepest line an attacker of `t` may stand level with.
	function offsideLine (t) {
		const opp = players.filter(q => q.team !== t).map(q => rel(t, q.x)).sort((a, b) => b - a);
		const second = opp.length > 1 ? opp[1] : FW;
		return Math.max(second, rel(t, ball.x), FW / 2);   // in "distance from own goal" terms
	}
	const isOffside = (p, line) => rel(p.team, p.x) > line + 2;

	function markOffside (kicker) {
		offside = { team: kicker.team, set: new Set(), margin: new Map(), line: 0 };
		if (!offsideOn() || (setPiece && setPiece.taker === kicker)) { return; }   // no offside from a corner or a throw-in
		const line = offsideLine(kicker.team);
		offside.line = line;
		for (const m of players) {
			if (m.team !== kicker.team || m === kicker || m.role === "gk") { continue; }
			if (isOffside(m, line)) { offside.set.add(m); }
			// Anyone within a stride of the line, either side of it, is a tight call if he gets the ball.
			const d = rel(m.team, m.x) - line;
			if (d > -9 && d < 13) { offside.margin.set(m, { d, x: m.x, y: m.y }); }
		}
	}
	// A tight call: the picture freezes on the moment, the line goes across the pitch and the
	// officials check it before the decision (offside, with a flag and a whistle, or play on).
	let review = null;
	const cm = d => `${Math.max(2, Math.round(Math.abs(d) * 6.2))} cm`;
	function startReview (p, off, mg) {
		review = { p, off, d: mg.d, team: p.team, lineX: p.team === 0 ? offside.line : FW - offside.line, n: 0 };
		freeze = 84; freezeKind = "review";
		charging = false;
		tally.tight++;
		caption("Tight call", "review", "Checking offside", `${p.name || teamName(p.team)} · ${minuteNow()}'`, p.team);
		banner.textContent = "Checking…"; banner.className = "banner call " + (p.team === 0 ? "home" : "away"); banner.hidden = false;
		$("announce").textContent = "A tight call: the officials are checking offside.";
		if (typeof crowdReact === "function") { crowdReact("near", p.team); }
	}
	function finishReview () {
		const r = review;
		review = null;
		banner.hidden = true;
		if (!r) { return; }
		if (r.off && players.includes(r.p)) {
			callOffside(r.p);
			caption("Offside", "review", `By ${cm(r.d)}`, `${r.p.name || teamName(r.p.team)} was beyond the line`, r.p.team);
		} else {
			caption("Onside", "review", "Play on", `Level by ${cm(r.d)}`, r.team);
			showFoulNote("Onside: play on", r.team);
		}
	}

	let freezeKind = "kickoff";
	let homeSide = 0;      // which team is at home: 0 you, 1 them
	// Team mentality, -1 defensive .. 2 all-out attack, per team. You set yours; the CPU sets its own.
	const MENTALITY = [ "Defensive", "Balanced", "Attacking", "All-out attack" ];
	let mentality = [ 0, 0 ];
	// Team instructions, per team: how you play with the ball, and how you defend without it.
	const STYLES = { possession: "Possession", balanced: "Balanced", direct: "Direct", counter: "Counter-attack" };
	const PRESSES = { high: "High press", mid: "Mid block", low: "Low block" };
	const AUTO_SWITCH = { assisted: "Auto switch: assisted", manual: "Auto switch: manual only", aggressive: "Auto switch: aggressive" };
	let style = [ "balanced", "balanced" ], press = [ "mid", "mid" ], line = [ "normal", "normal" ], tackling = [ "normal", "normal" ];
	const LINES = { high: "High line", normal: "Normal line", deep: "Deep line" };
	const TACKLING = { careful: "Stay on feet", normal: "Normal tackling", hard: "Get stuck in" };
	// How much a side's tackling instruction changes its challenges: tackles won, slides tried, fouls given away.
	const TACKLE_FX = { careful: { win: 0.85, slide: 0.4, foul: 0.5 }, normal: { win: 1, slide: 1, foul: 1 }, hard: { win: 1.25, slide: 1.9, foul: 1.8 } };
	const LINE_UP = { high: 70, normal: 0, deep: -75 };
	// Your instructions from the pickers; anything unrecognised falls back to the defaults.
	function readInstructions () {
		style[0] = STYLES[styleSel.value] ? styleSel.value : "balanced";
		press[0] = PRESSES[pressSel.value] ? pressSel.value : "mid";
		line[0] = LINES[$("line").value] ? $("line").value : "normal";
		tackling[0] = TACKLING[$("tackling").value] ? $("tackling").value : "normal";
	}
	// The computer's formation follows how it plays, and is never the same as yours.
	const CPU_SHAPES = {
		"11": { possession: "4231", balanced: "442", direct: "442", counter: "451", press: "433" },
		"6": { possession: "131", balanced: "221", direct: "212", counter: "311", press: "212" },
		"5": { possession: "121", balanced: "211", direct: "22", counter: "31", press: "22" }
	};
	function cpuShapeKey () {
		const table = CPU_SHAPES[fmtKey];
		let key = press[1] === "high" && style[1] !== "possession" ? table.press : table[style[1]];
		if (key === teamShape[0]) {
			// Don't mirror you: take the nearest alternative.
			const others = Object.keys(SHAPES[fmtKey]).filter(k => k !== teamShape[0]);
			key = others.includes(table.balanced) && table.balanced !== teamShape[0] ? table.balanced : others[0];
		}
		return key;
	}

	// Each computer club's way of playing follows its strength: the best keep the ball and
	// press high; the weakest sit deep and go direct or counter.
	function cpuInstructions (clubId, str) {
		const pick = arr => arr[clubId % arr.length];
		if (str >= 4.5) { return [ "possession", "high" ]; }
		if (str >= 3.5) { return [ pick([ "possession", "balanced", "direct" ]), pick([ "high", "mid", "high" ]) ]; }
		if (str >= 2.5) { return [ pick([ "balanced", "direct", "counter", "possession" ]), pick([ "mid", "mid", "low", "high" ]) ]; }
		return [ pick([ "direct", "counter" ]), pick([ "low", "mid" ]) ];
	}
	// Re-form a side on the pitch: the same players take the new formation's positions
	// (deepest to deepest, left to right), with the roles and costs that go with them.
	function reshape (t, key) {
		const sh = SHAPES[fmtKey] && SHAPES[fmtKey][key];
		if (!sh || sh.pos.length !== N) { return; }
		const order = r => ({ gk: 0, def: 1, mid: 2, fwd: 3 }[r]);
		const mine = players.filter(q => q.team === t).sort((a, b) => order(a.role) - order(b.role) || a.by - b.by);
		const spots = sh.pos.map((q, k) => ({ q, k })).sort((a, b) => order(a.q[1]) - order(b.q[1]) || a.q[3] - b.q[3]);
		const club = league && league.club;
		mine.forEach((p, i) => {
			const q = spots[i].q;
			p.role = q[1];
			p.bx = t === 0 ? q[2] * FW : FW - q[2] * FW;
			p.by = q[3] * FH;
			p.cam = sh.cam !== null && q[0] === sh.cam;
			p.tx = undefined;
			if (t === 0 && club && Number.isInteger(p.sqi)) { p.attr = effective(club.squad[p.sqi], p.role); }
		});
		teamShape[t] = key;
	}
	let teamShape = [ null, null ];

	function setMentality (t, m, announce = true) {
		m = clamp(Math.round(m), -1, 2);
		if (mentality[t] === m) { return; }
		mentality[t] = m;
		// "Auto" formation follows the tactic; the computer always does.
		if ((t === 1 || shapePref[fmtKey] === "auto") && AUTO_SHAPE[fmtKey]) {
			const key = AUTO_SHAPE[fmtKey][m + 1];
			if (key !== teamShape[t]) { reshape(t, key); if (announce && t === 0) { toast(`${SHAPES[fmtKey][key].label.split(" ")[0]} · ${MENTALITY[m + 1]}`, "#f2b52e"); return; } }
		}
		if (announce) { toast(t === 0 ? `Tactic: ${MENTALITY[m + 1]}` : `${opp.short} go ${MENTALITY[m + 1].toLowerCase()}`, t === 0 ? "#f2b52e" : textFor(KITS[1].outfield)); }
	}
	let crowdHeat = 0, crowdTense = 0, crowdHush = 0, lateHold = 0;   // crowdHush: frames the home end stays stunned after conceding     // 0 quiet .. 1 on its feet; how nervous the home end is   // what a freeze is for: a kickoff countdown, or a free kick
	function callOffside (p) {
		const spot = { x: clamp(p.x, 20, FW - 20), y: clamp(p.y, 20, FH - 20) };
		raiseFlag(p.x, "off");
		offside = { team: -1, set: new Set() };
		tally.offsides[p.team]++;
		const defs = players.filter(q => q.team !== p.team && q.role !== "gk");
		const taker = defs.reduce((a, b) => (dist(a, spot) < dist(b, spot) ? a : b));
		taker.dir = taker.team === 0 ? 0 : Math.PI;
		for (const q of players) { q.lunge = 0; }
		awardFreeKick(taker.team, taker, { taker, spot, indirect: true, quiet: true });
		freeze = 60;
		banner.textContent = "Offside";
		banner.className = "banner call " + (p.team === 0 ? "away" : "home");
		banner.hidden = false;
		setTimeout(() => { if (banner.textContent === "Offside") { banner.hidden = true; } }, 1100);
		$("announce").textContent = `Offside against ${p.team === 0 ? "you" : opp.name}. Indirect free kick.`;
		snapshotPrev();
	}

	// The kicking leg: back, through the ball, and a follow-through that's bigger on a shot.
	const KICK_T = 16;
	function kickSwing (p) {
		if (!(p.kickA > 0)) { return null; }
		const t = 1 - p.kickA / KICK_T, pow = p.kickPow || 0.5;
		const s = t < 0.18 ? -0.35 - 0.45 * pow + (t / 0.18) * (0.75 + 0.45 * pow) : t < 0.55 ? 0.4 + (t - 0.18) / 0.37 * (0.3 + 0.8 * pow) : (0.7 + 0.8 * pow) * (1 - (t - 0.55) / 0.45);
		return { s, bend: t < 0.18 ? 1.1 * (1 - t / 0.18) : 0.1 + 0.3 * Math.max(0, t - 0.55) };
	}

	function kick (p, tx, ty, speed, snd = "kick") {
		lastTouch = p.team;
		markOffside(p);
		if (p.team === 1) { switchCd = 0; }
		const dx = tx - ball.x, dy = ty - ball.y, d = Math.hypot(dx, dy) || 1;
		ball.owner = null;
		ball.vx = dx / d * speed;
		ball.vy = dy / d * speed;
		ball.z = 0; ball.vz = 0;
		ball.beaten = null;
		ball.pen = null;
		// The first kick after a restart is the restart: an indirect free kick has to touch someone else before it can count.
		ball.from = deadBall && deadBall.taker === p ? deadBall.kind : null;
		ball.indirect = deadBall && deadBall.taker === p && deadBall.indirect ? p : null;
		deadBall = null;
		ball.dipG = 0;
		ball.lift = false;
		ball.headed = false;
		ball.shot = false;
		ball.curlT = 0; ball.landT = 0;
		ball.lastBy = p;
		ball.kickedAt = frame;
		p.kickCd = 20;
		p.dir = Math.atan2(dy, dx);
		if (!(p.jump > 0)) { p.kickA = KICK_T; p.kickPow = clamp((speed - 5) / 9, 0.25, 1); }
		sfx(snd, { pow: clamp((speed - 4) / 12, 0, 1), x: ball.x, y: ball.y });
	}

	function passTo (p, m) {
		notePass(p);
		// A rattled side's passes stray (yours a little, the computer-run ones more).
		const err = Math.max(0, p.team === 0 && players.indexOf(p) === ctrl ? passErr(p) : (45 * edge(1 - p.team) + cond.wet * 8 + 30 * Math.max(0, 0.75 - staOf(p)) + 18 * wobble(p.team)) * (tr(p, "playmaker") ? 0.55 : 1) * (p.team === 1 ? lv.pass : 1) + (p.team === 1 ? lv.passAdd : 0));
		const lx = m.x + m.vx * 10 + (Math.random() * 2 - 1) * err;
		const ly = m.y + m.vy * 10 + (Math.random() * 2 - 1) * err;
		const d = Math.hypot(lx - ball.x, ly - ball.y);
		// Your passes are zipped in a little firmer, so they beat the man in between.
		const firm = p.team === 0 ? 1.18 : 1;
		kick(p, lx, ly, clamp((d / 58 + 1.6) * cond.passComp * firm * passMul(), 4.2, 19));
	}

	// Lofted ball that comes down on (tx, ty): over any defender in the lane.
	// bow: how far it bends off the straight line mid-flight (+ to the left of its path), the bend
	// solved so that it still comes down on (tx, ty). hang: more or less time in the air.
	function loftTo (p, tx, ty, bow = 0, hang = 1) {
		notePass(p);
		const d = Math.hypot(tx - ball.x, ty - ball.y);
		if (passPow >= 0) { hang *= 1.2 - passPow * 0.4; }   // a charged loft: soft floats, full is driven flatter
		const T = Math.round(clamp(d / 9, 24, 70) * hang);     // frames in the air
		kick(p, tx, ty, d * (1 - AIR_DRAG) / (1 - Math.pow(AIR_DRAG, T)));
		ball.vz = GRAV * T / 2;
		setCurl(T, bow);
		ball.landX = clamp(tx, 12, FW - 12);
		ball.landY = clamp(ty, 12, FH - 12);
		ball.landT = T;
		if (Math.abs(p.y - FH / 2) > FH * 0.2 && rel(p.team, p.x) > FW * 0.62) { tally.crosses[p.team]++; }
	}
	// Swing: a sideways push off the line at the strike, and a steady pull back that brings the
	// ball onto its landing spot after T frames (drag included), so the flight bends like a
	// whipped cross rather than a dart.
	function setCurl (T, bow) {
		if (!bow || T < 4) { return; }
		let s1 = 0, s2 = 0, v1 = 1, v2 = 0;
		for (let k = 0; k < T; k++) { s1 += v1; v1 *= AIR_DRAG; s2 += v2; v2 = (v2 + 1) * AIR_DRAG; }
		const c = 4 * bow / T, a = -c * s1 / Math.max(1e-6, s2);
		const sp = Math.hypot(ball.vx, ball.vy) || 1, nx = -ball.vy / sp, ny = ball.vx / sp;
		ball.vx += nx * c; ball.vy += ny * c;
		ball.cax = nx * a; ball.cay = ny * a; ball.curlT = T;
	}
	// Where (and in how many frames) a ball in the air comes down, flown forward exactly as stepBall flies it.
	function predictLanding () {
		let x = ball.x, y = ball.y, z = ball.z, vx = ball.vx, vy = ball.vy, vz = ball.vz, ct = ball.curlT || 0, k = 0;
		while (k < 160 && (z > 0 || vz > 0)) {
			x += vx; y += vy; z += vz; vz -= GRAV + (ball.dipG || 0);
			if (ct > 0) { vx += ball.cax; vy += ball.cay; ct--; }
			if (cond.wind.s) { const h = Math.min(1, Math.max(0, z) / 30); vx += cond.wind.ax * h; vy += cond.wind.ay * h; }
			vx *= AIR_DRAG; vy *= AIR_DRAG; k++;
		}
		ball.landX = clamp(x, 12, FW - 12); ball.landY = clamp(y, 12, FH - 12); ball.landT = k;
	}
	// A chip: up and over a keeper off his line, dropping under the bar.
	function chipShot (p) {
		const goalX = attackX(p.team), gx = goalX + (goalX === FW ? 20 : -20), sho = A(p, "sho");
		const ty = FH / 2 + (Math.random() * 2 - 1) * FMT.goal * 0.28 + gauss() * Math.max(8, 80 - sho) * 0.45 * GH;
		const D = Math.hypot(gx - ball.x, ty - ball.y);
		const vh = clamp(D / 34, 5.5, 10);
		const T = Math.log(Math.max(0.05, 1 - D * (1 - AIR_DRAG) / vh)) / Math.log(AIR_DRAG);
		const zGoal = clamp(30 + gauss() * (10 + Math.max(0, 70 - sho) * 0.35), 4, 95);
		kick(p, gx, ty, vh);
		ball.shot = true; ball.lift = true;
		ball.vz = (zGoal + 0.5 * GRAV * T * T) / T;
		predictLanding();
		tally.shots[p.team]++;
		if (p.team === 0) { stats.shots++; burst(p.x, p.y, "Chip"); } else { oppStats.shots++; }
		crowdReact("chance", p.team);
	}

	// A point in the space ahead of a runner, toward the goal they attack.
	function leadPoint (p, m) {
		const gx = attackX(m.team) - m.x, gy = FH / 2 - m.y, gd = Math.hypot(gx, gy) || 1;
		const lead = clamp(dist(p, m) * 0.22, 70, 200);
		return [ clamp(m.x + gx / gd * lead, 40, FW - 40), clamp(m.y + gy / gd * lead, 40, FH - 40) ];
	}

	function shootAt (p, power01, aimY) {
		if (p.team === 1) { oppStats.shots++; }
		tally.shots[p.team]++;
		crowdReact("chance", p.team);
		const gx = p.team === 0 ? FW + 20 : -20;
		kick(p, gx, aimY, 9.5 + power01 * 8.5);
		ball.shot = true;
	}

	const openness = m => Math.min(...players.filter(q => q.team !== m.team).map(q => dist(q, m)));

