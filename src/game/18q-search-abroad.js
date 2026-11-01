	/* ---------- the transfer search abroad ----------
	   "Any player, any club" reaches every league the game has, not only your division and the one below:
	   Spain, Germany, Italy and the rest, each with its clubs named the way that country names them (18c).
	   A league file (18h) that gives a country its clubs and players is used as it is, so those clubs and
	   names are the file's; any other country's clubs are made up from a fixed seed, strongest first, from
	   the country's standing in the continental cup (18f). A player bought from abroad goes onto the
	   market list from his club and region, so the work permit, the asking price, the homegrown rule and
	   the settling-in period all apply as for any signing from abroad. Your own league's country is the
	   division itself, so it is not listed again. */
	const ABROAD_CLUBS = 10;   // a country without a league file: its ten strongest clubs
	const abroadNats = () => Object.keys(FOREIGN).filter(n => n !== (typeof leagueCountry === "function" ? leagueCountry(league) : HOME_NAT));
	const natTop = n => { const row = typeof CC_NATIONS !== "undefined" ? CC_NATIONS.find(r => r[0] === n) : null; return row ? row[2] : 3.3; };
	// A country's clubs: { key, name, slot, file } with the file's players when it has them.
	function abroadClubs (nat) {
		const lf = typeof leagueFile === "function" ? leagueFile() : { leagues: {} }, L = lf.leagues && lf.leagues[nat];
		if (L && Array.isArray(L.clubs) && L.clubs.length) {
			return L.clubs.slice().sort((a, b) => a.slot - b.slot).map(c => ({ key: `a:${nat}:${c.slot}`, nat, name: c.name, slot: c.slot, players: c.players || null }));
		}
		const ids = foreignIdent(nat, "") || [];
		return ids.slice(1, ABROAD_CLUBS + 1).map((d, i) => ({ key: `a:${nat}:${i + 1}`, nat, name: d.name, slot: i + 1, players: null }));
	}
	// A club abroad's eleven: generated like the division's (a fixed seed per season), the file's players laid over it.
	function abroadSquad (club) {
		let h = (hashStr(club.key) + (league ? league.season : 1) * 104729) % 2147483647 || 1;
		const rnd = () => { h = (h * 48271) % 2147483647; return h / 2147483647; };
		const str = clamp(natTop(club.nat) - (club.slot - 1) * 0.12, 1.5, 5), base = cpuOvr(str), sp = styleOf(club.nat).sp;
		const sq = POS_OF_SLOT.map((pos, i) => genPlayer(pos, base + Math.round((rnd() * 2 - 1) * 4 * sp) + (i === 9 || i === 2 ? 3 : 0), null, rnd, { lg: club.nat }));
		for (const fp of club.players || []) {
			const i = fp.slot, pl = sq[i];
			if (!pl) { continue; }
			for (const f of PLAYER_EDIT_KEYS) { if (Object.prototype.hasOwnProperty.call(fp, f)) { pl[f] = f === "lk" ? { ...fp.lk } : fp[f]; } }
			if (fp.name && !Object.prototype.hasOwnProperty.call(fp, "trait")) { pl.trait = traitFor(pl); }
		}
		return sq;
	}
	// The search's results from abroad, in the same shape as the division's (the id is the club's key).
	function searchAbroad (q, name) {
		const out = [], want = String(q.club || ""), c = league.club;
		const mine = new Set([ ...c.squad, ...c.bench, ...(c.loanedOut || []).map(L => L.pl) ].map(p => p.name));
		for (const nat of abroadNats()) {
			if (want && want !== `n:${nat}` && !want.startsWith(`a:${nat}:`)) { continue; }
			for (const club of abroadClubs(nat)) {
				if (want.startsWith("a:") && want !== club.key) { continue; }
				abroadSquad(club).forEach(pl => {
					if (!pl || mine.has(pl.name) || (name && !pl.name.toLowerCase().includes(name)) || (q.pos && pl.pos !== q.pos) || ovrOf(pl) < (q.min || 0)) { return; }
					const held = c.market.find(m => m.name === pl.name && m.abroad === club.key), ask = held ? askOf(held) : round1(priceOf(pl) * 1.2);
					if (q.max > 0 && ask * MONEY_SCALE > q.max + 1e-9) { return; }
					out.push({ id: club.key, abroad: club, slot: -1, pl, ask, held });
				});
			}
		}
		return out;
	}
	// Bid for a player abroad: he joins the market list from his club and region, then the usual bid.
	function bidAbroad (r, low) {
		const c = league.club;
		let i = c.market.findIndex(m => m.name === r.pl.name && m.abroad === r.id);
		if (i < 0) {
			const region = NATIONS[r.abroad.nat] ? NATIONS[r.abroad.nat][1] : "europe";
			c.market.push({ ...r.pl, from: r.abroad.name, region: MARKETS[region] ? region : "europe", ask: r.ask, abroad: r.id });
			i = c.market.length - 1;
		}
		bidFor(i, low);
	}
	// The club list in the search form: a group per country, its clubs when a league file names them.
	function abroadOptions (select) {
		for (const nat of abroadNats()) {
			const g = el("optgroup"); g.label = `Abroad: ${NATIONS[nat] ? NATIONS[nat][0] : nat} (${FOREIGN[nat][0]})`;
			const all = el("option", "", `${NATIONS[nat] ? NATIONS[nat][0] : nat} · every club`); all.value = `n:${nat}`; g.append(all);
			for (const club of abroadClubs(nat)) { const o = el("option", "", club.name); o.value = club.key; g.append(o); }
			select.append(g);
		}
	}
