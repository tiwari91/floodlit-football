	/* ---------- the touchline cam ----------
	   A broadcast cutaway in the corner of the screen while play goes on: a foul, a card or a near
	   miss and the director cuts to the touchline for a couple of seconds. The manager steps up in
	   his technical area and lets the referee have it (or holds his head), the bench behind him
	   rises or protests, and the caption says what he is shouting. Drawn only while it is showing;
	   never in bulk simulation, the tutorial, the corner shootout, or on a phone. */
	const TLC_MS = 2600, TLC_GAP = 7000;
	let tlc = null, tlcLast = -1e9;
	const pickOf = (list, seed) => list[Math.abs(Math.floor(seed)) % list.length];
	function benchReact (kind, o = {}) {
		if (bulkSim || mode === "tutorial" || mode === "corners" || shoot || coarse || state === "intro") { return; }
		const now = performance.now();
		if (now - tlcLast < TLC_GAP && !o.card) { return; }   // a run of fouls doesn't keep cutting away; a card always does
		const seed = Math.floor(now / 7);
		let team, pose, line;
		if (kind === "foul") {
			team = o.fouled;
			pose = o.red ? "furious" : "shout";
			line = pickOf(o.red ? [ "Off! Get him off, ref!", "That's a red! A RED!" ] : o.card ? [ "Book him, ref!", "That's a card, surely!", "Every time! Book him!" ] : [ "Referee!", "That's a foul, ref!", "Come on, ref! Free kick!", "He's been clattered, ref!" ], seed);
		} else if (kind === "near") {
			team = o.team; pose = "anguish";
			line = pickOf([ "So close!", "How's that not in?!", "Unlucky! Keep going!", "Ohh! Inches!" ], seed);
		} else { return; }
		if (team !== 0 && team !== 1) { return; }
		tlc = { t0: now, team, pose, line, seed, fouler: kind === "foul" ? o.offender : null };
		tlcLast = now;
		shoutSfx(pose);
	}
	// A man's shout, synthesised: two voiced syllables through a mouth-like filter, behind the Sound setting.
	function shoutSfx (pose) {
		if (!soundOn || !audio) { return; }
		try {
			const t = audio.currentTime, hi = pose === "furious" ? 1.15 : pose === "anguish" ? 0.85 : 1;
			voices(t, 1, 220 * hi, 185 * hi, 0.32, 0.05, 1500, 0.35);
			voices(t + 0.36, 1, 250 * hi, 160 * hi, 0.5, 0.05, 1500, 0.35);
		} catch (e) { /* audio is a nicety */ }
	}
	function tlcCapsule (x1, y1, r1, x2, y2, r2) {
		const a = Math.atan2(y2 - y1, x2 - x1);
		ctx.beginPath(); ctx.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2); ctx.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2); ctx.closePath(); ctx.fill();
	}
	const tlcHash = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return (h >>> 0) / 4294967296; };
	function drawTouchlineCam () {
		if (!tlc) { return; }
		const el = performance.now() - tlc.t0;
		if (el > TLC_MS || state === "intro" || state === "full") { tlc = null; return; }
		const w = 300, h = 170, x0 = SW - w - 16, y0 = SH - h - 16 - tickerUp();
		const fadeIn = Math.min(1, el / 180), fadeOut = Math.min(1, (TLC_MS - el) / 260), a = Math.min(fadeIn, fadeOut);
		const t = reduceMotion ? 0.6 : el / 1000, mo = reduceMotion ? 0 : 1;
		const kit = KITS[tlc.team] || KITS[0], col = kit.outfield, coat = tlc.team === 0 ? "#1d2330" : "#33252a";
		ctx.save();
		ctx.globalAlpha = a;
		ctx.translate(x0 + (1 - fadeIn) * 24, y0);
		// The frame and a soft drop shadow, like a broadcast box.
		ctx.fillStyle = "rgba(0, 0, 0, 0.45)"; ctx.fillRect(4, 5, w, h);
		ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
		// The stand behind: rows of fans in the home colours, out of focus.
		const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
		sky.addColorStop(0, "#0b1016"); sky.addColorStop(1, "#1a2028");
		ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.55);
		const homeCol = (KITS[homeSide] || KITS[0]).outfield;
		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 30; c++) {
				const n = r * 31 + c, hx = c * 10.5 + (r % 2) * 5 + tlcHash(n) * 3, hy = 8 + r * 11 + (mo ? Math.sin(t * 6 + n) * (tlc.pose === "anguish" ? 1.4 : 0.6) : 0);
				ctx.fillStyle = tlcHash(n + 7) < 0.62 ? homeCol : tlcHash(n + 9) < 0.5 ? "#c9ccd2" : "#3a3f48";
				ctx.globalAlpha = a * 0.55;
				ctx.fillRect(hx, hy + 3, 6, 6);
				ctx.fillStyle = [ "#e0ac86", "#9c6a44", "#f1c9a5", "#6b4630" ][Math.floor(tlcHash(n + 3) * 4)];
				ctx.beginPath(); ctx.arc(hx + 3, hy, 2.4, 0, Math.PI * 2); ctx.fill();
			}
		}
		ctx.globalAlpha = a;
		// The advertising board and the grass of the technical area.
		ctx.fillStyle = "#0e1418"; ctx.fillRect(0, h * 0.56, w, 14);
		ctx.fillStyle = col; ctx.fillRect(0, h * 0.56 + 5, w, 3);
		const g = ctx.createLinearGradient(0, h * 0.64, 0, h);
		g.addColorStop(0, "#2d7a46"); g.addColorStop(1, "#1f5a33");
		ctx.fillStyle = g; ctx.fillRect(0, h * 0.64, w, h * 0.36);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; ctx.lineWidth = 1.5; ctx.setLineDash([ 6, 4 ]);
		ctx.beginPath(); ctx.moveTo(0, h * 0.9); ctx.lineTo(w, h * 0.9); ctx.stroke(); ctx.setLineDash([]);   // the technical area's line
		// The dugout: a dark bay under a perspex roof, the substitutes in tracksuit tops on the bench.
		const dx0 = 8, dw = 150, dy0 = h * 0.4, dh = h * 0.3;
		ctx.fillStyle = "#11171c"; ctx.fillRect(dx0, dy0, dw, dh);
		ctx.fillStyle = "rgba(160, 200, 225, 0.28)"; ctx.fillRect(dx0 - 4, dy0 - 6, dw + 8, 7);
		ctx.fillStyle = "#2b3138"; ctx.fillRect(dx0, dy0 + dh * 0.72, dw, 4);   // the bench seat
		const rise = tlc.pose === "anguish" || tlc.pose === "furious" ? Math.min(1, el / 400) : tlc.pose === "shout" ? Math.min(0.5, el / 600) : 0;
		for (let i = 0; i < 5; i++) {
			const sx = dx0 + 16 + i * 29, up = rise * (0.6 + 0.4 * tlcHash(i + tlc.seed)) * 11, bob = mo ? Math.sin(t * 5 + i * 1.7) * 0.8 : 0;
			const base = dy0 + dh * 0.72 - up + bob;
			ctx.fillStyle = shadeHex(col, 0.55);
			tlcCapsule(sx, base, 6.5, sx, base - 13, 7.5);
			if (rise > 0.3 && tlc.pose !== "shout") {   // arms up or hands on heads
				ctx.fillStyle = shadeHex(col, 0.55);
				const arm = tlc.pose === "anguish" ? -0.4 : -1.1;
				for (const s of [ -1, 1 ]) { tlcCapsule(sx + s * 6, base - 11, 2.2, sx + s * (6 + Math.sin(arm) * 7), base - 11 - Math.cos(arm) * 13, 2); }
			}
			ctx.fillStyle = [ "#e0ac86", "#9c6a44", "#f1c9a5", "#6b4630", "#c68a5e" ][(i + tlc.team) % 5];
			ctx.beginPath(); ctx.arc(sx, base - 19, 5, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#1a1310"; ctx.beginPath(); ctx.arc(sx, base - 21, 5, Math.PI, 0); ctx.fill();
		}
		// A coach at the end of the dugout, in the club tracksuit.
		{
			const cx = dx0 + dw + 14, cy = h * 0.84;
			ctx.fillStyle = "#20252c"; tlcCapsule(cx - 3, cy, 3, cx - 3, cy - 22, 3); tlcCapsule(cx + 3, cy, 3, cx + 3, cy - 22, 3);
			ctx.fillStyle = shadeHex(col, 0.6); tlcCapsule(cx, cy - 22, 7, cx, cy - 40, 8);
			const pt = tlc.pose === "shout" || tlc.pose === "furious" ? 1 : 0;   // pointing at the incident
			ctx.fillStyle = shadeHex(col, 0.6); tlcCapsule(cx + 6, cy - 37, 2.4, cx + 6 + 14 * pt + 4, cy - 37 - 4 * pt + 12 * (1 - pt), 2.2);
			ctx.fillStyle = "#c68a5e"; ctx.beginPath(); ctx.arc(cx, cy - 47, 5.5, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#2b2018"; ctx.beginPath(); ctx.arc(cx, cy - 49, 5.6, Math.PI, 0); ctx.fill();
		}
		// The manager, nearest the camera in his technical area.
		{
			const step = Math.min(1, el / 450) * 10 * mo;
			const mx = 206 + step, gy = h * 0.97;
			const lean = tlc.pose === "anguish" ? -0.05 : 0.12 + (mo ? Math.sin(t * 8) * 0.04 : 0);
			const H = 112, hip = gy - H * 0.47, shY = hip - H * 0.3, shX = mx + Math.sin(lean) * H * 0.3;
			// legs, planted apart; shoes
			ctx.fillStyle = "#151a20";
			tlcCapsule(mx - 6, hip, 6.5, mx - 11, gy - 6, 5); tlcCapsule(mx + 6, hip, 6.5, mx + 12, gy - 6, 5);
			ctx.fillStyle = "#0b0b0b";
			ctx.beginPath(); ctx.ellipse(mx - 13, gy - 3, 8, 3.6, 0, 0, Math.PI * 2); ctx.ellipse(mx + 15, gy - 3, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
			// the long coat
			ctx.fillStyle = coat;
			ctx.beginPath();
			ctx.moveTo(mx - 17, hip + 16); ctx.lineTo(shX - 19, shY + 4); ctx.quadraticCurveTo(shX, shY - 8, shX + 19, shY + 4); ctx.lineTo(mx + 17, hip + 16); ctx.closePath(); ctx.fill();
			ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(shX, shY + 2); ctx.lineTo(mx, hip + 14); ctx.stroke();   // the buttons' edge
			// arms, by pose
			const pump = mo ? Math.sin(t * 9) : 0;
			const arms = tlc.pose === "anguish" ? [ [ -2.5, -1.67 ], [ 2.5, 1.67 ] ]   // elbows out, hands on top of his head
				: tlc.pose === "furious" ? [ [ -2.4 - pump * 0.25, -0.4 ], [ 2.4 + pump * 0.25, 0.4 ] ]   // both up, pumping
				: [ [ -1.35 - pump * 0.18, -0.35 ], [ 1.35 + pump * 0.18, 0.35 ] ];   // out wide, palms open: "Referee!"
			for (let i = 0; i < 2; i++) {
				const s = i ? 1 : -1, ax = shX + s * 15, ay = shY + 4, [ u, f ] = arms[i];
				const ex = ax + Math.sin(u) * 22, ey = ay + Math.cos(u) * 22, hx2 = ex + Math.sin(u + f) * 20, hy2 = ey + Math.cos(u + f) * 20;
				ctx.fillStyle = coat; tlcCapsule(ax, ay, 6, ex, ey, 5); tlcCapsule(ex, ey, 5, hx2, hy2, 4.2);
				ctx.fillStyle = "#d9a07a"; ctx.beginPath(); ctx.arc(hx2, hy2, 4.4, 0, Math.PI * 2); ctx.fill();
			}
			// the club scarf
			ctx.fillStyle = col; tlcCapsule(shX - 9, shY + 2, 4, shX + 9, shY + 2, 4); tlcCapsule(shX + 5, shY + 3, 3.2, shX + 7, shY + 30, 3.2);
			ctx.fillStyle = shadeHex(col, 0.6); ctx.fillRect(shX + 4, shY + 22, 6, 3);
			// head: jaw thrust forward when he shouts, mouth open
			const hx = shX + Math.sin(lean) * 8 + (tlc.pose === "anguish" ? 0 : 2), hy = shY - 15 + (mo ? Math.abs(pump) * -1.5 : 0);
			ctx.fillStyle = "#d9a07a"; ctx.beginPath(); ctx.ellipse(hx, hy, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "rgba(0, 0, 0, 0.14)"; ctx.beginPath(); ctx.ellipse(hx - 4, hy + 2, 7, 11, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#3a3a3e"; ctx.beginPath(); ctx.ellipse(hx, hy - 7, 11.5, 7.5, 0, Math.PI, 0); ctx.fill();   // grey, as managers' hair is
			ctx.fillStyle = "#20140e";
			ctx.fillRect(hx - 6, hy - 3, 4, 2); ctx.fillRect(hx + 2, hy - 3, 4, 2);   // brows, furrowed
			const open = tlc.pose === "anguish" ? 2.5 : 3.5 + (mo ? Math.abs(pump) * 3 : 2);
			ctx.fillStyle = "#3b1210"; ctx.beginPath(); ctx.ellipse(hx + 0.5, hy + 6, 4, open, 0, 0, Math.PI * 2); ctx.fill();
		}
		// What he's shouting, in a bubble by his head.
		ctx.font = "800 13px Barlow, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
		const tw = Math.min(w - 20, ctx.measureText(tlc.line).width + 16), bx = Math.max(10 + tw / 2, Math.min(w - 10 - tw / 2, 178)), by = 20 + (mo ? Math.sin(t * 9) * 1.2 : 0);
		ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
		ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - tw / 2, by - 11, tw, 22, 6) : ctx.rect(bx - tw / 2, by - 11, tw, 22); ctx.fill();
		ctx.beginPath(); ctx.moveTo(bx + 10, by + 10); ctx.lineTo(bx + 22, by + 24); ctx.lineTo(bx + 20, by + 10); ctx.closePath(); ctx.fill();
		ctx.fillStyle = "#111"; ctx.fillText(tlc.line, bx, by + 1, tw - 10);
		// The lower third: who this is.
		const name = tlc.team === 0 ? "YOUR MANAGER" : `${(opp && opp.short ? opp.short : "THEIR").toUpperCase()} MANAGER`;
		ctx.fillStyle = "rgba(8, 13, 11, 0.86)"; ctx.fillRect(0, h - 20, w, 20);
		ctx.fillStyle = col; ctx.fillRect(0, h - 20, 5, 20);
		ctx.font = "700 11px Barlow, Arial, sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#eef6ea";
		ctx.fillText(`TOUCHLINE CAM · ${name}`, 12, h - 9.5);
		ctx.restore();
		ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "rgba(238, 246, 234, 0.5)"; ctx.lineWidth = 1; ctx.strokeRect(x0 + (1 - fadeIn) * 24 + 0.5, y0 + 0.5, w - 1, h - 1); ctx.restore();
	}
	function shadeHex (hex, f) {
		if (typeof hex !== "string" || hex[0] !== "#" || hex.length !== 7) { return hex; }
		const n = parseInt(hex.slice(1), 16);
		return `rgb(${[ n >> 16, (n >> 8) & 255, n & 255 ].map(v => Math.round(v * f)).join(",")})`;
	}
