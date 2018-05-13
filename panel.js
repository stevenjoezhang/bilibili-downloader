const path = require("path");
const fs = require("fs");
const request = require("request");
const progress = require("progress-stream");
const async = require("async");
const mime = require("mime");
const electron = require("electron");
const { dialog, shell } = electron.remote;
const ipcRender = electron.ipcRenderer;

var videoUrl, playUrl, count, links, cid, downloadArray = new Array(), downloadIndex = 0, manual = false;
var debug = !true;

function showError(text) {
	dialog.showMessageBox({type:"error", title: "[Error]", message: text});
}

function showWarning(text) {
	dialog.showMessageBox({type:"warning", title: "[Warning]", message: text});
}

function getVideoUrl() {
	var videoUrl = $("#videoUrl").val();
	if (debug) videoUrl = "https://www.bilibili.com/bangumi/play/ep90832";
	if (videoUrl.indexOf("https://") != 0) {
		if (videoUrl.indexOf("http://") == 0) videoUrl = videoUrl.replace("http://", "https://");
		else if (videoUrl.indexOf("bilibili") != -1) videoUrl = "https://" + videoUrl;
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
	if (debug) playUrl = "https://bangumi.bilibili.com/player/web_api/v2/playurl?cid=11090110&appkey=84956560bc028eb7&otype=json&type=&quality=80&module=bangumi&season_type=1&qn=80&sign=d6d73e8fbbc2adacaf047c48714e8e69";
	if (playUrl.indexOf("https://") != 0) {
		if (playUrl.indexOf("http://") == 0) playUrl = playUrl.replace("http://", "https://");
		else if (playUrl.indexOf("bilibili") != -1) playUrl = "https://" + playUrl;
		else {
			showError("无效的PlayUrl！");
			$("#playUrl").parent().addClass("has-error has-feedback");
			return null;
		}
	}
	if (!playUrl.split("?cid=")[1]) {
		showError("无效的PlayUrl！");
		$("#playUrl").parent().addClass("has-error has-feedback");
		return null;
	}
	$("#playUrl").parent().removeClass("has-error has-feedback");
	return playUrl;
}

function backupUrl() {
	showError("获取PlayUrl或下载链接出错，请手动输入PlayUrl！");
	$("#backup-url").show();
	$("#playUrl").parent().addClass("has-error has-feedback");
	$("#nav, .info").hide();
	manual = true;
}

function getAid() {
	videoUrl = getVideoUrl();
	if (manual) playUrl = getPlayUrl();
	if (!videoUrl || (manual && !playUrl)) return;

	if (videoUrl.split("/av")[1]) {
		aid = videoUrl.split("/av")[1].split("/")[0];
		getInfo();
	}
	else {
		$.ajax(videoUrl, {
			type: "get",
			dataType: "text",
			error: function(xhr, status, error) {
				showError("获取视频aid出错！");
			},
			success: function(data, status, xhr) {
				aid = data.split("//www.bilibili.com/video/av")[1].split("/")[0];
				getInfo();
			}
		});
	}
}

function getInfo() {
	$.ajax("https://api.bilibili.com/view?type=jsonp&appkey=8e9fc618fbd41e28&id=" + aid, {
		type: "get",
		dataType: "text",
		error: function(xhr, status, error) {
			showError("获取视频信息出错！");
		},
		success: function(data, status, xhr) {
			//console.log(data);
			data = JSON.parse(data);
			$("tbody").eq(1).html("");
			for (var i in data) {
				if (i == "cid") {
					cid = data[i];
					var params = "appkey=84956560bc028eb7&cid=" + cid + "&otype=json&qn=112&quality=112&type=";
					var sign = hex_md5(params + "94aba54af9065f71de72f5508f1cd42e");
					playUrl = "http://interface.bilibili.com/v2/playurl?" + params + "&sign=" + sign;
				}
				if (mime.getType(data[i]) && mime.getType(data[i]).indexOf("image") != -1) { //解析图片地址
					data[i] = '<a href="' + data[i] + '" download=""><img src="' + data[i] + '"></a>';
				}
				$("tbody").eq(1).append("<tr>\
				<td class=\"capitalize\">" + i + "</td>\
				<td>" + data[i] + "</td>\
				</tr>");
			}

			if (manual) {
				playUrl = getPlayUrl();
				if (cid != playUrl.split("?cid=")[1].split("&")[0]) {
					//return; //视频地址和PlayUrl不匹配时结束
					showWarning("视频地址和PlayUrl不匹配，可能造成问题！");
					cid = playUrl.split("?cid=")[1].split("&")[0];
				}
				manual = false;
			}
			getData(playUrl);
		}
	});
}

function getData(url) {
	$.ajax(url, {
		type: "get",
		dataType: "text",
		error: function(xhr, status, error) {
			backupUrl();
		},
		success: function(data, status, xhr) {
			console.log(url, data);
			data = JSON.parse(data);
			parseData(data);
		}
	});
}

function parseData(data) {
	var target = data.durl;
	if (!target) {
		backupUrl();
		return;
	}
	$("#backup-url").hide();
	$("#cid").html(cid);
	count = target.length;
	var qualityArray = {
		112: "高清 1080P+",
		80: "高清 1080P",
		74: "高清 720P60",
		64: "高清 720P",
		48: "高清 720P",
		32: "清晰 480P",
		16: "流畅 360P",
		15: "流畅 360P"
	} //需要修改，不是一一对应
	var quality = qualityArray[data.quality] || "未知";
	$("#quality").html(quality);
	$("tbody").eq(0).html("");
	links = new Array();
	for (var i in target) {
		var part = target[i];
		links.push(part.url);
		$("tbody").eq(0).append("<tr>\
			<td>" + part.order + "</td>\
			<td>" + part.length / 1e3 + "</td>\
			<td>" + part.size / 1e6 + "</td>\
			<td>\
				<div class=\"checkbox\">\
					<label>\
				  		<input type=\"checkbox\" checked=\"true\">\
					</label>\
			  	</div>\
			</td>\
		</tr>");
	}
	$("#nav").show();
	if ($(".info").eq(1).is(":hidden")) $(".info").eq(0).fadeIn();
}

function openDialog() {
	var defaultpath = $("#downloadPath").val() || __dirname;
	dialog.showOpenDialog({
		defaultPath: defaultpath,
		properties: [
			"openDirectory", //打开路径
		],
		filters: [
			//{ name: "zby", extensions: ["json"] },
		]
	}, function(res) {
		if (res[0]) $("#downloadPath").val(res[0]);
	});
}

function download(data) {
	var functionArray = new Array();
	var flag = true;
	//$("#download").html("");
	for (var i = 0; i < count; i++) {
		if ($('input[type="checkbox"]').eq(i).prop("checked")) {
			if (downloadArray.indexOf(links[i]) != -1) continue;
			$("#download").append("<span>" + cid + "-" + i + '</span>\
			&nbsp;&nbsp;&nbsp;\
			<span class="addon"></span>\
			&nbsp;&nbsp;&nbsp;\
			<span class="speed"></span>\
			&nbsp;&nbsp;&nbsp;\
			<span class="eta"></span>\
			<div class="progress progress-striped active">\
				<div class="progress-bar progress-bar-info" role="progressbar" style="width: 0%;">\
					<span class="progress-value">0%</span>\
				</div>\
			</div>');
			let _i = i;
			let _j = downloadIndex; //必须使用let或const
			downloadIndex++;
			downloadArray.push(links[i]);
			ipcRender.send("length", downloadArray.length);
			functionArray.push(function(callback) {
				downloadLink(_i, _j);
				//callback(null, j + " Done");
			});
			flag = false;
		} //由于js执行机制，此处不能直接传值
	}
	if (flag) showWarning("没有新的视频被下载！");
	async.parallel(functionArray, function(err, results) {
		if (err) console.log(err);
	});
}

function openPath() {
	shell.openItem($("#downloadPath").val());
}

function downloadLink(i, j) {
	var downloadPath = $("#downloadPath").val() || "";
	var filename;
	if (count > 10 && i <= 9) filename = cid + "-0" + i + ".flv"
	else filename = cid + "-" + i + ".flv";
	var file = path.join(downloadPath, filename);
	fs.exists(file, function(exist) {
		if (exist) resumeDownload(i, j, file)
		else newDownload(i, j, file);
	});
}

function newDownload(i, j, file) {
	var options = {
		url: links[i],
		encoding: null, //当请求的是二进制文件时，一定要设置
		headers: {
			"Range": "bytes=0-", //断点续传
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1 Safari/605.1.15",
			"Referer": videoUrl
		}
	}
	//console.log(cid, file, options.url);
	var downloads = fs.createWriteStream(file);
	generalDownload(i, j, options, downloads);
}

function resumeDownload(i, j, file) {
	fs.stat(file, function(error, state) {
		var options = {
			url: links[i],
			encoding: null, //当请求的是二进制文件时，一定要设置
			headers: {
				"Range": "bytes=" + state.size + "-", //断点续传
				"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1 Safari/605.1.15",
				"Referer": videoUrl
			}
		}
		$(".addon").eq(j).html("从" + Math.round(state.size / 1e6) + "MB处恢复的下载");
		//console.log(cid, file, options.url);
		var downloads = fs.createWriteStream(file, {"flags": "a"});
		generalDownload(i, j, options, downloads);
	});
}

function generalDownload(i, j, options, downloads) {
	request.get(options).on("response", function(response) {
		//https://blog.csdn.net/zhu_06/article/details/79772229
		var proStream = progress({
			length: response.headers["content-length"],
			time: 500 //单位ms
		});
		proStream.on("progress", function(progress) {
			//console.log(progress);
			$(".speed").eq(j).html(Math.round(progress.speed / 1e3) + "kb/s");
			$(".eta").eq(j).html("eta:" + progress.eta + "s");
			var percentage = progress.percentage; //显示进度条
			$(".progress-value").eq(j).html(Math.round(percentage) + "%");
			$(".progress-bar").eq(j).css("width", percentage + "%");
			if (percentage == 100) {
				$(".progress-bar").eq(j).removeClass("progress-bar-info").addClass("progress-bar-success").parent().removeClass("active");
				downloadArray.splice(downloadArray.indexOf(links[i]), 1);
				ipcRender.send("length", downloadArray.length);
			}
		});
		request.get(options).pipe(proStream).pipe(downloads).on("error", function(e) {
  			console.error(e);
		}); //先pipe到proStream再pipe到文件的写入流中
	});
}

function xml() {
	var url = "https://comment.bilibili.com/" + cid + ".xml";
	blobDownload(url, cid + ".xml");
}

function ass() {
	//使用ajax是因为bilibili采用了content-encoding:deflate压缩，若使用https.get需要zlib库解压，较为复杂
	$.ajax("https://comment.bilibili.com/" + cid + ".xml", {
		type: "get",
		dataType: "text", //避免ajax解析为xml造成问题
		error: function(xhr, status, error) {
			showError("弹幕下载失败！");
		},
		success: function(data, status, xhr) {
			var danmaku = parseFile(data);
			var ass = generateASS(setPosition(danmaku), {
				"title": document.title,
				"ori": cid,
			});
			assDownload(ass, cid + ".ass"); //"\ufeff" + 
		}
	});
}

function parseFile(content) {
	content = content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
	return parseXML(content);
}

function assDownload(data, filename) {
	var blob = new Blob([data], {
		type: "application/octet-stream"
	});
	var url = window.URL.createObjectURL(blob);
	blobDownload(url, filename);
	document.addEventListener("unload", function() {
		window.URL.revokeObjectURL(url);
	});
}

function blobDownload(url, filename) {
	var saveas = document.createElement("a");
	saveas.href = url;
	saveas.style.display = "none";
	document.body.appendChild(saveas);
	saveas.download = filename;
	saveas.click();
	setTimeout(function() {
		saveas.parentNode.removeChild(saveas);
	}, 1000);
}
