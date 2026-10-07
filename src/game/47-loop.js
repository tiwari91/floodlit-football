	/* ---------- loop ---------- */
	let last = performance.now(), acc = 0, drawMs = 0, drawn = 0;
	// Never more than 60 pictures a second: a 120 Hz phone would otherwise draw twice as often for
	// no visible gain and run its battery down. A frame is due once 60 Hz worth of time has passed,
	// with a little slack so a 60 Hz screen's own jitter never drops a frame.
	const MIN_FRAME = 1000 / 60 - 2.5;
	const frameDue = (now, prev) => now - prev >= MIN_FRAME;
	const STEP = 1000 / 60;
	let frameDt = 16.7;
	function loop (now) {
		if (!frameDue(now, last)) { requestAnimationFrame(loop); return; }
		frameDt = clamp(now - last, 1, 100);
		pollPad();
		acc = Math.min(acc + (now - last) * (slowMo > 0 && !odr ? SLOW_RATE : 1), 250);
		last = now;
		while (acc >= STEP) {
			if (odr) { stepOdr(); } else { snapshotPrev(); update(); if (slowMo > 0) { slowMo--; } }
			acc -= STEP;
		}
		if (odr && state !== "play") { endOdr(); }
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

