'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Ticket, Plus, Ban, CheckCircle, Trash2, Loader2, RefreshCw, Search, Copy } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { formatTime } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { AppFilter, AppBadge } from '@/components/admin/app-filter'
import { ADMIN_APPS, withAppId } from '@/lib/admin-apps'

interface CodeItem {
  objectId: string
  code: string
  planId: string
  planName: string
  level: string
  days: number
  status: string
  codeExpireAt: string | null
  batchId: string
  note: string
  usedByUsername: string
  usedAt: string | null
  createdByName: string
  appId: string
  createdAt: string
}

interface PlanOption { objectId: string; planId: string; name: string; level: string; days: number }

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  unused: { label: '未使用', variant: 'default' },
  used: { label: '已使用', variant: 'secondary' },
  disabled: { label: '已停用', variant: 'destructive' },
}

export default function AdminActivationCodesPage() {
  const { adminAppId } = useUIStore()
  const [items, setItems] = useState<CodeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // 批量生成弹窗
  const [showGenDialog, setShowGenDialog] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genForm, setGenForm] = useState({ app_id: 'gpucloud', plan_id: '', count: 10, permanent: false, expires_in_days: 90, note: '' })
  const [plans, setPlans] = useState<PlanOption[]>([])
  // 生成结果展示（便于复制分发）
  const [genResult, setGenResult] = useState<{ codes: string[]; plan_name: string } | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const params = withAppId({
        skip: (page - 1) * pageSize, limit: pageSize,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      }, adminAppId)
      const { data } = await api.get<{ items: CodeItem[]; total: number }>('/admin/activation-codes/list', params)
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch { setItems([]); setTotal(0) } finally { setLoading(false) }
  }, [page, pageSize, statusFilter, search, adminAppId])

  useEffect(() => { fetchItems() }, [fetchItems])

  // 生成弹窗切换应用时拉取该应用的套餐供选择
  const fetchPlans = useCallback(async (appId: string) => {
    try {
      const { data } = await api.get<{ items: PlanOption[] }>('/admin/member-plans/list', { app_id: appId })
      setPlans(data.items || [])
    } catch { setPlans([]) }
  }, [])

  const openGenDialog = () => {
    const appId = adminAppId !== 'all' ? adminAppId : 'gpucloud'
    setGenForm({ app_id: appId, plan_id: '', count: 10, permanent: false, expires_in_days: 90, note: '' })
    setGenResult(null)
    fetchPlans(appId)
    setShowGenDialog(true)
  }

  const handleGenerate = async () => {
    if (!genForm.plan_id) { toast.error('请选择套餐'); return }
    setGenerating(true)
    try {
      const { data } = await api.post<{ count: number; codes: string[]; plan_name: string }>('/admin/activation-codes/generate', genForm)
      toast.success(`已生成 ${data.count} 个激活码`)
      setGenResult({ codes: data.codes || [], plan_name: data.plan_name })
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setGenerating(false) }
  }

  const handleCopyCodes = async () => {
    if (!genResult) return
    try {
      await navigator.clipboard.writeText(genResult.codes.join('\n'))
      toast.success('已复制到剪贴板')
    } catch { toast.error('复制失败，请手动选择复制') }
  }

  const handleDisable = async (c: CodeItem) => {
    if (!confirm(`确定停用激活码 ${c.code}？`)) return
    try {
      await api.post(`/admin/activation-codes/${c.objectId}/disable`)
      toast.success('已停用')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleEnable = async (c: CodeItem) => {
    try {
      await api.post(`/admin/activation-codes/${c.objectId}/enable`)
      toast.success('已启用')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleDelete = async (c: CodeItem) => {
    if (!confirm(`确定删除激活码 ${c.code}？`)) return
    try {
      await api.delete(`/admin/activation-codes/${c.objectId}`)
      toast.success('已删除')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          激活码
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={openGenDialog}>
            <Plus className="h-4 w-4 mr-2" />
            批量生成
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索激活码/备注/兑换人..." className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <AppFilter onChange={() => setPage(1)} />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="unused">未使用</SelectItem>
            <SelectItem value="used">已使用</SelectItem>
            <SelectItem value="disabled">已停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>激活码</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>码有效期</TableHead>
                <TableHead>兑换人/时间</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
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
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">暂无激活码</TableCell>
                </TableRow>
              ) : (
                items.map((c) => {
                  const st = statusLabels[c.status] || { label: c.status, variant: 'secondary' as const }
                  return (
                    <TableRow key={c.objectId}>
                      <TableCell className="font-mono text-sm">{c.code}</TableCell>
                      <TableCell>
                        <p className="text-sm">{c.planName || c.planId}</p>
                        <p className="text-xs text-muted-foreground">{c.level.toUpperCase()} · {c.days}天</p>
                      </TableCell>
                      <TableCell><AppBadge appId={c.appId} /></TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {c.codeExpireAt ? formatTime(c.codeExpireAt) : '永久'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.status === 'used' ? (
                          <div>
                            <p>{c.usedByUsername || '-'}</p>
                            <p className="text-xs text-muted-foreground">{c.usedAt ? formatTime(c.usedAt) : ''}</p>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate" title={c.note}>{c.note || '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{c.createdAt ? formatTime(c.createdAt) : '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.status === 'unused' && (
                            <Button variant="ghost" size="sm" title="停用" onClick={() => handleDisable(c)}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {c.status === 'disabled' && (
                            <Button variant="ghost" size="sm" title="启用" onClick={() => handleEnable(c)}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {c.status !== 'used' && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
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

      {/* 批量生成弹窗 */}
      <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量生成激活码</DialogTitle>
            <DialogDescription>按应用 + 套餐生成，兑换后发放对应会员权益</DialogDescription>
          </DialogHeader>
          {genResult ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">已生成 {genResult.codes.length} 个「{genResult.plan_name}」激活码：</p>
              <div className="max-h-60 overflow-y-auto rounded border bg-muted/30 p-3 font-mono text-sm space-y-1">
                {genResult.codes.map((code) => <div key={code}>{code}</div>)}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCopyCodes}>
                  <Copy className="h-4 w-4 mr-2" />复制全部
                </Button>
                <Button onClick={() => setShowGenDialog(false)}>完成</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>所属应用 *</Label>
                  <Select value={genForm.app_id} onValueChange={(v) => { setGenForm(p => ({ ...p, app_id: v, plan_id: '' })); fetchPlans(v) }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADMIN_APPS.map((app) => (
                        <SelectItem key={app.value} value={app.value}>{app.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>会员套餐 *</Label>
                  <Select value={genForm.plan_id} onValueChange={(v) => setGenForm(p => ({ ...p, plan_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={plans.length ? '选择套餐' : '该应用暂无套餐，请先到会员套餐页创建'} /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.objectId} value={p.planId}>{p.name}（{p.level.toUpperCase()} · {p.days}天）</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>生成数量（≤1000）</Label>
                    <Input type="number" min={1} max={1000} value={genForm.count}
                      onChange={(e) => setGenForm(p => ({ ...p, count: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>码有效期（天）</Label>
                    <Input type="number" min={1} max={3650} disabled={genForm.permanent} value={genForm.expires_in_days}
                      onChange={(e) => setGenForm(p => ({ ...p, expires_in_days: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={genForm.permanent} onCheckedChange={(v) => setGenForm(p => ({ ...p, permanent: v }))} />
                  <Label>永久有效（不受码有效期限制）</Label>
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Input value={genForm.note} onChange={(e) => setGenForm(p => ({ ...p, note: e.target.value }))} placeholder="如：xx活动发放" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGenDialog(false)}>取消</Button>
                <Button onClick={handleGenerate} disabled={generating || !genForm.plan_id}>
                  {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  生成
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}