	/* ---------- league panel ---------- */
	function el (tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) { e.className = cls; }
		if (text !== undefined) { e.textContent = text; }
		return e;
	}

	function dotFor (t) {
		const d = el("span", "dot");
		d.style.background = t.color;
		return d;
	}

	function renderLeague () {
		const sec = $("league");
		sec.hidden = mode !== "league";
		if (!league || sec.hidden) { return; }
		const R = league.fixtures.length, done = seasonDone(), rows = standings();
		const myPos = rows.findIndex(r => r.id === 0) + 1, me = rows[myPos - 1];
		$("lgMeta").textContent = `Season ${league.season} · ${league.fmt}-a-side · ${done ? "Complete" : `Matchday ${league.round + 1} of ${R}`}`;

		const next = $("lgNext");
		next.replaceChildren();
		if (done) {
			const champ = TEAMS[rows[0].id];
			next.append(el("span", "eyebrow", `Season ${league.season} champions`));
			const name = el("div", "opp"); name.append(dotFor(champ), el("span", "", champ.name)); next.append(name);
			next.append(el("span", "detail", rows[0].id === 0
				? `That's you, with ${me.pts} point${me.pts === 1 ? "" : "s"}. Start a new season from the pitch.`
				: `You finished ${ordinal(myPos)} with ${me.pts} point${me.pts === 1 ? "" : "s"}. Start a new season from the pitch.`));
		} else {
			const f = currentFixture(), o = TEAMS[f.opp];
			next.append(el("span", "eyebrow", `Next · Matchday ${f.round + 1} · ${f.home ? "Home" : "Away"}${derbyOf(0, f.opp) ? " · Derby" : ""}`));
			const name = el("div", "opp"); name.append(dotFor(o), el("span", "", o.name)); next.append(name);
			const det = el("span", "detail");
			det.append(el("span", "stars", stars(getStr(f.opp))), document.createTextNode(` rating. You are ${ordinal(myPos)} on ${me.pts} point${me.pts === 1 ? "" : "s"}.`));
			next.append(det);
			const host = f.home ? YOU : o;
			const wn = league.wind[f.round];
			next.append(el("span", "detail", `${host.ground} · ${SURFACES[host.surface].label} · ${league.ko[f.round] === "day" ? "Afternoon" : "Night"} kick-off, ${koLabel(league.ko[f.round])} · Forecast: ${WEATHER[league.weather[f.round]].label.toLowerCase()}, ${wn.s >= 6 ? `${windWord(wn.s)} of ${wn.s} km/h` : "still air"}`));
			const tired = tiredStarters();
			if (tired.length) { next.append(el("span", "detail tiredwarn", `⚠ ${tiredText(tired)}`)); }
		}

		const list = $("lgRound");
		list.replaceChildren();
		const lastIdx = league.round - 1, last = league.results[lastIdx];
		$("lgRoundTitle").textContent = last ? `Matchday ${lastIdx + 1} results` : "Results";
		if (!last) {
			const li = el("li"); li.append(el("p", "none", "No games played yet.")); list.append(li);
		}
		for (const [ h, a, hg, ag ] of last || []) {
			const li = el("li", h === 0 || a === 0 ? "mine" : "");
			li.append(el("span", "h", TEAMS[h].short === "You" ? "You" : TEAMS[h].name), el("span", "sc", `${hg}–${ag}`), el("span", "", TEAMS[a].short === "You" ? "You" : TEAMS[a].name));
			list.append(li);
		}

		const body = $("lgBody");
		body.replaceChildren();
		rows.forEach((r, i) => {
			const t = TEAMS[r.id], tr = el("tr", r.id === 0 ? "me" : "");
			const club = el("td", "club"), cn = el("span", "cn");
			cn.append(dotFor(t), el("span", "", t.name));
			club.append(cn);
			const form = el("td", "wide"), fs = el("span", "form");
			for (const f of r.form.slice(-5)) { fs.append(el("i", f, f)); }
			form.append(fs);
			const gd = r.gf - r.ga;
			// Zones: top four Champions Cup, fifth Continental Cup, bottom three relegated.
			const zone = i < 4 ? "z-cl" : i === 4 ? "z-el" : i >= rows.length - 3 ? "z-rel" : "";
			tr.append(el("td", zone, String(i + 1)), club, el("td", "", String(r.p)), el("td", "", String(r.w)), el("td", "", String(r.d)),
				el("td", "", String(r.l)), el("td", "wide", String(r.gf)), el("td", "wide", String(r.ga)),
				el("td", "", (gd > 0 ? "+" : "") + gd), el("td", "pts", String(r.pts)), form);
			body.append(tr);
		});
		renderUpcoming();
		renderForecast();
		renderClub();
		renderClubs();
		renderShapes();
	}

	let clubsView = "div", openClub = null;
	function renderClubs () {
		const grid = $("clubGrid");
		grid.replaceChildren();
		$("clubsDiv").setAttribute("aria-pressed", String(clubsView === "div"));
		$("clubsBelow").setAttribute("aria-pressed", String(clubsView === "below"));
		const rows = standings(), posOf = new Map(rows.map((r, i) => [ r.id, i + 1 ]));
		const ids = clubsView === "div"
			? rows.map(r => r.id).filter(id => id !== 0)
			: TEAMS.map((t, i) => i).filter(i => i !== 0 && !league.members.includes(i)).sort((a, b) => getStr(b) - getStr(a));
		$("clubsNote").textContent = clubsView === "div" ? "In table order. Tap a club to see its squad." : "The clubs below, strongest first: three of them come up at the end of each season.";
		for (const id of ids) {
			const t = TEAMS[id], str = getStr(id), [ st, pr ] = cpuInstructions(id, str), sq = cpuSquad(id, str);
			const fw = sq.filter(q => q.pos === "fwd").sort((a, b) => b.sho - a.sho)[0], df = sq.filter(q => q.pos === "def").sort((a, b) => b.def - a.def)[0];
			const card = el("div", "club-card");
			card.tabIndex = 0;
			card.setAttribute("role", "button");
			card.setAttribute("aria-expanded", String(openClub === id));
			const name = el("div", "cc-name");
			name.append(dotFor(t), el("span", "", t.name));
			if (clubsView === "div") { name.append(el("span", "cc-pos", ordinal(posOf.get(id)))); }
			card.append(name);
			const l1 = el("div", "cc-line"); l1.append(el("span", "stars", stars(Math.round(str))), document.createTextNode(` · ${t.ground} (${SURFACES[t.surface].label.toLowerCase()})`)); card.append(l1);
			card.append(el("div", "cc-line", `Plays ${STYLES[st].toLowerCase()} football, ${PRESSES[pr].toLowerCase()}`));
			card.append(el("div", "cc-line", `Danger man ${fw.name} (SHO ${fw.sho}) · Rock ${df.name} (DEF ${df.def})`));
			if (openClub === id) {
				const ol = el("ol");
				sq.forEach(q => { const li = el("li"), tk = traitOf(q); li.append(el("span", "pos", POS_LABEL[q.pos]), el("span", "", q.name + (tk ? ` · ${traitName(tk)}` : "")), el("span", "", String(ovrOf(q)))); ol.append(li); });
				card.append(ol);
			}
			const toggle = () => { openClub = openClub === id ? null : id; renderClubs(); };
			card.addEventListener("click", toggle);
			card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
			grid.append(card);
		}
	}

	function renderUpcoming () {
		// Your home and away records so far.
		const rec = { h: [ 0, 0, 0 ], a: [ 0, 0, 0 ] };
		for (const round of league.results) {
			for (const [ h, a, hg, ag ] of round) {
				if (h !== 0 && a !== 0) { continue; }
				const r = h === 0 ? rec.h : rec.a, mine = h === 0 ? hg : ag, theirs = h === 0 ? ag : hg;
				r[mine > theirs ? 0 : mine === theirs ? 1 : 2]++;
			}
		}
		$("lgRecord").textContent = `Upcoming · Home W${rec.h[0]} D${rec.h[1]} L${rec.h[2]} · Away W${rec.a[0]} D${rec.a[1]} L${rec.a[2]}`;
		const ol = $("lgUpcoming");
		ol.replaceChildren();
		for (let r = league.round; r < Math.min(league.fixtures.length, league.round + 5); r++) {
			const pair = league.fixtures[r].find(([ a, b ]) => a === 0 || b === 0), home = pair[0] === 0, o = TEAMS[home ? pair[1] : pair[0]];
			const li = el("li", r === league.round ? "now" : "");
			li.append(el("b", "", String(r + 1)), el("span", home ? "ha h" : "ha a", home ? "H" : "A"), dotFor(o), el("span", "who", o.name + (derbyOf(0, home ? pair[1] : pair[0]) ? " (derby)" : "")), el("span", "stars", stars(Math.round(getStr(home ? pair[1] : pair[0])))));
			ol.append(li);
		}
	}

	function renderForecast () {
		const ol = $("lgForecast");
		ol.replaceChildren();
		// The next ten matchdays.
		league.weather.forEach((w, r) => {
			if (r < league.round || r >= league.round + 10) { return; }
			const li = el("li", `fc-${w}${r === league.round ? " now" : ""}${r < league.round ? " past" : ""}${isRainy(r) ? " wet-season" : ""}`);
			const wn = league.wind[r], ko = league.ko[r];
			li.append(el("b", "", String(r + 1)), el("span", "", w === "clear" ? "Dry" : w === "rain" ? "Rain" : "Heavy"), el("span", "fc-ko", `${ko === "day" ? "☀" : "☾"}${wn.s >= 20 ? "≈" : ""}`));
			li.title = `Matchday ${r + 1}: ${WEATHER[w].label}, wind ${wn.s} km/h, ${ko === "day" ? "afternoon" : "night"} kick-off`;
			ol.append(li);
		});
	}

	// The player card: a five-axis radar (pace, shooting, passing, defending and physical; physical is
	// read from his defending, pace, age and build) with his form, morale, traits, age, nation and contract.
	function physicalOf (pl, e) {
		return Math.round(clamp(0.45 * e.def + 0.35 * e.pac + 22 - Math.max(0, (pl.age || 25) - 30) * 2 + (pl.trait === "target" ? 8 : 0) + (pl.pos === "gk" ? 6 : 0), 30, 99));
	}
	function playerCard (pl, e) {
		const NS = "http://www.w3.org/2000/svg", mk = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) { n.setAttribute(k, a[k]); } return n; };
		const axes = [ [ "PAC", e.pac ], [ "SHO", e.sho ], [ "PAS", e.pas ], [ "DEF", e.def ], [ "PHY", physicalOf(pl, e) ] ];
		const cx = 100, cy = 80, R = 50, pt = (k, r) => { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; return [ cx + Math.cos(a) * r, cy + Math.sin(a) * r ]; };
		const svg = mk("svg", { viewBox: "0 0 200 150", role: "img", "aria-label": `${pl.name}: ${axes.map(([ k, v ]) => `${k} ${v}`).join(", ")}` });
		for (const f of [ 0.25, 0.5, 0.75, 1 ]) { svg.append(mk("polygon", { class: "rd-grid", points: axes.map((x, k) => pt(k, R * f).map(v => v.toFixed(1)).join(",")).join(" ") })); }
		axes.forEach((x, k) => { const [ x2, y2 ] = pt(k, R); svg.append(mk("line", { class: "rd-grid", x1: cx, y1: cy, x2: x2.toFixed(1), y2: y2.toFixed(1) })); });
		svg.append(mk("polygon", { class: "rd-shape", points: axes.map(([ , v ], k) => pt(k, R * clamp(v, 0, 99) / 99).map(q => q.toFixed(1)).join(",")).join(" ") }));
		axes.forEach(([ k, v ], i) => {
			const [ lx, ly ] = pt(i, R + 12), anchor = Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end";
			const t = mk("text", { class: "rd-lbl", x: lx.toFixed(1), y: (ly + (i === 0 ? -2 : 3)).toFixed(1), "text-anchor": anchor });
			t.textContent = k + " ";
			const tv = mk("tspan", { class: "rd-val" }); tv.textContent = String(v); t.append(tv);
			svg.append(t);
		});
		const card = el("div", "pl-card"), info = el("div", "pc-info"), name = el("div", "pc-name");
		const fa = formAvg(pl), fb = formBonus(pl);
		if (fa !== null) { const fm = el("span", "formarrow " + (fb > 0 ? "up" : fb < 0 ? "down" : "flat"), fb > 0 ? "▲" : fb < 0 ? "▼" : "▶"); fm.title = `Form ${fa.toFixed(1)}`; name.append(fm); }
		name.append(document.createTextNode(`${pl.name} · ${POS_LABEL[pl.pos]}`));
		const m = pl.morale, face = m >= 75 ? "😄" : m >= 55 ? "🙂" : m >= 40 ? "😐" : "🙁";
		const mood = el("div"); mood.append(el("span", "pc-face", face), document.createTextNode(`Morale ${m}${fa !== null ? ` · form ${fa.toFixed(1)}` : ""}`));
		const badges = el("div", "pc-badges");
		for (const k of [ pl.trait ].filter(Boolean)) { const tg = el("span", "trait", traitName(k)); tg.title = TRAITS[k][1]; badges.append(tg); }
		if (!badges.childElementCount) { badges.append(el("span", "", "No special trait")); }
		info.append(name, mood, badges, el("div", "", `${pl.age} years old · ${NATIONS[pl.nat][0]}`), el("div", "", `Contract: ${pl.contract} season${pl.contract === 1 ? "" : "s"} left`));
		card.append(svg, info);
		return card;
	}

	function renderClub () {
		const c = league.club;
		const open = windowOpen(), five = league.fmt !== "11", used = slotsFor(league.fmt);
		const sq = $("sqBody");
		sq.replaceChildren();
		let sum = 0, n = 0;
		const row = (pl, list, i) => {
			const slotPos = list === "squad" ? roleOfSlot(league.fmt, i) : null;
			const onPitch = list === "squad" && used.includes(i);
			const e = effective(pl), o = ovrNow(pl);
			if (onPitch) { sum += matchOvr(pl, slotPos); n++; }
			const sel = picked && picked.list === list && picked.i === i;
			const tr = el("tr", [ onPitch ? "" : "bench", sel ? "sel" : "" ].join(" ").trim());
			const nameTd = el("td", "club"), btn = el("button", "pick", pl.name);
			btn.type = "button";
			btn.setAttribute("aria-pressed", String(!!sel));
			btn.addEventListener("click", () => pickPlayer(list, i));
			nameTd.append(btn);
			if (slotPos && slotPos !== pl.pos) { nameTd.append(el("span", "oop", `as ${POS_LABEL[slotPos]}`)); }
			if (pl.inj > 0) { nameTd.append(el("span", "inj", `✚ ${injLabel(pl)}out ${pl.inj} game${pl.inj === 1 ? "" : "s"}`)); }
			else if (fitOf(pl) < TIRED) { nameTd.append(el("span", "oop", "▽ tired")); }
			if (pl.ban > 0) { nameTd.append(el("span", "inj", `suspended · ${pl.ban} game${pl.ban === 1 ? "" : "s"}`)); }
			else if (pl.ycount > 0) { nameTd.append(el("span", "oop", `${pl.ycount} yellow${pl.ycount === 1 ? "" : "s"}`)); }
			if (pl.goals > 0) { nameTd.append(el("span", "gls", `${pl.goals} goal${pl.goals === 1 ? "" : "s"}`)); }
			ensurePlayer(pl);
			if (pl.trait) { const tg = el("span", "trait", traitName(pl.trait)); tg.title = TRAITS[pl.trait][1]; nameTd.append(tg); }
			{
				const fa = formAvg(pl), fb = formBonus(pl);
				if (fa !== null) {
					const fm = el("span", "formarrow " + (fb > 0 ? "up" : fb < 0 ? "down" : "flat"), fb > 0 ? "▲" : fb < 0 ? "▼" : "▶");
					fm.title = `Form: ${pl.form.join(", ")} (average ${fa.toFixed(1)})${fb ? `, ${fb > 0 ? "+" : ""}${fb} to his ratings` : ""}`;
					fm.setAttribute("aria-label", fm.title);
					nameTd.prepend(fm);
				}
			}
			nameTd.append(el("span", "meta", `${pl.age} · ${pl.nat}`));
			if (pl.morale < 45) { nameTd.append(el("span", "inj", "unhappy")); }
			if (pl.adapt > 0) { nameTd.append(el("span", "oop", "settling in")); }
			if (pl.contract <= 1) { nameTd.append(el("span", "oop", "last year")); }
			const more = el("button", "more", openPl === pl.name ? "▴" : "⋯");
			more.type = "button"; more.title = "Contract, role and morale"; more.setAttribute("aria-expanded", String(openPl === pl.name));
			more.addEventListener("click", ev => { ev.stopPropagation(); openPl = openPl === pl.name ? null : pl.name; renderClub(); });
			nameTd.append(more);
			const pc = el("td", "club"); pc.append(el("span", "pos", POS_LABEL[pl.pos]));
			const fitTd = el("td"), bar = el("span", "fitbar"), fill = el("i"), fv = fitOf(pl);
			fill.style.width = fv + "%";
			fill.className = fv >= 80 ? "ok" : fv >= 60 ? "mid" : "low";
			bar.append(fill);
			bar.title = `Fitness ${fv}`;
			fitTd.append(bar);
			tr.append(el("td", "", list === "squad" ? String(FORMATS["11"].nums[i]) : "–"), nameTd, pc, fitTd,
				el("td", "wide", String(e.pac)), el("td", "wide", String(e.sho)), el("td", "wide", String(e.pas)), el("td", "wide", String(e.def)), el("td", "ovr", String(o)));
			sq.append(tr);
			if (openPl === pl.name) {
				const dr = el("tr", "detail"), td = el("td");
				td.colSpan = 9;
				const role = roleOf(pl, c), box = el("div", "pl-detail");
				box.append(playerCard(pl, e));
				box.append(el("span", "", `${NATIONS[pl.nat][0]}, ${pl.age} · potential ${Math.round(pl.pot)} · value ${money(valueOf(pl))} · ${wageWeek(wageOf(pl))} · ${pl.contract} season${pl.contract === 1 ? "" : "s"} left · morale ${pl.morale}${pl.adapt > 0 ? ` · settling in (${Math.ceil(pl.adapt)} more games)` : ""}`));
				const rs = el("select"); rs.setAttribute("aria-label", `Squad role for ${pl.name}`);
				for (const [ k, v ] of [ [ "", `Role: ${ROLES[role]} (auto)` ], ...Object.entries(ROLES).map(([ k2, v2 ]) => [ k2, `Role: ${v2}` ]) ]) { const o2 = el("option", "", v); o2.value = k; rs.append(o2); }
				rs.value = pl.role || "";
				rs.addEventListener("change", () => setRole(pl.name, rs.value));
				box.append(rs);
				const rn = el("button", "", `New contract (${money(round1(valueOf(pl) * 0.15))})`); rn.type = "button";
				rn.disabled = pl.contract >= 4; rn.addEventListener("click", () => renewPlayer(pl.name)); box.append(rn);
				if (list === "bench") { const rl = el("button", "", `Release (pay-off ${money(Math.round(wageOf(pl) * pl.contract * 0.5 * 1000) / 1000)})`); rl.type = "button"; rl.addEventListener("click", () => releasePlayer(pl.name)); box.append(rl); }
				if (typeof sellButton === "function") { const sb = sellButton(pl); if (sb) { box.append(sb); } }
				td.append(box); dr.append(td); sq.append(dr);
			}
		};
		const group = t => { const tr = el("tr", "grp"), td = el("td", "", t); td.colSpan = 9; tr.append(td); sq.append(tr); };
		group(five ? `Starting ${league.fmt === "6" ? "six" : "five"}, ${shapeOf(league.fmt).label} (greyed players sit out)` : `Starting eleven, ${shapeOf(league.fmt).label}`);
		c.squad.forEach((pl, i) => row(pl, "squad", i));
		group(`Bench (${c.bench.length} of ${BENCH})`);
		c.bench.forEach((pl, i) => row(pl, "bench", i));
		const ar = $("autoRot"), on = !!c.autoRotate;
		ar.textContent = on ? "Auto-rotate on" : "Auto-rotate off";
		ar.setAttribute("aria-pressed", String(on));
		const tiredN = tiredStarters().length;
		renderLineup();
		$("sqMeta").textContent = picked ? "Now tap who to swap with" : `Match strength ${Math.round(sum / Math.max(1, n))}${tiredN ? ` · ⚠ ${tiredN} starter${tiredN === 1 ? "" : "s"} tired` : ""}`;

		$("winBudget").textContent = money(c.budget);
		$("winBudget").title = `Wage bill ${money(squadWages(c))} a season${c.week ? `; last matchday wages ${money(c.week.wages)}, gate ${money(c.week.gate)}` : ""}`;
		$("winTitle").textContent = open ? "Transfer window: open" : "Transfer window: closed";
		if (typeof renderAssistNote === "function") { renderAssistNote(); }
		const notes = [];
		if (lastDeal) { notes.push(lastDeal); }
		if (open) {
			notes.push(seasonDone() ? "Sign players and upgrade the club before next season."
				: league.round === JANUARY ? "January window: open until matchday 20 kicks off." : "Open until your first match of the season.");
			if (league.news && league.round === 0) { notes.push(league.news); }
		} else {
			notes.push(league.round < JANUARY ? "It opens again in January, before matchday 20." : "It opens again when the season ends. Prize money depends on where you finish.");
		}
		notes.push(`Wage bill ${money(squadWages(c))} a season; home gates bring in about ${money(0.05 + 0.015 * yourStr())} each.`);
		if (c.budget < 0) { notes.push("You're in the red: the board has frozen signings until the budget is back above zero."); }
		$("winNote").textContent = notes.join(" ");

		const mk = $("winMarket");
		mk.replaceChildren();
		mk.hidden = !open;
		const tabs = $("mkTabs");
		tabs.replaceChildren();
		tabs.hidden = !open;
		for (const [ key, m ] of [ [ "foryou", { label: "For you" } ], [ "all", { label: "All" } ], ...Object.entries(MARKETS) ]) {
			const b = el("button", "", m.label); b.type = "button"; b.setAttribute("aria-pressed", String(mkTab === key));
			b.addEventListener("click", () => { mkTab = key; renderClub(); });
			tabs.append(b);
		}
		$("mkScout").textContent = open ? `${needsLine(c)} Scouting: ${c.scoutLeft || 0} report${c.scoutLeft === 1 ? "" : "s"} left this window${staffLvl(c, "scout") ? "" : " (hire a chief scout for more, and sharper estimates)"}` : "";
		// For you: the shortlist, best gain first, with one-click buying and scouting above it.
		const acts = $("mkActions");
		acts.replaceChildren();
		acts.hidden = !open;
		const shortlist = mkTab === "foryou" ? assistShortlist(c) : null;
		if (open) {
			const buy = el("button", "", "Sign the best for me"); buy.type = "button"; buy.title = "The assistant signs up to two known step-ups at the asking price, keeping money for wages";
			buy.disabled = c.budget < 0; buy.addEventListener("click", () => assistBuy());
			const sc = el("button", "", "Scout the shortlist"); sc.type = "button"; sc.title = "Spend this window's reports on the shortlist, best first";
			sc.disabled = !(c.scoutLeft > 0) || !assistShortlist(c).some(x => x.est); sc.addEventListener("click", () => scoutShortlist());
			acts.append(buy, sc);
		}
		const entries = shortlist ? shortlist.map(x => [ c.market[x.i], x.i, x ]) : c.market.map((pl, i) => [ pl, i, null ]).filter(([ pl ]) => mkTab === "all" || (pl.region || "home") === mkTab);
		entries.forEach(([ pl, i, pick ]) => {
			ensurePlayer(pl);
			const ask = askOf(pl), tgt = signingTarget(pl.pos), out = tgt.out, rr = ratingRange(pl), ok = permitOk(pl), talks = pl.bids >= 0 || pl.bids === undefined;
			const li = el("li");
			li.append(el("span", "pos", POS_LABEL[pl.pos]), el("span", "who", `${pl.name} · ${pl.age} · ${pl.nat}${pl.trait ? ` · ${traitName(pl.trait)}` : ""}`));
			const btns = el("span", "bids");
			const b = el("button", "", `Bid ${money(ask)}`);
			b.type = "button"; b.disabled = !ok || !talks || c.budget + 1e-9 < ask || c.budget < 0;
			b.addEventListener("click", () => bidFor(i, false));
			const b2 = el("button", "", `Offer ${money(round1(ask * 0.8))}`);
			b2.type = "button"; b2.disabled = !ok || !talks || c.budget + 1e-9 < round1(ask * 0.8) || c.budget < 0; b2.title = "A cheeky bid: they may accept, or turn it down and raise the price";
			b2.addEventListener("click", () => bidFor(i, true));
			btns.append(b, b2);
			if (!pl.scouted && rr) { const b3 = el("button", "", "Scout"); b3.type = "button"; b3.disabled = !(c.scoutLeft > 0); b3.addEventListener("click", () => scoutPlayer(i)); btns.append(b3); }
			li.append(btns);
			li.append(el("span", "ratings", rr ? `OVR about ${rr[0]}–${rr[1]} · not scouted` : `OVR ${ovrOf(pl)} · PAC ${pl.pac} SHO ${pl.sho} PAS ${pl.pas} DEF ${pl.def} · potential ${Math.round(pl.pot)}`));
			const m = MARKETS[pl.region];
			li.append(el("span", "swap", `${pl.from ? `${pl.from}, ` : ""}${m ? m.label : "Home"}${m && m.permit ? (ok ? " · work permit: yes" : ` · work permit: refused (needs ${PERMIT_OVR}+)`) : ""}${m && m.adapt ? ` · settles in about ${Math.max(0, Math.ceil(m.adapt - staffLvl(c, "scout") * 0.5))} games` : ""}${!talks ? " · talks broken off" : ""}`));
			li.append(el("span", "swap", out ? `Replaces ${out.name} (${ovrNow(out)}), sold for ${money(round1(priceOf(out) * 0.5))}` : "Joins your bench"));
			if (pick) { li.append(el("span", "swap gain", `+${pick.gain} on ${pick.weak.name} (${pick.weakOvr})${pick.est ? " by the estimate: scout him to be sure" : ""}`)); }
			mk.append(li);
		});
		if (open && !entries.length) { const li = el("li"); li.append(el("span", "swap", shortlist ? "Nobody on the list would improve the eleven right now: try the other tabs, or wait for the next window." : "Nobody left on the list this window.")); mk.append(li); }

		renderCoaching();
		renderBids();
		const ups = $("winUpgrades");
		ups.replaceChildren();
		for (const u of UPGRADES) {
			const lv = c.upgrades[u.key] || 0, li = el("li");
			const pips = el("span", "pips");
			for (let k = 0; k < 3; k++) { pips.append(el("i", k < lv ? "on" : "")); }
			li.append(pips, el("span", "who", u.name));
			const b = el("button", "", lv >= 3 ? "Maxed" : `Build ${money(u.costs[lv])}`);
			b.type = "button";
			b.disabled = !open || lv >= 3 || c.budget + 1e-9 < u.costs[lv];
			b.addEventListener("click", () => buyUpgrade(u.key));
			li.append(b, el("span", "eff", `${u.effect}, per level`));
			ups.append(li);
		}
	}

	// The week after a league match: morale follows results and minutes, new signings settle in,
	// wages go out and, after a home game, the gate money comes in.
	function weeklyClub (lm, gf, ga) {
		const c = league.club, played = new Set([ ...team(0).map(p => p.name), ...wentOff ]);
		const res = gf > ga ? 3 : gf < ga ? -3 : 0;
		for (const pl of [ ...c.squad, ...c.bench ]) {
			ensurePlayer(pl);
			const on = played.has(pl.name), role = roleOf(pl, c);
			let d = res + (on ? 1.5 : { key: -4, first: -2, rotation: -0.5, prospect: 0 }[role]);
			if (on && matchGoals.includes(pl.name)) { d += 2 * matchGoals.filter(n => n === pl.name).length; }
			if (pl.contract <= 1 && role === "key") { d -= 1; }
			pl.morale = clamp(Math.round(pl.morale + d + (65 - pl.morale) * 0.04), 5, 100);
			if (Number.isFinite(lastRatings[pl.name])) { pl.form = [ ...(Array.isArray(pl.form) ? pl.form : []), lastRatings[pl.name] ].slice(-5); }
			if (pl.adapt > 0) { pl.adapt = Math.max(0, pl.adapt - (on ? 1 : 0.5)); }
		}
		const wages = squadWages(c) / SEASON_ROUNDS, gate = lm.home ? 0.05 + 0.015 * yourStr() : 0;
		c.budget = Math.round((c.budget - wages + gate) * 1000) / 1000;
		c.week = { wages: Math.round(wages * 1000) / 1000, gate: Math.round(gate * 1000) / 1000 };
		if (typeof weeklyCoaching === "function") { weeklyCoaching(lm, played); }
	}
	// A youngster from the academy, for when a position would otherwise be empty.
	function youthPlayer (pos) {
		const pl = genPlayer(pos, 50 + Math.floor(Math.random() * 6));
		pl.age = 17 + Math.floor(Math.random() * 2); pl.pot = 66 + Math.floor(Math.random() * 18); pl.contract = 3; pl.role = "prospect"; pl.nat = natsOf("home")[Math.floor(Math.random() * 4)];
		return pl;
	}
	// Eleven starters and a bench of at most seven, a keeper among them: fill any gap from the academy.
	function refillSquad (c, pick = true) {
		const pool = [ ...c.squad, ...c.bench ].filter(Boolean);
		if (!pool.some(p => p.pos === "gk")) { pool.push(youthPlayer("gk")); }
		const want = POS_OF_SLOT.length + 5;   // eleven and at least five on the bench
		while (pool.length < want) { const pos = [ "def", "mid", "fwd", "def", "mid" ][pool.length % 5]; pool.push(youthPlayer(pos)); }
		c.squad = pool.slice(0, POS_OF_SLOT.length); c.bench = pool.slice(POS_OF_SLOT.length, POS_OF_SLOT.length + BENCH);
		if (pick) { autoPick(false, true); }   // not while a save is still being loaded
	}
	// Careers end. Outfield players may hang up their boots from 34 and all have by 38; keepers last
	// two years longer. One-year deals only from 33 (keepers 35), and none in a player's last season.
	const KEEPER_EXTRA = 2;
	const retireFrom = pl => 34 + (pl.pos === "gk" ? KEEPER_EXTRA : 0);
	const retireBy = pl => 38 + (pl.pos === "gk" ? KEEPER_EXTRA : 0);
	const oneYearOnly = pl => pl.age >= 33 + (pl.pos === "gk" ? KEEPER_EXTRA : 0);
	const lastSeason = pl => pl.age >= retireBy(pl) - 1;
	function retireChance (pl) { return pl.age >= retireBy(pl) ? 1 : pl.age < retireFrom(pl) ? 0 : (pl.age - retireFrom(pl) + 1) * 0.25; }
	// Who retires now: everyone past the last age, and (in the summer) some of those approaching it.
	// Returns the names with their ages; the academy fills any gap.
	function retireVeterans (c, summer, pick = true) {
		const out = [];
		for (const pl of [ ...c.squad, ...c.bench ]) {
			ensurePlayer(pl);
			if (pl.age >= retireBy(pl) || (summer && Math.random() < retireChance(pl))) { out.push(pl); }
		}
		if (!out.length) { return []; }
		c.squad = c.squad.filter(p => !out.includes(p)); c.bench = c.bench.filter(p => !out.includes(p));
		refillSquad(c, pick);
		return out.map(p => `${p.name} (${p.age})`);
	}
	// A new season: everyone is a year older and a year closer to the end of his contract; the
	// veterans may retire; whoever's contract has run out leaves on a free.
	function rolloverClub (c) {
		const gone = [], kept = [];
		for (const pl of [ ...c.squad, ...c.bench ]) { ensurePlayer(pl); pl.age++; }
		c.retired = retireVeterans(c, true);
		for (const pl of [ ...c.squad, ...c.bench ]) {
			pl.contract--;
			if (pl.contract > 0) { continue; }
			// Out of contract: a happy player under 34 signs on for two more at a little more money; the rest go.
			if (pl.morale >= 50 && pl.age < 34) { pl.contract = oneYearOnly(pl) ? 1 : 2; pl.wage = Math.round(wageOf(pl) * 1.1 * 1000) / 1000; kept.push(pl.name); } else { gone.push(pl.name); }
		}
		if (gone.length) { c.squad = c.squad.filter(p => !gone.includes(p.name)); c.bench = c.bench.filter(p => !gone.includes(p.name)); }
		if (gone.length || c.bench.length < 5) { refillSquad(c); }
		c.resigned = kept;
		return gone;
	}
	// The deal itself: a signing-on fee, a rise, two more seasons (five at most). Shared by the Renew
	// button and the assistant; says why when he won't or the club can't.
	function renewDeal (pl, c) {
		const fee = round1(valueOf(pl) * 0.15);
		if (lastSeason(pl)) { return { ok: false, why: `${pl.name} (${pl.age}) is retiring at the end of the season; there's no new deal to offer.` }; }
		if (pl.morale < 40) { return { ok: false, why: `${pl.name} won't talk about a new contract while he's unhappy (morale ${pl.morale}).` }; }
		if (c.budget + 1e-9 < fee) { return { ok: false, why: `A new deal for ${pl.name} needs a ${money(fee)} signing-on fee.` }; }
		c.budget = round1(c.budget - fee);
		pl.wage = Math.round(wageOf(pl) * (roleOf(pl, c) === "key" ? 1.2 : 1.1) * 1000) / 1000;
		pl.contract = oneYearOnly(pl) ? Math.min(2, pl.contract + 1) : Math.min(5, pl.contract + 2);   // veterans: one more season at a time
		pl.morale = clamp(pl.morale + 8, 0, 100);
		return { ok: true, fee, why: `${pl.name} signs a new contract to ${pl.contract} seasons (${money(fee)} signing-on, ${wageWeek(pl.wage)}).` };
	}
	function renewPlayer (name) {
		const c = league.club, pl = [ ...c.squad, ...c.bench ].find(q => q.name === name);
		if (!pl) { return; }
		lastDeal = renewDeal(pl, c).why;
		afterClubChange();
	}
	function releasePlayer (name) {
		const c = league.club, i = c.bench.findIndex(q => q.name === name);
		if (i < 0) { return; }
		const pl = c.bench[i], pay = Math.round(wageOf(pl) * pl.contract * 0.5 * 1000) / 1000;
		c.bench.splice(i, 1);
		c.budget = Math.round((c.budget - pay) * 1000) / 1000;
		openPl = null;
		lastDeal = `${pl.name} released; his contract was paid off for ${money(pay)}.`;
		afterClubChange();
	}
	function setRole (name, role) {
		const pl = [ ...league.club.squad, ...league.club.bench ].find(q => q.name === name);
		if (!pl) { return; }
		pl.role = ROLES[role] ? role : "";
		saveLeague(); renderClub();
	}
	let openPl = null;   // whose details are open in the squad table

