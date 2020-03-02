const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const progress = require("progress-stream");
const mime = require("mime");
const electron = require("electron");
const { ipcRenderer } = electron;
const { app, shell } = electron.remote;

var video = {};
var links, downloadArray = [];

function showError(message) {
	dialog.showMessageBox({type: "error", title: "[Error]", message});
}

function showWarning(message) {
	dialog.showMessageBox({type: "warning", title: "[Warning]", message});
}

function getVideoUrl() {
	let videoUrl = $("#videoUrl").val(), type;
	if (videoUrl.includes("av")) {
		type = "av";
		videoUrl = "https://www.bilibili.com/video/av" + videoUrl.split("av")[1];
	}
	else if (videoUrl.includes("ep")) {
		type = "ep";
		videoUrl = "https://www.bilibili.com/bangumi/play/ep" + videoUrl.split("ep")[1];
	}
	else if (videoUrl.includes("ss")) {
		type = "ss";
		videoUrl = "https://www.bilibili.com/bangumi/play/ss" + videoUrl.split("ss")[1];
	}
	else {
		showError("无效的视频链接！");
		$("#videoUrl").parent().addClass("has-error has-feedback");
		return null;
	}
	$("#videoUrl").parent().removeClass("has-error has-feedback");
	return { videoUrl, type };
}

