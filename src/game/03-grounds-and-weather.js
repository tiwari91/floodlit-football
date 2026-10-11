	/* ---------- grounds and weather ---------- */
	// roll: rolling friction per frame; grip: how fast players change direction;
	// bounce: what a landing ball keeps; land: pace kept on landing.
	const SURFACES = {
		grass: { label: "Grass", roll: 0.985, speed: 1, grip: 0.22, bounce: 0.35, land: 0.8 },
		mud: { label: "Muddy", roll: 0.977, speed: 0.94, grip: 0.19, bounce: 0.14, land: 0.6 },
		turf: { label: "Artificial turf", roll: 0.988, speed: 1.02, grip: 0.24, bounce: 0.5, land: 0.88 }
	};
	// Rain makes grass and turf skid on but makes mud heavier; it costs grip and keepers' handling.
	const WEATHER = {
		clear: { label: "Clear", wet: 0, speed: 1, grip: 1, handling: 1 },
		rain: { label: "Rain", wet: 1, speed: 0.98, grip: 0.86, handling: 0.88 },
		heavy: { label: "Heavy rain", wet: 2, speed: 0.96, grip: 0.76, handling: 0.78 },
		windy: { label: "Windy", wet: 0, speed: 1, grip: 1, handling: 1, gust: 34 }
	};
	// Wind: km/h and the way it blows, as an angle in pitch coordinates (0 blows towards the goal
	// on the right, the one you attack first). It pushes the ball only while it is in the air.
	const windWord = s => (s >= 30 ? "a gale" : s >= 20 ? "a strong wind" : s >= 10 ? "a breeze" : "a light breeze");
	let cond = null;   // this match's combined surface + weather
	function makeConditions (surfaceKey, weatherKey, wind, ko) {
		const sf = SURFACES[surfaceKey] || SURFACES.grass, w = WEATHER[weatherKey] || WEATHER.clear;
		// Standing water holds the ball up on every surface, and mud most of all.
		const roll = Math.min(0.992, Math.max(0.968, sf.roll - (surfaceKey === "mud" ? 0.003 : 0.0016) * w.wet));   // runs at load, before clamp exists
		const wd = wind && Number.isFinite(wind.s) ? wind : { s: w.gust || 0, a: w.gust ? (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8 : 0 };
		const ws = Math.round(Math.min(50, Math.max(0, wd.s))), wa = Number.isFinite(wd.a) ? wd.a : 0, wk = 0.0006 * ws * (S || 1.7);
		return {
			wind: { s: ws, a: wa, ax: Math.cos(wa) * wk, ay: Math.sin(wa) * wk }, ko: ko === "day" ? "day" : "night",
			surfaceKey: SURFACES[surfaceKey] ? surfaceKey : "grass", weatherKey: WEATHER[weatherKey] ? weatherKey : "clear",
			roll, speed: sf.speed * w.speed, grip: sf.grip * w.grip, bounce: sf.bounce * (1 - 0.15 * w.wet),
			land: sf.land * (1 - 0.06 * w.wet), handling: w.handling, wet: w.wet,
			// Passes are hit harder on a slow pitch and softer on a quick one, but not all the way.
			passComp: Math.pow((1 - roll) / 0.015, 0.8),
			label: `${w.wet || ws < 20 ? (weatherKey === "windy" ? "Clear" : w.label) : "Windy"} · ${sf.label}`
		};
	}
	// The kick-off card's line on the conditions: the time, the rain, the wind and which way it blows for you.
	function conditionsText () {
		const w = cond.wind, rain = cond.wet === 2 ? "heavy rain (the ball holds up in the puddles and keepers spill more)" : cond.wet ? "rain (a slower, skiddy ball and keepers who spill more)" : "dry";
		let wind = "";
		if (w.s >= 6) {
			const along = Math.cos(w.a);
			const how = Math.abs(along) > 0.5 ? (along > 0 ? "at your backs in the first half and in your faces after the break" : "in your faces in the first half and at your backs after the break") : "across the pitch";
			wind = `; ${windWord(w.s)} (${w.s} km/h) ${how}${w.s >= 15 ? ", carrying long balls and crosses" : ""}`;
		}
		return `${cond.ko === "day" ? "an afternoon kick-off" : "a night kick-off under the floodlights"}; ${rain}${wind}; ${SURFACES[cond.surfaceKey].label.toLowerCase()}`;
	}
	cond = makeConditions("grass", "clear");

	// League forecast, by the country the league is in. Each climate names the rainy stretch of the
	// season (matchdays 10 to 26 at home, autumn into winter; elsewhere a share of the season), the
	// chance of rain and of heavy rain in that stretch and out of it, how windy it is, and the share of
	// night kick-offs in and out of it (hot countries play in the evening).
	const CLIMATES = {
		home: { rounds: [ 9, 25 ], rain: [ 0.8, 0.27 ], heavy: [ 0.3, 0.07 ], wind: 1, night: [ 0.65, 0.35 ] },
		maritime: { wet: [ 0.2, 0.7 ], rain: [ 0.75, 0.32 ], heavy: [ 0.24, 0.07 ], wind: 1.25, night: [ 0.65, 0.35 ] },
		continental: { wet: [ 0.3, 0.6 ], rain: [ 0.55, 0.3 ], heavy: [ 0.16, 0.1 ], wind: 0.9, night: [ 0.55, 0.35 ] },
		med: { wet: [ 0.3, 0.6 ], rain: [ 0.38, 0.07 ], heavy: [ 0.1, 0.02 ], wind: 0.75, night: [ 0.6, 0.85 ] },
		arid: { wet: [ 0.4, 0.55 ], rain: [ 0.14, 0.03 ], heavy: [ 0.05, 0.01 ], wind: 0.9, night: [ 0.8, 0.85 ] },
		tropical: { wet: [ 0.35, 0.8 ], rain: [ 0.6, 0.15 ], heavy: [ 0.38, 0.07 ], wind: 0.7, night: [ 0.75, 0.7 ] },
		pampas: { wet: [ 0.6, 0.9 ], rain: [ 0.35, 0.2 ], heavy: [ 0.12, 0.05 ], wind: 1.35, night: [ 0.65, 0.55 ] },
		monsoon: { wet: [ 0.4, 0.65 ], rain: [ 0.7, 0.2 ], heavy: [ 0.4, 0.05 ], wind: 1.1, night: [ 0.75, 0.45 ] },
		sunny: { wet: [ 0.45, 0.65 ], rain: [ 0.25, 0.1 ], heavy: [ 0.1, 0.03 ], wind: 1.05, night: [ 0.55, 0.65 ] }
	};
	const CLIMATE_OF = {
		NED: "maritime", BEL: "maritime", DEN: "maritime", FRA: "maritime",
		GER: "continental", POL: "continental", SRB: "continental", CRO: "continental", SWE: "continental",
		ESP: "med", ITA: "med", POR: "med", CHI: "med",
		MAR: "arid", MEX: "arid", USA: "sunny", AUS: "sunny",
		BRA: "tropical", COL: "tropical", NGA: "tropical", GHA: "tropical", SEN: "tropical", CIV: "tropical", CMR: "tropical",
		ARG: "pampas", URU: "pampas", JPN: "monsoon", KOR: "monsoon"
	};
	const climateOf = nat => CLIMATES[CLIMATE_OF[nat]] || CLIMATES.home;
	const inWet = (c, r, n) => (c.rounds ? r >= c.rounds[0] && r <= c.rounds[1] : r / Math.max(1, n) >= c.wet[0] && r / Math.max(1, n) <= c.wet[1]);
	// Wind and kick-off time for each matchday: the rainy stretch is windier and more of it is played at night.
	function genWind (n, nat) {
		const c = climateOf(nat);
		return Array.from({ length: n }, (_, r) => {
			const x = Math.random(), wet = inWet(c, r, n);
			const s = x < (wet ? 0.35 : 0.55) ? Math.random() * 9 : x < (wet ? 0.8 : 0.9) ? 10 + Math.random() * 14 : 24 + Math.random() * 18;
			return { s: Math.round(Math.min(45, s * c.wind)), a: Math.round(Math.random() * 628) / 100 };
		});
	}
	const genKickoff = (n, nat) => { const c = climateOf(nat); return Array.from({ length: n }, (_, r) => (Math.random() < c.night[inWet(c, r, n) ? 0 : 1] ? "night" : "day")); };
	const koLabel = k => (k === "day" ? "3pm" : "7.45pm");
	function genForecast (n, nat) {
		const c = climateOf(nat);
		return Array.from({ length: n }, (_, r) => {
			const x = Math.random(), i = inWet(c, r, n) ? 0 : 1;
			return x < c.heavy[i] ? "heavy" : x < c.rain[i] ? "rain" : "clear";
		});
	}
	// A league's calendar of weather for its country, from matchday `from` on (the days played stay).
	function forecastLeague (lg, from = 0) {
		const n = lg.fixtures.length, nat = lg.ident && lg.ident.country;
		const keep = (old, fresh) => (Array.isArray(old) && old.length === n ? old.slice(0, from).concat(fresh.slice(from)) : fresh);
		lg.weather = keep(lg.weather, genForecast(n, nat)); lg.wind = keep(lg.wind, genWind(n, nat)); lg.ko = keep(lg.ko, genKickoff(n, nat));
	}

	const stars = v => { const n = Math.max(0, Math.min(5, Math.round(v))); return "★".repeat(n) + "☆".repeat(5 - n); };
	const ordinal = n => n + ([ "th", "st", "nd", "rd" ][(n % 100 >> 3) === 1 ? 0 : n % 10] || "th");
	const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

