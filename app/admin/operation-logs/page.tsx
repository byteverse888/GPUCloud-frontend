'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollText, Loader2, RefreshCw, Search, Eye } from 'lucide-react'
import api from '@/lib/api'
import { formatTime } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { AppFilter, AppBadge } from '@/components/admin/app-filter'
import { withAppId } from '@/lib/admin-apps'

interface LogItem {
  objectId: string
  operatorName: string
  operatorRole: string
  appId: string
  action: string
  module: string
  targetName: string
  description: string
  detail: any
  ipAddress: string
  status: string
  errorMessage: string
  createdAt: string
}

const moduleLabels: Record<string, string> = {
  users: '用户', orders: '订单', courses: '课程', member_plans: '会员套餐',
  activation_codes: '激活码', feedback: '反馈', announcements: '公告',
  wechat_oa: '订阅号', auth: '认证', promotion: '推广',
}

const actionLabels: Record<string, string> = {
  create: '创建', update: '更新', delete: '删除', ban: '停用/封禁', unban: '启用/解封',
  recharge: '充值调账', refund: '退款', cancel: '取消', confirm: '确认', reply: '回复',
  publish: '发布', revoke: '撤回', register: '注册', login: '登录', logout: '登出',
  bind_inviter: '绑定邀请', reset_password: '重置密码',
}

export default function AdminOperationLogsPage() {
  const { adminAppId } = useUIStore()
  const [items, setItems] = useState<LogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [moduleFilter, setModuleFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [operator, setOperator] = useState('')
  const [search, setSearch] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [detailLog, setDetailLog] = useState<LogItem | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const params = withAppId({
        page, limit: pageSize,
        ...(moduleFilter !== 'all' ? { module: moduleFilter } : {}),
        ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
        ...(operator ? { operator } : {}),
        ...(search ? { search } : {}),
      }, adminAppId)
      const { data } = await api.get<{ items: LogItem[]; total: number }>('/operation-logs/list', params)
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch { setItems([]); setTotal(0) } finally { setLoading(false) }
  }, [page, pageSize, moduleFilter, actionFilter, operator, search, adminAppId])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    api.get<{ modules: string[]; actions: string[] }>('/operation-logs/modules')
      .then(({ data }) => { setModules(data.modules || []); setActions(data.actions || []) })
      .catch(() => {})
  }, [])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          管理操作日志
        </h1>
        <Button variant="outline" onClick={fetchItems} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索操作人..." className="pl-9" value={operator}
            onChange={(e) => { setOperator(e.target.value); setPage(1) }} />
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索描述/目标名称..." className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <AppFilter onChange={() => setPage(1)} />
        <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="模块" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模块</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>{moduleLabels[m] || m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="动作" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部动作</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>{actionLabels[a] || a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>模块</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>结果</TableHead>
                <TableHead className="text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">暂无日志</TableCell>
                </TableRow>
              ) : (
                items.map((log) => (
                  <TableRow key={log.objectId}>
                    <TableCell className="text-sm whitespace-nowrap">{log.createdAt ? formatTime(log.createdAt) : '-'}</TableCell>
                    <TableCell className="text-sm">{log.operatorName || '-'}</TableCell>
                    <TableCell><AppBadge appId={log.appId} /></TableCell>
                    <TableCell><Badge variant="secondary">{moduleLabels[log.module] || log.module || '-'}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{actionLabels[log.action] || log.action}</Badge></TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate" title={log.description}>{log.description || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.ipAddress || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}
                        className={log.status === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                        {log.status === 'success' ? '成功' : '失败'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailLog(log)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
              <span className="text-sm text-muted-foreground leading-8">第 {page} / {totalPages} 页</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 日志详情弹窗 */}
      <Dialog open={!!detailLog} onOpenChange={(open) => { if (!open) setDetailLog(null) }}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>操作日志详情</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 text-sm">
              {[
                ['时间', detailLog.createdAt ? formatTime(detailLog.createdAt) : '-'],
                ['操作人', `${detailLog.operatorName || '-'}（${detailLog.operatorRole || '-'}）`],
                ['模块/动作', `${moduleLabels[detailLog.module] || detailLog.module} / ${actionLabels[detailLog.action] || detailLog.action}`],
                ['目标', detailLog.targetName || '-'],
                ['描述', detailLog.description || '-'],
                ['IP', detailLog.ipAddress || '-'],
                ['结果', detailLog.status === 'success' ? '成功' : `失败：${detailLog.errorMessage || '-'}`],
              ].map(([label, value], i) => (
                <div key={i} className="flex items-start gap-3 py-1.5 border-b border-dashed">
                  <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
                  <span className="flex-1 break-all">{value}</span>
                </div>
              ))}
              {detailLog.detail && (
                <div>
                  <p className="text-muted-foreground mb-1">变更明细</p>
                  <pre className="rounded border bg-muted/30 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(detailLog.detail, null, 2)}
                  </pre>
                </div>
              )}
              {detailLog.errorMessage && (
                <div>
                  <p className="text-muted-foreground mb-1">错误信息</p>
                  <pre className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {detailLog.errorMessage}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}