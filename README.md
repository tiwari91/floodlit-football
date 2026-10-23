# Floodlit Football

A top-down football game in one HTML file: 11, 6 or 5-a-side, a 20-club league over 38 rounds, transfers and upgrades, fitness and rotation, weather, offside, corners, throw-ins, fouls, free kicks, penalties, cards and injuries, substitutions, match reports and a season simulator.

**Play:** https://tiwari91.github.io/floodlit-football/

Controls: arrows move, S pass, W through ball, Q long ball (a cross from out wide, a chip near goal), D shoot (hold for power; a power bar runs along the bottom of the pitch), A tackle (hold to close the carrier down), E sprint, 1–4 or T tactic, P or Esc pause, C camera, F big pitch, H how to play. Press H (or any How to play button) for a one-screen guide to every control on a keyboard, a phone or a controller, and what the markers on the pitch mean; the kick-off card shows the keys for your first three matches. Your league saves in your browser.

The ball has height. Long balls, crosses, corners and chips go up and come down on a real arc, and crosses and corners bend in the air: in-swingers curl towards goal and out-swingers away. Players attack a dropping ball, go up for headers and can head it in, on or clear. Keepers come off their line for crosses into their area and catch, punch or flap. On your corners, S whips an in-swinger at the near post, Q floats an out-swinger to the far post and W drops one on the penalty spot. Your runners wait around the spot and attack their zones as the ball is struck, each marked goal-side, with two defenders holding the near post and the six-yard line. Central and in range, Q chips the keeper.

Free kicks near goal get a wall 9.15 m off (to scale on the smaller pitches) and a teammate beside the ball. W curls it up over the wall, round its end and down under the bar; D drives it low; S lays it off for a shot. Offside and obstruction give an indirect free kick, which has to touch another player before it can count. At a penalty you lean up or down to pick a side (a crosshair shows it) and the keeper guesses; on theirs you hold up or down to send your keeper. Saves aren't always held: a keeper can push a penalty or a hard shot back out, and the rebound is live. At a throw-in or goal kick the taker walks to the ball while the other side backs off, then throws or kicks it short (S) or long (Q).

Offside is judged at the moment of the pass. The assistant raises his flag, the referee whistles and the defending side gets an indirect free kick. When it's close, the picture freezes on the moment with the line drawn across the pitch and a "Tight call: checking offside" caption, then the decision: offside by so many centimetres, or onside and play on.

Every player has stamina for the match, started from his fitness. Sprinting and pressing drain it, a breather lets it creep back and half time tops it up. Tired players are slower, pass and shoot less accurately and win fewer tackles; yours get a low-battery mark on the pitch, the substitutions panel shows everyone's legs, and when one of yours is running on empty a note says so and the pause card names him. The computer changes tired and injured men in the second half, and a side chasing the game sends on another forward. How hard a match ran a player into the ground decides how much fitness it costs him for the next one.

Injuries come mostly from heavy tackles, and "get stuck in" causes the most. A knock (a dead leg, an ankle) lets a player limp on, slower, until you change him. A serious one (a hamstring, ankle or knee ligaments) stops play: two medics bring the stretcher on, the camera goes to him and he's carried off, a substitute comes on if you have one left, and otherwise his side plays a man short. A player running on empty can pull up too. In the league the injury is named in the squad table with the matchdays he'll miss, he's unavailable until then, and a good fitness coach sometimes has him back a week early.

About a third of players have a trait that changes how they play: a pace merchant is quicker and makes runs in behind from wherever he plays; a target man wins headers, is hard to knock off the ball and is who the long balls look for; a playmaker passes further and more accurately and looks for the through ball; a poacher hangs on the last defender's shoulder in the box and finishes better there; a ball-winner wins more tackles and slides in more; a sweeper keeper stands high when his side has it and rushes out to balls in behind. Traits show in the squad table, the transfer list, the Clubs panel and the substitutions panel, and older saves get them on loading.

After a goal the scorers go for another: for about four match minutes they press high and squeeze up, and the side that conceded wobbles, with looser passes, heavier touches and softer tackles; the score bug says who is wobbling. In the league every player gets a rating out of ten for each match (goals, tackles, headers, cards, clean sheets and the result). His last five make his form: a green ▲ in the squad table adds up to two to each of his ratings, a red ▼ takes up to two off, and the ratings are in the arrow's tooltip.

