// @ts-nocheck
const path = require("path");
const appDir = path.basename(__dirname) === "electron" ? path.dirname(__dirname) : __dirname;
const { Downloader } = require(path.join(appDir, "common/downloader.js"));
const { ffmpegMerge } = require(path.join(appDir, "common/merge.js"));
const { getMimeExtension, getMimeType, sanitizeFilename } = require(path.join(appDir, "common/modules.js"));

// downloader is used by `danmaku.js`
const downloader = new Downloader();

class Panel {
	async getVideoInfo() {
		const videoUrl = document.getElementById("videoUrl").value;
		const succeed = await downloader.getPlayUrlWebPage(videoUrl);
		if (succeed) {
			const data = downloader.videoData;
			document.getElementById("videoUrl").classList.remove("is-invalid");
			document.getElementById("videoUrl").classList.add("is-valid");
			getDanmaku(); //获取cid后，获取下载链接和弹幕信息
			// console.log("VIDEO INFO", data);
			document.getElementById("nav").classList.remove("d-none");
			document.getElementById("mainHelp").classList.add("d-none");
			document.querySelector("#nav .nav-link").click();
			document.querySelector("#tab-pane-1 tbody").innerHTML = "";
			for (let [key, value] of Object.entries(data)) {
				const mimeType = await getMimeType(value);
				if (mimeType && mimeType.includes("image")) { //解析图片地址
					value = `<a href="${value}" download=""><img src="${value}"></a>`;
				} else if (typeof value === "object") {
					value = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
				}
				document.querySelector("#tab-pane-1 tbody").insertAdjacentHTML("beforeend", `<tr>
						<th class="text-capitalize">${key}</th>
						<td>${value}</td>
					</tr>`)
			}
			document.getElementById("videoName").value = await sanitizeFilename(downloader.uniqueName);
			this.getDownloadItems();
		} else {
			showError("无效的视频链接！");
			document.getElementById("videoUrl").classList.remove("is-valid");
			document.getElementById("videoUrl").classList.add("is-invalid");
		}
	}

	getDownloadItems() {
		const { items } = downloader.getDownloadItems();
		const videoItems = items.filter(part => part.type === "video");
		const audioItems = items.filter(part => part.type === "audio");
		const videoTbody = document.querySelector("#success > table tbody");
		const audioTbody = document.querySelector("#audioSection table tbody");
		videoTbody.innerHTML = "";
		audioTbody.innerHTML = "";
		document.getElementById("audioSection").classList.toggle("d-none", audioItems.length === 0);
		items.forEach((part) => {
			// value 使用在整个 items 中的下标，与 downloadChecked 的取值逻辑保持一致
			const index = items.indexOf(part);
			const radio = `<input class="radio" type="radio" name="${part.type}" value="${index}">`;
			// 大小先显示占位符，异步获取准确值后填充
			const sizeCell = `<td class="size" id="size-${index}">…</td>`;
			const row = part.type === "video"
				? `<tr>
							<td>${part.mimeType}</td>
							<td>${part.codecs}</td>
							<td>${part.quality || ''}</td>
							${sizeCell}
							<td>${radio}</td>
						</tr>`
				: `<tr>
							<td>${part.mimeType}</td>
							<td>${part.codecs}</td>
							${sizeCell}
							<td>${radio}</td>
						</tr>`;
			(part.type === "video" ? videoTbody : audioTbody).insertAdjacentHTML("beforeend", row);
		});
		document.querySelectorAll("#success tbody tr").forEach(tr => {
			tr.addEventListener("click", (e) => {
				let radio = tr.querySelector("input[type='radio']");
				if (radio) {
					radio.checked = true;
				}
			});
		});
		this.fillSizes(items);
	}

	// 异步获取每个流的准确大小并填充到表格
	async fillSizes(items) {
		const formatSize = (bytes) => {
			if (bytes === null) {
				return "—";
			}
			if (bytes >= 1024 ** 3) {
				return (bytes / 1024 ** 3).toFixed(2) + " GB";
			}
			if (bytes >= 1024 ** 2) {
				return (bytes / 1024 ** 2).toFixed(2) + " MB";
			}
			return (bytes / 1024).toFixed(1) + " KB";
		};
		for (const part of items) {
			const index = items.indexOf(part);
			const cell = document.getElementById(`size-${index}`);
			if (!cell) {
				continue;
			}
			cell.textContent = formatSize(await downloader.getSizeByIndex(index));
		}
	}

	async downloadChecked() {
		const { cid, uniqueName } = downloader;
		const downloadPath = document.getElementById("downloadPath").value;
		const filename = document.getElementById("videoName").value || uniqueName;
		const videoRadio = [...document.getElementsByName('video')].filter(ele => ele.checked)[0];
		const audioRadio = [...document.getElementsByName('audio')].filter(ele => ele.checked)[0];
		const hasAudio = Boolean(document.getElementsByName('audio').length);
		const wantXml = document.getElementById("danmakuXml").checked;
		const wantAss = document.getElementById("danmakuAss").checked;
		if (wantXml) xml();
		if (wantAss) ass();
		if (!videoRadio || (hasAudio && !audioRadio)) {
			if (!wantXml && !wantAss) {
				showError(hasAudio ? "请分别选择一个视频和一个音频进行下载！" : "请选择一个视频进行下载！");
				return;
			}
			return; // 仅下载弹幕
		}
		const selectedParts = hasAudio ? [videoRadio.value, audioRadio.value] : [videoRadio.value];
		const safeFilename = await sanitizeFilename(filename);
		const promises = await Promise.all(selectedParts.map(async part => {
			const ext = await getMimeExtension(downloader.items[part].mimeType);
			const file = path.join(downloadPath, `${safeFilename}-${part}.${ext}`);
			const { status, size, task } = downloader.downloadByIndex(part, file, (progress, index) => {
				const { speed, eta, percentage } = progress; //显示进度条
				document.querySelectorAll(".speed")[index].textContent = Math.round(speed / 1e3) + "KB/s";
				document.querySelectorAll(".eta")[index].textContent = `eta:${eta}s`;
				const bar = document.querySelectorAll(".progress-bar")[index];
				bar.style.setProperty("width", percentage + "%")
				bar.textContent = Math.round(percentage) + "%";
				if (percentage === 100) {
					bar.classList.replace("progress-bar-animated", "bg-success");
					ipcRenderer.send("length", downloader.tasks.filter(item => !item.finished).length);
				}
			});
			if (status === "duplicate") return;
			const addon = size ? `从 ${Math.round(size / 1e6)}MB 处恢复的下载` : "";
			document.getElementById("download").insertAdjacentHTML("beforeend", `<span>${cid}-${part}</span>
				<span class="speed"></span>
				<span class="eta"></span>
				<span class="addon">${addon}</span>
				<div class="progress mt-1 mb-3">
					<div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%;">
						0%
					</div>
				</div>`);
			return task;
		}));
		const filteredPromises = promises.filter(Boolean);
		ipcRenderer.send("length", downloader.tasks.filter(item => !item.finished).length);
		if (!filteredPromises.length) {
			showWarning("没有新的音频/视频被下载！");
			return;
		}
		Promise.all(filteredPromises).then(async (paths) => {
			if (filteredPromises.length !== 2) return;
			const selection = await showMergeSelection();
			if (selection === 0) {
				// Merge video and audio
				ffmpegMerge(paths[0], paths[1], path.join(downloadPath, `${safeFilename}.mp4`), {
					onEnd: () => showMessage('合并完成'),
					onError: (err) => showError('发生错误: ' + err.message)
				}).catch(() => {});
			}
		});
	}
}

const panel = new Panel();
