# digiCamControl Portable

这个目录需要放 digiCamControl portable 版的所有文件。

## 下载步骤

1. 打开 https://github.com/dukus/digiCamControl/releases/latest
2. 下载 `digiCamControl_vX.X.X_portable.zip`
3. 解压所有文件到本目录（这里）

解压后目录里应该有：
- CameraControlCmd.exe  ← 最关键
- CameraControl.exe
- 一堆 .dll 文件
- plugins/ 目录

## 为什么这样做

digiCamControl 是开源软件（GPL v2），支持佳能、尼康、索尼等主流 DSLR/微单。
把它 portable 化打包进 app，用户无需单独安装任何东西。
