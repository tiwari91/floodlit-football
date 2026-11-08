// Run: node tests/props.mjs   The Polyfork match-day kit round the pitch: loaded, merged, at true size, not on Light.
import { launch, serve, sleep, tally, OUT } from "./_env.mjs";
const server = serve(8813), URL = server.url;
const { check, done } = tally();
const browser = await launch();
const props = page => page.evaluate(() => {
	const F = window.__ff, G = F.G3, out = { FW: F.FW, FH: F.FH, meshes: [] };
	for (const o of G.stadium.children) {
		if (!o.userData.props) { continue; }
		o.geometry.computeBoundingBox();
		const b = o.geometry.boundingBox;
		out.meshes.push({ side: o.userData.props, verts: o.geometry.attributes.position.count, top: +b.max.y.toFixed(1), low: +b.min.y.toFixed(2), x: [ Math.round(b.min.x), Math.round(b.max.x) ], z: [ Math.round(b.min.z), Math.round(b.max.z) ] });
	}
	return out;
});
async function open (fmt, gfx) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errs = [];
	page.on("pageerror", e => errs.push("pageerror: " + e.message));
	page.on("console", m => { if ((m.type() === "error" && !/GL Driver/.test(m.text())) || /Polyfork/.test(m.text())) { errs.push(m.text().slice(0, 160)); } });
	await page.addInitScript(([ f, g ]) => { localStorage.setItem("ff-cam2", "tv"); localStorage.setItem("ff-fmt", f); localStorage.setItem("ff-gfx", g); localStorage.setItem("ff-mode", "friendly"); }, [ fmt, gfx ]);
	await page.goto(URL); await sleep(1500);
	await page.click("#ovButton"); await sleep(6500);
	return { ctx, page, errs };
}
for (const fmt of [ "11", "6", "5" ]) {
	const { ctx, page, errs } = await open(fmt, "high");
	const p = await props(page);
	const near = p.meshes.find(m => m.side === "near"), far = p.meshes.find(m => m.side === "far");
	check(`${fmt}-a-side: two prop meshes (near and far), standing on the ground`, p.meshes.length === 2 && near && far && p.meshes.every(m => Math.abs(m.low) < 0.05), JSON.stringify(p));
	// true size: the tallest prop is the ball cart (1.15 m above its base is about 1.7 m in all, 16 units a metre)
	check(`${fmt}-a-side: at true size (nothing taller than 2 m = 32 units)`, p.meshes.every(m => m.top > 3 && m.top < 32), JSON.stringify(p.meshes.map(m => m.top)));
	check(`${fmt}-a-side: no console errors`, errs.length === 0, errs.join(" | "));
	if (fmt === "11") {
		// Pictures: the left end and a dugout, the near side shown, rendered straight from a set camera.
		const mid = (p.FH * 0.1 + 14 + p.FH / 2 - 242) / 2;   // the end props' spot, as built
		const shots = [ [ "end-left-bin", [ 90, 45, mid + 40 ], [ -26, 6, mid ] ], [ "end-left-trolley", [ 90, 45, p.FH - mid - 40 ], [ -26, 6, p.FH - mid ] ], [ "end-right-stretcher", [ p.FW - 90, 45, mid + 40 ], [ p.FW + 26, 6, mid ] ], [ "end-right-cart", [ p.FW - 90, 45, p.FH - mid - 40 ], [ p.FW + 26, 6, p.FH - mid ] ], [ "dugout", [ p.FW / 2 - 300, 60, p.FH - 60 ], [ p.FW / 2 - 300, 6, p.FH + 20 ] ], [ "warmup-crate", [ 70, 40, 60 ], [ 36, 4, -6 ] ] ];
		for (const [ name, eye, at ] of shots) {
			const url = await page.evaluate(([ e, a ]) => {
				const F = window.__ff, G = F.G3; F.freeze = 1e9;
				for (const o of G.nearRoof || []) { o.visible = true; }
				const cam = G.cam.clone(); cam.position.set(...e); cam.lookAt(...a); cam.fov = 40; cam.updateProjectionMatrix();
				G.renderer.render(G.scene, cam);
				return G.renderer.domElement.toDataURL("image/png");
			}, [ eye, at ]);
			const fs = await import("node:fs");
			fs.writeFileSync(`${OUT}/props-${name}.png`, Buffer.from(url.split(",")[1], "base64"));
		}
	}
	await ctx.close();
}
{
	const { ctx, page, errs } = await open("11", "light");
	const p = await props(page);
	check("Light: no props at all (and nothing fetched)", p.meshes.length === 0, JSON.stringify(p.meshes));
	check("Light: no console errors", errs.length === 0, errs.join(" | "));
	await ctx.close();
}
await browser.close();
process.exit(done() ? 1 : 0);
