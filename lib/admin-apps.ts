// 多应用注册表（与后端 apps 表 seed 一致）：管理端应用切换器/筛选下拉共用
export const ADMIN_APPS = [
  { value: 'gpucloud', label: '算力云' },
  { value: 'gpustudio', label: '算力工坊' },
  { value: 'gpubox', label: '算力宝' },
  { value: 'modelstudio', label: '模型工坊' },
] as const

/** 应用码 -> 中文名（未知码原样返回） */
export function appName(code?: string | null): string {
  if (!code) return '-'
  return ADMIN_APPS.find((a) => a.value === code)?.label || code
}

/**
 * 管理端请求统一附 app_id 参数：all/空 = 全部应用（不传参数）
 * 用法：api.get('/admin/users', withAppId({ page, size }, adminAppId))
 */
export function withAppId<T extends Record<string, string | number | boolean>>(
  params: T,
  appId?: string
): T & { app_id?: string } {
  if (appId && appId !== 'all') {
    return { ...params, app_id: appId }
  }
  return params
}