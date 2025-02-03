const fs = require("fs");
const { pipeline } = require('stream');
const { promisify } = require('util');
const progress = require("progress-stream");
const fetch = require('node-fetch');
const { CookieJar } = require('tough-cookie');
const LoginHelper = require('./login/login-helper');
const streamPipeline = promisify(pipeline);
const { parse } = require('url');

const REGEX_PLAY_INFO = /<script>window\.__playinfo__=(.*?)<\/script>/;
const REGEX_INITIAL_STATE = /__INITIAL_STATE__=(.*?);\(function\(\)/;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36";
const BILIBILI_URL = "https://www.bilibili.com";

async function requestWeb(url, referer = null, method = 'GET', parameters = null, retry = 3, needRandomBvuid3 = false) {
	if (retry <= 0) {
		return '';
	}

	const headers = {
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
		const response = await fetch(url, requestOptions);

		let html = await response.text();

		return html;
	} catch (error) {
		console.error(`RequestWeb()发生异常: ${error}`);
		return requestWeb(url, referer, method, parameters, retry - 1, needRandomBvuid3);
	}
}

class Task {
	constructor(url) {
		this.url = url;
		this.finished = false;
	}
}

class Downloader {
	constructor() {
		this.aid = -1;
		this.bvid = -1;
		this.pid = 1;
		this.cid = -1;
		this.videoData = null;
		this.playUrl = null;
		this.items = [];
		this.tasks = [];
	}

	getVideoInfoFromInitialState(state) {
		this.aid = state.aid;
		this.bvid = state.bvid;
		this.pid = state.p;
		this.cid = state.videoData.cid;
		this.videoData = state.videoData;
	}

	get uniqueName() {
		return `[${this.bvid}]${this.videoData.title}`;
	}

	async getPlayUrlWebPage(url) {
		const referer = BILIBILI_URL;
		if (!parse(url).hostname.endsWith('bilibili.com')) return false;
		const response = await requestWeb(url, referer);
		const matchInitialState = response.match(REGEX_INITIAL_STATE);
		const matchPlayInfo = response.match(REGEX_PLAY_INFO);
		if (!matchInitialState || !matchPlayInfo) return false;
		const initialState = JSON.parse(matchInitialState[1]);
		const playUrl = JSON.parse(matchPlayInfo[1]);

		this.getVideoInfoFromInitialState(initialState);

		if (!playUrl) {
			this.playUrl = null;
		} else if (playUrl.data) {
			this.playUrl = playUrl.data;
		} else if (playUrl.result) {
			this.playUrl = playUrl.result;
		}
		return true;
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
		const { video } = this.playUrl.dash;
		const maxWidth = Math.max(...video.map(({ width }) => width));
		const maxHeight = Math.max(...video.map(({ height }) => height));
		const target = video.map(({ mimeType, codecs, bandwidth, baseUrl, width, height }) => {
			return {
				mimeType,
				codecs,
				bandwidth,
				baseUrl,
				quality: `${width}x${height}`,
				type: "video"
			};
		});
		return { maxWidth, maxHeight, target };
	}

	parseAudio() {
		const { audio } = this.playUrl.dash;
		const target = audio.map(({ mimeType, codecs, bandwidth, baseUrl }) => {
			return {
				mimeType,
				codecs,
				bandwidth,
				baseUrl,
				type: "audio"
			};
		});
		return target;
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
		const options = {
			url,
			headers: {
				"Range": `bytes=${state ? state.size : 0}-`, //断点续传
				"User-Agent": USER_AGENT,
				'Referer': BILIBILI_URL,
				'Origin': BILIBILI_URL,
				'Cookie': cookies.getCookieStringSync(BILIBILI_URL)
			}
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
		console.log(url);

		const response = await fetch(url, {
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
