# Mimi Downloader

[英文/English](README.EN.md)

基于 Node.js 和 Electron 编写的 Bilibili 视频、弹幕下载器。

**由于B站会不时更新请求方式，请记得通过 `git` 保持更新。如果无法正常使用，欢迎提交 Issue 或 Pull Request。**

![](screenshot.png)

## 功能

目前实现的功能：

- 根据视频地址查询 aid 和 cid 以及视频详细信息
- 根据视频 cid 获取视频和弹幕文件的下载地址
- 下载视频（`.flv` 或 `.mp4`）和弹幕文件（`.xml` 或 `.ass`），支持断点续传

## 使用方法

你需要安装 [Git](https://git-scm.com) 和 [Node.js](https://nodejs.org/en/download)（以及 [npm](http://npmjs.com)）来运行本程序。  
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

下载完成后，可以使用 ffmpeg 将 flv 片段合成为一个文件：
```bash
cid=11090110
# 将 11090110 替换为你下载的视频的 cid
for f in $(ls $cid-*.flv | sort -n); do echo "file '$f'" >> temp.txt; done
ffmpeg -f concat -i temp.txt -c copy $cid.flv
rm temp.txt
```

## 制作者/鸣谢

- [Mimi](https://zhangshuqiao.org) 本项目的开发者
- 田生 [XML 转 ASS 库](https://github.com/tiansh/us-danmaku) 以及 bilibili ASS Danmaku Downloader, Mozilla Public License 2.0
- soimort [you-get](https://github.com/soimort/you-get) MIT license 提供了部分B站api的调用方式

## 许可证

GNU General Public License v3  
http://www.gnu.org/licenses/gpl-3.0.html

## 不同分支的内容

- master 主分支，采用了来自 you-get 的 api，bangumi 和 movie需要手动输入 PlayUrl
- backup 均需要手动输入 PlayUrl
- you-get 只需输入视频地址即可下载，但 bangumi 和 movie 没有高清 flv 源，只有分辨率较低的 mp4

## 待实现

- [ ] 允许用户开始/暂停下载
- [ ] 是否把视频存储在新文件夹中
- [ ] 下载进度单独菜单
- [ ] 显示用户信息
