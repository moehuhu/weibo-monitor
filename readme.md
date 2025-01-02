# koishi-plugin-weibo-monitor

[![npm](https://img.shields.io/npm/v/koishi-plugin-weibo-monitor?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-weibo-monitor)

## 简介

koishi机器人微博动态更新推送插件

## 配置

- account: 账号 (qq号)
- platform: 聊天消息平台 (默认为onebot)
- waitMinutes: 隔多久拉取一次最新微博 (单位为分钟)
- sendINFO：监听&发送配置
  - sendAll: @全体
  - weiboUID: 微博UID (手机端进微博用户页，进入右上角选项菜单，复制链接`https://weibo.com/u/XXXXXXXXXX`，结尾一串数字即微博UID)
  - groupID: 需要发送的群组
