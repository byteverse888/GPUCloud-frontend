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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Crown, Plus, Pencil, Trash2, Loader2, RefreshCw, Download } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { useUIStore } from '@/stores/ui-store'
import { AppFilter, AppBadge } from '@/components/admin/app-filter'
import { ADMIN_APPS, withAppId } from '@/lib/admin-apps'

interface PlanItem {
  objectId: string
  planId: string
  name: string
  level: string
  days: number
  price: number
  originalPrice: number
  discount: number
  bonus: number
  enabled: boolean
  sortOrder: number
  appId: string
}

const defaultForm = {
  plan_id: '', name: '', level: 'vip', days: 30,
  price: 0, original_price: 0, discount: 100, bonus: 0,
  enabled: true, sort_order: 0, app_id: 'gpucloud',
}

export default function AdminMemberPlansPage() {
  const { adminAppId } = useUIStore()
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)

  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get<{ items: PlanItem[] }>('/admin/member-plans/list', withAppId({}, adminAppId))
      setItems(data.items || [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [adminAppId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm, app_id: adminAppId !== 'all' ? adminAppId : 'gpucloud' })
    setShowDialog(true)
  }

  const handleEdit = (p: PlanItem) => {
    setEditingId(p.objectId)
    setForm({
      plan_id: p.planId, name: p.name, level: p.level, days: p.days,
      price: p.price, original_price: p.originalPrice, discount: p.discount, bonus: p.bonus,
      enabled: p.enabled, sort_order: p.sortOrder, app_id: p.appId,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || (!editingId && !form.plan_id.trim())) {
      toast.error('请填写套餐ID和名称')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        // 后端不允许改 plan_id/app_id
        const { plan_id, app_id, ...updates } = form
        await api.put(`/admin/member-plans/${editingId}`, updates)
        toast.success('套餐已更新')
      } else {
        await api.post('/admin/member-plans', form)
        toast.success('套餐已创建')
      }
      setShowDialog(false)
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setSaving(false) }
  }

  const handleDelete = async (p: PlanItem) => {
    if (!confirm(`确定删除套餐「${p.name}」？`)) return
    try {
      await api.delete(`/admin/member-plans/${p.objectId}`)
      toast.success('已删除')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleToggle = async (p: PlanItem) => {
    try {
      await api.put(`/admin/member-plans/${p.objectId}`, { enabled: !p.enabled })
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleSeed = async () => {
    const targetApp = adminAppId !== 'all' ? adminAppId : 'gpucloud'
    if (!confirm(`向「${targetApp}」应用导入默认会员套餐？（仅该应用套餐为空时生效）`)) return
    setSeeding(true)
    try {
      const { data } = await api.post<{ seeded: number; message?: string }>(`/admin/member-plans/seed?app_id=${targetApp}`)
      toast.success(data.seeded > 0 ? `已导入 ${data.seeded} 个套餐` : (data.message || '未导入'))
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setSeeding(false) }
  }

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" />
          会员套餐
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            导入默认套餐
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新增套餐
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <AppFilter />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>套餐</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>等级</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>赠送积分</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>状态</TableHead>
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
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">暂无套餐，可点击"导入默认套餐"</TableCell>
                </TableRow>
              ) : (
                items.map((p) => (
                  <TableRow key={p.objectId}>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.planId}</p>
                    </TableCell>
                    <TableCell><AppBadge appId={p.appId} /></TableCell>
                    <TableCell>
                      <Badge className={p.level === 'svip' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-amber-500 hover:bg-amber-600'}>
                        {p.level.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.days} 天</TableCell>
                    <TableCell>
                      <span className="font-medium text-primary">¥{Number(p.price || 0).toFixed(2)}</span>
                      {p.originalPrice > p.price && (
                        <span className="text-xs text-muted-foreground line-through ml-1">¥{Number(p.originalPrice).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>{p.bonus > 0 ? `+${p.bonus}` : '-'}</TableCell>
                    <TableCell>{p.sortOrder}</TableCell>
                    <TableCell>
                      <Badge
                        variant={p.enabled ? 'default' : 'secondary'}
                        className={`cursor-pointer ${p.enabled ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                        onClick={() => handleToggle(p)}
                      >
                        {p.enabled ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 创建/编辑弹窗 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑套餐' : '新增套餐'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>所属应用 *</Label>
                  <Select value={form.app_id} onValueChange={(v) => updateField('app_id', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADMIN_APPS.map((app) => (
                        <SelectItem key={app.value} value={app.value}>{app.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>套餐ID *（应用内唯一）</Label>
                  <Input value={form.plan_id} onChange={(e) => updateField('plan_id', e.target.value)} placeholder="如：vip_monthly" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>套餐名称 *</Label>
                <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="如：月度会员" />
              </div>
              <div className="space-y-2">
                <Label>会员等级 *</Label>
                <Select value={form.level} onValueChange={(v) => updateField('level', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="svip">SVIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>时长（天）*</Label>
                <Input type="number" min={1} value={form.days} onChange={(e) => updateField('days', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>售价（元）*</Label>
                <Input type="number" step="0.01" min={0} value={form.price} onChange={(e) => updateField('price', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>原价（元）</Label>
                <Input type="number" step="0.01" min={0} value={form.original_price} onChange={(e) => updateField('original_price', Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>折扣（×10，如 85=8.5折）</Label>
                <Input type="number" min={1} max={1000} value={form.discount} onChange={(e) => updateField('discount', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>赠送积分</Label>
                <Input type="number" min={0} value={form.bonus} onChange={(e) => updateField('bonus', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => updateField('sort_order', Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => updateField('enabled', v)} />
              <Label>启用（客户端可购买）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}