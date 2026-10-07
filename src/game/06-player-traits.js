	/* ---------- player traits ----------
	   About a third of players have one, suited to where they play. Traits change what a player does
	   on the pitch, not just a number: see tr() in the match code. */
	const TRAITS = {
		pace: [ "Pace merchant", "quicker, and makes runs in behind" ],
		target: [ "Target man", "wins headers and holds the ball up; long balls look for him" ],
		playmaker: [ "Playmaker", "longer, more accurate passing and through balls" ],
		poacher: [ "Poacher", "lives on the last defender, sharper finishing in the box" ],
		winner: [ "Ball-winner", "wins tackles and slides in more often" ],
		sweeper: [ "Sweeper keeper", "plays high and rushes out to through balls" ]
	};
	const TRAIT_ODDS = { gk: [ [ "sweeper", 30 ] ], def: [ [ "winner", 24 ], [ "pace", 8 ] ], mid: [ [ "playmaker", 20 ], [ "winner", 14 ], [ "pace", 7 ] ], fwd: [ [ "poacher", 24 ], [ "target", 20 ], [ "pace", 20 ] ] };
	// From the name, so the same player always has the same trait (old saves, the computer's squads).
	function traitFor (pl) {
		const h = hashStr(String(pl.name) + "|trait|" + pl.pos) % 100;
		let acc = 0;
		for (const [ k, w ] of TRAIT_ODDS[pl.pos] || []) { acc += w; if (h < acc) { return k; } }
		return "";
	}
	const traitOf = pl => (pl && typeof pl.trait === "string" && (pl.trait === "" || TRAITS[pl.trait]) ? pl.trait : pl ? traitFor(pl) : "");
	const traitName = k => (TRAITS[k] ? TRAITS[k][0] : "");
	// Fill in whatever a player is missing (old saves, generated players). Never changes a set field.
	function ensurePlayer (pl) {
		if (!pl || typeof pl !== "object") { return pl; }
		const h = hashStr(String(pl.name) + "|" + pl.pos);
		if (!Number.isFinite(pl.age)) { pl.age = 18 + (h % 15); }
		if (!NATIONS[pl.nat]) { const r = (h >>> 8) % 100, pool = r < 62 ? natsOf("home") : r < 82 ? natsOf("europe") : r < 90 ? natsOf("samerica") : r < 96 ? natsOf("africa") : natsOf("asia"); pl.nat = pool[(h >>> 4) % pool.length]; }
		if (!Number.isFinite(pl.morale)) { pl.morale = 70; }
		if (!Number.isFinite(pl.contract)) { pl.contract = 1 + ((h >>> 12) % 3); }
		if (!Number.isFinite(pl.pot)) { pl.pot = clamp(ovrOf(pl) + Math.max(0, 27 - pl.age) * 1.5 + ((h >>> 16) % 6), ovrOf(pl), 94); }
		if (!ROLES[pl.role]) { pl.role = ""; }   // "" = picked for him from his standing in the squad
		if (!Number.isFinite(pl.adapt)) { pl.adapt = 0; }
		if (typeof pl.trait !== "string" || (pl.trait && !TRAITS[pl.trait])) { pl.trait = traitFor(pl); }
		return pl;
	}
	const roleOf = (pl, c) => {
		if (ROLES[pl.role]) { return pl.role; }
		// Picked for him: a starter is first team (key if he is one of the best five), anyone on the bench rotation.
		if (pl.age <= 20 && !c.squad.includes(pl)) { return "prospect"; }
		if (!c.squad.includes(pl) || (league && !slotsFor(league.fmt).includes(c.squad.indexOf(pl)))) { return "rotation"; }
		const all = c.squad.map(q => ovrOf(q)).sort((a, b) => b - a);
		return ovrOf(pl) >= all[4] ? "key" : "first";
	};
	// What a player is worth: his rating, then his age, his potential and how long he has left on his contract.
	const ageFactor = a => (!Number.isFinite(a) ? 1 : a <= 21 ? 1.35 : a <= 24 ? 1.2 : a <= 28 ? 1 : a <= 30 ? 0.8 : a <= 32 ? 0.6 : 0.4);
	const valueOf = p => Math.max(0.1, round1(Math.pow(Math.max(0, ovrOf(p) - 50), 2) * 0.004 * ageFactor(p.age) * (1 + Math.max(0, (p.pot || 0) - ovrOf(p)) * 0.02) * (p.contract === 1 ? 0.8 : 1)));
	// Wages per season (£m), paid a matchday at a time; shown as £k a week.
	const wageOf = p => (Number.isFinite(p.wage) ? p.wage : Math.round((0.02 + valueOf(p) * 0.05) * 1000) / 1000);
	const wageWeek = w => `£${(w * 1000 / 52).toFixed(1)}k/wk`;
	const squadWages = c => [ ...c.squad, ...c.bench ].reduce((t, p) => t + wageOf(p), 0) + Object.values(c.staff || {}).reduce((t, st) => t + (st ? st.wage : 0), 0);

	function ovrOf (p) {
		const w = OVR_W[p.pos];
		return Math.round(p.pac * w[0] + p.sho * w[1] + p.pas * w[2] + p.def * w[3]);
	}

	const priceOf = p => Math.max(0.2, Number.isFinite(p.age) ? valueOf(p) : round1(Math.pow(Math.max(0, ovrOf(p) - 50), 2) * 0.004));

