// @ts-nocheck
// 注意：本文件通过 <script> 标签加载：
// 1. require 相对页面(panel.html)解析，引用项目内模块必须用 __dirname 拼绝对路径
// 2. 顶层 const/let 与其他 <script>（如 panel.js 的 path）共享作用域，命名不能冲突
const danmakuModules = (function () {
	const path = require("path");
	const appDir = path.basename(__dirname) === "electron" ? path.dirname(__dirname) : __dirname;
	return require(path.join(appDir, "common/modules.js"));
})();
let danmakuArray;

function getDanmaku() {
	danmakuModules.fetchUrl(`https://comment.bilibili.com/${downloader.cid}.xml`)
		.then(response => response.text())
		.then(result => {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(result, "text/xml");
			danmakuArray = [...xmlDoc.querySelectorAll("d")].map(element => {
				const info = element.getAttribute("p").split(",");
				return {
					time: info[0],
					sendTime: info[4],
					user: info[6],
					text: element.textContent
				};
			}); //解析xml文档
		})
		.catch(error => showError("弹幕加载失败！"));
}

function danmakuFilter(text, T1, T2, ST1, ST2, user) {
	document.querySelector("#danmaku tbody").innerHTML = "";
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
		document.querySelector("#danmaku tbody").insertAdjacentHTML("beforeend", `<tr>
			<td>${formatSeconds(time)}</td>
			<td>${sendTime}</td>
			<td>${target.text}</td>
			<td>
				<button class="btn-link" onclick="searchUser(event)">${target.user}</button>
			</td>
		</tr>`);
	}
}

function formatSeconds(value) {
	const addZero = int => int.toString().padStart(2, '0');

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
	const user = event.target.textContent;
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

// 弹幕保存路径与视频/音频一致：下载路径 + 文件名（含扩展名）
async function getDanmakuPath(ext) {
	const path = require("path");
	const { sanitizeFilename } = danmakuModules;
	const downloadPath = document.getElementById("downloadPath").value || defaultPath;
	const filename = document.getElementById("videoName").value || downloader.uniqueName;
	const safeFilename = await sanitizeFilename(filename);
	return path.join(downloadPath, `${safeFilename}.${ext}`);
}

async function xml() {
	try {
		const response = await danmakuModules.fetchUrl(`https://comment.bilibili.com/${downloader.cid}.xml`);
		const result = await response.text();
		const file = await getDanmakuPath("xml");
		require("fs").writeFileSync(file, result);
		showMessage(`弹幕已保存到 ${file}`);
	}
	catch (error) {
		showError("弹幕下载失败！");
	}
}

async function ass() {
	//使用fetch是因为bilibili采用了content-encoding:deflate压缩，若使用https.get需要zlib库解压，较为复杂
	try {
		const response = await danmakuModules.fetchUrl(`https://comment.bilibili.com/${downloader.cid}.xml`);
		const result = await response.text();
		const danmaku = parseFile(result),
			ass = generateASS(setPosition(danmaku), {
				title: document.title,
				ori: downloader.cid,
			});
		const file = await getDanmakuPath("ass");
		require("fs").writeFileSync(file, ass);
		showMessage(`弹幕已保存到 ${file}`);
	}
	catch (error) {
		showError("弹幕下载失败！");
	}
}

function parseFile(content) {
	content = content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
	return parseXML(content);
}
