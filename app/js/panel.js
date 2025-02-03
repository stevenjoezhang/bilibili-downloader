const path = require("path");
const mime = require("mime");
const sanitize = require("filenamify");
const { Downloader } = require("./js/downloader.js");
const { ffmpegMerge } = require("./js/merge.js");

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
			document.querySelector("#nav .nav-link").click();
			document.querySelector("#tab-pane-1 tbody").innerHTML = "";
			for (let [key, value] of Object.entries(data)) {
				if (mime.getType(value) && mime.getType(value).includes("image")) { //解析图片地址
					value = `<a href="${value}" download=""><img src="${value}"></a>`;
				} else if (typeof value === "object") {
					value = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
				}
				document.querySelector("#tab-pane-1 tbody").insertAdjacentHTML("beforeend", `<tr>
						<th class="text-capitalize">${key}</th>
						<td>${value}</td>
					</tr>`)
			}
			document.getElementById("videoName").value = sanitize(downloader.uniqueName);
			this.getDownloadItems();
		} else {
			showError("无效的视频链接！");
			document.getElementById("videoUrl").classList.remove("is-valid");
			document.getElementById("videoUrl").classList.add("is-invalid");
		}
	}

	getDownloadItems() {
		const { items } = downloader.getDownloadItems();
		document.querySelector("#success tbody").innerHTML = "";
		items.forEach((part, index) => {
			document.querySelector("#success tbody").insertAdjacentHTML("beforeend", `<tr>
							<td>${part.mimeType}</td>
							<td>${part.codecs}</td>
							<td>${part.quality || ''}</td>
							<td>${part.bandwidth}</td>
							<td>
								<div class="form-check">
									<input class="form-check-input" type="radio" name="${part.type}" value="${index}">
								</div>
							</td>
						</tr>`);
		});
		document.querySelectorAll("#success tbody tr").forEach(tr => {
			tr.addEventListener("click", (e) => {
				let radio = tr.querySelector("input[type='radio']");
				if (radio) {
					radio.checked = true;
				}
			});
		});
	}

	downloadChecked() {
		const { cid, uniqueName } = downloader;
		const downloadPath = document.getElementById("downloadPath").value;
		const filename = document.getElementById("videoName").value || uniqueName;
		const videoRadio = [...document.getElementsByName('video')].filter(ele => ele.checked)[0];
		const audioRadio = [...document.getElementsByName('audio')].filter(ele => ele.checked)[0];
		if (!videoRadio || !audioRadio) {
			showError("请分别选择一个视频和一个音频进行下载！");
			return;
		}
		const promises = [videoRadio.value, audioRadio.value].map(part => {
			const ext = mime.getExtension(downloader.items[part].mimeType);
			const file = path.join(downloadPath, `${sanitize(filename)}-${part}.${ext}`);
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
		}).filter(Boolean);
		ipcRenderer.send("length", downloader.tasks.filter(item => !item.finished).length);
		if (!promises.length) {
			showWarning("没有新的音频/视频被下载！");
			return;
		}
		Promise.all(promises).then(async (paths) => {
			if (promises.length !== 2) return;
			const selection = await showMergeSelection();
			if (selection === 0) {
				// Merge video and audio
				ffmpegMerge(paths[0], paths[1], path.join(downloadPath, `${sanitize(filename)}.mp4`));
			}
		});
	}
}

const panel = new Panel();
