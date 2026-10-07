	/* ---------- fouls, free kicks, penalties ---------- */
	// A foul by `off` on `vic`: a free kick where it happened, or a penalty in the box.
	// From behind it's likely a yellow card and sometimes an injury.
	function commitFoul (off, vic, behind) {
		if (state !== "play" || setPiece || tut || inHands(vic)) { return; }
		if (shoot) { if (shoot.live) { sfx("whistle"); shootEnd(off.team === shoot.att ? "Foul by the attacker" : "Foul in the box: no goal, retaken next round"); } return; }
		const t = vic.team;
		crowdReact("foul", off.team);
		// Cards, as the laws have them: reckless (mostly from behind) is a yellow, a second
		// yellow is a red, and a really bad one from behind is a straight red.
		// (Keepers are booked but not sent off here: there is no sub to put in goal.)
		let card = "", red = false;
		const mark = kind => { if (off.team === 0 && off.name && leagueMatch) { matchCards.push({ name: off.name, kind }); } };
		if (behind && off.role !== "gk" && Math.random() < 0.08) { red = true; card = "Straight red card"; mark("r"); }
		else if (Math.random() < (behind ? 0.5 : 0.1)) {
			off.yellow = (off.yellow || 0) + 1;
			if (off.yellow >= 2 && off.role !== "gk") { red = true; card = "Second yellow, red card"; mark("r2"); }
			else { card = "Yellow card"; mark("y"); }
		}
		// A side can't be reduced below the minimum the laws allow (seven in the full game).
		if (red && team(off.team).length - 1 < (N === 11 ? 7 : 3)) { red = false; card = "Yellow card, last warning"; matchCards = matchCards.filter(c => !(c.name === off.name && c.kind !== "y")); }
		let hurt = false, serious = false;
		const rough = { hard: 1.6, normal: 1, careful: 0.6 }[tackling[off.team]] || 1;
		if (!vic.injured && Math.random() < (behind ? 0.2 : 0.05) * rough) {
			hurt = true;
			serious = Math.random() < (behind ? 0.42 : 0.22) * (rough > 1 ? 1.25 : 1) && !tut && !shoot;
			noteInjury(vic, rollInjury(serious));
		}
		burst(off.x, off.y, card ? card.split(":")[0] : "Foul");
		benchReact("foul", { fouled: t, offender: off.team, card: !!card, red });   // the touchline cam: the fouled side's manager lets the referee know
		vic.fall = FALL_T; vic.vx = vic.vy = 0;
		ev3d("foul");
		{ const s = off.team === 0 ? stats : oppStats; s.fouls = (s.fouls || 0) + 1; if (card) { s.cards = (s.cards || 0) + 1; } }
		sfx("foul");
		const inBox = inAttackBox(vic) && Math.abs(vic.x - attackX(t)) < FMT.box + 20;
		const who = off.name ? ` by ${off.name}` : "";
		let hurtText = hurt ? (serious ? `${vic.name || "He"} is badly hurt (${vic.injInfo.type}).` : `${vic.name || "He"} is hurt and limping (${vic.injInfo.type}).${t === 0 && subsLeft > 0 ? " Press Subs to bring someone on." : ""}`) : "";
		if (hurt && !serious && t === 1 && cpuSubs > 0) {
			const was = vic.name, np = genPlayer(vic.role, cpuOvr(clamp(Math.round(oppStrength), 1, 5)) - 3);
			vic.name = np.name; vic.attr = { pac: np.pac, sho: np.sho, pas: np.pas, def: np.def }; vic.injured = false; vic.yellow = 0;
			cpuSubs--;
			hurtText = `${was || "Their man"} is hurt: ${opp.short} bring on ${np.name}.`;
			setTimeout(() => { caption("Substitution", "sub", np.name, `${opp.short} · off: ${was || "injured"}`, 1); subBoard(1, vic); }, 2600);
			logEvent(1, "sub", `${np.name} on for ${was || "the injured man"}`);
		}
		const extra = [ card ? `${card}${who}.` : `Foul${who}.`, red ? `${off.team === 0 ? "You're" : `${opp.short} are`} down to ${team(off.team).length - 1} men.` : "", hurtText ].filter(Boolean).join(" ");
		if (card) { logEvent(off.team, red ? "red" : "yellow", `${off.name || "Player"}${red ? ` (${card.toLowerCase()})` : ""}`); }
		if (card) { caption(red ? (card.startsWith("Second") ? "Second yellow" : "Red card") : "Yellow card", red ? "red" : "yellow", off.name || (off.team === 0 ? "You" : opp.short), `${off.team === 0 ? "You" : opp.short} · ${minuteNow()}'`, off.team); }
		if (inBox) { logEvent(t, "pen", `Penalty won by ${vic.name || "Player"}`); }
		// A soft one (obstruction rather than a kick) is an indirect free kick.
		if (inBox) { awardPenalty(t, vic); } else { awardFreeKick(t, vic, { indirect: !card && !behind && Math.random() < 0.15 }); }
		if (red) { sendOff(off); }
		if (serious && players.includes(vic)) {
			// The kick waits for the stretcher.
			const sp = setPiece, w = freeze;
			startStretcher(vic, () => { if (sp && players.includes(sp.taker)) { freeze = Math.max(freeze, Math.min(w, 45)); } });
		}
		$("announce").textContent = `${inBox ? "Penalty" : "Free kick"} to ${t === 0 ? "you" : opp.name}. ${extra}`;
		if (card || hurt) { showFoulNote(extra, t); }
		updateSubsBtn();
	}

	// Off he goes: out of the match, and his side plays on a man short.
	function sendOff (p) {
		const i = players.indexOf(p);
		if (i < 0) { return; }
		const cur = players[ctrl];
		if (ball.owner === p) { ball.owner = null; }
		if (receiver === p) { receiver = null; }
		players.splice(i, 1);
		lastPass = { from: null, to: null };
		dismissed.push([ p.team, p.idx ]);
		ctrl = players.indexOf(cur);
		if (ctrl < 0) {   // it was the man you had: take the nearest teammate to the ball
			const mates = outfield(0);
			ctrl = players.indexOf(ball ? mates.reduce((a, b) => (dist(a, ball) < dist(b, ball) ? a : b)) : mates[0]);
		}
		burst(p.x, p.y, "Sent off");
	}

