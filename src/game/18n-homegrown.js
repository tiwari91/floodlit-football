	/* ---------- the homegrown rule ----------
	   The Premier League lets a club register at most seventeen players of twenty-five who are not
	   homegrown, and under-21s don't count. Scaled to this game's eighteen (eleven and a bench of seven),
	   that is at most twelve. Homegrown here: from the league's country (the home nations at home) or
	   brought up through your academy. At the limit you can't sign another senior player who isn't
	   homegrown; the Transfers and Squad tabs say where you stand, and the market marks homegrown players. */
	const HG_MAX_OTHERS = 12, HG_U21 = 21;
	const hgNats = () => { const n = leagueNat(); return n === HOME_NAT ? new Set(natsOf("home")) : new Set([ n ]); };
	const isHomegrown = (pl, nats = hgNats()) => !!(pl && (pl.academy || nats.has(pl.nat)));
	const hgCounts = (pl, nats) => !!pl && (pl.age || 99) > HG_U21 && !isHomegrown(pl, nats);   // takes one of the twelve places
	function hgOthers (c) {
		const nats = hgNats();
		return [ ...c.squad, ...c.bench ].filter(pl => hgCounts(pl, nats)).length;
	}
	// Signing pl (and losing out, if he makes room): would it break the rule? A reason, or null.
	function hgRefusal (pl, out) {
		const c = league.club, nats = hgNats();
		if (!hgCounts(pl, nats)) { return null; }
		const now = hgOthers(c), after = now + 1 - (hgCounts(out, nats) ? 1 : 0);
		if (after <= Math.max(HG_MAX_OTHERS, now)) { return null; }   // a squad already over (an older save) may swap like for like
		return `The homegrown rule: you already have ${hgOthers(c)} of the ${HG_MAX_OTHERS} places for senior players who aren't homegrown. ${pl.name} (${pl.nat}, ${pl.age}) would need one: sell or release one of them first, or sign someone homegrown or under ${HG_U21 + 1}.`;
	}
	const hgLine = c => { const n = hgOthers(c); return `Homegrown rule: ${n} of ${HG_MAX_OTHERS} places for senior players who aren't homegrown${n >= HG_MAX_OTHERS ? " (full: the next senior signing must be homegrown)" : ""}; under-21s don't count.`; };
