const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;

let fetchPromise;
let filenamifyPromise;
let mimePromise;

async function getFetch() {
	if (!fetchPromise) {
		fetchPromise = dynamicImport("node-fetch").then(mod => mod.default || mod);
	}
	return fetchPromise;
}

async function fetchUrl(url, options = undefined) {
	const fetch = await getFetch();
	return fetch(url, options);
}

async function sanitizeFilename(value) {
	if (!filenamifyPromise) {
		filenamifyPromise = dynamicImport("filenamify").then(mod => mod.default || mod);
	}
	const filenamify = await filenamifyPromise;
	return filenamify(value);
}

async function getMime() {
	if (!mimePromise) {
		mimePromise = dynamicImport("mime").then(mod => mod.default || mod);
	}
	return mimePromise;
}

async function getMimeType(value) {
	const mime = await getMime();
	return mime.getType(value);
}

async function getMimeExtension(value) {
	const mime = await getMime();
	return mime.getExtension(value);
}

module.exports = {
	fetchUrl,
	getMimeExtension,
	getMimeType,
	sanitizeFilename
};

export {};