function getAid() {
	let { videoUrl, type } = getVideoUrl();
	if (!videoUrl) return;
	video.url = videoUrl;
	if (type === "av") {
		let id = video.url.split("av")[1],
			aid = id.split("/")[0].split("?")[0],
			pid = id.split("p=")[1] || 1;
		getInfo({ aid, pid });
	} else {
		fetch(video.url)
			.then(response => response.text())
			.then(result => {
				let data = result.match(/__INITIAL_STATE__=(.*?);\(function\(\)/)[1];
				console.log("INITIAL STATE", data);
				data = JSON.parse(data);
				let { aid, cid } = type === "ss" ? data.epList[0] : data.epInfo;
				getInfo({ aid, cid });
			})
			.catch(error => showError("获取视频 aid 出错！"));
	}
}

function getInfo({ aid, pid, cid }) {
	fetch("https://api.bilibili.com/view?type=jsonp&appkey=8e9fc618fbd41e28&id=" + aid)
		.then(response => response.json())
		.then(data => {
			console.log("VIDEO INFO", data);
			$("tbody").eq(1).html("");
			for (var i in data) {
				if (mime.getType(data[i]) && mime.getType(data[i]).includes("image")) { //解析图片地址
					data[i] = `<a href="${data[i]}" download=""><img src="${data[i]}"></a>`;
				}
				$("tbody").eq(1).append(`<tr>
				<td class="text-capitalize">${i}</td>
				<td style="word-break: break-all;">${data[i]}</td>
				</tr>`);
			}
			//video.cid = data.cid;
			video.name = `${data.cid}-${data.title}`;
			$("#videoName").val(video.name);
		})
		.catch(error => showError("获取视频信息出错！"));
	fetch("https://www.bilibili.com/widget/getPageList?aid=" + aid)
		.then(response => response.json())
		.then(result => {
			console.log("PAGE LIST", result);
			if (cid) {
				video.cid = cid;
				let params = `cid=${video.cid}&module=movie&player=1&quality=112&ts=1`,
					sign = crypto.createHash("md5").update(params + "9b288147e5474dd2aa67085f716c560d").digest("hex"),
					playUrl = `http://bangumi.bilibili.com/player/web_api/playurl?${params}&sign=${sign}`;
				getData(playUrl, true);
			} else {
				if (!result[pid - 1].cid) {
					showError("获取视频 cid 出错！");
					return;
				}
				video.cid = result[pid - 1].cid;
				let params = `appkey=iVGUTjsxvpLeuDCf&cid=${video.cid}&otype=json&qn=112&quality=112&type=`,
					sign = crypto.createHash("md5").update(params + "aHRmhWMLkdeMuILqORnYZocwMBpMEOdt").digest("hex"),
					playUrl = `http://interface.bilibili.com/v2/playurl?${params}&sign=${sign}`;
				getData(playUrl);
			}
			getDanmaku(); //获取cid后，获取下载链接和弹幕信息
			$("#nav").show();
			if ($(".info").eq(1).is(":hidden")) {
				changeMenu(0);
				//$(".info").eq(0).fadeIn();
			}
		}) //解析xml文档
		.catch(error => showError("获取视频信息出错！"));
}

function getData(url, isBangumi) {
	fetch(url)
		.then(response => response.text())
		.then(result => {
			console.log("PLAY URL", result);
			var data = isBangumi ? $(result) : JSON.parse(result),
				target = isBangumi ? data.find("durl") : data.durl;
			if (target) {
				var quality = isBangumi ? $(data).find("quality").text() : data.quality,
					qualityArray = {
						112: "高清 1080P+",
						80: "高清 1080P",
						74: "高清 720P60",
						64: "高清 720P",
						48: "高清 720P",
						32: "清晰 480P",
						16: "流畅 360P",
						15: "流畅 360P"
					} //需要修改，不是一一对应
				$("#quality").html(qualityArray[quality] || "未知");
				$("#success").show();
				$("#cid").html(video.cid);
				$("tbody").eq(0).html("");
				$("#backup-url, #error").hide();
				links = [];
				isBangumi ? parseDataBangumi(target, links) : parseData(target, links);
			}
		})
		.catch(error => {
			showError("获取 PlayUrl 或下载链接出错！由于B站限制，只能下载低清晰度视频。");
		});
}

function parseDataBangumi(target, links) {
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

function parseData(target, links) {
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

function openDialog() {
	dialog.showOpenDialog({
		defaultPath: $("#downloadPath").val() || app.getPath("downloads") || __dirname,
		properties: [
			"openDirectory", //打开路径
		],
		filters: [
			//{ name: "", extensions: ["json"] },
		]
	}, res => {
		if (res[0]) $("#downloadPath").val(res[0]);
	});
}

function download() {
	var flag = true;
	[...document.querySelectorAll('input[type="checkbox"]')].forEach((element, i) => {
		if (!element.checked || downloadArray.includes(links[i])) return;
		$("#download").append(`<span>${video.cid}-${i}</span>
			<span class="speed"></span>
			<span class="eta"></span>
			<span class="addon"></span>
			<div class="progress progress-striped active">
				<div class="progress-bar progress-bar-info" role="progressbar" style="width: 0%;">
					<span class="progress-value">0%</span>
				</div>
			</div>`);
		downloadArray.push(links[i]);
		ipcRenderer.send("length", downloadArray.filter(item => item !== "").length);
		flag = false;
		downloadLink(i);
	});
	if (flag) showWarning("没有新的视频被下载！");
}

function openPath() {
	shell.openItem($("#downloadPath").val());
}

function downloadLink(i) {
	let downloadPath = $("#downloadPath").val(),
		filename = $("#videoName").val() || video.name || video.cid,
		file = path.join(downloadPath, `${filename}-${i}.flv`);
	fs.stat(file, (error, state) => {
		var options = {
			url: links[i],
			encoding: null, //当请求的是二进制文件时，一定要设置
			headers: {
				"Range": `bytes=${state ? state.size : 0}-`, //断点续传
				"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
				"Referer": video.url
			}
		};
		var downloads = fs.createWriteStream(file, state ? {"flags": "a"} : {}),
			j = downloadArray.indexOf(options.url);
		generalDownload(j, options, downloads);
		state && $(".addon").eq(j).html(`从${Math.round(state.size / 1048576)}MiB处恢复的下载`);
		//console.log(video.cid, file, options.url);
	});
}

function generalDownload(j, options, downloads) {
	//https://blog.csdn.net/zhu_06/article/details/79772229
	var proStream = progress({
		time: 250 //单位ms
	}).on("progress", progress => {
		$(".speed").eq(j).html(Math.round(progress.speed / 1024) + "KiB/s");
		$(".eta").eq(j).html(`eta:${progress.eta}s`);
		var percentage = progress.percentage; //显示进度条
		$(".progress-value").eq(j).html(Math.round(percentage) + "%");
		$(".progress-bar").eq(j).css("width", percentage + "%");
		if (percentage === 100) {
			$(".progress-bar").eq(j).removeClass("progress-bar-info").addClass("progress-bar-success").parent().removeClass("active");
			downloadArray[j] = "";
			ipcRenderer.send("length", downloadArray.filter(item => item !== "").length);
		}
	});
	//先pipe到proStream再pipe到文件的写入流中
	http.get(options.url, options, res => {
		proStream.setLength(res.headers["content-length"]);
		res.pipe(proStream).pipe(downloads).on("error", e => {
			console.error(e);
		});
	});
}
