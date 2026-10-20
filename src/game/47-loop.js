	/* ---------- loop ---------- */
	let last = performance.now(), acc = 0, drawMs = 0, drawn = 0;
	// Never more than 60 pictures a second: a 120 Hz phone would otherwise draw twice as often for
	// no visible gain and run its battery down. A frame is due once 60 Hz worth of time has passed,
	// with a little slack so a 60 Hz screen's own jitter never drops a frame.
	const MIN_FRAME = 1000 / 60 - 2.5;
	const frameDue = (now, prev) => now - prev >= MIN_FRAME;
	const STEP = 1000 / 60;
	let frameDt = 16.7;
	const IDLE_STATES = new Set([ "paused", "intro", "half", "full" ]), IDLE_FRAME = 100, IDLE_AFTER = 2500;
	let lastDrawAt = 0, idleState = "", idleSince = 0;
	// 30 a second where nothing needs 60: paused, the menus and the cards and, on Light graphics, in play too.
	// Between plays (the kick-off sweep and restart walks, a goal being celebrated) the camera is moving, so
	// High and Medium keep 60 there; Low and Light take 30. A replay and slow motion keep every frame.
	// (The simulation steps at 60 whatever the drawing does.)
	const CAP_FRAME = 1000 / 30 - 2.5;
	const smoothMoves = () => gfxLevel === "high" || gfxLevel === "medium";
	const capped = () => !odr && !replayOn() && !(slowMo > 0) && (IDLE_STATES.has(state) || (!smoothMoves() && (state === "goal" || (state === "play" && freeze > 0))) || (gfx3().fps || 60) <= 30);
	let wasCapped = false, parked = false;
	// A hidden tab draws nothing at all: the loop parks and starts again when the tab is shown.
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden && parked) { parked = false; last = performance.now(); acc = 0; requestAnimationFrame(loop); }
	});
	function loop (now) {
		if (document.hidden) { parked = true; return; }
		if (!frameDue(now, last)) { requestAnimationFrame(loop); return; }
		const cap = capped();
		if (cap && now - last < CAP_FRAME) { requestAnimationFrame(loop); return; }
		frameDt = clamp(now - last, 1, 100);
		// Graphics Auto judges only uncapped frames (a capped one is long on purpose).
		if (!cap && !wasCapped) { gfxAutoTick(now - last, now); }
		dynTick3D(now - last, now, cap || wasCapped);
		wasCapped = cap;
		pollPad();
		acc = Math.min(acc + (now - last) * (slowMo > 0 && !odr ? SLOW_RATE : 1), 250);
		last = now;
		while (acc >= STEP) {
			if (odr) { stepOdr(); } else { snapshotPrev(); update(); if (slowMo > 0) { slowMo--; } }
			acc -= STEP;
		}
		if (odr && state !== "play") { endOdr(); }
		// Nothing being played (paused, the line-ups, half and full time): once the state has settled for a
		// couple of seconds (so a camera move into it finishes smoothly) the picture hardly changes, so it is
		// redrawn ten times a second instead of sixty and a laptop left on a menu stays cool. A replay still
		// gets every frame.
		if (state !== idleState) { idleState = state; idleSince = now; }
		if (IDLE_STATES.has(state) && now - idleSince > IDLE_AFTER && !odr && !replayOn() && now - lastDrawAt < IDLE_FRAME) { renderHud(); renderTicker(); updateRainSound(); updateCrowd(); updateMusic(); requestAnimationFrame(loop); return; }
		lastDrawAt = now;
		const d0 = performance.now();
		draw(odr ? 1 : acc / STEP);
		drawMs += (performance.now() - d0 - drawMs) * 0.1;   // smoothed cost of a drawn frame, for the test harness
		drawn++;
		renderHud();
		renderTicker();
		updateRainSound();
		updateCrowd();
		updateMusic();
		requestAnimationFrame(loop);
	}

