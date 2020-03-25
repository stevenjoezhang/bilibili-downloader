const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const progress = require("progress-stream");
const mime = require("mime");
const electron = require("electron");
const { ipcRenderer } = electron;

var links, downloadArray = [];

function showError(message) {
	dialog.showMessageBox({type: "error", title: "[Error]", message});
}

function showWarning(message) {
	dialog.showMessageBox({type: "warning", title: "[Warning]", message});
}

class Downloader {
	constructor() {
		this.type = "";
		this.id = "";
		this.url = "";
		this.aid = -1;
		this.pid = 1;
		this.cid = -1;
		this.name = "";
	}

	getVideoUrl() {
		let videoUrl = $("#videoUrl").val();
		this.url = "";
		const mapping = {
			"BV": "https://www.bilibili.com/video/",
			"av": "https://www.bilibili.com/video/",
			"ep": "https://www.bilibili.com/bangumi/play/",
			"ss": "https://www.bilibili.com/bangumi/play/"
		};
		for (let [key, value] of Object.entries(mapping)) {
			if (videoUrl.includes(key)) {
				this.type = key;
				this.id = key + videoUrl.split(key)[1];
				this.url = value + this.id;
				break;
			}
		}
		if (this.url) {
			$("#videoUrl").parent().removeClass("has-error has-feedback");
		} else {
			showError("无效的视频链接！");
			$("#videoUrl").parent().addClass("has-error has-feedback");
		}
	}

