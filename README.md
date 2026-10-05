# Floodlit Football

A top-down football game in one HTML file: 11, 6 or 5-a-side, a 20-club league over 38 rounds, transfers and upgrades, fitness and rotation, weather, offside, corners, throw-ins, fouls, free kicks, penalties, cards and injuries, substitutions, match reports and a season simulator.

**Play:** https://tiwari91.github.io/floodlit-football/

Controls: arrows move, S pass, W through ball, Q long ball (a cross from out wide, a chip near goal), D shoot (hold for power; a power bar runs along the bottom of the pitch), A tackle (hold to close the carrier down), E sprint, 1–4 or T tactic, P or Esc pause, C camera, F big pitch, H how to play. Press H (or any How to play button) for a one-screen guide to every control on a keyboard, a phone or a controller, and what the markers on the pitch mean; the kick-off card shows the keys for your first three matches. Your league saves in your browser.

The ball has height. Long balls, crosses, corners and chips go up and come down on a real arc, and crosses and corners bend in the air: in-swingers curl towards goal and out-swingers away. Players attack a dropping ball, go up for headers and can head it in, on or clear. Keepers come off their line for crosses into their area and catch, punch or flap. On your corners, S whips an in-swinger at the near post, Q floats an out-swinger to the far post and W drops one on the penalty spot. Your runners wait around the spot and attack their zones as the ball is struck, each marked goal-side, with two defenders holding the near post and the six-yard line. Central and in range, Q chips the keeper.

**Corner shootout** (the fourth mode button) is a practice game of corners: five each, taken in turn, and a goal is a point. Level after ten, it goes to sudden death. You take yours and defend theirs, and a results card shows each side's corners, goals, headers, claims and clearances. It doesn't touch your season.

Three cameras, switched with the Camera button or C: overhead, TV, and a 3D view drawn with three.js. In 3D the players are jointed figures in their kits, with numbers on their backs and keepers in their own colours, who run, pass, shoot, head, slide, dive, take throw-ins and go down when fouled. A referee and two assistants wear a bright kit picked to clash with neither side, and the assistants raise their flags for offside and when the ball goes out. 3D is the default on a laptop or desktop with WebGL, overhead on a phone; without WebGL, or if three.js cannot load, the 2D cameras stay.

The grounds are Mexican-style stadiums, each in one of three shapes: a two-tier bowl with a ring of lit private boxes and a ring roof on masts, one tall oval tier under a ring roof, or a tight two-tier rectangle with roofs on the long sides and mountains behind. They have floodlights along the roof or on lattice towers, aisles through the seats and nets that bulge and swing. The grass is mown in each ground's pattern, worn in the goalmouths and wet under the lights in the rain. Every seat holds a fan in the home or away colours: they sway, rise for a chance, hold their heads at a near miss, erupt at a goal and start a Mexican wave in a quiet spell. The crowd is partisan: the home end roars its side's chances, cheers its keeper's saves and applauds its tackles and clearances, with a wave of the home colours through the stands; when the visitors attack it goes tense and quiet, their chances and saves get a murmur, and a foul by the visitors gets boos and whistles, while the away corner celebrates its own side's moments. Their synthesised noise swells with each home attack, with a drum under the chants (the Sound button silences it). The menus play a Mexican-style anthem of trumpets, guitarrón, vihuela, güiro and drums.

Defending is a team job. The nearest man closes the carrier down goal-side rather than charging at the ball, a second defender covers behind him on the line to goal, and markers track their runners goal-side, reading where they are going. Keepers come off their line to narrow the angle as an attacker closes in and rush out to smother a one-on-one, which is when a chip (Q) is on.

Like a TV broadcast:
- a score bug in each side's colours that flashes for a goal;
- captions for goals, cards and substitutions;
- a camera sweep at each kick-off;
- after a goal in 3D, an instant slow-motion replay from behind or beside the goal.

Any key or tap skips the replay, and the match clock is stopped throughout.

Graphics (Low, Medium or High, under the pitch and on the pause card) sets how much the 3D view draws: crowd density and detail, the floodlight towers' lattice, the players' floodlight shadows, pixel ratio and antialiasing. Phones start on Low (big tablets on Medium) and computers on High; your choice is remembered.

Settings sit under the pitch in four groups (your team, the match, controls and view, sound and rules); the pause and half-time cards carry the mid-match ones (tactic, camera, auto switch, sound, music, hints, kit contrast, Graphics). Auto switch picks how control moves when you defend: Assisted, Manual only or Aggressive. Kit contrast dresses the other side in white or black with a dashed ring for colour vision that struggles with red on green. Half time and full time show both sides' possession, shots, passes, pass accuracy, tackles, corners, fouls and cards.

On a phone, landscape fills the screen with the pitch and floats the joystick and pads over it; portrait keeps a tall pitch with the controls below. Xbox and PlayStation controllers work too.

## License

MIT. See [LICENSE](LICENSE).
