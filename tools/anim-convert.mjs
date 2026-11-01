// Converts recorded movement clips (Quaternius "Universal Animation Library", CC0, the same 65-joint skeleton
// as the body) into assets/anims.bin: for each chosen clip, the footballer rig's 17 joint turns (local
// quaternions in the rig's own frames) at 30 frames a second, so the game can play them on its rig.
//   node tools/anim-convert.mjs "<path to the library .gltf>" [name filter regex]
// How: for every frame, each model joint's turn away from its bind pose (in world space) is put on the
// matching rig joint's bind pose (the rig in its T-pose: arms straight out), then made local to its parent.
// Output (little endian): "FFA1", u32 clip count; per clip: u8 name length, name (ascii), f32 seconds,
// u32 frames, then frames x (17 x 4 f32 quaternions + 1 f32 hip height change in rig units).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2], filter = new RegExp(process.argv[3] || "^(Idle|Jog|Run|Sprint|Walk)", "i");
if (!src) { console.error("usage: node tools/anim-convert.mjs <library.gltf> [regex]"); process.exit(1); }
// A .glb holds the JSON and the binary in one file (two chunks); a .gltf points at its .bin.
let g, bins;
if (src.endsWith(".glb")) {
	const f = fs.readFileSync(src), jl = f.readUInt32LE(12);
	g = JSON.parse(f.toString("utf8", 20, 20 + jl));
	const bo = 20 + jl, bl = f.readUInt32LE(bo);
	bins = [ f.subarray(bo + 8, bo + 8 + bl) ];
} else {
	g = JSON.parse(fs.readFileSync(src, "utf8"));
	bins = g.buffers.map(b => fs.readFileSync(path.join(path.dirname(src), b.uri)));
}
if (process.env.LIST) { console.log((g.animations || []).map(a => a.name).join("\n")); process.exit(0); }
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function acc (i) {
	const a = g.accessors[i], bv = g.bufferViews[a.bufferView], bin = bins[bv.buffer || 0], n = SIZE[a.type];
	const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * 4, out = new Float64Array(a.count * n);
	if (a.componentType !== 5126) { throw new Error("only float animation data is handled"); }
	for (let k = 0; k < a.count; k++) { for (let c = 0; c < n; c++) { out[k * n + c] = bin.readFloatLE(off + k * stride + c * 4); } }
	return out;
}
// Quaternions [x, y, z, w].
const qmul = (a, b) => [ a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2] ];
const qinv = a => [ -a[0], -a[1], -a[2], a[3] ];
const qrot = (q, v) => { const p = qmul(qmul(q, [ v[0], v[1], v[2], 0 ]), qinv(q)); return [ p[0], p[1], p[2] ]; };
const qnorm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
const slerp = (a, b, t) => {
	let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b;
	if (d < 0) { d = -d; bb = b.map(x => -x); }
	if (d > 0.9995) { return qnorm(a.map((x, k) => x + (bb[k] - x) * t)); }
	const th = Math.acos(d), s = Math.sin(th);
	return a.map((x, k) => (x * Math.sin((1 - t) * th) + bb[k] * Math.sin(t * th)) / s);
};
const axis = (x, y, z, ang) => { const s = Math.sin(ang / 2); return [ x * s, y * s, z * s, Math.cos(ang / 2) ]; };
// Model axes -> rig axes: (x, y, z) -> (z, y, -x), a quarter turn about y.
const C = axis(0, 1, 0, Math.PI / 2), Ci = qinv(C);
const N = g.nodes, parent = {};
N.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
const byName = {}; N.forEach((n, i) => { if (n.name) { byName[n.name] = i; } });
// World rotation and position of a node, from per-node local TRS (overrides for the animated ones).
function world (i, L) {
	const chain = []; for (let k = i; k !== undefined; k = parent[k]) { chain.push(k); }
	let q = [ 0, 0, 0, 1 ], p = [ 0, 0, 0 ];
	for (const k of chain.reverse()) {
		const l = L[k] || {}, n = N[k], t = l.t || n.translation || [ 0, 0, 0 ], r = l.r || n.rotation || [ 0, 0, 0, 1 ], s = (n.scale || [ 1, 1, 1 ])[0];
		const tt = qrot(q, t.map(x => x * s)); p = p.map((x, c) => x + tt[c]); q = qmul(q, r);
	}
	return { q, p };
}
// The rig's joints, their parents (index into this list, -1 = the root) and the model joint each copies.
const RIG = [
	[ "hips", -1, "pelvis" ], [ "spine", 0, "spine_01" ], [ "chest", 1, "spine_03" ], [ "neck", 2, "neck_01" ], [ "head", 3, "Head" ],
	[ "sh0", 2, "upperarm_l" ], [ "el0", 5, "lowerarm_l" ], [ "ha0", 6, "hand_l" ], [ "sh1", 2, "upperarm_r" ], [ "el1", 8, "lowerarm_r" ], [ "ha1", 9, "hand_r" ],
	[ "hip0", 0, "thigh_l" ], [ "kn0", 11, "calf_l" ], [ "an0", 12, "foot_l" ], [ "hip1", 0, "thigh_r" ], [ "kn1", 14, "calf_r" ], [ "an1", 15, "foot_r" ]
];
for (const [ , , m ] of RIG) { if (byName[m] === undefined) { console.error(`the library has no joint "${m}"`); process.exit(1); } }
// The rig's bind (T-pose) world turns: only the arms are turned (+x on side 0, -x on side 1: out to the side).
const OUT = [ axis(1, 0, 0, Math.PI / 2), axis(1, 0, 0, -Math.PI / 2) ];
const rigBind = RIG.map(([ n ]) => (/^(sh|el|ha)0/.test(n) ? OUT[0] : /^(sh|el|ha)1/.test(n) ? OUT[1] : [ 0, 0, 0, 1 ]));
// The model's bind turns: its rest pose (no animation).
const modelBind = RIG.map(([ , , m ]) => world(byName[m], {}).q);
const pelvisRestY = world(byName.pelvis, {}).p[1];
if (process.env.REST) { for (const n of [ "pelvis", "upperarm_l", "lowerarm_l", "hand_l", "thigh_l", "calf_l", "foot_l" ]) { console.log(n, world(byName[n], {}).p.map(x => x.toFixed(3)).join(" ")); } console.log("root scale", JSON.stringify(N[byName.root] && N[byName.root].scale), "root rot", JSON.stringify(N[byName.root] && N[byName.root].rotation)); process.exit(0); }
const FPS = 30, clips = [];
for (const an of g.animations || []) {
	if (!filter.test(an.name)) { continue; }
	// The channels as samplers per node and path.
	const ch = {}; let len = 0;
	for (const c of an.channels) {
		const s = an.samplers[c.sampler], t = acc(s.input), v = acc(s.output), n = c.target.path === "rotation" ? 4 : 3;
		(ch[c.target.node] = ch[c.target.node] || {})[c.target.path] = { t, v, n };
		len = Math.max(len, t[t.length - 1]);
	}
	const sample = (S, time) => {
		const { t, v, n } = S; let k = 0;
		while (k < t.length - 2 && t[k + 1] < time) { k++; }
		const a = Array.from(v.subarray(k * n, k * n + n)), b = Array.from(v.subarray((k + 1) * n, (k + 1) * n + n));
		const u = t.length < 2 ? 0 : Math.max(0, Math.min(1, (time - t[k]) / ((t[k + 1] - t[k]) || 1)));
		return n === 4 ? slerp(a, b, u) : a.map((x, c) => x + (b[c] - x) * u);
	};
	const frames = Math.max(2, Math.round(len * FPS)), data = [];
	for (let f = 0; f < frames; f++) {
		const time = f / FPS, L = {};
		for (const k in ch) { L[k] = { r: ch[k].rotation && sample(ch[k].rotation, time), t: ch[k].translation && sample(ch[k].translation, time) }; }
		const W = RIG.map(([ , , m ]) => world(byName[m], L));
		// each rig joint's world turn: the model joint's turn from its bind, in rig axes, on the rig's bind
		const R = RIG.map((j, k) => { const d = qmul(W[k].q, qinv(modelBind[k])); return qnorm(qmul(qmul(qmul(C, d), Ci), rigBind[k])); });
		const local = RIG.map(([ , par ], k) => (par < 0 ? R[k] : qnorm(qmul(qinv(R[par]), R[k]))));
		data.push(local, (W[0].p[1] - pelvisRestY) * 15.2 / ((N[byName.root] && N[byName.root].scale) ? N[byName.root].scale[0] : 1));
	}
	clips.push({ name: an.name, len, frames, data });
}
if (!clips.length) { console.error("no clips matched; names: " + (g.animations || []).map(a => a.name).join(", ")); process.exit(1); }
const parts = [ Buffer.from("FFA1", "ascii"), Buffer.alloc(4) ];
parts[1].writeUInt32LE(clips.length, 0);
for (const c of clips) {
	const nm = Buffer.from(c.name.slice(0, 255), "ascii"), h = Buffer.alloc(1 + nm.length + 8);
	h.writeUInt8(nm.length, 0); nm.copy(h, 1); h.writeFloatLE(c.len, 1 + nm.length); h.writeUInt32LE(c.frames, 5 + nm.length);
	const body = Buffer.alloc(c.frames * (17 * 4 + 1) * 4);
	let o = 0;
	for (let f = 0; f < c.frames; f++) {
		for (const q of c.data[f * 2]) { for (const x of q) { body.writeFloatLE(x, o); o += 4; } }
		body.writeFloatLE(c.data[f * 2 + 1], o); o += 4;
	}
	parts.push(h, body);
}
const out = Buffer.concat(parts);
fs.mkdirSync(path.join(root, "assets"), { recursive: true });
fs.writeFileSync(path.join(root, "assets", "anims.bin"), out);
console.log(`assets/anims.bin: ${clips.length} clips (${clips.map(c => `${c.name} ${c.len.toFixed(2)}s`).join(", ")}), ${out.length} bytes`);
