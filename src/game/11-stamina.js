	/* ---------- stamina ----------
	   Every player has a tank for the match (p.sta, 1 full .. 0.25 empty), started from his fitness.
	   Running hard and pressing drain it, walking and standing let it creep back, half time tops it up.
	   A tired player is slower, his passes and shots stray more and he wins fewer tackles. The drain is
	   per match, not per second, so a two-minute match tires legs as much as a twenty-minute one. */
	const STA_K = 1.35, TIRED_STA = 0.55;
	const staOf = p => (p && Number.isFinite(p.sta) ? p.sta : 1);
	const tiredness = p => 1 - staOf(p);
	let cpuSubWin = 0, matchSta = {};
	function drainStamina () {
		if (tut || shoot) { return; }
		const mf = 1 / Math.max(60, matchLen * 60);
		for (const p of players) {
			const sp = Math.hypot(p.vx, p.vy) / BASE_SPD, load = Math.min(2.2, sp * sp);
			const rate = p.role === "gk" ? 0.06 : 0.1 + 0.55 * load - (sp < 0.35 ? 0.3 : 0) + (p.sprintAmt > 0.5 ? 0.25 : 0);
			p.sta = clamp(staOf(p) - rate * (p.endure || 1) * mf * STA_K, 0.25, 1);
		}
	}
	let possFrames = [ 0, 0 ];
	// Counts for the test harness and the match report: both sides, counted where they happen.
	const newTally = () => ({ shots: [ 0, 0 ], heads: [ 0, 0 ], headGoals: [ 0, 0 ], corners: [ 0, 0 ], cornerGoals: [ 0, 0 ], claims: [ 0, 0 ], punches: [ 0, 0 ], crosses: [ 0, 0 ], clears: [ 0, 0 ], goals: [ 0, 0 ], offsides: [ 0, 0 ], fks: [ 0, 0 ], fkGoals: [ 0, 0 ], pens: [ 0, 0 ], penGoals: [ 0, 0 ], spills: [ 0, 0 ], indirect: 0, walks: 0, tight: 0, by: {}, carry: [ [], [] ], dribbleShots: [ 0, 0 ], air: { none: 0, attWin: 0, defWin: 0, noAct: 0 } });
	let tally = newTally(), cornerAt = [ -9999, -9999 ];
	// Per-player counts for the test harness (headers won, runs, tackles), keyed team-index.
	const tallyBy = (p, k) => {
		const key = `${p.team}-${p.idx}`, o = tally.by[key] || (tally.by[key] = {}); o[k] = (o[k] || 0) + 1;
		if (p.team === 0 && p.name) { const bn = tally.byName || (tally.byName = {}), q = bn[p.name] || (bn[p.name] = {}); q[k] = (q[k] || 0) + 1; }
	};

