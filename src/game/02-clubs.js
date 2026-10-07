	/* ---------- clubs ---------- */
	// Invented clubs. str (1-5) sets how well each one's AI plays and how it fares in simulated games.
	const YOU = { name: "Floodlit FC", short: "You", color: "#f2b52e", color2: "#1f2a36", text: "#f2b52e", str: 3, ground: "Floodlit Park", surface: "grass" };
	// [ name, short, shirt, shorts/sleeves, rating, ground, surface ]. The first 19 start in the
	// division; the rest wait below and come up as others go down.
	const CLUB_DATA = [
		[ "Harbour Athletic", "Harbour", "#de4f5a", "#ffffff", 3, "Quayside Road", "mud" ],
		[ "Millbrook Rovers", "Millbrook", "#4f8fde", "#ffffff", 2, "The Mill Ground", "grass" ],
		[ "Ashford Vale", "Ashford", "#9b6ee8", "#1f2a36", 4, "Ashford Meadow", "grass" ],
		[ "Kingsmoor United", "Kingsmoor", "#eef2f0", "#1f2a36", 5, "Moorgate Arena", "turf" ],
		[ "Redcliffe Town", "Redcliffe", "#1f2a36", "#de4f5a", 3, "Cliff Lane", "mud" ],
		[ "Oakhurst City", "Oakhurst", "#2fb8b0", "#1f2a36", 1, "Hurst Common", "grass" ],
		[ "Pennant Wanderers", "Pennant", "#c2185b", "#ffffff", 2, "Pennant Fields", "turf" ],
		[ "Saltmarsh City", "Saltmarsh", "#8fc3e6", "#1f2a36", 5, "Saltmarsh Stadium", "turf" ],
		[ "Brackenridge Albion", "Brackenridge", "#7a1f3d", "#8fc3e6", 4, "Albion Road", "grass" ],
		[ "Northgate Rangers", "Northgate", "#1d4fa0", "#ffffff", 4, "Northgate Park", "grass" ],
		[ "Ravenscar Town", "Ravenscar", "#2b2b52", "#d63b3b", 4, "Ravens Hill", "mud" ],
		[ "Eastwick Borough", "Eastwick", "#e0662f", "#1f2a36", 3, "Borough Yard", "mud" ],
		[ "Greywood Athletic", "Greywood", "#155e3a", "#ffffff", 3, "Greywood Lane", "grass" ],
		[ "Blackmere United", "Blackmere", "#15171a", "#e8e8e8", 3, "Mere Street", "grass" ],
		[ "Linwood Harriers", "Linwood", "#c8102e", "#15171a", 3, "Harrier Park", "turf" ],
		[ "Silverdale City", "Silverdale", "#b9c2c9", "#1f2a36", 3, "Dale Road", "grass" ],
		[ "Fairhaven Town", "Fairhaven", "#f4f4f4", "#1d4fa0", 2, "Haven Green", "grass" ],
		[ "Thornbury Rovers", "Thornbury", "#5b2a86", "#ffffff", 2, "Thorn Lane", "mud" ],
		[ "Crestfield Wanderers", "Crestfield", "#0b6e6e", "#f2f2f2", 2, "Crest Road", "grass" ],
		[ "Mossley Heath", "Mossley", "#8a2432", "#f0d9a0", 2, "Heath Park", "mud" ],
		[ "Brampton Vale", "Brampton", "#2a5caa", "#ffffff", 2, "Vale Road", "grass" ],
		[ "Cotterill Town", "Cotterill", "#e45a91", "#1f2a36", 2, "Cotterill Lane", "grass" ],
		[ "Dunhollow United", "Dunhollow", "#4b4b4b", "#de4f5a", 1, "Hollow Park", "mud" ],
		[ "Ferrow City", "Ferrow", "#1f7a8c", "#0d1b2a", 2, "Ferrow Quay", "turf" ],
		[ "Gallow Hill", "Gallow", "#a33c1d", "#ffffff", 2, "The Hill", "mud" ],
		[ "Hartwell Athletic", "Hartwell", "#123a7a", "#9fd0ee", 2, "Hartwell Road", "grass" ],
		[ "Kestrel Park", "Kestrel", "#d9d9d9", "#7a1f3d", 1, "Kestrel Ground", "grass" ],
		[ "Lowfield Rovers", "Lowfield", "#8b4db8", "#eeeeee", 2, "Low Field", "grass" ]
	];
	// Local rivals, by league id (0 is you): these games are derbies, with the loudest crowds of the season.
	const RIVALS = [ [ 0, 1 ], [ 4, 8 ], [ 5, 11 ], [ 2, 7 ], [ 3, 9 ], [ 12, 14 ], [ 10, 17 ], [ 13, 16 ], [ 6, 19 ], [ 15, 18 ], [ 20, 22 ], [ 21, 24 ], [ 23, 27 ], [ 25, 28 ] ];
	const derbyOf = (a, b) => RIVALS.some(([ x, y ]) => (x === a && y === b) || (x === b && y === a));
	const rivalOf = id => { const r = RIVALS.find(([ x, y ]) => x === id || y === id); return r ? (r[0] === id ? r[1] : r[0]) : -1; };
	const DIVISION = 20, SEASON_ROUNDS = 38, JANUARY = 19;   // January window before matchday 20
	const GK_KITS = [ "#7ee3c0", "#f0e27a", "#f2a0c8", "#8fd0f5", "#f29a5e", "#9be87a", "#e8736e" ];
	// Perceptual colour difference (CIE76 ΔE in Lab): under ~72 two shirts are easy to confuse at a glance on small figures.
	function deltaE (a, b) {
		const lab = hex => {
			const n = parseInt(hex.slice(1), 16);
			const [ r, g, b2 ] = [ n >> 16, (n >> 8) & 255, n & 255 ].map(v => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; });
			const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
			const x = f((r * 0.4124 + g * 0.3576 + b2 * 0.1805) / 0.95047), y = f(r * 0.2126 + g * 0.7152 + b2 * 0.0722), z = f((r * 0.0193 + g * 0.1192 + b2 * 0.9505) / 1.08883);
			return [ 116 * y - 16, 500 * (x - y), 200 * (y - z) ];
		};
		const p = lab(a), q = lab(b);
		return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
	}
	function colorGap (a, b) {
		const p = h => { const n = parseInt(h.slice(1), 16); return [ n >> 16, (n >> 8) & 255, n & 255 ]; };
		const x = p(a), y = p(b);
		return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
	}
	function lum (hex) {
		const n = parseInt(hex.slice(1), 16), c = [ n >> 16, (n >> 8) & 255, n & 255 ].map(v => v / 255);
		return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
	}
	// Dark kits need a lighter tint to read as text on the dark page.
	function textFor (hex) {
		if (lum(hex) > 0.25) { return hex; }
		const n = parseInt(hex.slice(1), 16), c = [ n >> 16, (n >> 8) & 255, n & 255 ].map(v => Math.round(v + (255 - v) * 0.55));
		return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
	}
	const CLUBS = CLUB_DATA.map(([ name, short, color, color2, str, ground, surface ], i) => ({
		name, short, color, color2, str, ground, surface,
		gk: GK_KITS[i % GK_KITS.length], text: textFor(color), ink: lum(color) > 0.55 ? "#1b2420" : "#ffffff",
		pattern: [ "stripes", "plain", "hoops", "plain", "halves", "sash", "plain" ][i % 7]
	}));
	const TEAMS = [ YOU, ...CLUBS ];   // league ids: 0 is you
	const FRIENDLY = { name: "the CPU", short: "CPU", color: "#de4f5a", color2: "#ffffff", gk: "#b394ee", text: "#ef6f79", str: 3 };
	// Rating 1..5 spans the friendly Sunday league..Academy settings.
	function strengthCfg (s) {
		const k = (clamp(s, 1, 5) - 1) / 4;
		// Pace and defending now come from each player's ratings; this keeps how well the side
		// thinks, finishes and keeps goal.
		return { spd: 1, tackle: 0.02 + 0.012 * k, spread: 80 - 50 * k, save: 0.18 + 0.24 * k, think: Math.round(12 - 7 * k) };
	}
