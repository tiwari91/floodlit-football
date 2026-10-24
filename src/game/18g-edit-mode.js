	/* ---------- edit mode and option files ----------
	   Floodlit ships with invented players and clubs only. Anyone can rename clubs, kits and players
	   here, and share the edits as a small JSON "option file". Nothing in an option file is ever run:
	   it is parsed, every field is checked against a whitelist, and anything else is dropped.
	   Where the edits live:
	   - Clubs (yours, the division's, the foreign market clubs): league.edits.clubs / .markets, keyed by
	     the club's own name before any edit. They are laid over the identities from 18b after every
	     applyIdentity, and taken off again while rememberIdentity records them, so league.ident never
	     holds an edit and Revert is exact.
	   - Your players (and the market's): on the player object itself, with pl.orig keeping what each
	     edited field was. They travel with him when he is sold, and every player has a stable pl.id.
	   - The computer's players are rebuilt each season, so their edits are by club and squad slot:
	     league.edits.slots, laid over cpuSquad().
	   - Ratings are only touched when "custom ratings" is on (league.edits.custom). */
	// Version 2 adds whole leagues and the continental cup's clubs (18h); version 1 files still read.
	const OPTION_KIND = "floodlit-option-file", OPTION_VERSION = 2, OPTION_MAX_BYTES = 8000000, OPTION_MAX_ENTRIES = 3000;
	const EDIT_LEN = { club: [ 2, 28 ], short: [ 2, 14 ], ground: [ 2, 32 ], player: [ 2, 24 ], manager: [ 2, 28 ] };
	const AGE_MIN = 16, AGE_MAX = 40;
	const HEX_COLOR = /^#[0-9a-f]{6}$/i;
	const LOOK_STYLES = [ "short", "crop", "curly", "afro", "long", "tied", "buzz", "shaved" ];
	const SKIN_TONES = [ "#f1c9a5", "#e0ac86", "#c68a5e", "#9c6a44", "#6e4a30", "#4a3222" ];   // the same as SKIN and HAIR in 36
	const HAIR_SHADES = [ "#1b1410", "#3b2616", "#6b4424", "#a0703a", "#d8b46a", "#2a2a2a" ];
	const HAIR_NAMES = [ "Black", "Dark brown", "Brown", "Light brown", "Blond", "Dark grey" ];
	const RATING_KEYS = [ "pac", "sho", "pas", "def", "dri", "phy" ], RATING_MIN = 30, RATING_MAX = 96;
	const CLUB_EDIT_KEYS = [ "name", "short", "color", "color2", "ground", "manager", "managerNat" ], CLUB_SET_KEYS = [ ...CLUB_EDIT_KEYS, "text", "ink", "pattern" ];
	const PLAYER_EDIT_KEYS = [ "name", "nat", "shirt", "foot", "pos", "lk", "age", "trait", ...RATING_KEYS ];
	const BAD_KEYS = new Set([ "__proto__", "constructor", "prototype" ]);
	const own = (o, k) => !!o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
	const plainObj = v => !!v && typeof v === "object" && !Array.isArray(v);
	const MARKET_BASE = Object.fromEntries(Object.entries(MARKETS).map(([ r, m ]) => [ r, m.clubs.slice() ]));

	// Every player of yours (and on your lists) gets a stable id once; old saves are given theirs on load.
	function ensureIds (c) {
		if (!c || typeof c !== "object") { return; }
		const seen = new Set();
		for (const pl of [ ...(c.squad || []), ...(c.bench || []), ...(c.academy || []), ...(c.market || []) ]) {
			if (!pl || typeof pl !== "object") { continue; }
			if (typeof pl.id !== "string" || !pl.id || seen.has(pl.id)) { pl.id = newPid(); }
			seen.add(pl.id);
		}
	}

	/* --- checking values: shared by the editor, the import and a save's own edits --- */
	const cleanText = v => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f-\u009f<>{}]/g, "").replace(/\s+/g, " ").trim() : "");
	function checkText (v, kind, label) {
		const t = cleanText(v), [ lo, hi ] = EDIT_LEN[kind];
		if (t.length < lo || t.length > hi) { return { error: `${label} must be ${lo} to ${hi} characters.` }; }
		if ((kind === "player" || kind === "manager") && !/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(t)) { return { error: `${label} can only use letters, spaces, full stops, apostrophes and hyphens.` }; }
		return { value: t };
	}
	const checkColor = v => (typeof v === "string" && HEX_COLOR.test(v) ? v.toLowerCase() : null);
	const checkInt = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
	// One club's fields, each checked on its own: bad ones are reported and left out.
	function checkClubFields (src, marketOnly) {
		const out = {}, bad = [];
		if (!plainObj(src)) { return { out, bad: [ "not a club" ] }; }
		for (const k of marketOnly ? [ "name" ] : CLUB_EDIT_KEYS) {
			if (!own(src, k)) { continue; }
			if (k === "color" || k === "color2") { const c = checkColor(src[k]); if (c) { out[k] = c; } else { bad.push(`${k === "color" ? "Shirt" : "Second"} colour must look like #1d4fa0.`); } continue; }
			if (k === "managerNat") { if (typeof src[k] === "string" && own(NATIONS, src[k])) { out[k] = src[k]; } else { bad.push("Unknown nationality for the manager."); } continue; }
			const r = checkText(src[k], k === "name" ? "club" : k, k === "name" ? "Club name" : k === "short" ? "Short name" : k === "manager" ? "Manager's name" : "Ground name");
			if (r.error) { bad.push(r.error); } else { out[k] = r.value; }
		}
		if (out.color && out.color2 && deltaE(out.color, out.color2) < 12) { bad.push("Pick a second colour that stands apart from the shirt."); delete out.color2; }
		return { out, bad };
	}
	function checkLook (v) {
		if (!plainObj(v)) { return null; }
		const lk = {};
		if (SKIN_TONES.includes(v.skin)) { lk.skin = v.skin; }
		if (HAIR_SHADES.includes(v.hair)) { lk.hair = v.hair; }
		if (LOOK_STYLES.includes(v.style)) { lk.style = v.style; }
		if (checkInt(v.face, 0, 15) !== null) { lk.face = v.face; }
		return Object.keys(lk).length ? lk : null;
	}
	function checkPlayerFields (src, ratingsOn) {
		const out = {}, bad = [];
		if (!plainObj(src)) { return { out, bad: [ "not a player" ] }; }
		if (own(src, "name")) { const r = checkText(src.name, "player", "Player name"); if (r.error) { bad.push(r.error); } else { out.name = r.value; } }
		if (own(src, "nat")) { if (typeof src.nat === "string" && own(NATIONS, src.nat)) { out.nat = src.nat; } else { bad.push("Unknown nationality."); } }
		if (own(src, "shirt")) { const n = checkInt(src.shirt, 1, 99); if (n !== null) { out.shirt = n; } else { bad.push("Shirt number must be 1 to 99."); } }
		if (own(src, "foot")) { if (src.foot === "left" || src.foot === "right") { out.foot = src.foot; } else { bad.push("Foot must be left or right."); } }
		if (own(src, "pos")) { if (typeof src.pos === "string" && own(POS_LABEL, src.pos)) { out.pos = src.pos; } else { bad.push("Unknown position."); } }
		if (own(src, "lk")) { const lk = checkLook(src.lk); if (lk) { out.lk = lk; } else { bad.push("Unknown look."); } }
		if (own(src, "age")) { const n = checkInt(src.age, AGE_MIN, AGE_MAX); if (n !== null) { out.age = n; } else { bad.push(`Age must be ${AGE_MIN} to ${AGE_MAX}.`); } }
		if (own(src, "trait")) { if (src.trait === "" || (typeof src.trait === "string" && own(TRAITS, src.trait))) { out.trait = src.trait; } else { bad.push("Unknown trait."); } }
		for (const k of RATING_KEYS) {
			if (!own(src, k)) { continue; }
			if (!ratingsOn) { continue; }   // ratings only with custom ratings on
			const n = checkInt(src[k], RATING_MIN, RATING_MAX);
			if (n !== null) { out[k] = n; } else { bad.push(`Ratings must be whole numbers from ${RATING_MIN} to ${RATING_MAX}.`); }
		}
		return { out, bad };
	}
	// A save's edits (from storage or an imported season): keep what checks out, quietly drop the rest.
	function sanitizeEdits (raw) {
		const e = { clubs: {}, markets: {}, slots: {}, custom: false };
		if (!plainObj(raw)) { return e; }
		e.custom = raw.custom === true;
		const each = (o, fn) => { if (plainObj(o)) { Object.keys(o).slice(0, OPTION_MAX_ENTRIES).forEach(k => { if (!BAD_KEYS.has(k) && k.length <= 64) { fn(k, o[k]); } }); } };
		each(raw.clubs, (k, v) => { const { out } = checkClubFields(v, false); if (Object.keys(out).length) { e.clubs[k] = out; } });
		each(raw.markets, (k, v) => { const r = checkText(v, "club", "Club name"); if (!r.error) { e.markets[k] = r.value; } });
		each(raw.slots, (k, v) => { const { out } = checkPlayerFields(v, true); if (/#(10|[0-9])$/.test(k) && Object.keys(out).length) { e.slots[k] = out; } });
		return e;
	}
	const editsOf = lg => {
		if (!lg) { return sanitizeEdits(null); }
		if (!plainObj(lg.edits) || !plainObj(lg.edits.clubs) || !plainObj(lg.edits.markets) || !plainObj(lg.edits.slots)) { lg.edits = sanitizeEdits(lg.edits); }
		return lg.edits;
	};
	const hasEdits = e => !!e && (Object.keys(e.clubs).length + Object.keys(e.markets).length + Object.keys(e.slots).length > 0 || e.custom);
	// The edits also wait in this browser, so a new career (or a move abroad) starts with them.
	function mirrorEdits (lg) {
		const e = editsOf(lg);
		if (hasEdits(e)) { store.set("ff-edits", JSON.stringify(e)); } else { store.del("ff-edits"); }
	}
	function storedEdits () {
		try { return sanitizeEdits(JSON.parse(store.get("ff-edits") || "null")); } catch (err) { return sanitizeEdits(null); }
	}

	/* --- clubs: the overlay on TEAMS and the market lists --- */
	let clubOverlay = new Map();   // team -> { base: its fields before the edit, applied: the fields the edit set }
	const pick = (t, keys) => Object.fromEntries(keys.map(k => [ k, t[k] ]));
	const baseName = t => { const r = clubOverlay.get(t); return r && t.name === r.applied.name ? r.base.name : t.name; };
	function marketReverse () {
		const rev = {};
		for (const [ r, m ] of Object.entries(MARKETS)) { m.clubs.forEach((n, i) => { rev[n] = MARKET_BASE[r][i]; }); }
		return rev;
	}
	// Take every club edit off (only fields the game has not changed since), leaving the plain identities.
	function stripClubEdits () {
		for (const [ t, rec ] of clubOverlay) { for (const k of CLUB_SET_KEYS) { if (t[k] === rec.applied[k]) { t[k] = rec.base[k]; } } }
		clubOverlay = new Map();
		const rev = marketReverse();
		for (const [ r, m ] of Object.entries(MARKETS)) { m.clubs = MARKET_BASE[r].slice(); }
		if (league && league.club && Array.isArray(league.club.market)) { for (const pl of league.club.market) { if (pl && own(rev, pl.from)) { pl.from = rev[pl.from]; } } }
		return true;
	}
	// Lay the league's club edits over the identities. fresh: the identities were just reset (applyIdentity).
	function reapplyClubEdits (lg, fresh) {
		if (fresh) { clubOverlay = new Map(); for (const [ r, m ] of Object.entries(MARKETS)) { m.clubs = MARKET_BASE[r].slice(); } } else { stripClubEdits(); }
		const e = editsOf(lg), fc = fileOverlay(lg).clubs;   // a league file's clubs (18h) under the save's own edits
		for (const t of TEAMS) {
			if (!own(e.clubs, t.name) && !own(fc, t.name)) { continue; }
			const base = pick(t, CLUB_SET_KEYS);
			Object.assign(t, own(fc, t.name) ? fc[t.name] : {}, own(e.clubs, t.name) ? e.clubs[t.name] : {});
			if (t.color !== base.color) { t.text = textFor(t.color); t.ink = lum(t.color) > 0.55 ? "#1b2420" : "#ffffff"; }
			if (t.color !== base.color || t.color2 !== base.color2) { t.pattern = "plain"; }   // its own colours, not the game's stripes or hoops in them
			clubOverlay.set(t, { base, applied: pick(t, CLUB_SET_KEYS) });
		}
		for (const [ r, m ] of Object.entries(MARKETS)) {
			m.clubs = MARKET_BASE[r].map(n => (own(e.markets, n) ? e.markets[n] : n));
			MARKET_BASE[r].forEach((n, i) => { if (m.clubs[i] !== n && own(MARKET_CLUB_NAT, n)) { MARKET_CLUB_NAT[m.clubs[i]] = MARKET_CLUB_NAT[n]; } });
		}
		if (lg && lg.club && Array.isArray(lg.club.market)) { for (const pl of lg.club.market) { if (pl && own(e.markets, pl.from)) { pl.from = e.markets[pl.from]; } } }
	}
	// Hook from applyIdentity (18b): a save is loading. Migrate it (ids, edits) and lay its edits on.
	function applyEditsOnLoad (lg) {
		if (!lg) { return; }
		lg.edits = sanitizeEdits(lg.edits);
		if (lg.editsNext !== undefined) { lg.editsNext = plainObj(lg.editsNext) ? { edits: sanitizeEdits(lg.editsNext.edits), players: plainObj(lg.editsNext.players) ? lg.editsNext.players : {}, ratings: lg.editsNext.ratings === true } : undefined; }
		if (lg.club) { ensureIds(lg.club); }
		reapplyClubEdits(lg, true);
	}
	// Hook from newSeason (14): carry the edits on, and apply an option file that was waiting for this season.
	function seasonEdits (prev) {
		if (!league) { return; }
		league.edits = prev ? sanitizeEdits(prev.edits) : storedEdits();
		ensureIds(league.club);
		const next = prev && prev.editsNext;
		if (next && plainObj(next.edits)) { mergeOptionFile(league, next, next.ratings === true); }
		reapplyClubEdits(league, false);
		mirrorEdits(league);
	}

	/* --- players --- */
	const footFromName = name => ((hashStr(name) >> 13) % 5 === 0 ? "left" : "right");   // as build() in 27 works it out
	// The computer's squad with your edits for its slots (hook from cpuSquad in 17, before its signings).
	function editCpuSquad (clubId, sq) {
		const t = TEAMS[clubId];
		if (!league || !t || !league.edits) { return sq; }
		const e = league.edits, key = baseName(t), fs = fileOverlay(league).slots;
		for (let i = 0; i < sq.length; i++) {
			const k = `${key}#${i}`;
			if (!sq[i]) { continue; }
			if (own(fs, k)) {
				const fp = fs[k];
				for (const f of PLAYER_EDIT_KEYS) { if (own(fp, f)) { sq[i][f] = f === "lk" ? { ...fp.lk } : fp[f]; } }
				if (fp.name && !own(fp, "trait")) { sq[i].trait = traitFor(sq[i]); }   // his own trait, from his own name
			}   // a league file's player (18h): its ratings were kept only if wanted
			if (!own(e.slots, k)) { continue; }
			const ed = e.slots[k];
			for (const f of PLAYER_EDIT_KEYS) { if (own(ed, f) && (!RATING_KEYS.includes(f) || e.custom)) { sq[i][f] = f === "lk" ? { ...ed.lk } : ed[f]; } }
		}
		return sq;
	}
	// What a sold player takes with him (hook from 18's two transfer copies).
	function carryEdits (pl, keep) {
		if (pl && typeof pl.id === "string") { keep.id = pl.id; }
		for (const k of [ "shirt", "foot" ]) { if (pl && pl[k] !== undefined) { keep[k] = pl[k]; } }
		if (pl && pl.lk) { keep.lk = { ...pl.lk }; }
		if (pl && pl.orig) { keep.orig = { ...pl.orig }; }
		return keep;
	}
	// A match player takes his number, foot and look from his edits (hook from applySquad in 18).
	function editMatchPlayer (p, pl) {
		p.lookEd = pl && pl.lk ? pl.lk : null;
		if (pl && Number.isInteger(pl.shirt)) { p.num = pl.shirt; }
		if (pl && pl.foot) { build(p).left = pl.foot === "left"; p.footEd = true; } else if (p.footEd) { build(p).left = footFromName(p.name || `${p.team}-${p.idx}-${p.num}`) === "left"; p.footEd = false; }
	}
	// Set fields on one of your players, remembering what they were for Revert. A new name keeps his face and foot.
	function setPlayerFields (pl, out) {
		pl.orig = plainObj(pl.orig) ? pl.orig : {};
		const was = k => { if (!own(pl.orig, k)) { pl.orig[k] = pl[k] === undefined ? null : (k === "lk" && pl.lk ? { ...pl.lk } : pl[k]); } };
		if (out.name && out.name !== pl.name) {
			const old = pl.name;
			if (!pl.lk) { was("lk"); const l = lookFromName(old); pl.lk = { skin: l.skin, hair: l.hair, style: l.style, face: l.face }; }
			if (!pl.foot) { was("foot"); pl.foot = footFromName(old); }
			if (league) {
				for (const b of league.bidsIn || []) { if (b.name === old) { b.name = out.name; } }
				if (league.assistShort && Array.isArray(league.assistShort.names)) { league.assistShort.names = league.assistShort.names.map(n => (n === old ? out.name : n)); }
				if (league.drama && Array.isArray(league.drama.issues)) { for (const i of league.drama.issues) { if (i && i.name === old) { i.name = out.name; } } }   // the dressing room (18e) knows him by name
			}
		}
		for (const k of PLAYER_EDIT_KEYS) {
			if (!own(out, k)) { continue; }
			if (k === "lk") { was("lk"); pl.lk = { ...(pl.lk || {}), ...out.lk }; continue; }
			if (pl[k] === out[k]) { continue; }
			was(k); pl[k] = out[k];
		}
		if (!Object.keys(pl.orig).length) { delete pl.orig; }
	}
	function revertPlayer (pl) {
		if (!pl || !plainObj(pl.orig)) { return false; }
		for (const [ k, v ] of Object.entries(pl.orig)) { if (!PLAYER_EDIT_KEYS.includes(k)) { continue; } if (v === null) { delete pl[k]; } else { pl[k] = v; } }
		delete pl.orig;
		return true;
	}
	const ownPools = c => (c ? [ ...(c.squad || []), ...(c.bench || []), ...(c.academy || []) ] : []);
	const allOwn = c => (c ? [ ...ownPools(c), ...(c.market || []) ] : []);

	/* --- the edits the editor makes: checked, applied, saved --- */
	function clubTargets () {
		const out = TEAMS.map((t, i) => ({ kind: "club", id: i, base: baseName(t), label: t.name }));
		for (const [ r, m ] of Object.entries(MARKETS)) { if (r === "home") { continue; } MARKET_BASE[r].forEach((n, i) => out.push({ kind: "market", region: r, base: n, label: `${m.clubs[i]} (${m.label})` })); }
		return out;
	}
	function editClub (lg, target, fields) {
		const e = editsOf(lg);
		if (target.kind === "market") {
			const { out, bad } = checkClubFields(fields, true);
			if (bad.length) { return { error: bad[0] }; }
			const taken = Object.entries(MARKETS).some(([ r, m ]) => m.clubs.some((n, i) => MARKET_BASE[r][i] !== target.base && n.toLowerCase() === out.name.toLowerCase())) || TEAMS.some(t => t.name.toLowerCase() === out.name.toLowerCase());
			if (taken) { return { error: `There is already a club called ${out.name}.` }; }
			if (out.name === target.base) { delete e.markets[target.base]; } else { e.markets[target.base] = out.name; }
		} else {
			const t = TEAMS[target.id];
			if (!t) { return { error: "That club isn't in this league." }; }
			const { out, bad } = checkClubFields(fields, false);
			if (bad.length) { return { error: bad[0] }; }
			for (const k of [ "name", "short" ]) {
				if (out[k] && TEAMS.some(o => o !== t && String(o[k]).toLowerCase() === out[k].toLowerCase())) { return { error: `${k === "name" ? "Another club is already called" : "Another club already uses the short name"} ${out[k]}.` }; }
			}
			const base = clubOverlay.has(t) ? clubOverlay.get(t).base : pick(t, CLUB_SET_KEYS), key = baseName(t);
			for (const k of CLUB_EDIT_KEYS) { if (out[k] === base[k]) { delete out[k]; } }
			if (Object.keys(out).length) { e.clubs[key] = out; } else { delete e.clubs[key]; }
		}
		reapplyClubEdits(lg, false);
		return { ok: true };
	}
	function resetClub (lg, target) {
		const e = editsOf(lg);
		if (target.kind === "market") { delete e.markets[target.base]; } else if (TEAMS[target.id]) { delete e.clubs[baseName(TEAMS[target.id])]; }
		reapplyClubEdits(lg, false);
	}
	// Who the editor can work on: your club, the transfer list, or one of the computer's squads.
	function squadFor (lg, where) {
		if (where === "you") { return ownPools(lg.club); }
		if (where === "market") { return lg.club.market || []; }
		const id = Number(where);
		return TEAMS[id] && id !== 0 ? cpuSquad(id, getStr(id)) : [];
	}
	function editPlayer (lg, where, idx, fields) {
		const e = editsOf(lg), pool = squadFor(lg, where), pl = pool[idx];
		if (!pl) { return { error: "That player isn't there any more." }; }
		const { out, bad } = checkPlayerFields(fields, e.custom);
		if (bad.length) { return { error: bad[0] }; }
		const others = (where === "you" || where === "market" ? allOwn(lg.club) : pool).filter(q => q !== pl);
		if (out.name && others.some(q => q.name.toLowerCase() === out.name.toLowerCase())) { return { error: `${where === "you" || where === "market" ? "You already have a player" : "That club already has a player"} called ${out.name}.` }; }
		if (out.shirt && others.some(q => q.shirt === out.shirt && (where !== "you" || ownPools(lg.club).includes(q)))) { return { error: `Number ${out.shirt} is already taken.` }; }
		if (where === "you" || where === "market") { setPlayerFields(pl, out); return { ok: true }; }
		const key = `${baseName(TEAMS[Number(where)])}#${idx}`, prev = own(e.slots, key) ? e.slots[key] : {};
		const merged = { ...prev, ...out };
		if (out.lk) { merged.lk = { ...(prev.lk || {}), ...out.lk }; }
		e.slots[key] = merged;
		return { ok: true };
	}
	function resetPlayer (lg, where, idx) {
		const pool = squadFor(lg, where), pl = pool[idx];
		if (where === "you" || where === "market") { return revertPlayer(pl); }
		delete editsOf(lg).slots[`${baseName(TEAMS[Number(where)])}#${idx}`];
		return true;
	}
	function setCustomRatings (lg, on) { editsOf(lg).custom = !!on; }
	function revertEdits (lg) {
		stripClubEdits();
		lg.edits = sanitizeEdits(null);
		delete lg.editsNext;
		let n = 0;
		for (const pl of allOwn(lg.club)) { if (revertPlayer(pl)) { n++; } }
		store.del("ff-edits");
		clearLeagueFile();
		reapplyClubEdits(lg, false);
		return n;
	}

	/* --- option files --- */
	function buildOptionFile (lg) {
		const e = editsOf(lg), file = { kind: OPTION_KIND, version: OPTION_VERSION, note: "Floodlit option file: invented names only. Share it freely.", customRatings: e.custom };
		if (Object.keys(e.clubs).length) { file.clubs = e.clubs; }
		if (Object.keys(e.markets).length) { file.markets = e.markets; }
		if (Object.keys(e.slots).length) { file.slots = e.slots; }
		const players = {};
		for (const pl of allOwn(lg.club)) {
			if (!pl || !plainObj(pl.orig) || typeof pl.id !== "string") { continue; }
			const o = {};
			for (const k of Object.keys(pl.orig)) { if (PLAYER_EDIT_KEYS.includes(k) && pl[k] !== undefined && (!RATING_KEYS.includes(k) || e.custom)) { o[k] = k === "lk" ? { ...pl.lk } : pl[k]; } }
			if (Object.keys(o).length) { players[pl.id] = o; }
		}
		if (Object.keys(players).length) { file.players = players; }
		return file;
	}
	// Read a file's text: reject what isn't an option file, check every entry, and say what it would change.
	function readOptionFile (text, lg) {
		if (typeof text !== "string" || text.length > OPTION_MAX_BYTES) { return { error: "That file is too big to be an option file." }; }
		let v;
		try { v = JSON.parse(text); } catch (err) { return { error: "That file isn't valid JSON, so it can't be an option file." }; }
		if (!plainObj(v)) { return { error: "That file isn't a Floodlit option file." }; }
		if (v.kind !== OPTION_KIND) { return { error: v.league || v.app === "floodlit-football" ? "That's a saved season. Use Import league for it." : "That file isn't a Floodlit option file." }; }
		if (!Number.isInteger(v.version) || v.version < 1) { return { error: "The option file has no valid version number." }; }
		if (v.version > OPTION_VERSION) { return { error: "That option file is from a newer version of Floodlit." }; }
		for (const k of [ "clubs", "markets", "slots", "players" ]) {
			if (own(v, k) && !plainObj(v[k])) { return { error: `The option file is damaged: "${k}" should be a list of named entries.` }; }
			if (own(v, k) && Object.keys(v[k]).length > OPTION_MAX_ENTRIES) { return { error: `The option file has too many ${k}.` }; }
		}
		for (const k of [ "leagues", "cup" ]) { if (own(v, k) && !plainObj(v[k])) { return { error: `The option file is damaged: "${k}" should be a list of countries.` }; } }
		const file = { edits: { clubs: {}, markets: {}, slots: {}, custom: v.customRatings === true }, players: {} };
		const sum = { clubs: 0, players: 0, ratings: 0, unknown: 0, bad: 0, extra: 0 };
		file.lf = readLeagueSections(v, sum);   // whole leagues and the cup's clubs (18h)
		const knownClubs = new Set([ ...DEFAULT_IDENT.map(d => d.name), ...TEAMS.map(baseName) ]);
		const knownMarkets = new Set(Object.values(MARKET_BASE).flat());
		const ids = new Map(allOwn(lg && lg.club).map(pl => [ pl.id, pl ]));
		const keysOf = o => Object.keys(o || {}).filter(k => { if (BAD_KEYS.has(k) || k.length > 64) { sum.bad++; return false; } return true; });
		sum.extra = Object.keys(v).filter(k => ![ "kind", "version", "note", "customRatings", "clubs", "markets", "slots", "players", "leagues", "cup" ].includes(k)).length;
		for (const k of keysOf(v.clubs)) {
			if (!knownClubs.has(k)) { sum.unknown++; continue; }
			const { out, bad } = checkClubFields(v.clubs[k], false);
			if (bad.length) { sum.bad++; }
			if (Object.keys(out).length) { file.edits.clubs[k] = out; sum.clubs++; }
		}
		for (const k of keysOf(v.markets)) {
			if (!knownMarkets.has(k)) { sum.unknown++; continue; }
			const r = checkText(v.markets[k], "club", "Club name");
			if (r.error) { sum.bad++; } else { file.edits.markets[k] = r.value; sum.clubs++; }
		}
		const countPlayer = (src, put) => {
			const { out, bad } = checkPlayerFields(src, true);
			if (bad.length) { sum.bad++; }
			if (!Object.keys(out).length) { return; }
			if (RATING_KEYS.some(r => own(out, r))) { sum.ratings++; }
			put(out); sum.players++;
		};
		for (const k of keysOf(v.slots)) {
			const m = /^(.+)#(10|[0-9])$/.exec(k);
			if (!m || !knownClubs.has(m[1])) { sum.unknown++; continue; }
			countPlayer(v.slots[k], out => { file.edits.slots[k] = out; });
		}
		for (const k of keysOf(v.players)) {
			if (!ids.has(k)) { sum.unknown++; continue; }
			countPlayer(v.players[k], out => { file.players[k] = out; });
		}
		// Names must stay unique within your club: a clash is skipped, not applied.
		const names = new Map(allOwn(lg && lg.club).map(pl => [ pl.id, pl.name.toLowerCase() ]));
		for (const [ id, out ] of Object.entries(file.players)) { if (out.name) { names.set(id, out.name.toLowerCase()); } }
		const counts = {};
		for (const n of names.values()) { counts[n] = (counts[n] || 0) + 1; }
		for (const [ id, out ] of Object.entries(file.players)) { if (out.name && counts[out.name.toLowerCase()] > 1) { delete out.name; sum.bad++; if (!Object.keys(out).length) { delete file.players[id]; sum.players--; } } }
		return { file, sum };
	}
	function previewText (sum) {
		const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
		const lines = [ sum.clubs || sum.players ? `This file renames ${n(sum.clubs, "club", "clubs")} and ${n(sum.players, "player", "players")}.` : "This file has nothing that matches this save." ];
		const per = leagueSummary(sum);
		if (per) { lines.push(`${per}.`); }
		const here = leagueCountry(league), away = (sum.countries || []).map(c => c.nat).filter(c => c !== here);
		if (away.length) { lines.push(`You play in ${natLabel(here)}, so ${away.map(natLabel).join(", ")} ${away.length === 1 ? "shows" : "show"} when you play there (the Leagues tab: Play in another league) and in the continental cup.`); }
		const skip = [];
		if (sum.unknownNats && sum.unknownNats.length) { skip.push(`countries the game has no league for (${sum.unknownNats.slice(0, 6).join(", ")})`); }
		if (sum.unknown) { skip.push(`${n(sum.unknown, "entry", "entries")} for clubs or players not in this save`); }
		if (sum.bad) { skip.push(`${n(sum.bad, "value", "values")} that didn't pass the checks`); }
		if (sum.extra) { skip.push(`${n(sum.extra, "section", "sections")} Floodlit doesn't use`); }
		if (skip.length) { lines.push(`Ignored: ${skip.join(", ")}.`); }
		if (sum.ratings) { lines.push(`${n(sum.ratings, "player has", "players have")} custom ratings. They only apply if you tick Use its ratings.`); }
		return lines;
	}
	// Put a read file's edits into the save. ratings: the custom ratings in it are wanted.
	function mergeOptionFile (lg, file, ratings) {
		const e = editsOf(lg);
		const noRatings = o => { if (ratings) { return o; } const c = { ...o }; for (const k of RATING_KEYS) { delete c[k]; } return c; };
		Object.assign(e.clubs, file.edits.clubs);
		Object.assign(e.markets, file.edits.markets);
		for (const [ k, o ] of Object.entries(file.edits.slots)) { const c = noRatings(o); if (Object.keys(c).length) { e.slots[k] = c; } }
		if (ratings && file.edits.custom) { e.custom = true; }
		const ids = new Map(allOwn(lg.club).map(pl => [ pl.id, pl ]));
		for (const [ id, o ] of Object.entries(file.players || {})) { const pl = ids.get(id); if (pl) { setPlayerFields(pl, noRatings(o)); } }
	}
	// Leagues and cup clubs (18h) are kept in this browser and apply at once; the rest now or next season.
	// Returns false when the browser would not keep the league data.
	function applyOptionFile (lg, read, when, ratings) {
		const kept = read.file.lf && !lfEmpty(read.file.lf) ? mergeLeagueFile(read.file.lf, !!ratings) : true;
		if (when === "next") { lg.editsNext = { edits: read.file.edits, players: read.file.players, ratings: !!ratings }; reapplyClubEdits(lg, false); dropMaskedSignings(lg); return kept; }
		mergeOptionFile(lg, read.file, !!ratings);
		reapplyClubEdits(lg, false);
		dropMaskedSignings(lg);
		return kept;
	}
	// A computer club's signing from before the import sits on top of its squad slot (cpuSquad, 17): where
	// the file now names that slot's player, the file's player takes the slot back. Later signings still replace.
	function dropMaskedSignings (lg) {
		if (!lg || !lg.cpuIn || typeof lg.cpuIn !== "object") { return; }
		const fs = fileOverlay(lg).slots, es = (lg.edits && lg.edits.slots) || {};
		for (const id of Object.keys(lg.cpuIn)) {
			const t = TEAMS[id], ins = lg.cpuIn[id];
			if (!t || !Array.isArray(ins)) { continue; }
			const key = baseName(t), named = d => { const k = `${key}#${d && d.slot}`; return !!((own(fs, k) && fs[k].name) || (own(es, k) && es[k].name)); };
			lg.cpuIn[id] = ins.filter(d => !named(d));
		}
	}
	function afterEdit () {
		if (!league) { return; }
		mirrorEdits(league);
		afterClubChange();
	}

	/* --- the editor --- */
	const editor = { tab: "clubs", club: 0, where: "you", idx: 0, read: null, revertArm: 0 };
	const liveMatch = () => state === "play" || state === "paused" || state === "goal";
	function openEditor (tab) {
		if (!league || !league.club) { toast("Start a season first", "#f2b52e"); return false; }
		if (liveMatch()) { toast("Finish or abandon the match first", "#f2b52e"); return false; }
		ensureIds(league.club);
		if (tab) { editor.tab = tab; }
		$("editSheet").hidden = false;
		renderEditor();
		$("editClose").focus();
		return true;
	}
	function closeEditor () { $("editSheet").hidden = true; editor.read = null; }
	const field = (label, input) => { const l = el("label", "ed-field"); l.append(el("span", "", label), input); return l; };
	function input (type, value, attrs = {}) { const i = el("input"); i.type = type; i.value = value === undefined || value === null ? "" : String(value); Object.assign(i, attrs); return i; }
	function select (opts, value) { const s = el("select"); for (const [ v, t ] of opts) { const o = el("option", "", t); o.value = String(v); s.append(o); } s.value = String(value); return s; }
	function note (cls, text) { const p = el("p", `ed-note ${cls || ""}`, text); return p; }
	function renderEditor () {
		const body = $("editBody");
		body.textContent = "";
		for (const b of $("editTabs").querySelectorAll("button")) { b.setAttribute("aria-pressed", String(b.dataset.tab === editor.tab)); }
		if (editor.tab === "clubs") { renderClubEditor(body); } else if (editor.tab === "players") { renderPlayerEditor(body); } else if (editor.tab === "leagues") { renderLeagueTab(body); } else { renderFileTab(body); }
	}
	function renderClubEditor (body) {
		const targets = clubTargets(), cur = targets[clamp(editor.club, 0, targets.length - 1)] || targets[0];
		const sel = select(targets.map((t, i) => [ i, t.kind === "market" ? `Market: ${t.label}` : t.id === 0 ? `${t.label} (your club)` : t.label ]), targets.indexOf(cur));
		sel.id = "edClubSel";
		sel.addEventListener("change", () => { editor.club = Number(sel.value); renderEditor(); });
		body.append(field("Club", sel));
		const err = note("ed-err", ""), form = el("div", "ed-form");
		if (cur.kind === "market") {
			const name = input("text", MARKETS[cur.region].clubs[MARKET_BASE[cur.region].indexOf(cur.base)], { id: "edClubName", maxLength: EDIT_LEN.club[1] });
			form.append(field("Name", name), note("", `A club that sells players and hires managers abroad. Its default name is ${cur.base}.`));
			form.dataset.read = "market";
			body.append(form, err, clubButtons(cur, () => ({ name: name.value }), err));
			return;
		}
		const t = TEAMS[cur.id];
		const name = input("text", t.name, { id: "edClubName", maxLength: EDIT_LEN.club[1] }), short = input("text", t.short, { id: "edClubShort", maxLength: EDIT_LEN.short[1] });
		const c1 = input("color", t.color, { id: "edClubColor" }), c2 = input("color", t.color2 || "#ffffff", { id: "edClubColor2" }), ground = input("text", t.ground || "", { id: "edClubGround", maxLength: EDIT_LEN.ground[1] });
		const swatch = el("span", "ed-kit"), paint = () => { swatch.style.background = `linear-gradient(90deg, ${c1.value} 0 60%, ${c2.value} 60% 100%)`; };
		c1.addEventListener("input", paint); c2.addEventListener("input", paint); paint();
		const mgr = input("text", t.manager || "", { id: "edClubManager", maxLength: EDIT_LEN.manager[1], placeholder: "optional" });
		form.append(field("Name", name), field("Short name", short), field("Shirt colour", c1), field("Second colour", c2), swatch, field("Ground", ground));
		if (cur.id !== 0) { form.append(field("Manager", mgr)); }
		if (clubOverlay.has(t)) { form.append(note("", `Default name: ${clubOverlay.get(t).base.name}`)); }
		body.append(form, err, clubButtons(cur, () => ({ name: name.value, short: short.value, color: c1.value, color2: c2.value, ground: ground.value, ...(cur.id !== 0 && mgr.value.trim() ? { manager: mgr.value } : {}) }), err));
	}
	function clubButtons (cur, read, err) {
		const row = el("div", "ed-row"), save = el("button", "primary", "Save club"), reset = el("button", "", "Back to default");
		save.type = reset.type = "button"; save.id = "edClubSave";
		save.addEventListener("click", () => {
			const r = editClub(league, cur, read());
			if (r.error) { err.textContent = r.error; return; }
			afterEdit(); renderEditor(); toast("Club saved", "#7fd49b");
		});
		reset.addEventListener("click", () => { resetClub(league, cur); afterEdit(); renderEditor(); });
		row.append(save, reset);
		return row;
	}
	function renderPlayerEditor (body) {
		const lg = league, e = editsOf(lg);
		const wheres = [ [ "you", `${YOU.name} (yours)` ], [ "market", "Transfer list" ], ...lg.members.filter(id => id !== 0).map(id => [ id, TEAMS[id].name ]) ];
		if (!wheres.some(([ v ]) => String(v) === String(editor.where))) { editor.where = "you"; }
		const wsel = select(wheres, editor.where); wsel.id = "edWhere";
		wsel.addEventListener("change", () => { editor.where = wsel.value; editor.idx = 0; renderEditor(); });
		const pool = squadFor(lg, editor.where);
		editor.idx = clamp(editor.idx, 0, Math.max(0, pool.length - 1));
		const mine = editor.where === "you" || editor.where === "market";
		const edited = (pl, i) => (mine ? !!pl.orig : own(e.slots, `${baseName(TEAMS[Number(editor.where)])}#${i}`));
		const psel = select(pool.map((pl, i) => [ i, `${POS_LABEL[pl.pos]} · ${pl.name}${edited(pl, i) ? " (edited)" : ""}` ]), editor.idx);
		psel.id = "edPlayerSel";
		psel.addEventListener("change", () => { editor.idx = Number(psel.value); renderEditor(); });
		body.append(field("Squad", wsel), field("Player", psel));
		const pl = pool[editor.idx];
		if (!pl) { body.append(note("", "Nobody here.")); return; }
		const lk = pl.lk || lookFromName(pl.name);
		const name = input("text", pl.name, { id: "edPName", maxLength: EDIT_LEN.player[1] });
		const nat = select(Object.entries(NATIONS).map(([ k, v ]) => [ k, v[0] ]).sort((a, b) => a[1].localeCompare(b[1])), pl.nat); nat.id = "edPNat";
		const shirt = input("number", pl.shirt || "", { id: "edPShirt", min: 1, max: 99, placeholder: "by position" });
		const foot = select([ [ "right", "Right" ], [ "left", "Left" ] ], pl.foot || footFromName(pl.name)); foot.id = "edPFoot";
		const pos = select(Object.entries(POS_LABEL), pl.pos); pos.id = "edPPos";
		const skin = select(SKIN_TONES.map((c, i) => [ c, `Tone ${i + 1}` ]), lk.skin); skin.id = "edPSkin";
		const hair = select(HAIR_SHADES.map((c, i) => [ c, HAIR_NAMES[i] ]), lk.hair); hair.id = "edPHair";
		const style = select(LOOK_STYLES.map(s => [ s, s[0].toUpperCase() + s.slice(1) ]), lk.style); style.id = "edPStyle";
		const chip = el("span", "ed-face"), paint = () => { chip.style.background = skin.value; chip.style.borderTopColor = style.value === "shaved" ? skin.value : hair.value; };
		skin.addEventListener("change", paint); hair.addEventListener("change", paint); style.addEventListener("change", paint); paint();
		const form = el("div", "ed-form");
		form.append(field("Name", name), field("Nationality", nat), field("Shirt number", shirt), field("Preferred foot", foot), field("Position", pos), field("Skin", skin), field("Hair colour", hair), field("Hair style", style), chip);
		const rat = el("div", "ed-form ed-ratings"), custom = input("checkbox", "", { id: "edCustom", checked: e.custom });
		const tog = el("label", "ed-toggle"); tog.append(custom, el("span", "", "Custom ratings"));
		custom.addEventListener("change", () => { setCustomRatings(lg, custom.checked); afterEdit(); renderEditor(); });
		const rIn = {};
		const derived = { dri: driOf(pl), phy: phyOf(pl) };   // (dribbling and physical are worked out unless set)
		for (const [ k, label ] of [ [ "pac", "Pace" ], [ "sho", "Shooting" ], [ "pas", "Passing" ], [ "def", pl.pos === "gk" ? "Handling" : "Defending" ], [ "dri", "Dribbling" ], [ "phy", "Physical" ] ]) {
			rIn[k] = input("number", Number.isFinite(pl[k]) ? pl[k] : derived[k], { id: `edR${k}`, min: RATING_MIN, max: RATING_MAX, disabled: !e.custom });
			rat.append(field(label, rIn[k]));
		}
		const err = note("ed-err", "");
		const row = el("div", "ed-row"), save = el("button", "primary", "Save player"), reset = el("button", "", "Back to default");
		save.type = reset.type = "button"; save.id = "edPSave";
		save.addEventListener("click", () => {
			const f = { name: name.value, nat: nat.value, foot: foot.value, pos: pos.value, lk: { skin: skin.value, hair: hair.value, style: style.value, face: lk.face } };
			if (shirt.value !== "") { f.shirt = Number(shirt.value); }
			if (e.custom) { for (const k of RATING_KEYS) { if (!(k in derived) || Number.isFinite(pl[k]) || Number(rIn[k].value) !== derived[k]) { f[k] = Number(rIn[k].value); } } }
			const r = editPlayer(lg, editor.where, editor.idx, f);
			if (r.error) { err.textContent = r.error; return; }
			afterEdit(); renderEditor(); toast("Player saved", "#7fd49b");
		});
		reset.addEventListener("click", () => { resetPlayer(lg, editor.where, editor.idx); afterEdit(); renderEditor(); });
		row.append(save, reset);
		body.append(form, tog, note("", e.custom ? `Ratings from ${RATING_MIN} to ${RATING_MAX}. Custom ratings change how your career plays. Players on the transfer list are held to 92 overall.` : "Off: ratings stay as the game made them, so a career stays balanced."), rat, err, row);
	}
	function renderFileTab (body) {
		const lg = league, out = el("div", "ed-file");
		const exp = el("button", "primary", "Export option file"); exp.type = "button"; exp.id = "edExport";
		exp.addEventListener("click", () => exportOptionFile());
		const pickBtn = el("button", "", "Import option file"); pickBtn.type = "button"; pickBtn.id = "edImport";
		pickBtn.addEventListener("click", () => { $("editFile").value = ""; $("editFile").click(); });
		const drop = el("div", "ed-drop", "Or drop an option file here");
		drop.id = "edDrop";
		drop.addEventListener("dragover", ev => { ev.preventDefault(); drop.classList.add("over"); });
		drop.addEventListener("dragleave", () => drop.classList.remove("over"));
		drop.addEventListener("drop", ev => { ev.preventDefault(); drop.classList.remove("over"); const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f) { readOptionFileFrom(f); } });
		const row = el("div", "ed-row"); row.append(exp, pickBtn);
		out.append(note("", "An option file holds club names, kits and players, for this league or any other and the continental cup. It never holds a saved season. Leagues from a file are kept in this browser, not in your season."), row, drop);
		const pv = el("div", "ed-preview"); pv.id = "edPreview";
		if (editor.read && editor.read.error) { pv.append(note("ed-err", editor.read.error)); }
		else if (editor.read) {
			for (const line of previewText(editor.read.sum)) { pv.append(note("", line)); }
			const rat = input("checkbox", "", { id: "edUseRatings" }); const rl = el("label", "ed-toggle"); rl.append(rat, el("span", "", "Use its ratings (custom ratings)"));
			if (editor.read.sum.ratings) { pv.append(rl); }
			const now = el("button", "primary", "Apply to this save"), next = el("button", "", "Apply from next season"), cancel = el("button", "", "Cancel");
			now.type = next.type = cancel.type = "button"; now.id = "edApplyNow"; next.id = "edApplyNext";
			const go = when => {
				const kept = applyOptionFile(lg, editor.read, when, rat.checked), away = (editor.read.sum.countries || []).some(c => c.nat !== leagueCountry(lg));
				editor.read = null; afterEdit();
				if (away) { editor.tab = "leagues"; }   // the file's leagues are elsewhere: show the way there
				renderEditor();
				toast(!kept ? "Applied, but this browser is too full to keep the leagues after closing" : when === "next" ? "Edits will apply next season" : "Option file applied", kept ? "#7fd49b" : "#f2b52e");
			};
			now.addEventListener("click", () => go("now")); next.addEventListener("click", () => go("next"));
			cancel.addEventListener("click", () => { editor.read = null; renderEditor(); });
			const r2 = el("div", "ed-row"); r2.append(now, next, cancel); pv.append(r2);
		}
		out.append(pv);
		if (lg.editsNext) { out.append(note("", "An option file is waiting for next season.")); }
		const rv = el("button", "", Date.now() - editor.revertArm < 6000 ? "Press again to revert everything" : "Revert to default names"); rv.type = "button"; rv.id = "edRevert";
		rv.addEventListener("click", () => {
			if (Date.now() - editor.revertArm >= 6000) { editor.revertArm = Date.now(); renderEditor(); return; }
			editor.revertArm = 0; revertEdits(lg); afterEdit(); renderEditor(); toast("Back to the default names", "#7fd49b");
		});
		out.append(el("h3", "", "Revert"), note("", "Puts every club, kit and player back as the game made them, and turns custom ratings off."), rv);
		body.append(out);
	}
	function readOptionFileFrom (file) {
		if (file.size > OPTION_MAX_BYTES) { editor.read = { error: "That file is too big to be an option file." }; renderEditor(); return; }
		const r = new FileReader();
		r.onload = () => { editor.read = readOptionFile(String(r.result), league); editor.tab = "file"; renderEditor(); };
		r.onerror = () => { editor.read = { error: "Couldn't read that file." }; renderEditor(); };
		r.readAsText(file);
	}
	function exportOptionFile () {
		const data = JSON.stringify(buildOptionFile(league), null, 1), name = "floodlit-option-file.json";
		if (typeof downloadsCap !== "undefined" && downloadsCap) {
			downloadsCap.save({ filename: name, data }).then(() => toast("Option file exported", "#7fd49b"), err => { if (!err || err.code !== "declined") { toast("Couldn't export here", "#e2594a"); } });
			return;
		}
		try {
			const url = URL.createObjectURL(new Blob([ data ], { type: "application/json" })), a = document.createElement("a");
			a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 2000);
			toast("Option file exported", "#7fd49b");
		} catch (err) { toast("Couldn't export here", "#e2594a"); }
	}
	$("lgEdit").addEventListener("click", e => { e.currentTarget.blur(); openEditor(); });
	$("editClose").addEventListener("click", closeEditor);
	$("editDone").addEventListener("click", closeEditor);
	$("editTabs").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (b) { editor.tab = b.dataset.tab; renderEditor(); } });
	$("editFile").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) { readOptionFileFrom(f); } });
	// Typing a name must not steer the game: keys stay inside the editor (Escape closes it).
	$("editSheet").addEventListener("keydown", e => { e.stopPropagation(); if (e.code === "Escape") { closeEditor(); } });
	if (/[?&]test\b/.test(location.search)) {
		queueMicrotask(() => { if (window.__ff) { Object.assign(window.__ff, { openEditor, closeEditor, afterEdit, editClub, editPlayer, resetPlayer, resetClub, revertEdits, buildOptionFile, readOptionFile, applyOptionFile, setCustomRatings, squadFor, cpuSquad, sellPlayer, clubTargets, rememberIdentity, applyIdentity, editsOf, getStr, newSeason, previewText }); } });
	}
