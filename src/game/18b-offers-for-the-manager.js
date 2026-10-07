	/* ---------- offers for the manager ----------
	   You are the manager, not the club. When a season ends, clubs who liked your work come calling:
	   finish high and the bigger clubs in the division want you; finish mid-table, a club at your
	   level; finish low and only the division below will have you. Take a job and you inherit that
	   club's squad, ground and colours with a budget to match its size, and your old club carries on
	   under its own name without you. Offers lapse when the next season kicks off. */
	function offerJobs (pos) {
		const lg = league;
		if (!lg || !lg.club || !Array.isArray(lg.members)) { return []; }
		if (!Number.isInteger(pos)) { pos = standings().findIndex(r => r.id === 0) + 1; }
		const me = yourStr(), n = lg.members.length;
		const inDiv = lg.members.filter(id => id !== 0), below = TEAMS.map((t, i) => i).filter(i => i !== 0 && !lg.members.includes(i));
		let pool;
		if (pos <= 4) { pool = inDiv.filter(id => getStr(id) >= Math.max(3, Math.ceil(me - 0.5))); }
		else if (pos <= Math.floor(n / 2)) { pool = inDiv.filter(id => Math.abs(getStr(id) - me) <= 1); }
		else if (pos <= n - 3) { pool = [ ...inDiv.filter(id => getStr(id) <= me), ...below.slice(0, 3) ]; }
		else { pool = below; }
		lg.jobOffers = shuffle(pool).slice(0, pos <= 4 ? 2 : 1).map(id => ({ id, str: getStr(id), budget: round1(1 + getStr(id) * 0.9), below: !lg.members.includes(id), season: lg.season }));
		lg.career = { ...(lg.career || { clubs: [ YOU.name ] }), history: [ ...((lg.career && lg.career.history) || []), { season: lg.season, club: YOU.name, pos } ] };
		return lg.jobOffers;
	}
	function declineJob (id) {
		if (!league) { return; }
		league.jobOffers = (league.jobOffers || []).filter(o => o.id !== id);
		lastDeal = `You turned ${TEAMS[id].name} down.`;
		afterClubChange();
	}
	function takeJob (id) {
		const lg = league, offer = lg && (lg.jobOffers || []).find(o => o.id === id);
		if (!offer) { return false; }
		const to = TEAMS[id], from = { ...YOU }, oldStr = yourStr();
		// The two clubs trade identities: you wear theirs now; your old side keeps its name and your old squad's strength.
		for (const k of [ "name", "short", "color", "color2", "ground", "surface" ]) { YOU[k] = to[k]; to[k] = from[k]; }
		lg.clubStr[id] = oldStr;
		const c = newClub(), base = cpuOvr(offer.str);
		c.squad = cpuSquad(id, offer.str);
		c.bench = BENCH_POS.map((pos, i) => genPlayer(pos, base - 5 + (i % 3)));
		c.budget = offer.budget; c.autoRotate = lg.club.autoRotate; c.market = genMarket(); c.scoutLeft = 2;
		c.log = [ `You took the ${YOU.name} job, from ${from.name} (budget ${money(offer.budget)})` ];
		if (typeof ensureCoaching === "function") { ensureCoaching(c, lg); }
		lg.club = c;
		if (lg.cpuIn) { delete lg.cpuIn[id]; }
		lg.bidsIn = []; lg.jobOffers = [];
		lg.career = { ...(lg.career || {}), clubs: [ ...((lg.career && lg.career.clubs) || [ from.name ]), YOU.name ] };
		lg.news = `${lg.news || ""} You are the new manager of ${YOU.name}.`.trim();
		lastDeal = `You are the new manager of ${YOU.name}: a squad of ${POS_OF_SLOT.length + c.bench.length}, ${money(offer.budget)} to spend.`;
		autoPick(false, true);
		afterClubChange();
		return true;
	}
	const careerLine = () => {
		const h = league && league.career && league.career.history;
		if (!h || !h.length) { return ""; }
		const best = h.reduce((b, x) => (x.pos < b.pos ? x : b));
		return `Career: ${h.length} season${h.length === 1 ? "" : "s"}, best finish ${best.pos}${[ "st", "nd", "rd" ][best.pos - 1] || "th"} with ${best.club}, clubs: ${(league.career.clubs || [ YOU.name ]).join(", ")}.`;
	};
	function renderOffers () {
		const ul = $("jobOffers"), title = $("jobsTitle");
		if (!ul || !title) { return; }
		ul.replaceChildren();
		const offers = league ? (league.jobOffers || []) : [];
		title.hidden = !offers.length;
		for (const o of offers) {
			const t = TEAMS[o.id], li = el("li");
			li.append(el("span", "pos", "JOB"), el("span", "who", `${t.name} want you as manager: ${o.below ? "the division below" : "this division"}, strength ${"★".repeat(Math.round(o.str))}, ${money(o.budget)} to spend`));
			const btns = el("span", "bids");
			const a = el("button", "", "Take the job"); a.type = "button"; a.addEventListener("click", () => takeJob(o.id));
			const r = el("button", "", "Decline"); r.type = "button"; r.addEventListener("click", () => declineJob(o.id));
			btns.append(a, r); li.append(btns);
			li.append(el("span", "ratings", `You would leave ${YOU.name} and inherit their squad, ground and colours.`));
			ul.append(li);
		}
		const cl = $("careerLine");
		if (cl) { cl.textContent = careerLine(); }
	}
