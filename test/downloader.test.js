const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const test = require("node:test");

const modulePath = path.join(__dirname, "../app/common/downloader.js");
const moduleSource = fs.readFileSync(modulePath, "utf8");
const actualRequire = createRequire(modulePath);
const seasonPath = "/pgc/view/web/season";
const playPath = "/pgc/player/web/playurl";
const seasonUrl = "https://www.bilibili.com/bangumi/play/ss346962?theme=movie&";
const episode = { id: 9001, aid: 1001, bvid: "BV1Example001", cid: 2001, title: "正片", long_title: "电影正片" };

function dash() {
	return {
		dash: {
			video: [{ id: 80, width: 1920, height: 1080, mime_type: "video/mp4", codecs: "avc1", bandwidth: 1000000, base_url: "https://media.invalid/video.m4s" }],
			audio: [{ mime_type: "audio/mp4", codecs: "mp4a", bandwidth: 128000, base_url: "https://media.invalid/audio.m4s" }]
		}
	};
}

function season(episodes = [episode]) {
	return { code: 0, result: { season_id: 346962, title: "测试电影", episodes } };
}

// Every downloader gets a fresh module context, including its WBI cache. Network
// and login helpers are replaced before loading it; tests never read credentials.
function setup(t, routes) {
	const requests = [];
	const unexpected = [];
	const exported = { exports: {} };
	const fetchUrl = async (input, options = {}) => {
		const url = new URL(input);
		requests.push({ url, options });
		if (!Object.hasOwn(routes, url.pathname)) {
			unexpected.push(url.href);
			return { ok: false, status: 404, text: async () => "", json: async () => ({ code: -404 }) };
		}
		const route = routes[url.pathname];
		const body = typeof route === "function" ? await route(url, options) : route;
		return {
			ok: true,
			status: 200,
			text: async () => typeof body === "string" ? body : JSON.stringify(body),
			json: async () => JSON.parse(typeof body === "string" ? body : JSON.stringify(body))
		};
	};
	vm.runInNewContext(moduleSource, {
		module: exported,
		exports: exported.exports,
		URL, URLSearchParams, Buffer, console,
		require(id) {
			if (id === "./modules.js") return { fetchUrl };
			if (/^\.\/login\/login-helper(?:\.js)?$/.test(id)) {
				return { getLoginInfoCookies: () => ({ getCookieStringSync: () => "test_session=fixture" }) };
			}
			return actualRequire(id);
		}
	}, { filename: modulePath });
	t.after(() => assert.deepEqual(unexpected, [], "all HTTP requests must use a fixture"));
	return { downloader: new exported.exports.Downloader(), requests };
}

function ugcPage(playInfo) {
	const state = { aid: 3001, bvid: "BV1Example002", p: 2, videoData: { cid: 4002, title: "普通视频第二分P" } };
	return `<script>window.__INITIAL_STATE__=${JSON.stringify(state)};(function(){})();</script>`
		+ (playInfo ? `<script>window.__playinfo__=${JSON.stringify({ code: 0, data: playInfo })}</script>` : "");
}

test("the reported ss link resolves the first episode and exposes downloadable DASH streams", async t => {
	const { downloader, requests } = setup(t, {
		[seasonPath]: season([episode, { ...episode, id: 9002, cid: 2002 }]),
		[playPath]: { code: 0, result: dash() }
	});
	assert.equal(await downloader.getPlayUrlWebPage(seasonUrl), true);
	assert.equal(downloader.cid, episode.cid);
	assert.equal(downloader.bvid, episode.bvid);
	assert.equal(downloader.playUrlSource, "pgc");
	assert.match(downloader.videoData.title, /测试电影/);
	assert.match(downloader.videoData.title, /正片/);
	assert.match(downloader.uniqueName, /BV1Example001/);
	assert.equal(downloader.lastError, "");
	assert.equal(requests[0].url.searchParams.get("season_id"), "346962");
	const playback = requests.find(request => request.url.pathname === playPath);
	for (const [name, value] of Object.entries({ ep_id: "9001", cid: "2001", qn: "80", fnval: "4048", fnver: "0", fourk: "1" })) {
		assert.equal(playback.url.searchParams.get(name), value, name);
	}
	assert.equal(playback.options.headers.Cookie, "test_session=fixture");
	const { items } = downloader.getDownloadItems();
	assert.equal(items.length, 2);
	assert.equal(items[0].quality, "1920x1080");
	assert.equal(items[0].baseUrl, "https://media.invalid/video.m4s");
	assert.equal(items[1].type, "audio");
});

test("ep links select the requested episode from either the main list or extra sections", async t => {
	for (const inSection of [false, true]) {
		await t.test(inSection ? "extra section" : "main episodes", async t => {
			const requested = { ...episode, id: 9002, cid: 2002, bvid: "", title: "特别篇" };
			const metadata = season(inSection ? [episode] : [episode, requested]);
			if (inSection) metadata.result.section = [{ episodes: [requested] }];
			const { downloader, requests } = setup(t, {
				[seasonPath]: metadata,
				[playPath]: { code: 0, result: { durl: [{ url: "https://media.invalid/movie.mp4", size: 1234 }], quality: 80 } }
			});
			assert.equal(await downloader.getPlayUrlWebPage("https://www.bilibili.com/bangumi/play/ep9002/?theme=movie&"), true);
			assert.equal(requests[0].url.searchParams.get("ep_id"), "9002");
			assert.equal(requests.find(request => request.url.pathname === playPath).url.searchParams.get("ep_id"), "9002");
			assert.equal(downloader.cid, 2002);
			assert.match(downloader.videoData.title, /特别篇/);
			assert.match(downloader.uniqueName, /ep9002/);
			const { items } = downloader.getDownloadItems();
			assert.equal(items.length, 1);
			assert.equal(items[0].baseUrl, "https://media.invalid/movie.mp4");
		});
	}
});

