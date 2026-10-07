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
	// Why a last-year player is left to run down: only because he won't talk.
	const assistWhyNot = pl => (pl.morale < 40 ? `unhappy, morale ${pl.morale}` : "");
	// Every player in his last year gets a new deal, the most valuable first so the money goes on the
	// stars before the squad men, as far as the budget allows above the reserve. Only a player who
	// won't talk (unhappy) is left to run down; the note says so.
	function assistContracts (c, reserve = ASSIST_RESERVE) {
		const done = [], skint = [], left = [];
		let need = 0;
		const lastYear = [ ...c.squad, ...c.bench ].filter(pl => { ensurePlayer(pl); return pl.contract <= 1; });
		const due = lastYear.filter(pl => pl.morale >= 40).sort((a, b) => valueOf(b) - valueOf(a));
		for (const pl of due) {
			const fee = round1(valueOf(pl) * 0.15);
			if (c.budget - fee < reserve) { skint.push(pl.name); need = round1(need + fee); continue; }
			const deal = renewDeal(pl, c);
			if (deal.ok) { done.push(`${pl.name} signed on to ${pl.contract} seasons`); }
		}
		for (const pl of lastYear) { if (!due.includes(pl)) { left.push(`${pl.name} (${assistWhyNot(pl)})`); } }
		if (skint.length) { done.push(`no money yet for new deals for ${skint.slice(0, 4).join(", ")}${skint.length > 4 ? ` and ${skint.length - 4} more` : ""} (${money(reserve)} is kept for wages)`); }
		// Short of money: put the call to the manager rather than just reporting it (see renderAssistNote).
		if (league) { league.assistShort = skint.length && reserve > 0 ? { names: skint, need, have: round1(Math.max(0, c.budget)), reserve } : null; }
		if (left.length) { done.push(`left to run down: ${left.slice(0, 5).join(", ")}${left.length > 5 ? ` and ${left.length - 5} more` : ""}`); }
		return done;
	}
	// Your important players: starters (key or first-team) in the last year of their deal.
	function keyPlayers (c) {
		return [ ...c.squad, ...c.bench ].filter(pl => { ensurePlayer(pl); const r = roleOf(pl, c); return (r === "key" || r === "first") && pl.contract <= 1; });
	}
	// Important players never just walk: even with the assistant off, the club renews its last-year
	// starters in the summer, most valuable first, as far as the money allows. Says who it couldn't.
	function keyContracts (c) {
		if (assistMode !== "off" && assistDoes("contracts")) { return []; }   // the assistant has already been through them
		const done = [], skint = [];
		for (const pl of keyPlayers(c).filter(pl => assistKeeps(pl, c)).sort((a, b) => valueOf(b) - valueOf(a))) {
			if (c.budget - round1(valueOf(pl) * 0.15) < ASSIST_RESERVE) { skint.push(pl.name); continue; }
			const deal = renewDeal(pl, c);
			if (deal.ok) { done.push(`${pl.name} to ${pl.contract} seasons`); }
		}
		const note = [];
		if (done.length) { note.push(`kept on before their deals ran out: ${done.join(", ")}`); }
		if (skint.length) { note.push(`no money to keep ${skint.join(", ")} (${money(ASSIST_RESERVE)} is kept for wages)`); }
		if (note.length) {
			lastDeal = `Contracts (summer): ${note.join("; ")}.`;
			c.log = [ ...(c.log || []), lastDeal ].slice(-10);
			if (league) { league.news = `${league.news || ""} ${lastDeal}`.trim(); }
			toast(done.length ? `Kept on: ${done.length} key player${done.length === 1 ? "" : "s"}` : `No money to keep ${skint[0]}`, "#f2b52e");
		}
		return done;
	}
	// A heads-up at the January window and with two games to go: which important players are in
	// their last year, and what will happen about it.
	function contractAlerts () {
		const c = league && league.club;
		if (!c) { return []; }
		const due = keyPlayers(c);
		if (!due.length) { return []; }
		const names = due.map(pl => `${pl.name} (${ovrNow(pl)})`);
		const plan = assistMode !== "off" && assistDoes("contracts") ? "the assistant will sort their deals" : "renew in Your team, or they are kept on in the summer as far as the money allows";
		lastDeal = `Contracts ending for ${names.slice(0, 4).join(", ")}${due.length > 4 ? ` and ${due.length - 4} more` : ""}: ${plan}.`;
		c.log = [ ...(c.log || []), lastDeal ].slice(-10);
		league.news = `${league.news || ""} ${lastDeal}`.trim();
		toast(`Contracts ending: ${due.length} key player${due.length === 1 ? "" : "s"}, see League notes`, "#f2b52e");
		return due;
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
	// What the assistant has to say, standing under its control: what it did last, or why there was
	// nothing to do, so switching it on is never a silent act.
	function assistIdleWhy (c) {
		const lastYear = [ ...c.squad, ...c.bench ].filter(pl => { ensurePlayer(pl); return pl.contract <= 1; }), why = [];
		if (assistDoes("contracts")) { why.push(lastYear.length ? `${lastYear.length} in the last year of a deal but none will talk while unhappy` : "nobody is in the last year of his deal"); }
		if (assistDoes("transfers")) {
			why.push((league.bidsIn || []).length ? "bids are waiting for your answer" : "no bids in");
			why.push(windowOpen() ? "nothing on the market is a clear step up at a price that keeps the wage reserve" : "the window is closed, so no signings until it opens");
		}
		return why.join("; ");
	}
	function renderAssistNote () {
		const p = $("assistNote");
		if (!p) { return; }
		if (assistMode === "off") { p.textContent = "Off: you renew contracts, answer bids and sign players yourself. Starters in their last year are still kept on in the summer if the money is there."; return; }
		const c = league && league.club;
		p.textContent = c ? (league.assistNote || `Assistant: nothing to do right now (${assistIdleWhy(c)}). It looks again after every match and when a window opens.`) : "";
		const sh = c && league.assistShort;
		if (!sh || !sh.names.length) { return; }
		// The manager's call: spend the wage reserve on the deals the money reaches, or leave them for now.
		const canDo = sh.have > 0.05 ? `Spending the reserve covers about ${Math.min(sh.names.length, Math.max(0, Math.floor(sh.have / Math.max(0.05, sh.need / sh.names.length))))} of the ${sh.names.length}.` : "There is nothing to spend.";
		const ask = el("div", "assist-ask");
		ask.append(el("span", "", `${sh.names.length} new deal${sh.names.length === 1 ? "" : "s"} need${sh.names.length === 1 ? "s" : ""} ${money(sh.need)}; ${money(sh.have)} in the bank, ${money(sh.reserve)} of it the wage reserve. ${canDo} Your call:`));
		const yes = el("button", "", "Renew anyway, spend the reserve"); yes.type = "button"; yes.disabled = sh.have <= 0.05; yes.addEventListener("click", () => assistRenewAnyway());
		const no = el("button", "", "Leave them for now"); no.type = "button"; no.addEventListener("click", () => { league.assistShort = null; league.assistNote = `${league.assistNote || "Assistant:"} You chose to leave the unsigned deals for now; the assistant will ask again when the money changes.`; saveLeague(); renderAssistNote(); });
		ask.append(yes, no);
		p.append(ask);
	}
	// The manager said yes: the same renewals with no reserve, as far as the money goes.
	function assistRenewAnyway () {
		const c = league && league.club;
		if (!c) { return []; }
		assistBatch = true;
		let done = [];
		try { done = assistContracts(c, 0); } finally { assistBatch = false; }
		league.assistShort = null;
		league.assistNote = `Assistant (your call, reserve spent): ${done.length ? done.join("; ") : "nothing more could be signed"}.`;
		lastDeal = league.assistNote;
		c.log = [ ...(c.log || []), lastDeal ].slice(-10);
		toast(`Renewed ${done.filter(d => / signed on to /.test(d)).length} on your say-so`, "#f2b52e");
		afterClubChange();
		renderAssistNote();
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
		league.assistNote = done.length ? `Assistant (${when}): ${done.join("; ")}.` : null;
		if (done.length) {
			lastDeal = league.assistNote;
			c.log = [ ...(c.log || []), lastDeal ].slice(-10);
			afterClubChange();
		}
		renderAssistNote();
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
			renderAssistNote();
			assistSel.blur();
		});
		setAssist(store.get("ff-assist") || "off");
	}
