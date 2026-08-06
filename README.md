# OpenList 音乐源(Songloft 插件)

通过 OpenList / AList REST API 接入外部网盘音乐库的 [Songloft](https://github.com/songloft-org/songloft) 音源插件。

## 功能

- **服务器管理**:添加 / 更新 / 删除多个 OpenList(AList v3 兼容)服务器,支持账号登录与游客模式,可一键测试连接
- **目录浏览**:逐层浏览网盘目录,自动过滤只显示音频文件(mp3 / flac / wav / ape / ogg / opus / m4a 等)
- **入库与歌单**:多选音频文件后直接入库,或导入到新建 / 已有歌单
- **播放解析**:播放时实时解析直链(`raw_url` 优先,回退 `/d/<path>?sign=`)
- **全局搜索**:聚合所有已配置服务器的 `fs/search`,接入 Songloft 搜索
- **封面与歌词**:代理 OpenList 的 thumb 封面,自动查找同级同名 `.lrc` 歌词

## 开发

```bash
npm install
npm run dev         # watch + auto-upload to local Songloft
npm run build       # produce dist/openlist.jsplugin.zip
npm run validate    # verify plugin.json hashes
```

要求宿主版本 ≥ 2.9.5。

## 结构

```
src/                     # 后端(QuickJS 沙箱)
├── main.ts              # 插件入口
├── router.ts            # 路由注册表
├── routes/              # configs / browser / search / playback / proxy
└── services/            # openlist-client(REST + token 缓存)/ stream(直链)
static/                  # 前端
├── index.html           # UI 入口
├── css/style.css        # 仅消费主程序注入的 --md-* CSS 变量
└── js/                  # app.js 入口 + modules/ 模块化源码(esbuild 合并)
```

## 作者

deerwan

## 许可与声明

- 本插件代码以 **Apache-2.0** 许可发布 © 2026 deerwan。
- 本插件是**独立的第三方社区插件**,与 OpenList 官方团队无关联,不代表 OpenList 官方。插件仅通过 OpenList 公开 API 与用户自行部署的 OpenList / AList 服务通信。
- 插件图标使用 OpenList 官方 Logo,素材来源于 [OpenListTeam/Logo](https://github.com/OpenListTeam/Logo) 仓库,按其仓库协议使用;如有不妥请联系删除。
- 本插件的开发参考了官方 [songloft-plugin-dav](https://github.com/songloft-org/songloft-plugin-dav)(WebDAV 音乐源)插件的架构与主程序对接方式,在此致谢。
- 请勿以 "OpenList" 官方名义分发或商业使用本插件;[OpenList](https://github.com/OpenListTeam/OpenList) 服务端本身以 AGPL-3.0 许可发布。
