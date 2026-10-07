	/* ---------- camera ---------- */
	let camX = 0, camY = 0;
	// Like the TV cutting to the touchline: before kick-off, at the breaks and once a
	// goal has been celebrated, the camera looks at the dugouts and the managers.
	const benchCam = () => state === "intro" || state === "paused" || state === "half" || state === "full" || (state === "goal" && goalTimer < 70);
	function camTarget () {
		if (benchCam()) { return [ clamp(MX + FW / 2 - VW / 2, 0, Math.max(0, WW - VW)), Math.max(0, WH - VH) ]; }
		// After a goal the camera stays on the scorer.
		if (celebTracking()) { const h = celeb.hero; return [ clamp(MX + h.x - VW / 2, 0, Math.max(0, WW - VW)), clamp(MY + h.y - VH / 2, 0, Math.max(0, WH - VH)) ]; }
		if (stretcher) { const q = stretcherPos() || stretcher.at; return [ clamp(MX + q.x - VW / 2, 0, Math.max(0, WW - VW)), clamp(MY + q.y - VH / 2, 0, Math.max(0, WH - VH)) ]; }
		// Follow whoever has the ball (or the ball itself when loose), looking a little ahead.
		const o = ball.owner, fx0 = o ? o.x : ball.x, fy0 = o ? o.y : ball.y, vx = o ? o.vx : ball.vx, vy = o ? o.vy : ball.vy;
		const lx = fx0 + vx * 14, ly = fy0 + vy * 14;
		return [ clamp(MX + lx - VW / 2, 0, Math.max(0, WW - VW)), clamp(MY + ly - VH / 2, 0, Math.max(0, WH - VH)) ];
	}
	function snapCamera () { [ camX, camY ] = camTarget(); }

	function draw (alpha = 1) {
		// A replay on demand: the recorded moment goes in for drawing, then everything comes back.
		if (odr) { const restore = applyReplay(odr, Math.min(odr.t, odr.len - 1.001), ODR_SPEED); try { drawPlain(1); } finally { restore(); } return; }
		drawPlain(alpha);
	}
	function drawPlain (alpha) {
		// Swap in in-between positions for drawing, then put the real ones back.
		const real = players.map(p => [ p.x, p.y, p.dir, p.stride ]), realBall = ball ? [ ball.x, ball.y, ball.z ] : null;
		const lerp = (a, b) => (a === undefined ? b : a + (b - a) * alpha);
		for (const p of players) {
			if (p.px !== undefined && Math.hypot(p.x - p.px, p.y - p.py) < 40) {
				p.x = lerp(p.px, p.x); p.y = lerp(p.py, p.y);
				if (p.pdir !== undefined) { p.dir = p.pdir + Math.atan2(Math.sin(p.dir - p.pdir), Math.cos(p.dir - p.pdir)) * alpha; }
				if (p.pstride !== undefined && p.stride !== undefined) { p.stride = lerp(p.pstride, p.stride); }
			}
		}
		if (ball && ball.px !== undefined && Math.hypot(ball.x - ball.px, ball.y - ball.py) < 60) {
			ball.x = lerp(ball.px, ball.x); ball.y = lerp(ball.py, ball.y); ball.z = lerp(ball.pz, ball.z);
		}
		try { drawScene(); } finally {
			players.forEach((p, i) => { [ p.x, p.y, p.dir, p.stride ] = real[i]; });
			if (realBall) { [ ball.x, ball.y, ball.z ] = realBall; }
		}
	}

	const replayTagEl = $("replayTag");
	function drawScene () {
		// The REPLAY tag over the picture while one runs (and no GOAL banner over the replay).
		const rp = (camMode === "3d" && replayOn()) || !!odr;
		if (replayTagEl && replayTagEl.hidden === rp) { replayTagEl.hidden = !rp; if (rp) { banner.hidden = true; } }
		if (camMode === "3d" && drawScene3D()) { return; }   // while three.js loads, the TV camera stands in
		if ((camMode === "tv" || camMode === "3d") && !benchCam()) { drawSceneTV(); return; }
		drawSceneTop();
	}
	function drawSceneTop () {
		fitView();
		const [ tx, ty ] = camTarget();
		// Same glide on any screen: ease by elapsed time, not per drawn frame.
		const ease = reduceMotion ? 1 : 1 - Math.exp(-frameDt / 190);
		camX += (tx - camX) * ease;
		camY += (ty - camY) * ease;
		if (rotTop) {
			// Pitch x runs down the screen, pitch y runs right to left: a quarter turn, mirrored for the second half.
			if (endsSwapped()) { ctx.setTransform(0, -scale, -scale, 0, canvas.width + camY * scale, (camX + VW) * scale); } else { ctx.setTransform(0, scale, -scale, 0, canvas.width + camY * scale, -camX * scale); }
		} else if (endsSwapped()) { ctx.setTransform(-scale, 0, 0, scale, (camX + VW) * scale, -camY * scale); } else { ctx.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale); }
		drawPitch();
		drawFreeKickSpray();
		drawPassTarget();
		const order = [ ...players ].sort((a, b) => a.y - b.y);
		const ballBehind = ball.owner && Math.sin(ball.owner.dir) < 0;
		if (ballBehind) { drawBall(); }
		for (const p of order) { drawPlayer(p); }
		for (const p of players) {
			const X = MX + p.x, Y = MY + p.y;
			if (p.yellow) {   // booked: a yellow card by his shoulder
				ctx.fillStyle = "#ffd21f"; ctx.strokeStyle = "rgba(0, 0, 0, 0.6)"; ctx.lineWidth = 1;
				ctx.fillRect(X + 13, Y - 22, 7, 10); ctx.strokeRect(X + 13, Y - 22, 7, 10);
				if (p.yellow > 1) { ctx.fillRect(X + 17, Y - 20, 7, 10); ctx.strokeRect(X + 17, Y - 20, 7, 10); }
			}
			if (p.injured) {   // carrying a knock
				ctx.fillStyle = "#ffffff"; ctx.fillRect(X - 21, Y - 22, 10, 10);
				ctx.fillStyle = "#d8343f"; ctx.fillRect(X - 17.5, Y - 21, 3, 8); ctx.fillRect(X - 20, Y - 18.5, 8, 3);
			} else if (p.team === 0 && p.role !== "gk" && staOf(p) < TIRED_STA) { drawTired(X - 24, Y - 21); }
		}
		if (!ballBehind) { drawBall(); }
		drawStrikerMarker();
		drawSwitchPreview();
		drawOffsideLine();
		drawAim();
		drawPenAim(false);
		drawReview(false);
		drawStretcher(false);
		if (tut && tut.marker) {
			const mx = MX + tut.marker.x, my = MY + tut.marker.y, pulse = reduceMotion ? 0 : Math.sin(frame * 0.12) * 4;
			ctx.save();
			ctx.strokeStyle = "#f2b52e"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(mx, my, 22 + pulse, 0, Math.PI * 2); ctx.stroke();
			ctx.fillStyle = "rgba(242, 181, 46, 0.25)";
			ctx.beginPath(); ctx.arc(mx, my, 22 + pulse, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		}
		drawFx();
		ctx.setTransform(scale, 0, 0, scale, 0, 0);
		drawRain();
		drawOffscreenMarker();
		drawMinimap(); drawTouchlineCam();
		drawHints();
		drawPowerMeter();
		drawToasts();
		drawCountdown();
	}

