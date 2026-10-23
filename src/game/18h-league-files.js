	/* ---------- league files: whole leagues and the continental cup from an option file ----------
	   A version 2 option file can name the clubs (and their eleven players) of any league the game has,
	   by country code and club slot, and the guests of the continental cup by country. That data is kept
	   in this browser under its own key, not in the season, so it never bloats a save and Revert stays
	   exact. It is laid over the clubs through the same name-keyed overlay as edit mode's own renames
	   (18g): a slot's club is found by the plain name the game gives it in that country (DEFAULT_IDENT at
	   home, foreignIdent in 18c), so it follows a club through a job swap. Edit mode's own edits win.
	   The spec for tools that write these files is docs/option-file-schema.json. */
	const LF_KEY = "ff-leaguefile", LF_SLOTS = TEAMS.length - 1, LF_PLAYERS = POS_OF_SLOT.length, LF_CUP_MAX = 8, LF_MAX_BYTES = 3000000;
	const LEAGUE_NATS = [ HOME_NAT, ...Object.keys(FOREIGN) ];
	const natLabel = n => (NATIONS[n] ? NATIONS[n][0] : n);
	const leagueLabel = n => `${n === HOME_NAT ? "Premier Division" : FOREIGN[n][0]} (${natLabel(n)})`;
	const leagueCountry = lg => (lg && lg.ident && FOREIGN[lg.ident.country] ? lg.ident.country : HOME_NAT);
	let lfData = null, lfOver = null;   // the stored file (file shape), and the overlay built from it for one country

	// One club from a file, checked: its fields, its slot (league clubs), and up to eleven players.
	function checkFileClub (src, withSlot, sum) {
		if (!plainObj(src)) { sum.bad++; return null; }
		const { out, bad } = checkClubFields(src, false);
		if (bad.length) { sum.bad++; }
		if (!out.name) { sum.bad++; return null; }
		if (withSlot) { const s = checkInt(src.slot, 1, LF_SLOTS); if (s === null) { sum.bad++; return null; } out.slot = s; }
		if (!own(src, "players")) { return out; }
		if (!Array.isArray(src.players)) { sum.bad++; return out; }
		const names = new Set(), slots = new Set();
		out.players = [];
		src.players.slice(0, 40).forEach((p, i) => {
			if (!plainObj(p)) { sum.bad++; return; }
			const sl = own(p, "slot") ? checkInt(p.slot, 0, LF_PLAYERS - 1) : (i < LF_PLAYERS ? i : null);
			if (sl === null || slots.has(sl)) { sum.bad++; return; }
			const { out: po, bad: pb } = checkPlayerFields(p, true);
			if (pb.length) { sum.bad++; }
			if (!po.name || names.has(po.name.toLowerCase())) { sum.bad++; return; }
			if (RATING_KEYS.some(k => own(po, k))) { sum.ratings++; }
			names.add(po.name.toLowerCase()); slots.add(sl);
			out.players.push({ slot: sl, ...po });
		});
		return out;
	}
	// The leagues and cup sections of a parsed file, checked. sum gets the counts the preview shows.
	function readLeagueSections (v, sum) {
		const lf = { leagues: {}, cup: {} };
		sum.countries = []; sum.cupClubs = 0; sum.unknownNats = [];
		const natKeys = o => Object.keys(o).filter(k => { if (BAD_KEYS.has(k) || k.length > 8) { sum.bad++; return false; } if (!LEAGUE_NATS.includes(k)) { sum.unknownNats.push(k); return false; } return true; });
		if (plainObj(v.leagues)) {
			for (const nat of natKeys(v.leagues)) {
				const L = v.leagues[nat];
				if (!plainObj(L) || !Array.isArray(L.clubs)) { sum.bad++; continue; }
				const clubs = [], names = new Set(), slots = new Set();
				for (const c of L.clubs.slice(0, 60)) {
					const o = checkFileClub(c, true, sum);
					if (!o) { continue; }
					if (slots.has(o.slot) || names.has(o.name.toLowerCase())) { sum.bad++; continue; }
					slots.add(o.slot); names.add(o.name.toLowerCase()); clubs.push(o);
				}
				if (!clubs.length) { continue; }
				lf.leagues[nat] = { clubs };
				sum.countries.push({ nat, clubs: clubs.length, players: clubs.reduce((t, c) => t + (c.players ? c.players.length : 0), 0) });
			}
		}
		if (plainObj(v.cup)) {
			for (const nat of natKeys(v.cup)) {
				if (!Array.isArray(v.cup[nat])) { sum.bad++; continue; }
				const clubs = [], names = new Set();
				for (const c of v.cup[nat].slice(0, LF_CUP_MAX)) {
					const o = checkFileClub(c, false, sum);
					if (!o || names.has(o.name.toLowerCase())) { if (o) { sum.bad++; } continue; }
					names.add(o.name.toLowerCase()); clubs.push(o);
				}
				if (clubs.length) { lf.cup[nat] = clubs; sum.cupClubs += clubs.length; sum.players += clubs.reduce((t, c) => t + (c.players ? c.players.length : 0), 0); }
			}
		}
		sum.clubs += sum.countries.reduce((t, c) => t + c.clubs, 0) + sum.cupClubs;
		sum.players += sum.countries.reduce((t, c) => t + c.players, 0);
		return lf;
	}
	const lfEmpty = lf => !lf || (!Object.keys(lf.leagues).length && !Object.keys(lf.cup).length);
	function leagueFile () {
		if (lfData) { return lfData; }
		let raw = null;
		try { raw = JSON.parse(store.get(LF_KEY) || "null"); } catch (err) { raw = null; }
		lfData = plainObj(raw) ? readLeagueSections(raw, { bad: 0, ratings: 0, clubs: 0, players: 0 }) : { leagues: {}, cup: {} };
		return lfData;
	}
	// Keep it in this browser; false when storage refused it (it still works until the page closes).
	function storeLeagueFile (lf) {
		lfData = lf; lfOver = null;
		if (lfEmpty(lf)) { store.del(LF_KEY); return true; }
		const text = JSON.stringify(lf);
		store.set(LF_KEY, text);
		return store.get(LF_KEY) === text;
	}
	// A read file's leagues and cup go in, country by country (a country in the file replaces what was kept for it).
	function mergeLeagueFile (add, ratings) {
		const cur = leagueFile(), lf = { leagues: { ...cur.leagues }, cup: { ...cur.cup } };
		const strip = c => ({ ...c, players: c.players ? c.players.map(p => { const q = { ...p }; if (!ratings) { for (const k of RATING_KEYS) { delete q[k]; } } return q; }) : undefined });
		for (const [ nat, L ] of Object.entries(add.leagues)) { lf.leagues[nat] = { clubs: L.clubs.map(strip) }; }
		for (const [ nat, cl ] of Object.entries(add.cup)) { lf.cup[nat] = cl.map(strip); }
		return storeLeagueFile(lf);
	}
	const clearLeagueFile = () => storeLeagueFile({ leagues: {}, cup: {} });
	// Each slot's plain name in a country (index 0, your club, unused).
	const slotNames = nat => (nat === HOME_NAT ? DEFAULT_IDENT.map(d => d.name) : (foreignIdent(nat, "") || []).map(d => (d ? d.name : "")));
	const clubFields = c => { const o = {}; for (const k of CLUB_EDIT_KEYS) { if (c[k] !== undefined) { o[k] = c[k]; } } if (o.color && !o.color2) { o.color2 = foreignSecond(o.color); } return o; };
	// What the file lays over this league: clubs by plain name, and players by "<name>#<squad slot>" (the
	// league's clubs by their plain names; every other club in the file, cup guests too, by its own name).
	function fileOverlay (lg) {
		const nat = leagueCountry(lg);
		if (lfOver && lfOver.nat === nat) { return lfOver; }
		const lf = leagueFile(), clubs = {}, slots = {};
		const addPlayers = (key, c) => { for (const p of c.players || []) { const q = { ...p }; delete q.slot; slots[`${key}#${p.slot}`] = q; } };
		for (const [ n, L ] of Object.entries(lf.leagues)) {
			const names = n === nat ? slotNames(n) : null;
			for (const c of L.clubs) {
				if (names) { const base = names[c.slot]; if (base) { clubs[base] = clubFields(c); addPlayers(base, c); } } else { addPlayers(c.name, c); }
			}
		}
		for (const cl of Object.values(lf.cup)) { for (const c of cl) { addPlayers(c.name, c); } }
		lfOver = { nat, clubs, slots };
		return lfOver;
	}
	// The clubs a country sends to the continental cup from the file, best first: its cup list, then its league's clubs by slot strength.
	function fileCupClubs (nat) {
		const lf = leagueFile(), out = [], seen = new Set();
		const inLeague = lf.leagues[nat] ? lf.leagues[nat].clubs.slice().sort((a, b) => (CLUBS[b.slot - 1] ? CLUBS[b.slot - 1].str : 0) - (CLUBS[a.slot - 1] ? CLUBS[a.slot - 1].str : 0) || a.slot - b.slot) : [];
		for (const c of [ ...(lf.cup[nat] || []), ...inLeague ]) { if (!seen.has(c.name.toLowerCase())) { seen.add(c.name.toLowerCase()); out.push(c); } }
		return out;
	}
	// One line per country for the preview: "England 20 clubs / 209 players".
	function leagueSummary (sum) {
		const parts = (sum.countries || []).map(c => `${natLabel(c.nat)} ${c.clubs} ${c.clubs === 1 ? "club" : "clubs"} / ${c.players} ${c.players === 1 ? "player" : "players"}`);
		if (sum.cupClubs) { parts.push(`Continental cup ${sum.cupClubs} ${sum.cupClubs === 1 ? "club" : "clubs"}`); }
		return parts.join("; ");
	}

	/* --- playing in another league ---
	   There is one season per browser, so a new league replaces it: the season is downloaded first (bring
	   it back any time with Import league), then either your club moves (squad, budget, staff and career
	   come too) or a new career starts, at your own club or at any club of that league. */
	const LEAGUE_HINT = "Your season is downloaded first, unless you untick it. Import league brings it back.";
	function switchLeague (nat, opts = {}) {
		const lg = league;
		if (!lg || !lg.club) { return { error: "Start a season first." }; }
		if (!LEAGUE_NATS.includes(nat)) { return { error: "That league isn't in the game." }; }
		if (typeof liveMatch === "function" && liveMatch()) { return { error: "Finish or abandon the match first." }; }
		const move = opts.mode === "move", pickSlot = !move && Number.isInteger(opts.club) && opts.club >= 1 && opts.club <= LF_SLOTS ? opts.club : 0;
		if (opts.backup) { exportLeague(); }
		if (lg.contGuest) { restoreGuest(lg); }   // a cup guest must not be baked into the identities
		const shown = identOf(YOU);   // your club as it looks now, a file's or your own renames included
		stripClubEdits();
		if (move) { Object.assign(YOU, shown); }   // it keeps that look abroad, where no overlay knows it
		const fmt = lg.fmt, from = YOU.name;
		let c;
		if (move) {
			c = lg.club;
			delete c.contQual; delete c.contCoef;   // old slot ids and the old cup's records mean nothing in the new league
			c.log = [ `You took ${YOU.name} to the ${leagueLabel(nat)}`, ...(Array.isArray(c.log) ? c.log : []) ].slice(0, 40);
		} else {
			Object.assign(YOU, DEFAULT_IDENT[0]);
			c = newClub();
		}
		TEAMS.forEach((t, i) => { if (i !== 0) { Object.assign(t, DEFAULT_IDENT[i]); } });
		if (nat !== HOME_NAT) { applyForeignLeague(nat); }
		league = null;
		newSeason(fmt, c);
		if (move && lg.career) { league.career = { ...lg.career, clubs: [ ...((lg.career && lg.career.clubs) || [ from ]), `${from} (${natLabel(nat)})` ] }; }
		rememberIdentity(league);
		league.ident.country = nat === HOME_NAT ? undefined : nat;
		reapplyClubEdits(league, false);
		if (pickSlot) {
			// You take that club's place (its eleven from the file), and your own club takes its seat; a club
			// from below the division moves up into the place so a full league file stays whole.
			const str = getStr(pickSlot), base = cpuOvr(str), sq = cpuSquad(pickSlot, str);
			stripClubEdits();
			const swap = (a, b) => { for (const k of IDENT_KEYS) { const v = a[k]; a[k] = b[k]; b[k] = v; } };
			swap(YOU, TEAMS[pickSlot]);
			if (pickSlot < DIVISION && TEAMS[DIVISION]) { swap(TEAMS[pickSlot], TEAMS[DIVISION]); const s = league.clubStr; [ s[pickSlot], s[DIVISION] ] = [ s[DIVISION], s[pickSlot] ]; }
			league.club.squad = sq.map(p => ({ ...p }));
			league.club.bench = BENCH_POS.map((pos, i) => genPlayer(pos, base - 5 + (i % 3)));
			league.club.budget = round1(1 + str * 0.9);
			ensureIds(league.club);
			rememberIdentity(league);
			reapplyClubEdits(league, false);
		}
		forecastLeague(league);
		league.news = `${league.news || ""} ${move ? `${YOU.name} now play in the ${leagueLabel(nat)}.` : `A new career: you manage ${YOU.name} in the ${leagueLabel(nat)}.`}`.trim();
		lastDeal = move ? `${YOU.name} moved to the ${leagueLabel(nat)}.` : `New career: ${YOU.name}, ${leagueLabel(nat)}.`;
		mirrorEdits(league);
		saveLeague();
		state = "intro"; banner.hidden = true; newMatch(); showIntro(); renderLeague();
		return { ok: true };
	}
	// The Leagues tab of the editor: pick a country, a club, and go.
	const switcher = { nat: null, mode: "new", club: 0, backup: true, arm: 0 };
	function renderLeagueTab (body) {
		const lg = league, here = leagueCountry(lg), lf = leagueFile();
		if (!switcher.nat || !LEAGUE_NATS.includes(switcher.nat)) { switcher.nat = Object.keys(lf.leagues).find(n => n !== here) || (here === HOME_NAT ? "ESP" : HOME_NAT); }
		const nat = switcher.nat;
		body.append(note("", `You manage ${YOU.name} in the ${leagueLabel(here)}. Play in another league to start there, with the clubs from your option file where it has them.`));
		const count = n => (lf.leagues[n] ? ` · your file: ${lf.leagues[n].clubs.length} clubs` : "");
		const nsel = select(LEAGUE_NATS.map(n => [ n, `${leagueLabel(n)}${n === here ? " · you are here" : ""}${count(n)}` ]), nat); nsel.id = "lsNat";
		nsel.addEventListener("change", () => { switcher.nat = nsel.value; switcher.club = 0; switcher.arm = 0; renderEditor(); });
		const msel = select([ [ "new", "Start a new career there" ], [ "move", `Move ${YOU.name} there (squad, budget and career come too)` ] ], switcher.mode); msel.id = "lsMode";
		msel.addEventListener("change", () => { switcher.mode = msel.value; switcher.arm = 0; renderEditor(); });
		body.append(field("League", nsel), field("How", msel));
		if (switcher.mode === "new") {
			const names = slotNames(nat), byslot = {};
			for (const c of lf.leagues[nat] ? lf.leagues[nat].clubs : []) { byslot[c.slot] = c.name; }
			const opts = [ [ 0, `${DEFAULT_IDENT[0].name} (a club of your own)` ] ];
			for (let i = 1; i <= LF_SLOTS; i++) { opts.push([ i, `${byslot[i] || names[i]}${i >= DIVISION ? " (below the division)" : ""}` ]); }
			const csel = select(opts, switcher.club); csel.id = "lsClub";
			csel.addEventListener("change", () => { switcher.club = Number(csel.value); switcher.arm = 0; });
			body.append(field("Your club", csel));
		}
		const bk = input("checkbox", "", { id: "lsBackup", checked: switcher.backup });
		bk.addEventListener("change", () => { switcher.backup = bk.checked; });
		const bl = el("label", "ed-toggle"); bl.append(bk, el("span", "", "Download this season first (a backup)"));
		const armed = Date.now() - switcher.arm < 6000;
		const go = el("button", "primary", armed ? "Press again: this replaces the season here" : "Play in another league"); go.type = "button"; go.id = "lsGo";
		const err = note("ed-err", "");
		go.addEventListener("click", () => {
			if (Date.now() - switcher.arm >= 6000) { switcher.arm = Date.now(); renderEditor(); return; }
			switcher.arm = 0;
			const r = switchLeague(switcher.nat, { mode: switcher.mode, club: switcher.club, backup: switcher.backup });
			if (r.error) { err.textContent = r.error; return; }
			closeEditor(); toast(`Welcome to the ${leagueLabel(switcher.nat)}`, "#7fd49b");
		});
		body.append(bl, note("", LEAGUE_HINT), go, err);
	}
	$("lgLeagues").addEventListener("click", e => { e.currentTarget.blur(); openEditor("leagues"); });
	if (/[?&]test\b/.test(location.search)) {
		queueMicrotask(() => { if (window.__ff) { Object.assign(window.__ff, { switchLeague, leagueFile, fileOverlay, fileCupClubs, leagueCountry, slotNames, clearLeagueFile, drawCont, ensureCont, LEAGUE_NATS, POS_OF_SLOT, BENCH_POS, CC_NATIONS, CLUB_STRS: CLUBS.map(c => c.str), RIVALS, NATIONS, TRAIT_KEYS: Object.keys(TRAITS), LOOKS: { skin: SKIN_TONES, hair: HAIR_SHADES, style: LOOK_STYLES } }); } });
	}
