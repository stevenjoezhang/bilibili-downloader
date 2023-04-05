// downloader is used by `danmaku.js`
const downloader = new Downloader();

class Panel {
	async getAid() {
		const videoUrl = document.getElementById("videoUrl").value;
		downloader.getVideoUrl(videoUrl);
		if (downloader.url) {
			document.getElementById("videoUrl").classList.replace("is-invalid", "is-valid");
			await downloader.getAid();
			const { data } = await downloader.getInfo();
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
			await this.getData();
		} else {
			showError("无效的视频链接！");
			document.getElementById("videoUrl").classList.replace("is-valid", "is-invalid");
		}
	}

	async getData() {
		const { data, fallback } = await downloader.getData();
		const target = data.durl || data.result.durl;
		const quality = data.quality || data.result.quality,
			qualityArray = {
				112: "高清 1080P+",
				80: "高清 1080P",
				74: "高清 720P60",
				64: "高清 720P",
				48: "高清 720P",
				32: "清晰 480P",
				16: "流畅 360P",
				15: "流畅 360P"
			}; //需要修改，不是一一对应
		document.getElementById("quality").textContent = qualityArray[quality] || "未知";
		$("#success").show();
		fallback ? $("#error").show() : $("#error").hide();

		document.querySelector("#success tbody").innerHTML = "";
		target.forEach(part => {
			document.querySelector("#success tbody").insertAdjacentHTML("beforeend", `<tr>
							<td>${part.order}</td>
							<td>${part.length / 1e3}</td>
							<td>${part.size / 1e6}</td>
							<td>
								<div class="form-check">
									<input class="form-check-input" type="checkbox" checked="true">
								</div>
							</td>
						</tr>`);
		});
	}

	downloadAll() {
		downloader.downloadAll();
	}
}

const panel = new Panel();
