var danmakuArray;

function getDanmaku() {
	//alert(cid);
	$.ajax("https://comment.bilibili.com/" + cid + ".xml", {
		type: "get",
		dataType: "text", //避免ajax解析为xml造成问题
		error: function(xhr, status, error) {
			showError("弹幕加载失败！");
		},
		success: function(data, status, xhr) {
			danmakuArray = new Array();
			$(data).find("d").each(function(i, o) {
				var info = $(o).attr("p").split(",");
				var danmaku = {
					time: info[0],
					sendTime: info[4],
					user: info[6],
					url: (function(user) {
						var uid;
						if (0 === user.indexOf("D")) uid = "";
						else if (/^b(\d+)$/.exec(user)) uid = /^b(\d+)$/.exec(user)[1];
						else {
							//var crcEngine = new Crc32Engine();
							//uid = crcEngine.crack(user)[0]; //计算量较大！完整弹幕过滤系统 是否存储在新文件夹中 下载进度单独菜单 回车开始查询
						}
						return "https://space.bilibili.com/" + uid;
					}(info[6])),
					text: $(o).html()
				}
				danmakuArray.push(danmaku);
			}); //解析xml文档
		}
	});
}

function danmakuFilter(T1, T2, ST1, ST2, user, text) {
	$("tbody").eq(2).html("");
	for (var i in danmakuArray) {
		var target = danmakuArray[i];
		if (T1 != null && target.time <= T1) continue;
		if (T2 != null && target.time >= T2) continue;
		if (ST1 != null && target.sendTime <= ST1) continue;
		if (ST2 != null && target.sendTime >= ST2) continue;
		if (user != null && target.user != user) continue;
		if (text != null && target.text.indexOf(text) == -1) continue;
		$("tbody").eq(2).append("<tr>\
			<td>" + target.time + "</td>\
			<td>" + target.sendTime + "</td>\
			<td class='wrap'>" + target.text + "</td>\
			<td>\
				<a href='#' onclick=\"xml()\">" + target.user + "</button>\
			</td>\
		</tr>");
	}
}

function xml() {
	var url = "https://comment.bilibili.com/" + cid + ".xml";
	blobDownload(url, cid + ".xml");
}

function ass() {
	//使用ajax是因为bilibili采用了content-encoding:deflate压缩，若使用https.get需要zlib库解压，较为复杂
	$.ajax("https://comment.bilibili.com/" + cid + ".xml", {
		type: "get",
		dataType: "text",
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
