	/* ---------- players as people: age, nationality, morale, contract, role ----------
	   Everything here is derived or defaulted so that a save from before it existed loads as it was:
	   age and nationality come from a hash of the name (stable across reloads), morale starts at 70,
	   contracts at one to three seasons. */
	const NATIONS = {
		ENG: [ "England", "home" ], SCO: [ "Scotland", "home" ], WAL: [ "Wales", "home" ], IRL: [ "Ireland", "home" ],
		ESP: [ "Spain", "europe" ], FRA: [ "France", "europe" ], GER: [ "Germany", "europe" ], ITA: [ "Italy", "europe" ], NED: [ "Netherlands", "europe" ],
		POR: [ "Portugal", "europe" ], BEL: [ "Belgium", "europe" ], CRO: [ "Croatia", "europe" ], DEN: [ "Denmark", "europe" ], SWE: [ "Sweden", "europe" ], POL: [ "Poland", "europe" ], SRB: [ "Serbia", "europe" ],
		BRA: [ "Brazil", "samerica" ], ARG: [ "Argentina", "samerica" ], URU: [ "Uruguay", "samerica" ], COL: [ "Colombia", "samerica" ], CHI: [ "Chile", "samerica" ],
		NGA: [ "Nigeria", "africa" ], GHA: [ "Ghana", "africa" ], SEN: [ "Senegal", "africa" ], CIV: [ "Ivory Coast", "africa" ], CMR: [ "Cameroon", "africa" ], MAR: [ "Morocco", "africa" ],
		JPN: [ "Japan", "asia" ], KOR: [ "South Korea", "asia" ], AUS: [ "Australia", "asia" ], USA: [ "United States", "asia" ], MEX: [ "Mexico", "asia" ]
	};
	const natsOf = region => Object.keys(NATIONS).filter(k => NATIONS[k][1] === region);
	const ROLES = { key: "Key player", first: "First team", rotation: "Rotation", prospect: "Prospect" };
