# Mimi Downloader

[英文/English](README.EN.md)

基于 Node.js 和 Electron 开发的 Bilibili 视频、弹幕下载器。

![](screenshot.png)

## 功能

目前实现的功能：

- 根据视频地址查询 aid 和 cid 以及视频详细信息
- 根据视频 cid 获取视频和弹幕文件的下载地址
- 下载视频（`.flv` 或 `.mp4`）和弹幕文件（`.xml` 或 `.ass`），支持断点续传

## 使用方法

你需要安装 [Git](https://git-scm.com) 和 [Node.js](https://nodejs.org/en/download)（以及 [npm](http://npmjs.com)）来运行本程序。  
本程序的一个重要依赖是 Electron，如果你所在的网络环境受到限制，请先设置如下环境变量，再执行后面的命令，以通过镜像安装之：
```bash
export ELECTRON_MIRROR="https://cdn.npm.taobao.org/dist/electron/" # 一般的 *NIX 命令行
set ELECTRON_MIRROR=https://cdn.npm.taobao.org/dist/electron/ # 使用 Windows CMD 命令行
```

在命令行输入：
```bash
# 克隆这个仓库
git clone https://github.com/stevenjoezhang/bilibili-downloader.git
# 进入目录
cd bilibili-downloader
# 安装依赖
npm install
# 启动！
npm start
```
如果一切正常，会打开一个名为「Mimi Downloader」的新窗口。输入视频链接（例如 https://www.bilibili.com/video/BV1Lx411a7NQ ），按照提示即可下载视频。

对于分为多个 flv 片段的视频，下载完成后，可以使用 ffmpeg 将其合并为一个文件：
```bash
name=11090110
# 将 11090110 替换为视频文件名
ffmpeg -f concat -safe 0 -i <(for f in $(ls $name-*.flv | sort -n); do echo "file '$PWD/$f'"; done) -c copy $name.flv
```
见 https://trac.ffmpeg.org/wiki/Concatenate

## 相关项目

如果你需要更为强大的命令行工具，那么以下仓库或许有帮助。它们均使用了和本项目完全相同的 API 调用方式，不需要手动设置 Cookie 或 playurl。

- [you-get](https://github.com/soimort/you-get) by soimort, MIT license
- [annie](https://github.com/iawia002/annie) by iawia002
- [youtube-dl](https://github.com/ytdl-org/youtube-dl) by ytdl-org
- [Bilibili_video_download](https://github.com/Henryhaohao/Bilibili_video_download) by Henryhaohao

这里还有一些其它的库和浏览器插件供参考。

- [XML 转 ASS 库](https://github.com/tiansh/us-danmaku) 以及 bilibili ASS Danmaku Downloader by tiansh, Mozilla Public License 2.0
- [bilibili-get](https://github.com/kamikat/bilibili-get) by kamikat
- [bilitwin](https://github.com/Xmader/bilitwin) by Xmader
- [bili-api](https://github.com/simon300000/bili-api) by simon300000

## 许可证

GNU General Public License v3  
http://www.gnu.org/licenses/gpl-3.0.html

### Legal Issues

This software is distributed under the GPL-3.0 license.

In particular, please be aware that

> THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.

Translated to human words:

*In case your use of the software forms the basis of copyright infringement, or you use the software for any other illegal purposes, the authors cannot take any responsibility for you.*

We only ship the code here, and how you are going to use it is left to your own discretion.

## 待实现

- [ ] 允许用户开始/暂停下载
- [x] 显示发送弹幕的用户信息
