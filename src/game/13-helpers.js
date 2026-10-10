	/* ---------- helpers ---------- */
	const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
	const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
	const rel = (team, x) => (team === 0 ? x : FW - x);   // distance from own goal line
	const attackX = team => (team === 0 ? FW : 0);
	const team = t => players.filter(p => p.team === t);
	const human = () => players[ctrl];
	const outfield = t => players.filter(p => p.team === t && p.role !== "gk");

	const YOU_HOME_KIT = { outfield: "#f2b52e", second: "#1f2a36", gk: "#7ec8e3", ink: "#1d1604", pattern: "plain" };
	const YOU_AWAY_KIT = { outfield: "#f4f4f4", second: "#1f2a36", gk: "#7ec8e3", ink: "#1b2420", pattern: "plain" };
	let leftIsYou = true;   // the scoreboard lists the home side first
	function setOpponent (o, youHome = true) {
		opp = o;
		// Kits are compared as people see them (CIE ΔE), and on a clash the AWAY side changes,
		// as in the real rules: them at your ground, you at theirs.
		const you = { ...YOU_HOME_KIT };
		let shirt = o.color, trim = o.color2 || "#ffffff", pattern = o.pattern || "plain";
		const best = (cands, score) => cands.reduce((a, b) => (score(b) > score(a) ? b : a));
		if (deltaE(shirt, you.outfield) < 72) {
			if (youHome) {
				// Their change shirt: whichever stands out most against amber (and its shorts to match).
				shirt = best([ o.color2 || "#f4f4f4", "#f4f4f4", "#15171a", "#1d4fa0", "#6b2d8a", "#155e3a" ], c => deltaE(c, you.outfield));
				trim = lum(shirt) > 0.5 ? "#1f2a36" : "#f4f4f4";
				pattern = "plain";
			} else {
				you.outfield = best([ "#f4f4f4", "#1f2a36", "#8fc3e6", "#15171a" ], c => deltaE(c, shirt));
				you.second = lum(you.outfield) > 0.5 ? "#1f2a36" : "#f2b52e";
				you.ink = lum(you.outfield) > 0.55 ? "#1b2420" : "#ffffff";
			}
		}
		// Kit contrast: the other side plays in white (or black when you are in white), which reads
		// against the grass and against any colour of yours for every kind of colour vision.
		if (highContrast) {
			shirt = deltaE("#f4f4f4", you.outfield) > 60 ? "#f4f4f4" : "#15171a";
			trim = shirt === "#f4f4f4" ? "#15171a" : "#f4f4f4";
			pattern = "plain";
		}
		// Shorts and sleeves too: if they're alike, the away side wears different ones.
		if (deltaE(trim, you.second) < 25) {
			if (youHome) { trim = best([ "#f4f4f4", "#15171a", shirt ], c => Math.min(deltaE(c, you.second), deltaE(c, you.outfield) + 20)); }
			else { you.second = best([ "#f4f4f4", "#15171a", you.outfield ], c => Math.min(deltaE(c, trim), deltaE(c, shirt) + 20)); }
		}
		// Keepers: each in a colour unlike both outfield kits and the other keeper.
		const GK_PALETTE = [ "#7ee3c0", "#f0e27a", "#f2a0c8", "#8fd0f5", "#f29a5e", "#9be87a", "#b394ee", "#e8736e", "#15171a" ];
		const gkScore = (c, other) => Math.min(deltaE(c, you.outfield), deltaE(c, shirt), other ? deltaE(c, other) : 999);
		if (gkScore(you.gk) < 40) { you.gk = best(GK_PALETTE, c => gkScore(c)); }
		let gk = o.gk || "#b394ee";
		if (gkScore(gk, you.gk) < 40) { gk = best(GK_PALETTE, c => gkScore(c, you.gk)); }
		KITS[0] = you;
		KITS[1] = { outfield: shirt, second: trim, gk, ink: lum(shirt) > 0.55 ? "#1b2420" : "#ffffff", pattern };
		document.documentElement.style.setProperty("--opp", shirt);
		document.documentElement.style.setProperty("--opp-text", textFor(shirt));
		leftIsYou = youHome;
		$("homeName").textContent = youHome ? "You" : o.short;
		$("awayName").textContent = youHome ? o.short : "You";
		document.documentElement.style.setProperty("--left-kit", youHome ? KITS[0].outfield : shirt);
		document.documentElement.style.setProperty("--right-kit", youHome ? shirt : KITS[0].outfield);
		lastMood = "";
		lastHud = "";
	}
	// The match clock as mm:ss, always sane: NaN, negative or test-sized values never reach the score bug.
	function fmtClock (secs, cap) {
		let t = Math.ceil(Number(secs));
		if (!Number.isFinite(t) || t < 0) { t = 0; }
		t = Math.min(t, Number.isFinite(cap) && cap > 0 ? Math.ceil(cap) : 5999);
		return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
	}
