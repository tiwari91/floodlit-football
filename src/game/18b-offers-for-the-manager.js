	/* ---------- offers for the manager ----------
	   You are the manager, not the club. When a season ends, clubs who liked your work come calling:
	   finish high and the bigger clubs in the division want you; finish mid-table, a club at your
	   level; finish low and only the division below will have you. Take a job and you inherit that
	   club's squad, ground and colours with a budget to match its size, and your old club carries on
	   under its own name without you. Offers lapse when the next season kicks off. */
	// Club identities (yours and any club you swapped with) travel with the league save, so a job move
	// survives a reload and the next season; everything else about a club is rebuilt from its id.
	const IDENT_KEYS = [ "name", "short", "color", "color2", "ground", "surface" ];
	const identOf = t => Object.fromEntries(IDENT_KEYS.map(k => [ k, t[k] ]));
	const DEFAULT_IDENT = TEAMS.map(identOf);
	function rememberIdentity (lg) {
		if (!lg) { return; }
		const clubs = {};
		TEAMS.forEach((t, i) => { if (i !== 0 && JSON.stringify(identOf(t)) !== JSON.stringify(DEFAULT_IDENT[i])) { clubs[i] = identOf(t); } });
		lg.ident = { you: identOf(YOU), clubs };
	}
	function applyIdentity (lg) {
		TEAMS.forEach((t, i) => Object.assign(t, DEFAULT_IDENT[i]));
		if (!lg || !lg.ident || typeof lg.ident !== "object") { return; }
		if (lg.ident.you) { Object.assign(YOU, lg.ident.you); }
		for (const [ i, id ] of Object.entries(lg.ident.clubs || {})) { if (TEAMS[i] && Number(i) !== 0) { Object.assign(TEAMS[i], id); } }
	}
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
		lg.jobOffers = shuffle(pool).slice(0, pos <= 4 ? 2 : 1).map(id => ({ id, kind: "home", str: getStr(id), budget: round1(1 + getStr(id) * 0.9), below: !lg.members.includes(id), season: lg.season }));
		// A good season draws a club from abroad too.
		if (pos <= Math.max(6, Math.floor(n / 3))) { lg.jobOffers.push(abroadOffer(pos)); }
		// What you agreed with your agent in January comes first.
		if (lg.agreed) { lg.jobOffers.unshift({ ...lg.agreed, agreed: true }); lg.agreed = null; }
		lg.career = { ...(lg.career || { clubs: [ YOU.name ] }), history: [ ...((lg.career && lg.career.history) || []), { season: lg.season, club: YOU.name, pos } ] };
		return lg.jobOffers;
	}
	// A club abroad: its region, country and name from the markets, its stature from how you did.
	function abroadOffer (pos) {
		const regions = Object.keys(MARKETS).filter(r => r !== "home"), region = regions[Math.floor(Math.random() * regions.length)], m = MARKETS[region];
		const nats = natsOf(region), nat = nats[Math.floor(Math.random() * nats.length)];
		const str = clamp(Math.round(pos <= 4 ? 3 + Math.random() * 2 : 2 + Math.random() * 2), 1, 5);
		return { abroad: region, kind: "abroad", nat, name: m.clubs[Math.floor(Math.random() * m.clubs.length)], str, budget: round1((1 + str * 0.9) * m.mult * 1.3), season: league.season };
	}
	const offerKey = o => (o.abroad ? `abroad:${o.name}` : `club:${o.id}`);
	// Your agent sounds clubs out at the January window: approaches you can agree to now and join when
	// the season ends. One from home, sized to where you stand; a good position draws one from abroad.
	function agentApproaches (when) {
		const lg = league;
		if (!lg || !lg.club || !Array.isArray(lg.members)) { return []; }
		const rows = standings(), pos = rows.length && rows.some(r => r.p > 0) ? rows.findIndex(r => r.id === 0) + 1 : Math.ceil(lg.members.length / 2);
		const me = yourStr(), n = lg.members.length;
		const inDiv = lg.members.filter(id => id !== 0), below = TEAMS.map((t, i) => i).filter(i => i !== 0 && !lg.members.includes(i));
		const pool = pos <= 4 ? inDiv.filter(id => getStr(id) >= 3) : pos <= Math.floor(n / 2) ? inDiv.filter(id => Math.abs(getStr(id) - me) <= 1) : [ ...below.slice(0, 3), ...inDiv.filter(id => getStr(id) < me) ];
		const offers = shuffle(pool).slice(0, 1).map(id => ({ id, kind: "home", str: getStr(id), budget: round1(1 + getStr(id) * 0.9), below: !lg.members.includes(id), season: lg.season }));
		if (pos <= Math.max(6, Math.floor(n / 3)) || Math.random() < 0.3) { offers.push(abroadOffer(pos)); }
		lg.agent = { when, pos, offers };
		return offers;
	}
	function agreeApproach (key) {
		const lg = league, o = lg && lg.agent && (lg.agent.offers || []).find(x => offerKey(x) === key);
		if (!o) { return false; }
		lg.agreed = o;
		lg.agent.offers = [];
		lastDeal = `Agreed: you join ${o.name || TEAMS[o.id].name} when the season ends.`;
		afterClubChange();
		return true;
	}
	function declineApproach (key) {
		const lg = league;
		if (!lg || !lg.agent) { return; }
		lg.agent.offers = (lg.agent.offers || []).filter(x => offerKey(x) !== key);
		afterClubChange();
	}
	// A move abroad: a new identity in a new country, a fresh squad from that region, a new league,
	// your career carried over.
	function moveAbroad (offer) {
		const lg = league, m = MARKETS[offer.abroad], from = YOU.name, fmt = lg.fmt, country = NATIONS[offer.nat] ? NATIONS[offer.nat][0] : m.label;
		const career = { ...(lg.career || { history: [] }), clubs: [ ...((lg.career && lg.career.clubs) || [ from ]), `${offer.name} (${country})` ] };
		const palette = [ [ "#c8102e", "#ffffff" ], [ "#1d4fa0", "#ffffff" ], [ "#f2b52e", "#1f2a36" ], [ "#155e3a", "#ffffff" ], [ "#8fc3e6", "#1f2a36" ], [ "#5b2a86", "#ffffff" ], [ "#e0662f", "#1f2a36" ] ];
		const [ color, color2 ] = palette[hashStr(offer.name) % palette.length];
		Object.assign(YOU, { name: offer.name, short: offer.name.split(" ")[0], color, color2, ground: `${offer.name} Stadium`, surface: offer.abroad === "europe" ? "grass" : "turf" });
		const nats = natsOf(offer.abroad), base = cpuOvr(offer.str), c = newClub();
		const pick = (pos, i) => { const pl = genPlayer(pos, base + ((i * 7) % 5) - 2); pl.nat = nats[(i * 3 + 1) % nats.length]; pl.contract = 2 + (i % 2); return pl; };
		c.squad = POS_OF_SLOT.map((pos, i) => pick(pos, i)); c.bench = BENCH_POS.map((pos, i) => pick(pos, i + POS_OF_SLOT.length));
		c.budget = offer.budget; c.autoRotate = lg.club.autoRotate; c.scoutLeft = 2;
		c.log = [ `You moved abroad: ${offer.name}, ${country}, from ${from} (budget ${money(offer.budget)})` ];
		league = null;
		newSeason(fmt, c);
		league.career = career;
		rememberIdentity(league);
		league.news = `${league.news || ""} A new country: you are the manager of ${YOU.name} in ${country}.`.trim();
		lastDeal = `You are the new manager of ${YOU.name} in ${country}: a fresh league, ${money(offer.budget)} to spend.`;
		saveLeague();
		state = "intro"; banner.hidden = true; newMatch(); showIntro(); renderLeague();
		return true;
	}
	function takeOffer (key) {
		const o = (league && league.jobOffers || []).find(x => offerKey(x) === key);
		if (!o) { return false; }
		return o.abroad ? moveAbroad(o) : takeJob(o.id);
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
		rememberIdentity(lg);
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
	const offerWho = o => (o.abroad
		? `${o.name} (${NATIONS[o.nat] ? NATIONS[o.nat][0] : MARKETS[o.abroad].label}) want you as manager: a new country, strength ${"★".repeat(Math.round(o.str))}, ${money(o.budget)} to spend`
		: `${TEAMS[o.id].name} want you as manager: ${o.below ? "the division below" : "this division"}, strength ${"★".repeat(Math.round(o.str))}, ${money(o.budget)} to spend`);
	function renderOffers () {
		const ul = $("jobOffers"), title = $("jobsTitle"), al = $("agentOffers"), at = $("agentTitle");
		if (!ul || !title) { return; }
		ul.replaceChildren();
		const offers = league ? (league.jobOffers || []) : [];
		title.hidden = !offers.length;
		for (const o of offers) {
			const li = el("li"), key = offerKey(o);
			li.append(el("span", "pos", o.agreed ? "AGREED" : "JOB"), el("span", "who", offerWho(o) + (o.agreed ? " (agreed in January)" : "")));
			const btns = el("span", "bids");
			const a = el("button", "", o.abroad ? "Move abroad" : "Take the job"); a.type = "button"; a.addEventListener("click", () => takeOffer(key));
			const r = el("button", "", "Decline"); r.type = "button"; r.addEventListener("click", () => (o.abroad ? (league.jobOffers = league.jobOffers.filter(x => offerKey(x) !== key), afterClubChange()) : declineJob(o.id)));
			btns.append(a, r); li.append(btns);
			li.append(el("span", "ratings", o.abroad ? `You would leave ${YOU.name} for a fresh squad and a new league abroad; your career record comes with you.` : `You would leave ${YOU.name} and inherit their squad, ground and colours.`));
			ul.append(li);
		}
		if (al && at) {
			al.replaceChildren();
			const ag = league && league.agent && !seasonDone() ? (league.agent.offers || []) : [];
			const agreed = league && league.agreed;
			at.hidden = !ag.length && !agreed;
			if (agreed) { const li = el("li"); li.append(el("span", "pos", "AGREED"), el("span", "who", `${agreed.name || TEAMS[agreed.id].name}: you join when the season ends.`)); al.append(li); }
			for (const o of ag) {
				const li = el("li"), key = offerKey(o);
				li.append(el("span", "pos", o.abroad ? "ABROAD" : "HOME"), el("span", "who", offerWho(o)));
				const btns = el("span", "bids");
				const a = el("button", "", "Agree: join at season's end"); a.type = "button"; a.addEventListener("click", () => agreeApproach(key));
				const r = el("button", "", "Not interested"); r.type = "button"; r.addEventListener("click", () => declineApproach(key));
				btns.append(a, r); li.append(btns);
				li.append(el("span", "ratings", `Sounded out by your agent at the ${league.agent.when} window, with you ${league.agent.pos}${[ "st", "nd", "rd" ][league.agent.pos - 1] || "th"} at the time.`));
				al.append(li);
			}
		}
		const cl = $("careerLine");
		if (cl) { cl.textContent = careerLine(); }
	}
