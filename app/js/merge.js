const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// 告诉 fluent-ffmpeg 使用静态二进制文件
ffmpeg.setFfmpegPath(ffmpegPath);

function ffmpegMerge(videoPath, audioPath, outputPath) {
    ffmpeg()
        .input(videoPath)      // 输入视频文件
        .input(audioPath)      // 输入音频文件
        .outputOptions('-c:v copy')   // 保持视频编码
        .outputOptions('-c:a aac')    // 使用 AAC 音频编码
        .outputOptions('-strict experimental') // 启用实验特性
        .on('end', function() {
            showMessage('合并完成');
        })
        .on('error', function(err) {
            showError('发生错误: ' + err.message);
        })
        .save(outputPath);     // 保存输出文件
}

module.exports = { ffmpegMerge };
