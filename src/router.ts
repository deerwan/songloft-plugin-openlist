// 路由注册表 — 只负责挂载各路由模块,不含具体业务逻辑
//
// 新增端点时:在 routes/ 下新建或扩展模块,然后在此挂载一行即可。

import { createRouter } from '@songloft/plugin-sdk'
import { mountConfigsRoutes } from './routes/configs'
import { mountBrowserRoutes } from './routes/browser'
import { mountSearchRoutes } from './routes/search'
import { mountPlaybackRoutes } from './routes/playback'
import { mountProxyRoutes } from './routes/proxy'

const router = createRouter()

mountConfigsRoutes(router)   // /lists、/lists/:id、/test
mountBrowserRoutes(router)   // /lists/:id/items
mountSearchRoutes(router)    // /api/search
mountPlaybackRoutes(router)  // /api/music/url
mountProxyRoutes(router)     // /api/cover、/api/lyric

export default router
