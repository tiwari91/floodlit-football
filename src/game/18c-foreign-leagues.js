	/* ---------- foreign leagues ----------
	   Move abroad and the whole division changes with you: every other club is renamed for that
	   country (its towns, its way of naming clubs and grounds), recoloured, and the division takes the
	   country's league name. Strengths stay as they were, so the league is as hard as at home. The
	   identities ride in league.ident (see 18b), so they survive a reload and the seasons after. */
	const FOREIGN = {
		ESP: [ "Primera División", "Estadio de {t}", [ "CD {t}", "Real {t}", "UD {t}", "Atlético {t}", "{t} CF", "SD {t}" ], "Sevilla Vieja,Albarán,Cuenca Alta,Moraleda,Valdemar,Torrelavega,Alcorán,Marbeza,Zamorano,Lugones,Pontevar,Getarra,Almendral,Castrillo" ],
		FRA: [ "Ligue 1", "Stade de {t}", [ "AS {t}", "FC {t}", "Olympique {t}", "Stade {t}", "RC {t}", "US {t}" ], "Vence,Lorient-sur-Mer,Montbrun,Châtelard,Valmont,Brissac,Saint-Aubin,Roucy,Ferrière,Lavallée,Mirande,Bourgval,Pontaix,Corbeil" ],
		GER: [ "Bundesliga", "{t}-Stadion", [ "SV {t}", "FC {t}", "VfB {t}", "TSV {t}", "{t} 04", "SC {t}" ], "Kahlberg,Rheinau,Westerfeld,Altdorf,Lindenhof,Brückstadt,Hohenmark,Tannheim,Steinbach,Wolfsau,Neumühl,Ostenburg,Elmshafen,Grünwald" ],
		ITA: [ "Serie A", "Stadio {t}", [ "AC {t}", "US {t}", "{t} Calcio", "SS {t}", "Real {t}", "AS {t}" ], "Vellano,Montecora,Sassoli,Brivio,Castellana,Ravenzo,Lucerna,Pontebba,Ardenza,Torrevecchia,Saldano,Collina,Marzano,Bassavalle" ],
		NED: [ "Eredivisie", "Stadion {t}", [ "FC {t}", "SC {t}", "VV {t}", "{t} '68", "SBV {t}", "{t} Boys" ], "Veendam,Zuidhorn,Haarwijk,Dijkstad,Brouwershaven,Molendam,Westerhoven,Lekkerkerk,Oosterbeek,Ravenstein,Hoogvliet,Duinwijk,Kampenveen,Sluisdorp" ],
		POR: [ "Primeira Liga", "Estádio {t}", [ "SC {t}", "CD {t}", "{t} FC", "Sporting {t}", "UD {t}", "Vitória {t}" ], "Arade,Lusa,Monforte,Vila Nova,Castelo Real,Barreira,Alvorada,Seixal Alto,Porto Velho,Mirandela,Fontainhas,Sardoal,Tavira Nova,Belmonte" ],
		BEL: [ "Pro League", "Stadion {t}", [ "KV {t}", "RFC {t}", "Sporting {t}", "KSC {t}", "Royal {t}", "{t} FC" ], "Herenbeek,Waasmunster,Liedekerk,Montval,Overpelt,Zandvoorde,Diksmuide,Hamois,Tervuren,Beverlo,Rochefort,Merelbeek,Waremme,Lokerdijk" ],
		CRO: [ "HNL", "Stadion {t}", [ "NK {t}", "HNK {t}", "Dinamo {t}", "Slaven {t}", "Istra {t}", "Zagorje {t}" ], "Velika Gora,Korenica,Vinkovac,Sinjgrad,Pakrac,Novalja,Bjelovac,Lovran,Drniš,Ozalj,Kutjevo,Samobor,Ivanec,Ploče" ],
		DEN: [ "Superliga", "{t} Stadion", [ "{t} BK", "FC {t}", "{t} IF", "AC {t}", "{t} FF", "B93 {t}" ], "Skovby,Ribeholm,Næsby,Vejlstrup,Hjørring Nord,Faxe Strand,Lemvig,Brørup,Søndervig,Hadsund,Kalvø,Tarmlund,Gilleby,Mørkhøj" ],
		SWE: [ "Allsvenskan", "{t} Arena", [ "{t} IF", "{t} FF", "IFK {t}", "{t} BK", "GIF {t}", "{t} AIK" ], "Sjöby,Älvdal,Bergsjö,Norrhamn,Västerlund,Kalmarby,Öresby,Ljusnäs,Torsby Strand,Grästorp,Hallsta,Mölnby,Visby Nord,Arvika" ],
		POL: [ "Ekstraklasa", "Stadion {t}", [ "KS {t}", "Górnik {t}", "Lechia {t}", "Polonia {t}", "Zagłębie {t}", "Piast {t}" ], "Brzeg Dolny,Wieliczka,Sokolów,Ostrowiec,Kłodawa,Mielec Nowy,Chełmno,Łomża,Zawiercie,Nysa,Gniezno,Turek,Bielawa,Pszczyna" ],
		SRB: [ "SuperLiga", "Stadion {t}", [ "FK {t}", "Radnički {t}", "Spartak {t}", "Sloboda {t}", "Mladost {t}", "Sloga {t}" ], "Kraljevac,Zaječar,Ub,Ivanjica,Paraćin,Bečej,Ćuprija,Vršac,Kula,Loznica,Priboj,Smederevo,Šabac,Inđija" ],
		BRA: [ "Série A", "Estádio {t}", [ "{t} EC", "SC {t}", "{t} FC", "Atlético {t}", "CR {t}", "América {t}" ], "Paraná,Itaparica,Ribeirão,Santa Luzia,Campina Nova,Juazeiro,Marabá,Petrolina,Itabuna,Caxias,Bagé,Londrina Velha,Feira Grande,Maceió Norte" ],
		ARG: [ "Liga Profesional", "Estadio {t}", [ "Club Atlético {t}", "Deportivo {t}", "{t} FC", "Racing {t}", "Unión {t}", "Independiente {t}" ], "Rosales,Cuyo,Junín,Tandil,Rafaela,Olavarría,Pergamino,Mercedes,Azul,Chivilcoy,Bragado,Zárate,Lobos,Balcarce" ],
		URU: [ "Primera División", "Estadio {t}", [ "Club {t}", "Deportivo {t}", "{t} FC", "Racing {t}", "Progreso {t}", "Liverpool {t}" ], "Salto,Rivera,Tacuarembó,Melo,Durazno,Minas,Rocha,Artigas,Florida,Treinta y Tres,Carmelo,Dolores,Young,Paysandú" ],
		COL: [ "Primera A", "Estadio {t}", [ "Deportivo {t}", "Atlético {t}", "Once {t}", "Independiente {t}", "Real {t}", "Unión {t}" ], "Pereira Alta,Tuluá,Girardot,Zipaquirá,Sogamoso,Ipiales,Montería,Neiva,Palmira,Buga,Duitama,Rionegro,Facatativá,Tunja" ],
		CHI: [ "Primera División", "Estadio {t}", [ "Deportes {t}", "Unión {t}", "Club {t}", "Everton {t}", "Rangers {t}", "Cobre {t}" ], "Talca,Curicó,Linares,Ovalle,Quillota,Rancagua Sur,Chillán,Osorno,Calama,Copiapó,Iquique Norte,Valdivia,Temuco,La Serena" ],
		NGA: [ "NPFL", "{t} Stadium", [ "{t} United", "{t} Stars", "{t} Rangers", "{t} City", "{t} Warriors", "Sporting {t}" ], "Lagos Harbour,Enugu,Kano,Ibadan,Abeokuta,Jos,Owerri,Warri,Calabar,Ilorin,Akure,Makurdi,Uyo,Bauchi" ],
		GHA: [ "Premier League", "{t} Stadium", [ "{t} Stars", "{t} Hearts", "{t} United", "{t} Kotoko", "{t} Dwarfs", "{t} City" ], "Accra,Kumasi,Tamale,Cape Coast,Takoradi,Sunyani,Ho,Koforidua,Obuasi,Tema,Techiman,Nkawkaw,Wa,Bolga" ],
		SEN: [ "Ligue 1", "Stade de {t}", [ "AS {t}", "Jaraaf {t}", "Union {t}", "Jeanne d'Arc {t}", "US {t}", "Lions {t}" ], "Dakar,Thiès,Kaolack,Ziguinchor,Saint-Louis,Touba,Mbour,Rufisque,Louga,Kolda,Tambacounda,Diourbel,Fatick,Kédougou" ],
		CIV: [ "Ligue 1", "Stade de {t}", [ "ASEC {t}", "Africa {t}", "Stella {t}", "SOA {t}", "SC {t}", "Séwé {t}" ], "Abidjan,Bouaké,Yamoussoukro,Daloa,San-Pédro,Korhogo,Man,Gagnoa,Divo,Abengourou,Soubré,Agboville,Odienné,Bondoukou" ],
		CMR: [ "Elite One", "Stade de {t}", [ "Canon {t}", "Coton {t}", "Union {t}", "Tonnerre {t}", "Fovu {t}", "Unisport {t}" ], "Yaoundé,Douala,Garoua,Bamenda,Bafoussam,Maroua,Ngaoundéré,Kribi,Limbe,Buea,Ebolowa,Bertoua,Dschang,Kumba" ],
		MAR: [ "Botola", "Stade de {t}", [ "Raja {t}", "Wydad {t}", "FUS {t}", "Hassania {t}", "Olympique {t}", "Moghreb {t}" ], "Casablanca,Agadir,Fès,Meknès,Oujda,Tanger,Tétouan,Safi,Kénitra,El Jadida,Nador,Béni Mellal,Khouribga,Errachidia" ],
		JPN: [ "J1 League", "{t} Stadium", [ "{t} FC", "{t} United", "{t} Rising", "{t} Blaze", "{t} Phoenix", "{t} Wave" ], "Osaka Bay,Kanazawa,Sendai,Niigata,Shizuoka,Kumamoto,Okayama,Nagano,Kofu,Matsumoto,Akita,Tokushima,Mito,Oita" ],
		KOR: [ "K League 1", "{t} Stadium", [ "{t} FC", "{t} United", "{t} Tigers", "{t} Dragons", "{t} Citizen", "{t} Eagles" ], "Busan,Incheon,Daegu,Gwangju,Ulsan,Suwon,Jeonju,Pohang,Changwon,Cheongju,Gimpo,Ansan,Asan,Jeju" ],
		AUS: [ "A-League", "{t} Park", [ "{t} FC", "{t} United", "{t} City", "{t} Victory", "{t} Jets", "{t} Wanderers" ], "Sydney Harbour,Geelong,Wollongong,Hobart,Townsville,Cairns,Darwin,Ballarat,Bendigo,Newcastle Bay,Launceston,Toowoomba,Albury,Mackay" ],
		USA: [ "Major League", "{t} Field", [ "{t} FC", "{t} SC", "{t} United", "{t} City", "Real {t}", "{t} Athletic" ], "Austin,Tulsa,Boise,Omaha,Spokane,Albany,Tucson,Raleigh,Fresno,Dayton,Reno,Wichita,Akron,Eugene" ],
		MEX: [ "Liga Mexicana", "Estadio {t}", [ "Club {t}", "Deportivo {t}", "Atlético {t}", "Real {t}", "{t} FC", "Tigres {t}" ], "Monterrey Norte,Saltillo,Morelia,Celaya,Zacatecas,Durango,Mazatlán,Tepic,Colima,Irapuato,Orizaba,Tampico,Querétaro,Hermosillo" ]
	};
	// The clubs that make offers abroad, and the country each one belongs to.
	const MARKET_CLUB_NAT = {
		"Ribera CF": "ESP", "AS Vence": "FRA", "SV Kahlberg": "GER", "FC Arade": "POR", "Sporting Lusa": "POR", "Veendam AFC": "NED",
		"Atlético Paraná": "BRA", "CA Rosales": "ARG", "Deportivo Salto": "URU", "Club Cuyo": "ARG",
		"Lagos Harbour": "NGA", "Accra Stars": "GHA", "Dakar Lions": "SEN", "Casablanca Athletic": "MAR",
		"Osaka Bay": "JPN", "Busan Mariners": "KOR", "Sydney Harbour": "AUS", "Austin Union": "USA", "Monterrey Norte": "MEX"
	};
	const FOREIGN_SHIRTS = [ "#c8102e", "#1d4fa0", "#f2b52e", "#155e3a", "#8fc3e6", "#5b2a86", "#e0662f", "#15171a", "#eef2f0", "#2fb8b0", "#7a1f3d", "#c2185b", "#0b6e6e", "#9b6ee8", "#a33c1d", "#123a7a", "#d9d9d9", "#4f8fde", "#de4f5a", "#2b2b52", "#8a2432", "#e45a91", "#b9c2c9", "#1f7a8c", "#4b4b4b", "#8b4db8", "#2a5caa", "#f4f4f4" ];
	const foreignSecond = c => (lum(c) > 0.55 ? "#1f2a36" : "#ffffff");
	// Every other club in the division (and those waiting below it) renamed for `nat`; yours keeps its name.
	function applyForeignLeague (nat) {
		const F = FOREIGN[nat];
		if (!F) { return false; }
		const [ , groundPat, pats, townList ] = F, towns = townList.split(","), h = hashStr(nat);
		const used = new Set([ YOU.name ]);
		for (let i = 1; i < TEAMS.length; i++) {
			// The first fourteen clubs a town each; the rest are a town's second club (its derby rival).
			const k = i - 1, town = towns[k % towns.length], pat = pats[(k < towns.length ? k + h : k + h + 3) % pats.length];
			let name = pat.replace("{t}", town);
			for (let j = 1; used.has(name) && j < pats.length; j++) { name = pats[(k + h + j) % pats.length].replace("{t}", town); }
			used.add(name);
			const short = k < towns.length ? town : (name.length <= 14 ? name : town);
			const color = FOREIGN_SHIRTS[(k * 7 + h) % FOREIGN_SHIRTS.length], color2 = foreignSecond(color);
			Object.assign(TEAMS[i], { name, short, color, color2, text: textFor(color), ink: lum(color) > 0.55 ? "#1b2420" : "#ffffff", ground: groundPat.replace("{t}", town), surface: [ "grass", "grass", "turf", "mud" ][(k + h) % 4] });
		}
		return true;
	}
	const divisionName = () => {
		const nat = league && league.ident && league.ident.country;
		return nat && FOREIGN[nat] ? `${FOREIGN[nat][0]} (${NATIONS[nat] ? NATIONS[nat][0] : nat})` : "Premier Division";
	};
	// A save from before foreign leagues existed: a manager already abroad still had the home clubs
	// around him. If his club is one of the clubs that hires abroad, build its country's league now.
	function repairForeignLeague (lg) {
		if (!lg || !lg.ident || lg.ident.country) { return false; }
		const nat = MARKET_CLUB_NAT[YOU.name];
		if (!nat || !applyForeignLeague(nat)) { return false; }
		rememberIdentity(lg);
		lg.ident.country = nat;
		lg.news = `${lg.news || ""} Your league is now the ${FOREIGN[nat][0]} in ${NATIONS[nat] ? NATIONS[nat][0] : nat}.`.trim();
		return true;
	}
