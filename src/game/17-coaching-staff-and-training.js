	/* ---------- coaching: staff and training ----------
	   Six jobs, each held by someone rated one to five stars (or nobody). Coaches multiply what
	   training does for the attributes they look after; the fitness coach also speeds recovery and
	   cuts training knocks; the assistant runs the tactical drills; the scout finds and sizes up
	   players abroad. Staff cost a fee to hire and a wage. */
	const STAFF = {
		assistant: [ "Assistant manager", "tactical drills, morale" ], attack: [ "Attacking coach", "shooting and passing" ], defence: [ "Defensive coach", "defending" ],
		gk: [ "Goalkeeping coach", "keepers" ], fitness: [ "Fitness coach", "pace, recovery, fewer knocks" ], scout: [ "Chief scout", "finds and rates players abroad" ]
	};
	const FIRST = [ "Ana", "Bruno", "Carla", "Dario", "Elif", "Femi", "Gus", "Hana", "Ivo", "Jonas", "Kofi", "Lena", "Mateo", "Nina", "Omar", "Pia", "Ravi", "Sven", "Tomo", "Uli", "Vera", "Wim", "Yara", "Zeki" ];
	const staffLvl = (c, job) => (c.staff && c.staff[job] ? c.staff[job].lvl : 0);
	const staffWages = c => Object.values(c.staff || {}).reduce((t, st) => t + (st ? st.wage : 0), 0);
	const staffFee = lvl => round1(0.15 + lvl * lvl * 0.12);
	function genStaffPool () {
		const pool = [];
		for (const job of Object.keys(STAFF)) {
			for (let k = 0; k < 2; k++) {
				const lvl = clamp(1 + Math.floor(Math.random() * 5), 1, 5), nat = Object.keys(NATIONS)[Math.floor(Math.random() * Object.keys(NATIONS).length)];
				pool.push({ job, lvl, nat, name: `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${SURNAMES[Math.floor(Math.random() * SURNAMES.length)]}`, wage: Math.round((0.02 + lvl * 0.025) * 1000) / 1000 });
			}
		}
		return pool;
	}
	function ensureCoaching (c, lg) {
		if (!c.staff || typeof c.staff !== "object") { c.staff = {}; }
		for (const job of Object.keys(STAFF)) { const st = c.staff[job]; if (st && !(Number.isFinite(st.lvl) && typeof st.name === "string")) { c.staff[job] = null; } }
		if (!c.training || typeof c.training !== "object") { c.training = { focus: "balanced", load: "normal" }; }
		if (!Number.isFinite(c.drill)) { c.drill = 30; }
		if (lg && !Array.isArray(lg.staffPool)) { lg.staffPool = genStaffPool(); }
	}
	function hireStaff (i) {
		const c = league.club, cand = league.staffPool[i];
		if (!cand) { return; }
		const fee = staffFee(cand.lvl);
		if (c.budget + 1e-9 < fee) { lastDeal = `${cand.name} wants a ${money(fee)} fee to join.`; afterClubChange(); return; }
		c.budget = round1(c.budget - fee);
		const old = c.staff[cand.job];
		c.staff[cand.job] = { name: cand.name, lvl: cand.lvl, nat: cand.nat, wage: cand.wage };
		league.staffPool.splice(i, 1);
		lastDeal = `${cand.name} (${"★".repeat(cand.lvl)}) is your new ${STAFF[cand.job][0].toLowerCase()}${old ? `, replacing ${old.name}` : ""}.`;
		afterClubChange();
	}
	function fireStaff (job) {
		const c = league.club, st = c.staff[job];
		if (!st) { return; }
		c.staff[job] = null;
		lastDeal = `${st.name} has left the club.`;
		afterClubChange();
	}
	// A week on the training ground, after each league match.
	function weeklyCoaching (lm, played) {
		const c = league.club;
		ensureCoaching(c, league);
		const tr = c.training, load = { light: 0.7, normal: 1, hard: 1.35 }[tr.load] || 1, gains = [], knocks = [];
		const FOCUS = { balanced: {}, attack: { sho: 1.8, pas: 1.5, pac: 0.5, def: 0.5 }, defence: { def: 1.8, pac: 0.7, sho: 0.5, pas: 0.5 }, fitness: { pac: 1.8, sho: 0.6, pas: 0.6, def: 0.6 }, tactics: { pac: 0.4, sho: 0.4, pas: 0.4, def: 0.4 }, youth: {} }[tr.focus] || {};
		const coachFor = (pl, k) => (k === "pac" ? "fitness" : k === "def" ? (pl.pos === "gk" ? "gk" : "defence") : pl.pos === "gk" ? "gk" : "attack");
		for (const pl of [ ...c.squad, ...c.bench ]) {
			ensurePlayer(pl);
			if (pl.inj > 0) { continue; }
			if (!pl.xp || typeof pl.xp !== "object") { pl.xp = {}; }
			const age = pl.age, young = age <= 21 ? 1.6 : age <= 24 ? 1.2 : age <= 28 ? 0.8 : age <= 31 ? 0.4 : 0.15;
			const room = clamp((pl.pot - ovrOf(pl)) / 6, 0.1, 1), youth = tr.focus === "youth" ? (age <= 21 ? 1.8 : 0.5) : 1, match = played.has(pl.name) ? 1.3 : 1;
			const keys = pl.pos === "gk" ? [ "def", "pas" ] : [ "pac", "sho", "pas", "def" ];
			for (const k of keys) {
				const g = 0.013 * young * load * (1 + staffLvl(c, coachFor(pl, k)) * 0.22) * (FOCUS[k] || 1) * room * youth * match;
				pl.xp[k] = (pl.xp[k] || 0) + g;
				if (pl.xp[k] >= 1) { pl.xp[k] -= 1; if (pl[k] < 99) { pl[k]++; gains.push(`${pl.name} +1 ${k.toUpperCase()}`); } }
			}
			// Hard weeks tire legs and now and then cause a knock; a good fitness coach makes both rarer.
			const fl = staffLvl(c, "fitness");
			if (tr.load === "hard") { pl.fit = clamp(fitOf(pl) - 4 + fl * 0.6, 40, 100); if (Math.random() < 0.012 * (1 - fl * 0.15)) { pl.inj = 1; knocks.push(pl.name); } }
			else if (tr.load === "light") { pl.fit = clamp(fitOf(pl) + 4, 40, 100); }
			if (fl) { pl.fit = clamp(fitOf(pl) + fl, 40, 100); }
			// The assistant keeps spirits up.
			const al = staffLvl(c, "assistant");
			if (al) { pl.morale = clamp(pl.morale + (65 - pl.morale) * 0.02 * al, 5, 100); pl.morale = Math.round(pl.morale); }
		}
		// Tactical drills: the side learns its shape, which tightens passing and defending a little.
		c.drill = clamp(c.drill + (tr.focus === "tactics" ? 5 : 1.2) * (1 + staffLvl(c, "assistant") * 0.2) * load - 0.6, 0, 100);
		c.report = { round: lm.round + 1, gains: gains.slice(0, 12), more: Math.max(0, gains.length - 12), knocks };
		if (gains.length || knocks.length) { c.log = [ ...(c.log || []), `MD${lm.round + 1}: ${gains.length} improvement${gains.length === 1 ? "" : "s"}${knocks.length ? `, knocks for ${knocks.join(", ")}` : ""}` ].slice(-10); }
	}
	// Between seasons: players past 30 lose a step, and the staff list changes.
	function seasonCoaching (c) {
		ensureCoaching(c, league);
		const dropped = [];
		for (const pl of [ ...c.squad, ...c.bench ]) {
			if (pl.age >= 30) {
				const d = pl.age >= 34 ? 3 : pl.age >= 32 ? 2 : 1;
				pl.pac = Math.max(30, pl.pac - d - (Math.random() < 0.5 ? 1 : 0));
				if (pl.age >= 33) { for (const k of [ "sho", "pas", "def" ]) { if (Math.random() < 0.5) { pl[k] = Math.max(30, pl[k] - 1); } } }
				dropped.push(pl.name);
			}
		}
		league.staffPool = genStaffPool();
		if (dropped.length) { league.news = `${league.news} Getting older: ${dropped.slice(0, 5).join(", ")}${dropped.length > 5 ? " and others" : ""} have lost a yard of pace.`.trim(); }
	}
	function renderCoaching () {
		const c = league.club;
		ensureCoaching(c, league);
		$("trFocus").value = c.training.focus; $("trLoad").value = c.training.load;
		$("drillMeta").textContent = `Tactical familiarity ${Math.round(c.drill)}%`;
		const r = c.report;
		$("trReport").textContent = r ? `After matchday ${r.round}: ${r.gains.length ? r.gains.join(", ") + (r.more ? ` and ${r.more} more` : "") : "no one improved a point this week"}.${r.knocks.length ? ` Knocks in training: ${r.knocks.join(", ")}.` : ""}` : "Your first report comes after the next league match.";
		const ul = $("staffList");
		ul.replaceChildren();
		for (const [ job, [ title, what ] ] of Object.entries(STAFF)) {
			const st = c.staff[job], li = el("li");
			li.append(el("span", "pos", st ? "★".repeat(st.lvl) : "–"));
			const who = el("span", "who", st ? `${st.name} (${st.nat})` : "Vacant");
			who.append(el("small", "", `${title}: ${what}${st ? ` · ${wageWeek(st.wage)}` : ""}`));
			li.append(who);
			if (st) { const b = el("button", "", "Let go"); b.type = "button"; b.addEventListener("click", () => fireStaff(job)); li.append(b); }
			else { li.append(el("span", "")); }
			const cands = el("div", "cands");
			league.staffPool.forEach((cd, i) => {
				if (cd.job !== job || (st && cd.lvl <= st.lvl)) { return; }
				const b = el("button", "", `Hire ${cd.name} ${"★".repeat(cd.lvl)} · ${money(staffFee(cd.lvl))}`);
				b.type = "button"; b.disabled = c.budget + 1e-9 < staffFee(cd.lvl);
				b.addEventListener("click", () => hireStaff(i));
				cands.append(b);
			});
			if (cands.children.length) { li.append(cands); }
			ul.append(li);
		}
	}

	// After a league match: whoever started loses fitness; everyone else recovers.
	function updateFitness () {
		const c = league.club, used = new Set(slotsFor(league.fmt));
		league.recovered = []; league.physio = [];
		for (const pl of [ ...c.squad, ...c.bench ]) {
			const was = pl.inj > 0 || pl.ban > 0;
			if (pl.inj > 0) {
				pl.inj--;
				if (pl.inj > 0 && Math.random() < staffLvl(c, "fitness") * 0.12) { pl.inj--; league.physio = [ ...(league.physio || []), pl.name ]; }
				if (!(pl.inj > 0)) { pl.injType = ""; }
			}
			if (pl.ban > 0) { pl.ban--; }
			if (was && !(pl.inj > 0) && !(pl.ban > 0) && pl.wasStarter) { league.recovered.push(pl.name); pl.wasStarter = false; }
		}
		// Played: the harder the match ran him into the ground, the more it takes out of him.
		const spent = (pl, dflt) => (Number.isFinite(matchSta[pl.name]) ? -(4 + (1 - matchSta[pl.name]) * 20) : dflt);
		c.squad.forEach((pl, i) => { pl.fit = clamp(fitOf(pl) + (used.has(i) ? spent(pl, -10) : 22), 40, 100); });
		c.bench.forEach(pl => { pl.fit = clamp(fitOf(pl) + (cameOn.includes(pl.name) ? spent(pl, 10) + 14 : 22), 40, 100); });
		matchSta = {};
	}

	// Rotation: pick one player, then another, and they swap places.
	let picked = null;   // { list: "squad" | "bench", i }
	function pickPlayer (list, i) {
		const c = league.club;
		if (!picked) { picked = { list, i }; renderClub(); return; }
		if (picked.list === list && picked.i === i) { picked = null; renderClub(); return; }
		const a = picked, A = c[a.list][a.i], B = c[list][i];
		c[a.list][a.i] = B;
		c[list][i] = A;
		picked = null;
		lastDeal = `${B.name} and ${A.name} swapped.`;
		afterClubChange();
	}

	// The line-up picture: presets, the starters where the formation puts them, the bench underneath.
	const LU_PRESETS = { "11": [ "442", "433", "352", "4231" ] };
	function setLineupShape (fmt, key) {
		if (currentFmt() === fmt && [ ...shapeSel.options ].some(o => o.value === key)) { shapeSel.value = key; shapeSel.dispatchEvent(new Event("change")); return; }
		shapePref[fmt] = key; store.set("ff-shape-" + fmt, key); renderLeague();
	}
	function swapSlots (a, b) {
		const c = league.club, A = c[a.list][a.i], B = c[b.list][b.i];
		if (!A || !B || A === B) { return; }
		c[a.list][a.i] = B; c[b.list][b.i] = A;
		picked = null;
		lastDeal = `${B.name} and ${A.name} swapped.`;
		afterClubChange();
	}
	function renderLineup () {
		const box = $("lineup");
		if (!box || !league || !league.club) { return; }
		const c = league.club, fmt = league.fmt, sh = shapeOf(fmt), cur = shapeKeyOf(fmt);
		box.replaceChildren();
		const pre = el("div", "lu-presets");
		pre.setAttribute("role", "group"); pre.setAttribute("aria-label", "Formation");
		for (const k of LU_PRESETS[fmt] || Object.keys(SHAPES[fmt] || {})) {
			const b = el("button", "", SHAPES[fmt][k].label.split(" ")[0]);
			b.type = "button"; b.setAttribute("aria-pressed", String(k === cur));
			b.addEventListener("click", () => setLineupShape(fmt, k));
			pre.append(b);
		}
		const pitch = el("div", "lu-pitch"), bench = el("div", "lu-bench");
		let oopN = 0;
		const tok = (pl, list, i, role) => {
			const b = el("button", "lu-tok"), out = role && role !== pl.pos;
			b.type = "button";
			b.dataset.list = list; b.dataset.i = String(i);
			if (out) { b.classList.add("oop"); oopN++; }
			if (pl.inj > 0 || pl.ban > 0) { b.classList.add("hurt"); }
			b.setAttribute("aria-pressed", String(!!(picked && picked.list === list && picked.i === i)));
			b.title = `${pl.name}, ${POS_LABEL[pl.pos]}${out ? ` playing ${POS_LABEL[role]}: out of position` : ""}`;
			b.append(el("span", "shirt", String(list === "squad" ? FORMATS["11"].nums[i] : 12 + i)), el("span", "nm", pl.name.split(" ").slice(-1)[0]), el("span", "badge", out ? `⚠ ${POS_LABEL[pl.pos]}→${POS_LABEL[role]}` : POS_LABEL[role || pl.pos]));
			b.addEventListener("click", () => { if (luDrag && luDrag.moved) { return; } pickPlayer(list, i); });
			b.addEventListener("pointerdown", luDown);
			return b;
		};
		sh.pos.forEach((q, k) => {
			const i = q[0], pl = c.squad[i];
			if (!pl) { return; }
			const b = tok(pl, "squad", i, sh.roles[k]);
			b.style.left = `${clamp(q[3] * 100, 9, 91)}%`;
			b.style.top = `${clamp(96 - (q[2] - 0.03) * 140, 7, 93)}%`;
			pitch.append(b);
		});
		c.squad.forEach((pl, i) => { if (pl && !sh.slots.includes(i)) { bench.append(tok(pl, "squad", i, null)); } });
		c.bench.forEach((pl, i) => bench.append(tok(pl, "bench", i, null)));
		box.append(pre, pitch, bench);
		if (oopN) { box.append(el("p", "lu-warn", `⚠ ${oopN} player${oopN === 1 ? "" : "s"} out of position`)); }
	}
	// Dragging, with mouse or finger: a ghost follows the pointer and whatever token it is dropped on swaps.
	let luDrag = null;
	function luTarget (x, y) { const e = document.elementFromPoint(x, y); return e && e.closest ? e.closest(".lu-tok") : null; }
	function luDown (e) {
		if (e.button > 0) { return; }
		const b = e.currentTarget;
		luDrag = { b, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, over: null, id: e.pointerId };
		try { b.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
		b.addEventListener("pointermove", luMove);
		b.addEventListener("pointerup", luUp);
		b.addEventListener("pointercancel", luUp);
	}
	function luMove (e) {
		const d = luDrag;
		if (!d || e.pointerId !== d.id) { return; }
		if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) { return; }
		e.preventDefault();
		if (!d.moved) { d.moved = true; d.ghost = d.b.cloneNode(true); d.ghost.classList.add("lu-ghost"); document.body.append(d.ghost); d.b.style.opacity = "0.35"; }
		d.ghost.style.left = `${e.clientX}px`; d.ghost.style.top = `${e.clientY}px`;
		const t = luTarget(e.clientX, e.clientY);
		if (d.over && d.over !== t) { d.over.classList.remove("over"); }
		d.over = t && t !== d.b ? t : null;
		if (d.over) { d.over.classList.add("over"); }
	}
	function luUp (e) {
		const d = luDrag;
		if (!d || e.pointerId !== d.id) { return; }
		d.b.removeEventListener("pointermove", luMove); d.b.removeEventListener("pointerup", luUp); d.b.removeEventListener("pointercancel", luUp);
		if (d.ghost) { d.ghost.remove(); }
		d.b.style.opacity = "";
		if (!d.moved) { luDrag = null; return; }
		setTimeout(() => { if (luDrag === d) { luDrag = null; } }, 0);   // swallow the click that follows a drag
		const t = e.type === "pointerup" ? luTarget(e.clientX, e.clientY) : null;
		if (t && t !== d.b) { swapSlots({ list: d.b.dataset.list, i: Number(d.b.dataset.i) }, { list: t.dataset.list, i: Number(t.dataset.i) }); }
	}

	// Best XI: fill each starting slot with the strongest fit player for it.
	function autoPick (rest = false, quiet = false) {
		const c = league.club, pool = [ ...c.squad, ...c.bench ], order = league.fmt !== "11" ? [ ...slotsFor(league.fmt), ...POS_OF_SLOT.map((_, i) => i).filter(i => !slotsFor(league.fmt).includes(i)) ] : [ 0, 9, 10, 2, 3, 6, 7, 1, 4, 5, 8 ];
		const xi = [];
		for (const slot of order) {
			let bi = 0;
			const role = roleOfSlot(league.fmt, slot);
			// Rotating: the more tired a player, the more he counts against him (65% a little, 45% a lot),
			// so a worn-out starter is rested even for a somewhat weaker fresh one.
			const score = pl => matchOvr(pl, role) - (rest && fitOf(pl) < TIRED ? (TIRED - fitOf(pl)) * 0.8 + 6 : 0) - (pl.inj > 0 || pl.ban > 0 ? 200 : 0);
			pool.forEach((pl, k) => { if (score(pl) > score(pool[bi])) { bi = k; } });
			xi[slot] = pool.splice(bi, 1)[0];
		}
		c.squad = xi;
		c.bench = pool;
		picked = null;
		lastDeal = rest ? "Rotated: tired players rested." : "Picked the strongest fit team.";
		if (!quiet) { afterClubChange(); }
	}
	// Rest tired starters; returns how many were taken out.
	function rotateTired (quiet = false) {
		const before = tiredStarters().map(pl => pl.name);
		autoPick(true, quiet);
		const nowIn = new Set(slotsFor(league.fmt).map(i => league.club.squad[i].name));
		return before.filter(n => !nowIn.has(n));
	}

	// Starters under this fitness are flagged before a match: pace and sharpness drop off below it.
	const TIRED = 70;
	const injuredStarters = () => (league && league.club ? slotsFor(league.fmt).map(i => league.club.squad[i]).filter(pl => pl && (pl.inj > 0 || pl.ban > 0)) : []);
	function tiredStarters () {
		if (!league || !league.club) { return []; }
		return slotsFor(league.fmt).map(i => league.club.squad[i]).filter(pl => fitOf(pl) < TIRED);
	}
	const tiredText = list => `${list.length === 1 ? "1 starter is" : `${list.length} starters are`} tired: ${list.slice(0, 4).map(pl => `${pl.name} ${fitOf(pl)}%`).join(", ")}${list.length > 4 ? ` and ${list.length - 4} more` : ""}.`;

	let lastDeal = "", mkTab = "all";
	function afterClubChange () {
		saveLeague();
		if (state === "intro") { newMatch(); showIntro(); }
		renderLeague();
	}

	// A bid: the asking price is always accepted; a lower one may be, or may be turned down (and the
	// price goes up); turn a club down twice and it stops talking.
	function bidFor (i, low) {
		const c = league.club, pl = c.market[i];
		if (!pl || !windowOpen() || !permitOk(pl) || pl.bids < 0) { return; }
		const ask = askOf(pl), offer = low ? round1(ask * 0.8) : ask;
		if (c.budget + 1e-9 < offer || c.budget < 0) { return; }
		if (low) {
			const yes = Math.random() < 0.3 + (pl.age >= 29 ? 0.15 : 0) + staffLvl(c, "scout") * 0.05;
			if (!yes) {
				pl.bids = (pl.bids || 0) + 1;
				if (pl.bids >= 2) { pl.bids = -1; lastDeal = `${pl.from} have broken off talks over ${pl.name}.`; }
				else { pl.ask = round1(ask * 1.08); lastDeal = `${pl.from} turned down ${money(offer)} for ${pl.name}; they now want ${money(pl.ask)}.`; }
				afterClubChange();
				return;
			}
		}
		signPlayer(i, offer);
	}
	function scoutPlayer (i) {
		const c = league.club, pl = c.market[i];
		if (!pl || pl.scouted || !(c.scoutLeft > 0)) { return; }
		pl.scouted = true; c.scoutLeft--;
		lastDeal = `Scouted ${pl.name}: overall ${ovrOf(pl)}, potential ${Math.round(pl.pot)}.`;
		afterClubChange();
	}
	// How well you know a player you haven't scouted: a range around the truth, narrower with a better scout.
	function ratingRange (pl) {
		const c = league.club, w = pl.scouted ? 0 : Math.max(0, ((pl.region || "home") === "home" ? 6 : 12) - staffLvl(c, "scout") * 2), o = ovrOf(pl);
		if (!w) { return null; }
		const off = (hashStr(pl.name + "rng") % (w + 1)) - Math.floor(w / 2);
		return [ clamp(o - Math.floor(w / 2) + off, 30, 99 - w), clamp(o + Math.ceil(w / 2) + off, 30 + w, 99) ];
	}
	function signPlayer (i, offer) {
		const c = league.club, pl = c.market[i];
		if (!pl || !windowOpen()) { return; }
		const price = Number.isFinite(offer) ? offer : askOf(pl);
		if (c.budget + 1e-9 < price || c.budget < 0) { return; }
		const m = MARKETS[pl.region];
		pl.adapt = m ? Math.max(0, m.adapt - staffLvl(c, "scout") * 0.5) : 0;
		delete pl.ask; delete pl.bids; delete pl.from; delete pl.scouted;
		const tgt = signingTarget(pl.pos), out = tgt.out, fee = out ? round1(priceOf(out) * 0.5) : 0;
		c.budget = round1(c.budget - price + fee);
		c[tgt.list][tgt.i] = pl;
		c.market.splice(i, 1);
		picked = null;
		lastDeal = (out ? `Signed ${pl.name} for ${money(price)}; ${out.name} left for ${money(fee)}.` : `Signed ${pl.name} for ${money(price)}, straight onto the bench.`) + (pl.adapt > 0 ? ` He'll need a few games to settle.` : "");
		league.club.log = [ ...(league.club.log || []), `Signed ${pl.name} (${pl.nat}) for ${money(price)}` ].slice(-10);
		afterClubChange();
	}

	function buyUpgrade (key) {
		const c = league.club, u = UPGRADES.find(x => x.key === key), lv = c.upgrades[key] || 0;
		if (!u || !windowOpen() || lv >= 3 || c.budget + 1e-9 < u.costs[lv]) { return; }
		c.budget = round1(c.budget - u.costs[lv]);
		c.upgrades[key] = lv + 1;
		lastDeal = `${u.name} upgraded to level ${lv + 1}.`;
		afterClubChange();
	}

	// The Shape picker lists the shapes for the format being played; 11-a-side is always 4-4-2.
	const currentFmt = () => (mode === "league" && league ? league.fmt : fmtSel.value);
	function renderShapes () {
		// Teams always shows the format being played: the season's in the league (change it
		// and the season switches from the next match), your own choice in a friendly.
		const lg = mode === "league" && league;
		const wanted = store.get("ff-fmt");
		if (lg) { fmtSel.value = league.fmt; }
		else if (wanted && FORMATS[wanted]) { fmtSel.value = wanted; }
		fmtSel.disabled = false;
		fmtSel.title = "";
		// Opponent, weather and ground are friendly settings: in the league the fixture sets them
		// (the home club's ground and the season's forecast), so they're hidden there.
		for (const id of [ "weatherField", "groundField", "diffField" ]) { $(id).hidden = mode === "league"; }
		const fmt = currentFmt(), shapes = SHAPES[fmt];
		$("shapeField").hidden = !shapes;
		if (!shapes) { return; }
		shapeSel.replaceChildren();
		const auto = document.createElement("option");
		auto.value = "auto"; auto.textContent = "Auto (follows tactic)";
		shapeSel.append(auto);
		for (const [ key, sh ] of Object.entries(shapes)) {
			const o = document.createElement("option");
			o.value = key; o.textContent = sh.label;
			shapeSel.append(o);
		}
		shapeSel.value = shapePref[fmt];
	}

	function setMode (m) {
		mode = m === "friendly" || m === "tutorial" || m === "corners" ? m : "league";
		if (mode !== "tutorial" && mode !== "corners") { store.set("ff-mode", mode); }
		tut = null; shoot = null;
		$("coach").hidden = true;
		$("modeLeague").setAttribute("aria-pressed", String(mode === "league"));
		$("modeFriendly").setAttribute("aria-pressed", String(mode === "friendly"));
		$("modeTutorial").setAttribute("aria-pressed", String(mode === "tutorial"));
		$("modeCorners").setAttribute("aria-pressed", String(mode === "corners"));
		diffSel.disabled = weatherSel.disabled = groundSel.disabled = mode === "league";
		diffSel.title = mode === "league" ? "In the league, each club plays at its own rating" : "";
		weatherSel.title = groundSel.title = mode === "league" ? "In the league, the fixture sets the ground and the forecast" : "";
		if (mode === "league" && !league) { newSeason(fmtSel.value); }
		// Switching ends any match in progress without a result.
		clearLive();
		state = "intro";
		banner.hidden = true;
		newMatch();
		showIntro();
		renderLeague();
		renderShapes();
	}

	// Skip a fixture: play it out from the two sides' ratings.
	let simulated = false, oppStrength = 3;
	// Simulate: the whole match from the kick-off card, or the rest of it from the pause
	// screen (the score so far stands). Strength against strength, with home advantage.
	function simulateMine () {
		if (mode === "tutorial" || mode === "corners" || !(state === "intro" || state === "paused" || state === "half")) { return; }
		const left = state === "intro" ? 1 : clamp(timeLeft / matchLen, 0, 1);
		if (state === "intro") { score = [ 0, 0 ]; }
		const mine = league && league.club ? yourStr() : 3;
		const home = leagueMatch ? (leagueMatch.home ? 0.3 : -0.3) : 0.3;
		const d = mine - oppStrength + home;
		const add = [ poisson(clamp(1.3 + 0.32 * d, 0.2, 3.2) * left), poisson(clamp(1.2 - 0.32 * d, 0.2, 3.2) * left) ];
		simEvents(state === "intro" ? 0 : minuteNow(), add);
		score = [ score[0] + add[0], score[1] + add[1] ];
		simulated = true;
		endMatch();
	}

	// Simulate the season: every fixture left, one after another, with everything that happens
	// in them (cards and bans, injuries, tired legs, auto-rotate). It stops at the January
	// window so you can do business, and at the end of the season.
	function simulateSeason () {
		if (mode !== "league" || !league || !league.club || seasonDone()) { return; }
		const start = league.round, tally = { n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, y: 0, r: 0, inj: 0 };
		let stoppedJan = false;
		bulkSim = true;
		try {
			for (let guard = 0; guard < 80 && !seasonDone(); guard++) {
				if (state !== "intro") { clearLive(); state = "intro"; newMatch(); }
				if (!leagueMatch) { break; }
				simulateMine();
				const [ h, a ] = score;
				tally.n++; tally.gf += h; tally.ga += a;
				if (h > a) { tally.w++; } else if (h < a) { tally.l++; } else { tally.d++; }
				for (const e of matchLog) {
					if (e.team !== 0) { continue; }
					if (e.kind === "yellow") { tally.y++; } else if (e.kind === "red") { tally.r++; } else if (e.kind === "injury") { tally.inj++; }
				}
				if (league.round === JANUARY && start < JANUARY) { stoppedJan = true; break; }
			}
		} finally {
			bulkSim = false;
		}
		saveLeague();
		clearLive();
		state = "intro";
		banner.hidden = true;
		newMatch();
		renderLeague();
		const rows = standings(), pos = rows.findIndex(r => r.id === 0) + 1, pts = rows[pos - 1].pts;
		const c = league.club, top = [ ...c.squad, ...c.bench ].filter(pl => pl.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 3);
		const scorers = top.length ? ` Top scorers: ${top.map(pl => `${pl.name} ${pl.goals}`).join(", ")}.` : "";
		const disc = ` Cards: ${tally.y} yellow, ${tally.r} red. Injuries: ${tally.inj}.`;
		const line = `${tally.n} match${tally.n === 1 ? "" : "es"} simulated: won ${tally.w}, drew ${tally.d}, lost ${tally.l}, goals ${tally.gf}–${tally.ga}.`;
		if (seasonDone()) {
			const champ = rows[0].id === 0 ? `You are champions with ${pts} points!` : `${TEAMS[rows[0].id].name} are champions. You finished ${ordinal(pos)} on ${pts} points.`;
			showOverlay(`Season ${league.season} simulated`, `${line} ${champ}${scorers}${disc} Prize money: ${money(league.prize || 0)}. The transfer window is open below the pitch.`, `Start season ${league.season + 1}`);
			if (rows[0].id === 0) { celebrateTrophy("league trophy"); }
		} else {
			showOverlay(stoppedJan ? "January window" : "Simulated", `${line} You're ${ordinal(pos)} on ${pts} points.${scorers}${disc}${stoppedJan ? " The January transfer window is open: sign players below the pitch, then carry on." : ""}`, "Kick off");
			$("ovSim").textContent = "Simulate match";
			$("ovSim").hidden = false;
			offerSeasonSim();
		}
		pauseBtn.textContent = "Pause";
	}
	function offerSeasonSim () {
		const b = $("ovSeason");
		if (mode !== "league" || !league || !league.club || seasonDone()) { b.hidden = true; return; }
		b.textContent = league.round < JANUARY ? "Simulate to January" : "Simulate the season";
		b.hidden = false;
	}

	// A simulated stretch of a match, minute by minute, so that what happens hangs together:
	// goals (strikers most often), bookings, the odd red, injuries and changes.
	function simEvents (from, add) {
		const goalMins = [ 0, 1 ].map(t => Array.from({ length: add[t] }, () => from + 1 + Math.floor(Math.random() * Math.max(1, 90 - from))));
		const gone = new Set();
		const onPitch = t => team(t).filter(p => !gone.has(p));
		const outfielders = t => onPitch(t).filter(p => p.role !== "gk");
		const pick = (list, w) => { const tot = list.reduce((a, p) => a + w(p), 0); let r = Math.random() * tot; for (const p of list) { r -= w(p); if (r <= 0) { return p; } } return list[list.length - 1]; };
		const minPlayers = N === 11 ? 7 : 3;
		const card = (t, m, straight) => {
			const list = outfielders(t);
			if (!list.length) { return; }
			const p = pick(list, q => ({ def: 1.6, mid: 1.2, fwd: 0.7 }[q.role] || 1));
			let red = straight;
			if (!straight) { p.yellow = (p.yellow || 0) + 1; red = p.yellow >= 2; }
			if (red && onPitch(t).length - 1 < minPlayers) { red = false; }
			const kind = straight && red ? "r" : red ? "r2" : "y";
			if (t === 0 && leagueMatch && p.name) { matchCards.push({ name: p.name, kind }); }
			logEvent(t, red ? "red" : "yellow", `${p.name || "Player"}${red ? (straight ? " (straight red)" : " (second yellow)") : ""}`, m);
			if (red) { gone.add(p); dismissed.push([ p.team, p.idx ]); }
		};
		const injury = (t, m) => {
			const list = outfielders(t);
			if (!list.length) { return; }
			const p = list[Math.floor(Math.random() * list.length)], info = rollInjury(Math.random() < 0.35);
			logEvent(t, "injury", `${p.name || "Player"} (${info.type})`, m);
			if (t === 0) {
				if (leagueMatch && p.name) { matchInjuries.push(p.name); matchInjInfo[p.name] = info; }
				const pool = subPool().filter(pl => pl.pos === p.role).concat(subPool());
				if (subsLeft > 0 && pool.length) { const saved = timeLeft; timeLeft = matchLen * (1 - m / 90); makeSub(p, pool[0], true); timeLeft = saved; } else { p.injured = true; }
			} else if (cpuSubs > 0) {
				const was = p.name, np = genPlayer(p.role, cpuOvr(clamp(Math.round(oppStrength), 1, 5)) - 3);
				p.name = np.name; p.attr = { pac: np.pac, sho: np.sho, pas: np.pas, def: np.def };
				cpuSubs--;
				logEvent(1, "sub", `${np.name} on for ${was || "the injured man"}`, m);
			}
		};
		for (let m = from + 1; m <= 90; m++) {
			for (let t = 0; t < 2; t++) {
				for (const gm of goalMins[t]) {
					if (gm !== m) { continue; }
					const list = outfielders(t);
					const sc = list.length ? pick(list, q => ({ fwd: 5, mid: 2.2, def: 0.7 }[q.role] || 1) * Math.max(0.3, A(q, "sho") / 65)) : null;
					logEvent(t, "goal", sc ? sc.name || (t === 0 ? "You" : opp.short) : "Goal", m);
					if (t === 0 && sc && sc.name) { matchGoals.push(sc.name); }
				}
				if (Math.random() < 1.6 / 90) { card(t, m, false); }
				if (Math.random() < 0.03 / 90) { card(t, m, true); }
				if (Math.random() < 0.2 / 90) { injury(t, m); }
			}
			// Fresh legs: the most tired starters make way late on.
			if ((m === 64 || m === 76) && subsLeft > 0 && league && league.club) {
				const tired = outfielders(0).filter(p => !cameOn.includes(p.name)).map(p => ({ p, pl: [ ...league.club.squad, ...league.club.bench ].find(q => q.name === p.name) })).filter(x => x.pl && fitOf(x.pl) < 75).sort((a, b) => fitOf(a.pl) - fitOf(b.pl))[0];
				const pool = tired ? subPool().filter(pl => pl.pos === tired.p.role) : [];
				if (tired && pool.length) { const saved = timeLeft; timeLeft = matchLen * (1 - m / 90); makeSub(tired.p, pool.sort((a, b) => ovrNow(b) - ovrNow(a))[0], true); timeLeft = saved; }
			}
		}
	}

	const EVENT_ICON = { goal: "⚽", yellow: "🟨", red: "🟥", injury: "✚", sub: "⇄", pen: "◎" };
	function renderReport () {
		const r = $("ovReport");
		r.replaceChildren();
		const list = matchLog.slice().sort((a, b) => a.min - b.min);
		for (const e of list) {
			const li = el("li", e.team === 0 ? "you" : "");
			const side = e.team === 0 ? "" : ` (${opp.short})`;
			li.append(el("b", "", `${e.min}'`), el("span", "ic", EVENT_ICON[e.kind] || "·"), el("span", "", `${e.text}${side}`));
			r.append(li);
		}
		r.hidden = !list.length;
	}

	// The opponent's danger man and their rock at the back.
	function keyMen () {
		if (!oppSquad.length) { return ""; }
		const fw = oppSquad.filter(q => q.pos === "fwd").sort((a, b) => b.sho - a.sho)[0];
		const df = oppSquad.filter(q => q.pos === "def").sort((a, b) => b.def - a.def)[0];
		const shapeLabel = SHAPES[fmtKey] && teamShape[1] && SHAPES[fmtKey][teamShape[1]] ? SHAPES[fmtKey][teamShape[1]].label.split(" ")[0] : "";
		const how = `They line up ${shapeLabel} and play ${STYLES[style[1]].toLowerCase()} football with a ${PRESSES[press[1]].toLowerCase()}. `;
		return (fw && df ? `Watch ${fw.name} (shooting ${fw.sho}) up front and ${df.name} (defending ${df.def}) at the back. ` : "") + how;
	}

	// The coaching loop, in words: before a match, what the opponent does and what might beat it,
	// with the state of your squad and training; after it, what the numbers say to change.
	function coachBrief () {
		const tips = [];
		if (press[1] === "high") { tips.push("They press high: going Direct, or a deep line, uses the space behind them"); }
		else if (style[1] === "possession") { tips.push("They keep the ball: a mid block and getting stuck in can rattle them"); }
		else if (style[1] === "direct" || style[1] === "counter") { tips.push("They go long and fast: a deep line takes away the ball over the top"); }
		else if (press[1] === "low") { tips.push("They sit deep: Possession and patience, or crosses for your runners"); }
		if (tackling[1] === "hard") { tips.push("they get stuck in, so expect free kicks"); }
		let squad = "";
		if (league && league.club && mode === "league") {
			const c = league.club, xi = slotsFor(league.fmt).map(i => c.squad[i]).filter(Boolean), mor = Math.round(xi.reduce((t, p) => t + (p.morale || 70), 0) / Math.max(1, xi.length));
			ensureCoaching(c, league);
			squad = ` Your eleven: morale ${mor}${mor < 50 ? " (low: a win would lift it)" : ""}, tactical familiarity ${Math.round(c.drill)}%, training ${c.training.focus} at ${c.training.load} intensity.`;
		}
		return tips.length ? `Coach: ${tips.join("; ")}.${squad} ` : squad ? `${squad.trim()} ` : "";
	}
	function coachReview () {
		const tot = possFrames[0] + possFrames[1], poss = tot ? Math.round(100 * possFrames[0] / tot) : 50, [ h, a ] = score;
		if (stats.shots <= 2 && poss >= 55) { return "Review: plenty of the ball and little end product. Try a Direct style, an Attacking tactic, or an attacking training week."; }
		if (oppStats.shots >= stats.shots + 4) { return "Review: they had too many chances. A deeper line, a Defensive tactic, or a defending week on the training ground."; }
		if ((stats.cards || 0) >= 3) { return "Review: too many cards. Ease the tackling off to Normal or Stay on feet."; }
		if (h > a) { return "Review: job done. Keep the drills going."; }
		if (h === a) { return "Review: close. One more chance would have won it: crosses and corners are worth a look."; }
		return "Review: not today. Check fitness and morale in the squad panel before the next one.";
	}

	// The first few matches carry the controls on the card itself; How to play is always there.
	function showIntro () {
		showIntroCard();
		if (state === "intro" || state === "full") { $("ovHelp").hidden = false; renderKeyStrip(); }
	}
	function showIntroCard () {
		pauseBtn.textContent = "Pause";
		if (leagueMatch) {
			const o = TEAMS[leagueMatch.opp], derby = isDerby();
			showOverlay(`Matchday ${leagueMatch.round + 1}${derby ? " · Derby" : ""}`,
				`${derby ? `Derby day: the local rivals, and the loudest crowd of the season. Both ends will sing all night. ` : ""}${o.name}, ${leagueMatch.home ? "at home" : "away"} at ${(leagueMatch.home ? YOU : o).ground}. Rated ${stars(Math.round(getStr(leagueMatch.opp)))}. ${keyMen()}${coachBrief()}Conditions: ${conditionsText()}. You kick off, attacking the goal on the right.`, "Kick off");
			$("ovSim").textContent = "Simulate match";
			$("ovSim").hidden = false;
			offerSeasonSim();
			const tired = tiredStarters();
			$("ovFix").textContent = "Rest tired players";
			if (tired.length) {
				ovText.textContent = `⚠ Fitness: ${tiredText(tired)} Tired players are slower and less sharp. Rest them: press "Rest tired players", or swap them yourself in the squad panel. ` + ovText.textContent;
				$("ovFix").hidden = false;
			}
		} else if (mode === "league" && seasonDone()) {
			const rows = standings(), pos = rows.findIndex(r => r.id === 0) + 1;
			showOverlay(`Season ${league.season} is over`,
				rows[0].id === 0 ? "You won the league." : `${TEAMS[rows[0].id].name} won the league. You finished ${ordinal(pos)}.`,
				`Start season ${league.season + 1}`);
		} else {
			if (mode === "corners") {
			showOverlay("Corner shootout", `Five corners each, taken in turn, against ${opp.name}. On yours, S whips an in-swinger at the near post, Q floats an out-swinger to the far post and W drops one on the penalty spot; your runners attack the ball and you can head it in (D at goal, S to nod it on, Q to clear). On theirs, defend: pick up a runner, win the header, or leave it to your keeper. A goal is a point; level after ten, it goes to sudden death. Nothing here counts toward your season.`, "Start the shootout");
			return;
		}
			if (mode === "tutorial") {
			showOverlay("Tutorial", "Learn the controls one step at a time. The coach at the top tells you what to do, and it moves on as soon as you've done it. The other team stands still (except when you practise tackling) and the clock doesn't run. Nothing here counts toward your season.", "Start tutorial");
			return;
		}
		const newHere = store.get("ff-tut-done") ? "" : "New here? Try the Tutorial button at the top first. ";
		showOverlay("Friendly · practice match", `${newHere}A practice match: the result doesn't count toward your season. ${keyMen()}Conditions: ${conditionsText()}. You kick off, attacking the goal on the right. Move with the arrows. S passes, W plays a through ball, D shoots, Q hits a long ball to the striker, A tackles, E sprints.`, "Kick off");
			$("ovSim").textContent = "Simulate match";
			$("ovSim").hidden = false;
		}
		ovText.textContent = (seasonDone() ? `${lv.name} difficulty. ` : `Difficulty: ${lv.name}. `) + ovText.textContent;
	}

	function makePlayers () {
		players = [];
		for (let t = 0; t < 2; t++) {
			for (let i = 0; i < N; i++) {
				const [ bx, by ] = FMT.base[i];
				players.push({
					team: t, idx: i, role: FMT.roles[i],
					bx: t === 0 ? bx : FW - bx, by,
					x: 0, y: 0, vx: 0, vy: 0, dir: t === 0 ? 0 : Math.PI,
					kickCd: 0, lunge: 0, lungeCd: 0, think: 0, hold: 0,
					num: FMT.nums[i]
				});
			}
		}
	}

	// Your squad's ratings go onto your players; everyone else plays at an even 65,
	// with the opposing club's strength coming from its rating instead.
	// A computer club's players: the same squad every time you meet them in a season,
	// better all round the stronger the club, with defenders who defend and strikers who finish.
	const cpuOvr = s => 50 + s * 7;   // rating 1 -> 57 overall, 3 -> 71, 5 -> 85
	function cpuSquad (clubId, str) {
		let h = (clubId * 7919 + (league ? league.season : 1) * 104729) % 2147483647 || 1;
		const rnd = () => { h = (h * 48271) % 2147483647; return h / 2147483647; };
		const base = cpuOvr(str);
		const sq = POS_OF_SLOT.map((pos, i) => genPlayer(pos, base + Math.round((rnd() * 2 - 1) * 4) + (i === 9 || i === 2 ? 3 : 0), null, rnd));
		// This season's signings, from the transfer windows, take their places.
		const ins = league && league.cpuIn && league.cpuIn[clubId];
		if (Array.isArray(ins)) { for (const d of ins) { if (d && d.pl && Number.isInteger(d.slot) && d.slot > 0 && d.slot < sq.length) { sq[d.slot] = { ...d.pl }; } } }
		return sq;
	}