**Corner shootout** (the fourth mode button) is a practice game of corners: five each, taken in turn, and a goal is a point. Level after ten, it goes to sudden death. You take yours and defend theirs, and a results card shows each side's corners, goals, headers, claims and clearances. It doesn't touch your season.

Your players are people. Each has an age, a nationality, a potential, a morale, a contract and a wage. Morale rises with wins, goals and games, and falls when a key player is left out. A happy player gives a little more on the pitch, an unhappy one a little less. Open a player (⋯ in the squad table) to set his squad role (key player, first team, rotation or prospect), offer him a new contract, or release him from the bench and pay off his deal. Wages go out every matchday and home gates come in. At the end of a season everyone is a year older; out-of-contract players who are happy sign on again, the rest leave, and academy players fill any gaps.

Coaching runs every week between matches. Pick a training focus (balanced, attacking, defending, fitness, tactics or youth) and an intensity (light, normal or hard). Young players improve fastest, nobody improves past his potential, and players over 30 lose pace each summer. Hard weeks bring quicker gains but tired legs and the odd knock. Hire staff from a changing list: an assistant manager for tactical drills and morale, attacking, defensive and goalkeeping coaches, a fitness coach for pace, recovery and fewer knocks, and a chief scout for players abroad. Each is rated one to five stars and costs a fee and a wage. Tactical drills build familiarity with your shape, which sharpens passing and defending a little. After every league match the panel and the full-time card list who improved.

The transfer market has five regions: home, Europe, South America, Africa, and Asia and the Americas. Abroad gets you more quality for the money, but outside Europe a player needs a work permit (68 overall or better), and a signing from abroad takes a few games to settle in, fewer with a good scout. You see a range for a player's rating until you scout him; a chief scout gives you more reports each window and narrower estimates. Bid the asking price, or offer 20% less and risk the club turning you down and raising its price; turn them down twice and they stop talking. Player values follow rating, age, potential and contract. The list changes in each window. The other clubs do business too. When a window opens they sign players from home and abroad, sometimes off your own shortlist, and grow a little stronger for it. Their signings appear in their squads in the Clubs panel and play against you. Some of them bid for your best players: accept, or reject and risk upsetting a player who wanted the move. You can also sell anyone from his player card while the window is open.

The coaching loop ties it together. Before each league match the kick-off card reads the opponent (how they play, how they press and tackle, and what might beat it) next to your eleven's morale, tactical familiarity and this week's training. After it the full-time card reviews the numbers with one thing to change, and lists who improved in training.

Three cameras, switched with the Camera button or C: overhead, TV, and a 3D view drawn with three.js. In 3D the players are jointed figures in their kits, with numbers on their backs and keepers in their own colours, who run, pass, shoot, head, slide, dive, take throw-ins and go down when fouled. A referee and two assistants wear a bright kit picked to clash with neither side, and the assistants raise their flags for offside and when the ball goes out. 3D is the default on a laptop or desktop with WebGL, overhead on a phone; without WebGL, or if three.js cannot load, the 2D cameras stay.

The grounds are Mexican-style stadiums, each in one of three shapes: a two-tier bowl with a ring of lit private boxes and a ring roof on masts, one tall oval tier under a ring roof, or a tight two-tier rectangle with roofs on the long sides and mountains behind. They have floodlights along the roof or on lattice towers, aisles through the seats and nets that bulge and swing. The grass is mown in each ground's pattern, worn in the goalmouths and wet under the lights in the rain. Every seat holds a fan in the home or away colours: they sway, rise for a chance, hold their heads at a near miss, erupt at a goal and start a Mexican wave in a quiet spell. The crowd is partisan: the home end roars its side's chances, cheers its keeper's saves and applauds its tackles and clearances, with a wave of the home colours through the stands; when the visitors attack it goes tense and quiet, their chances and saves get a murmur, and a foul by the visitors gets boos and whistles, while the away corner celebrates its own side's moments. Their synthesised noise swells with each home attack, with a drum under the chants (the Sound button silences it). The menus play a stadium anthem synthesised in the browser: a string pad, a horn with a choir under it, bass, timpani and snare, with a hall reverb.

Every club has its own songs, synthesised in the browser: a key, a tempo, a rhythm, a clap and a drum of its own, and at some clubs a few voices lead a call that the whole end answers. Local rivals meet in derbies (yours is against Harbour Athletic): the kick-off card and the fixture list say Derby, the crowd is louder and both ends sing all night. Win the league and your captain lifts the trophy on the card while fireworks go up over the ground.