	getAid() {
		this.getVideoUrl();
		let { type, url } = this;
		if (!url) return;
		fetch(url)
			.then(response => response.text())
			.then(result => {
				let data = result.match(/__INITIAL_STATE__=(.*?);\(function\(\)/)[1];
				data = JSON.parse(data);
				console.log("INITIAL STATE", data);
				if (type === "BV" || type === "av") {
					this.aid = data.videoData.aid;
					this.pid = parseInt(url.split("p=")[1], 10) || 1;
					this.cid = data.videoData.pages[this.pid - 1].cid;
				}
				else if (type === "ep") {
					this.aid = data.epInfo.aid;
					this.cid = data.epInfo.cid;
				}
				else if (type === "ss") {
					this.aid = data.epList[0].aid;
					this.cid = data.epList[0].cid;
				}
				this.getInfo();
			})
			.catch(error => showError("获取视频 aid 出错！"));
	}

	getInfo() {
		let { id, aid, cid } = this;
		if (!cid) {
			showError("获取视频 cid 出错！");
			return;
		}
		this.getData();
		getDanmaku(); //获取cid后，获取下载链接和弹幕信息
		$("#cid").html(cid);
		$("#nav").show();
		if ($(".info").eq(1).is(":hidden")) {
			changeMenu(0);
			//$(".info").eq(0).fadeIn();
		}
		fetch("https://api.bilibili.com/x/web-interface/view?aid=" + aid)
			.then(response => response.json())
			.then(({ data }) => {
				console.log("VIDEO INFO", data);
				$("tbody").eq(1).html("");
				for (let [key, value] of Object.entries(data)) {
					if (mime.getType(value) && mime.getType(value).includes("image")) { //解析图片地址
						value = `<a href="${value}" download=""><img src="${value}"></a>`;
					} else if (typeof value === "object") {
						value = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
					}
					$("tbody").eq(1).append(`<tr>
					<th class="text-capitalize">${key}</th>
					<td>${value}</td>
					</tr>`);
				}
				this.name = `${id}-${data.title}`;
				$("#videoName").val(this.name);
			})
			.catch(error => showError("获取视频信息出错！"));
	}

	getData(fallback) {
		let { cid, type } = this, playUrl;
		if (fallback) {
			let params = `cid=${cid}&module=movie&player=1&quality=112&ts=1`,
				sign = crypto.createHash("md5").update(params + "9b288147e5474dd2aa67085f716c560d").digest("hex");
			playUrl = `https://bangumi.bilibili.com/player/web_api/playurl?${params}&sign=${sign}`;
		} else {
			if (type === "BV" || type === "av") {
				let params = `appkey=iVGUTjsxvpLeuDCf&cid=${cid}&otype=json&qn=112&quality=112&type=`,
					sign = crypto.createHash("md5").update(params + "aHRmhWMLkdeMuILqORnYZocwMBpMEOdt").digest("hex");
				playUrl = `https://interface.bilibili.com/v2/playurl?${params}&sign=${sign}`;
			} else {
				playUrl = `https://api.bilibili.com/pgc/player/web/playurl?qn=80&cid=${cid}`;
			}
		}
		fetch(playUrl)
			.then(response => response.text())
			.then(result => {
				let data = fallback ? $(result) : JSON.parse(result),
					target = fallback ? data.find("durl") : (data.durl || data.result.durl);
				console.log("PLAY URL", data);
				if (target) {
					let quality = fallback ? $(data).find("quality").text() : (data.quality || data.result.quality),
						qualityArray = {
							112: "高清 1080P+",
							80: "高清 1080P",
							74: "高清 720P60",
							64: "高清 720P",
							48: "高清 720P",
							32: "清晰 480P",
							16: "流畅 360P",
							15: "流畅 360P"
						}; //需要修改，不是一一对应
					$("#quality").html(qualityArray[quality] || "未知");
					$("#success").show();
					fallback ? $("#error").show() : $("#error").hide();
					fallback ? this.parseDataBangumi(target) : this.parseData(target);
				} else {
					if (fallback) throw Error();
					this.getData(true);
				}
			})
			.catch(error => {
				showError("获取 PlayUrl 或下载链接出错！由于B站限制，只能下载低清晰度视频。");
			});
	}

	parseDataBangumi(target) {
		links = [];
		$("tbody").eq(0).html("");
		target.each((i, o) => {
			var part = $(o);
			links.push(part.find("url").text());
			$("tbody").eq(0).append(`<tr>
				<td>${part.find("order").text()}</td>
				<td>${part.find("length").text() / 1e3}</td>
				<td>${part.find("size").text() / 1e6}</td>
				<td>
					<div class="checkbox">
						<label>
							<input type="checkbox" checked="true">
						</label>
					</div>
				</td>
			</tr>`);
		});
	}

	parseData(target) {
		links = [];
		$("tbody").eq(0).html("");
		for (let part of target) {
			links.push(part.url);
			$("tbody").eq(0).append(`<tr>
				<td>${part.order}</td>
				<td>${part.length / 1e3}</td>
				<td>${part.size / 1e6}</td>
				<td>
					<div class="checkbox">
						<label>
							<input type="checkbox" checked="true">
						</label>
					</div>
				</td>
			</tr>`);
		}
	}

	download() {
		let { cid } = this, flag = true;
		document.querySelectorAll('input[type="checkbox"]').forEach((element, index) => {
			if (!element.checked || downloadArray.includes(links[index])) return;
			$("#download").append(`<span>${cid}-${index}</span>
				<span class="speed"></span>
				<span class="eta"></span>
				<span class="addon"></span>
				<div class="progress progress-striped active">
					<div class="progress-bar progress-bar-info" role="progressbar" style="width: 0%;">
						<span class="progress-value">0%</span>
					</div>
				</div>`);
			downloadArray.push(links[index]);
			ipcRenderer.send("length", downloadArray.filter(item => item !== "").length);
			flag = false;
			this.downloadLink(index);
		});
		if (flag) showWarning("没有新的视频被下载！");
	}

	downloadLink(index) {
		let { name, cid, url } = this;
		let downloadPath = $("#downloadPath").val(),
			filename = $("#videoName").val() || name || cid,
			file = path.join(downloadPath, `${filename}-${index}.flv`);
		fs.stat(file, (error, state) => {
			var options = {
				url: links[index],
				headers: {
					"Range": `bytes=${state ? state.size : 0}-`, //断点续传
					"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
					"Referer": url
				}
			};
			var downloads = fs.createWriteStream(file, state ? {"flags": "a"} : {}),
				j = downloadArray.indexOf(options.url);
			this.generalDownload(j, options, downloads);
			state && $(".addon").eq(j).html(`从${Math.round(state.size / 1048576)}MiB处恢复的下载`);
			//console.log(this.cid, file, options.url);
		});
	}

	generalDownload(j, options, downloads) {
		//https://blog.csdn.net/zhu_06/article/details/79772229
		var proStream = progress({
			time: 250 //单位ms
		}).on("progress", progress => {
			$(".speed").eq(j).html(Math.round(progress.speed / 1024) + "KiB/s");
			$(".eta").eq(j).html(`eta:${progress.eta}s`);
			let { percentage } = progress; //显示进度条
			$(".progress-value").eq(j).html(Math.round(percentage) + "%");
			$(".progress-bar").eq(j).css("width", percentage + "%");
			if (percentage === 100) {
				$(".progress-bar").eq(j).removeClass("progress-bar-info").addClass("progress-bar-success").parent().removeClass("active");
				downloadArray[j] = "";
				ipcRenderer.send("length", downloadArray.filter(item => item !== "").length);
			}
		});
		//先pipe到proStream再pipe到文件的写入流中
		(options.url.startsWith("https") ? https : http).get(options.url, options, res => {
			proStream.setLength(res.headers["content-length"]);
			res.pipe(proStream).pipe(downloads).on("error", e => {
				console.error(e);
			});
		});
	}
}

var downloader = new Downloader();
