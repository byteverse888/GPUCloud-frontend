'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/stores/ui-store'
import { ADMIN_APPS, appName } from '@/lib/admin-apps'

/**
 * 管理端应用筛选下拉：绑定全局 adminAppId（与顶栏应用切换器联动，持久化）。
 * onChange 供页面在切换时重置分页。
 */
export function AppFilter({ onChange, className }: { onChange?: (appId: string) => void; className?: string }) {
  const { adminAppId, setAdminAppId } = useUIStore()
  return (
    <Select
      value={adminAppId}
      onValueChange={(v) => { setAdminAppId(v); onChange?.(v) }}
    >
      <SelectTrigger className={className || 'w-36'}>
        <SelectValue placeholder="应用" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">全部应用</SelectItem>
        {ADMIN_APPS.map((app) => (
          <SelectItem key={app.value} value={app.value}>{app.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** 应用列徽标：应用码 -> 中文名 */
export function AppBadge({ appId }: { appId?: string | null }) {
  return <Badge variant="outline" className="font-normal whitespace-nowrap">{appName(appId)}</Badge>
}