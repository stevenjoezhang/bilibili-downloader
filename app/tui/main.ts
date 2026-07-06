const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const mime = require("mime");
const sanitize = require("filenamify");
const { Downloader } = require("../common/downloader.js");
const { ffmpegMerge } = require("../common/merge.js");
const { saveDanmakuXml } = require("../common/danmaku.js");
const LoginQR = require("../common/login/login-qr.js");
const LoginHelper = require("../common/login/login-helper.js");

const BAR_WIDTH = 28;

function clearScreen() {
	process.stdout.write("\x1b[2J\x1b[H");
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function createPrompt() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
}

function ask(rl, question, defaultValue = ""): Promise<string> {
	const suffix = defaultValue ? ` (${defaultValue})` : "";
	return new Promise(resolve => {
		rl.question(`${question}${suffix}: `, answer => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

function formatBandwidth(value) {
	if (!value) return "-";
	if (value >= 1e6) return `${(value / 1e6).toFixed(2)}Mbps`;
	if (value >= 1e3) return `${Math.round(value / 1e3)}Kbps`;
	return `${value}bps`;
}

function formatSpeed(value) {
	if (!value) return "-";
	if (value >= 1e6) return `${(value / 1e6).toFixed(2)}MB/s`;
	if (value >= 1e3) return `${Math.round(value / 1e3)}KB/s`;
	return `${Math.round(value)}B/s`;
}

function progressBar(percentage = 0) {
	const safePercentage = Math.max(0, Math.min(100, percentage || 0));
	const filled = Math.round((safePercentage / 100) * BAR_WIDTH);
	return `${"█".repeat(filled)}${"░".repeat(BAR_WIDTH - filled)} ${Math.round(safePercentage).toString().padStart(3)}%`;
}

function renderHeader(title = "Mimi Downloader TUI") {
	console.log(title);
	console.log("=".repeat(title.length));
	console.log("");
}

function renderVideoInfo(downloader) {
	const data = downloader.videoData || {};
	console.log(`标题: ${data.title || downloader.uniqueName}`);
	console.log(`BVID: ${downloader.bvid}    CID: ${downloader.cid}`);
	console.log("");
}

function renderItems(items, type) {
	const filtered = items
		.map((item, index) => ({ ...item, index }))
		.filter(item => item.type === type);
	console.log(type === "video" ? "视频流" : "音频流");
	console.log("-".repeat(72));
	for (const item of filtered) {
		const quality = item.quality || "-";
		console.log(
			`${item.index.toString().padStart(2)}  ${item.mimeType.padEnd(16)} ${quality.padEnd(10)} ${formatBandwidth(item.bandwidth).padEnd(10)} ${item.codecs}`
		);
	}
	console.log("");
	return filtered;
}

function getBestIndex(items, type) {
	const filtered = items
		.map((item, index) => ({ ...item, index }))
		.filter(item => item.type === type);
	if (!filtered.length) return "";
	const sorted = filtered.slice().sort((a, b) => {
		if (type === "video") {
			const heightA = Number((a.quality || "0x0").split("x")[1]) || 0;
			const heightB = Number((b.quality || "0x0").split("x")[1]) || 0;
			return heightB - heightA || b.bandwidth - a.bandwidth;
		}
		return b.bandwidth - a.bandwidth;
	});
	return String(sorted[0].index);
}

async function chooseItem(rl, items, type) {
	const bestIndex = getBestIndex(items, type);
	if (!bestIndex) return null;
	const label = type === "video" ? "视频" : "音频";
	while (true) {
		const answer = await ask(rl, `选择${label}流编号`, bestIndex);
		const index = Number(answer);
		if (Number.isInteger(index) && items[index] && items[index].type === type) {
			return index;
		}
		console.log(`无效的${label}流编号。`);
	}
}

async function runLogin() {
	clearScreen();
	renderHeader("扫码登录");
	console.log("正在获取登录二维码...");
	const loginUrl = await LoginQR.getLoginUrl();
	if (!loginUrl || loginUrl.code !== 0 || !loginUrl.data || !loginUrl.data.url) {
		throw new Error("获取登录二维码失败");
	}

	const qrCode = await LoginQR.getLoginQRCodeTerminalFromUrl(loginUrl.data.url);
	clearScreen();
	renderHeader("扫码登录");
	if (qrCode) console.log(qrCode);
	console.log("如果二维码显示异常，也可以复制下面的链接到浏览器打开：");
	console.log(loginUrl.data.url);
	console.log("");

	while (true) {
		const loginStatus = await LoginQR.getLoginStatus(loginUrl.data.qrcode_key);
		const code = loginStatus && loginStatus.data ? loginStatus.data.code : null;
		const message = loginStatus && loginStatus.data ? loginStatus.data.message : "等待扫码";
		process.stdout.write(`\r状态: ${message}          `);

		if (code === 0) {
			await LoginHelper.saveLoginInfoCookies(loginStatus.data.url);
			process.stdout.write("\n登录成功。\n");
			return;
		}
		if (code === 86038) {
			throw new Error("二维码已过期，请重新登录");
		}
		await sleep(1000);
	}
}

function renderDownloadProgress(title, rows, mergeProgress = null) {
	clearScreen();
	renderHeader(title);
	for (const row of rows) {
		const progress = row.progress || {};
		const percentage = progress.percentage || 0;
		const eta = Number.isFinite(progress.eta) ? `${progress.eta}s` : "-";
		console.log(`${row.label.padEnd(8)} ${progressBar(percentage)}  ${formatSpeed(progress.speed).padEnd(10)} eta ${eta}`);
	}
	if (mergeProgress) {
		console.log("");
		console.log(`${"merge".padEnd(8)} ${progressBar(mergeProgress.percent || 0)}`);
	}
}

async function downloadSelection(rl, downloader, items, downloadPath, filename, videoIndex, audioIndex = null) {
	await fs.promises.mkdir(downloadPath, { recursive: true });
	const selected = [videoIndex, audioIndex].filter(index => index !== null).map(index => {
		const item = items[index];
		const ext = mime.getExtension(item.mimeType) || (item.type === "audio" ? "m4a" : "mp4");
		return {
			index,
			item,
			label: item.type,
			file: path.join(downloadPath, `${sanitize(filename)}-${index}.${ext}`),
			progress: { percentage: 0, speed: 0, eta: 0 }
		};
	});

	let lastRender = 0;
	const render = () => {
		const now = Date.now();
		if (now - lastRender < 120) return;
		lastRender = now;
		renderDownloadProgress("下载中", selected);
	};

	const tasks = selected.map(row => {
		const result = downloader.downloadByIndex(row.index, row.file, (progress, taskIndex) => {
			row.progress = progress;
			render();
		});
		if (result.status === "duplicate") return null;
		if (result.size) {
			row.progress.percentage = 0;
		}
		return result.task;
	}).filter(Boolean);

	if (!tasks.length) {
		console.log("没有新的音频/视频被下载。");
		return [];
	}

	renderDownloadProgress("下载中", selected);
	const paths = await Promise.all(tasks);
	renderDownloadProgress("下载完成", selected);
	if (paths.length !== 2) {
		console.log("");
		console.log("单流下载完成，跳过合并。");
		return paths;
	}
	console.log("");
	const shouldMerge = (await ask(rl, "是否合并音视频？[Y/n]", "Y")).toLowerCase();
	if (shouldMerge !== "n") {
		let mergeProgress = { percent: 0 };
		renderDownloadProgress("合并中", selected, mergeProgress);
		await ffmpegMerge(paths[0], paths[1], path.join(downloadPath, `${sanitize(filename)}.mp4`), {
			onProgress: progress => {
				mergeProgress = progress || mergeProgress;
				renderDownloadProgress("合并中", selected, mergeProgress);
			}
		});
		renderDownloadProgress("合并完成", selected, { percent: 100 });
		console.log("");
		console.log(`输出: ${path.join(downloadPath, `${sanitize(filename)}.mp4`)}`);
	}
	return paths;
}

async function handleVideo(rl, videoUrl) {
	const downloader = new Downloader();
	clearScreen();
	renderHeader("解析视频");
	console.log(videoUrl);
	const succeed = await downloader.getPlayUrlWebPage(videoUrl);
	if (!succeed) {
		throw new Error("无效的视频链接，或页面解析失败");
	}

	const { items } = downloader.getDownloadItems();
	const defaultPath = path.join(os.homedir(), "Downloads");
	const defaultName = sanitize(downloader.uniqueName);

	clearScreen();
	renderHeader();
	renderVideoInfo(downloader);
	renderItems(items, "video");
	renderItems(items, "audio");

	const downloadPath = await ask(rl, "下载目录", defaultPath);
	const filename = await ask(rl, "文件名", defaultName);
	const shouldSaveDanmaku = (await ask(rl, "是否下载弹幕 XML？[y/N]", "N")).toLowerCase();
	if (shouldSaveDanmaku === "y") {
		const file = path.join(downloadPath, `${sanitize(filename)}-${downloader.cid}.xml`);
		await fs.promises.mkdir(downloadPath, { recursive: true });
		await saveDanmakuXml(downloader.cid, file);
		console.log(`弹幕已保存: ${file}`);
	}

	const videoIndex = await chooseItem(rl, items, "video");
	if (videoIndex === null) {
		throw new Error("没有可下载的视频流");
	}
	const audioIndex = await chooseItem(rl, items, "audio");
	await downloadSelection(rl, downloader, items, downloadPath, filename, videoIndex, audioIndex);
}

async function main() {
	const rl = createPrompt();
	const initialUrl = process.argv.slice(2).find(arg => !arg.startsWith("-"));

	try {
		let nextUrl = initialUrl || "";
		while (true) {
			if (!nextUrl) {
				clearScreen();
				renderHeader();
				console.log(`登录状态: ${LoginHelper.getLoginInfoCookies() ? "已保存登录信息" : "未登录"}`);
				console.log("");
				console.log("输入视频 URL 开始下载。命令：l 登录，q 退出。");
				console.log("");
				nextUrl = await ask(rl, "视频 URL / 命令");
			}

			if (!nextUrl) continue;
			const videoUrl = nextUrl;
			const command = videoUrl.toLowerCase();
			nextUrl = "";
			if (command === "q" || command === "quit" || command === "exit") break;
			if (command === "l" || command === "login") {
				await runLogin();
				await ask(rl, "按 Enter 返回主菜单");
				continue;
			}

			try {
				await handleVideo(rl, videoUrl);
			} catch (error) {
				console.log("");
				console.log(`错误: ${error.message}`);
			}
			await ask(rl, "按 Enter 返回主菜单");
		}
	} finally {
		rl.close();
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});

export {};
