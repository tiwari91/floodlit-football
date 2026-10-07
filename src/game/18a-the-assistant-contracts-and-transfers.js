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
	// or a prospect with room to grow; not sulking. Age counts against the squad men, not the
	// starters: a 34-year-old still in the eleven gets his deal, a 33-year-old reserve does not.
	function assistKeeps (pl, c) {
		const role = roleOf(pl, c), starter = role === "key" || role === "first";
		if (pl.morale < 40 || pl.age >= (starter ? 36 : 33)) { return false; }
		return starter || ovrNow(pl) >= squadMedian(c) || (role === "prospect" && (pl.pot || 0) >= ovrNow(pl) + 6);
	}
	// Why a last-year player is left to run down, in a few words.
	function assistWhyNot (pl, c) {
		const role = roleOf(pl, c), starter = role === "key" || role === "first";
		if (pl.morale < 40) { return "unhappy"; }
		if (pl.age >= (starter ? 36 : 33)) { return `${pl.age}, too old`; }
		return "not worth a new deal";
	}
	function assistContracts (c) {
		const done = [], skint = [], left = [];
		// The most valuable first, so the money goes on the stars before the squad men.
		const lastYear = [ ...c.squad, ...c.bench ].filter(pl => { ensurePlayer(pl); return pl.contract <= 1; });
		const due = lastYear.filter(pl => assistKeeps(pl, c)).sort((a, b) => valueOf(b) - valueOf(a));
		for (const pl of due) {
			if (c.budget - round1(valueOf(pl) * 0.15) < ASSIST_RESERVE) { skint.push(pl.name); continue; }
			const deal = renewDeal(pl, c);
			if (deal.ok) { done.push(`${pl.name} signed on to ${pl.contract} seasons`); }
		}
		for (const pl of lastYear) { if (!due.includes(pl)) { left.push(`${pl.name} (${assistWhyNot(pl, c)})`); } }
		if (skint.length) { done.push(`no money yet for new deals for ${skint.slice(0, 4).join(", ")}${skint.length > 4 ? ` and ${skint.length - 4} more` : ""} (${money(ASSIST_RESERVE)} is kept for wages)`); }
		if (left.length) { done.push(`left to run down: ${left.slice(0, 5).join(", ")}${left.length > 5 ? ` and ${left.length - 5} more` : ""}`); }
		return done;
	}
	// The shortlist: who on the market would improve the eleven, by how much, and in whose place.
	// An unscouted player is judged on the middle of his estimate and marked as such.
	function assistShortlist (c) {
		const lg = league, out = [];
		c.market.forEach((pl, i) => {
			if (!permitOk(pl) || pl.bids < 0) { return; }
			const slots = slotsFor(lg.fmt).filter(sl => POS_OF_SLOT[sl] === pl.pos && c.squad[sl]);
			if (!slots.length) { return; }
			const weakSlot = slots.reduce((a, sl) => (matchOvr(c.squad[sl], POS_OF_SLOT[sl]) < matchOvr(c.squad[a], POS_OF_SLOT[a]) ? sl : a));
			const weakest = matchOvr(c.squad[weakSlot], POS_OF_SLOT[weakSlot]), rr = ratingRange(pl);
			const gain = (rr ? Math.round((rr[0] + rr[1]) / 2) : matchOvr(pl, pl.pos)) - weakest;
			if (gain >= 2) { out.push({ i, pl, gain, est: !!rr, weak: c.squad[weakSlot], weakOvr: weakest, ask: askOf(pl) }); }
		});
		return out.sort((a, b) => b.gain - a.gain || a.ask - b.ask).slice(0, 6);
	}
	// Where the eleven is thinnest: the two positions whose weakest starter rates lowest.
	function needsLine (c) {
		const lg = league, byPos = {};
		for (const sl of slotsFor(lg.fmt)) { const pos = POS_OF_SLOT[sl], pl = c.squad[sl]; if (!pl) { continue; } const o = matchOvr(pl, pos); if (!byPos[pos] || o < byPos[pos].o) { byPos[pos] = { o, pl }; } }
		const worst = Object.entries(byPos).sort((a, b) => a[1].o - b[1].o).slice(0, 2);
		return worst.length ? `Needs: ${worst.map(([ pos, w ]) => `${POS_LABEL[pos]} (${w.pl.name} ${w.o})`).join(", ")}.` : "";
	}
	function assistBids (c) {
		const lg = league, done = [];
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
		return done;
	}
	function assistSignings (c) {
		const lg = league, done = [];
		// Signings: the market player who most improves the weakest starter at his position, known
		// quantities only (scouted, or from home), at the asking price, at most two a window.
		for (let n = 0; n < 2; n++) {
			let best = null;
			c.market.forEach((pl, i) => {
				if (!permitOk(pl) || pl.bids < 0 || ratingRange(pl)) { return; }   // known quantities only: scouted, from home, or a scout who reads him exactly
				const ask = askOf(pl);
				if (c.budget - ask < ASSIST_RESERVE) { return; }
				const slots = slotsFor(lg.fmt).filter(sl => POS_OF_SLOT[sl] === pl.pos && c.squad[sl]);
				if (!slots.length) { return; }
				const weakest = Math.min(...slots.map(sl => matchOvr(c.squad[sl], POS_OF_SLOT[sl])));
				const gain = matchOvr(pl, pl.pos) - weakest;
				if (gain >= 3 && (!best || gain > best.gain || (gain === best.gain && ask < best.ask))) { best = { i, gain, ask, pl }; }
			});
			if (!best) { break; }
			signPlayer(best.i, best.ask);
			done.push(`signed ${best.pl.name} (${ovrNow(best.pl)}, ${POS_LABEL[best.pl.pos]}) for ${money(best.ask)}`);
		}
		return done;
	}
	function assistTransfers (c) {
		if (!windowOpen() || c.budget < 0) { return []; }
		const done = [ ...assistBids(c), ...assistSignings(c) ];
		if (done.some(d => d.startsWith("signed") || d.startsWith("sold"))) { autoPick(false, true); }
		return done;
	}
	// One click from the window: the assistant's signings, whether or not he is switched on.
	function assistBuy () {
		const c = league && league.club;
		if (!c || !windowOpen() || c.budget < 0) { return []; }
		assistBatch = true;
		let done = [];
		try { done = assistSignings(c); } finally { assistBatch = false; }
		if (done.length) { autoPick(false, true); }
		lastDeal = done.length ? `Assistant: ${done.join("; ")}.` : "Assistant: nothing on the list is a clear step up at a price that keeps the wage reserve. Scout the shortlist, or bid yourself.";
		if (done.length) { c.log = [ ...(c.log || []), lastDeal ].slice(-10); }
		afterClubChange();
		return done;
	}
	// Spend the window's scouting reports on the shortlist, best gain first.
	function scoutShortlist () {
		const c = league && league.club;
		if (!c) { return 0; }
		let n = 0;
		for (const x of assistShortlist(c).filter(x => x.est)) { if (!(c.scoutLeft > 0)) { break; } c.market[x.i].scouted = true; c.scoutLeft--; n++; }
		lastDeal = n ? `Scouted ${n} from the shortlist.` : c.scoutLeft > 0 ? "The shortlist is already scouted." : "No scouting reports left this window.";
		afterClubChange();
		return n;
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
		assistSel.addEventListener("change", () => {
			setAssist(assistSel.value, false);
			const done = assistRun("now");
			const acted = done.filter(d => !/^(no money yet|left to run down)/.test(d)).length;
			toast(assistMode === "off" ? ASSIST.off : acted ? `Assistant: ${acted} done, see League notes` : done.length ? "Assistant: nothing it can do yet, see League notes" : "Assistant: nothing to do right now", "#f2b52e");
			assistSel.blur();
		});
		setAssist(store.get("ff-assist") || "off");
	}
