const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

type MergeCallbacks = {
    onProgress?: (progress) => void;
    onEnd?: () => void;
    onError?: (err) => void;
};

// 告诉 fluent-ffmpeg 使用静态二进制文件
ffmpeg.setFfmpegPath(ffmpegPath);

function ffmpegMerge(videoPath, audioPath, outputPath, callbacks: MergeCallbacks = {}) {
    return new Promise((resolve, reject) => {
        ffmpeg()
        .input(videoPath)      // 输入视频文件
        .input(audioPath)      // 输入音频文件
        .outputOptions('-c:v copy')   // 保持视频编码
        .outputOptions('-c:a aac')    // 使用 AAC 音频编码
        .outputOptions('-strict experimental') // 启用实验特性
        .on('progress', function(progress) {
            callbacks.onProgress?.(progress);
        })
        .on('end', function() {
            callbacks.onEnd?.();
            resolve(outputPath);
        })
        .on('error', function(err) {
            callbacks.onError?.(err);
            reject(err);
        })
        .save(outputPath);     // 保存输出文件
    });
}

module.exports = { ffmpegMerge };

export {};
