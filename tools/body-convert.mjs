// Converts the Quaternius "Universal Base Characters" male body (CC0) into assets/body.bin, already fitted
// to the game's own footballer rig (41-the-footballers-in-3d.js), so every pose the game writes to that rig
// drives the new skin. Run once, by hand:
//   node tools/body-convert.mjs "<path to Superhero_Male_FullBody.gltf>"
// What it does:
//   - keeps the body mesh only (no eyes, eyebrows, and no head: the game keeps its own head, face and hair);
//   - maps the model's 65 joints onto the rig's 17 (fingers into the hand, clavicles into the chest...);
//   - moves every vertex from the model's bones onto the rig's bones in the rig's T-pose (arms out), joint
//     by joint (each joint's own scale, so the limbs take the rig's lengths), blended by the skin weights;
//   - marks each vertex as skin, shirt, shorts, sock or boot from where it sits on the body.
// Output (little endian): "FFB1", u32 vertex count, u32 index count, then float32 positions (3), float32
// normals (3), uint8 joints (4), uint8 weights (4, sum 255), uint8 region, then uint16 indices.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) { console.error("usage: node tools/body-convert.mjs <Superhero_Male_FullBody.gltf>"); process.exit(1); }
const g = JSON.parse(fs.readFileSync(src, "utf8"));
const bin = fs.readFileSync(path.join(path.dirname(src), g.buffers[0].uri));
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const ARR = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
function acc (i) {
	const a = g.accessors[i], bv = g.bufferViews[a.bufferView], T = ARR[a.componentType], n = SIZE[a.type];
	const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * T.BYTES_PER_ELEMENT;
	const out = new Float64Array(a.count * n);
	for (let k = 0; k < a.count; k++) {
		for (let c = 0; c < n; c++) {
			const o = off + k * stride + c * T.BYTES_PER_ELEMENT;
			out[k * n + c] = T === Float32Array ? bin.readFloatLE(o) : T === Uint16Array ? bin.readUInt16LE(o) : T === Uint32Array ? bin.readUInt32LE(o) : bin.readUInt8(o);
		}
	}
	return out;
}
const meshNode = g.nodes.find(n => n.mesh !== undefined && g.meshes[n.mesh].primitives[0].attributes.WEIGHTS_0 && g.accessors[g.meshes[n.mesh].primitives[0].indices].count > 20000);
const prim = g.meshes[meshNode.mesh].primitives[0], skin = g.skins[meshNode.skin];
const P = acc(prim.attributes.POSITION), Nn = acc(prim.attributes.NORMAL), J = acc(prim.attributes.JOINTS_0), W = acc(prim.attributes.WEIGHTS_0), I = acc(prim.indices);
const IBM = acc(skin.inverseBindMatrices), names = skin.joints.map(j => g.nodes[j].name);
// A joint's bind position (mesh space) from its inverse bind matrix [R s | t] (column major): the inverse's
// translation, -(R^T t) / s^2 (the matrices only turn, move and scale evenly).
function bindPos (m) {
	const s2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2], t = [ m[12], m[13], m[14] ];
	return [ 0, 4, 8 ].map(c => -(m[c] * t[0] + m[c + 1] * t[1] + m[c + 2] * t[2]) / s2);
}
// The model faces +z with its left on +x; the rig faces +x with its left (side 0) on -z. Into rig axes:
const toRig = (x, y, z) => [ z, y, -x ];
const jpos = {};
names.forEach((n, k) => { const q = bindPos(IBM.subarray(k * 16, k * 16 + 16)); jpos[n] = toRig(q[0], q[1], q[2]); });
// The rig's joints in its bind pose (arms straight out to the sides, as the model's), in rig units.
const RIG = [ "hips", "spine", "chest", "neck", "head", "sh0", "el0", "ha0", "sh1", "el1", "ha1", "hip0", "kn0", "an0", "hip1", "kn1", "an1" ];
const S = [ -1, 1 ];   // side 0 is -z
const rigPos = { hips: [ 0, 15.6, 0 ], spine: [ 0, 16.2, 0 ], chest: [ 0, 21.6, 0 ], neck: [ 0, 25.2, 0 ], head: [ 0, 26.75, 0 ] };
for (const i of [ 0, 1 ]) {
	rigPos[`sh${i}`] = [ 0, 24.35, S[i] * 4.35 ]; rigPos[`el${i}`] = [ 0, 24.35, S[i] * 9.95 ]; rigPos[`ha${i}`] = [ 0, 24.35, S[i] * 14.9 ];
	rigPos[`hip${i}`] = [ 0, 14.6, S[i] * 2.45 ]; rigPos[`kn${i}`] = [ 0, 7.3, S[i] * 2.45 ]; rigPos[`an${i}`] = [ 0, 0.8, S[i] * 2.45 ];
}
// Each rig joint: the model joint it is measured from, and its scale on the rig's x (forward), y, z.
const K = 15.2;   // rig units per metre for the body's girth (a little under true scale: the free pack's body is a superhero's)
const sideName = (b, i) => `${b}_${i ? "r" : "l"}`;
const span = (a, b, ours) => Math.abs(ours) / Math.max(1e-6, Math.hypot(...jpos[b].map((v, k) => v - jpos[a][k])));
const MAP = {
	hips: { from: "pelvis", s: [ K, K, 18 ] },
	spine: { from: "spine_01", s: [ K, 5.4 / (jpos.spine_03[1] - jpos.spine_01[1]), K * 1.08 ] },
	chest: { from: "spine_03", s: [ K, 3.6 / (jpos.neck_01[1] - jpos.spine_03[1]), 18 ] },
	neck: { from: "neck_01", s: [ K, 1.55 / (jpos.Head[1] - jpos.neck_01[1]), K ] }
};
for (const i of [ 0, 1 ]) {
	MAP[`sh${i}`] = { from: sideName("upperarm", i), s: [ K, K, span(sideName("upperarm", i), sideName("lowerarm", i), 5.6) ] };
	MAP[`el${i}`] = { from: sideName("lowerarm", i), s: [ K * 0.95, K * 0.95, span(sideName("lowerarm", i), sideName("hand", i), 4.95) ] };
	MAP[`ha${i}`] = { from: sideName("hand", i), s: [ K * 1.05, K * 1.05, K * 1.05 ] };
	MAP[`hip${i}`] = { from: sideName("thigh", i), s: [ K, span(sideName("thigh", i), sideName("calf", i), 7.3), K ] };
	MAP[`kn${i}`] = { from: sideName("calf", i), s: [ K, span(sideName("calf", i), sideName("foot", i), 6.5), K ] };
	MAP[`an${i}`] = { from: sideName("foot", i), s: [ K * 1.05, 11, K ] };   // the boot a touch flatter than true so the ankle sits at the rig's height
}
// Which rig joint each model joint drives.
function rigOf (n) {
	const m = /_(l|r)$/.exec(n), i = m ? (m[1] === "l" ? 0 : 1) : -1;
	if (n === "root" || n === "pelvis") { return "hips"; }
	if (n === "spine_01") { return "spine"; }
	if (n === "spine_02" || n === "spine_03" || n.startsWith("clavicle")) { return "chest"; }
	if (n === "neck_01") { return "neck"; }
	if (n === "Head") { return "head"; }
	if (n.startsWith("upperarm")) { return `sh${i}`; }
	if (n.startsWith("lowerarm")) { return `el${i}`; }
	if (n.startsWith("thigh")) { return `hip${i}`; }
	if (n.startsWith("calf")) { return `kn${i}`; }
	if (n.startsWith("foot") || n.startsWith("ball")) { return `an${i}`; }
	return `ha${i}`;   // the hand and fingers
}
const jointRig = names.map(rigOf);
if (process.env.DEBUG) { for (const n of [ "pelvis", "spine_03", "upperarm_l", "thigh_l", "foot_l" ]) { console.log(n, jpos[n].map(x => x.toFixed(3))); } }
const nv = P.length / 3, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), jo = new Uint8Array(nv * 4), we = new Uint8Array(nv * 4), reg = new Uint8Array(nv), topOf = new Array(nv).fill("hips");
const headW = new Float64Array(nv);
for (let v = 0; v < nv; v++) {
	const p = toRig(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]), n = toRig(Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]);
	const acc4 = new Map();
	for (let c = 0; c < 4; c++) { const w = W[v * 4 + c]; if (w > 0) { const r = jointRig[J[v * 4 + c]]; acc4.set(r, (acc4.get(r) || 0) + w); } }
	headW[v] = acc4.get("head") || 0;
	const out = [ 0, 0, 0 ], on = [ 0, 0, 0 ];
	let tot = 0;
	for (const [ r, w ] of acc4) {
		if (r === "head") { continue; }
		const M = MAP[r], o = jpos[M.from], at = rigPos[r];
		for (let k = 0; k < 3; k++) { out[k] += w * (at[k] + M.s[k] * (p[k] - o[k])); on[k] += w * n[k] / M.s[k]; }
		tot += w;
	}
	if (tot <= 0) { tot = 1; out[1] = 26; }
	const nl = Math.hypot(...on) || 1;
	for (let k = 0; k < 3; k++) { pos[v * 3 + k] = out[k] / tot; nor[v * 3 + k] = on[k] / nl; }
	// The four strongest rig joints, weights in 255ths.
	const list = [ ...acc4 ].filter(([ r ]) => r !== "head").sort((a, b) => b[1] - a[1]).slice(0, 4);
	const sum = list.reduce((s, x) => s + x[1], 0) || 1;
	// floor every share, then give what is left of the 255 to the strongest joint (never below 0, never past 255)
	let left = 255;
	list.forEach(([ r, w ], c) => { const q = Math.floor(w / sum * 255); jo[v * 4 + c] = RIG.indexOf(r); we[v * 4 + c] = q; left -= q; });
	if (list.length) { we[v * 4] += left; } else { we[v * 4] = 255; jo[v * 4] = RIG.indexOf("neck"); }
	// The kit, from where the vertex sits (model metres) and its strongest joint: 0 skin, 1 shirt, 2 shorts, 3 sock,
	// 4 boot, 5 arm below the sleeve (a long sleeve or skin), 6 hand (a keeper's glove or skin).
	const top = list.length ? list[0][0] : "hips", y = p[1];
	topOf[v] = top;
	let R = 0;
	if (top.startsWith("an")) { R = y < 0.14 ? 4 : 3; }   // the boot up to the ankle bone, the sock above
	else if (top.startsWith("kn")) { R = y < 0.11 ? 4 : y < 0.47 ? 3 : 0; }
	else if (top.startsWith("hip")) { R = y > 0.70 ? 2 : 0; }
	else if (top === "hips" || top === "spine" || top === "chest") { R = y < 0.955 ? 2 : 1; }   // one clean line at the waist
	else if (top.startsWith("sh")) { const i = +top[2], d = Math.abs(p[2] - jpos[sideName("upperarm", i)][2]); R = d < 0.13 ? 1 : 5; }
	else if (top.startsWith("el")) { R = 5; }
	else if (top.startsWith("ha")) { R = 6; }
	// the kit's trim: the collar, the sleeve cuffs and a band round the sock tops (7); the captain's band on
	// the left upper arm (8)
	const armD = top.startsWith("sh") ? Math.abs(p[2] - jpos[sideName("upperarm", +top[2])][2]) : -1;
	if (R === 1 && !top.startsWith("sh") && y > 1.455) { R = 7; }
	else if (R === 1 && armD >= 0.105) { R = 7; }
	else if (R === 3 && y > 0.43) { R = 7; }
	if (top === "sh0" && armD >= 0.14 && armD <= 0.21) { R = 8; }
	reg[v] = R;
}
// The kit sits off the skin: the shirt a little, the shorts more (loose, and wider toward the hem).
for (let v = 0; v < nv; v++) {
	const y = P[v * 3 + 1], R = reg[v];
	const lift = R === 1 ? 0.28 : R === 2 ? 0.32 + 0.5 * Math.max(0, Math.min(1, (0.93 - y) / 0.2)) : R === 3 ? 0.08 : 0;
	for (let k = 0; k < 3; k++) { pos[v * 3 + k] += nor[v * 3 + k] * lift; }
}
// The seat of the shorts drapes over the buttocks instead of following them: behind (-x; the face is +x),
// from the waist down to the top of the thighs, the cloth is pulled in toward the body's middle line.
for (let v = 0; v < nv; v++) {
	if (reg[v] !== 2 || pos[v * 3] >= 0 || pos[v * 3 + 1] < 12.2) { continue; }
	pos[v * 3] *= 0.82;
}
// ... and spans the cleft between them: across the middle of the seat, no dip behind the deepest point of each band.
{
	const deepest = new Map(), band = y => Math.round(y * 2);
	for (let v = 0; v < nv; v++) {
		if (reg[v] !== 2 || pos[v * 3] >= 0 || pos[v * 3 + 1] < 12.2 || Math.abs(pos[v * 3 + 2]) > 2.6) { continue; }
		const b = band(pos[v * 3 + 1]); deepest.set(b, Math.min(deepest.get(b) ?? 0, pos[v * 3]));
	}
	for (let v = 0; v < nv; v++) {
		if (reg[v] !== 2 || pos[v * 3] >= 0 || pos[v * 3 + 1] < 12.2) { continue; }
		const z = Math.abs(pos[v * 3 + 2]), d = deepest.get(band(pos[v * 3 + 1]));
		if (d === undefined || z > 1.4) { continue; }
		const w = 1 - z / 1.4, fill = d * 0.96;   // fully filled on the middle line, fading out over the cheeks
		if (pos[v * 3] > fill) { pos[v * 3] += (fill - pos[v * 3]) * w; }
	}
}
// Less of a superhero: the slope from the neck to the shoulders (the trapezius) comes down, and the upper back
// is a little narrower. Only the shirt and its trim over the chest, spine and neck; the arms and the joints stay.
for (let v = 0; v < nv; v++) {
	if (reg[v] !== 1 && reg[v] !== 7) { continue; }
	const t = topOf[v];
	if (t !== "chest" && t !== "neck" && t !== "spine") { continue; }
	const y = pos[v * 3 + 1], z = Math.abs(pos[v * 3 + 2]);
	if (y < 21) { continue; }
	const up = Math.min(1, (y - 21) / 3), mid = Math.max(0, 1 - Math.abs(z - 2.5) / 1.6);   // highest between the neck and the shoulder
	pos[v * 3 + 1] -= 0.7 * up * mid;
	if (z > 2.2) { pos[v * 3 + 2] *= 1 - 0.05 * up; }
	if (pos[v * 3] < 0) { pos[v * 3] *= 1 - 0.06 * up; }   // the hump of the upper back, a little flatter
}
// Football shorts hang: on each thigh they are a tube that flares to the hem, not cloth painted on the leg.
// Round each leg's axis (hip to knee, rig units) every shorts vertex is pushed out to at least a cone's radius:
// the leg's own widest at the top, about a tenth more at the hem. Inward never; the buttocks' curve is filled.
for (const i of [ 0, 1 ]) {
	const A = rigPos[`hip${i}`], B = rigPos[`kn${i}`], ax = [ B[0] - A[0], B[1] - A[1], B[2] - A[2] ], L = Math.hypot(...ax), u = ax.map(c => c / L);
	const legShorts = [];
	for (let v = 0; v < nv; v++) {
		if (reg[v] !== 2 || !topOf[v].startsWith(`hip${i}`)) { continue; }
		const q = [ pos[v * 3] - A[0], pos[v * 3 + 1] - A[1], pos[v * 3 + 2] - A[2] ], t = q[0] * u[0] + q[1] * u[1] + q[2] * u[2];
		const r = [ q[0] - u[0] * t, q[1] - u[1] * t, q[2] - u[2] * t ], d = Math.hypot(...r) || 1e-6;
		legShorts.push({ v, t: t / L, r, d });
	}
	if (!legShorts.length) { continue; }
	// The top width is the thigh's typical (median) reach round the axis, not its widest point: the widest is the
	// buttock, and a tube that wide on every side hung off the legs like a skirt.
	const tMax = Math.max(...legShorts.map(x => x.t)), tops = legShorts.filter(x => x.t < tMax * 0.35).map(x => x.d).sort((a, b) => a - b), dTop = Math.max(tops[Math.floor(tops.length / 2)] || 0, 0.1);
	for (const x of legShorts) {
		const f = Math.max(0, Math.min(1, x.t / (tMax || 1))), want = dTop * (1.0 + 0.06 * f);   // a gentle cone: the thigh's width at the top, 6% more at the hem
		if (x.d >= want) { continue; }
		const k = want / x.d;
		for (let c = 0; c < 3; c++) { pos[x.v * 3 + c] = A[c] + u[c] * x.t * L + x.r[c] * k; }
	}
}
// Drop the head (the game keeps its own) and anything left on it.
const keep = [];
for (let t = 0; t < I.length; t += 3) {
	if (headW[I[t]] > 0.5 || headW[I[t + 1]] > 0.5 || headW[I[t + 2]] > 0.5) { continue; }
	keep.push(I[t], I[t + 1], I[t + 2]);
}
// Compact the vertices that are still used.
const used = new Int32Array(nv).fill(-1);
let m = 0;
for (const i of keep) { if (used[i] < 0) { used[i] = m++; } }
const buf = Buffer.alloc(12 + m * (12 + 12 + 4 + 4 + 1) + keep.length * 2);
buf.write("FFB1", 0, "ascii"); buf.writeUInt32LE(m, 4); buf.writeUInt32LE(keep.length, 8);
let o = 12;
const order = new Int32Array(m);
for (let v = 0; v < nv; v++) { if (used[v] >= 0) { order[used[v]] = v; } }
for (const v of order) { for (let k = 0; k < 3; k++) { buf.writeFloatLE(pos[v * 3 + k], o); o += 4; } }
for (const v of order) { for (let k = 0; k < 3; k++) { buf.writeFloatLE(nor[v * 3 + k], o); o += 4; } }
for (const v of order) { for (let k = 0; k < 4; k++) { buf.writeUInt8(jo[v * 4 + k], o++); } }
for (const v of order) { for (let k = 0; k < 4; k++) { buf.writeUInt8(we[v * 4 + k], o++); } }
for (const v of order) { buf.writeUInt8(reg[v], o++); }
for (const i of keep) { buf.writeUInt16LE(used[i], o); o += 2; }
fs.mkdirSync(path.join(root, "assets"), { recursive: true });
fs.writeFileSync(path.join(root, "assets", "body.bin"), buf);
const counts = [ 0, 0, 0, 0, 0, 0, 0, 0, 0 ]; for (const v of order) { counts[reg[v]]++; }
console.log(`assets/body.bin: ${m} vertices, ${keep.length / 3} triangles, ${buf.length} bytes; skin/shirt/shorts/sock/boot/arm/hand/trim/band ${counts.join("/")}`);
