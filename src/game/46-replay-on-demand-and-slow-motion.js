	/* ---------- replay on demand, and slow motion ----------
	   R (or the Replay pad) shows the last six seconds again from the same recording, a touch slower
	   than life, in whichever view is on. Nothing moves on meanwhile and the clock stands still. Any
	   key or tap ends it. Goals, parries and goal-line clearances also drop the match into slow
	   motion for a moment before it picks up again. */
	const ODR_SPEED = 0.8, SLOW_RATE = 0.35;
	let odr = null, slowMo = 0;   // odr: { end, len, t }; slowMo: simulated frames still to run slowly
	function startOdr () {
		if (odr || state !== "play" || mode === "tutorial" || rec.n < 60 || !rec.buf) { return; }
		keys.clear(); charging = false; passCharge = null; pressHeld = false; touchPress = false;
		odr = { end: (rec.head - 1 + REC_N) % REC_N, len: Math.min(rec.n, 360), t: 0 };
		toast("Replay", "#f2b52e");
	}
	function endOdr () { odr = null; last = performance.now(); acc = 0; }
	function stepOdr () { odr.t += ODR_SPEED; if (odr.t >= odr.len - 1.001) { endOdr(); } }
	function slowMotion (n) { if (!bulkSim && state !== "paused") { slowMo = Math.max(slowMo, n); } }

