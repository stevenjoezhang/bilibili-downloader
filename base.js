const electron = require("electron").remote;
const ipcRenderer = require("electron").ipcRenderer;
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const url = require("url");
const https = require("https");
const fs = require("fs");
const request = require("request");
const progress = require("progress-stream");
const async = require("async");

var referer, playUrl, downloadPath, count, links, isDownloading = false;

function getVideoUrl() {
	var videoUrl = $("#videoUrl").val();// || "https://www.bilibili.com/bangumi/play/ep90832";
	if (videoUrl.indexOf("https://") != 0) {
		if (videoUrl.indexOf("http://") == 0) videoUrl = videoUrl.replace("http://", "https://");
		else {
			alert("无效的视频地址！");
			return null;
		}
	}
	return videoUrl;
}

function getPlayUrl() {
	var playUrl = $("#playUrl").val();// || "https://bangumi.bilibili.com/player/web_api/v2/playurl?cid=11090110&appkey=84956560bc028eb7&otype=json&type=&quality=80&module=bangumi&season_type=1&qn=80&sign=d6d73e8fbbc2adacaf047c48714e8e69";
	if (playUrl.indexOf("https://") != 0) {
		if (playUrl.indexOf("http://") == 0) playUrl = playUrl.replace("http://", "https://");
		else {
			alert("无效的PlayUrl！");
			return null;
		}
	}
	return playUrl;
}

function getData() {
	referer = getVideoUrl();
	playUrl = getPlayUrl();
	if (!referer || !playUrl) return;
	var data, html = "";

	https.get(playUrl, function(res) {

		res.on("data", function(msg) {
			html += msg;
		});
		res.on("end", function() {
			data = JSON.parse(html);
			$(".info").slideDown();
			show(data);
		});
	}).on("error", function() {
		alert("获取数据出错！");
	});
}

function show(data) {
	$("tbody").html("");
	var target = data.durl;
	count = target.length;
	links = new Array();
	for (var i in target) {
		var part = target[i];
		links.push(part.url);
		$("tbody").append("<tr>\
			<td>" + part.order + "</td>\
			<td>" + part.length + "</td>\
			<td>" + part.size + "</td>\
			<td>\
				<div class=\"checkbox\">\
					<label>\
				  		<input type=\"checkbox\" checked=\"true\">\
					</label>\
			  	</div>\
			</td>\
		</tr>");
	}
}

function download(data) {
	if (isDownloading) return;
	isDownloading = true;
	downloadPath = $("#downloadPath").val() || "";
	var functionArray = new Array();
	$(".download").show().html("");
	for (var i = 0; i < count; i++) {
		$(".download").append('<div class="progress progress-striped">\
	    <div class="progress-bar progress-bar-info" role="progressbar" style="width: 0%;">\
	        <span class="progress-value">0%</span>\
	    </div>\
	</div>');
		if ($('input[type="checkbox"]').eq(i).prop("checked")) functionArray.push(function(num) {
			downloadLink(num);
		}(i));
	}
	async.parallel(functionArray, function (err, results) {
        //do nothing
    });
}

function downloadLink(i) {
	var cid = playUrl.split("?cid=")[1].split("&")[0]; //"11090110"
	var file = path.join(downloadPath, cid + "-" + i + ".flv");
	var options = {  
		url: links[i],  
		encoding: null, //当请求的是二进制文件时，一定要设置
		headers: {
			"Range": "bytes=0-",
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1 Safari/605.1.15",
			"Referer": referer,
		}
	}
	console.log(cid, file, options.url);
	var downloads = fs.createWriteStream(file);
	request.get(options).on("response", function (response) { //显示进度条  
		//console.log(response);  
		var proStream = progress({  
			length: response.headers["content-length"],  
			time: 500 // ms
		});  
		  
		proStream.on("progress", function(progress) {  
			var percentage = progress.percentage;
			$(".progress-value").eq(i).html(Math.round(percentage) + "%");  
			$(".progress-bar").eq(i).css("width", percentage + "%");
			if (percentage >= 99) $(".progress-bar").eq(i).removeClass("progress-bar-info").addClass("progress-bar-success");
		});  
		request.get(options).pipe(proStream).pipe(downloads).on("error", function(e) {
  			console.error(e);
		}); //先pipe到proStream再pipe到文件的写入流中  
	}) 
}
