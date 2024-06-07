const fs = require("fs");
const http = require("http");
const https = require("https");
const progress = require("progress-stream");
const { requestWeb } = require("./request");

const REGEX_PLAY_INFO = /<script>window\.__playinfo__=(.*?)<\/script>/;
const REGEX_INITIAL_STATE = /__INITIAL_STATE__=(.*?);\(function\(\)/;

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
		this.playUrl = null;
		this.videoData = null;
		this.name = "";
		this.links = [];
		this.tasks = [];
	}

	getVideoInfoFromInitialState(state) {
		this.aid = state.aid;
		this.bvid = state.bvid;
		this.pid = state.p;
		this.cid = state.videoData.cid;
		this.videoData = state.videoData;
	}

	async getPlayUrlWebPage(url) {
		const referer = 'https://www.bilibili.com';
		const response = await requestWeb(url, referer);
		const matchInitialState = response.match(REGEX_INITIAL_STATE);
		const matchPlayInfo = response.match(REGEX_PLAY_INFO);
		if (!matchInitialState || !matchPlayInfo) return;
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
	}

	downloadByIndex(part, file, callback = () => {}) {
		const { url } = this;

		if (this.tasks.some(item => item.url === this.links[part])) return "DUPLICATE";
		this.tasks.push(new Task(this.links[part]));
		let state;
		try {
			state = fs.statSync(file);
		}
		catch (error) {
		}
		const options = {
			url: this.links[part],
			headers: {
				"Range": `bytes=${state ? state.size : 0}-`, //断点续传
				"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
				"Referer": url
			}
		};
		const stream = fs.createWriteStream(file, state ? { flags: "a" } : {});
		this.download(options, stream, callback);

		return state;
	}

	download(options, stream, callback) {
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

		let { url } = options;
		function downloadLink(url) {
			(url.startsWith("https") ? https : http).get(url, options, res => {
				if (res.statusCode === 302) {
					url = res.headers.location;
					return downloadLink(url);
				}
				proStream.setLength(res.headers["content-length"]);
				//先pipe到proStream再pipe到文件的写入流中
				res.pipe(proStream).pipe(stream).on("error", error => {
					console.error(error);
				});
			});
		}
		downloadLink(url);
	}
}

module.exports = { Task, Downloader };