Defending is a team job. The nearest man closes the carrier down goal-side rather than charging at the ball, a second defender covers behind him on the line to goal, and markers track their runners goal-side, reading where they are going. Keepers come off their line to narrow the angle as an attacker closes in and rush out to smother a one-on-one, which is when a chip (Q) is on.

Every league fixture has its weather. Rain holds the ball up, makes passes skid astray and keepers spill more, and you can see it falling and shining on the pitch. Wind blows long balls, crosses, corners and lofted shots off line in the air and holds up or carries anything kicked into or with it; an arrow with its speed sits at the top left of the pitch, flipping with the picture at half time. Fixtures kick off in the afternoon, or at night under the floodlights with the stands dark around the lit pitch. The forecast panel shows each matchday's rain, wind and kick-off time, and the kick-off card says which way the wind blows for you in each half. Friendlies have a Windy option.

Like a TV broadcast:
- a score bug in each side's colours that flashes for a goal;
- captions for goals, cards and substitutions;
- a camera sweep at each kick-off;
- after a goal in 3D, an instant slow-motion replay from behind or beside the goal.

Any key or tap skips the replay, and the match clock is stopped throughout.

Graphics (Low, Medium or High, under the pitch and on the pause card) sets how much the 3D view draws: crowd density and detail, the floodlight towers' lattice, the players' floodlight shadows, pixel ratio and antialiasing. Phones start on Low (big tablets on Medium) and computers on High; your choice is remembered.

Two more team instructions sit with Style and Defending: Line (high, normal or deep: a high line squeezes the pitch and plays offside, a deep one guards the space behind) and Tackling (stay on your feet, normal, or get stuck in for more tackles, more slides and more fouls and cards). The computer's line follows its press, and each club has its own way of tackling. Both are on the pause card too.

Settings sit under the pitch in four groups (your team, the match, controls and view, sound and rules); the pause and half-time cards carry the mid-match ones (tactic, camera, auto switch, sound, music, hints, kit contrast, Graphics). Auto switch picks how control moves when you defend: Assisted, Manual only or Aggressive. Kit contrast dresses the other side in white or black with a dashed ring for colour vision that struggles with red on green. Half time and full time show both sides' possession, shots, passes, pass accuracy, tackles, corners, fouls and cards.

On a phone, landscape fills the screen with the pitch and floats the joystick and pads over it; portrait keeps a tall pitch with the controls below. Xbox and PlayStation controllers work too.

## Option files: your own names

Floodlit ships with invented players and clubs only. The project contains no real players' names
or data and no ratings from any other game, and it never will: no sample option file with real
names is shipped either.

Edit names, in the League panel, opens edit mode:
- **Clubs**: a club's name, short name, shirt and second colours and ground, for every club in
  your league (yours too) and the foreign clubs on the transfer markets.
- **Players**: name, nationality, shirt number, preferred foot, position, skin, hair colour and
  hair style, for your squad, the transfer list and the other clubs' squads. Ratings (pace,
  shooting, passing, defending, dribbling and physical, from 30 to 96) can only be changed with Custom ratings on, so a
  career stays balanced unless you choose otherwise.

Everything is checked as you save: lengths, colours, and no two clubs or players of yours with
the same name. Edits are kept in your save, carry on through new seasons, follow a player you sell,
and a renamed player keeps his face.

