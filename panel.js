const path = require("path");
const url = require("url");
const fs = require("fs");
const request = require("request");
const progress = require("progress-stream");
const async = require("async");
const electron = require("electron");
const { dialog, shell } = electron.remote;

var videoUrl, playUrl, count, links, cid, downloadArray = new Array(), downloadIndex = 0;
var debug = !true;

function getVideoUrl() {
	var videoUrl = $("#videoUrl").val();
	if (debug) videoUrl = "https://www.bilibili.com/bangumi/play/ep90832";
	if (videoUrl.indexOf("https://") != 0) {
		if (videoUrl.indexOf("http://") == 0) videoUrl = videoUrl.replace("http://", "https://");
		else if (videoUrl.indexOf("bilibili") != -1) videoUrl = "https://" + videoUrl;
		else {
			alert("[Error]无效的视频链接！");
			$("#videoUrl").parent().addClass("has-error has-feedback");
			return null;
		}
	}
	$("#videoUrl").parent().removeClass("has-error has-feedback");
	return videoUrl;
}

function getAid() {
	videoUrl = getVideoUrl();
	if (!videoUrl) return; // || !playUrl

	if (videoUrl.split("/av")[1]) {
		aid = videoUrl.split("/av")[1].split("/")[0];
		getInfo();
	}
	else {
		$.ajax(videoUrl, {
			type: "get",
			dataType: "text",
			error: function(xhr, status, error) {
				alert("[Error]获取视频aid出错！");
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
			alert("[Error]获取视频信息出错！");
		},
		success: function(data, status, xhr) {
			//console.log(data);
			data = JSON.parse(data);
			$("tbody").eq(1).html("");
			for (var i in data) {
				if (i == "cid") {
					cid = data[i];
					playUrl = generatePlayUrl();
				}
				if (data[i] && data[i].toString().indexOf("hdslb.com") != -1) { //解析图片地址
					data[i] = '<a href="' + data[i] + '" download=""><img src="' + data[i] + '"></a>';
				}
				$("tbody").eq(1).append("<tr>\
				<td class=\"capitalize\">" + i + "</td>\
				<td>" + data[i] + "</td>\
				</tr>");
			}
			getData(playUrl);
		}
	});
}

function generatePlayUrl() {
	var type = 0, params, sign;
	if (videoUrl.indexOf("bangumi") != -1 && videoUrl.indexOf("bangumi") != -1) type = 2;
	else if (videoUrl.indexOf("bangumi") != -1) type = 1;
	if (type) {
		if (type == 2) params = "cid=" + cid + "&module=movie&player=1&quality=112&ts=1";
		else params = "cid=" + cid + "&module=bangumi&player=1&quality=112&ts=1";
		sign = hex_md5(params + "9b288147e5474dd2aa67085f716c560d");
		return "http://bangumi.bilibili.com/player/web_api/playurl?" + params + "&sign=" + sign;
	}
	else {
		params = "appkey=84956560bc028eb7&cid=" + cid + "&qn=112&quality=112&type=";
		sign = hex_md5(params + "94aba54af9065f71de72f5508f1cd42e");
		return "http://interface.bilibili.com/v2/playurl?" + params + "&sign=" + sign;
	}
	//return "http://interface.bilibili.com/v2/playurl?appkey=84956560bc028eb7&otype=json&platform=bilihelper&type=flv&quality=80&qn=80&cid=" + cid;
}

function getData(url) {
	$.ajax(url, {
		type: "get",
		dataType: "xml",
		error: function(xhr, status, error) {
			alert("[Error]获取PlayUrl或下载链接出错！");
		},
		success: function(data, status, xhr) {
			//console.log(url, data);
			parseData($(data));
		}
	});
}

function parseData(data) {
	var target = data.find("durl");
	if (!target || !target.length) {
		alert("[Error]获取PlayUrl或下载链接出错！");
		return;
	}
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
	var quality = qualityArray[data.find("quality").text()] || "未知";
	$("#quality").html(quality);
	$("tbody").eq(0).html("");
	links = new Array();
	target.each(function(i, o) {
		var part = $(o);
		links.push(part.find("url").text());
		$("tbody").eq(0).append("<tr>\
			<td>" + part.find("order").text() + "</td>\
			<td>" + part.find("length").text()  / 1e3 + "</td>\
			<td>" + part.find("size").text() / 1e6 + "</td>\
			<td>\
				<div class=\"checkbox\">\
					<label>\
				  		<input type=\"checkbox\" checked=\"true\">\
					</label>\
			  	</div>\
			</td>\
		</tr>");
	});
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
			//{ name: 'zby', extensions: ['json'] },
		]
	}, function(res) {
		if (res[0]) $("#downloadPath").val(res[0]);
	});
}

function download(data) {
	var functionArray = new Array();
	//$("#download").html("");
	for (var i = 0; i < count; i++) {
		if ($('input[type="checkbox"]').eq(i).prop("checked")) {
			if (downloadArray.indexOf(links[i]) != -1) continue;
			$("#download").append('<span>' + cid + "-" + i + '</span>\
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
			functionArray.push(function(callback) {
				downloadLink(_i, _j);
				//callback(null, j + " Done");
			});
		} //由于js执行机制，此处不能直接传值
	}
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
	request.get(options).on("response", function(response) {
		//https://blog.csdn.net/zhu_06/article/details/79772229
		var proStream = progress({
			length: response.headers["content-length"],
			time: 500 //单位ms
		});
		proStream.on("progress", function(progress) {
			//console.log(progress);
			$(".speed").eq(j).html(Math.round(progress.speed / 1000) + "kb/s");
			$(".eta").eq(j).html("eta:" + progress.eta + "s");
			var percentage = progress.percentage; //显示进度条
			$(".progress-value").eq(j).html(Math.round(percentage) + "%");
			$(".progress-bar").eq(j).css("width", percentage + "%");
			if (percentage == 100) {
				$(".progress-bar").eq(j).removeClass("progress-bar-info").addClass("progress-bar-success").parent().removeClass("active");
				downloadArray.splice(downloadArray.indexOf(links[i]), 1);
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
			alert("[Error]弹幕下载失败！");
		},
		success: function(data, status, xhr) {
			gotFile(cid, data);
		}
	});
}

function gotFile(name, content) {
	var danmaku = parseFile(content);
	var ass = generateASS(setPosition(danmaku), {
		"title": document.title,
		"ori": name,
	});
	assDownload(ass, name + ".ass"); //"\ufeff" + 
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
