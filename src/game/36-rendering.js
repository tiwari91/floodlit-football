	/* ---------- rendering ---------- */
	let scale = 1;
	// The screen in view units (SW across, SH down) and whether the overhead picture is turned on its
	// side: on a portrait phone the pitch's long side runs down the screen so its width fits.
	let SW = 0, SH = 0, rotTop = false;
	function resize () {
		const rect = canvas.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
		fitView();
		resize3D();
	}
	// Keep the view the canvas's shape, 648 tall where it can be, never bigger than the ground.
	function fitView () {
		rotTop = camMode === "top" && canvas.height > canvas.width;
		const cw = rotTop ? canvas.height : canvas.width, ch = rotTop ? canvas.width : canvas.height;
		const a = cw && ch ? cw / ch : 1072 / 648, base = rotTop ? 600 : 648;
		let vw = base * a, vh = base;
		if (vw > WW) { vw = WW; vh = WW / a; }
		if (vh > WH) { vh = WH; vw = WH * a; }
		VW = vw; VH = vh;
		scale = cw / VW;
		SW = canvas.width / scale; SH = canvas.height / scale;
	}

	// The playing surface. Turf is a brighter, even green; mud and grass are mown, each ground in its
	// own pattern. On top: patches of lighter and darker grass, a fine grain, the stripes catching the
	// light along one edge, wear in the goalmouths and on the spots (bare and churned on a mud pitch)
	// and, in the rain, a wet sheen under the floodlights. Painted once per ground and weather into
	// its own picture (grassCanvas) and laid down every frame; painted plain if that fails.
	function paintGrass (g, ox, oy, rich) {
		const [ c1, c2 ] = cond.surfaceKey === "turf" ? [ "#23804a", "#26894f" ] : [ "#1f6a3b", "#24774a" ];
		const mow = gstyle && cond.surfaceKey !== "turf" ? gstyle.mow : "stripes";
		g.save();
		g.beginPath(); g.rect(ox, oy, FW, FH); g.clip();
		g.fillStyle = c1; g.fillRect(ox, oy, FW, FH);
		g.fillStyle = c2;
		const bands = Math.round(FW / (mow === "wide" ? 200 : 100));
		if (mow === "checks") {
			const cx = FW / 12, cy = FH / 8;
			for (let i = 0; i < 12; i++) { for (let j = 0; j < 8; j++) { if ((i + j) % 2) { g.fillRect(ox + i * cx, oy + j * cy, cx + 0.5, cy + 0.5); } } }
		} else if (mow === "diag") {
			const w = FW / 14;
			g.save(); g.translate(ox + FW / 2, oy + FH / 2); g.rotate(Math.PI / 4);
			for (let k = -20; k < 20; k += 2) { g.fillRect(k * w, -FW, w, FW * 2); }
			g.restore();
		} else if (mow === "rings") {
			for (let r = Math.hypot(FW, FH) / 2, k = 0; r > 0; r -= 60, k++) {
				g.fillStyle = k % 2 ? c1 : c2;
				g.beginPath(); g.arc(ox + FW / 2, oy + FH / 2, r, 0, Math.PI * 2); g.fill();
			}
		} else {
			for (let k = 1; k < bands; k += 2) { g.fillRect(ox + k * FW / bands, oy, FW / bands + 0.5, FH); }
		}
		if (rich && g.createLinearGradient) {
			let h = [ ...`${gstyle ? gstyle.mow + gstyle.concrete : ""}${FW}` ].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 2147483647, 11) || 11;
			const r = () => (h = (h * 48271) % 2147483647) / 2147483647;
			// Each stripe a touch lighter along the edge the mower finished on.
			if (mow === "stripes" || mow === "wide") {
				for (let k = 0; k < bands; k++) {
					const x0 = ox + k * FW / bands, w = FW / bands, gr = g.createLinearGradient(x0, 0, x0 + w, 0);
					gr.addColorStop(0, "rgba(255, 255, 220, 0)"); gr.addColorStop(1, `rgba(255, 255, 220, ${k % 2 ? 0.035 : 0.02})`);
					g.fillStyle = gr; g.fillRect(x0, oy, w, FH);
				}
			}
			// Patches: the grass is never one even colour.
			for (let i = 0; i < 70; i++) {
				const x = ox + r() * FW, y = oy + r() * FH, rad = 50 + r() * 170, light = r() < 0.5;
				const gr = g.createRadialGradient(x, y, 0, x, y, rad);
				gr.addColorStop(0, light ? "rgba(214, 230, 140, 0.05)" : "rgba(0, 28, 6, 0.07)"); gr.addColorStop(1, "rgba(0, 0, 0, 0)");
				g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
			}
			// The grain: thousands of blades lit or in shadow.
			g.lineWidth = 1;
			for (let i = 0; i < 4200; i++) {
				const x = ox + r() * FW, y = oy + r() * FH, l = 2 + r() * 4;
				g.strokeStyle = r() < 0.5 ? "rgba(190, 230, 160, 0.07)" : "rgba(0, 20, 0, 0.09)";
				g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 1.5, y + l); g.stroke();
			}
			// Wear: the goalmouths, the penalty spots and the centre spot take a beating.
			const mud = cond.surfaceKey === "mud", turf = cond.surfaceKey === "turf";
			if (!turf) {
				const a = mud ? 0.42 + 0.14 * cond.wet : 0.16;
				const tone = mud ? "92, 68, 40" : "128, 118, 64";
				const spots = [ [ ox + 34 * S, oy + FH / 2, 110 * GH, 1 ], [ ox + FW - 34 * S, oy + FH / 2, 110 * GH, 1 ], [ ox + FMT.spot, oy + FH / 2, 34 * S, 0.7 ], [ ox + FW - FMT.spot, oy + FH / 2, 34 * S, 0.7 ], [ ox + FW / 2, oy + FH / 2, (mud ? 120 : 40) * S, mud ? 1 : 0.6 ] ];
				for (const [ px, py, rad, k ] of spots) {
					const gr = g.createRadialGradient(px, py, 4, px, py, rad);
					gr.addColorStop(0, `rgba(${tone}, ${a * k})`); gr.addColorStop(0.65, `rgba(${tone}, ${a * k * 0.45})`); gr.addColorStop(1, `rgba(${tone}, 0)`);
					g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
				}
				if (mud) {
					// Churned: stud marks and slide scars round the goalmouths, standing water when it rains.
					for (const gx of [ ox + 40 * S, ox + FW - 40 * S ]) {
						for (let i = 0; i < 90; i++) {
							const x = gx + (r() - 0.5) * 150 * S, y = oy + FH / 2 + (r() - 0.5) * 220 * GH, l = 4 + r() * 16, a2 = r() * Math.PI;
							g.strokeStyle = `rgba(60, 42, 24, ${0.25 + r() * 0.25})`; g.lineWidth = 1 + r() * 2.5;
							g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a2) * l, y + Math.sin(a2) * l); g.stroke();
						}
						if (cond.wet) {
							for (let i = 0; i < 6; i++) {
								const x = gx + (r() - 0.5) * 90 * S, y = oy + FH / 2 + (r() - 0.5) * 140 * GH, rx = 8 + r() * 18;
								g.fillStyle = "rgba(150, 165, 175, 0.22)"; g.beginPath(); g.ellipse(x, y, rx, rx * 0.5, r() * Math.PI, 0, Math.PI * 2); g.fill();
							}
						}
					}
				}
			}
			// Wet: darker, richer grass, and (by day) a sheen from the sky. Under floodlights the pale sheen
			// washed the whole pitch out (the lights' own reflections and pools do that job at night).
			if (cond.wet) {
				// by night multiplied in, red and blue more than green, so it deepens without greying
				g.save(); if (cond.ko !== "day") { g.globalCompositeOperation = "multiply"; }
				g.fillStyle = cond.ko === "day" ? `rgba(0, 24, 12, ${0.08 * cond.wet})` : `rgb(${255 - 35 * cond.wet}, ${255 - 15 * cond.wet}, ${255 - 33 * cond.wet})`; g.fillRect(ox, oy, FW, FH);
				g.restore();
				for (const [ cx, cy ] of cond.ko === "day" ? [ [ ox, oy ], [ ox + FW, oy ], [ ox, oy + FH ], [ ox + FW, oy + FH ] ] : []) {
					const gr = g.createRadialGradient(cx, cy, 10, cx, cy, 420 * S);
					gr.addColorStop(0, `rgba(225, 240, 255, ${0.1 * cond.wet})`); gr.addColorStop(1, "rgba(225, 240, 255, 0)");
					g.fillStyle = gr; g.fillRect(ox, oy, FW, FH);
				}
			}
			// Snow: a white dusting that the players have scuffed green, deeper by the touchlines.
			if (cond.snow) { snowOnPitch(g, ox, oy, r); }
			// Heat: grass baked a little straw-coloured, palest where the sun sits all afternoon.
			if (cond.heat) {
				const gr = g.createLinearGradient(0, oy, 0, oy + FH);
				gr.addColorStop(0, "rgba(214, 196, 110, 0.07)"); gr.addColorStop(1, "rgba(214, 196, 110, 0.15)");
				g.fillStyle = gr; g.fillRect(ox, oy, FW, FH);
			}
		} else if (cond.surfaceKey === "mud") {
			const a = 0.42 + 0.14 * cond.wet;
			for (const [ px, py, rad ] of [ [ ox + 70 * S, oy + FH / 2, 150 * GH ], [ ox + FW - 70 * S, oy + FH / 2, 150 * GH ], [ ox + FW / 2, oy + FH / 2, 120 * S ] ]) {
				const gr = g.createRadialGradient(px, py, 8, px, py, rad);
				gr.addColorStop(0, `rgba(92, 68, 40, ${a})`); gr.addColorStop(0.7, `rgba(92, 68, 40, ${a * 0.45})`); gr.addColorStop(1, "rgba(92, 68, 40, 0)");
				g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
			}
		}
		g.restore();
	}
	function snowOnPitch (g, ox, oy, r) {
		g.fillStyle = "rgba(236, 242, 248, 0.32)"; g.fillRect(ox, oy, FW, FH);
		for (let i = 0; i < 2600; i++) {
			const x = ox + r() * FW, y = oy + r() * FH, rad = 1 + r() * 3.5;
			g.fillStyle = `rgba(248, 251, 255, ${0.25 + r() * 0.35})`; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
		}
		for (const [ y0, y1 ] of [ [ oy, oy + 70 * S ], [ oy + FH, oy + FH - 70 * S ] ]) {
			const gr = g.createLinearGradient(0, y0, 0, y1);
			gr.addColorStop(0, "rgba(246, 249, 252, 0.6)"); gr.addColorStop(1, "rgba(246, 249, 252, 0)");
			g.fillStyle = gr; g.fillRect(ox, Math.min(y0, y1), FW, Math.abs(y1 - y0));
		}
		// The middle, where the play is, worn back to the grass.
		const gr = g.createRadialGradient(ox + FW / 2, oy + FH / 2, 10, ox + FW / 2, oy + FH / 2, FW * 0.5);
		gr.addColorStop(0, "rgba(40, 92, 40, 0.22)"); gr.addColorStop(1, "rgba(40, 92, 40, 0)");
		g.fillStyle = gr; g.fillRect(ox, oy, FW, FH);
	}
	let grassC = null, grassKey = "";
	function grassCanvas () {
		const key = `${FW}x${FH}|${cond.surfaceKey}|${cond.wet}|${cond.ko}|${cond.snow}${cond.heat}|${gstyle ? gstyle.mow + gstyle.concrete : ""}`;
		if (grassKey === key) { return grassC; }
		grassKey = key; grassC = null;
		try {
			const c = document.createElement("canvas"); c.width = Math.ceil(FW); c.height = Math.ceil(FH);
			const g = c.getContext && c.getContext("2d");
			if (g && g.fillRect && g.createRadialGradient) { paintGrass(g, 0, 0, true); grassC = c; }
		} catch (e) { grassC = null; }
		return grassC;
	}
	function drawPitch (forTex = false) {
		ctx.fillStyle = forTex ? (cond.surfaceKey === "turf" ? "#1d6a3d" : "#1a5631") : "#0f1d16";   // in 3D the grass runs on to the boards
		ctx.fillRect(0, 0, WW, WH);
		drawStands(forTex);
		// Night: the stands sink into the dark round the floodlit pitch. Afternoon: daylight on the terraces.
		if (!forTex) { ctx.fillStyle = cond.ko === "day" ? "rgba(214, 226, 238, 0.12)" : "rgba(1, 3, 7, 0.34)"; ctx.fillRect(0, 0, WW, WH); }

		const gc = grassCanvas();
		if (gc) { ctx.drawImage(gc, MX, MY); } else { paintGrass(ctx, MX, MY, false); }

		// Floodlight pools from the four corner masts.
		for (const [ cx, cy ] of [ [ MX, MY ], [ MX + FW, MY ], [ MX, MY + FH ], [ MX + FW, MY + FH ] ]) {
			const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 560 * S);
			g.addColorStop(0, `rgba(255, 222, 160, ${(cond.ko === "day" ? 0.04 : 0.2) + 0.06 * cond.wet})`);   // wet grass throws the light back
			g.addColorStop(1, "rgba(255, 222, 160, 0)");
			ctx.fillStyle = g;
			ctx.fillRect(MX, MY, FW, FH);
		}

		ctx.strokeStyle = "rgba(238, 246, 234, 0.85)";
		ctx.lineWidth = 3;
		ctx.strokeRect(MX, MY, FW, FH);
		ctx.beginPath();
		ctx.moveTo(MX + FW / 2, MY); ctx.lineTo(MX + FW / 2, MY + FH);
		ctx.stroke();
		ctx.beginPath(); ctx.arc(MX + FW / 2, MY + FH / 2, FMT.circle, 0, Math.PI * 2); ctx.stroke();

		ctx.fillStyle = "rgba(238, 246, 234, 0.9)";
		const spot = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); };
		spot(MX + FW / 2, MY + FH / 2);

		if (fmtKey === "11") {
			// The full-size game's markings, drawn to the same penalty area the laws in the game use:
			// the eighteen-yard box, the six-yard box and the arc from the penalty spot.
			const Dp = FMT.box + 60, hw = FMT.goal / 2 + FMT.box, gd = Dp * 0.333, ghw = FMT.goal / 2 + Dp * 0.333, r = Dp * 0.555;
			const th = Math.acos(clamp((Dp - FMT.spot) / r, -1, 1));
			for (const left of [ true, false ]) {
				const gx = left ? MX : MX + FW, dir = left ? 1 : -1;
				ctx.strokeRect(left ? gx : gx - Dp, MY + FH / 2 - hw, Dp, hw * 2);
				ctx.strokeRect(left ? gx : gx - gd, MY + FH / 2 - ghw, gd, ghw * 2);
				const sx = gx + dir * FMT.spot;
				ctx.beginPath();
				if (left) { ctx.arc(sx, MY + FH / 2, r, -th, th); } else { ctx.arc(sx, MY + FH / 2, r, Math.PI - th, Math.PI + th); }
				ctx.stroke();
			}
			if (forTex) {
				// Wear: the goalmouths and the centre circle are where the grass takes a beating.
				const wear = (x, y, rx, ry, a) => {
					const g = ctx.createRadialGradient(x, y, 2, x, y, Math.max(rx, ry));
					g.addColorStop(0, `rgba(122, 104, 66, ${a})`); g.addColorStop(1, "rgba(122, 104, 66, 0)");
					ctx.save(); ctx.translate(x, y); ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); ctx.translate(-x, -y);
					ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); ctx.fill(); ctx.restore();
				};
				const worn = cond.surfaceKey === "mud" ? 0.42 : cond.surfaceKey === "turf" ? 0.08 : 0.24;
				wear(MX + gd * 0.5, MY + FH / 2, gd * 0.9, FMT.goal * 0.45, worn);
				wear(MX + FW - gd * 0.5, MY + FH / 2, gd * 0.9, FMT.goal * 0.45, worn);
				wear(MX + FW / 2, MY + FH / 2, FMT.circle * 0.8, FMT.circle * 0.55, worn * 0.6);
			}
		} else {
			// Futsal-style D areas: quarter circles round each post, joined by a line.
		const R = FMT.box;
		ctx.beginPath();
		ctx.arc(MX, MY + GOAL_T, R, -Math.PI / 2, 0);
		ctx.lineTo(MX + R, MY + GOAL_B);
		ctx.arc(MX, MY + GOAL_B, R, 0, Math.PI / 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(MX + FW, MY + GOAL_T, R, -Math.PI / 2, Math.PI, true);
		ctx.lineTo(MX + FW - R, MY + GOAL_B);
		ctx.arc(MX + FW, MY + GOAL_B, R, Math.PI, Math.PI / 2, true);
		ctx.stroke();
		}
		spot(MX + FMT.spot, MY + FH / 2);
		spot(MX + FW - FMT.spot, MY + FH / 2);

		for (const [ cx, cy, a0 ] of [ [ MX, MY, 0 ], [ MX + FW, MY, Math.PI / 2 ], [ MX + FW, MY + FH, Math.PI ], [ MX, MY + FH, -Math.PI / 2 ] ]) {
			ctx.beginPath(); ctx.arc(cx, cy, 12, a0, a0 + Math.PI / 2); ctx.stroke();
		}

		if (forTex) { return; }
		drawDugouts();
		drawGoal(MX - NET, true);
		drawGoal(MX + FW, false);
	}

	// The stands: fans in the home club's colours, a corner of away supporters, and
	// neutrals; they bob when the game gets exciting.
	let crowdDots = [];
	// The stadium: stands on all four sides full of fans (the home club's colours, a corner of
	// away supporters), advertising boards along the front and the ground's name on the main
	// stand. It's painted once per match into four strips and then just drawn each frame.
	let stands = null;
	// Every ground its own: stand concrete, seats, a roof or open terraces, floodlight pylons or
	// lights along the roof, how full it gets (bigger clubs draw bigger crowds) and how the grass is cut.
	let gstyle = null;
	function groundStyle (club) {
		let h = [ ...String(club.ground || club.name) ].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 2147483647, 7) || 7;
		const r = () => (h = (h * 48271) % 2147483647) / 2147483647;
		const pick = a => a[Math.floor(r() * a.length)];
		const concrete = pick([ [ "#141c18", "#1b2520" ], [ "#2a1c18", "#35241f" ], [ "#172031", "#1f2a3d" ], [ "#222226", "#2c2c31" ], [ "#1d2419", "#262f21" ] ]);
		return {
			mow: pick([ "stripes", "wide", "checks", "diag", "rings" ]),
			concrete: concrete[0], steps: concrete[1],
			seat: club.color2 && club.color2 !== "#ffffff" ? club.color2 : "#3b4a58",
			fill: clamp(0.42 + (club.str || 3) * 0.11 + (r() - 0.5) * 0.1, 0.45, 1),
			roof: r() < 0.65,
			lights: r() < 0.5 ? "pylons" : "roof",
			boards: [ club.color || "#f2b52e", "#eef2ec", club.color2 || "#1f2a36", "#1f2a36" ],
			arch: pick([ "azteca", "akron", "monterrey" ]),   // the 3D stadium's shape
			mountains: r() < 0.4,
			...dressFor(groundNat(), r)   // the country's way of building a ground (drawn after the rest, so those stay as they were)
		};
	}
	// The country the ground is in: the league's (abroad), else home. countryTest (a test hook) can set it.
	let countryOverride = null;
	const groundNat = () => countryOverride || (league && league.ident && league.ident.country) || "ENG";
	// How each country dresses a ground: the stadium's shape and roof, the floodlights (lattice pylons,
	// slim poles or lamps along the roof; warm or cold white), the seats (the club's colour, one colour,
	// a mosaic of many, the flag's colours, or bare terraces), the advertising in the local language, the
	// national flags and bunting. A region's pattern with each country's own colours and words.
	const NAT_COLS = {
		ENG: [ "#ffffff", "#c8102e", "#ffffff" ], ESP: [ "#c60b1e", "#ffc400", "#c60b1e" ], FRA: [ "#0055a4", "#ffffff", "#ef4135" ], GER: [ "#15171a", "#dd0000", "#ffce00" ],
		ITA: [ "#009246", "#ffffff", "#ce2b37" ], NED: [ "#ae1c28", "#ffffff", "#21468b" ], POR: [ "#006600", "#ff0000", "#ff0000" ], BEL: [ "#15171a", "#fae042", "#ed2939" ],
		CRO: [ "#ff0000", "#ffffff", "#171796" ], DEN: [ "#c8102e", "#ffffff", "#c8102e" ], SWE: [ "#006aa7", "#fecc00", "#006aa7" ], POL: [ "#ffffff", "#dc143c", "#dc143c" ],
		SRB: [ "#c6363c", "#0c4076", "#ffffff" ], BRA: [ "#009c3b", "#ffdf00", "#002776" ], ARG: [ "#74acdf", "#ffffff", "#74acdf" ], URU: [ "#7bafd4", "#ffffff", "#fcd116" ],
		COL: [ "#fcd116", "#003893", "#ce1126" ], CHI: [ "#0039a6", "#ffffff", "#d52b1e" ], NGA: [ "#008751", "#ffffff", "#008751" ], GHA: [ "#ce1126", "#fcd116", "#006b3f" ],
		SEN: [ "#00853f", "#fdef42", "#e31b23" ], CIV: [ "#f77f00", "#ffffff", "#009e60" ], CMR: [ "#007a5e", "#ce1126", "#fcd116" ], MAR: [ "#c1272d", "#006233", "#c1272d" ],
		JPN: [ "#ffffff", "#bc002d", "#ffffff" ], KOR: [ "#ffffff", "#cd2e3a", "#0047a0" ], AUS: [ "#00843d", "#ffcd00", "#00843d" ], USA: [ "#b22234", "#ffffff", "#3c3b6e" ],
		MEX: [ "#006847", "#ffffff", "#ce1126" ]
	};
	const BOARD_WORDS = {
		en: [ "FLOODLIT", "MATCHDAY", "KICK OFF", "LEAGUE", "PREMIER", "FULL TIME", "SEASON TICKETS", "GOAL" ],
		es: [ "FLOODLIT", "JORNADA", "LIGA", "AFICIÓN", "PARTIDO", "90 MINUTOS", "GOLAZO", "GOL" ],
		pt: [ "FLOODLIT", "RODADA", "FUTEBOL", "TORCIDA", "JOGO", "90 MINUTOS", "GOLAÇO", "GOL" ],
		fr: [ "FLOODLIT", "JOURNÉE", "LIGUE", "SUPPORTERS", "MATCH", "90 MINUTES", "ALLEZ", "BUT" ],
		de: [ "FLOODLIT", "SPIELTAG", "ANSTOSS", "FANKURVE", "FLUTLICHT", "90 MINUTEN", "STADION", "TOR" ],
		it: [ "FLOODLIT", "GIORNATA", "CALCIO", "CURVA", "PARTITA", "90 MINUTI", "FORZA", "GOL" ],
		nl: [ "FLOODLIT", "SPEELDAG", "AFTRAP", "SUPPORTERS", "WEDSTRIJD", "90 MINUTEN", "STADION", "DOELPUNT" ],
		nordic: [ "FLOODLIT", "MATCHDAG", "AVSPARK", "SUPPORTERS", "LIGA", "90 MINUTER", "ARENA", "MÅL" ],
		slav: [ "FLOODLIT", "KOLO", "LIGA", "NAVIJAČI", "MECZ", "90 MINUTA", "STADION", "GOL" ]
	};
	const LANG_OF = { ESP: "es", ARG: "es", URU: "es", COL: "es", CHI: "es", MEX: "es", POR: "pt", BRA: "pt", FRA: "fr", BEL: "fr", SEN: "fr", CIV: "fr", CMR: "fr", MAR: "fr", GER: "de", ITA: "it", NED: "nl", DEN: "nordic", SWE: "nordic", POL: "slav", CRO: "slav", SRB: "slav" };
	// Lamps: a warm white (older halide), a cold LED white, or the orange-tinged sodium of an old bowl.
	const LAMP_WARM = [ 1.3, 1.22, 1.02 ], LAMP_COLD = [ 1.08, 1.18, 1.34 ], LAMP_SODIUM = [ 1.36, 1.14, 0.78 ];
	const ROOF_DARK = [ 0.11, 0.12, 0.14 ], ROOF_WHITE = [ 0.78, 0.8, 0.82 ], ROOF_SILVER = [ 0.45, 0.47, 0.5 ], ROOF_RUST = [ 0.32, 0.22, 0.17 ];
	const DRESS_REGION = {
		// British grounds: tight boxes, dark steel roofs over the sides, lattice pylons or roof lights, the club's seats.
		home: { arch: [ "monterrey", "monterrey", "azteca" ], roof: 0.85, lights: 0.5, pylon: "lattice", lamp: LAMP_WARM, roofCol: ROOF_DARK, seats: "club", flags: 0.5, bunting: 0 },
		// Northern Europe: modern bowls under white or silver roofs lit from the rim in cold LED white.
		north: { arch: [ "azteca", "akron" ], roof: 0.95, lights: 0.85, pylon: "pole", lamp: LAMP_COLD, roofCol: ROOF_WHITE, seats: "club", flags: 1, bunting: 0 },
		// Southern Europe: concrete ovals, often open, tall lattice pylons, warm lamps, seats in one colour or the flag's.
		south: { arch: [ "akron", "akron", "azteca" ], roof: 0.45, lights: 0.25, pylon: "lattice", lamp: LAMP_WARM, roofCol: ROOF_SILVER, seats: "mono", flags: 1, bunting: 0.4, concrete: [ "#3a332b", "#463e34" ] },
		// Eastern Europe: concrete bowls, rusting roofs over the main stand, old sodium lamps on pylons.
		east: { arch: [ "monterrey", "akron" ], roof: 0.6, lights: 0.2, pylon: "lattice", lamp: LAMP_SODIUM, roofCol: ROOF_RUST, seats: "national", flags: 1, bunting: 0.3 },
		// South America: open concrete bowls with bare terraces, streamers and flags everywhere, sodium pylons.
		samerica: { arch: [ "akron", "azteca" ], roof: 0.25, lights: 0.15, pylon: "lattice", lamp: LAMP_SODIUM, roofCol: ROOF_SILVER, seats: "terrace", flags: 1, bunting: 1, concrete: [ "#3b3a36", "#4a4842" ] },
		// Africa: bowls in bright mosaic seating, part-roofed, bunting in the national colours, cold LED pylons.
		africa: { arch: [ "azteca", "monterrey" ], roof: 0.5, lights: 0.3, pylon: "pole", lamp: LAMP_COLD, roofCol: ROOF_WHITE, seats: "multi", flags: 1, bunting: 1, concrete: [ "#3a3128", "#463b30" ] },
		// Japan and Korea: white membrane rings, lit from the roof, mosaic seats in quiet colours.
		asia: { arch: [ "akron", "azteca" ], roof: 1, lights: 0.9, pylon: "pole", lamp: LAMP_COLD, roofCol: ROOF_WHITE, seats: "multi", flags: 0.6, bunting: 0 },
		// The USA and Australia: big open bowls, tall slim light poles, cold light, the club's seats.
		newworld: { arch: [ "akron", "akron", "azteca" ], roof: 0.4, lights: 0.15, pylon: "pole", lamp: LAMP_COLD, roofCol: ROOF_WHITE, seats: "club", flags: 1, bunting: 0 },
		// Mexico: the Azteca itself, its seats a mosaic, flags and streamers.
		mexico: { arch: [ "azteca", "azteca", "monterrey" ], roof: 0.7, lights: 0.4, pylon: "lattice", lamp: LAMP_WARM, roofCol: ROOF_SILVER, seats: "multi", flags: 1, bunting: 1 }
	};
	const REGION_OF = {
		ENG: "home", GER: "north", NED: "north", DEN: "north", SWE: "north", BEL: "north", FRA: "north",
		ESP: "south", ITA: "south", POR: "south", CRO: "east", POL: "east", SRB: "east",
		BRA: "samerica", ARG: "samerica", URU: "samerica", COL: "samerica", CHI: "samerica",
		NGA: "africa", GHA: "africa", SEN: "africa", CIV: "africa", CMR: "africa", MAR: "africa",
		JPN: "asia", KOR: "asia", USA: "newworld", AUS: "newworld", MEX: "mexico"
	};
	// One-colour seats where a country is known for them.
	const MONO_SEAT = { ITA: "#2a4f9a", ESP: "#a8262b", POR: "#1f6b3a" };
	// The roof's sheeting and the lamps' light as CSS colours, for the 2D cameras (snow lies white on a roof).
	const css3 = (c, a) => `rgba(${c.map(v => Math.round(clamp(v, 0, 1) * 255)).join(", ")}, ${a})`;
	const roofCss = (st, a) => css3(cond.snow ? [ 0.86, 0.88, 0.9 ] : st.roofCol ? st.roofCol.map(v => v * 0.8) : [ 0.03, 0.04, 0.05 ], a);
	const lampCss = (st, a) => { const l = st.lamp || [ 1.3, 1.22, 1.02 ], m = Math.max(...l); return css3(l.map(v => 0.55 + 0.45 * v / m), a); };
	// An empty seat's colour under the ground's scheme: f is how far back its row is (0 front, 1 back),
	// k any number that differs from seat to seat. Null on a bare terrace.
	const MULTI_SEATS = [ "#c8102e", "#f2b52e", "#1d4fa0", "#1f7a45", "#e0662f", "#d9dcdf", "#2fb8b0", "#6a3d9a" ];
	function seatColOf (st, f, k) {
		const h = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
		switch (st.seats) {
		case "terrace": return null;
		case "mono": return st.monoSeat;
		case "national": return st.natCols[Math.min(2, Math.floor(clamp(f, 0, 0.999) * 3))];
		case "multi": return MULTI_SEATS[Math.floor(h * MULTI_SEATS.length)];
		default: return st.seat;
		}
	}
	function dressFor (nat, r) {
		const D = DRESS_REGION[REGION_OF[nat]] || DRESS_REGION.home, cols = NAT_COLS[nat] || NAT_COLS.ENG;
		const words = (BOARD_WORDS[LANG_OF[nat] || "en"]).slice();
		if (FOREIGN[nat]) { words[4] = FOREIGN[nat][0].toUpperCase(); }   // the league's own name on one board
		const out = {
			nat, region: REGION_OF[nat] || "home", arch: D.arch[Math.floor(r() * D.arch.length)], roof: r() < D.roof,
			lights: r() < D.lights ? "roof" : "pylons", pylon: D.pylon, lamp: D.lamp, roofCol: D.roofCol, seats: D.seats, monoSeat: MONO_SEAT[nat] || cols[0],
			natCols: cols, words, flags: r() < D.flags, bunting: r() < D.bunting
		};
		if (D.concrete) { out.concrete = D.concrete[0]; out.steps = D.concrete[1]; }
		if (!out.roof && out.lights === "roof") { out.lights = "pylons"; }
		return out;
	}
	function buildCrowd () {
		const R = 2;
		const mk = (w, h) => {
			const c = document.createElement("canvas");
			c.width = Math.max(1, Math.round(w * R)); c.height = Math.max(1, Math.round(h * R));
			const g = c.getContext && c.getContext("2d");
			if (g && g.scale) { g.scale(R, R); }
			return [ c, g ];
		};
		const homeC = homeSide === 0 ? KITS[0].outfield : KITS[1].outfield, awayC = homeSide === 0 ? KITS[1].outfield : KITS[0].outfield;
		const club = leagueMatch ? (leagueMatch.home ? YOU : TEAMS[leagueMatch.opp]) : YOU;
		const st = gstyle = groundStyle(club);
		const neutral = [ "#3a4a42", "#56645c", "#7a857e", "#2c3531", "#eef2ec" ];
		const skins = [ "#f1c9a5", "#e0ac86", "#c68a5e", "#9c6a44", "#6e4a30" ];
		let h = 11;
		const rnd = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
		const fan = (g, x, y, away) => {
			if (!away && rnd() > st.fill) {   // an empty seat (none on a bare terrace)
				const sc = seatColOf(st, (y % MY) / MY, x * 7.1 + y * 3.3);
				if (sc) { g.fillStyle = sc; g.globalAlpha = 0.55; g.fillRect(x - 2.4, y - 1.5, 4.8, 4.5); g.globalAlpha = 1; }
				return;
			}
			const r = rnd();
			g.fillStyle = away ? (r < 0.75 ? awayC : neutral[Math.floor(r * 50) % 5]) : (r < 0.7 ? homeC : neutral[Math.floor(r * 50) % 5]);
			g.fillRect(x - 2.2, y - 0.5, 4.4, 4.2);
			g.fillStyle = skins[Math.floor(rnd() * skins.length)];
			g.beginPath(); g.arc(x, y - 2.4, 1.8, 0, Math.PI * 2); g.fill();
		};
		const concrete = (g, w, hh) => {
			g.fillStyle = st.concrete; g.fillRect(0, 0, w, hh);
			g.fillStyle = st.steps;
			for (let y = 0; y < hh; y += 7) { g.fillRect(0, y, w, 3); }   // the steps
		};
		const boards = (g, w, y) => {
			const cols = st.boards;
			for (let x = 0, k = 0; x < w; x += 90, k++) { g.fillStyle = cols[k % cols.length]; g.fillRect(x, y, 88, 6); }
		};
		const [ top, gt ] = mk(WW, MY), [ bottom, gb ] = mk(WW, MY), [ left, gl ] = mk(MX, FH), [ right, gr ] = mk(MX, FH);
		if (gt && gt.fillRect) {
			concrete(gt, WW, MY); concrete(gb, WW, MY); concrete(gl, MX, FH); concrete(gr, MX, FH);
			for (let x = 5; x < WW - 3; x += 7) { for (let y = 6; y < MY - 10; y += 7) { fan(gt, x, y, x > WW * 0.82); } }
			for (let x = 5; x < WW - 3; x += 7) { for (let y = 14; y < MY - 2; y += 7) { fan(gb, x, y, false); } }
			const goalBand = y => y > GOAL_T - 14 && y < GOAL_B + 14;
			for (let y = 5; y < FH - 3; y += 7) {
				for (let x = 4; x < MX - 4; x += 7) {
					if (goalBand(y) && x > MX - NET - 6) { continue; }   // the goals sit here
					fan(gl, x, y, false); fan(gr, MX - x, y, false);
				}
			}
			boards(gt, WW, MY - 8); boards(gb, WW, 1);
			// A roof over the main stands, with the floodlights along its edge at some grounds.
			if (st.roof) {
				gt.fillStyle = gb.fillStyle = roofCss(st, 0.85); gt.fillRect(0, 0, WW, 5); gb.fillRect(0, MY - 5, WW, 5);
				if (st.lights === "roof") {
					gt.fillStyle = gb.fillStyle = lampCss(st, 1);
					for (let x = 20; x < WW; x += 60) { gt.fillRect(x, 1, 18, 2.5); gb.fillRect(x, MY - 3.5, 18, 2.5); }
				}
			}
			// The ground's name, picked out across the main stand.
			const ground = (leagueMatch ? (leagueMatch.home ? YOU : TEAMS[leagueMatch.opp]).ground : YOU.ground).toUpperCase();
			gt.save && gt.save();
			gt.globalAlpha = 1;   // a solid sign board on the stand, not lettering washed over the crowd
			gt.fillStyle = "#0d1612";
			gt.font = "900 30px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
			gt.textAlign = "center"; gt.textBaseline = "middle";
			const tw = gt.measureText ? gt.measureText(ground).width : 200;
			gt.fillRect(WW / 2 - (Number(tw) || 200) / 2 - 14, 8, (Number(tw) || 200) + 28, 34);
			gt.fillStyle = "#f2b52e"; gt.fillRect(WW / 2 - (Number(tw) || 200) / 2 - 14, 40, (Number(tw) || 200) + 28, 2);   // a trim along its foot
			gt.fillStyle = "#eef2ec";
			gt.fillText(ground, WW / 2, 26);
			gt.restore && gt.restore();
		}
		stands = { top, bottom, left, right };
	}
	// The far stand carries the ground's name. In a mirrored second half it is drawn from a
	// flipped copy, so the name still reads the right way.
	function standTop () {
		if (!endsSwapped() || !stands) { return stands && stands.top; }
		if (stands.topM === undefined) {
			stands.topM = null;
			try {
				const src = stands.top, c = document.createElement("canvas");
				c.width = src.width; c.height = src.height;
				const g = c.getContext && c.getContext("2d");
				if (g && g.drawImage) { g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); stands.topM = c; }
			} catch (e) { stands.topM = null; }
		}
		return stands.topM || stands.top;
	}
	function drawStands (quiet = false) {
		if (!stands) { return; }
		ctx.drawImage(standTop(), 0, 0, WW, MY);
		ctx.drawImage(stands.bottom, 0, MY + FH, WW, MY);
		ctx.drawImage(stands.left, 0, MY, MX, FH);
		ctx.drawImage(stands.right, MX + FW, MY, MX, FH);
		// A home cheer runs through the stands as a wave of the home colours; the away corner flickers
		// in theirs when their side does something; a groan dims the home stands.
		if (!quiet && !reduceMotion) {
			const m = crowdMood, tt = performance.now() / 1000;
			const hk = KITS[homeSide] ? KITS[homeSide].outfield : "#f2b52e", ak = KITS[1 - homeSide] ? KITS[1 - homeSide].outfield : "#de4f5a";
			if (m.home > 0.08) {
				ctx.fillStyle = hk;
				for (let i = 0; i < 28; i++) {
					const x = i / 28 * WW, a = m.home * 0.32 * (0.5 + 0.5 * Math.sin(tt * 7 - i * 0.7));
					ctx.globalAlpha = a; ctx.fillRect(x, 0, WW / 28 + 1, MY); ctx.fillRect(x, MY + FH, WW / 28 + 1, MY);
				}
			} else if (m.home < -0.08) {
				ctx.fillStyle = "#000"; ctx.globalAlpha = Math.min(0.35, -m.home * 0.4);
				ctx.fillRect(0, 0, WW, MY); ctx.fillRect(0, MY + FH, WW, MY);
			}
			if (m.away > 0.08) {
				ctx.fillStyle = ak; ctx.globalAlpha = m.away * 0.45 * (0.6 + 0.4 * Math.sin(tt * 11));
				ctx.fillRect(WW * 0.8, 0, WW * 0.2, MY);
			}
			ctx.globalAlpha = 1;
		}
		// When the crowd is on its feet, the odd camera flash goes off.
		if (!quiet && !reduceMotion && crowdHeat > 0.55 && Math.random() < crowdHeat * 0.5) {
			ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
			const top = Math.random() < 0.5;
			ctx.fillRect(Math.random() * WW, top ? Math.random() * (MY - 10) : MY + FH + 14 + Math.random() * (MY - 16), 2.5, 2.5);
		}
	}

	// The dugouts on the near touchline: substitutes on the bench, and each manager in his
	// technical area following the play.
	function drawDugouts () {
		const w = 190 * Math.sqrt(S), y0 = MY + FH + 16, hh = 40;
		const sides = [ { team: 0, cx: MX + FW / 2 - w * 0.62 - 20, label: "YOUR BENCH" }, { team: 1, cx: MX + FW / 2 + w * 0.62 + 20, label: `${opp.short.toUpperCase()} BENCH` } ];
		for (const d of sides) {
			const kit = KITS[d.team], x0 = d.cx - w / 2;
			ctx.fillStyle = "rgba(8, 13, 11, 0.92)";
			ctx.fillRect(x0, y0, w, hh);
			ctx.fillStyle = "rgba(140, 180, 200, 0.18)";   // the perspex roof
			ctx.fillRect(x0, y0, w, 6);
			ctx.strokeStyle = "rgba(238, 246, 234, 0.35)";
			ctx.lineWidth = 1.2;
			ctx.strokeRect(x0, y0, w, hh);
			// The substitutes, sitting in their kit.
			const n = 6;
			for (let i = 0; i < n; i++) {
				const bx = x0 + 16 + i * ((w - 32) / (n - 1)), by = y0 + 26;
				ctx.fillStyle = kit.outfield;
				ctx.beginPath(); ctx.ellipse(bx, by, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
				ctx.strokeStyle = "rgba(0, 0, 0, 0.5)"; ctx.lineWidth = 1; ctx.stroke();
				ctx.fillStyle = [ "#f1c9a5", "#c68a5e", "#9c6a44", "#e0ac86" ][(i + d.team) % 4];
				ctx.beginPath(); ctx.arc(bx, by - 7, 4, 0, Math.PI * 2); ctx.fill();
			}
			// The coaching staff, in club tracksuits, standing at the end of the dugout: yours are the
			// ones you've hired; theirs grow with the club.
			const nStaff = d.team === 0 ? (mode === "league" && league && league.club && league.club.staff ? Object.values(league.club.staff).filter(Boolean).length : 2) : clamp(Math.round(oppStrength), 1, 5);
			for (let i = 0; i < nStaff; i++) {
				const sx = x0 - 10 - (i % 3) * 13 * (d.team === 0 ? 1 : -1) + (d.team === 0 ? 0 : w + 20), sy = y0 + 12 + Math.floor(i / 3) * 16;
				ctx.fillStyle = "#2a2f38";
				ctx.beginPath(); ctx.ellipse(sx, sy, 6.5, 5, 0, 0, Math.PI * 2); ctx.fill();
				ctx.strokeStyle = kit.outfield; ctx.lineWidth = 1.2; ctx.stroke();
				ctx.fillStyle = [ "#e0ac86", "#9c6a44", "#f1c9a5" ][(i + d.team) % 3];
				ctx.beginPath(); ctx.arc(sx, sy - 5.5, 3.2, 0, Math.PI * 2); ctx.fill();
			}
			ctx.font = "700 11px Barlow, Arial, sans-serif";
			ctx.textAlign = "center"; ctx.textBaseline = "middle";
			const lw = ctx.measureText(d.label).width + 12;
			ctx.fillStyle = "rgba(8, 13, 11, 0.9)";
			ctx.fillRect(d.cx - lw / 2, y0 + hh + 1, lw, 14);
			ctx.fillStyle = "#eef6ea";
			ctx.fillText(d.label, d.cx, y0 + hh + 8.5);
			// The technical area, marked out in white in front of the dugout.
			ctx.strokeStyle = "rgba(238, 246, 234, 0.55)"; ctx.lineWidth = 1;
			ctx.setLineDash([ 4, 3 ]);
			ctx.strokeRect(x0 - 8, MY + FH + 1, w + 16, 12);
			ctx.setLineDash([]);
			// The manager: out of the dugout, drifting with the play, pacing when it's tense.
			const drift = clamp((ball.x - FW / 2) * 0.06, -w * 0.35, w * 0.35) + (reduceMotion ? 0 : Math.sin(frame * 0.05 + d.team * 2) * 6 * crowdHeat);
			const mx = d.cx + drift, my = MY + FH + 7;
			ctx.fillStyle = d.team === 0 ? "#1f2430" : "#3a2a2a";
			ctx.beginPath(); ctx.ellipse(mx, my, 9.5, 7, 0, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = kit.outfield; ctx.lineWidth = 1.5; ctx.stroke();   // a club scarf, so you know whose he is
			ctx.fillStyle = "#e0ac86";
			ctx.beginPath(); ctx.arc(mx, my - 7, 4.4, 0, Math.PI * 2); ctx.fill();
			if (benchCam()) {   // on the cutaway, say who he is
				ctx.font = "700 10px Barlow, Arial, sans-serif";
				const tag = d.team === 0 ? "YOUR MANAGER" : "THEIR MANAGER", tw = ctx.measureText(tag).width + 10;
				ctx.fillStyle = "rgba(8, 13, 11, 0.85)";
				ctx.fillRect(mx - tw / 2, my - 30, tw, 13);
				ctx.fillStyle = "#f2b52e";
				ctx.fillText(tag, mx, my - 23.5);
			}
			if (state === "goal" && lastScorer >= 0) {
				if (lastScorer === d.team) {   // both arms up, and a little jump
					const hop = reduceMotion ? 0 : Math.abs(Math.sin(frame * 0.25)) * 3;
					ctx.strokeStyle = d.team === 0 ? "#1f2430" : "#3a2a2a"; ctx.lineWidth = 2.6;
					ctx.beginPath(); ctx.moveTo(mx - 5, my - 2 - hop); ctx.lineTo(mx - 9, my - 14 - hop); ctx.moveTo(mx + 5, my - 2 - hop); ctx.lineTo(mx + 9, my - 14 - hop); ctx.stroke();
				}
				else {   // hands on head
					ctx.strokeStyle = d.team === 0 ? "#1f2430" : "#3a2a2a"; ctx.lineWidth = 2.6;
					ctx.beginPath(); ctx.moveTo(mx - 6, my - 1); ctx.lineTo(mx - 4, my - 10); ctx.moveTo(mx + 6, my - 1); ctx.lineTo(mx + 4, my - 10); ctx.stroke();
				}
				continue;
			}
			const urging = crowdHeat > 0.6 && (d.team === 0 ? ball.x > FW * 0.6 : ball.x < FW * 0.4);
			if (urging) {   // arm up, urging them on
				ctx.strokeStyle = "#1f2430"; ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo(mx + 4, my - 2); ctx.lineTo(mx + 8, my - 11); ctx.stroke();
			}
		}
	}


	function drawGoal (x0, left) {
		const y0 = MY + GOAL_T, h = GOAL_B - GOAL_T;
		ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
		ctx.fillRect(x0, y0, NET, h);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let x = x0; x <= x0 + NET; x += 7.5) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); }
		for (let y = y0; y <= y0 + h; y += 7.5) { ctx.moveTo(x0, y); ctx.lineTo(x0 + NET, y); }
		ctx.stroke();
		ctx.strokeStyle = "#f7faf5";
		ctx.lineWidth = 5;
		ctx.lineCap = "round";
		ctx.beginPath();
		const mouth = left ? x0 + NET : x0, back = left ? x0 : x0 + NET;
		ctx.moveTo(mouth, y0); ctx.lineTo(back, y0); ctx.lineTo(back, y0 + h); ctx.lineTo(mouth, y0 + h);
		ctx.stroke();
		ctx.lineCap = "butt";
	}

	// The referee's vanishing spray: the 9.15 m the other side must give, and the line for the wall.
	function drawFreeKickSpray () {
		if (!setPiece || setPiece.kind !== "free" || ball.owner !== setPiece.taker) { return; }
		const X = MX + ball.x, Y = MY + ball.y, R = fkDist();
		ctx.save();
		ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
		ctx.lineWidth = 2;
		ctx.setLineDash([ 3, 7 ]);
		ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke();
		if (setPiece.wall && setPiece.wall.length) {
			const w = setPiece.wall, a = w[0], b = w[w.length - 1];
			const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ex = dx / L * 14, ey = dy / L * 14;
			// the line sits just in front of the wall, toward the ball
			const nx = (ball.x - (a.x + b.x) / 2), ny = (ball.y - (a.y + b.y) / 2), nl = Math.hypot(nx, ny) || 1;
			const ox = nx / nl * 13, oy = ny / nl * 13;
			ctx.setLineDash([]);
			ctx.lineWidth = 3;
			ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
			ctx.beginPath(); ctx.moveTo(MX + a.x - ex + ox, MY + a.y - ey + oy); ctx.lineTo(MX + b.x + ex + ox, MY + b.y + ey + oy); ctx.stroke();
		}
		ctx.restore();
	}

	// Dashed amber ring under the teammate your pass would reach.
	function drawPassTarget () {
		if (state !== "play" || freeze > 0) { return; }
		const p = human();
		if (!p || ball.owner !== p) { return; }
		const m = passTarget(p);
		if (!m) { return; }
		const X = MX + m.x, Y = MY + m.y;
		ctx.save();
		ctx.strokeStyle = "rgba(242, 181, 46, 0.95)";
		ctx.lineWidth = 2.5;
		ctx.setLineDash([ 6, 5 ]);
		ctx.lineDashOffset = reduceMotion ? 0 : -frame * 0.5;
		ctx.beginPath(); ctx.arc(X, Y, 24, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();
	}

	// Amber "Q" over the player a long ball would find.
	function drawStrikerMarker () {
		if (state !== "play" || freeze > 0) { return; }
		const p = human();
		if (!p || ball.owner !== p) { return; }
		const m = strikerTarget(p);
		if (!m) { return; }
		ctx.fillStyle = "rgba(242, 181, 46, 0.95)";
		ctx.font = "800 15px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("Q", MX + m.x, MY + m.y - 36);
	}

	function drawAim () {
		const p = human();
		if (!charging || state !== "play" || !p || ball.owner !== p || aimY === null || !shotInRange(p)) { return; }
		const power = clamp((frame - chargeStart) / 50, 0, 1), spread = shotSpread(p, power);
		const gx = MX + FW, gy = MY + aimY;
		ctx.save();
		// Where it could end up at this power: the amber band on the goal line.
		ctx.fillStyle = "rgba(242, 181, 46, 0.28)";
		ctx.fillRect(gx - 3, gy - spread, 10, spread * 2);
		ctx.strokeStyle = "rgba(242, 181, 46, 0.7)";
		ctx.lineWidth = 1.5;
		ctx.setLineDash([ 6, 6 ]);
		ctx.beginPath(); ctx.moveTo(MX + ball.x, MY + ball.y); ctx.lineTo(gx, gy); ctx.stroke();
		ctx.setLineDash([]);
		ctx.strokeStyle = "#f2b52e";
		ctx.lineWidth = 2.5;
		ctx.beginPath(); ctx.arc(gx + 2, gy, 8, 0, Math.PI * 2); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(gx - 10, gy); ctx.lineTo(gx + 14, gy); ctx.moveTo(gx + 2, gy - 12); ctx.lineTo(gx + 2, gy + 12); ctx.stroke();
		ctx.restore();
	}

	// The stretcher and the two medics carrying it.
	function drawStretcher (three) {
		const q = stretcherPos();
		if (!q) { return; }
		const P = (x, y) => (three ? proj3D(x, clamp(y, -40, FH + 40), 0) : { x: MX + x, y: MY + y, k: 1 });
		const a = P(q.x - 15, q.y), b = P(q.x + 15, q.y), m1 = P(q.x - 22, q.y), m2 = P(q.x + 22, q.y);
		if (!a || !b || !m1 || !m2) { return; }
		const k = three ? a.k : 1;
		ctx.save();
		ctx.strokeStyle = "#d9dee0"; ctx.lineWidth = Math.max(3, 8 * k);
		ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
		for (const m of [ m1, m2 ]) {
			const r = Math.max(4, 7 * k), y = three ? m.y - 14 * k : m.y;
			ctx.fillStyle = "#f4f4f4"; ctx.strokeStyle = "rgba(0, 0, 0, 0.5)"; ctx.lineWidth = 1;
			ctx.beginPath(); ctx.arc(m.x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.fillStyle = "#d8343f"; ctx.fillRect(m.x - r * 0.18, y - r * 0.62, r * 0.36, r * 1.24); ctx.fillRect(m.x - r * 0.62, y - r * 0.18, r * 1.24, r * 0.36);
		}
		ctx.restore();
	}
	// Running on empty: a battery with a sliver of red left.
	function drawTired (x, y) {
		ctx.save();
		ctx.fillStyle = "rgba(10, 14, 12, 0.75)"; ctx.fillRect(x - 1, y - 1, 13, 8);
		ctx.strokeStyle = "#eef6ea"; ctx.lineWidth = 1; ctx.strokeRect(x, y, 10, 6); ctx.fillStyle = "#eef6ea"; ctx.fillRect(x + 10, y + 2, 2, 2);
		ctx.fillStyle = "#e8505b"; ctx.fillRect(x + 1, y + 1, 3, 4);
		ctx.restore();
	}
	// A tight call frozen: the line across the pitch and the man it is about.
	function drawReview (three) {
		if (!review || state !== "play") { return; }
		const x = review.lineX, p = review.p, pulse = reduceMotion ? 0 : Math.sin(review.n * 0.25) * 0.15;
		ctx.save();
		ctx.strokeStyle = `rgba(236, 72, 86, ${0.82 + pulse})`; ctx.lineWidth = 4; ctx.shadowColor = "rgba(255, 255, 255, 0.7)"; ctx.shadowBlur = 6;
		if (three) {
			let a = null;
			ctx.beginPath();
			for (let k = 0; k <= 16; k++) {
				const b = proj3D(x, FH * k / 16, 1);
				if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
				a = b;
			}
			ctx.stroke();
			const q = players.includes(p) ? proj3D(p.x, p.y, 0) : null;
			if (q) { ctx.strokeStyle = "#f2b52e"; ctx.beginPath(); ctx.ellipse(q.x, q.y, 22 * q.k, 9 * q.k, 0, 0, Math.PI * 2); ctx.stroke(); }
		} else {
			ctx.beginPath(); ctx.moveTo(MX + x, MY); ctx.lineTo(MX + x, MY + FH); ctx.stroke();
			if (players.includes(p)) { ctx.strokeStyle = "#f2b52e"; ctx.beginPath(); ctx.arc(MX + p.x, MY + p.y, 22, 0, Math.PI * 2); ctx.stroke(); }
		}
		ctx.restore();
	}
	// Your penalty: a crosshair on the side of the goal you're leaning to (the middle if you're square).
	function drawPenAim (three) {
		if (!setPiece || setPiece.kind !== "pen" || state !== "play" || setPiece.team !== 0 || ball.owner !== setPiece.taker || setPiece.taker !== human()) { return; }
		const s = Math.sin(setPiece.taker.dir), lean = s > 0.1 ? 1 : s < -0.1 ? -1 : 0, y = FH / 2 + lean * FMT.goal * 0.36;
		let X, Y, r = 9;
		if (three) { const q = proj3D(FW, y, 22); if (!q) { return; } X = q.x; Y = q.y; r = Math.max(6, 11 * q.k); } else { X = MX + FW; Y = MY + y; }
		ctx.save();
		ctx.strokeStyle = "#f2b52e"; ctx.lineWidth = 2.5;
		ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(X - r - 5, Y); ctx.lineTo(X + r + 5, Y); ctx.moveTo(X, Y - r - 5); ctx.lineTo(X, Y + r + 5); ctx.stroke();
		ctx.restore();
	}

	// While you have the ball: the offside line, and a red mark on anyone beyond it.
	function drawOffsideLine () {
		if (!offsideOn() || state !== "play" || freeze > 0) { return; }
		const me = human();
		if (!me || ball.owner !== me) { return; }
		const line = offsideLine(0);
		if (line <= FW / 2 + 1) { return; }
		ctx.save();
		ctx.strokeStyle = "rgba(222, 79, 90, 0.55)";
		ctx.lineWidth = 2;
		ctx.setLineDash([ 10, 8 ]);
		ctx.beginPath(); ctx.moveTo(MX + line, MY); ctx.lineTo(MX + line, MY + FH); ctx.stroke();
		ctx.restore();
		for (const m of players) {
			if (m.team !== 0 || m === me || m.role === "gk" || !isOffside(m, line)) { continue; }
			ctx.fillStyle = "rgba(222, 79, 90, 0.95)";
			ctx.font = "800 11px Barlow, Arial, sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("OFF", MX + m.x, MY + m.y + 24);
		}
	}

	// How crowded the man S would switch to is (0 in space, 1 with a man at his shoulder), eased so the
	// ring doesn't twitch: his ring draws in close round him in a crowd, so it never laps the men beside him.
	function switchRingTight (m) {
		let dn = 1e9;
		for (const q of players) { if (q !== m) { dn = Math.min(dn, Math.hypot(q.x - m.x, q.y - m.y)); } }
		const t = clamp((34 - dn) / 20, 0, 1);
		m.ringT = m.ringT === undefined ? t : m.ringT + (t - m.ringT) * 0.15;
		return m.ringT;
	}

	// Hollow marker over the player S would switch to while you defend.
	function drawSwitchPreview () {
		if (state !== "play" || freeze > 0 || receiver) { return; }
		if ((ball.owner && ball.owner.team === 0) || inHands(ball.owner)) { return; }
		const m = nextSwitchTarget();
		if (!m) { return; }
		const X = MX + m.x, Y = MY + m.y, t = switchRingTight(m);
		ctx.strokeStyle = `rgba(255, 255, 255, ${(0.7 - 0.25 * t).toFixed(2)})`;
		ctx.lineWidth = 2 - 0.5 * t;
		ctx.setLineDash([ 5 - t, 4 ]);
		ctx.beginPath(); ctx.arc(X, Y, 18 - 6 * t, reduceMotion ? 0 : frame * 0.03, (reduceMotion ? 0 : frame * 0.03) + Math.PI * 2); ctx.stroke();
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(X - 7, Y - 37); ctx.lineTo(X + 7, Y - 37); ctx.lineTo(X, Y - 29);
		ctx.closePath(); ctx.stroke();
		drawKeyChip(X, Y - 47, "S");
	}

	// A key cap on the pitch: dark chip, white letter, so it reads against grass, chalk and kits.
	function drawKeyChip (x, y, key) {
		ctx.save();
		ctx.font = "800 11px Barlow, Arial, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		const w = Math.max(16, ctx.measureText(key).width + 9);
		ctx.fillStyle = "rgba(7, 12, 10, 0.78)";
		ctx.beginPath();
		if (ctx.roundRect) { ctx.roundRect(x - w / 2, y - 8, w, 16, 3); } else { ctx.rect(x - w / 2, y - 8, w, 16); }
		ctx.fill();
		ctx.strokeStyle = "rgba(255, 255, 255, 0.55)"; ctx.lineWidth = 1;
		ctx.stroke();
		ctx.fillStyle = "#ffffff";
		ctx.fillText(key, x, y + 0.5);
		ctx.restore();
	}

	// A top-down footballer: legs that stride, shorts, a two-tone shirt, swinging
	// arms and a head with hair, all turned to face the way the player is going.
	const SKIN = [ "#f1c9a5", "#e0ac86", "#c68a5e", "#9c6a44", "#6e4a30", "#4a3222" ];
	const HAIR = [ "#1b1410", "#3b2616", "#6b4424", "#a0703a", "#d8b46a", "#2a2a2a" ];
	function look (p) {
		if (!p.look) {
			// Fixed by name, so a player looks the same every match. hashStr is unsigned: shift with >>>,
			// or half the squad gets a negative face index (a blank head) and no hair colour.
			const h = hashStr((p.name || `${p.team}-${p.idx}-${p.num}`) + "look");
			// The broad style is fixed by the hash as before; a second draw splits it (crop or short,
			// curly or a full afro, long or tied back), so nobody's look changes beyond recognition.
			const base = [ "short", "short", "short", "curly", "long", "buzz", "shaved" ][(h >>> 5) % 7], alt = (h >>> 13) % 2;
			const style = base === "short" && alt ? "crop" : base === "curly" && alt ? "afro" : base === "long" && alt ? "tied" : base;
			p.look = { skin: SKIN[h % SKIN.length], hair: HAIR[(h >>> 2) % HAIR.length], shaved: style === "shaved", style, face: (h >>> 9) % 16 };
		}
		return p.look;
	}

	function drawFigure (p, X, Y, kit) {
		const fx = Math.cos(p.dir), fy = Math.sin(p.dir), sx = -fy, sy = fx;
		// Stride and swing come from the simulation (see stepLimbs), not the screen's refresh rate.
		// Shuffling steps are short; a planted cut leans back against the turn.
		const sw = reduceMotion ? 0 : Math.sin(p.stride || 0) * (3 + 7 * (p.runAmt || 0)) * (p.runAmt || 0) * (1 - 0.5 * (p.shuf || 0));
		const sliding = p.lunge > 0 || p.slideAI > 0, gk = p.role === "gk", lk = look(p);
		const ks = reduceMotion ? null : kickSwing(p), kSide = build(p).left ? -1 : 1;
		if (!reduceMotion && (p.runAmt || 0) < 0.15 && !sliding) {   // standing: a little weight shift
			const w = Math.sin(p.idlePh || 0) * 0.9;
			X += -fy * w; Y += fx * w;
		}
		const twist = reduceMotion ? 0 : Math.sin(p.stride || 0) * 0.14 * (p.runAmt || 0);   // shoulders against the hips
		const shirt = gk ? kit.gk : kit.outfield, trim = gk ? "#1f2a36" : kit.second;
		const outline = lum(shirt) < 0.18 ? "rgba(235, 242, 238, 0.7)" : "rgba(0, 0, 0, 0.5)";

		// Legs and boots: they swing opposite each other with the stride; a slide puts both out front.
		ctx.lineCap = "round";
		for (const side of [ -1, 1 ]) {
			const hx = X + sx * side * 4, hy = Y + sy * side * 4;
			const reach = sliding ? 15 : (p.kneel || 0) > 0.3 ? -9 * p.kneel : ks ? (side === kSide ? ks.s * 14 : -1.5) : side * sw;
			const ftx = hx + fx * reach, fty = hy + fy * reach;
			ctx.strokeStyle = shirt;
			ctx.lineWidth = 4.5;
			ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ftx, fty); ctx.stroke();
			ctx.fillStyle = "#15181a";
			ctx.beginPath(); ctx.arc(ftx + fx * 1.5, fty + fy * 1.5, 3, 0, Math.PI * 2); ctx.fill();
		}

		// Shorts, then the shirt with sleeves in the trim colour.
		ctx.fillStyle = trim;
		ctx.beginPath(); ctx.ellipse(X - fx * 1.5, Y - fy * 1.5, 5.5, 8, p.dir, 0, Math.PI * 2); ctx.fill();
		// The shirt: every outfielder on a side wears the same design; keepers wear their own colour.
		ctx.save();
		ctx.translate(X, Y);
		ctx.rotate(p.dir - twist);   // local x points the way the player faces, y runs shoulder to shoulder
		ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 12.5, 0, 0, Math.PI * 2);
		ctx.fillStyle = shirt;
		ctx.fill();
		const pattern = gk ? "plain" : kit.pattern || "plain";
		if (pattern !== "plain") {
			ctx.save();
			ctx.clip();
			ctx.fillStyle = trim;
			if (pattern === "stripes") { for (let y = -11.5; y < 12; y += 4.6) { ctx.fillRect(-7, y, 14, 2.3); } }
			else if (pattern === "hoops") { for (let x = -6.5; x < 7; x += 4.4) { ctx.fillRect(x, -12, 2.2, 24); } }
			else if (pattern === "halves") { ctx.fillRect(-7, 0, 14, 12); }
			else if (pattern === "sash") { ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(-2, -12); ctx.lineTo(7, 10); ctx.lineTo(2, 12); ctx.closePath(); ctx.fill(); }
			ctx.restore();
		}
		// Floodlight from the top left: the far side of the shirt falls into shade.
		{
			const la = Math.PI * 1.25 - (p.dir - twist);
			ctx.save();
			ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 12.5, 0, 0, Math.PI * 2); ctx.clip();
			ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
			ctx.beginPath(); ctx.ellipse(-Math.cos(la) * 5, -Math.sin(la) * 7, 7.5, 12.5, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		}
		ctx.strokeStyle = outline;
		ctx.lineWidth = 1.4;
		ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 12.5, 0, 0, Math.PI * 2); ctx.stroke();
		// Collar at the front of the neck.
		ctx.strokeStyle = trim;
		ctx.lineWidth = 1.6;
		ctx.beginPath(); ctx.arc(1.5, 0, 5.2, -0.9, 0.9); ctx.stroke();
		ctx.restore();

		// Arms swing against the legs; keepers wear gloves. In the air they go up and out.
		const up = Math.max(jumpAmt(p), (p.celebA || 0) * 1.3);
		for (const side of [ -1, 1 ]) {
			const ax = X + sx * side * (11.5 + up * 4) - fx * side * sw * 0.6 + fx * up * 5, ay = Y + sy * side * (11.5 + up * 4) - fy * side * sw * 0.6 + fy * up * 5;
			ctx.fillStyle = trim;
			ctx.beginPath(); ctx.arc(X + sx * side * 9.5, Y + sy * side * 9.5, 3.4, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = gk ? "#e8f7a1" : lk.skin;
			ctx.beginPath(); ctx.arc(ax + fx * 2, ay + fy * 2, gk ? 3.6 : 2.8, 0, Math.PI * 2); ctx.fill();
		}

		// Shirt number on the back, then the head with hair on the back of it.
		ctx.fillStyle = gk ? "#0e1a24" : kit.ink;
		ctx.font = "800 8px Barlow, Arial, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(String(p.num), X - fx * 5.5, Y - fy * 5.5);
		const hx = X + fx * 1.5, hy = Y + fy * 1.5;
		ctx.fillStyle = lk.skin;
		ctx.beginPath(); ctx.arc(hx, hy, 5.4, 0, Math.PI * 2); ctx.fill();
		if (!lk.shaved) {
			ctx.fillStyle = lk.hair;
			const big = lk.style === "afro" ? 7.2 : lk.style === "curly" ? 6.4 : lk.style === "buzz" ? 5.4 : 5.6, span = lk.style === "buzz" ? 0.3 : lk.style === "curly" ? 0.42 : 0.55;
			ctx.beginPath(); ctx.arc(hx, hy, big, p.dir + Math.PI * span, p.dir + Math.PI * (2 - span)); ctx.closePath(); ctx.fill();
			if (lk.style === "long") { ctx.beginPath(); ctx.ellipse(hx - fx * 6, hy - fy * 6, 3.2, 2.4, p.dir, 0, Math.PI * 2); ctx.fill(); }
			if (lk.style === "tied") { ctx.beginPath(); ctx.arc(hx - fx * 5, hy - fy * 5, 2, 0, Math.PI * 2); ctx.fill(); }
		}
		ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.arc(hx, hy, 5.4, 0, Math.PI * 2); ctx.stroke();
		ctx.lineCap = "butt";
	}

	function drawPlayer (p) {
		const X = MX + p.x, Y = MY + p.y;
		const kit = KITS[p.team];
		const isHuman = p.team === 0 && players.indexOf(p) === ctrl && state !== "intro";

		ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
		ctx.beginPath(); ctx.ellipse(X + 4, Y + 8, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
		// Sprinting: speed streaks behind him.
		if ((p.sprintAmt || 0) > 0.45 && Math.hypot(p.vx, p.vy) > 1.2) {
			const a = Math.atan2(p.vy, p.vx), c = Math.cos(a), sn = Math.sin(a);
			ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * p.sprintAmt})`; ctx.lineWidth = 2;
			ctx.beginPath();
			for (const o of [ -7, 0, 7 ]) {
				const bx = X - c * 20 - sn * o, by = Y - sn * 20 + c * o;
				ctx.moveTo(bx, by); ctx.lineTo(bx - c * (12 + Math.abs(o)), by - sn * (12 + Math.abs(o)));
			}
			ctx.stroke();
		}
		// Team disc: every player stands on a ring of their side's shirt colour (keepers in theirs).
		const disc = p.role === "gk" ? kit.gk : kit.outfield;
		ctx.save();
		ctx.globalAlpha = 0.42;
		ctx.fillStyle = disc;
		ctx.beginPath(); ctx.arc(X, Y, 17, 0, Math.PI * 2); ctx.fill();
		ctx.globalAlpha = 0.95;
		ctx.strokeStyle = disc;
		ctx.lineWidth = highContrast && p.team === 1 ? 3 : 2;
		if (highContrast && p.team === 1) { ctx.setLineDash([ 5, 4 ]); }   // shape as well as colour tells the sides apart
		ctx.beginPath(); ctx.arc(X, Y, 17, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();

		if (isHuman) {
			// A lit disc under your player's feet, and an arrow the way they face.
			ctx.fillStyle = "rgba(242, 181, 46, 0.22)";
			ctx.beginPath(); ctx.arc(X, Y, 22, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = "rgba(242, 181, 46, 0.95)";
			ctx.lineWidth = 2.5;
			ctx.beginPath(); ctx.arc(X, Y, 22, 0, Math.PI * 2); ctx.stroke();
			const ax = Math.cos(p.dir), ay = Math.sin(p.dir);
			ctx.fillStyle = "#f2b52e";
			ctx.beginPath();
			ctx.moveTo(X + ax * 33, Y + ay * 33);
			ctx.lineTo(X + ax * 25 - ay * 6, Y + ay * 25 + ax * 6);
			ctx.lineTo(X + ax * 25 + ay * 6, Y + ay * 25 - ax * 6);
			ctx.closePath(); ctx.fill();
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			ctx.moveTo(X - 8, Y - 38); ctx.lineTo(X + 8, Y - 38); ctx.lineTo(X, Y - 29);
			ctx.closePath(); ctx.fill();

			drawSprintBar(p, X, Y + 26, 30);
			// Tackle recharging: a grey arc that fills back up.
			if (p.lungeCd > 0 && ball.owner !== p) {
				const c = 1 - p.lungeCd / LUNGE_CD;
				ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(X, Y, 28, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2);
				ctx.stroke();
			}
		}

		// A keeper holding the ball: show the space opponents must keep out of.
		if (ball.owner === p && inHands(p) && state === "play") {
			ctx.save();
			ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
			ctx.lineWidth = 2;
			ctx.setLineDash([ 4, 6 ]);
			ctx.beginPath(); ctx.arc(X, Y, KEEPER_CLEAR, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		}

		{
			const j = reduceMotion ? 0 : jumpAmt(p);
			if (j > 0) {
				ctx.save();
				ctx.translate(X - j * 3, Y - j * 5);
				ctx.scale(1 + j * 0.16, 1 + j * 0.16);
				drawFigure(p, 0, 0, kit);
				ctx.restore();
			}
			else { drawFigure(p, X, Y, kit); }
		}

		// Your controlled player's name plate, above the marker.
		if (isHuman && p.name) { drawPlate(p, X, Y - 40); }

		if (isHuman && (charging || passCharge) && ball.owner === p) {
			const [ ax, ay ] = chargeAim(p);
			drawChargeUI(X, Y, MX + ax, MY + ay, 1);
		}
		if (isHuman && charging) {
			const c = clamp((frame - chargeStart) / 50, 0, 1);
			ctx.strokeStyle = "#f2b52e";
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.arc(X, Y, 29, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2);
			ctx.stroke();
		}
	}

	// While a pass or shot charges: a small arrow from the player toward where it is going,
	// and a power bar just under him. (fx, fy) is the foot on screen, (ax, ay) the arrow's tip.
	function chargeAim (me) {
		if (charging) { return aimY !== null && shotInRange(me) ? [ FW, aimY ] : [ me.x + Math.cos(me.dir) * 60, me.y + Math.sin(me.dir) * 60 ]; }
		const m = passCharge.kind === "long" ? strikerTarget(me) : passTarget(me);
		if (!m) { return [ me.x + Math.cos(me.dir) * 60, me.y + Math.sin(me.dir) * 60 ]; }
		return passCharge.kind === "through" ? [ m.x + 80 + chargeOf(passCharge.start) * 100, m.y ] : [ m.x, m.y ];
	}
	function drawChargeUI (fx, fy, ax, ay, k) {
		const power = chargeOf(charging ? chargeStart : passCharge.start);
		const dx = ax - fx, dy = ay - fy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
		const L = (22 + power * 22) * k, tx = fx + ux * (16 * k + L), ty = fy + uy * (16 * k + L);
		ctx.save();
		ctx.strokeStyle = ctx.fillStyle = "#f2b52e";
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo(fx + ux * 16 * k, fy + uy * 16 * k); ctx.lineTo(tx - ux * 7, ty - uy * 7); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - ux * 9 - uy * 5, ty - uy * 9 + ux * 5); ctx.lineTo(tx - ux * 9 + uy * 5, ty - uy * 9 - ux * 5); ctx.closePath(); ctx.fill();
		ctx.restore();
	}
	// Your man's name plate, FIFA style: number and name on a slim dark plate with a kit-colour edge,
	// his stamina on its own strip under it (a dark track, readable on any grass) and, while a pass or
	// shot charges, the power bar on top. (x, y) is the point just above his head the pointer touches.
	// compact: just his number over the stamina bar (the 3D view, once he has been yours a couple of
	// seconds); pointer: false where something else already points at him (the 3D marker cone).
	// avoid: boxes other markers are in ([ x0, y0, x1, y1 ] each); the plate goes to the nearest place
	// along its row (or a little higher) that is clear of all of them.
	function drawPlate (p, x, y, compact = false, pointer = true, avoid = null) {
		ctx.save();
		ctx.font = "700 11px Barlow, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
		const label = compact ? String(p.num) : `${p.num} ${pointer ? p.name : String(p.name).split(" ").pop()}`.toUpperCase(), w = Math.max(compact ? 30 : pointer ? 64 : 44, Math.ceil(ctx.measureText(label).width) + 18), h = 16, sh = 7;
		let yb = Math.round(y - 7), y0 = yb - h - sh;
		if (avoid && avoid.length && !pointer) {
			const hits = (cx, b0, b1) => avoid.some(a => a[1] < b1 + 2 && a[3] > b0 - 2 && a[0] < cx + w / 2 + 4 && a[2] > cx - w / 2 - 4);
			let best = null;
			for (const dy of [ 0, -14, -28 ]) {
				for (let k = 0; k <= 24 && !best; k++) {
					for (const sgn of k ? [ -1, 1 ] : [ 1 ]) { const cx = x + sgn * k * 6; if (!best && !hits(cx, y0 + dy, yb + dy)) { best = [ cx, dy ]; } }
				}
				if (best) { break; }
			}
			if (best) { x = best[0]; yb += best[1]; y0 += best[1]; }
		}
		const x0 = Math.round(x - w / 2);
		ctx.fillStyle = "#f2b52e";
		if (pointer) { ctx.beginPath(); ctx.moveTo(x - 5, yb); ctx.lineTo(x + 5, yb); ctx.lineTo(x, yb + 6); ctx.closePath(); ctx.fill(); }
		ctx.fillStyle = "rgba(10, 14, 20, 0.86)"; ctx.fillRect(x0, y0, w, h + sh);
		ctx.fillStyle = (KITS[p.team] || KITS[0]).outfield; ctx.fillRect(x0, y0, 3, h + sh);
		ctx.fillStyle = "#f4f6f2"; ctx.fillText(label, x0 + 1.5 + w / 2, y0 + h / 2 + 0.5);
		// Stamina: 5px on a grey track inside the plate's dark foot, green to amber to red as he tires.
		const s = clamp((staOf(p) - 0.25) / 0.75, 0, 1), sx = x0 + 5, sw = w - 8, sy = y0 + h;
		ctx.fillStyle = "rgba(255, 255, 255, 0.24)"; ctx.fillRect(sx, sy, sw, 5);
		ctx.fillStyle = staOf(p) < TIRED_STA ? "#ff5a4a" : s < 0.6 ? "#f2b52e" : "#5fe08f"; ctx.fillRect(sx, sy, sw * s, 5);
		if ((charging || passCharge) && ball.owner === p) {
			const power = chargeOf(charging ? chargeStart : passCharge.start), by = y0 - 10;
			ctx.fillStyle = "rgba(10, 14, 20, 0.86)"; ctx.fillRect(x0, by - 2, w, 10);
			ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; ctx.fillRect(x0 + 1, by, w - 2, 6);
			const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
			g.addColorStop(0, "#5fd38a"); g.addColorStop(0.55, "#f2d22e"); g.addColorStop(0.85, "#f28a2e"); g.addColorStop(1, "#e2394a");
			ctx.fillStyle = g; ctx.fillRect(x0 + 1, by, (w - 2) * power, 6);
			ctx.fillStyle = "rgba(255, 255, 255, 0.75)"; ctx.fillRect(x0 + 1 + (w - 2) * 0.8, by - 1, 1.5, 8);
		}
		ctx.restore();
	}

	function drawBall () {
		const X = MX + ball.x, GY = MY + ball.y;
		// The shadow stays on the grass; the ball rises above it and looks bigger.
		const h = ball.z || 0, Y = GY - h * 0.45, r = 7 * (1 + h / 260);
		const sh = 1 / (1 + h / 90);
		ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * sh + 0.1})`;
		ctx.beginPath(); ctx.ellipse(X + 2.5 + h * 0.05, GY + 4, 6 * sh + 2, 3.5 * sh + 1, 0, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = cond.snow ? "#ff7d22" : "#fbfdf9";   // an orange ball in the snow
		ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.fillStyle = "#1b2420";
		for (let k = 0; k < 2; k++) {
			const a = ball.spin + k * Math.PI;
			ctx.beginPath(); ctx.arc(X + Math.cos(a) * 2.6, Y + Math.sin(a) * 2.6, 1.7, 0, Math.PI * 2); ctx.fill();
		}
	}

	function drawFx (labels = true) {
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		for (const f of fx) {
			const k = f.t / (f.life || 40);
			const X = MX + (f.p ? f.p.x : f.x), Y = MY + (f.p ? f.p.y : f.y);
			if (f.toast) { continue; }
			ctx.globalAlpha = 1 - k;
			ctx.strokeStyle = f.color;
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(X, Y, 20 + (reduceMotion ? 0 : k * 26), 0, Math.PI * 2); ctx.stroke();
			if (f.label && labels) {
				ctx.fillStyle = f.color;
				ctx.font = "800 22px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
				ctx.fillText(f.label.toUpperCase(), X, Y - 48 - (reduceMotion ? 0 : k * 16));
			}
		}
		ctx.globalAlpha = 1;
	}

	// Rain streaks and a darker sky, drawn on the screen; plus a conditions tag.
	let drops = [], splashes = [];
	// Rain in three depths: far drops short, thin and faint; near ones long, a little wider and more
	// transparent (out of focus, smeared by the shutter). Each streak is drawn as a faint tail and a
	// brighter head, so it reads as a falling drop, not a scratch. The wind leans it. Splashes ring out
	// on the grass where the camera can see it. A screen effect: its own random numbers, not the match's.
	const RAIN_LAYERS = [ { n: 190, len: [ 9, 14 ], v: [ 10, 13 ], w: 0.6, a: 0.24 }, { n: 85, len: [ 20, 30 ], v: [ 17, 22 ], w: 0.9, a: 0.28 }, { n: 20, len: [ 44, 64 ], v: [ 30, 38 ], w: 1.6, a: 0.16 } ];
	let rainSeed = 99;
	const rainRnd = () => (rainSeed = (rainSeed * 16807) % 2147483647) / 2147483647;
	// Where a spot on the grass is on the screen (and how many screen units a unit there spans), for the
	// camera in use; null for the overhead camera (rain there falls straight at you: no splashes).
	function rainGround (x, y) {
		if (camMode === "3d" && G3.cam) { return proj3D(x, y, 0); }
		if (camMode === "tv" && TV.camX != null) { const q = tvProj(x, y, 0); if (q && endsSwapped()) { q.x = VW - q.x; } return q; }
		return null;
	}
	function drawRain () {
		if (cond.wet) {
			// A grey sky by day; at night the dark is already there, and a flat veil only greyed the pitch.
			ctx.fillStyle = `rgba(12, 20, 30, ${(cond.ko === "day" ? 0.1 : 0.025) * cond.wet})`;
			ctx.fillRect(0, 0, SW, SH);
			if (reduceMotion) { drops = []; splashes = []; } else {
				const day = cond.ko === "day", tint = day ? "214, 222, 232" : "198, 214, 236";
				const lean = (0.1 + 0.3 * clamp(cond.wind.s / 40, 0, 1)) * (Math.cos(cond.wind.a) * (endsSwapped() ? -1 : 1) < 0 ? -1 : 1);
				const dt = clamp(frameDt / 16.7, 0.25, 3);
				RAIN_LAYERS.forEach((L, li) => {
					const list = drops[li] || (drops[li] = []), want = Math.round(L.n * cond.wet * (SW * SH) / (1072 * 648));
					while (list.length < want) { list.push({ x: rainRnd() * (SW + 80) - 40, y: rainRnd() * SH, l: L.len[0] + rainRnd() * (L.len[1] - L.len[0]), v: L.v[0] + rainRnd() * (L.v[1] - L.v[0]) }); }
					list.length = Math.min(list.length, want);
					ctx.lineWidth = L.w; ctx.lineCap = "round";
					// tails (fainter) in one pass, heads in another
					for (const head of [ false, true ]) {
						ctx.strokeStyle = `rgba(${tint}, ${L.a * (head ? 1 : 0.4)})`;
						ctx.beginPath();
						for (const d of list) {
							if (head) { d.y += d.v * dt; d.x += d.v * lean * dt; if (d.y - d.l > SH) { d.y = -rainRnd() * 40; d.x = rainRnd() * (SW + 80) - 40 - lean * SH * 0.5; } }
							const f = head ? 0.45 : 1, f0 = head ? 0 : 0.45;
							ctx.moveTo(d.x - lean * d.l * f0, d.y - d.l * f0); ctx.lineTo(d.x - lean * d.l * f, d.y - d.l * f);
						}
						ctx.stroke();
					}
				});
				// Splashes: a ring that opens and fades where a drop lands, at the grass's distance.
				const wantS = Math.round(70 * cond.wet);
				for (let tries = 0; splashes.length < wantS && tries < 12; tries++) {
					const s = { x: rainRnd() * FW, y: rainRnd() * FH, t: 0, life: 9 + rainRnd() * 6 };
					const q = rainGround(s.x, s.y);
					if (q && q.x > 0 && q.x < SW && q.y > 0 && q.y < SH) { splashes.push(s); }
				}
				ctx.lineWidth = 0.8;
				for (let b = 0; b < 3; b++) {
					ctx.strokeStyle = `rgba(${tint}, ${[ 0.3, 0.18, 0.08 ][b]})`;
					ctx.beginPath();
					for (const s of splashes) {
						const p = s.t / s.life;
						if (Math.min(2, Math.floor(p * 3)) !== b) { continue; }
						const q = rainGround(s.x, s.y);
						if (!q) { continue; }
						const r = (0.6 + 2.6 * p) * q.k, ry = r * 0.3;
						if (r < 0.4) { continue; }
						ctx.moveTo(q.x + r, q.y); ctx.ellipse(q.x, q.y, r, ry, 0, 0, Math.PI * 2);
					}
					ctx.stroke();
				}
				for (const s of splashes) { s.t += dt; }
				splashes = splashes.filter(s => s.t < s.life);
			}
		} else if (cond.snow) {
			// Flakes drift down and sway; the near ones are bigger and quicker.
			ctx.fillStyle = "rgba(220, 228, 236, 0.08)"; ctx.fillRect(0, 0, SW, SH);
			const want = reduceMotion ? 0 : 140;
			while (drops.length < want) { const k = Math.random(); drops.push({ x: Math.random() * SW, y: Math.random() * SH, v: 0.8 + k * 2.2, s: 1 + k * 2.4, p: Math.random() * 6.3 }); }
			ctx.fillStyle = "rgba(250, 252, 255, 0.8)";
			ctx.beginPath();
			if (!(drops[0] && drops[0].p !== undefined)) { drops = drops.filter(d => d && d.p !== undefined); }   // no rain layers left over
			for (const d of drops) {
				d.p += 0.03; d.y += d.v; d.x += Math.sin(d.p) * 0.6 - 0.25;
				if (d.y > SH) { d.y = -6; d.x = Math.random() * (SW + 40); }
				ctx.moveTo(d.x + d.s, d.y); ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
			}
			ctx.fill();
		} else {
			drops = [];
			// A hot afternoon: a warm haze over everything.
			if (cond.heat && cond.ko === "day") { ctx.fillStyle = "rgba(255, 214, 150, 0.07)"; ctx.fillRect(0, 0, SW, SH); }
		}
		// The weather and tactic tags stand down while the REPLAY badge or the line-ups card sits in their corner.
		if (replayOn() || !$("bcLineups").hidden) { return; }
		ctx.font = "700 11px Barlow, Arial, sans-serif";
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		const text = `${cond.label} · ${cond.ko === "day" ? "Afternoon" : "Night"}`.toUpperCase(), w = ctx.measureText(text).width;
		// Top right, under the menu button, right-aligned and quiet: the score bug has the top left.
		const top = 44, R = SW - 10, hasWind = cond.wind.s >= 6;
		const wtx = `${cond.wind.s} KM/H`, ww = hasWind ? ctx.measureText(wtx).width + 30 : 0, x1 = R - ww - (hasWind ? 4 : 0) - (w + 16);
		ctx.fillStyle = "rgba(10, 14, 20, 0.55)";
		ctx.fillRect(x1, top, w + 16, 20);
		ctx.fillStyle = "rgba(238, 246, 234, 0.88)";
		ctx.fillText(text, x1 + 8, top + 10.5);
		// The wind: an arrow the way it blows on screen (flipped with the picture after half time) and its speed.
		if (hasWind) {
			const x0 = R - ww;
			const sx = Math.cos(cond.wind.a) * (endsSwapped() ? -1 : 1), sy = Math.sin(cond.wind.a) * (camMode === "top" ? 1 : 0.55), sl = Math.hypot(sx, sy) || 1;
			ctx.fillStyle = cond.wind.s >= 20 ? "rgba(30, 60, 92, 0.75)" : "rgba(10, 14, 20, 0.55)";
			ctx.fillRect(x0, top, ww, 20);
			const ax = x0 + 11, ay = top + 10, ux = sx / sl * 6, uy = sy / sl * 6;
			ctx.strokeStyle = "#cfe6ff"; ctx.fillStyle = "#cfe6ff"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(ax - ux, ay - uy); ctx.lineTo(ax + ux, ay + uy); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(ax + ux * 1.25, ay + uy * 1.25); ctx.lineTo(ax + ux * 0.3 - uy * 0.6, ay + uy * 0.3 + ux * 0.6); ctx.lineTo(ax + ux * 0.3 + uy * 0.6, ay + uy * 0.3 - ux * 0.6); ctx.closePath(); ctx.fill();
			ctx.fillStyle = "rgba(238, 246, 234, 0.9)";
			ctx.fillText(wtx, x0 + 22, top + 10.5);
		}
		if (state === "play" || state === "goal" || state === "paused") {
			const m = mentality[0], tag = `TACTIC: ${MENTALITY[m + 1].toUpperCase()}${coarse ? "" : "  (1-4 / T)"}`, tw = ctx.measureText(tag).width;
			ctx.fillStyle = m > 0 ? "rgba(120, 70, 10, 0.7)" : m < 0 ? "rgba(20, 45, 80, 0.7)" : "rgba(10, 14, 20, 0.55)";
			ctx.fillRect(R - tw - 16, top + 24, tw + 16, 20);
			ctx.fillStyle = m > 0 ? "#ffd27a" : m < 0 ? "#bcd8f5" : "rgba(238, 246, 234, 0.88)";
			ctx.fillText(tag, R - tw - 8, top + 34.5);
		}
	}

