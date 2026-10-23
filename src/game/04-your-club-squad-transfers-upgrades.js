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

	// A stable id for each player, so edits can follow him (see 18g). Not from the seeded rnd: that would shift the computer's squads.
	function newPid () { return `p${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 8)}`; }
	const OVR_W = { gk: [ 0, 0, 0, 1 ], def: [ 0.25, 0.05, 0.2, 0.5 ], mid: [ 0.2, 0.2, 0.4, 0.2 ], fwd: [ 0.3, 0.35, 0.2, 0.15 ] };
	// st: the style to generate in (05a): { lg: the league's country, nat: his own }. Left out, the current
	// league's; false, none at all.
	function genPlayer (pos, ovr, name, rnd = Math.random, st) {
		const lg = st === false ? null : (st && NAT_STYLE[st.lg] ? st.lg : leagueNat()), sty = lg ? styleOf(lg) : null, sp = sty ? sty.sp : 1;
		const j = () => Math.round((rnd() * 2 - 1) * 5 * sp), c = v => clamp(Math.round(v), 30, 96);
		const b = { def: [ 0, -12, -2, 10 ], mid: [ 0, -2, 8, -2 ], fwd: [ 4, 8, 0, -12 ] }[pos];
		if (sty) { ovr += styleEmph(sty, pos); }   // where the league's quality sits, evened out over an eleven
		// The position bias used to lift the overall 2 to 4 points above what was asked for, and the very
		// best came out at 93 to 99: take the bias back out, and squeeze the top so the elite sit at 85 to 92.
		if (pos !== "gk") { const w = OVR_W[pos]; ovr -= b.reduce((t, v, i) => t + v * w[i], 0); }
		if (ovr > 84) { ovr = 84 + (ovr - 84) * 0.55; }
		const p = pos === "gk"
			? { pac: 45 + j(), sho: 30 + j(), pas: 55 + j(), def: ovr + j() }
			: { pac: ovr + b[0] + j(), sho: ovr + b[1] + j(), pas: ovr + b[2] + j(), def: ovr + b[3] + j() };
		const pl = {
			id: newPid(),
			name: name || `${String.fromCharCode(65 + Math.floor(rnd() * 26))}. ${SURNAMES[Math.floor(rnd() * SURNAMES.length)]}`,
			pos, pac: c(p.pac), sho: c(p.sho), pas: c(p.pas), def: c(p.def)
		};
		if (!sty) { return ensurePlayer(pl); }
		// His country (abroad, mostly the league's own), then the league's tilt with a little of his country's.
		const nat = st && NATIONS[st.nat] ? st.nat : styleNatFor(pl.name, pos, lg);
		if (nat) { pl.nat = nat; }
		ensurePlayer(pl);
		const tl = styleTilt(lg, pl.nat);
		applyTilt(pl, pos, tl.r, p);
		pl.trait = styleTrait(pl.name, pos, tl.t);
		pl.age = styleAge(pl.age, lg);
		const h = hashStr(String(pl.name) + "|" + pl.pos);
		pl.pot = clamp(ovrOf(pl) + Math.max(0, 27 - pl.age) * 1.5 + ((h >>> 16) % 6), ovrOf(pl), 94);
		return pl;
	}
