	/* ---------- Owner investment and the spending rules (PSR) ---------- */
	// Each summer the owner offers money on top of the club's own. Taking it lets you spend beyond your
	// income, but the league's spending rules (as the Premier League's profit and sustainability rules)
	// allow losses of at most £105m over three seasons. A season's loss is what the club spent beyond what
	// it earned: the change in the budget, not counting the owner's money. Go over and the league takes
	// points off you at the start of the next season (the Premier League took ten from Everton and four
	// from Forest). The ledger lives on the club, so it follows you through seasons and saves.
	const PSR_LIMIT = 105 / MONEY_SCALE;          // £105m over three seasons, in the game's unit (04)
	const ownerOfferFor = () => round1(1.5 + 0.35 * yourStr());   // about £40m to £65m shown
	function psrLedger (c) {
		if (!c.psr || !Array.isArray(c.psr.seasons)) { c.psr = { start: c.budget, owner: 0, seasons: [] }; }
		return c.psr;
	}
	// This season so far: spent beyond what was earned, owner money left out (negative is a loss).
	const psrThisSeason = c => { const L = psrLedger(c); return round1(c.budget - L.start - L.owner); };
	const psrThreeYear = c => round1(psrLedger(c).seasons.slice(-2).reduce((t, v) => t + v, 0) + psrThisSeason(c));

	// At the end of a season (newSeason, before any budget change for finishing low): close the season's
	// line, keep the last three, and say how many points come off if the three together lost too much.
	function psrClose (c) {
		const L = psrLedger(c);
		L.seasons = [ ...L.seasons, psrThisSeason(c) ].slice(-3);
		const loss = -L.seasons.reduce((t, v) => t + v, 0);
		if (loss <= PSR_LIMIT + 1e-9) { return 0; }
		// Four points for a small breach, up to ten for one twice the limit.
		const pts = clamp(Math.round(4 + 6 * (loss - PSR_LIMIT) / PSR_LIMIT), 4, 10);
		L.seasons = [];   // the breach is punished once; the count starts again
		return pts;
	}
	// At the start of a season: a fresh line and this summer's offer from the owner.
	function psrOpen (c) {
		const L = psrLedger(c);
		L.start = c.budget; L.owner = 0;
		league.ownerOffer = ownerOfferFor();
	}
	function ownerTake () {
		const c = league.club, amt = league.ownerOffer || 0;
		if (!amt) { return; }
		psrLedger(c).owner = round1(psrLedger(c).owner + amt);
		c.budget = round1(c.budget + amt);
		league.ownerOffer = 0;
		lastDeal = `The owner put in ${money(amt)}. Remember the spending rules: losses over three seasons are capped at ${money(PSR_LIMIT)}.`;
		saveLeague(); renderClub();
	}
	function ownerDecline () { league.ownerOffer = 0; lastDeal = "You turned down the owner's money this summer."; saveLeague(); renderClub(); }

	// The box under the transfer window's note: the owner's offer (summer only) and where you stand.
	function renderOwnerBox (c, open) {
		let box = $("ownerBox");
		if (!box) { box = el("div", "owner-box"); box.id = "ownerBox"; $("winNote").after(box); }
		box.replaceChildren();
		const three = psrThreeYear(c), loss = Math.max(0, -three);
		const line = el("p", "win-note");
		line.textContent = `Spending rules: ${loss > 0 ? `losses of ${money(loss)}` : "no losses"} over this season and the last two, of the ${money(PSR_LIMIT)} allowed.`
			+ (loss > PSR_LIMIT ? " Over the limit: unless the club earns it back before the season ends, the league takes points off you next season." : loss > PSR_LIMIT * 0.75 ? " Close to the limit." : "");
		box.append(line);
		if (open && league.round === 0 && league.ownerOffer > 0 && !seasonDone()) {
			const p = el("p", "win-note", `The owner offers ${money(league.ownerOffer)} for signings this summer.`);
			const take = el("button", "", `Take ${money(league.ownerOffer)}`); take.type = "button"; take.addEventListener("click", ownerTake);
			const no = el("button", "", "No thanks"); no.type = "button"; no.addEventListener("click", ownerDecline);
			const row = el("div", "owner-acts"); row.append(take, no);
			box.append(p, row);
		}
	}
