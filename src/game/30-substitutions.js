	/* ---------- substitutions ---------- */
	// Who can come on: squad players not starting in this format and the bench, less
	// anyone injured, banned, already on or already taken off.
	function subPool () {
		const c = league && league.club;
		const onNow = new Set(team(0).map(p => p.name));
		let pool;
		if (c) {
			const start = new Set(slotsFor(fmtKey));
			pool = [ ...c.squad.filter((pl, i) => !start.has(i)), ...c.bench ];
		} else {
			genericBench = genericBench || BENCH_POS.map(pos => genPlayer(pos, 64));
			pool = genericBench;
		}
		return pool.filter(pl => !onNow.has(pl.name) && !wentOff.includes(pl.name) && !(pl.inj > 0) && !(pl.ban > 0));
	}

	function makeSub (p, pl, quiet = false) {
		if (subsLeft <= 0 || !players.includes(p) || p.team !== 0) { return; }
		wentOff.push(p.name);
		cameOn.push(pl.name);
		subLog.push([ p.idx, pl.name ]);
		const out = p.name;
		logEvent(0, "sub", `${pl.name} on for ${out}`);
		p.name = pl.name;
		p.attr = effective(pl, p.role);
		p.injured = false; p.yellow = 0; p.sqi = null;
		p.sta = clamp(fitOf(pl) / 100, 0.5, 1); p.nudged = false; p.endure = endureOf(pl);
		if (typeof ensureTraitP === "function") { ensureTraitP(p, pl); }
		subsLeft--;
		if (!quiet) {
			burst(p.x, p.y, "Sub on");
			caption("Substitution", "sub", pl.name, `On for ${out} · ${minuteNow()}'`, 0);
			subBoard(0, p);
			$("announce").textContent = `Substitution: ${pl.name} on for ${out}.`;
		}
		updateSubsBtn();
		saveLive();
	}

	// The computer's bench: three windows in the second half. Tired or limping men come off; a side
	// chasing the game sends on a forward for a tired defender or midfielder.
	function cpuSubCheck () {
		if (tut || shoot || mode === "tutorial" || cpuSubs <= 0 || state !== "play") { return; }
		const f = 1 - timeLeft / Math.max(1, matchLen), wins = [ 0.58, 0.7, 0.8 ];
		if (cpuSubWin >= wins.length || f < wins[cpuSubWin]) { return; }
		const lim = [ 0.74, 0.68, 0.64 ][cpuSubWin];
		cpuSubWin++;
		const chasing = score[1] < score[0] && f > 0.65;
		const cands = outfield(1).filter(p => ball.owner !== p && !(setPiece && setPiece.taker === p) && (p.injured || staOf(p) < lim)).sort((a, b) => (b.injured ? 1 : 0) - (a.injured ? 1 : 0) || staOf(a) - staOf(b));
		if (chasing && !cands.length) { const m = outfield(1).filter(p => p.role !== "fwd" && ball.owner !== p).sort((a, b) => staOf(a) - staOf(b))[0]; if (m) { cands.push(m); } }
		for (const p of cands.slice(0, Math.min(cpuSubs, cpuSubWin === 3 ? 1 : 2))) { cpuSub(p, chasing && p.role !== "fwd" ? "fwd" : p.role, p.injured ? "injured" : chasing && p.role !== "fwd" ? "chasing the game" : "tired"); }
	}
	function cpuSub (p, kind, why) {
		const was = p.name, np = genPlayer(kind, cpuOvr(clamp(Math.round(oppStrength), 1, 5)) - 2);
		p.name = np.name; p.attr = { pac: np.pac, sho: np.sho, pas: np.pas, def: np.def };
		p.sta = 1; p.injured = false; p.yellow = 0; p.nudged = false;
		if (typeof ensureTraitP === "function") { ensureTraitP(p, np); }
		cpuSubs--;
		logEvent(1, "sub", `${np.name} on for ${was || "a tired man"}`);
		caption("Substitution", "sub", np.name, `${opp.short} · off: ${was || "?"} (${why})`, 1);
		subBoard(1, p);
	}
	// When one of yours is running on empty (or limping), say so once and point at the pause card.
	function tiredNudge () {
		if (tut || shoot || mode === "tutorial" || subsLeft <= 0 || state !== "play" || autoPilot) { return; }
		for (const q of players) {
			if (q.role !== "gk" && !q.injured && staOf(q) < 0.4 && Math.random() < 0.0012) { noteInjury(q, rollInjury(false)); burst(q.x, q.y, "Pulled up"); if (q.team === 0) { toast(`${q.name || `No. ${q.num}`} has pulled up: sub him from Pause`, "#de4f5a"); } updateSubsBtn(); }
		}
		const p = team(0).find(q => q.role !== "gk" && !q.nudged && staOf(q) < TIRED_STA - 0.05);
		if (p) { p.nudged = true; toast(`${p.name || `No. ${p.num}`} is tiring: sub from Pause`, "#f2b52e"); updateSubsBtn(); }
	}

	function updateSubsBtn () {
		const b = $("subsBtn");
		if (!b) { return; }
		b.hidden = mode === "tutorial";
		b.textContent = `Subs (${subsLeft})`;
		b.classList.toggle("alert", subsLeft > 0 && players.some(p => p.team === 0 && (p.injured || (p.role !== "gk" && staOf(p) < TIRED_STA))));
	}

	const ovCard = () => (ovTitle.closest ? ovTitle.closest(".card") : null);
	function openSubs () {
		if (tut || mode === "tutorial") { return; }
		if (state === "play") { pause(); }
		if (state !== "paused" && state !== "half") { return; }
		subPick = {};
		ovCard()?.classList.toggle("wide", true);
		$("subPanel").hidden = false;
		$("ovSubs").hidden = true;
		renderSubs();
	}

	function closeSubs () {
		$("subPanel").hidden = true;
		ovCard()?.classList.toggle("wide", false);
		$("ovSubs").hidden = false;
		ovButton.focus?.();
	}

	function renderSubs () {
		const box = $("subPanel");
		box.replaceChildren();
		box.append(el("h3", "", `Substitutions · ${subsLeft} of ${SUBS_MAX} left`));
		const cols = el("div", "subcols"), offCol = el("div", "subcol"), onCol = el("div", "subcol");
		offCol.append(el("h4", "", "Take off"));
		const mine = team(0).slice().sort((a, b) => ({ gk: 0, def: 1, mid: 2, fwd: 3 }[a.role] - { gk: 0, def: 1, mid: 2, fwd: 3 }[b.role]));
		for (const p of mine) {
			const b = el("button");
			b.type = "button";
			b.setAttribute("aria-pressed", String(subPick.off === p));
			const tired = p.role !== "gk" && staOf(p) < TIRED_STA;
			const left = el("span", p.injured ? "hurt" : tired ? "tired" : "", `${p.injured ? "✚ " : tired ? "▽ " : ""}${p.name || "Player"}`);
			b.append(left, el("small", "", `${POS_LABEL[p.role] || ""}${p.trait ? ` · ${traitName(p.trait)}` : ""} · ${Math.round(staOf(p) * 100)}% legs${p.yellow ? " · booked" : ""}${p.injured ? " · injured" : tired ? " · tired" : ""}`));
			b.addEventListener("click", () => { subPick.off = subPick.off === p ? null : p; renderSubs(); });
			offCol.append(b);
		}
		onCol.append(el("h4", "", "Bring on"));
		const pool = subPool();
		for (const pl of pool) {
			const b = el("button");
			b.type = "button";
			b.setAttribute("aria-pressed", String(subPick.on === pl));
			b.append(el("span", "", pl.name), el("small", "", `${POS_LABEL[pl.pos]} · ${ovrNow(pl)}${traitOf(pl) ? ` · ${traitName(traitOf(pl))}` : ""} · ${fitOf(pl)}%`));
			b.addEventListener("click", () => { subPick.on = subPick.on === pl ? null : pl; renderSubs(); });
			onCol.append(b);
		}
		if (!pool.length) { onCol.append(el("p", "sub-note", "Nobody left to bring on.")); }
		cols.append(offCol, onCol);
		box.append(cols);
		const note = subsLeft <= 0 ? "No changes left this match."
			: subPick.off && subPick.on ? `${subPick.on.name} on for ${subPick.off.name}.`
			: "Pick a player to take off and one to bring on.";
		box.append(el("p", "sub-note", note));
		const acts = el("div", "sub-actions"), go = el("button", "primary", "Make the change"), done = el("button", "", "Done");
		go.type = done.type = "button";
		go.disabled = !(subPick.off && subPick.on && subsLeft > 0);
		go.addEventListener("click", () => { makeSub(subPick.off, subPick.on); subPick = {}; renderSubs(); });
		done.addEventListener("click", closeSubs);
		acts.append(go, done);
		box.append(acts);
	}

	function showFoulNote (text, forTeam) {
		banner.textContent = text;
		banner.className = "banner note " + (forTeam === 0 ? "home" : "away");
		banner.hidden = false;
		setTimeout(() => { if (banner.textContent === text) { banner.hidden = true; } }, 2200);
	}

	// 9.15 m, to scale: about 148 px on the full-size pitch, less on the small ones.
	const fkDist = () => FW * 0.087;
	function awardFreeKick (t, vic, opt = {}) {
		const taker = opt.taker || (vic.injured ? outfield(t).filter(q => q !== vic).reduce((a, b) => (dist(a, vic) < dist(b, vic) ? a : b)) : vic);
		const spot = opt.spot || { x: clamp(vic.x, 20, FW - 20), y: clamp(vic.y, 20, FH - 20) };
		taker.x = spot.x; taker.y = spot.y;
		taker.dir = Math.atan2(FH / 2 - spot.y, attackX(t) - spot.x);
		const R = fkDist();
		// In range of goal, the defenders build a wall 9.15 m out, on the line to goal.
		const gx = attackX(t), gd = Math.hypot(gx - spot.x, FH / 2 - spot.y);
		let wall = null;
		if (gd < FW * 0.36 && gd > R + 20) {
			const ux = (gx - spot.x) / gd, uy = (FH / 2 - spot.y) / gd, n = N === 11 ? 4 : 2;
			const men = outfield(1 - t).sort((a, b) => dist(a, spot) - dist(b, spot)).slice(0, n);
			wall = men.map((q, i) => {
				const off = (i - (n - 1) / 2) * 17;
				return { p: q, x: clamp(spot.x + ux * R - uy * off, 12, FW - 12), y: clamp(spot.y + uy * R + ux * off, 12, FH - 12) };
			});
			for (const w of wall) { w.p.x = w.x; w.p.y = w.y; w.p.vx = w.p.vy = 0; w.p.dir = Math.atan2(-uy, -ux); }
		}
		// In range, a teammate stands beside the ball for the lay-off (S): square, for a shot.
		let layoff = null;
		if (wall) {
			const ux = (gx - spot.x) / gd, uy = (FH / 2 - spot.y) / gd, side = spot.y < FH / 2 ? 1 : -1;
			const mate = outfield(t).filter(q => q !== taker && !(wall.some(w => w.p === q))).sort((a, b) => dist(a, spot) - dist(b, spot))[0];
			if (mate) {
				layoff = { p: mate, x: clamp(spot.x - uy * side * 46 - ux * 8, 14, FW - 14), y: clamp(spot.y + ux * side * 46 - uy * 8, 14, FH - 14) };
				mate.x = layoff.x; mate.y = layoff.y; mate.vx = mate.vy = 0; mate.dir = Math.atan2(FH / 2 - mate.y, gx - mate.x);
			}
		}
		for (const q of players) {
			if (q.team === t || (wall && wall.some(w => w.p === q))) { continue; }
			const d = dist(q, taker);
			if (d < R) { q.x = clamp(taker.x + (q.x - taker.x) / (d || 1) * R, 12, FW - 12); q.y = clamp(taker.y + (q.y - taker.y) / (d || 1) * R, 12, FH - 12); }
		}
		setPieceStart(taker, 55);
		setPiece = { kind: "free", team: t, taker, wall, spot: { ...spot }, indirect: !!opt.indirect, layoff };
		deadBall = { kind: "free", taker, indirect: !!opt.indirect };
		tally.fks[t]++;
		if (!opt.quiet) { restartBanner(opt.indirect ? "Indirect free kick" : "Free kick", t); }
	}

	function awardPenalty (t, vic) {
		const gx = attackX(t), inward = gx === FW ? -1 : 1;
		// The best finisher on the pitch takes it.
		const taker = outfield(t).filter(q => !q.injured || (q === vic && !(q.injInfo && q.injInfo.serious))).reduce((a, b) => (A(a, "sho") >= A(b, "sho") ? a : b));
		taker.x = gx + inward * FMT.spot; taker.y = FH / 2;
		taker.dir = inward === -1 ? 0 : Math.PI;
		const gk = team(1 - t).find(q => q.role === "gk");
		if (gk) { gk.x = gx + inward * 8; gk.y = FH / 2; gk.vx = gk.vy = 0; }
		// Everyone else outside the area and behind the ball.
		const edge = FMT.box + 70;
		for (const q of players) {
			if (q === taker || q === gk) { continue; }
			if (Math.abs(q.x - gx) < edge) { q.x = gx + inward * (edge + 10 + Math.random() * 40); }
		}
		setPieceStart(taker, 70);
		setPiece = { kind: "pen", team: t, taker };
		deadBall = { kind: "pen", taker };
		tally.pens[t]++;
		restartBanner("Penalty", t);
		if (t === 1) { ooh(); }
	}

	// A free kick lifted over the wall: it has to clear heads at 9.15 m and dip under the bar.
	// Up or down picks the corner (the far post if you don't); better finishers get it right more often.
	function liftShot (p) {
		setPiece = null;
		const goalX = attackX(p.team), gx = goalX + (goalX === FW ? 20 : -20), sho = A(p, "sho");
		const lean = p.team === 0 && Math.abs(stickVec.y) > 0.2 ? Math.sign(stickVec.y) : ball.y < FH / 2 ? 1 : -1;
		const miss = Math.max(0, 72 - sho) * 0.8 + 30;
		const ty = FH / 2 + lean * FMT.goal * 0.27 + (Math.random() * 2 - 1) * miss * GH;
		const D = Math.hypot(goalX - ball.x, ty - ball.y);
		const vh = clamp(D / 30, 8.5, 15);
		const T = Math.log(Math.max(0.05, 1 - D * (1 - AIR_DRAG) / vh)) / Math.log(AIR_DRAG);
		// Height as it reaches the goal: under the bar (55) most of the time, over it now and then.
		const zGoal = clamp(38 + gauss() * (13 + Math.max(0, 70 - sho) * 0.3), 6, 90);
		kick(p, gx, ty, vh);
		ball.shot = true;
		// Topspin makes it dip: it rises steeply over the wall and drops faster than gravity alone.
		const dip = GRAV * (0.3 + clamp((sho - 55) / 100, 0, 0.35));
		ball.dipG = dip;
		ball.vz = (zGoal + 0.5 * (GRAV + dip) * T * T) / T;
		// And it curls: out past the end of the wall on the side of the corner it's aimed at, then back in.
		{
			const sp = Math.hypot(ball.vx, ball.vy) || 1, nx = -ball.vy / sp, ny = ball.vx / sp;
			const side = Math.sign((gx - goalX) * nx + (ty - FH / 2) * ny) || (Math.random() < 0.5 ? 1 : -1);
			setCurl(Math.max(4, Math.round(T)), side * clamp(D * 0.07, 12, 42) * (0.75 + sho / 260));
		}
		tally.shots[p.team]++;
		ball.lift = true;   // slower than a driven shot: the keeper has longer to get across
		// On target, the keeper gets across more often than not; into the corner, less so.
		const gk = team(1 - p.team).find(q => q.role === "gk"), off = Math.abs(ty - FH / 2) / (FMT.goal / 2);
		if (gk && off < 1 && zGoal < 56) { ball.pen = { gk, saved: Math.random() < clamp(0.84 - off * 0.28 - (sho - 65) * 0.006, 0.45, 0.9) }; }
		if (p.team === 0) { stats.shots++; burst(p.x, p.y, "Over the wall"); } else { oppStats.shots++; ooh(); }
	}
	function gauss () { let u = 0, v = 0; while (!u) { u = Math.random(); } while (!v) { v = Math.random(); } return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

	// Taking a penalty: side-foot or blast it where you are leaning.
	function takePenalty (p) {
		setPiece = null;
		// You pick a side with up/down (or by where you're facing); no preference picks one for you.
		const pick = () => (Math.random() < 0.2 ? 0 : Math.random() < 0.5 ? -1 : 1);
		const lean = p.team === 0 ? (Math.abs(stickVec.y) > 0.2 ? Math.sign(stickVec.y) : Math.sin(p.dir) > 0.1 ? 1 : Math.sin(p.dir) < -0.1 ? -1 : pick()) : pick();
		// Now and then one is dragged wide of the post or blazed over (less often by a good finisher).
		const miss = Math.random() < clamp(0.08 - (A(p, "sho") - 65) * 0.002, 0.03, 0.12);
		const aim = miss && lean ? FH / 2 + lean * (FMT.goal / 2 + (8 + Math.random() * 18) * GH) : FH / 2 + lean * FMT.goal * (0.3 + Math.random() * 0.12) + (Math.random() * 2 - 1) * 8;
		shootAt(p, 0.8 + Math.random() * 0.2, aim);
		if (miss && !lean) { ball.vz = 6.5 + Math.random() * 2; }
		// The keeper guesses: right way and it's usually saved, wrong way and it's in; down the middle beats a dive.
		const gk = team(1 - p.team).find(q => q.role === "gk");
		if (gk) {
			let guess = Math.random() < 0.3 ? 0 : Math.random() < 0.5 ? -1 : 1;
			// Their penalty: you choose which way your keeper goes with up or down (held as it's struck).
			if (p.team === 1 && !autoPilot) { const inp = humanInput(); if (Math.abs(inp.y) > 0.3) { guess = Math.sign(inp.y); } }
			const saved = !miss && guess === lean ? Math.random() < (lean === 0 ? 0.75 : 0.55) : false;
			ball.pen = { gk, saved };
			if (guess !== 0) { gk.dive = DIVE_T; gk.diveSide = guess * Math.cos(gk.dir) > 0 ? -1 : 1; gk.diveCd = 70; }
		}
		if (p.team === 0) { stats.shots++; burst(p.x, p.y, "Penalty"); } else { oppStats.shots++; ooh(); }
	}

	function awardThrow (t, spotX, top) {
		if (shoot) { shootEnd("Out of play"); return; }
		const spot = { x: clamp(spotX, 20, FW - 20), y: top ? 12 : FH - 12 };
		const taker = outfield(t).reduce((a, b) => (dist(a, spot) < dist(b, spot) ? a : b));
		// Opponents give the thrower room.
		const movers = [];
		for (const q of players) {
			if (q.team === t) { continue; }
			const d = dist(q, spot);
			if (d < 60) { movers.push({ q, x: clamp(spot.x + (q.x - spot.x) / (d || 1) * 60, 12, FW - 12), y: clamp(spot.y + (q.y - spot.y) / (d || 1) * 60, 12, FH - 12) }); }
		}
		setPieceStart(taker, 40);
		setPiece = { kind: "throw", team: t, taker };
		deadBall = { kind: "throw", taker };
		walkToSpot(taker, spot, movers, top ? Math.PI / 2 : -Math.PI / 2, 40);   // facing infield
		restartBanner("Throw-in", t);
	}

	// A throw: short to feet, or long, from the touchline. It's a lob, so it can't be too long.
	function throwIn (p, target, long) {
		const reach = (long ? 330 : 190) * Math.sqrt(S);
		let tx = target ? target.x + target.vx * 8 : p.x, ty = target ? target.y + target.vy * 8 : FH / 2;
		const d = Math.hypot(tx - p.x, ty - p.y);
		if (d > reach) { tx = p.x + (tx - p.x) / d * reach; ty = p.y + (ty - p.y) / d * reach; }
		loftTo(p, tx, ty);
		p.throwA = THROW_T;
		setPiece = null;
	}

	// A keeper plays it out: to the most open teammate who has found space, or long if nobody has.
	function gkDistribute (p) {
		p.holdFor = 0;
		const mates = outfield(p.team).filter(m => dist(m, p) > 90 && !(offsideOn() && isOffside(m, offsideLine(p.team))));
		const m = mates.sort((a, b) => openness(b) - openness(a))[0];
		if (setPiece && setPiece.taker === p) { setPiece = null; }
		if (m && openness(m) > 45) { passTo(p, m); } else if (m) { loftTo(p, m.x + (attackX(p.team) === FW ? 60 : -60), m.y); } else { kick(p, attackX(p.team), FH / 2, 13); }
		if (p.team === 0 && m) { handOff(m, 160); }
	}

	// Taking whatever set piece you are standing over.
	function takeSetPiece (p, long, via) {
		if (setPiece.kind === "pen") { takePenalty(p); return; }
		if (setPiece.kind === "free") {
			// A free kick is open play from a dead ball: S plays it short, Q goes long, D shoots.
			const lay = setPiece.layoff && players.includes(setPiece.layoff.p) ? setPiece.layoff.p : null;
			setPiece = null;
			if (long) { humanLong(); return; }
			const m = lay || passTarget(p);
			if (m) { startPass(p, m, false); } else { kick(p, attackX(p.team), FH / 2, 12); }
			return;
		}
		if (setPiece.kind === "goalkick") {
			// A goal kick: long upfield, or short to the teammate in the ring.
			setPiece = null;
			if (long) { const m = strikerTarget(p); if (m) { const [ lx, ly ] = leadPoint(p, m); loftTo(p, lx, ly); handOff(m, 170); return; } gkDistribute(p); return; }
			const m = passTarget(p);
			if (m) { startPass(p, m, false); } else { gkDistribute(p); }
			return;
		}
		// Corners: S whips an in-swinger at the near post, Q floats an out-swinger to the far post,
		// W drops one on the penalty spot.
		if (setPiece.kind === "corner") { cornerCross(p, null, long ? "far" : via === "through" ? "spot" : "near", long ? "out" : "in"); return; }
		const m = passTarget(p);
		throwIn(p, m, long);
		if (m) { handOff(m, 160); }
	}

	// The zones a corner is aimed at, for the goal at gx (inward points into the pitch, sy is the
	// side the corner is taken from: -1 the top touchline, 1 the bottom).
	function cornerSpots (gx, inward, sy) {
		const b = FMT.box, g = FMT.goal / 2;
		return {
			near: [ gx + inward * b * 0.27, FH / 2 + sy * (g - 8) ],
			far: [ gx + inward * b * 0.33, FH / 2 - sy * (g + 6) ],
			spot: [ gx + inward * FMT.spot, FH / 2 + sy * 8 ],
			six: [ gx + inward * b * 0.42, FH / 2 - sy * 10 ]
		};
	}
	// Taking a corner: a lofted cross into the box. kind: "near" (whipped at the near post), "far"
	// (floated to the back post) or "spot" (the penalty spot); swing: "in" bends towards goal,
	// "out" away from it. Worse passers miss their zone by more.
	function cornerCross (p, target, kind, swing) {
		const leftEnd = p.x < FW / 2, inward = leftEnd ? 1 : -1, gx = leftEnd ? 0 : FW, sy = p.y < FH / 2 ? -1 : 1;
		const Z = cornerSpots(gx, inward, sy);
		kind = Z[kind] ? kind : "spot";
		let [ tx, ty ] = Z[kind];
		const acc = (8 + Math.max(0, 78 - A(p, "pas")) * 0.7) * GH;
		tx += (Math.random() * 2 - 1) * acc; ty += (Math.random() * 2 - 1) * acc;
		swing = swing === "in" || swing === "out" ? swing : Math.random() < 0.6 ? "in" : "out";
		// The bow: an in-swinger bends out over the pitch and curls back towards goal, an out-swinger the other way.
		const dx = tx - ball.x, dy = ty - ball.y, L = Math.hypot(dx, dy) || 1, leftIsPitch = Math.sign(-dy / L) === inward ? 1 : -1;
		// An out-swinger bows towards the goal line: never so far that it goes out of play in the air.
		const room = Math.max(0, inward * ((ball.x + tx) / 2 - gx) - 14);
		const bow = swing === "in" ? leftIsPitch * (kind === "near" ? 22 : 30) * GH : -leftIsPitch * Math.min((kind === "near" ? 16 : 26) * GH, room);
		loftTo(p, tx, ty, bow, kind === "near" ? 0.7 : kind === "far" ? 0.8 : 0.85);
		ball.swing = swing;
		setPiece = null;
		cornerAt[p.team] = frame;
		if (cornerPlan) { cornerPlan.delivered = true; cornerPlan.at = frame; cornerPlan.kind = kind; }
		if (p.team === 0) { burst(p.x, p.y, `${swing === "in" ? "In-swinger" : "Out-swinger"}, ${kind === "near" ? "near post" : kind === "far" ? "far post" : "the spot"}`); }
		// Control goes to the runner who is attacking that zone.
		if (p.team === 0 && cornerPlan) {
			const runners = [ ...cornerPlan.role ].filter(([ q, r ]) => r.kind === "run").map(([ q ]) => q);
			const m = runners.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[0];
			if (m) { handOff(m, 160); }
		}
	}
	// A corner in progress: who runs where, who marks whom, until the ball is won or dies.
	let cornerPlan = null;
	function stepCornerPlan () {
		const cp = cornerPlan;
		if (!cp) { return; }
		const sinceKick = frame - cp.at;
		if (state !== "play" || (!cp.delivered && (!setPiece || setPiece.kind !== "corner")) ||
			(cp.delivered && (ball.owner || sinceKick > 200 || (ball.z <= 0 && ball.vz <= 0 && sinceKick > 20)))) { cornerPlan = null; return; }
		if (!cp.delivered) { return; }
		// Whoever can get to the drop first on each side attacks it.
		const land = { x: ball.landX, y: ball.landY };
		let ba = null, bd = null, da = Infinity, dd = Infinity;
		for (const [ q, r ] of cp.role) {
			if (!players.includes(q)) { continue; }
			const d = dist(q, land);
			if ((r.kind === "run" || r.kind === "edge") && d < da) { da = d; ba = q; }
			if ((r.kind === "mark" || r.kind === "zone") && d < dd) { dd = d; bd = q; }
		}
		cp.attacker = ba; cp.defender = bd;
	}
	function cornerTarget (p) {
		const cp = cornerPlan, r = cp && cp.role.get(p);
		if (!r) { return null; }
		const flying = cp.delivered && !ball.owner;
		if (flying && (cp.attacker === p || cp.defender === p)) { return [ ball.landX - (cp.defender === p ? cp.inward * 8 : 0), ball.landY ]; }
		if (r.kind === "run") { return cp.delivered ? r.aim : r.start; }
		if (r.kind === "mark") {
			const q = r.man, dx = cp.gx - q.x, dy = FH / 2 - q.y, d = Math.hypot(dx, dy) || 1;
			return [ q.x + dx / d * 15, q.y + dy / d * 15 ];
		}
		return r.spot;
	}

	function contest () {
		if (state !== "play") { return; }
		// In the tutorial the other side never takes the ball off you (their keeper still saves).
		if (tut && ball.owner && ball.owner.team === 0) { return; }
		const speed = Math.hypot(ball.vx, ball.vy);
		if (!ball.owner && ball.pen && ball.pen.saved && Math.abs(ball.x - ball.pen.gk.x) < 30) {
			// He guessed right: full stretch, and he holds it.
			const gk = ball.pen.gk;
			gk.y = ball.y; gk.x = ball.x;
			ball.pen = null;
			ooh();
			crowdReact("save", gk.team);
			// Half the time he can only push it back out, and the rebound is anyone's (more so on a wet ball).
			if (Math.random() < 0.42 + 0.5 * (1 - cond.handling)) { spill(gk, "Parried"); return; }
			burst(gk.x, gk.y, "Saved");
			gainBall(gk);
			return;
		}
		if (!ball.owner) {
			if (aerial()) { return; }
			let taker = null, td = Infinity;
			for (const p of players) {
				if (p.kickCd > 0) { continue; }
				const d = dist(p, ball);
				const isGk = p.role === "gk" && rel(p.team, p.x) < 160 * GH;
				const isReceiver = p === receiver;
				// Cutting out one of your passes takes a defender really in the lane.
				const cutIn = receiver && p.team === 1 && speed > 3.5 ? -3 : 0;
				const reach = isGk ? (shotAt(p) ? 28 : 24) * (p.team === 1 ? lv.gk : 1) : isReceiver ? 26 : 19 + cutIn + clamp((A(p, "def") - 65) * 0.12, -3, 4);   // a diving keeper stretches
				if (d > reach || d >= td) { continue; }
				// A ball just struck is past the man closing the kicker down before he can react:
				// pressing you forces a pass, it doesn't win it off your boot.
				if (!isGk && p.team !== lastTouch && speed < 11 && frame - (ball.kickedAt || -99) < 7) { continue; }
				if (ball.z > (isGk ? 45 : 16)) { continue; }   // over their head
				// The intended receiver always controls a firm pass.
				if (speed > 11 && !isReceiver) {
					// Your keeper holds most of what he reaches; theirs is set by the opponent level.
					let save = (p.team === 1 ? diff.save : 0.58 * defMul(p)) * (1 - 0.35 * edge(1 - p.team)) * cond.handling;   // wet balls slip
					// One save attempt per shot: beaten once, the keeper stays beaten for that shot.
					if (isGk) {
						if (ball.lift) { save = Math.min(0.9, save * 1.9); }
						if (ball.headed) { save = Math.min(0.9, save * 1.35); }
						if (ball.pen && ball.pen.gk === p) { if (!ball.pen.saved) { continue; } }
						else if (ball.beaten === p) { continue; }
						if (!(ball.pen && ball.pen.gk === p) && Math.random() > save * 1.6) { ball.beaten = p; continue; }
					}
					else {
						// Outfielders don't catch a hard ball; defenders may get in the way of it.
						if (p.team !== lastTouch && Math.random() < 0.17 * defMul(p)) { blockShot(p); return; }
						continue;
					}
				}
				taker = p; td = d;
			}
			if (taker && taker.role === "gk" && speed > 11) {
				ooh(); ev3d("save", taker.team); crowdReact("save", taker.team); benchReact("near", { team: taker.team });
				// Not every save sticks: a hard shot or a wet ball can be spilled back into play.
				if (Math.random() < 0.1 + (speed > 14 ? 0.06 : 0) + 0.7 * (1 - cond.handling)) { spill(taker, cond.wet ? "Spilled" : "Parried"); return; }
			}
			if (taker) { gainBall(taker); }
			return;
		}
		const o = ball.owner;
		if (inHands(o)) { return; }   // ball in the keeper's hands: nobody can take it
		// Your player gets a moment to take a touch before the computer can nick it,
		// and only one challenger gets a go each step, so two men closing you down
		// don't double the odds.
		const settling = o.team === 0 && frame - (o.gotAt || 0) < 22;
		for (const q of players) {
			if (q.team === o.team || q.kickCd > 0 || q.role === "gk" && rel(q.team, q.x) > 160 * GH) { continue; }
			const isHuman = q.team === 0 && players.indexOf(q) === ctrl;
			const sliding = (isHuman && q.lunge > 0) || q.slideAI > 0;
			// Measure to the ball as well as the carrier: separation keeps bodies 30
			// apart, so a carrier standing still could otherwise never be tackled.
			const near = Math.min(dist(q, o), dist(q, ball) + 6);
			if (near > (sliding ? 28 : 23)) { continue; }
			// Staying tight to the carrier wins the ball back over time; a slide wins it fast.
			let chance = (q.team === 1 ? diff.tackle : isHuman ? (pressHeld || touchPress || padPressBtn ? 0.045 : 0.035) : 0.022) * mood(q.team, 0.4) * defMul(q) * (isHuman ? 1 : TACKLE_FX[tackling[q.team]].win) * (0.8 + 0.2 * staOf(q)) * (wobble(q.team) ? 0.82 : 1);
			if (tr(q, "winner")) { chance *= 1.4; }
			if (tr(o, "target") && !sliding) { chance *= 0.7; }
			if (dist(o, ball) > 27) { chance *= 1.5; }   // a heavy touch: the ball is a step from his feet
			if (sliding) { chance = 0.3 * defMul(q) * (tr(q, "winner") ? 1.2 : 1); }
			if (settling && q.team === 1) { chance *= sliding ? 0.5 : 0.15; }
			const won = Math.random() < chance;
			// A slide that arrives and misses the ball takes the man instead, from behind most of all.
			if (!won && sliding && !q.slideHit) {
				q.slideHit = true;
				const moving = Math.hypot(o.vx, o.vy) > 0.5;
				const behind = moving && Math.cos(Math.atan2(o.y - q.y, o.x - q.x) - Math.atan2(o.vy, o.vx)) > 0.55;
				if (Math.random() < Math.min(0.9, (behind ? 0.6 : q.team === 1 ? 0.22 : 0.14) * (1 + 0.5 * edge(1 - q.team)) * (isHuman ? 1 : Math.sqrt(TACKLE_FX[tackling[q.team]].foul)))) { commitFoul(q, o, behind); return; }
			}
			// A tense defender stands in and sometimes clatters the man instead.
			if (!won && !sliding && !isHuman && Math.random() < (0.0025 * edge(1 - q.team) + (tackling[q.team] === "hard" ? 0.0009 : 0)) * TACKLE_FX[tackling[q.team]].foul) { commitFoul(q, o, false); return; }
			if (!won) { if (q.team === 1) { break; } continue; }
			{
				o.kickCd = 40;
				gainBall(q);
				tallyBy(q, "tackle");
				swing(q.team, 0.08);
				if (isHuman) { burst(q.x, q.y, "Won it"); sfx("tackle"); stats.tackles++; } else if (q.team === 1) { oppStats.tackles++; } else { stats.aiTackles = (stats.aiTackles || 0) + 1; }
				crowdReact("tackle", q.team);
				break;
			}
		}
	}

	// A header at goal: better finishers place it; everyone else just gets it on target, maybe.
	function header (p) {
		const gx = attackX(p.team) + (p.team === 0 ? 20 : -20), sho = A(p, "sho"), z0 = Math.max(6, ball.z);
		// Headers are softer than shots and less accurate: aimed for the side the keeper isn't on,
		// down towards the line, and a poor header of the ball sends it wide or over.
		const gk = team(1 - p.team).find(q => q.role === "gk"), err = clamp(1.45 - sho / 100, 0.5, 1.1);
		const side = gk ? (gk.y < FH / 2 ? 1 : -1) * (Math.random() < 0.8 ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);
		const aimY = FH / 2 + side * FMT.goal * 0.3 + gauss() * FMT.goal * 0.26 * err;
		const sp = 8.4 + sho * 0.035 + Math.random() * 1.5;
		kick(p, gx, aimY, sp, "header");
		const T = Math.max(3, Math.hypot(gx - ball.x, aimY - ball.y) / sp);
		const zt = clamp(18 + gauss() * 26 * err, 1, 95);
		ball.z = z0;
		ball.vz = (zt - z0 + 0.5 * GRAV * T * T) / T;
		ball.headed = true;
		ball.shot = true;
		p.jump = JUMP;
		predictLanding();
		tally.shots[p.team]++; tally.heads[p.team]++;
		if (p.team === 0) { stats.shots++; burst(p.x, p.y, "Header"); } else { oppStats.shots++; }
		crowdReact("chance", p.team);
	}
	// A defensive header: away from goal, high and far.
	function clearance (p) {
		const away = p.team === 0 ? 1 : -1, z0 = Math.max(6, ball.z);
		// Away from goal and out towards the flank the ball came from: never back across the six-yard box.
		const wide = Math.sign(p.y - FH / 2) || (Math.random() < 0.5 ? 1 : -1);
		kick(p, p.x + away * (200 + Math.random() * 120) * Math.sqrt(S), clamp(p.y + wide * (60 + Math.random() * 160), 40, FH - 40), 10 + Math.random() * 3, "header");
		ball.z = z0;
		ball.vz = 3.5 + Math.random() * 1.5;
		ball.headed = true;
		p.jump = JUMP;
		predictLanding();
		tally.clears[p.team]++;
		if (p.team === 0) { burst(p.x, p.y, "Cleared"); }
		crowdReact("clear", p.team);
	}

	// A headed pass, or a flick-on: nodded down to a teammate ahead of him.
	function headPass (p) {
		let best = null, bs = -Infinity;
		for (const m of outfield(p.team)) {
			const d = dist(p, m);
			if (m === p || d < 50 || d > 330) { continue; }
			// Your player heads it where he's facing; the computer picks the man furthest on.
			const s = p.team === 0 && players.indexOf(p) === ctrl
				? Math.cos(Math.atan2(m.y - p.y, m.x - p.x) - p.dir) * 2 - d / 600
				: (rel(p.team, m.x) - rel(p.team, p.x)) / 200 - d / 700 + clamp(openness(m) / 160, 0, 0.6);
			if (s > bs) { bs = s; best = m; }
		}
		if (!best) { clearance(p); return; }
		const d = dist(p, best), err = 14 + (100 - A(p, "pas")) * 0.35;
		const z0 = Math.max(6, ball.z);
		kick(p, best.x + best.vx * 8 + (Math.random() * 2 - 1) * err, best.y + best.vy * 8 + (Math.random() * 2 - 1) * err, clamp(d / 40 + 2.2, 4, 9.5), "header");
		ball.z = z0;
		ball.vz = 1.2;
		predictLanding();
		ball.headed = true;
		p.jump = JUMP;
		if (p.team === 0) { handOff(best, 90); burst(p.x, p.y, "Headed on"); }
	}

	// A ball dropping at head height: the nearest two go up for it, one from each side if
	// they are both close; the better placed (and the better in the air) wins it. The
	// keeper claims it in his own area instead (see contest).
	const JUMP = 22;
	let headIntent = null;   // what you asked your player to do with a ball coming down to him
	const jumpAmt = p => p.jump > 0 ? Math.sin(Math.PI * (1 - p.jump / JUMP)) : 0;
	// A keeper coming for a cross in his area: catch it, punch it clear, or flap at it and miss.
	// Bodies around him make it harder, and so does a wet ball.
	function keeperClaim () {
		if (ball.z > 64 || ball.z < 4 || ball.vz > 1 || ball.shot) { return false; }
		for (const gk of players) {
			if (gk.role !== "gk" || gk.kickCd > 0 || gk.team === lastTouch || dist(gk, ball) > 32) { continue; }
			if (rel(gk.team, gk.x) > FMT.box + 20 || Math.abs(gk.y - FH / 2) > FMT.goal / 2 + FMT.box) { continue; }
			const crowd = players.filter(q => q.team !== gk.team && dist(q, gk) < 26).length;
			const r = Math.random(), catchP = clamp((0.6 + (A(gk, "def") - 65) * 0.012 - crowd * 0.14) * cond.handling * (shoot ? 0.7 : 1), 0.15, 0.9);
			gk.jump = JUMP;
			if (r < catchP) {
				tally.claims[gk.team]++;
				gainBall(gk);
				burst(gk.x, gk.y, "Claimed");
				crowdReact("save", gk.team);
				return true;
			}
			if (r < catchP + (1 - catchP) * 0.6) {
				// A punch: out towards the edge of the box and beyond.
				const away = gk.team === 0 ? 1 : -1, z0 = ball.z;
				kick(gk, gk.x + away * (170 + Math.random() * 120) * Math.sqrt(S), clamp(gk.y + (Math.random() * 2 - 1) * 220, 40, FH - 40), 9 + Math.random() * 3, "header");
				ball.z = z0; ball.vz = 3 + Math.random() * 2; predictLanding();
				tally.punches[gk.team]++;
				burst(gk.x, gk.y, "Punched");
				crowdReact("clear", gk.team);
				return true;
			}
			gk.kickCd = 24;   // he flapped at it and missed: it's anyone's
			crowdReact("chance", 1 - gk.team);
			return false;
		}
		return false;
	}
	function aerial () {
		if (!ball.owner && keeperClaim()) { return true; }
		if (!(ball.z > 8 && ball.z < 50 && ball.vz < 0) || frame - (ball.kickedAt || -99) < 6) { return false; }
		let a = null, b = null, da = Infinity, db = Infinity;
		for (const p of players) {
			if (p.kickCd > 0 || p.jump > 0) { continue; }
			const d = dist(p, ball);
			if (p.role === "gk") { if (d < 30 && rel(p.team, p.x) < FMT.box + 20 && p.team !== lastTouch) { return false; } continue; }
			if (d > 26) { continue; }
			if (d < da) { b = a; db = da; a = p; da = d; } else if (d < db) { b = p; db = d; }
		}
		if (!a) { if (ball.z < 30 && ball.landT < 3) { tally.air.none++; } return false; }
		// Attacking a ball is easier than defending it: the runner knows where he's going.
		const air = (p, d) => (24 - d) * 0.5 + (Math.max(A(p, "def"), A(p, "sho")) - 65) * 0.08 + Math.random() * 6 + (p.team === lastTouch ? (shoot ? 3.5 : 1.5) : 0) + (tr(p, "target") ? 5 : 0);
		let w = a, l = b && b.team !== a.team && db < 28 ? b : null;
		if (l && air(l, db) > air(a, da)) { w = l; l = a; }
		const isYou = w.team === 0 && players.indexOf(w) === ctrl;
		const asked = isYou && headIntent && frame - headIntent.at < 45 ? headIntent.kind : null;
		let act = asked;
		if (!act) {
			const r = Math.random();
			const facing = Math.cos(Math.atan2(FH / 2 - w.y, attackX(w.team) - w.x) - w.dir) > -0.2;
			if (w.team === lastTouch && inAttackBox(w) && rel(w.team, w.x) > FW - FMT.box * 0.95) { act = r < (facing ? 0.5 : 0.28) * (shoot ? 1.3 : 1) ? "goal" : r < 0.75 ? "pass" : null; }
			else if (w.team === lastTouch && inAttackBox(w)) { act = r < 0.18 ? "goal" : r < 0.5 ? "pass" : null; }
			else if (w.team !== lastTouch && inOwnBox(w)) { act = r < (shoot ? 0.6 : 0.82) * defMul(w) ? "clear" : r < 0.92 ? "pass" : null; }
			else { act = r < (w.team !== lastTouch ? 0.35 : 0.12) ? "pass" : null; }
		}
		if (!act) { tally.air.noAct++; return false; }
		if (w.team === lastTouch) { tally.air.attWin++; } else { tally.air.defWin++; }
		tallyBy(w, "air");
		headIntent = null;
		if (l) {
			l.jump = JUMP; l.kickCd = 26;   // beaten in the air, he comes down a step behind
			// Now and then the man who lost it climbs all over the one who won it.
			if (Math.random() < 0.04) { w.jump = JUMP; commitFoul(l, w, false); return true; }
		}
		if (act === "goal") { header(w); } else if (act === "clear") { clearance(w); } else { headPass(w); }
		return true;
	}

	// A block: the ball comes off the defender at an angle, and it's their touch
	// (so if it goes over their own goal line, it's a corner).
	// A keeper's save that doesn't stick: pushed away from goal, live for whoever gets there first.
	function spill (gk, label) {
		slowMotion(45);   // a parry: the moment in slow motion
		const out = gk.team === 0 ? 1 : -1, a = (Math.random() * 2 - 1) * 1.1, sp = 3.2 + Math.random() * 2.8;
		ball.owner = null;
		ball.vx = Math.cos(a) * sp * out; ball.vy = Math.sin(a) * sp;
		ball.z = 0; ball.vz = Math.random() < 0.5 ? 2 + Math.random() * 2 : 0;
		ball.lastBy = gk; ball.kickedAt = frame; ball.shot = false; ball.indirect = null; ball.pen = null; ball.beaten = gk;
		lastTouch = gk.team;
		offside = { team: -1, set: new Set() };
		gk.kickCd = 35;
		tally.spills[gk.team]++;
		burst(gk.x, gk.y, label);
		sfx("kick");
	}

	function blockShot (p) {
		if (rel(p.team, p.x) < 40 * GH && Math.abs(p.y - FH / 2) < FMT.goal * 0.7) { slowMotion(45); }   // cleared off the line
		ball.vx = -ball.vx * (0.2 + Math.random() * 0.25);
		ball.vy = ball.vy * 0.4 + (Math.random() * 2 - 1) * 3.5;
		ball.z = 0; ball.vz = Math.random() < 0.4 ? 2.5 : 0;
		lastTouch = p.team;
		offside = { team: -1, set: new Set() };
		ball.indirect = null; ball.from = null;
		p.kickCd = 12;
		sfx("kick");
		if (p.team === 0) { burst(p.x, p.y, "Blocked"); } else { ooh(); }
	}

	function gainBall (p) {
		const lostBy = p.team !== possTeam ? possTeam : -1;
		// First touch by a teammate who was offside when the ball was played (or a tight one either way).
		if (offside.team === p.team && offside.margin && offside.margin.has(p) && !bulkSim && !shoot && !tut && state === "play" && (offside.set.has(p) || p.team === 0 || p.role === "fwd") && Math.random() < 0.5) {
			const mg = offside.margin.get(p), off = offside.set.has(p);
			offside.margin.delete(p);
			startReview(p, off, mg);
			if (off) { return; }
			offside.set.delete(p);
		}
		if (offside.team === p.team && offside.set.has(p)) { callOffside(p); return; }
		lastTouch = p.team;
		offside = { team: -1, set: new Set() };
		ball.owner = p;
		ball.headed = false;
		ball.indirect = null;
		if (p.role !== "gk") { p.vx *= 0.85; p.vy *= 0.85; }   // the first touch takes a little pace off
		p.hold = 0;
		p.gotAt = frame; p.gotX = p.x;
		if (lostBy >= 0 && lastCarrier && lastCarrier.team === lostBy && lastCarrier.gotX !== undefined) { tally.carry[lostBy].push(Math.round(rel(lostBy, lastCarrier.x) - rel(lostBy, lastCarrier.gotX))); }
		lastCarrier = p;
		p.think = 4;
		// A change of possession is a new situation, so drop any manual-switch hold.
		if (p.team !== possTeam) {
			manualLock = 0;
			if (p.team === 1) { possLostAt = frame; switchCd = 0; autoHold = 0; turnoverPending = true; steerSwitchDone = false; }
			possTeam = p.team;
		}
		if (pendingPass) { if (p.team === 0) { stats.completed++; } pendingPass = false; }
		if (oppPending) { if (p.team === 1) { oppStats.completed++; } oppPending = false; }
		const by = ball.lastBy, fromMate = by && by !== p && by.team === p.team && frame - (ball.kickedAt ?? -999) < 300;
		if (fromMate) { completedPass(p.team); } else if (by && by.team !== p.team) { breakStreak(by.team, p.team); }
		if (lostBy === 1 - p.team && passStreak[lostBy]) { breakStreak(lostBy, p.team); }   // a loose ball or tackle ends the run too
		if (p.team === 0 && p.role === "gk") {
			// Your keeper plays himself: a catch stops him dead, he looks up and distributes,
			// and you stay on an outfielder (the one he finds, once it's on its way).
			p.vx = 0; p.vy = 0; p.hold = 0; p.holdFor = 0;
			if (human() === p) { const m = bestDefender(null); if (m) { ctrl = players.indexOf(m); } }
		} else if (p.team === 0) {
			const idx = players.indexOf(p);
			if (idx !== ctrl && p !== receiver) { flashPlayer(p); }
			ctrl = idx;
			p.hold = 0;
		}
		receiver = null;
		if (p.team !== 0 || players.indexOf(p) !== ctrl) { charging = false; }
		// Nerves: a tense side's first touch sometimes gets away from it.
		if (fromMate && p.role !== "gk" && !setPiece && Math.random() < (p.team === 0 && players.indexOf(p) === ctrl ? 0.1 : 0.16) * Math.min(1, edge(1 - p.team) + 0.35 * wobble(p.team))) {
			const a = Math.hypot(p.vx, p.vy) > 0.4 ? Math.atan2(p.vy, p.vx) : p.dir;
			const sp = 2.4 + Math.random() * 1.4, off = (Math.random() * 2 - 1) * 0.7;
			ball.owner = null;
			ball.vx = Math.cos(a + off) * sp; ball.vy = Math.sin(a + off) * sp;
			ball.lastBy = p; ball.kickedAt = frame; lastTouch = p.team;
			p.kickCd = 14;
			heavyTouches[p.team]++;
		}
	}

