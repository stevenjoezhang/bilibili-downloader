const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const request = require("request");
const progress = require("progress-stream");
const mime = require("mime");
const electron = require("electron");
const { ipcRenderer } = electron;
const { app, shell } = electron.remote;

var videoUrl, playUrl, aid, pid = 1, cid, links, downloadArray = [], manual = false;
var debug = !true;

function showError(text) {
	dialog.showMessageBox({type: "error", title: "[Error]", message: text});
}

function showWarning(text) {
	dialog.showMessageBox({type: "warning", title: "[Warning]", message: text});
}

function getVideoUrl() {
	var videoUrl = $("#videoUrl").val();
	//if (debug) videoUrl = "https://www.bilibili.com/bangumi/play/ep90832";
	if (debug) videoUrl = "https://www.bilibili.com/video/av23498892";
	if (videoUrl.indexOf("https://") !== 0) {
		if (videoUrl.includes("av")) videoUrl = "https://www.bilibili.com/video/av" + videoUrl.split("av")[1];
		else if (videoUrl.includes("ep")) videoUrl = "https://www.bilibili.com/bangumi/play/ep" + videoUrl.split("ep")[1];
		else if (videoUrl.includes("ss")) videoUrl = "https://www.bilibili.com/bangumi/play/ss" + videoUrl.split("ss")[1];
		else {
			showError("无效的视频链接！");
			$("#videoUrl").parent().addClass("has-error has-feedback");
			return null;
		}
	}
	$("#videoUrl").parent().removeClass("has-error has-feedback");
	return videoUrl;
}

function getPlayUrl() {
	var playUrl = $("#playUrl").val();
	if (debug) playUrl = "https://bangumi.bilibili.com/player/web_api/v2/playurl?cid=11090110&appkey=iVGUTjsxvpLeuDCf&otype=json&type=&quality=80&module=bangumi&season_type=1&qn=80&sign=d6d73e8fbbc2adacaf047c48714e8e69";
	if (playUrl.indexOf("http://") === 0) playUrl = playUrl.replace("http://", "https://");
	if (playUrl.includes("bilibili") || !playUrl.split("?cid=")[1]) {
		showError("无效的PlayUrl！");
		$("#playUrl").parent().addClass("has-error has-feedback");
		return null;
	}
	$("#playUrl").parent().removeClass("has-error has-feedback");
	return playUrl;
}

function backupUrl() {
	showError("获取PlayUrl或下载链接出错，请手动输入PlayUrl！否则由于B站限制，只能下载低清晰度视频！");
	$("#backup-url, #error").show();
	$("#playUrl").parent().addClass("has-error has-feedback");
	//$("#success").hide();
	$("#playUrl").val("");
	manual = true;
}

function getAid() {
	if (manual) {
		if (videoUrl !== getVideoUrl()) manual = false; //用户在请求playUrl时改变了videoUrl
		else playUrl = getPlayUrl();
	}
	videoUrl = getVideoUrl();
	if (!videoUrl || (manual && !playUrl)) return;
	let id = videoUrl.split("av")[1];
	if (id) {
		aid = id.split("/")[0].split("?p=")[0];
		pid = id.split("?p=")[1] || 1;
		getInfo();
	} else {
		fetch(videoUrl)
			.then(response => response.text())
			.then(result => {
				aid = result.split("//www.bilibili.com/video/av")[1].split("/")[0];
				getInfo();
			})
			.catch(error => showError("获取视频aid出错！"));
	}
}

function getInfo() {
	fetch("https://api.bilibili.com/view?type=jsonp&appkey=8e9fc618fbd41e28&id=" + aid)
		.then(response => response.json())
		.then(data => {
			//console.log(result);
			$("tbody").eq(1).html("");
			for (var i in data) {
				if (i === "cid") {
					//cid = data[i];
				}
				if (mime.getType(data[i]) && mime.getType(data[i]).includes("image")) { //解析图片地址
					data[i] = '<a href="' + data[i] + '" download=""><img src="' + data[i] + '"></a>';
				}
				$("tbody").eq(1).append(`<tr>
				<td class="capitalize">${i}</td>
				<td>${data[i]}</td>
				</tr>`);
			}
			fetch("https://www.bilibili.com/widget/getPageList?aid=" + aid)
				.then(response => response.json())
				.then(result => {
					cid = result[pid - 1].cid;
					var params = `appkey=iVGUTjsxvpLeuDCf&cid=${cid}&otype=json&qn=112&quality=112&type=`,
						sign = crypto.createHash("md5").update(params + "aHRmhWMLkdeMuILqORnYZocwMBpMEOdt").digest("hex");
					playUrl = `http://interface.bilibili.com/v2/playurl?${params}&sign=${sign}`;
					if (manual) {
						playUrl = getPlayUrl();
						if (cid !== playUrl.split("?cid=")[1].split("&")[0]) {
							//return; //视频地址和PlayUrl不匹配时结束
							showWarning("视频地址和PlayUrl不匹配，可能造成问题！");
							cid = playUrl.split("?cid=")[1].split("&")[0];
						}
						manual = false;
					}

					if (!cid) {
						showError("获取视频cid出错！");
						return;
					}
					getData(playUrl);
					getDanmaku(); //获取cid后，获取下载链接和弹幕信息
					$("#nav").show();
					if ($(".info").eq(1).is(":hidden")) {
						changeMenu(0);
						//$(".info").eq(0).fadeIn();
					}
				}) //解析xml文档
				.catch(error => showError("获取视频信息出错！"));
		})
		.catch(error => showError("获取视频信息出错！"));
}

function getData(url, isBangumi) {
	fetch(url)
		.then(response => response.text())
		.then(result => {
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
				parseData(target, isBangumi);
			} else {
				backupUrl();
				if (isBangumi) return;
				var params = `cid=${cid}&module=movie&player=1&quality=112&ts=1`;
				sign = crypto.createHash("md5").update(params + "9b288147e5474dd2aa67085f716c560d").digest("hex");
				getData(`http://bangumi.bilibili.com/player/web_api/playurl?${params}&sign=${sign}`, true);
			}
		})
		.catch(error => backupUrl());
}

function parseData(target, isBangumi) {
	if (!isBangumi) $("#backup-url, #error").hide();
	$("#success").show();
	$("#cid").html(cid);
	$("tbody").eq(0).html("");
	links = [];
	if (isBangumi) target.each((i, o) => {
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
	else for (let part of target) {
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

function download(data) {
	var flag = true;
	[...document.querySelectorAll('input[type="checkbox"]')].forEach((element, i) => {
		if (!element.getAttribute("checked") || downloadArray.includes(links[i])) return;
		$("#download").append(`<span>${cid}-${i}</span>
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
	var downloadPath = $("#downloadPath").val(),
		filename = `${cid}-${i}.flv`,
		file = path.join(downloadPath, filename);
	fs.stat(file, (error, state) => {
		var options = {
			url: links[i],
			encoding: null, //当请求的是二进制文件时，一定要设置
			headers: {
				"Range": `bytes=${state ? state.size : 0}-`, //断点续传
				"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
				"Referer": videoUrl
			}
		};
		var downloads = fs.createWriteStream(file, state ? {"flags": "a"} : {}),
			j = downloadArray.indexOf(options.url);
		generalDownload(j, options, downloads);
		state && $(".addon").eq(j).html(`从${Math.round(state.size / 1048576)}MiB处恢复的下载`);
		//console.log(cid, file, options.url);
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
	request.get(options).on("response", response => {
		proStream.setLength(response.headers["content-length"]);
	}).pipe(proStream).pipe(downloads).on("error", e => {
		console.error(e);
	});
}