Export option file saves the edits as a small JSON file (`"kind": "floodlit-option-file"`,
`"version": 1`) that anyone can import from the file picker or by dropping it on the editor. Before
anything changes, a preview says what the file renames ("This file renames 20 clubs and 412
players") and what it ignores, and you choose to apply it now or from next season. Your own players
are matched by a stable id, the other clubs' players by club and squad slot. Unknown entries are
skipped; a file that is not an option file is refused with a message. The file is only ever parsed
as JSON, never run. Revert to default names undoes every edit.

## League option files

Version 2 option files (`"version": 2`; version 1 files still import) can define whole leagues and the
continental cup's guest clubs, not only the league you play in. The precise, machine-readable spec,
with every field, range, code and slot, is [`docs/option-file-schema.json`](docs/option-file-schema.json);
`tests/leaguefile.mjs` checks it against the game.

- **`leagues`**: keyed by country code. The game has 29 leagues: `ENG` (home) and `ESP FRA GER ITA NED
  POR BEL CRO DEN SWE POL SRB BRA ARG URU COL CHI NGA GHA SEN CIV CMR MAR JPN KOR AUS USA MEX`. Each is
  `{ "clubs": [ ... ] }`, a club per **slot 1 to 28**: slots 1-19 start in the top division (always 20
  clubs, yours plus 19) and 20-28 wait below it for promotion. Slot 0 is your own club and is never in a
  file. A club takes its slot's starting strength (1 to 5, listed in the spec), so put the strongest
  clubs in the strongest slots. A 20-club league fits slots 1-20.
- **A club**: `name` (required), `short`, `color`, `color2`, `ground`, an optional `manager` and
  `managerNat`, and `players`.
- **Players**: the computer's squads are **11 with no bench**, by squad slot 0-10: goalkeeper, four
  defenders (1-4), four midfielders (5-8), two forwards (9-10). Each player has `name` (required),
  `nat`, `shirt`, `foot`, `pos`, `age`, `trait`, `lk` (skin, hair, hair style, face), and the ratings
  `pac`, `sho`, `pas` and `def` (30 to 96; a goalkeeper's `def` is his handling), plus the optional
  `dri` (dribbling) and `phy` (physical), also 30 to 96. Left out, dribbling and physical are worked out
  from his other ratings, position, age, trait and country, and neither counts toward overall. Ratings are
  used only if you tick "Use its ratings" on import. Your own club has 11 plus a bench of 7.
- **`cup`**: keyed by country code, a list of clubs (no slot) for the Continental Champions Cup's
  36-club league phase. A country's seats (Spain, Germany, Italy and France 4, Portugal and the
  Netherlands 3, Belgium, Croatia, Denmark and Serbia 2, Sweden and Poland 1) are filled from its cup
  list first, then from its league in the file, strongest slots first, then from generated clubs. When
  you manage abroad in one of those countries, England takes its seats.

The import preview lists each country, for example "England 20 clubs / 220 players; Spain 20 clubs /
220 players; Continental cup 36 clubs". It also names the countries the game has no league for (they
are ignored) and the values that failed the checks. A file's leagues apply at once to the league you play in, and to
any other league as soon as you play there. They are kept in this browser, apart from your season, so
Export league does not carry them: import the option file again on another device. A league that
appears in a newer file replaces the one you had for that country. Edit mode's own renames still win
over a file, and Revert to default names clears the file as well.

**Play in another league** (in the League panel, and the Leagues tab of edit mode) is how you reach
a league from a file when your career is somewhere else, for example the English league while you
manage in Spain. Pick the country and either start a new career there (at a club of your own, or at
any club in that league, whose eleven from the file become your first team) or move your club there
with its squad, budget, staff and career. A browser keeps one season, so your current season is
downloaded first (untick it if you don't want that), and Import league brings it back at any time.

## Working on the game

`index.html` is the one file GitHub Pages serves, and it is built, not edited. The source lives in
`src/`: `head.html`, `body-top.html`, `styles.css`, `markup.html`, `three-loader.html`, `tail.html`,
and the game script as 51 files under `src/game/` in the order given by `src/game/ORDER.txt`, one
per section of the engine (pitch geometry, clubs, the league, the simulation, rendering, the 3D
camera, input and so on). The game parts are concatenated into a single script in one shared scope,
so a change in one file sees everything the others declare, exactly as before the split.

```sh
node tools/build.mjs          # rebuild index.html from src/
node tools/build.mjs --check  # fail if index.html is not what src/ builds (run before a push)
node tests/run.mjs            # the build check, then the three browser suites
```

The browser suites under `tests/` drive headless Chrome through Playwright, which is not a
dependency of the game: set `FF_PLAYWRIGHT_FROM` to a `package.json` whose `node_modules` has
Playwright and `FF_CHROME` to a Chrome binary if the defaults in `tests/_env.mjs` do not fit.
`tests/switch.mjs` covers who you control when the ball changes hands, `tests/phone.mjs` the
portrait and landscape layouts, the settings drawer and the 60-a-second frame cap, and
`tests/move.mjs` dribbling, planting, sprinting, challenges and the 3D renderer, and `tests/club.mjs` the assistant manager's contracts, bids and signings. `tests/edit.mjs` covers edit mode and option files. Screenshots land
in `tests/out/`.

## License

MIT. See [LICENSE](LICENSE).
