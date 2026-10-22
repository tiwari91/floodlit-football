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
	// How much a player in his last year matters to the side, for the order of renewals: his rating
	// against the middle of the squad, his place in the side, his age (young men with room to grow
	// count for more, men past 31 for less), whether anyone else can do his job and how much he plays.
	function renewWorth (pl, c) {
		ensurePlayer(pl);
		const o = ovrNow(pl), role = roleOf(pl, c), all = [ ...c.squad, ...c.bench ];
		const cover = all.filter(q => q !== pl && q.pos === pl.pos && ovrNow(q) >= o - 2).length;
		const need = pl.pos === "gk" ? (cover ? 0 : 10) : cover === 0 ? 8 : cover === 1 ? 4 : cover === 2 ? 1 : 0;
		const age = pl.age <= 23 ? 3 + Math.max(0, (pl.pot || o) - o) * 0.3 : pl.age <= 29 ? 2 : pl.age <= 31 ? 0 : -(pl.age - 31) * 2.5;
		const played = league && league.round > 0 ? Math.min(1, (pl.apps || 0) / league.round) * 5 : 0;
		return Math.round((o - squadMedian(c)) + ({ key: 10, first: 6, prospect: 2 }[role] || 0) + age + need + played);
	}
	// What to offer him, or why not: a longer deal for the young and the important, one season for
	// men past 31 and the fringe, a pay cut for an older squad man, and a free transfer for those not
	// worth keeping (a squad man of 33 or more, or one well short of the squad with others covering).
	function renewPlan (pl, c) {
		const role = roleOf(pl, c), starter = role === "key" || role === "first", worth = renewWorth(pl, c), o = ovrNow(pl);
		const prospect = role === "prospect" && (pl.pot || 0) >= o + 6;
		if (lastSeason(pl)) { return { keep: false, worth, why: `${pl.age}, retiring at the end of the season` }; }
		if (pl.morale < 40) { return { keep: false, worth, sulk: true, why: `unhappy (morale ${pl.morale}), so he won't talk about a new deal yet` }; }
		if (!starter && !prospect && pl.age >= 33) { return { keep: false, worth, free: true, why: `${pl.age} and not in the side` }; }
		if (!starter && !prospect && worth < -4) { return { keep: false, worth, free: true, why: "not needed, others cover his position" }; }
		const years = oneYearOnly(pl) || pl.age >= 31 || (!starter && !prospect && (worth < 2 || pl.age > 24)) ? 1 : pl.age <= 25 && (starter || prospect) ? 3 : 2;
		const rise = role === "key" ? 1.2 : starter ? 1.1 : pl.age >= 31 ? 0.9 : 1;
		const fee = round1(valueOf(pl) * 0.15 * (years === 1 ? 0.5 : years === 3 ? 1.2 : 1));
		return { keep: true, key: role === "key" || worth >= 12, years, rise, fee, worth };
	}
	// He walks in the summer unless something is done: the club's standard summer deal only goes to
	// happy players under 34, a year older by then (see rolloverClub).
	const atRisk = pl => pl.morale < 50 || pl.age >= 33;
	const gamesLeft = () => (league ? Math.max(0, league.fixtures.length - league.round) : 0);
	const endsWhen = (summer = false) => { const n = gamesLeft(); return n > 0 && !summer ? `deal ends this summer, ${n} game${n === 1 ? "" : "s"} left` : "deal ends now"; };
	const who = pl => `${pl.name} (${POS_LABEL[pl.pos]} ${ovrNow(pl)}, ${pl.age})`;
	const seasons = n => `${n} more season${n === 1 ? "" : "s"}`;
	const listNames = (a, n = 4) => `${a.slice(0, n).join(", ")}${a.length > n ? ` and ${a.length - n} more` : ""}`;
	// Squad men who could be sold to pay for the deals: off the bench, not a starter or a prospect,
	// never the last keeper and never worth more than the men being kept; cheapest to lose first,
	// only as many as the shortfall needs.
	function sellToFund (c, need, keep) {
		const all = [ ...c.squad, ...c.bench ], top = Math.max(0, ...keep.map(valueOf)), lg = league, others = lg.members.filter(id => id !== 0), out = [];
		const pool = c.bench.filter(pl => {
			const r = roleOf(pl, c);
			if (keep.includes(pl) || r === "key" || r === "first" || (r === "prospect" && (pl.pot || 0) >= ovrNow(pl) + 6)) { return false; }
			if (pl.pos === "gk" && all.filter(q => q.pos === "gk").length < 2) { return false; }
			return pl.contract > 1 && valueOf(pl) <= top;
		}).sort((a, b) => ovrNow(a) - ovrNow(b) || valueOf(b) - valueOf(a));
		let got = 0;
		for (const pl of pool) {
			if (got >= need - 1e-9) { break; }
			const fee = round1(Math.max(0.1, valueOf(pl) * 0.85));
			out.push({ pl, name: pl.name, fee, club: others[hashStr(pl.name + lg.round + lg.season) % others.length] });
			got = round1(got + fee);
		}
		return out;
	}
	// Every player in his last year, the most important first: a new deal on sensible terms while the
	// money lasts above the wage reserve, a free transfer for those not worth keeping. Short of money,
	// a key man who would otherwise walk signs with no signing-on fee and a bigger rise instead, and
	// squad men are sold to pay for the rest (with transfers on too and a window open) or suggested.
	// Writes the plain-words report the League panel shows (league.assistReport); returns what it did.
	function assistContracts (c, reserve = ASSIST_RESERVE, when = "") {
		const rep = { when, renewed: [], unsigned: [], leaving: [], sold: [], next: [], sell: [] }, done = [];
		const lastYear = [ ...c.squad, ...c.bench ].filter(pl => { ensurePlayer(pl); return pl.contract <= 1; });
		const plans = new Map(lastYear.map(pl => [ pl, renewPlan(pl, c) ]));
		const order = lastYear.slice().sort((a, b) => plans.get(b).worth - plans.get(a).worth);
		const sign = (pl, pn, terms) => {
			const deal = renewDeal(pl, c, terms);
			if (!deal.ok) { return false; }
			rep.renewed.push(`${who(pl)}: ${seasons(terms.years)} at ${wageWeek(pl.wage)}${terms.fee ? `, ${money(terms.fee)} to sign` : ", no signing-on fee and a bigger rise instead"}`);
			done.push(`renewed ${pl.name} for ${seasons(terms.years)}`);
			return true;
		};
		let short = [];
		for (const pl of order) {
			const pn = plans.get(pl);
			pl.letGo = !pn.keep && !!pn.free;
			if (!pn.keep) { continue; }
			if (c.budget - pn.fee >= reserve - 1e-9) { sign(pl, pn, pn); continue; }
			if (pn.key && atRisk(pl) && c.budget >= 0) { sign(pl, pn, { ...pn, fee: 0, rise: pn.rise + 0.25 }); continue; }
			short.push(pl);
		}
		// Raise the money by selling a squad man or two, when the assistant may and a window is open.
		if (short.length) {
			const need = round1(short.reduce((t, pl) => t + plans.get(pl).fee, 0) - Math.max(0, c.budget - reserve));
			const sales = windowOpen() && c.budget >= 0 ? sellToFund(c, need, lastYear) : [];
			if (sales.length && assistDoes("transfers")) {
				for (const s of sales) { sellPlayer(s.name, s.fee, s.club); rep.sold.push(`${s.name} to ${TEAMS[s.club].name} for ${money(s.fee)}`); done.push(`funded: sold ${s.name}`); }
				short = short.filter(pl => { const pn = plans.get(pl); return !(c.budget - pn.fee >= reserve - 1e-9 && sign(pl, pn, pn)); });
			} else if (sales.length) { rep.sell = sales.map(s => ({ name: s.name, fee: s.fee, club: s.club })); }
		}
		const spare = round1(Math.max(0, c.budget - reserve));
		for (const pl of short) {
			const pn = plans.get(pl);
			const fate = atRisk(pl) ? "He leaves on a free in the summer unless you act." : "If he stays happy he signs the club's standard two-year deal in the summer anyway.";
			rep.unsigned.push({ name: pl.name, key: pn.key && atRisk(pl), text: `${who(pl)}: ${endsWhen(when === "summer")}. A new deal needs ${money(pn.fee)} to sign and ${spare > 0 ? `only ${money(spare)} is free` : "there's no money free"}. ${fate}` });
		}
		for (const pl of order) {
			const pn = plans.get(pl);
			if (pn.keep) { continue; }
			if (pn.sulk) { rep.unsigned.push({ name: pl.name, key: roleOf(pl, c) === "key" || roleOf(pl, c) === "first", text: `${who(pl)}: ${endsWhen(when === "summer")}. He's ${pn.why}. Play him more to win him round, or he leaves on a free.` }); }
			else { rep.leaving.push(`${who(pl)}: ${pn.why}, so he leaves on a free in the summer`); }
		}
		rep.unsigned.sort((a, b) => b.key - a.key);
		if (short.length) {
			const need = round1(short.reduce((t, pl) => t + plans.get(pl).fee, 0));
			if (rep.sell.length) { rep.next.push(`Sell ${rep.sell.map(s => `${s.name} (${money(s.fee)})`).join(" and ")} to pay for the new deals.`); }
			else if (!windowOpen()) { rep.next.push(`Sell a squad player when the window opens ${league.round < JANUARY ? "in January" : "at the end of the season"} to pay for the new deals.`); }
			if (reserve > 0 && c.budget > 0.05) { rep.next.push(`Spend the ${money(Math.min(c.budget, reserve))} kept back for wages on them.`); }
			rep.next.push("Or offer the deals yourself from the squad list.");
			if (league) { league.assistShort = reserve > 0 ? { names: short.map(pl => pl.name), need, have: round1(Math.max(0, c.budget)), reserve } : null; }
		} else if (league) { league.assistShort = null; }
		if (rep.unsigned.some(u => !short.some(pl => pl.name === u.name))) { rep.next.push("Unhappy players come round with games and good results; a word in the squad list (his role) helps."); }
		if (league) { league.assistReport = rep.renewed.length || rep.unsigned.length || rep.leaving.length || rep.sold.length ? rep : null; }
		for (const u of rep.unsigned) { done.push(`not renewed: ${u.name}`); }
		for (const l of rep.leaving) { done.push(`leaving: ${l.split(" (")[0]}`); }
		return done;
	}
	// The report as one line of text, for the club log and the transfer notes.
	function reportText (rep) {
		const parts = [];
		if (rep.renewed.length) { parts.push(`renewed ${rep.renewed.map(r => r.replace(/ \([^)]*\)/, "").replace(/, (£[\d.]+[mk] to sign|no signing-on fee and a bigger rise instead)$/, "")).join("; ")}`); }
		if (rep.sold.length) { parts.push(`sold ${rep.sold.join(", ")} to pay for them`); }
		if (rep.unsigned.length) { parts.push(`not signed yet: ${listNames(rep.unsigned.map(u => u.name))} (${endsWhen(rep.when === "summer")})`); }
		if (rep.leaving.length) { parts.push(`leaving on a free: ${listNames(rep.leaving.map(l => l.split(" (")[0]))}`); }
		return parts.map(t => t[0].toUpperCase() + t.slice(1)).join(". ");
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
		for (const pl of keyPlayers(c).filter(pl => assistKeeps(pl, c)).sort((a, b) => renewWorth(b, c) - renewWorth(a, c))) {
			if (c.budget - round1(valueOf(pl) * 0.15) < ASSIST_RESERVE) { skint.push(pl.name); continue; }
			const deal = renewDeal(pl, c);
			if (deal.ok) { done.push(`${pl.name} to ${pl.contract} seasons`); }
		}
		const note = [];
		if (done.length) { note.push(`kept on before their deals ran out: ${done.join(", ")}`); }
		if (skint.length) { note.push(`no money to keep ${listNames(skint)} on new terms, so ${skint.length === 1 ? "he stays on the club's standard deal if he's happy, or leaves" : "they stay on the club's standard deal if they're happy, or leave"} on a free`); }
		if (note.length) {
			lastDeal = `Contracts (summer): ${note.join("; ")}.`;
			c.log = [ ...(c.log || []), lastDeal ].slice(-10);
			if (league) { league.news = `${league.news || ""} ${lastDeal}`.trim(); }
			toast(done.length ? `Kept on: ${done.length} key player${done.length === 1 ? "" : "s"}` : `No money to keep ${skint[0]}`, "#f2b52e");
		}
		return done;
	}
	// A heads-up at the January window, with ten games to go and with two: which important players
	// are in their last year, when, and what will happen about it.
	function contractAlerts () {
		const c = league && league.club;
		if (!c) { return []; }
		const due = keyPlayers(c);
		if (!due.length) { return []; }
		const names = due.map(pl => `${pl.name} (${ovrNow(pl)})`), rep = league.assistReport, stuck = rep ? rep.unsigned.filter(u => due.some(pl => pl.name === u.name)).map(u => u.name) : [];
		const plan = assistMode !== "off" && assistDoes("contracts")
			? stuck.length ? `the assistant can't sign ${listNames(stuck)} yet, see Your team` : "the assistant is sorting their deals"
			: "offer new deals from the squad list, or the club tries to keep them on in the summer if the money is there";
		lastDeal = `Contracts ending in ${gamesLeft()} games for ${listNames(names)}: ${plan}.`;
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
	// Open a player's contract row in the squad list and bring it into view.
	function showContract (name) {
		openPl = name || null;
		renderClub();
		const row = $("sqBody") && $("sqBody").querySelector("tr.detail");
		if (row && row.scrollIntoView) { row.scrollIntoView({ block: "center", behavior: "smooth" }); }
	}
	function renderAssistNote () {
		const p = $("assistNote");
		if (!p) { return; }
		if (assistMode === "off") { p.textContent = "Off: you renew contracts, answer bids and sign players yourself. Starters in their last year are still kept on in the summer if the money is there."; return; }
		const c = league && league.club, rep = c && assistDoes("contracts") ? league.assistReport : null;
		if (!rep) { p.textContent = c ? (league.assistNote || `Assistant: nothing to do right now (${assistIdleWhy(c)}). It looks again after every match and when a window opens.`) : ""; return; }
		// The contracts report as a short list: who signed, who hasn't and why, who is leaving, what next.
		p.replaceChildren(el("b", "", `Contracts${rep.when ? `, ${rep.when}` : ""}`));
		const ul = el("ul", "assist-list");
		const sec = (title, items, cls = "") => { for (const t of items) { const li = el("li", cls); li.append(el("b", "", `${title} `), document.createTextNode(t)); ul.append(li); } };
		sec("Renewed:", rep.renewed);
		sec("Sold to pay for them:", rep.sold);
		for (const u of rep.unsigned) { const li = el("li", u.key ? "warn" : ""); li.append(el("b", "", u.key ? "Key man not signed:" : "Not signed yet:"), document.createTextNode(` ${u.text}`)); ul.append(li); }
		sec("Leaving:", rep.leaving);
		sec("Next:", rep.next, "next");
		p.append(ul);
		if ((league.assistDeals || []).length) { p.append(el("span", "", `Transfers: ${league.assistDeals.join("; ")}.`)); }
		const ask = el("div", "assist-ask");
		const btn = (text, fn, off = false) => { const b = el("button", "", text); b.type = "button"; b.disabled = off; b.addEventListener("click", fn); ask.append(b); return b; };
		const sh = league.assistShort;
		if (sh && sh.names.length && sh.have > 0.05) { btn(`Spend the wage money (${money(Math.min(sh.have, sh.reserve))})`, () => assistRenewAnyway()); }
		for (const s of rep.sell || []) { btn(`Sell ${s.name} (${money(s.fee)})`, () => { sellPlayer(s.name, s.fee, s.club); assistRun("after the sale", true); }, !windowOpen()); }
		if (rep.unsigned.length) { btn("Show in the squad list", () => showContract(rep.unsigned[0].name)); }
		if (sh && sh.names.length) { btn("Leave them for now", () => { league.assistShort = null; rep.next = [ "You chose to leave the unsigned deals for now. The assistant asks again when the money changes." ]; saveLeague(); renderAssistNote(); }); }
		if (ask.childElementCount) { p.append(ask); }
	}
	// The manager said yes: the same renewals with no reserve, as far as the money goes.
	function assistRenewAnyway () {
		const c = league && league.club;
		if (!c) { return []; }
		assistBatch = true;
		let done = [];
		try { done = assistContracts(c, 0, "using the wage money"); } finally { assistBatch = false; }
		league.assistShort = null;
		const rep = league.assistReport;
		league.assistNote = rep ? `Assistant (using the wage money): ${reportText(rep)}.` : "Assistant: nothing more could be signed.";
		lastDeal = league.assistNote;
		c.log = [ ...(c.log || []), lastDeal ].slice(-10);
		const n = done.filter(d => /^renewed /.test(d)).length;
		toast(n ? `Renewed ${n} with the wage money` : "Nothing more could be signed", "#f2b52e");
		afterClubChange();
		renderAssistNote();
		return done;
	}
	// Runs after a league week and when a window opens; also the moment the setting is switched on.
	// The note is logged when something was done or the list of unsigned men changes, not every week.
	function assistRun (when, force = false) {
		if (!league || !league.club || assistMode === "off") { return []; }
		const c = league.club, done = [];
		let rep = null;
		assistBatch = true;
		try {
			if (assistDoes("contracts")) { done.push(...assistContracts(c, ASSIST_RESERVE, when)); rep = league.assistReport; } else { league.assistReport = null; }
			if (assistDoes("transfers")) { done.push(...assistTransfers(c)); }
		} finally { assistBatch = false; }
		const deals = done.filter(d => !/^(renewed|not renewed|leaving|funded)/.test(d));
		league.assistDeals = deals;
		const text = [ rep ? reportText(rep) : "", deals.join("; ") ].filter(Boolean).join(". ");
		league.assistNote = text ? `Assistant (${when}): ${text}.` : null;
		const acted = done.some(d => /^(renewed|funded|sold|signed|turned down)/.test(d));
		const sig = rep ? rep.unsigned.map(u => u.name).join(",") + "|" + rep.leaving.length : "";
		if (league.assistNote && (acted || force || sig !== league.assistSig)) {
			lastDeal = league.assistNote;
			c.log = [ ...(c.log || []), lastDeal ].slice(-10);
			afterClubChange();
		}
		league.assistSig = sig;
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
			const done = assistRun("now", true);
			const acted = done.filter(d => !/^(not renewed|leaving)/.test(d)).length;
			toast(assistMode === "off" ? ASSIST.off : acted ? `Assistant: ${acted} done, see League notes` : done.length ? "Assistant: nothing it can do yet, see League notes" : "Assistant: nothing to do right now", "#f2b52e");
			renderAssistNote();
			assistSel.blur();
		});
		setAssist(store.get("ff-assist") || "off");
	}
