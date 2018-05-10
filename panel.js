const path = require("path");
const url = require("url");
const fs = require("fs");
const request = require("request");
const progress = require("progress-stream");
const async = require("async");
const electron = require("electron");
const { dialog } = electron.remote;

var videoUrl, playUrl, count, links, cid, downloadArray = new Array(), downloadIndex = 0;
var debug = !true;

function getVideoUrl() {
	var videoUrl = $("#videoUrl").val();
	if (debug) videoUrl = "https://www.bilibili.com/bangumi/play/ep90832";
	if (videoUrl.indexOf("https://") != 0) {
		if (videoUrl.indexOf("http://") == 0) videoUrl = videoUrl.replace("http://", "https://");
		else if (videoUrl.indexOf("bilibili") != -1) videoUrl = "https://" + videoUrl;
		else {
			alert("无效的视频地址！");
			return null;
		}
	}
	return videoUrl;
}

function getPlayUrl() {
	var playUrl = $("#playUrl").val();
	if (debug) playUrl = "https://bangumi.bilibili.com/player/web_api/v2/playurl?cid=11090110&appkey=84956560bc028eb7&otype=json&type=&quality=80&module=bangumi&season_type=1&qn=80&sign=d6d73e8fbbc2adacaf047c48714e8e69";
	if (playUrl.indexOf("https://") != 0) {
		if (playUrl.indexOf("http://") == 0) playUrl = playUrl.replace("http://", "https://");
		else if (playUrl.indexOf("bilibili") != -1) playUrl = "https://" + playUrl;
		else {
			alert("无效的PlayUrl！");
			return null;
		}
	}
	return playUrl;
}

function getData() {
	videoUrl = getVideoUrl();
	playUrl = getPlayUrl();
	if (!videoUrl || !playUrl) return;

	$.ajax(playUrl, {
		type: "get",
		dataType: "text",
		error: function(xhr, status, error) {
			alert("获取PlayUrl出错！");
		},
		success: function(data, status, xhr) {
			data = JSON.parse(data);
			parseData(data);
		}
	});
}

function parseData(data) {
	var target = data.durl;
	count = target.length;
	if (!count) {
		alert("获取下载链接出错！");
		return;
	}
	cid = playUrl.split("?cid=")[1].split("&")[0];
	$("#cid").html(cid);
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
	$("#nav").show();
	if ($(".info").eq(1).is(":hidden")) $(".info").eq(0).fadeIn();

	if (videoUrl.split("/av")[1]) {
		aid = videoUrl.split("/av")[1].split("/")[0];
		getInfo();
	}
	else {
		$.ajax(videoUrl, {
			type: "get",
			dataType: "text",
			error: function(xhr, status, error) {
				alert("获取视频aid出错！");
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
			alert("获取视频信息出错！");
		},
		success: function(data, status, xhr) {
			//console.log(data);
			data = JSON.parse(data);
			$("tbody").eq(1).html("");
			for (var i in data) {
				if (data[i] && data[i].toString().indexOf(".jpg") != -1) {
					data[i] = '<a href="' + data[i] + '" download=""><img src="' + data[i] + '"></a>';
				}
				$("tbody").eq(1).append("<tr>\
				<td>" + i + "</td>\
				<td>" + data[i] + "</td>\
				</tr>");
			}
		}
	});
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
        $("#downloadPath").val(res[0]);
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
			"Range": "bytes=0-",
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
			alert("弹幕下载失败！");
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
	assDownload(ass, name.replace(/\.[^.]*$/, "") + ".ass"); //"\ufeff" + 
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