test("missing episodes and empty season data fail without selecting a different episode", async t => {
	for (const [label, url, metadata] of [
		["unmatched ep", "https://www.bilibili.com/bangumi/play/ep9999", season()],
		["empty episode list", seasonUrl, season([])],
		["missing result", seasonUrl, { code: 0 }],
		["null result", seasonUrl, { code: 0, result: null }]
	]) {
		await t.test(label, async t => {
			const { downloader, requests } = setup(t, { [seasonPath]: metadata });
			assert.equal(await downloader.getPlayUrlWebPage(url), false);
			assert.ok(downloader.lastError);
			assert.equal(downloader.videoData, null);
			assert.equal(downloader.playUrl, null);
			assert.equal(requests.length, 1);
		});
	}
});

test("PGC API errors retain the service message and code", async t => {
	for (const stage of ["season", "playback"]) {
		await t.test(stage, async t => {
			const rejected = { code: -10403, message: "账号没有观看权限" };
			const { downloader } = setup(t, {
				[seasonPath]: stage === "season" ? rejected : season(),
				[playPath]: rejected
			});
			assert.equal(await downloader.getPlayUrlWebPage(seasonUrl), false);
			assert.match(downloader.lastError, /账号没有观看权限/);
			assert.match(downloader.lastError, /-10403/);
		});
	}
});

test("preview streams are labeled, and a failed next lookup clears stale media but keeps download tasks", async t => {
	let playable = true;
	const { downloader } = setup(t, {
		[seasonPath]: season(),
		[playPath]: () => ({ code: 0, result: playable ? { ...dash(), is_preview: 1 } : { dash: { video: [], audio: [] } } })
	});
	assert.equal(await downloader.getPlayUrlWebPage(seasonUrl), true);
	assert.match(downloader.warning, /试看/);
	assert.equal(downloader.getDownloadItems().items.length, 2);
	const activeTask = { url: "https://media.invalid/previous-download", finished: false };
	downloader.tasks.push(activeTask);
	playable = false;
	assert.equal(await downloader.getPlayUrlWebPage(seasonUrl), false);
	assert.ok(downloader.lastError);
	assert.equal(downloader.warning, "");
	assert.equal(downloader.videoData, null);
	assert.equal(downloader.playUrl, null);
	assert.equal(downloader.items.length, 0);
	assert.equal(downloader.tasks.length, 1);
	assert.equal(downloader.tasks[0], activeTask);
	playable = true;
	assert.equal(await downloader.getPlayUrlWebPage(seasonUrl), true);
	assert.equal(downloader.lastError, "");
});

test("invalid URLs and lookalike domains fail before any HTTP request", async t => {
	const { downloader, requests } = setup(t, {});
	for (const url of ["not a URL", "https://notbilibili.com/bangumi/play/ss346962", "https://bilibili.com.example.org/bangumi/play/ss346962"]) {
		assert.equal(await downloader.getPlayUrlWebPage(url), false, url);
		assert.ok(downloader.lastError);
	}
	assert.equal(requests.length, 0);
});

test("ordinary UGC pages still use their embedded stream and selected part", async t => {
	const { downloader, requests } = setup(t, { "/video/BV1Example002": ugcPage(dash()) });
	assert.equal(await downloader.getPlayUrlWebPage("https://www.bilibili.com/video/BV1Example002?p=2"), true);
	assert.equal(downloader.playUrlSource, "embedded");
	assert.equal(downloader.pid, 2);
	assert.equal(downloader.cid, 4002);
	assert.equal(requests.length, 1);
	assert.equal(downloader.getDownloadItems().items.length, 2);
});

test("ordinary UGC pages without embedded streams retain the signed WBI fallback", async t => {
	const { downloader, requests } = setup(t, {
		"/video/BV1Example002": ugcPage(),
		"/x/web-interface/nav": { code: 0, data: { wbi_img: { img_url: "https://i0.hdslb.com/bfs/wbi/0123456789abcdef0123456789abcdef.png", sub_url: "https://i0.hdslb.com/bfs/wbi/fedcba9876543210fedcba9876543210.png" } } },
		"/x/player/wbi/playurl": { code: 0, data: dash() }
	});
	assert.equal(await downloader.getPlayUrlWebPage("https://www.bilibili.com/video/BV1Example002?p=2"), true);
	assert.equal(downloader.playUrlSource, "wbi");
	const playback = requests.find(request => request.url.pathname === "/x/player/wbi/playurl");
	assert.equal(playback.url.searchParams.get("bvid"), "BV1Example002");
	assert.equal(playback.url.searchParams.get("cid"), "4002");
	assert.match(playback.url.searchParams.get("w_rid"), /^[a-f0-9]{32}$/);
});

test("unparseable or incompatible page state returns an explanatory failure instead of throwing", async t => {
	for (const body of ["<html>no initial state</html>", "<script>window.__INITIAL_STATE__={bad json};(function(){})();</script>", "<script>window.__INITIAL_STATE__={\"epInfo\":{\"id\":9001}};(function(){})();</script>"]) {
		await t.test(body.slice(0, 50), async t => {
			const { downloader } = setup(t, { "/video/BV1Example002": body });
			assert.equal(await downloader.getPlayUrlWebPage("https://www.bilibili.com/video/BV1Example002"), false);
			assert.ok(downloader.lastError);
			assert.equal(downloader.playUrl, null);
		});
	}
});
