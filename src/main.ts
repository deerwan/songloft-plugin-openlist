/// <reference types="@songloft/plugin-sdk" />
// 插件入口 — 只挂生命周期钩子与请求分发,业务逻辑见 router.ts 与 routes/

import type { HTTPRequest, HTTPResponse } from '@songloft/plugin-sdk'
import router from './router'

async function onInit(): Promise<void> {
  songloft.log.info('[OpenList Plugin] Mounted')
}

async function onDeinit(): Promise<void> {
  songloft.log.info('[OpenList Plugin] Unmounted')
}

async function onHTTPRequest(req: HTTPRequest): Promise<HTTPResponse> {
  return await router.handle(req)
}

// QuickJS 需要显式挂到全局
globalThis.onInit = onInit
globalThis.onDeinit = onDeinit
globalThis.onHTTPRequest = onHTTPRequest
