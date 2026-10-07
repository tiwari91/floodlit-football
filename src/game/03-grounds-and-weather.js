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

	// League forecast. Matchdays 10 to 26 are the rainy season (autumn into winter).
	const isRainy = r => r >= 9 && r <= 25;
	// Wind and kick-off time for each matchday: winter is windier and more of it is played at night.
	function genWind (n) {
		return Array.from({ length: n }, (_, r) => {
			const x = Math.random(), wet = isRainy(r);
			const s = x < (wet ? 0.35 : 0.55) ? Math.random() * 9 : x < (wet ? 0.8 : 0.9) ? 10 + Math.random() * 14 : 24 + Math.random() * 18;
			return { s: Math.round(s), a: Math.round(Math.random() * 628) / 100 };
		});
	}
	const genKickoff = n => Array.from({ length: n }, (_, r) => (Math.random() < (isRainy(r) ? 0.65 : 0.35) ? "night" : "day"));
	const koLabel = k => (k === "day" ? "3pm" : "7.45pm");
	function genForecast (n) {
		return Array.from({ length: n }, (_, r) => {
			const x = Math.random();
			if (isRainy(r)) { return x < 0.3 ? "heavy" : x < 0.8 ? "rain" : "clear"; }
			return x < 0.07 ? "heavy" : x < 0.27 ? "rain" : "clear";
		});
	}

	const stars = v => { const n = Math.max(0, Math.min(5, Math.round(v))); return "★".repeat(n) + "☆".repeat(5 - n); };
	const ordinal = n => n + ([ "th", "st", "nd", "rd" ][(n % 100 >> 3) === 1 ? 0 : n % 10] || "th");
	const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

