'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Megaphone, Plus, Pencil, Trash2, Loader2, RefreshCw, Send, Undo2, Eye } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { formatTime } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { AppBadge } from '@/components/admin/app-filter'
import { ADMIN_APPS, appName } from '@/lib/admin-apps'

interface AnnouncementItem {
  id: string
  title: string
  content: string
  type: string
  target_app: string
  status: string
  published_at: string | null
  expires_at: string | null
  created_at: string | null
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  draft: { label: '草稿', variant: 'secondary' },
  published: { label: '已发布', variant: 'default' },
  revoked: { label: '已撤回', variant: 'destructive' },
}

const defaultForm = { title: '', content: '', type: 'system', target_app: 'all', expires_at: '' }

export default function AdminAnnouncementsPage() {
  const { adminAppId } = useUIStore()
  const [items, setItems] = useState<AnnouncementItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')

  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [viewItem, setViewItem] = useState<AnnouncementItem | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string | number> = { page, size: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      // 应用切换器联动：按目标应用筛选（含面向全部应用的公告）
      if (adminAppId && adminAppId !== 'all') params.target_app = adminAppId
      const { data } = await api.get<{ list: AnnouncementItem[]; total: number }>('/admin/notifications/announcements/list', params)
      setItems(data.list || [])
      setTotal(data.total || 0)
    } catch { setItems([]); setTotal(0) } finally { setLoading(false) }
  }, [page, statusFilter, adminAppId])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { setPage(1) }, [adminAppId])

  const handleCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm, target_app: adminAppId !== 'all' ? adminAppId : 'all' })
    setShowDialog(true)
  }

  const handleEdit = (a: AnnouncementItem) => {
    setEditingId(a.id)
    setForm({
      title: a.title, content: a.content, type: a.type, target_app: a.target_app,
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('请填写标题和内容'); return }
    setSaving(true)
    try {
      const payload: any = { title: form.title, content: form.content, type: form.type, target_app: form.target_app }
      if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString()
      if (editingId) {
        await api.put(`/admin/notifications/announcements/${editingId}`, payload)
        toast.success('公告已更新')
      } else {
        await api.post('/admin/notifications/announcements', payload)
        toast.success('公告已创建（草稿），发布后客户端可见')
      }
      setShowDialog(false)
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setSaving(false) }
  }

  const handlePublish = async (a: AnnouncementItem) => {
    if (!confirm(`确定发布公告「${a.title}」？发布后目标应用客户端立即可见`)) return
    try {
      await api.post(`/admin/notifications/announcements/${a.id}/publish`)
      toast.success('已发布')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleRevoke = async (a: AnnouncementItem) => {
    if (!confirm(`确定撤回公告「${a.title}」？撤回后客户端不再可见`)) return
    try {
      await api.post(`/admin/notifications/announcements/${a.id}/revoke`)
      toast.success('已撤回')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleDelete = async (a: AnnouncementItem) => {
    if (!confirm(`确定删除公告「${a.title}」？`)) return
    try {
      await api.delete(`/admin/notifications/announcements/${a.id}`)
      toast.success('已删除')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }))
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          公告管理
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建公告
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="revoked">已撤回</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">目标应用跟随顶栏应用切换器（当前：{adminAppId === 'all' ? '全部应用' : appName(adminAppId)}）</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>目标应用</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>发布时间</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">暂无公告</TableCell>
                </TableRow>
              ) : (
                items.map((a) => {
                  const st = statusConfig[a.status] || { label: a.status, variant: 'secondary' as const }
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium max-w-[280px] truncate" title={a.title}>{a.title}</TableCell>
                      <TableCell>
                        {a.target_app === 'all' ? <Badge variant="outline">全部应用</Badge> : <AppBadge appId={a.target_app} />}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{a.type === 'activity' ? '活动' : '系统'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={st.variant} className={a.status === 'published' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{a.published_at ? formatTime(a.published_at) : '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{a.expires_at ? formatTime(a.expires_at) : '长期'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" title="查看" onClick={() => setViewItem(a)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {a.status !== 'published' && (
                            <Button variant="ghost" size="sm" title="发布" onClick={() => handlePublish(a)}>
                              <Send className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {a.status === 'published' && (
                            <Button variant="ghost" size="sm" title="撤回" onClick={() => handleRevoke(a)}>
                              <Undo2 className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" title="编辑" onClick={() => handleEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* 创建/编辑弹窗 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑公告' : '新建公告'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="公告标题" />
            </div>
            <div className="space-y-2">
              <Label>内容 *</Label>
              <Textarea rows={6} value={form.content} onChange={(e) => updateField('content', e.target.value)} placeholder="公告正文" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>目标应用</Label>
                <Select value={form.target_app} onValueChange={(v) => updateField('target_app', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部应用</SelectItem>
                    {ADMIN_APPS.map((app) => (
                      <SelectItem key={app.value} value={app.value}>{app.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={form.type} onValueChange={(v) => updateField('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">系统公告</SelectItem>
                    <SelectItem value="activity">活动公告</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>过期时间（可选，过期后客户端不再展示）</Label>
              <Input type="datetime-local" value={form.expires_at} onChange={(e) => updateField('expires_at', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? '保存' : '创建草稿'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看弹窗 */}
      <Dialog open={!!viewItem} onOpenChange={(open) => { if (!open) setViewItem(null) }}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewItem?.title}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {viewItem.target_app === 'all' ? <Badge variant="outline">全部应用</Badge> : <AppBadge appId={viewItem.target_app} />}
                <span>{viewItem.published_at ? formatTime(viewItem.published_at) : (viewItem.created_at ? formatTime(viewItem.created_at) : '')}</span>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="whitespace-pre-wrap text-sm">{viewItem.content}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}