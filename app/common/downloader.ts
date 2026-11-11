const fs = require("fs");
const crypto = require("crypto");
const { pipeline } = require('stream');
const { promisify } = require('util');
const progress = require("progress-stream");
const { CookieJar } = require('tough-cookie');
const LoginHelper = require('./login/login-helper');
const { fetchUrl } = require('./modules.js');
const streamPipeline = promisify(pipeline);

const REGEX_PLAY_INFO = /<script>window\.__playinfo__=(.*?)<\/script>/;
const REGEX_INITIAL_STATE = /__INITIAL_STATE__=(.*?);\(function\(\)/;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36";
const BILIBILI_URL = "https://www.bilibili.com";
const BILIBILI_API_URL = "https://api.bilibili.com";
const WBI_MIXIN_KEY_ENC_TAB = [
	46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
	33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
	61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
	36, 20, 34, 44, 52
];

let wbiKeyCache = {
	key: "",
	timestamp: 0
};

function createHeaders(url, referer = BILIBILI_URL, origin = BILIBILI_URL) {
	const headers: Record<string, string> = {
		'User-Agent': USER_AGENT,
		'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
		'accept-encoding': 'gzip, deflate, br'
	};

	if (referer) headers.Referer = referer;
	if (origin) headers.Origin = origin;

	const cookies = LoginHelper.getLoginInfoCookies();
	if (cookies) {
		headers.Cookie = cookies.getCookieStringSync(url);
	}

	return headers;
}

async function requestWeb(url, referer = null, method = 'GET', parameters = null, retry = 3, needRandomBvuid3 = false) {
	if (retry <= 0) {
		return '';
	}

	const headers: Record<string, string> = {
		'User-Agent': USER_AGENT, // replace with actual user agent
		'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
		'accept-encoding': 'gzip, deflate, br'
	};

	if (referer) {
		headers.Referer = referer;
	}

	if (!url.includes('getLogin')) {
		headers.origin = 'https://m.bilibili.com';

		const cookies = LoginHelper.getLoginInfoCookies();
		if (cookies) {
			headers.Cookie = cookies.getCookieStringSync(url);
		} else {
			const cookieJar = new CookieJar();
			if (needRandomBvuid3) {
				cookieJar.setCookieSync(`buvid3=${getRandomBuvid3()}; Domain=.bilibili.com; Path=/`, url);
			}
			headers.Cookie = cookieJar.getCookieStringSync(url);
		}
	}

	let requestOptions = { method, headers };

	if (method === 'POST' && parameters) {
		const searchParams = new URLSearchParams();
		for (const key in parameters) {
			searchParams.append(key, parameters[key]);
		}
		url += '?' + searchParams.toString();
	}

	try {
		const response = await fetchUrl(url, requestOptions);

		let html = await response.text();

		return html;
	} catch (error) {
		console.error(`RequestWeb()发生异常: ${error}`);
		return requestWeb(url, referer, method, parameters, retry - 1, needRandomBvuid3);
	}
}

async function requestJson(url, referer = BILIBILI_URL, retry = 3) {
	if (retry <= 0) return null;
	try {
		const response = await fetchUrl(url, {
			redirect: 'follow',
			headers: createHeaders(url, referer)
		});
		if (!response.ok) return null;
		return await response.json();
	} catch (error) {
		console.error(`RequestJson()发生异常: ${error}`);
		return requestJson(url, referer, retry - 1);
	}
}

function getKeyFromUrl(url) {
	try {
		return new URL(url).pathname.split('/').pop().split('.')[0];
	} catch {
		const match = String(url).match(/\/([^/?#]+)\.[^./?#]+(?:[?#].*)?$/);
		return match ? match[1] : "";
	}
}

function getMixinKey(originKey) {
	return WBI_MIXIN_KEY_ENC_TAB.map(index => originKey[index]).join("").slice(0, 32);
}

async function getWbiKey(videoId) {
	if (wbiKeyCache.key && Date.now() - wbiKeyCache.timestamp < 30 * 1000) {
		return wbiKeyCache.key;
	}

	const response = await requestJson(`${BILIBILI_API_URL}/x/web-interface/nav`, BILIBILI_URL);
	const imgUrl = response && response.data && response.data.wbi_img && response.data.wbi_img.img_url;
	const subUrl = response && response.data && response.data.wbi_img && response.data.wbi_img.sub_url;
	const key = getMixinKey(`${getKeyFromUrl(imgUrl)}${getKeyFromUrl(subUrl)}`);
	if (!key) {
		throw new Error(`Unable to get WBI key for ${videoId}`);
	}
	wbiKeyCache = {
		key,
		timestamp: Date.now()
	};
	return key;
}

function encodeWbiValue(value) {
	return String(value).split("").filter(char => !`!'()*`.includes(char)).join("");
}

function signWbiParams(params, mixinKey) {
	const signedParams = {
		...params,
		wts: Math.round(Date.now() / 1000)
	};
	const query = Object.keys(signedParams).sort().map(key => {
		return `${encodeURIComponent(key)}=${encodeURIComponent(encodeWbiValue(signedParams[key]))}`;
	}).join("&");
	const wRid = crypto.createHash("md5").update(`${query}${mixinKey}`).digest("hex");
	return `${query}&w_rid=${wRid}`;
}

function getRandomString(min, max) {
	const length = min + Math.floor(Math.random() * (max - min + 1));
	const source = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += source[Math.floor(Math.random() * source.length)];
	}
	return result;
}

function getDmParams() {
	const random = Math.floor(114 * Math.random());
	const width = 1920;
	const height = 1080;
	return {
		dm_img_list: "[]",
		dm_img_str: Buffer.from(getRandomString(16, 64)).toString("base64").replace(/=+$/, ""),
		dm_cover_img_str: Buffer.from(getRandomString(32, 128)).toString("base64").replace(/=+$/, ""),
		dm_img_inter: JSON.stringify({
			ds: [],
			wh: [2 * width + 2 * height + 3 * random, 4 * width - height + random, random],
			of: [30 + random, 0 + random, random]
		})
	};
}

function normalizePlayUrl(playUrl) {
	if (!playUrl) return null;
	if (playUrl.data) return playUrl.data;
	if (playUrl.dash || playUrl.durl) return playUrl;
	if (playUrl.result && typeof playUrl.result === "object") return playUrl.result;
	return null;
}

function hasPlayableStream(playUrl) {
	return Boolean(playUrl && (
		(playUrl.dash && playUrl.dash.video && playUrl.dash.video.length) ||
		(playUrl.durl && playUrl.durl.length)
	));
}

function getApiResult(response, action) {
	if (!response) throw new Error(`${action}失败，请检查网络后重试`);
	if (response.code !== 0) {
		throw new Error(`${action}失败：${response.message || response.msg || "未知错误"}（错误码 ${response.code}）`);
	}
	const result = response.result || response.data;
	if (!result) throw new Error(`${action}失败：接口未返回数据`);
	if (result.code != null && Number(result.code) !== 0) {
		throw new Error(`${action}失败：${result.message || "未知错误"}（错误码 ${result.code}）`);
	}
	return result;
}

async function requestPlayUrlWbiApi(bvid, cid, referer) {
	const params = {
		bvid,
		cid,
		qn: 80,
		fnval: 4048,
		fnver: 0,
		fourk: 1,
		...getDmParams()
	};
	const query = signWbiParams(params, await getWbiKey(bvid));
	const playUrl = await requestJson(`${BILIBILI_API_URL}/x/player/wbi/playurl?${query}`, referer);
	return normalizePlayUrl(playUrl);
}

async function requestPlayUrlApi(bvid, cid, referer) {
	const params = new URLSearchParams({
		bvid,
		cid: String(cid),
		qn: "80",
		fnval: "4048",
		fnver: "0",
		fourk: "1",
		otype: "json",
		type: ""
	});
	const playUrl = await requestJson(`${BILIBILI_API_URL}/x/player/playurl?${params.toString()}`, referer);
	return normalizePlayUrl(playUrl);
}

async function requestBestPlayUrl(embeddedPlayUrl, bvid, cid, referer) {
	const embedded = normalizePlayUrl(embeddedPlayUrl);
	if (hasPlayableStream(embedded)) return { data: embedded, source: "embedded" };

	const wbiPlayUrl = await requestPlayUrlWbiApi(bvid, cid, referer);
	if (hasPlayableStream(wbiPlayUrl)) return { data: wbiPlayUrl, source: "wbi" };

	const legacyPlayUrl = await requestPlayUrlApi(bvid, cid, referer);
	if (hasPlayableStream(legacyPlayUrl)) return { data: legacyPlayUrl, source: "legacy" };

	return { data: null, source: "" };
}

class Task {
	declare url;
	declare finished;

	constructor(url) {
		this.url = url;
		this.finished = false;
	}
}

class Downloader {
	declare aid;
	declare bvid;
	declare pid;
	declare cid;
	declare videoData;
	declare playUrl;
	declare playUrlSource;
	declare items;
	declare tasks;
	declare epid;
	declare lastError;
	declare warning;

	constructor() {
		this.resetVideoInfo();
		this.tasks = [];
	}

	resetVideoInfo() {
		this.aid = -1;
		this.bvid = -1;
		this.pid = 1;
		this.cid = -1;
		this.epid = null;
		this.videoData = null;
		this.playUrl = null;
		this.playUrlSource = "";
		this.items = [];
		this.lastError = "";
		this.warning = "";
	}

	getVideoInfoFromInitialState(state) {
		this.aid = state.aid;
		this.bvid = state.bvid;
		this.pid = state.p;
		this.cid = state.videoData.cid;
		this.videoData = state.videoData;
	}

	get uniqueName() {
		return `[${this.bvid || `ep${this.epid}`}]${this.videoData.title}`;
	}

	async getBangumiPlayUrl(url, type, id) {
		const parameter = type === "ss" ? "season_id" : "ep_id";
		const season = getApiResult(await requestJson(
			`${BILIBILI_API_URL}/pgc/view/web/season?${parameter}=${id}`, url
		), "获取番剧/影视信息");
		const episodes = season.episodes || [];
		const allEpisodes = [...episodes, ...(season.section || []).flatMap(section => section.episodes || [])];
		// ss 指向整季，默认解析第一集；ep 必须匹配指定集数，不能回退到其他集。
		const episode = type === "ss" ? episodes[0] : allEpisodes.find(item => String(item.id) === id);
		if (!episode || !episode.id || !episode.cid) {
			throw new Error(type === "ss" ? "该番剧/影视暂无可播放的正片" : "未找到链接指定的剧集");
		}
		this.epid = episode.id;
		this.aid = episode.aid;
		this.bvid = episode.bvid || "";
		this.cid = episode.cid;
		this.pid = Math.max(1, allEpisodes.indexOf(episode) + 1);
		const episodeTitle = [episode.title, episode.long_title].filter(Boolean).join(" ");
		this.videoData = {
			title: [season.title, episodeTitle].filter(Boolean).join(" - ") || `ep${episode.id}`,
			pic: episode.cover || season.cover || "",
			desc: season.evaluate || "",
			aid: this.aid,
			bvid: this.bvid,
			cid: this.cid,
			ep_id: this.epid,
			season_id: season.season_id
		};
		const params = new URLSearchParams({
			ep_id: String(this.epid),
			cid: String(this.cid),
			qn: "80",
			fnval: "4048",
			fnver: "0",
			fourk: "1"
		});
		const playUrl = getApiResult(await requestJson(
			`${BILIBILI_API_URL}/pgc/player/web/playurl?${params.toString()}`, url
		), "获取番剧/影视播放地址");
		if (playUrl.is_drm) throw new Error("该番剧/影视使用 DRM 加密，暂不支持下载");
		if (!hasPlayableStream(playUrl)) {
			throw new Error("未获取到可下载的番剧/影视视频流，请检查账号的观看权限");
		}
		this.playUrl = playUrl;
		this.playUrlSource = "pgc";
		if (Number(playUrl.is_preview) === 1) {
			this.warning = "当前账号只能获取试看内容，下载结果不是完整版。请确认该账号具有此影片的观看权限。";
		}
		return true;
	}

	async getPlayUrlWebPage(url) {
		this.resetVideoInfo();
		let parsedUrl;
		try {
			parsedUrl = new URL(url);
		} catch {
			this.lastError = "无效的视频链接，请输入完整的 Bilibili 播放页 URL";
			return false;
		}
		const { hostname, protocol, pathname } = parsedUrl;
		if (!["http:", "https:"].includes(protocol) || !(hostname === "bilibili.com" || hostname.endsWith(".bilibili.com"))) {
			this.lastError = "请输入 Bilibili 的视频播放页链接";
			return false;
		}
		try {
			const bangumi = pathname.match(/^\/bangumi\/play\/(ss|ep)([1-9]\d*)\/?$/);
			if (bangumi) return await this.getBangumiPlayUrl(parsedUrl.href, bangumi[1], bangumi[2]);

			const response = await requestWeb(parsedUrl.href, BILIBILI_URL);
			const matchInitialState = response.match(REGEX_INITIAL_STATE);
			const matchPlayInfo = response.match(REGEX_PLAY_INFO);
			if (!matchInitialState) throw new Error("未能解析视频页面，请确认链接有效或稍后重试");
			const initialState = JSON.parse(matchInitialState[1]);
			if (!initialState.videoData?.cid) throw new Error("视频页面未返回有效的视频信息");

			this.getVideoInfoFromInitialState(initialState);
			const embeddedPlayUrl = matchPlayInfo ? JSON.parse(matchPlayInfo[1]) : null;
			const playUrlResult = await requestBestPlayUrl(embeddedPlayUrl, this.bvid, this.cid, parsedUrl.href);
			if (!hasPlayableStream(playUrlResult.data)) throw new Error("未获取到可下载的视频流，请检查账号的观看权限或稍后重试");
			this.playUrl = playUrlResult.data;
			this.playUrlSource = playUrlResult.source;
			return true;
		} catch (error) {
			this.resetVideoInfo();
			this.lastError = error.message || "视频解析失败，请稍后重试";
			return false;
		}
	}

	getDownloadItems() {
		const { maxWidth, maxHeight, target: video } = this.parseVideo();
		const audio = this.parseAudio();
		const items = [...video, ...audio];
		this.items = items;
		return {
			quality: `${maxWidth}x${maxHeight}`,
			items
		};
	}

	parseVideo() {
		if (this.playUrl.durl) {
			const target = this.playUrl.durl.map(({ url, size }, index) => {
				return {
					mimeType: "video/mp4",
					codecs: this.playUrl.format || "",
					bandwidth: size || 0,
					baseUrl: url,
					quality: this.playUrl.accept_description ? this.playUrl.accept_description[0] : `${this.playUrl.quality || "MP4"}`,
					type: "video",
					part: index + 1
				};
			});
			return { maxWidth: 0, maxHeight: 0, target };
		}
		const { video } = this.playUrl.dash;
		const maxWidth = Math.max(...video.map(({ width }) => width));
		const maxHeight = Math.max(...video.map(({ height }) => height));
		const target = video.map(({ mimeType, mime_type, codecs, bandwidth, baseUrl, base_url, width, height }) => {
			return {
				mimeType: mimeType || mime_type,
				codecs,
				bandwidth,
				baseUrl: baseUrl || base_url,
				quality: `${width}x${height}`,
				type: "video"
			};
		});
		return { maxWidth, maxHeight, target };
	}

	parseAudio() {
		if (!this.playUrl.dash || !this.playUrl.dash.audio) return [];
		const { audio } = this.playUrl.dash;
		const target = audio.map(({ mimeType, mime_type, codecs, bandwidth, baseUrl, base_url }) => {
			return {
				mimeType: mimeType || mime_type,
				codecs,
				bandwidth,
				baseUrl: baseUrl || base_url,
				type: "audio"
			};
		});
		return target;
	}

	// 通过 HEAD 请求获取某个流的准确文件大小（字节），失败返回 null
	async getSizeByIndex(part) {
		const url = this.items[part]?.baseUrl;
		if (!url) {
			return null;
		}
		const headers: Record<string, string> = {
			"User-Agent": USER_AGENT,
			'Referer': BILIBILI_URL,
			'Origin': BILIBILI_URL
		};
		const cookies = LoginHelper.getLoginInfoCookies();
		if (cookies) {
			headers.Cookie = cookies.getCookieStringSync(BILIBILI_URL);
		}
		try {
			const response = await fetchUrl(url, { method: 'HEAD', headers });
			const size = Number(response.headers.get('content-length'));
			return Number.isFinite(size) && size > 0 ? size : null;
		} catch (e) {
			console.error(`GetSizeByIndex()发生异常: ${e}`);
			return null;
		}
	}

	downloadByIndex(part, file, callback = () => {}) {
		const url = this.items[part].baseUrl;

		if (this.tasks.some(item => item.url === url)) {
			return {
				status: "duplicate"
			};
		}
		this.tasks.push(new Task(url));
		let state;
		try {
			state = fs.statSync(file);
		}
		catch {
		}
		const cookies = LoginHelper.getLoginInfoCookies();
		const headers: Record<string, string> = {
			"Range": `bytes=${state ? state.size : 0}-`, //断点续传
			"User-Agent": USER_AGENT,
			'Referer': BILIBILI_URL,
			'Origin': BILIBILI_URL
		};
		if (cookies) {
			headers.Cookie = cookies.getCookieStringSync(BILIBILI_URL);
		}
		const options = {
			url,
			headers
		};
		const stream = fs.createWriteStream(file, state ? { flags: "a" } : {});
		const downloadPromise = this.download(options, stream, callback);

		return {
			status: "success",
			size: state ? state.size : 0,
			task: downloadPromise
		};
	}

	async download(options, stream, callback) {
		// https://www.npmjs.com/package/progress-stream
		const index = this.tasks.findIndex(item => item.url === options.url);
		const proStream = progress({
			time: 250 //单位ms
		}).on("progress", progress => {
			const { percentage } = progress; //显示进度条
			if (percentage === 100) {
				this.tasks[index].finished = true;
			}
			callback(progress, index);
		});

		let { url, headers } = options;

		const response = await fetchUrl(url, {
			redirect: 'follow',
			headers
		});

		if (!response.ok) {
			throw new Error(`Failed to download. Status code: ${response.status}`);
		}
		const contentLength = response.headers.get('content-length');
		proStream.setLength(contentLength);
		await streamPipeline(response.body, proStream, stream);
		return stream.path;
	}
}

module.exports = { Task, Downloader };

export {};
