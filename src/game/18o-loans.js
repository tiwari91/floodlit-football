	/* ---------- loans ----------
	   Out: while a window is open, a player of 23 or under can go out on loan for the rest of the season.
	   His loan club pays his wages (he is off your wage bill) and he comes back next summer better for the
	   football, by how far he was from his potential. If the bench is full when he's due back, his loan runs
	   another season.
	   In: a player on the market can come for the season for a fee of a tenth of his value; you pay his wages
	   and he goes back to his club at the end of the season. A loan joins the bench, so it needs a free place,
	   and the homegrown rule (18n) counts him like anyone else. */
	const LOAN_MAX_AGE = 23, LOAN_FEE = 0.1, LOAN_MIN_SQUAD = 14;
	const loanFee = pl => round1(Math.max(0.05, valueOf(pl) * LOAN_FEE));
	const loanedOut = c => (Array.isArray(c.loanedOut) ? c.loanedOut : (c.loanedOut = []));

	// Out: the button on a player's card, and the move.
	function loanOutButton (pl) {
		const c = league.club;
		if (!windowOpen() || (pl.age || 99) > LOAN_MAX_AGE || pl.loan) { return null; }
		const b = el("button", "", "Loan out for the season");
		b.type = "button";
		b.disabled = c.squad.length + c.bench.length <= LOAN_MIN_SQUAD;
		b.title = b.disabled ? `Keep at least ${LOAN_MIN_SQUAD} players` : "Another club pays his wages; he comes back next summer improved";
		b.addEventListener("click", () => loanOut(pl.name));
		return b;
	}
	function loanOut (name) {
		const c = league.club, pl = [ ...c.squad, ...c.bench ].find(p => p.name === name);
		if (!pl || !windowOpen()) { return; }
		const others = league.members.filter(id => id !== 0), to = others[hashStr(pl.name + league.season) % others.length];
		c.squad = c.squad.filter(p => p !== pl); c.bench = c.bench.filter(p => p !== pl);
		loanedOut(c).push({ pl, to, back: league.season + 1 });
		refillSquad(c);
		lastDeal = `${pl.name} has gone on loan to ${TEAMS[to].name} for the season. They pay his wages; he's back next summer.`;
		c.log = [ ...(c.log || []), `Loaned ${pl.name} out to ${TEAMS[to].name}` ].slice(-10);
		afterClubChange();
	}

	// In: the button on a market row, and the move.
	function loanInButton (pl, i) {
		const c = league.club, fee = loanFee(pl), room = c.bench.length < BENCH;
		const b = el("button", "", `Loan ${money(fee)}`);
		b.type = "button";
		b.disabled = !windowOpen() || !room || c.budget + 1e-9 < fee || c.budget < 0 || !permitOk(pl);
		b.title = room ? "For the rest of the season: you pay the fee and his wages, then he goes back" : "A loan joins the bench: make room on it first";
		b.addEventListener("click", () => loanIn(i));
		return b;
	}
	function loanIn (i) {
		const c = league.club, pl = c.market[i];
		if (!pl || !windowOpen()) { return; }
		const fee = loanFee(pl);
		if (c.bench.length >= BENCH) { lastDeal = "A loan joins the bench: make room on it first."; afterClubChange(); return; }
		if (c.budget + 1e-9 < fee || c.budget < 0) { return; }
		const hgNo = typeof hgRefusal === "function" ? hgRefusal(pl, null) : null;
		if (hgNo) { lastDeal = hgNo; afterClubChange(); return; }
		const from = pl.from || (MARKETS[pl.region] ? MARKETS[pl.region].label : "his club");
		if (Number.isInteger(pl.cpuClub)) { backfillCpu(pl.cpuClub, pl.cpuSlot); }
		delete pl.ask; delete pl.bids; delete pl.scouted; delete pl.cpuClub; delete pl.cpuSlot;
		pl.loan = { season: league.season, from };
		pl.adapt = 0;
		c.budget = round1(c.budget - fee);
		c.bench.push(pl);
		c.market.splice(i, 1);
		lastDeal = `${pl.name} joins on loan from ${from} for the season (${money(fee)}). He goes back next summer.`;
		c.log = [ ...(c.log || []), `Loaned ${pl.name} in from ${from} for ${money(fee)}` ].slice(-10);
		afterClubChange();
	}

	// The summer (newSeason): loans in go back, loans out come home improved (or stay out if there's no room).
	function loansSummer (c) {
		const news = [];
		const back = [ ...c.squad, ...c.bench ].filter(p => p.loan && p.loan.season < league.season);
		if (back.length) {
			c.squad = c.squad.filter(p => !back.includes(p)); c.bench = c.bench.filter(p => !back.includes(p));
			news.push(`Back to their clubs after their loans: ${back.map(p => p.name).join(", ")}.`);
		}
		const home = [], longer = [];
		for (const L of loanedOut(c).filter(x => x.back <= league.season)) {
			const pl = L.pl;
			if (c.bench.length >= BENCH && back.length === 0 && c.squad.length + c.bench.length >= POS_OF_SLOT.length + BENCH) { L.back = league.season + 1; longer.push(pl.name); continue; }
			const g = Math.max(1, Math.round(((pl.pot || 60) - ovrOf(pl)) * (0.2 + Math.random() * 0.12)));   // a little more than a season in the academy (18d)
			for (const k of [ "pac", "sho", "pas", "def" ]) { pl[k] = clamp(pl[k] + g + Math.floor(Math.random() * 2), 1, 99); }
			c.bench.push(pl); home.push(`${pl.name} (now ${ovrOf(pl)})`);
		}
		c.loanedOut = loanedOut(c).filter(x => x.back > league.season);
		if (home.length) { news.push(`Back from loan and better for it: ${home.join(", ")}.`); }
		if (longer.length) { news.push(`No room on the bench, so these loans run another season: ${longer.join(", ")}.`); }
		if (back.length || home.length) { refillSquad(c, false); }
		return news.join(" ");
	}
	// For the Squad tab: who is out on loan.
	const loanLine = c => (loanedOut(c).length ? `Out on loan: ${loanedOut(c).map(L => `${L.pl.name} at ${TEAMS[L.to] ? TEAMS[L.to].name : "another club"} (back season ${L.back})`).join(", ")}.` : "");
