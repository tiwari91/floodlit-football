	/* ---------- your club: squad, transfers, upgrades ---------- */
	// Which squad slots start in a format: all eleven, or the small-sided shape's.
	const slotsFor = fmt => (shapeOf(fmt) ? shapeOf(fmt).slots : POS_OF_SLOT.map((_, i) => i));
	// The role a squad slot plays in the current formation (a slot left out keeps its natural role).
	const roleOfSlot = (fmt, i) => { const sh = shapeOf(fmt), k = sh ? sh.slots.indexOf(i) : -1; return k >= 0 ? sh.roles[k] : POS_OF_SLOT[i]; };
	const POS_LABEL = { gk: "GK", def: "DEF", mid: "MID", fwd: "FWD" };
	const SURNAMES = [ "Hale", "Brennan", "Varga", "Lind", "Moreau", "Castell", "Ibarra", "Kowal", "Duarte", "Okoro",
		"Rinaldi", "Sato", "Novak", "Quinn", "Farrow", "Pike", "Adeyemi", "Soler", "Haines", "Mercer", "Lowe", "Dunmore",
		"Fenwick", "Tamura", "Petrov", "Nyland", "Osei", "Ruiz", "Walsh", "Kerr", "Barros", "Ekberg", "Marsh", "Toft" ];
	const UPGRADES = [
		{ key: "training", name: "Training ground", effect: "+3 pace, whole squad", costs: [ 1, 2, 3.5 ] },
		{ key: "coaching", name: "Finishing school", effect: "+3 shooting and passing", costs: [ 1, 2, 3.5 ] },
		{ key: "defence", name: "Defensive drills pitch", effect: "+3 defending and goalkeeping", costs: [ 1, 2, 3.5 ] }
	];
	const money = m => (Math.abs(m) < 0.095 && m !== 0 ? `${m < 0 ? "-" : ""}£${Math.round(Math.abs(m) * 1000)}k` : `${m < 0 ? "-" : ""}£${Math.abs(m).toFixed(1)}m`);
	const round1 = v => Math.round(v * 10) / 10;

	const OVR_W = { gk: [ 0, 0, 0, 1 ], def: [ 0.25, 0.05, 0.2, 0.5 ], mid: [ 0.2, 0.2, 0.4, 0.2 ], fwd: [ 0.3, 0.35, 0.2, 0.15 ] };
	function genPlayer (pos, ovr, name, rnd = Math.random) {
		const j = () => Math.round((rnd() * 2 - 1) * 5), c = v => clamp(Math.round(v), 30, 96);
		const b = { def: [ 0, -12, -2, 10 ], mid: [ 0, -2, 8, -2 ], fwd: [ 4, 8, 0, -12 ] }[pos];
		// The position bias used to lift the overall 2 to 4 points above what was asked for, and the very
		// best came out at 93 to 99: take the bias back out, and squeeze the top so the elite sit at 85 to 92.
		if (pos !== "gk") { const w = OVR_W[pos]; ovr -= b.reduce((t, v, i) => t + v * w[i], 0); }
		if (ovr > 84) { ovr = 84 + (ovr - 84) * 0.55; }
		const p = pos === "gk"
			? { pac: 45 + j(), sho: 30 + j(), pas: 55 + j(), def: ovr + j() }
			: { pac: ovr + b[0] + j(), sho: ovr + b[1] + j(), pas: ovr + b[2] + j(), def: ovr + b[3] + j() };
		return ensurePlayer({
			name: name || `${String.fromCharCode(65 + Math.floor(rnd() * 26))}. ${SURNAMES[Math.floor(rnd() * SURNAMES.length)]}`,
			pos, pac: c(p.pac), sho: c(p.sho), pas: c(p.pas), def: c(p.def)
		});
	}

