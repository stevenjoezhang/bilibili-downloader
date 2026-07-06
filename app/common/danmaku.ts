const fs = require("fs");
const { fetchUrl } = require("./modules.js");

async function fetchDanmakuXml(cid) {
	const response = await fetchUrl(`https://comment.bilibili.com/${cid}.xml`);
	if (!response.ok) {
		throw new Error(`Failed to download danmaku. Status code: ${response.status}`);
	}
	return response.text();
}

async function saveDanmakuXml(cid, file) {
	const xml = await fetchDanmakuXml(cid);
	await fs.promises.writeFile(file, xml);
	return file;
}

module.exports = {
	fetchDanmakuXml,
	saveDanmakuXml
};

export {};
