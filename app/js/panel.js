// downloader is used by `danmaku.js`
const downloader = new Downloader();

class Panel {
	async getAid() {
		const videoUrl = document.getElementById("videoUrl").value;
		downloader.getVideoUrl(videoUrl);
		if (downloader.url) {
			document.getElementById("videoUrl").classList.replace("is-invalid", "is-valid");
			const { data } = await downloader.getAid();
			console.log("VIDEO INFO", data);
			document.getElementById("cid").textContent = downloader.cid;
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
			downloader.name = `${downloader.id}-${data.title}`;
			document.getElementById("videoName").value = sanitize(downloader.name);
		} else {
			showError("无效的视频链接！");
			document.getElementById("videoUrl").classList.replace("is-valid", "is-invalid");
		}
	}

	downloadAll() {
		downloader.downloadAll();
	}
}

const panel = new Panel();
