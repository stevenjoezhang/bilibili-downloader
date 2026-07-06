declare module "fluent-ffmpeg" {
	type FfmpegHandler<T = unknown> = (value: T) => void;

	interface FfmpegCommand {
		input(path: string): FfmpegCommand;
		outputOptions(option: string): FfmpegCommand;
		on(event: "progress", handler: FfmpegHandler<{ percent?: number }>): FfmpegCommand;
		on(event: "end", handler: FfmpegHandler<void>): FfmpegCommand;
		on(event: "error", handler: FfmpegHandler<Error>): FfmpegCommand;
		save(path: string): void;
	}

	interface FfmpegFactory {
		(): FfmpegCommand;
		setFfmpegPath(path: string): void;
	}

	const ffmpeg: FfmpegFactory;
	export = ffmpeg;
}

declare module "ffmpeg-static" {
	const ffmpegPath: string;
	export = ffmpegPath;
}

declare module "mime" {
	export function getType(path: string): string | null;
	export function getExtension(type: string): string | null;
}

declare module "node-fetch" {
	const fetch: typeof globalThis.fetch;
	export = fetch;
}

declare module "progress-stream" {
	interface ProgressInfo {
		percentage: number;
		speed: number;
		eta: number;
	}

	interface ProgressStream extends NodeJS.ReadWriteStream {
		setLength(length: string | number | null): void;
		on(event: "progress", listener: (progress: ProgressInfo) => void): this;
	}

	function progress(options?: { time?: number; length?: string | number }): ProgressStream;
	export = progress;
}

declare module "qrcode" {
	export function toDataURL(
		text: string,
		options?: { width?: number; height?: number }
	): Promise<string>;
	export function toString(
		text: string,
		options?: { type?: string; small?: boolean }
	): Promise<string>;
}

declare function getRandomBuvid3(): string;
declare function showMessage(message: string): void;
declare function showError(message: string): void;
