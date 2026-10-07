	/* ---------- the assistant: contracts and transfers ----------
	   Turned on under Your team, the assistant manager does the club's paperwork between matches:
	   new deals for the players worth keeping before their contracts run out, bids for your players
	   answered, and in a window a signing or two where the market offers a clear step up at a price
	   that leaves money for wages. Everything he does is written up in the League panel's notes. */
	const ASSIST = { off: "Assistant: off", contracts: "Assistant: contracts", transfers: "Assistant: transfers", both: "Assistant: contracts and transfers" };
	let assistMode = "off", assistBatch = false;
	const assistSel = $("assist");
	const ASSIST_RESERVE = 0.4;   // £m always kept back for wages and the odd surprise
	const assistDoes = what => assistMode === "both" || assistMode === what;
	const squadMedian = c => { const v = [ ...c.squad, ...c.bench ].map(ovrNow).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] || 0; };
	// Worth a new deal: a key or first-team man, anyone at least as good as the middle of the squad,
	// or a prospect with room to grow; still young enough, and not sulking.
	function assistKeeps (pl, c) {
		const role = roleOf(pl, c);
		return pl.age < 33 && pl.morale >= 40 && (role === "key" || role === "first" || ovrNow(pl) >= squadMedian(c) || (role === "prospect" && (pl.pot || 0) >= ovrNow(pl) + 6));
	}
	function assistContracts (c) {
		const done = [];
		for (const pl of [ ...c.squad, ...c.bench ]) {
			ensurePlayer(pl);
			if (pl.contract > 1 || !assistKeeps(pl, c)) { continue; }
			if (c.budget - round1(valueOf(pl) * 0.15) < ASSIST_RESERVE) { continue; }
			const deal = renewDeal(pl, c);
			if (deal.ok) { done.push(`${pl.name} signed on to ${pl.contract} seasons`); }
		}
		return done;
	}
	function assistTransfers (c) {
		const lg = league, done = [];
		if (!windowOpen() || c.budget < 0) { return done; }
		// Bids: cash in when the money is well over his value and he is not a key man, or he is past 31 and
		// the price is fair; never the only keeper. Anything else is turned down.
		for (const b of (lg.bidsIn || []).slice()) {
			const pl = [ ...c.squad, ...c.bench ].find(p => p.name === b.name);
			if (!pl) { continue; }
			const role = roleOf(pl, c), lastGk = pl.pos === "gk" && ![ ...c.squad, ...c.bench ].some(q => q !== pl && q.pos === "gk");
			const sell = !lastGk && ((b.fee >= valueOf(pl) * 1.15 && role !== "key") || (pl.age >= 32 && b.fee >= valueOf(pl) * 0.9));
			if (sell) { sellPlayer(pl.name, b.fee, b.club); done.push(`sold ${pl.name} to ${TEAMS[b.club].name} for ${money(b.fee)}`); }
			else { rejectBid(pl.name); done.push(`turned down ${TEAMS[b.club].name} for ${pl.name}`); }
		}
		// Signings: the market player who most improves the weakest starter at his position, known
		// quantities only (scouted, or from home), at the asking price, at most two a window.
		for (let n = 0; n < 2; n++) {
			let best = null;
			c.market.forEach((pl, i) => {
				if (!permitOk(pl) || pl.bids < 0 || !(pl.scouted || (pl.region || "home") === "home")) { return; }
				const ask = askOf(pl);
				if (c.budget - ask < ASSIST_RESERVE) { return; }
				const slots = slotsFor(lg.fmt).filter(s => POS_OF_SLOT[s] === pl.pos && c.squad[s]);
				if (!slots.length) { return; }
				const weakest = Math.min(...slots.map(s => matchOvr(c.squad[s], POS_OF_SLOT[s])));
				const gain = matchOvr(pl, pl.pos) - weakest;
				if (gain >= 3 && (!best || gain > best.gain || (gain === best.gain && ask < best.ask))) { best = { i, gain, ask, pl }; }
			});
			if (!best) { break; }
			signPlayer(best.i, best.ask);
			done.push(`signed ${best.pl.name} (${ovrNow(best.pl)}, ${POS_LABEL[best.pl.pos]}) for ${money(best.ask)}`);
		}
		if (done.some(d => d.startsWith("signed") || d.startsWith("sold"))) { autoPick(false, true); }
		return done;
	}
	// Runs after a league week and when a window opens; also the moment the setting is switched on.
	function assistRun (when) {
		if (!league || !league.club || assistMode === "off") { return []; }
		const c = league.club, done = [];
		assistBatch = true;
		try {
			if (assistDoes("contracts")) { done.push(...assistContracts(c)); }
			if (assistDoes("transfers")) { done.push(...assistTransfers(c)); }
		} finally { assistBatch = false; }
		if (done.length) {
			lastDeal = `Assistant (${when}): ${done.join("; ")}.`;
			c.log = [ ...(c.log || []), lastDeal ].slice(-10);
			afterClubChange();
		}
		return done;
	}
	function setAssist (m, run = false) {
		assistMode = ASSIST[m] ? m : "off";
		if (assistSel) { assistSel.value = assistMode; }
		store.set("ff-assist", assistMode);
		if (run) { assistRun("now"); }
	}
	if (assistSel) {
		assistSel.addEventListener("change", () => { setAssist(assistSel.value, true); toast(ASSIST[assistMode], "#f2b52e"); assistSel.blur(); });
		setAssist(store.get("ff-assist") || "off");
	}
