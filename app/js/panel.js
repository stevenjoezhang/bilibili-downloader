const path = require("path");
const mime = require("mime");
const sanitize = require("filenamify");
const { Downloader } = require("./js/downloader.js");

// downloader is used by `danmaku.js`
const downloader = new Downloader();

class Panel {
	async getVideoInfo() {
		const videoUrl = document.getElementById("videoUrl").value;
		const succeed = await downloader.getPlayUrlWebPage(videoUrl);
		if (succeed) {
			const data = downloader.videoData;
			document.getElementById("videoUrl").classList.replace("is-invalid", "is-valid");
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
			this.getData();
		} else {
			showError("无效的视频链接！");
			document.getElementById("videoUrl").classList.replace("is-valid", "is-invalid");
		}
	}

	getData() {
		const { quality, items } = downloader.prepareDownload();
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
	}

	downloadChecked() {
		const { cid } = downloader;
		const name = downloader.uniqueName;
		const downloadPath = document.getElementById("downloadPath").value;
		const filename = document.getElementById("videoName").value || name || cid;
		let newDownload = false;
		const videoRadio = [...document.getElementsByName('video')].filter(ele => ele.checked)[0];
		const audioRadio = [...document.getElementsByName('audio')].filter(ele => ele.checked)[0];
		if (!videoRadio || !audioRadio) {
			showError("请分别选择一个视频和一个音频进行下载！");
			return;
		}
		const parts = {
			video: videoRadio.value,
			audio: audioRadio.value
		};
		for (let part of Object.values(parts)) {
			const ext = mime.getExtension(downloader.items[part].mimeType);
			const file = path.join(downloadPath, `${sanitize(filename)}-${part}.${ext}`);
			const state = downloader.downloadByIndex(part, file, (progress, index) => {
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
			if (state === "DUPLICATE") return;
			const addon = state ? `从 ${Math.round(state.size / 1e6)}MB 处恢复的下载` : "";
			document.getElementById("download").insertAdjacentHTML("beforeend", `<span>${cid}-${part}</span>
				<span class="speed"></span>
				<span class="eta"></span>
				<span class="addon">${addon}</span>
				<div class="progress mt-1 mb-3">
					<div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%;">
						0%
					</div>
				</div>`);
			newDownload = true;
		}
		ipcRenderer.send("length", downloader.tasks.filter(item => !item.finished).length);
		if (!newDownload) showWarning("没有新的视频被下载！");
	}
}

const panel = new Panel();
