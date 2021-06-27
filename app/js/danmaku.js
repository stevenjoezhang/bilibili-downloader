let danmakuArray;

function getDanmaku() {
	fetch(`https://comment.bilibili.com/${downloader.cid}.xml`)
		.then(response => response.text())
		.then(result => {
			danmakuArray = [];
			$(result).find("d").each((i, o) => {
				const info = $(o).attr("p").split(","),
					danmaku = {
						time: info[0],
						sendTime: info[4],
						user: info[6],
						text: $(o).html()
					};
				danmakuArray.push(danmaku);
			}); //解析xml文档
		})
		.catch(error => showError("弹幕加载失败！"));
}

function danmakuFilter(text, T1, T2, ST1, ST2, user) {
	$("tbody").eq(2).html("");
	for (let target of danmakuArray) {
		const time = parseFloat(target.time);
		let sendTime = parseFloat(target.sendTime);
		if (text && !target.text.includes(text)) continue;
		if (T1 && time <= T1) continue; //time<=NaN为false
		if (T2 && time >= T2) continue;
		if (ST1 && sendTime <= ST1) continue;
		if (ST2 && sendTime >= ST2) continue;
		if (user && target.user !== user) continue;
		const newDate = new Date();
		newDate.setTime(sendTime * 1000);
		sendTime = newDate.toISOString().substring(5, 19).replace("T", " ");
		$("tbody").eq(2).append(`<tr>
			<td>${formatSeconds(time)}</td>
			<td>${sendTime}</td>
			<td>${target.text}</td>
			<td>
				<button class="btn btn-link" onclick="searchUser(event)">${target.user}</button>
			</td>
		</tr>`);
	}
}

function formatSeconds(value) {
	function addZero(int) {
		string = int.toString();
		while (string.length < 2) string = "0" + string;
		return string;
	}
	let ms = value - parseInt(value),
		secondTime = parseInt(value) || 0,
		minuteTime = 0;
	if (secondTime > 60) {
		minuteTime = parseInt(secondTime / 60);
		secondTime = parseInt(secondTime % 60);
	}
	return `${addZero(minuteTime)}:${addZero(secondTime)}.${ms.toFixed(3).split(".")[1]}`;
}

function searchUser(event) {
	event.preventDefault();
	const user = $(event.target).html();
	let uid;
	if (user.indexOf("D") === 0) uid = "";
	else if (/^b(\d+)$/.exec(user)) uid = /^b(\d+)$/.exec(user)[1];
	else {
		const crcEngine = new Crc32Engine();
		uid = crcEngine.crack(user)[0]; //计算量较大！手动点击开始查询用户
	}
	const url = "https://space.bilibili.com/" + uid;
	ipcRenderer.send("open-external", url);
}

function xml() {
	blobDownload(`https://comment.bilibili.com/${downloader.cid}.xml`, downloader.cid + ".xml");
}

function ass() {
	//使用fetch是因为bilibili采用了content-encoding:deflate压缩，若使用https.get需要zlib库解压，较为复杂
	fetch(`https://comment.bilibili.com/${downloader.cid}.xml`)
		.then(response => response.text())
		.then(result => {
			const danmaku = parseFile(result),
				ass = generateASS(setPosition(danmaku), {
					title: document.title,
					ori: downloader.cid,
				});
			assDownload(ass, downloader.cid + ".ass"); //"\ufeff" +
		})
		.catch(error => showError("弹幕下载失败！"));
}

function parseFile(content) {
	content = content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
	return parseXML(content);
}

function assDownload(data, filename) {
	const blob = new Blob([data], {
			type: "application/octet-stream"
		}),
		url = window.URL.createObjectURL(blob);
	blobDownload(url, filename);
	document.addEventListener("unload", () => {
		window.URL.revokeObjectURL(url);
	});
}

function blobDownload(url, filename) {
	const saveAs = document.createElement("a");
	saveAs.href = url;
	saveAs.style.display = "none";
	document.body.appendChild(saveAs);
	saveAs.download = filename;
	saveAs.click();
	setTimeout(() => {
		saveAs.parentNode.removeChild(saveAs);
	}, 1000);
}
