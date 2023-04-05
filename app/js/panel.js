// downloader is used by `danmaku.js`
const downloader = new Downloader();

class Panel {
	getAid() {
		const videoUrl = document.getElementById("videoUrl").value;
		downloader.getVideoUrl(videoUrl);
		if (downloader.url) {
			document.getElementById("videoUrl").classList.replace("is-invalid", "is-valid");
			downloader.getAid();
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
