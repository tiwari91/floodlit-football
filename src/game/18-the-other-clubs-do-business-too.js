	/* ---------- the other clubs do business too ----------
	   When a window opens the computer's clubs buy from home and abroad (some of them players on your
	   own list), the buyers get a little stronger, and a few of them bid for your players. Their
	   signings show up in their squads in the Clubs panel and play against you. Offers for your
	   players lapse when the window shuts. */
	function windowEvents (when) {
		if (!league || !league.club) { return; }
		const lg = league, c = lg.club, news = [];
		if (!lg.cpuIn || typeof lg.cpuIn !== "object") { lg.cpuIn = {}; }
		const others = lg.members.filter(id => id !== 0);
		for (const id of others) { lg.clubStr[id] = clamp(lg.clubStr[id] - 0.04, 1, 5); }   // squads age; the deals below put it back
		const deals = 4 + Math.floor(Math.random() * 4);
		for (let k = 0; k < deals; k++) {
			const buyer = others[Math.floor(Math.random() * others.length)], str = getStr(buyer);
			const slot = 1 + Math.floor(Math.random() * (POS_OF_SLOT.length - 1)), pos = POS_OF_SLOT[slot];
			// Sometimes they take one off your own shortlist.
			const mine = c.market.findIndex(pl => pl.pos === pos && ovrOf(pl) >= cpuOvr(str) - 4);
			let pl, from, fee;
			if (mine >= 0 && Math.random() < 0.5) { pl = c.market.splice(mine, 1)[0]; from = pl.from || "abroad"; fee = askOf(pl); }
			else {
				const regions = Object.keys(MARKETS), region = regions[Math.floor(Math.random() * regions.length)], m = MARKETS[region];
				const nats = natsOf(region), nat = nats[Math.floor(Math.random() * nats.length)];
				from = m.clubs[Math.floor(Math.random() * m.clubs.length)];
				const lg = region === "home" ? leagueNat() : MARKET_CLUB_NAT[from] || nat;   // schooled where he played (05a)
				pl = genPlayer(pos, clamp(cpuOvr(str) + Math.floor(Math.random() * 7) - 1, 50, 92), null, Math.random, { lg, nat });
				pl.age = styleAge(19 + Math.floor(Math.random() * 13), lg); fee = round1(valueOf(pl) * m.mult);
			}
			const keep = { name: pl.name, pos: pl.pos, pac: pl.pac, sho: pl.sho, pas: pl.pas, def: pl.def, age: pl.age, nat: pl.nat };
			for (const k of [ "dri", "phy" ]) { if (Number.isFinite(pl[k])) { keep[k] = pl[k]; } }
			if (typeof carryEdits === "function") { carryEdits(pl, keep); }   // an edited player keeps his edits (18g)
			lg.cpuIn[buyer] = [ ...(lg.cpuIn[buyer] || []).filter(d => d.slot !== slot), { slot, pl: keep } ].slice(-4);
			lg.clubStr[buyer] = clamp(lg.clubStr[buyer] + 0.12, 1, 5);
			news.push(`${TEAMS[buyer].short || TEAMS[buyer].name} sign ${pl.name} (${pl.nat}, ${ovrOf(pl)}) from ${from} for ${money(fee)}`);
		}
		// Bids for your players: the clubs above you in the market for your best and most valuable.
		const yours = [ ...c.squad, ...c.bench ].filter(p => p.pos !== "gk" || ovrOf(p) > 70).sort((a, b) => valueOf(b) - valueOf(a));
		const nb = Math.min(yours.length, 1 + Math.floor(Math.random() * 3));
		lg.bidsIn = [];
		// A listed player (or one who won't renew) always draws an offer, a little under his value.
		for (const pl of [ ...c.squad, ...c.bench ].filter(p => p.listed || p.leaving)) {
			lg.bidsIn.push({ name: pl.name, club: others[Math.floor(Math.random() * others.length)], fee: round1(Math.max(0.2, valueOf(pl) * (0.8 + Math.random() * 0.3))) });
		}
		for (let k = 0; k < nb; k++) {
			const pl = yours[Math.floor(Math.random() * Math.min(6, yours.length))];
			if (!pl || lg.bidsIn.some(b => b.name === pl.name)) { continue; }
			const club = others[Math.floor(Math.random() * others.length)];
			lg.bidsIn.push({ name: pl.name, club, fee: round1(Math.max(0.3, valueOf(pl) * (0.85 + Math.random() * 0.45))) });
		}
		lg.transferNews = [ ...news.map(n => `${when}: ${n}`), ...(lg.transferNews || []) ].slice(0, 10);
	}
	// Sell one of yours: to a bidder, or to whoever the market finds (a little under his value).
	function sellPlayer (name, fee, club) {
		const c = league.club, inSq = c.squad.findIndex(p => p.name === name), inB = c.bench.findIndex(p => p.name === name);
		if ((inSq < 0 && inB < 0) || !windowOpen()) { return; }
		const pl = inSq >= 0 ? c.squad[inSq] : c.bench[inB];
		if (inSq >= 0 && pl.pos === "gk" && ![ ...c.squad, ...c.bench ].some(q => q !== pl && q.pos === "gk")) { lastDeal = `Sign another keeper before you sell ${pl.name}.`; afterClubChange(); return; }
		const no = typeof sellRefusal === "function" ? sellRefusal(pl, club) : null;
		if (no) { lastDeal = no.why; afterClubChange(); return; }
		if (inSq >= 0) { c.squad.splice(inSq, 1); } else { c.bench.splice(inB, 1); }
		c.budget = round1(c.budget + fee);
		league.bidsIn = (league.bidsIn || []).filter(b => b.name !== name);
		if (Number.isInteger(club)) { const slot = POS_OF_SLOT.indexOf(pl.pos) > 0 ? POS_OF_SLOT.indexOf(pl.pos) + Math.floor(Math.random() * 2) : 1; league.cpuIn = league.cpuIn || {}; league.cpuIn[club] = [ ...(league.cpuIn[club] || []), { slot: clamp(slot, 1, 10), pl: (typeof carryEdits === "function" ? carryEdits : (_, k) => k)(pl, { name: pl.name, pos: pl.pos, pac: pl.pac, sho: pl.sho, pas: pl.pas, def: pl.def, age: pl.age, nat: pl.nat }) } ].slice(-4); league.clubStr[club] = clamp(league.clubStr[club] + 0.1, 1, 5); }
		refillSquad(c);
		openPl = null;
		lastDeal = `${pl.name} sold${Number.isInteger(club) ? ` to ${TEAMS[club].name}` : ""} for ${money(fee)}.`;
		c.log = [ ...(c.log || []), lastDeal ].slice(-10);
		afterClubChange();
	}
	function rejectBid (name) {
		const lg = league, b = (lg.bidsIn || []).find(x => x.name === name);
		if (!b) { return; }
		lg.bidsIn = lg.bidsIn.filter(x => x !== b);
		const pl = [ ...lg.club.squad, ...lg.club.bench ].find(p => p.name === name);
		// A move to a bigger club turned down: he takes it badly.
		if (pl && pl.wantsOut) { pl.morale = clamp(pl.morale - 15, 5, 100); lastDeal = `You turned down ${TEAMS[b.club].name} for ${name}, and he'd asked to leave. He's furious (morale ${pl.morale}).`; }
		else if (pl && getStr(b.club) > yourStr()) { pl.morale = clamp(pl.morale - 8, 5, 100); lastDeal = `You turned down ${TEAMS[b.club].name} for ${name}; he wanted the move (morale ${pl.morale}).`; }
		else { lastDeal = `You turned down ${TEAMS[b.club].name}'s bid for ${name}.`; }
		afterClubChange();
	}
	function sellButton (pl) {
		if (!windowOpen()) { return null; }
		const lg = league, others = lg.members.filter(id => id !== 0), club = others[hashStr(pl.name + lg.round + lg.season) % others.length];
		const fee = round1(Math.max(0.1, valueOf(pl) * 0.85));
		const b = el("button", "", `Sell to ${TEAMS[club].short || TEAMS[club].name} (${money(fee)})`);
		b.type = "button";
		b.addEventListener("click", () => sellPlayer(pl.name, fee, club));
		return b;
	}
	function renderBids () {
		const ul = $("bidsIn"), lg = league, open = windowOpen();
		ul.replaceChildren();
		const bids = open ? (lg.bidsIn || []).filter(b => [ ...lg.club.squad, ...lg.club.bench ].some(p => p.name === b.name)) : [];
		$("bidsTitle").hidden = !bids.length;
		for (const b of bids) {
			const li = el("li"), pl = [ ...lg.club.squad, ...lg.club.bench ].find(p => p.name === b.name);
			li.append(el("span", "pos", POS_LABEL[pl.pos]), el("span", "who", `${TEAMS[b.club].name} bid ${money(b.fee)} for ${b.name}`));
			const btns = el("span", "bids");
			const a = el("button", "", "Accept"); a.type = "button"; a.addEventListener("click", () => sellPlayer(b.name, b.fee, b.club));
			const r = el("button", "", "Reject"); r.type = "button"; r.addEventListener("click", () => rejectBid(b.name));
			btns.append(a, r); li.append(btns);
			li.append(el("span", "ratings", `OVR ${ovrOf(pl)} · ${pl.age} · valued at ${money(valueOf(pl))}`));
			ul.append(li);
		}
		const tn = $("trNews");
		tn.textContent = (lg.transferNews || []).length ? `Around the league: ${lg.transferNews.slice(0, 5).join("; ")}.` : "";
		if (typeof renderOffers === "function") { renderOffers(); }
	}
	let oppSquad = [];

	function applySquad () {
		const club = league && league.club;
		const slots = slotsFor(fmtKey);
		players.forEach(p => {
			if (p.team === 0 && club) { p.num = FORMATS["11"].nums[slots[p.idx]]; }
			p.look = null;
			p.cam = !!(FMT.shape && FMT.shape.cam === slots[p.idx]);
			const cpu = p.team === 1 ? oppSquad[slots[p.idx]] : !club && youSquad ? youSquad[slots[p.idx]] : null;
			p.sqi = slots[p.idx];
			p.attr = p.team === 0 && club ? effective(club.squad[slots[p.idx]], FMT.roles[p.idx])
				: cpu ? ratingsOf(cpu) : null;
			p.name = p.team === 0 && club ? club.squad[slots[p.idx]].name : cpu && p.team === 1 ? cpu.name : "";   // (your friendly side stays nameless)
			const pl = p.team === 0 && club ? club.squad[slots[p.idx]] : cpu;
			ensureTraitP(p, pl || (p.team === 0 && !club ? { name: `you${p.idx}`, pos: FMT.roles[p.idx] } : null));
			p.sta = p.team === 0 && club ? clamp(fitOf(pl) / 100, 0.45, 1) : 0.96 + Math.random() * 0.04;
			p.endure = pl ? endureOf(pl) : 1; p.nudged = false;
			if (typeof editMatchPlayer === "function") { editMatchPlayer(p, pl); }   // his own number, foot and look (18g)
		});
	}
	const A = (p, k) => (p && p.attr && Number.isFinite(p.attr[k]) ? p.attr[k] : 65);
	const tr = (p, k) => !!p && p.trait === k;
	function ensureTraitP (p, pl) { p.trait = pl ? traitOf(pl) : ""; }
	// Young legs last longer; a good fitness coach helps yours a little more.
	const endureOf = pl => { const a = Number.isFinite(pl.age) ? pl.age : 26; const fc = league && league.club && [ ...league.club.squad, ...league.club.bench ].includes(pl) ? staffLvl(league.club, "fitness") * 0.025 : 0; return (a <= 23 ? 0.9 : a <= 29 ? 1 : a <= 32 ? 1.1 : 1.2) - fc; };
	const paceMul = p => 1 + (A(p, "pac") - 65) * 0.008;
	// Dribbling and physical at work, as -1 to 1 about a typical player (so a side of typical players plays
	// as it always has): close control, beating a man and carrying it; shielding, duels, headers, stamina.
	const DRI_C = 70, PHY_C = 76;
	const driD = p => (p && p.attr && Number.isFinite(p.attr.dri) ? clamp((p.attr.dri - DRI_C) / 30, -1.2, 1.2) : 0);
	const phyD = p => (p && p.attr && Number.isFinite(p.attr.phy) ? clamp((p.attr.phy - PHY_C) / 30, -1.2, 1.2) : 0);
	// How hard he is to dispossess: a good dribbler slips the challenge, the stronger man holds it.
	const holdMul = (o, q) => clamp(1 - 0.4 * driD(o) - 0.3 * (phyD(o) - phyD(q)), 0.45, 1.7);
	const defMul = p => 1 + (A(p, "def") - 65) * 0.012;
	// The man you are steering (not the autopilot): only he gets the helping hand with passes and a settling touch.
	const steered = p => !!p && p.team === 0 && !autoPilot && players.indexOf(p) === ctrl;
	// Ratings at work, the same for both sides (a normal club's keeper is about 79, its outfielders about 71 at passing, 66 at shooting):
	// a keeper's handling from his rating,
	// a duel: his handling against the shooter's finishing (a normal club's keeper is about 4 up on its forwards),
	const KEEP_SAVE = 0.84, FIN_K = 0.06, HEAD_K = 0.03, GK_K = 0.006, FIN_0 = 0.6, FIN_MIN = 0.35, FIN_KLO = 0.11;
	const keeperSave = (p, by) => clamp(KEEP_SAVE + (A(p, "def") - (by ? A(by, "sho") : 75) - 4) * 0.02, 0.55, 0.88);
	// a finisher against the keeper he faces: how far his shots and headers stray grows as his finishing falls
	// below the keeper's handling (a normal club's forwards are level with its keeper; ten up or down is a mismatch),
	const finGap = p => A(p, "sho") - A(team(1 - p.team).find(q => q.role === "gk"), "def");
	const finQ = p => { const g = finGap(p); return clamp(FIN_0 - g * (g < 0 ? FIN_KLO : FIN_K), FIN_MIN, 3); };   // (outclassed finishers fall away faster)
	// a carrier's close control (passing and pace) against a challenge,
	const shieldMul = o => clamp(1 - ((A(o, "pas") + A(o, "pac")) / 2 - 71) * 0.04, 0.5, 1.6);
	// how far a computer-run pass strays (everyone takes the same beat to make up his mind: a quicker one for good passers only rushed them).
	const thinkOf = () => 8;
	const aiPassErr = p => Math.max(0, 90 - A(p, "pas")) * 1.4;
	// and how crisply he strikes a pass (a zipped pass is harder to cut out).
	const passZip = p => clamp(1 + (A(p, "pas") - 71) * 0.01, 0.85, 1.18);
	// Poor passers drift a little off target, and everyone does in the rain.
	const passErr = p => (Math.max(0, 70 - A(p, "pas")) * 0.6 + cond.wet * 5) * (style[p.team] === "possession" ? 0.6 : 1) * (1 - 0.25 * edge(p.team)) + 22 * edge(1 - p.team) + 26 * Math.max(0, 0.75 - staOf(p)) - (tr(p, "playmaker") ? 9 : 0) + 14 * wobble(p.team);

	// A keeper with the ball in hands inside their own area.
	const KEEPER_CLEAR = 70;
	function inHands (o) {
		return !!o && o.role === "gk" && rel(o.team, o.x) < FMT.box + 60 && Math.abs(o.y - FH / 2) < FMT.goal / 2 + FMT.box;
	}

	// Opponents stand off a keeper holding the ball, so nobody can crowd or rob them.
	function keepClear () {
		const k = ball.owner;
		if (!inHands(k)) { return; }
		for (const q of players) {
			if (q.team === k.team) { continue; }
			const dx = q.x - k.x, dy = q.y - k.y, d = Math.hypot(dx, dy) || 1;
			if (d < KEEPER_CLEAR) {
				// Ease them out (a third of the way each frame) instead of snapping them to the ring.
				q.x = clamp(q.x + (k.x + dx / d * KEEPER_CLEAR - q.x) * 0.35, 12, FW - 12);
				q.y = clamp(q.y + (k.y + dy / d * KEEPER_CLEAR - q.y) * 0.35, 12, FH - 12);
				// Near the goal line the edge clamp can pull them back inside: step out on the pitch side instead.
				if (Math.hypot(q.x - k.x, q.y - k.y) < d + 0.5 && d < KEEPER_CLEAR - 1) {
					q.x = clamp(q.x + (k.team === 0 ? 1 : -1) * 4, 12, FW - 12);
				}
				q.lunge = 0;
				q.slideAI = 0;
			}
		}
	}

	function kickoff (kickTeam) {
		for (const p of players) {
			let x = p.bx;
			if (p.role === "fwd") { x = p.team === 0 ? Math.min(x, FW / 2 - 70) : Math.max(x, FW / 2 + 70); }
			p.x = x; p.y = p.by; p.vx = p.vy = 0;
			p.dir = p.team === 0 ? 0 : Math.PI;
			p.kickCd = 0; p.lunge = 0; p.lungeCd = 0; p.hold = 0;
			p.celebA = 0; p.kneel = 0; p.sulk = 0; p.celebK = 0; p.hug = 0; p.kickA = 0; p.plant = 0; p.fall = 0; p.dive = 0; p.diveCd = 0; p.throwA = 0;
			p.run = null; p.tFrom = null; p.tKind = undefined; p.tx = undefined;
		}
		const side = outfield(kickTeam);   // (a side can be a man down after a red card)
		const taker = side.find(p => p.idx === KICKER) || side.find(p => p.role === "fwd") || side[side.length - 1];
		taker.x = FW / 2 + (kickTeam === 0 ? -16 : 16);
		taker.y = FH / 2;
		ball = { x: FW / 2, y: FH / 2, z: 0, vx: 0, vy: 0, vz: 0, landX: 0, landY: 0, owner: taker, spin: 0 };
		possTeam = kickTeam;
		celeb = null;
		if (kickTeam === 0) { ctrl = players.indexOf(taker); }
		charging = false;
		manualLock = 0;
		receiver = null;
		pendingPass = false;
		fx = [];
		freeze = KICKOFF_FREEZE;
		freezeKind = "kickoff";
		setPiece = null; deadBall = null; restartWalk = null; review = null; stretcher = null;
		if (surge && freezeKind === "kickoff" && lastScorer === surge.team && state !== "goal") { toast(surge.team === 0 ? `You're on the front foot · ${opp.short} wobbling` : `${opp.short} on the front foot · you're wobbling`, surge.team === 0 ? "#7fd49b" : "#de4f5a"); }
		lastTouch = -1;
		for (const p of players) { p.tx = undefined; }
		snapshotPrev();
		snapCamera();
	}

