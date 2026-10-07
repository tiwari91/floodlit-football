	/* ---------- game controller (standard mapping: Xbox / PlayStation layout) ----------
	   Left stick moves. A pass or switch, B shoot (hold for power), X slide tackle,
	   Y through ball, RB long ball, RT or LT sprint, Start pause. */
	const padVec = { x: 0, y: 0 };
	let padSprintBtn = false, padPrev = [];
	function pollPad () {
		let pads = [];
		try { pads = navigator.getGamepads ? [ ...navigator.getGamepads() ].filter(Boolean) : []; } catch (e) { pads = []; }
		const gp = pads[0];
		if (!gp) { padVec.x = padVec.y = 0; padSprintBtn = false; return; }
		const dz = v => (Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8);
		padVec.x = dz(gp.axes[0] || 0);
		padVec.y = dz(gp.axes[1] || 0);
		const down = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
		const now = gp.buttons.map((b, i) => down(i));
		const pressed = i => now[i] && !padPrev[i], released = i => !now[i] && padPrev[i];
		if (now.some(Boolean) || padVec.x || padVec.y) { padOn = true; }
		padSprintBtn = now[7] || now[6];
		padPressBtn = now[2];   // X held: the press assist
		if (state === "goal" && [ 0, 1, 2, 3 ].some(pressed)) { skipCelebration(); }
		if (pressed(9)) {
			ensureAudio();
			if (state === "play") { pause(); } else if (state === "paused" || state === "intro" || state === "full" || state === "half") { startPlay(); }
		}
		if (state === "play" && freeze <= 0) {
			if (pressed(0)) { passPress("pass"); }
			if (pressed(1)) { humanShootPress(); }
			if (pressed(2)) { humanTackle(); }
			if (pressed(3)) { passPress("through"); }
			if (pressed(5)) { passPress("long"); }
			if (pressed(8)) { startOdr(); }   // Back / Share / Select: replay the last six seconds
		}
		if (state === "play" || state === "goal") {
			if (pressed(12)) { setMentality(0, mentality[0] + 1); }   // D-pad up: more attacking
			if (pressed(13)) { setMentality(0, mentality[0] - 1); }   // D-pad down: more defensive
		}
		if (released(1)) { humanShootRelease(); }
		if (released(0)) { passRelease("pass"); }
		if (released(3)) { passRelease("through"); }
		if (released(5)) { passRelease("long"); }
		padPrev = now;
	}
	window.addEventListener("gamepadconnected", () => { padOn = true; toast("Controller connected", "#eef6ea"); });

