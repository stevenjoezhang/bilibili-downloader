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
set ELECTRON_MIRROR="https://cdn.npm.taobao.org/dist/electron/" # 使用 Windows CMD 命令行
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
如果一切正常，会打开一个名为「Mimi Downloader」的新窗口。输入视频链接（例如 https://www.bilibili.com/video/av11099139/ ），按照提示即可下载视频。

## 制作者/鸣谢

- [Mimi](https://zhangshuqiao.org) 本项目的开发者
- 田生 [XML 转 ASS 库](https://github.com/tiansh/us-danmaku) 以及 bilibili ASS Danmaku Downloader, Mozilla Public License 2.0
- soimort [you-get](https://github.com/soimort/you-get) MIT license 提供了部分B站api的调用方式

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
