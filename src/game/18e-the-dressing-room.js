	/* ---------- the dressing room: rows, refusals and transfer requests ----------
	   Players have tempers. A star left out, a man played out of position, a hammering or a run on
	   the bench can each turn into a problem for you to deal with in the League panel, and every
	   choice there changes his morale, the mood in the dressing room and his form. Players can also
	   say no: to a new contract, to a move to a smaller club, or to a move a long way from home.
	   Everything lives in league.drama and on the players, and old saves are filled in on load. */
	const temperOf = pl => (pl && Number.isFinite(pl.temper) ? pl.temper : 20 + (hashStr(String(pl && pl.name) + "|temper") % 70));   // 20 to 89
	const temperWord = t => (t >= 75 ? "Hot-headed" : t >= 55 ? "Fiery" : t >= 35 ? "Level-headed" : "Calm");
	const DRAMA_KINDS = { dropped: 1, oop: 1, request: 1, row: 1, contract: 1, signing: 1 };
	const ISSUE_CAP = 4;
	const POS_WHERE = { def: "in defence", mid: "in midfield", fwd: "up front" }, POS_WHO = { gk: "keeper", def: "defender", mid: "midfielder", fwd: "forward" };
	function ensureDrama (lg) {
		if (!lg || typeof lg !== "object") { return null; }
		const d = lg.drama && typeof lg.drama === "object" && !Array.isArray(lg.drama) ? lg.drama : {};
		d.issues = Array.isArray(d.issues) ? d.issues.filter(i => i && typeof i === "object" && DRAMA_KINDS[i.kind] && typeof i.name === "string" && typeof i.text === "string") : [];
		if (!Number.isFinite(d.room)) { d.room = 70; }
		d.room = clamp(Math.round(d.room), 0, 100);
		d.log = Array.isArray(d.log) ? d.log.filter(s => typeof s === "string").slice(-6) : [];
		if (!Number.isFinite(d.seq)) { d.seq = 0; }
		lg.drama = d;
		const c = lg.club;
		if (c && Array.isArray(c.squad)) {
			const here = new Set([ ...c.squad, ...(c.bench || []) ].filter(Boolean).map(p => p.name));
			d.issues = d.issues.filter(i => i.kind === "signing" || here.has(i.name));   // he has gone: so has the problem
			for (const pl of [ ...c.squad, ...(c.bench || []) ]) {
				if (!pl) { continue; }
				if (!Number.isFinite(pl.temper)) { pl.temper = temperOf(pl); }
				if (!Number.isFinite(pl.benched)) { pl.benched = 0; }
				if (!Number.isFinite(pl.oopN)) { pl.oopN = 0; }
				if (typeof pl.wantsOut !== "boolean") { pl.wantsOut = false; }
			}
		}
		return d;
	}
	const clubPlayer = name => (league && league.club ? [ ...league.club.squad, ...league.club.bench ].find(p => p.name === name) : null);
	const roomWord = r => (r >= 75 ? "Happy" : r >= 55 ? "Settled" : r >= 35 ? "Tense" : "Mutinous");
	// Nudges his form (the last five ratings) up or down, which feeds the form bonus in a match.
	function nudgeForm (pl, d) {
		if (!Array.isArray(pl.form) || !pl.form.length) { pl.form = [ 6.6 ]; }
		const i = pl.form.length - 1;
		pl.form[i] = Math.round(clamp(pl.form[i] + d, 3, 10) * 10) / 10;
	}
	function dramaLog (text) {
		const d = ensureDrama(league);
		d.log = [ ...d.log, text ].slice(-6);
	}
	function addIssue (kind, pl, text, o = {}) {
		const d = ensureDrama(league);
		if (d.issues.some(i => i.name === pl.name && i.kind === kind)) { return null; }
		if (kind !== "contract" && kind !== "signing" && d.issues.filter(i => i.kind !== "contract" && i.kind !== "signing").length >= ISSUE_CAP) { return null; }
		const issue = { id: ++d.seq, kind, name: pl.name, text, ...o };
		d.issues.push(issue);
		return issue;
	}

	// What you can do about each kind of problem: the label on the button and what it does.
	const MANAGER_CHOICES = [ [ "talk", "Talk to him" ], [ "back", "Back yourself" ], [ "fine", "Fine him" ], [ "drop", "Drop him" ] ];
	function choicesFor (issue) {
		if (issue.kind === "contract") { return [ [ "pay", issue.wantsOut ? "Talk him round" : `Pay what he asks (${wageWeek(issue.ask || 0)})` ], [ "letgo", issue.wantsOut ? "Sell him or let him go" : "Let him go" ] ]; }
		if (issue.kind === "signing") { return [ [ "offer", `Offer ${money(issue.offer || 0)}` ], [ "forget", "Forget him" ] ]; }
		return MANAGER_CHOICES;
	}
	// Morale, dressing room and form, per kind and choice. A calm man takes a talk better; a hot-head
	// takes a fine worse. Backing yourself after a row he started steadies the rest of the squad.
	const EFFECTS = {
		dropped: { talk: [ 8, 1, 0 ], back: [ -6, 2, -0.2 ], fine: [ -12, -3, -0.4 ], drop: [ -15, -2, -0.6 ] },
		oop: { talk: [ 6, 1, 0.2 ], back: [ -8, 1, -0.3 ], fine: [ -12, -2, -0.4 ], drop: [ -10, 0, -0.5 ] },
		request: { talk: [ 10, 2, 0.2 ], back: [ -5, 0, -0.3 ], fine: [ -12, -4, -0.5 ], drop: [ -10, -1, -0.5 ] },
		row: { talk: [ 5, 3, 0.2 ], back: [ -6, 4, 0 ], fine: [ -8, 5, -0.2 ], drop: [ -10, 2, -0.4 ] }
	};
	function resolveIssue (id, choice) {
		const d = ensureDrama(league), c = league.club, issue = d.issues.find(i => i.id === id);
		if (!issue) { return null; }
		const pl = clubPlayer(issue.name);
		d.issues = d.issues.filter(i => i !== issue);
		let note = "";
		if (!pl && issue.kind !== "signing") { note = `${issue.name} has gone, so that's the end of it.`; }
		else if (issue.kind === "contract") {
			if (choice === "pay" && issue.wantsOut) {
				const hot = temperOf(pl) >= 75;
				if (pl.morale >= 50 && !hot) { pl.wantsOut = false; pl.benched = 0; pl.morale = clamp(pl.morale + 6, 5, 100); note = `${pl.name} has calmed down and will talk about a new deal again.`; }
				else { note = `${pl.name} won't be talked round yet. Pick him for a few games, or sell him in the window.`; addIssue("contract", pl, issue.text, { wantsOut: true }); }
			} else if (choice === "pay") {
				pl.askPaid = league.season;
				const r = renewDeal(pl, c, { years: 2, rise: issue.rise || 1.35, fee: issue.fee || 0 });
				note = r.ok ? `${pl.name} gets his rise and signs. ${r.why}` : r.why;
			} else { pl.letGo = true; note = `${pl.name} will leave when his contract runs out${pl.wantsOut && windowOpen() ? ", or sell him now from the squad list" : ""}.`; }
		} else if (issue.kind === "signing") {
			const i = c.market.findIndex(m => m.name === issue.name);
			if (choice === "offer" && i >= 0) { signPlayer(i, issue.offer); return lastDeal; }
			note = choice === "offer" ? `${issue.name} is no longer on the market.` : `You've moved on from ${issue.name}.`;
		} else {
			const e = (EFFECTS[issue.kind] || EFFECTS.row)[choice] || [ 0, 0, 0 ], t = temperOf(pl);
			let dm = e[0], dr = e[1];
			if (choice === "talk" && t < 40) { dm += 3; }
			if (choice === "fine" && t >= 75) { dm -= 4; dr -= 2; }
			pl.morale = clamp(Math.round(pl.morale + dm), 5, 100);
			d.room = clamp(Math.round(d.room + dr), 0, 100);
			nudgeForm(pl, e[2]);
			if (choice === "fine") { const f = Math.max(0.001, wageOf(pl) / 52); c.budget = Math.round((c.budget + f) * 1000) / 1000; }
			if (choice === "drop") { dropToBench(pl); }
			if (issue.kind === "request") {
				if (choice === "talk") { pl.wantsOut = false; pl.benched = 0; pl.promised = 3; }
				if (choice === "back") { pl.listed = true; }
			}
			if (issue.kind === "oop" && choice === "talk") { pl.posPromise = true; }
			note = {
				talk: `You had a quiet word with ${pl.name}. He's calmer for it (morale ${pl.morale}).`,
				back: `You stood your ground with ${pl.name}. He isn't happy (morale ${pl.morale}), but the squad know who's in charge.`,
				fine: `${pl.name} has been fined a week's wages. Morale ${pl.morale}; the dressing room is ${roomWord(d.room).toLowerCase()}.`,
				drop: `${pl.name} is out of the side. Morale ${pl.morale}.`
			}[choice] || "";
		}
		dramaLog(note);
		lastDeal = note;
		if (typeof afterClubChange === "function") { afterClubChange(); }
		return note;
	}
	// Out of the eleven: he swaps with the best man on the bench who plays his position.
	function dropToBench (pl) {
		const c = league.club, i = c.squad.indexOf(pl);
		pl.role = "rotation";
		if (i < 0) { return; }
		const j = c.bench.reduce((b, q, k) => (q.pos === pl.pos && !q.injured && (b < 0 || ovrNow(q) > ovrNow(c.bench[b])) ? k : b), -1);
		if (j < 0) { return; }
		c.squad[i] = c.bench[j]; c.bench[j] = pl;
	}

	// After each league match (from weeklyClub): count games on the bench, spot a star left out or
	// a man played out of position, a hammering, and the mood of the dressing room. rnd is for tests.
	function dramaAfterMatch (played, gf, ga, rnd = Math.random) {
		if (!league || !league.club) { return []; }
		const d = ensureDrama(league), c = league.club, made = [], fmt = league.fmt, slots = slotsFor(fmt);
		const all = [ ...c.squad, ...c.bench ];
		for (const pl of all) {
			const on = played.has(pl.name), role = roleOf(pl, c), t = temperOf(pl);
			pl.benched = on ? 0 : (pl.benched || 0) + 1;
			if (pl.promised > 0) { pl.promised--; if (!on && pl.promised === 0 && pl.benched >= 2) { pl.morale = clamp(pl.morale - 12, 5, 100); pl.wantsOut = true; const x = addIssue("request", pl, `${pl.name} says you promised him games and didn't keep your word. He wants to leave.`); if (x) { made.push(x); } } }
			// Repeated benching: a transfer request. Not the young ones, and not a keeper who is the backup.
			if (!pl.wantsOut && pl.benched >= 4 && pl.age > 20 && pl.pos !== "gk" && ovrNow(pl) >= squadMedian(c) - 4) {
				pl.wantsOut = true; pl.morale = clamp(pl.morale - 6, 5, 100);
				const x = addIssue("request", pl, `${pl.name} has handed in a transfer request. He hasn't played in ${pl.benched} games and says he needs to be playing.`);
				if (x) { made.push(x); }
				continue;
			}
			// A star left out: he says so in public, more likely if he has a temper.
			if (!on && role === "key" && pl.benched === 1 && !pl.injured && rnd() < 0.3 + t / 200) {
				const x = addIssue("dropped", pl, `${pl.name} isn't happy about being left out. He's told reporters he should be playing every week.`);
				if (x) { pl.morale = clamp(pl.morale - 5, 5, 100); made.push(x); }
			}
		}
		// Played out of position: the first time he grumbles, after that (or straight away if he's a hot-head) he refuses.
		slots.forEach(i => {
			const pl = c.squad[i], slotPos = roleOfSlot(fmt, i);
			if (!pl || !played.has(pl.name) || !slotPos || slotPos === pl.pos || pl.pos === "gk" || slotPos === "gk") { return; }
			pl.oopN = (pl.oopN || 0) + 1;
			const refuse = pl.oopN >= 3 || (pl.oopN >= 2 && temperOf(pl) >= 55) || pl.posPromise;
			if (pl.posPromise) { pl.morale = clamp(pl.morale - 10, 5, 100); d.room = clamp(d.room - 3, 0, 100); pl.posPromise = false; }
			if (refuse) { pl.refusesPos = slotPos; }
			if (refuse || rnd() < 0.35) {
				const x = addIssue("oop", pl, refuse
					? `${pl.name} has told you he won't play ${POS_WHERE[slotPos] || "out of position"} again. He's a ${POS_WHO[pl.pos]} and wants to play there. Pick him in his own position, or he'll sulk.`
					: `${pl.name} is grumbling about playing ${POS_WHERE[slotPos] || "out of position"}. He's a ${POS_WHO[pl.pos]}.`);
				if (x) { pl.morale = clamp(pl.morale - (refuse ? 6 : 3), 5, 100); made.push(x); }
			}
		});
		// A hammering: someone has a go in the dressing room after the game.
		if (ga - gf >= 3) {
			const loud = slots.map(i => c.squad[i]).filter(p => p && played.has(p.name)).sort((a, b) => temperOf(b) - temperOf(a))[0];
			if (loud) {
				d.room = clamp(d.room - 6, 0, 100);
				const x = addIssue("row", loud, `After the ${gf}-${ga}, ${loud.name} had a go at his teammates and at your tactics. The dressing room heard every word.`);
				if (x) { made.push(x); }
			}
		} else if (gf > ga) { d.room = clamp(d.room + 2, 0, 100); }
		// The mood of the dressing room rubs off on everyone a little.
		for (const pl of all) { pl.morale = clamp(Math.round(pl.morale + (d.room - 60) * 0.03), 5, 100); }
		return made;
	}

	// ---------- refusals ----------
	// A new contract: he has asked to leave, or (a key man who is unsettled) he wants a bigger rise
	// than the club's offer. Returns null when he'll sign, otherwise the reason and what to do next.
	function renewRefusal (pl, c, terms) {
		if (!league) { return null; }
		if (pl.wantsOut) {
			const why = `${pl.name} has asked to leave and won't sign a new deal. Play him and talk to him to win him back, or sell him while he still has a contract.`;
			addIssue("contract", pl, why, { wantsOut: true });
			return { why };
		}
		const rise = terms ? terms.rise : roleOf(pl, c) === "key" ? 1.2 : 1.1;
		if (roleOf(pl, c) === "key" && pl.morale < 60 && pl.age <= 31 && pl.askPaid !== league.season && rise < 1.35) {
			const ask = Math.round(wageOf(pl) * 1.35 * 1000) / 1000, fee = round1(valueOf(pl) * 0.15);
			const why = `${pl.name} wants more money. He's asking for ${wageWeek(ask)}, a 35% rise, and says he'll run his contract down otherwise. Pay it, or let him go.`;
			addIssue("contract", pl, why, { ask, rise: 1.35, fee });
			return { why };
		}
		return null;
	}
	// A signing from the market: a star won't drop down to a struggling club, and some older players
	// won't move a long way from home or to the cold, unless the money is right (a quarter over his price).
	function signRefusal (pl, c, price) {
		if (!league) { return null; }
		const ask = typeof askOf === "function" ? askOf(pl) : price, enough = price >= round1(ask * 1.25) - 1e-9;
		if (enough) { return null; }
		const rows = standings(), pos = rows.findIndex(r => r.id === 0) + 1, best = Math.max(...slotsFor(league.fmt).map(i => ovrOf(c.squad[i])));
		const offer = round1(ask * 1.25);
		if (league.round >= 4 && pos > rows.length / 2 && ovrOf(pl) >= best + 6) {
			return { offer, why: `${pl.name} won't join a side in the bottom half. He sees it as a step down. Offer ${money(offer)} to change his mind, or try again when you're higher up the table.` };
		}
		const far = pl.region && pl.region !== "home" && pl.region !== "europe", h = hashStr(pl.name + "|home");
		if (far && pl.age >= 27 && h % 3 === 0) {
			const cold = pl.region === "samerica" || pl.region === "africa";
			return { offer, why: `${pl.name} doesn't want to move ${cold ? "to the cold" : "so far from home"} with his family settled where they are. Offer ${money(offer)} and he might think again.` };
		}
		return null;
	}
	// Selling one of yours to a smaller club: a first-team man refuses the step down, unless he wants out.
	function sellRefusal (pl, club) {
		if (!league || !Number.isInteger(club) || pl.wantsOut || pl.listed) { return null; }
		const role = roleOf(pl, league.club);
		if ((role === "key" || role === "first") && getStr(club) < yourStr() - 0.4) {
			return { why: `${pl.name} won't go to ${TEAMS[club].name}. He thinks it's a step down. Wait for a bid from a bigger club, or put him up for sale (Back yourself if he complains) and he'll go anywhere.` };
		}
		return null;
	}

	// ---------- the League panel ----------
	function renderDrama () {
		const side = document.querySelector("#league .lg-side");
		if (!side || !league || !league.club) { return; }
		const d = ensureDrama(league);
		let box = $("lgDrama");
		if (!box) { box = el("div", "lg-drama"); box.id = "lgDrama"; side.prepend(box); }
		box.replaceChildren();
		box.append(el("h4", "", "Dressing room"), el("p", "detail", `Mood: ${roomWord(d.room)} (${d.room})`));
		const ul = el("ul", "drama-issues");
		ul.style.cssText = "list-style:none;padding:0;margin:8px 0";
		for (const issue of d.issues) {
			const li = el("li", `drama-${issue.kind}`);
			li.append(el("span", "", issue.text));
			const row = el("div", "drama-choices");
			row.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 12px";
			for (const [ k, label ] of choicesFor(issue)) {
				const b = el("button", "", label);
				b.type = "button"; b.dataset.choice = k; b.style.padding = "4px 9px";
				b.addEventListener("click", () => resolveIssue(issue.id, k));
				row.append(b);
			}
			li.append(row); ul.append(li);
		}
		if (d.issues.length) { box.append(ul); }
		else { box.append(el("p", "fine", "No problems in the squad right now.")); }
		if (d.log.length) { const lg = el("ul", "drama-log"); for (const s of d.log.slice(-3).reverse()) { lg.append(el("li", "", s)); } box.append(lg); }
	}

	// ---------- the half-time row ----------
	// Behind at the break, or a star taken off before it: now and then a man with a temper boils
	// over in the dressing room. The half-time card shows it with the same four choices, and the
	// choice changes his morale and how he plays the second half (and the rest of the side's, when
	// you back yourself). Rare: tied to the score and his temper, and only in your league matches.
	let htRow = null;
	function halfTimeRow (o = {}) {
		const old = $("htRow");
		if (old) { old.remove(); }
		htRow = null;
		if (!league || !league.club || (!leagueMatch && !o.force) || tut) { return null; }
		const rnd = o.rnd || Math.random, behind = score[1] - score[0], c = league.club;
		const clubOf = name => [ ...c.squad, ...c.bench ].find(q => q.name === name);
		const onPitch = team(0).filter(p => p.role !== "gk" && clubOf(p.name));
		const star = wentOff.map(clubOf).find(pl => pl && roleOf(pl, c) === "key");
		let who = null, text = "";
		if (star && rnd() < 0.5 * temperOf(star) / 70) {
			who = { pl: star, p: null };
			text = `${star.name} kicked a water bottle across the dressing room. He's furious you took him off and wants to know why.`;
		} else if (behind >= 1) {
			const loud = onPitch.slice().sort((a, b) => temperOf(clubOf(b.name)) - temperOf(clubOf(a.name)))[0];
			const pl = loud && clubOf(loud.name);
			if (pl && rnd() < (behind >= 2 ? 0.45 : 0.15) * temperOf(pl) / 70) {
				who = { pl, p: loud };
				text = `${pl.name} has lost it in the dressing room at ${score[0]}-${score[1]} down. He's having a go at his teammates and at your tactics.`;
			}
		}
		if (!who) { return null; }
		htRow = { name: who.pl.name, p: who.p, text, done: false };
		const box = el("div", "ht-row"); box.id = "htRow";
		box.style.cssText = "margin:10px 0 6px;padding:8px 12px;font-size:0.92em;border-left:3px solid #e0533c;background:rgba(224,83,60,0.08);text-align:left";
		const row = el("div", "drama-choices"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px";
		box.append(el("p", "", text));
		for (const [ k, label ] of MANAGER_CHOICES) {
			const b = el("button", "", label); b.type = "button"; b.dataset.choice = k; b.style.padding = "4px 9px";
			b.addEventListener("click", () => resolveHalfTime(k));
			row.append(b);
		}
		box.append(row);
		const body = $("ovBody");   // under the card's text, above the quick settings, so the card never clips it
		if (body) { body.after(box); }
		const go = $("ovButton");
		if (go) { go.addEventListener("click", () => { const b = $("htRow"); if (b) { b.remove(); } }, { once: true }); }   // gone with the second half
		return htRow;
	}
	// Morale, dressing room, and his second half (added to each of his ratings for the rest of the match).
	const HT_EFFECTS = { talk: [ 5, 1, 2 ], back: [ -5, 2, -1 ], fine: [ -10, 3, -2 ], drop: [ -12, 0, 0 ] };
	function resolveHalfTime (choice) {
		if (!htRow || htRow.done || !HT_EFFECTS[choice]) { return null; }
		const d = ensureDrama(league), c = league.club, pl = [ ...c.squad, ...c.bench ].find(q => q.name === htRow.name), e = HT_EFFECTS[choice];
		if (!pl) { return null; }
		htRow.done = true;
		const t = temperOf(pl), p = htRow.p && players.includes(htRow.p) && htRow.p.name === pl.name ? htRow.p : null;
		let dm = e[0], df = e[2];
		if (choice === "talk" && t < 40) { dm += 3; }
		if (choice === "fine" && t >= 75) { dm -= 4; df -= 1; }
		pl.morale = clamp(Math.round(pl.morale + dm), 5, 100);
		d.room = clamp(Math.round(d.room + e[1]), 0, 100);
		const lift = (q, n) => { if (q && q.attr && n) { for (const k of [ "pac", "sho", "pas", "def" ]) { if (Number.isFinite(q.attr[k])) { q.attr[k] = clamp(q.attr[k] + n, 20, 99); } } } };
		lift(p, df);
		if (choice === "back") { for (const q of team(0)) { if (q !== p) { lift(q, 1); } } }
		if (choice === "fine") { c.budget = Math.round((c.budget + Math.max(0.001, wageOf(pl) / 52)) * 1000) / 1000; }
		let off = "";
		if (choice === "drop") {
			const pool = typeof subPool === "function" ? subPool() : [];
			const sub = p && subsLeft > 0 ? pool.filter(q => q.pos === pl.pos).sort((a, b) => ovrNow(b) - ovrNow(a))[0] || pool[0] : null;
			if (sub) { makeSub(p, sub, true); off = ` ${sub.name} goes on in his place.`; } else { dropToBench(pl); off = " He's out of the side for the next game."; }
		}
		const note = {
			talk: `You calmed ${pl.name} down. He goes out for the second half fired up (morale ${pl.morale}).`,
			back: `You told ${pl.name} to sort himself out. He's sulking (morale ${pl.morale}), but the rest of the lads respond.`,
			fine: `${pl.name} is fined a week's wages. He's not happy (morale ${pl.morale}) and it may show.`,
			drop: `${pl.name} is hooked at half-time (morale ${pl.morale}).${off}`
		}[choice];
		dramaLog(note);
		const box = $("htRow");
		if (box) { box.querySelectorAll("button").forEach(b => { b.disabled = true; }); box.append(el("p", "fine", note)); }
		if (typeof saveLeague === "function") { saveLeague(); }
		return { note, morale: pl.morale, room: d.room, attr: p ? { ...p.attr } : null, onPitch: !!(p && players.includes(p) && p.name === pl.name) };
	}
