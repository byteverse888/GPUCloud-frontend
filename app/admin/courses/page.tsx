'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pagination } from '@/components/ui/pagination'
import { GraduationCap, Plus, Pencil, Trash2, Loader2, RefreshCw, Search, Upload, Download, ShieldCheck } from 'lucide-react'
import api, { uploadFileToS3, toFullUrl } from '@/lib/api'
import toast from 'react-hot-toast'
import { formatTime } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { AppFilter, AppBadge } from '@/components/admin/app-filter'
import { ADMIN_APPS, withAppId } from '@/lib/admin-apps'

interface CourseItem {
  objectId: string
  title: string
  description: string
  category: string
  coverUrl: string
  isPaid: boolean
  price: number
  panLink: string
  panPassword: string
  url: string
  sortOrder: number
  enabled: boolean
  appId: string
  reviewStatus: string
  reviewNote: string
  reviewedAt: string
  createdAt: string
}

const reviewBadge = (status: string, note?: string) => {
  if (status === 'approved') return <Badge className="bg-emerald-500 hover:bg-emerald-600" title={note || ''}>已通过</Badge>
  if (status === 'rejected') return <Badge variant="destructive" title={note || ''}>已驳回</Badge>
  return <Badge variant="outline" className="border-amber-500 text-amber-600">待审核</Badge>
}

const defaultForm = {
  title: '', description: '', category: '', cover_url: '',
  is_paid: false, price: 0, pan_link: '', pan_password: '', url: '',
  sort_order: 0, enabled: true, app_id: 'gpucloud',
}

export default function AdminCoursesPage() {
  const { adminAppId } = useUIStore()
  const [items, setItems] = useState<CourseItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [reviewFilter, setReviewFilter] = useState('all')

  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // 审核弹窗
  const [reviewTarget, setReviewTarget] = useState<CourseItem | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const params = withAppId({
        page, limit: pageSize,
        ...(search ? { search } : {}),
        ...(reviewFilter !== 'all' ? { review_status: reviewFilter } : {}),
      }, adminAppId)
      const { data } = await api.get<{ items: CourseItem[]; total: number }>('/admin/courses/list', params)
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch { setItems([]); setTotal(0) } finally { setLoading(false) }
  }, [page, pageSize, search, reviewFilter, adminAppId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm, app_id: adminAppId !== 'all' ? adminAppId : 'gpucloud' })
    setShowDialog(true)
  }

  const handleEdit = (c: CourseItem) => {
    setEditingId(c.objectId)
    setForm({
      title: c.title, description: c.description, category: c.category, cover_url: c.coverUrl,
      is_paid: c.isPaid, price: c.price, pan_link: c.panLink, pan_password: c.panPassword,
      url: c.url, sort_order: c.sortOrder, enabled: c.enabled, app_id: c.appId,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('请输入课程标题'); return }
    setSaving(true)
    try {
      if (editingId) {
        const { app_id, ...updates } = form
        await api.put(`/admin/courses/${editingId}`, updates)
        toast.success('课程已更新')
      } else {
        await api.post('/admin/courses', form)
        toast.success('课程已创建')
      }
      setShowDialog(false)
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setSaving(false) }
  }

  const handleDelete = async (c: CourseItem) => {
    if (!confirm(`确定删除课程《${c.title}》？`)) return
    try {
      await api.delete(`/admin/courses/${c.objectId}`)
      toast.success('已删除')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleToggle = async (c: CourseItem) => {
    try {
      await api.put(`/admin/courses/${c.objectId}`, { enabled: !c.enabled })
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const openReview = (c: CourseItem) => {
    setReviewTarget(c)
    setReviewAction(c.reviewStatus === 'rejected' ? 'reject' : 'approve')
    setReviewNote(c.reviewNote || '')
  }

  const handleReview = async () => {
    if (!reviewTarget) return
    if (reviewAction === 'reject' && !reviewNote.trim()) { toast.error('驳回必须填写审核意见'); return }
    setReviewing(true)
    try {
      await api.post(`/admin/courses/${reviewTarget.objectId}/review`, { action: reviewAction, note: reviewNote.trim() })
      toast.success(reviewAction === 'approve' ? '审核已通过' : '已驳回')
      setReviewTarget(null)
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setReviewing(false) }
  }

  // 封面预签名直传 S3（upload 前缀已开匿名可读）
  const handleCoverUpload = async (file: File) => {
    setUploading(true)
    try {
      const { file_url } = await uploadFileToS3(file, 'upload')
      setForm(p => ({ ...p, cover_url: file_url }))
      toast.success('封面上传成功')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '封面上传失败')
    } finally { setUploading(false) }
  }

  const handleSeed = async () => {
    const targetApp = adminAppId !== 'all' ? adminAppId : 'gpustudio'
    if (!confirm(`向「${targetApp}」应用导入示例课程？（仅该应用课程为空时生效）`)) return
    setSeeding(true)
    try {
      const { data } = await api.post<{ seeded: number; message?: string }>(`/admin/courses/seed?app_id=${targetApp}`)
      toast.success(data.seeded > 0 ? `已导入 ${data.seeded} 门示例课程` : (data.message || '未导入'))
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setSeeding(false) }
  }

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          课程管理
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            导入示例课程
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新增课程
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索课程名称/分类..." className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <AppFilter onChange={() => setPage(1)} />
        <Select value={reviewFilter} onValueChange={(v) => { setReviewFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="审核状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部审核状态</SelectItem>
            <SelectItem value="pending">待审核</SelectItem>
            <SelectItem value="approved">已通过</SelectItem>
            <SelectItem value="rejected">已驳回</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>课程</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>类型/价格</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>审核</TableHead>
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
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">暂无课程</TableCell>
                </TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.objectId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {c.coverUrl ? (
                          <img src={toFullUrl(c.coverUrl)} alt="" className="h-10 w-16 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div className="h-10 w-16 rounded bg-muted flex items-center justify-center">
                            <GraduationCap className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="max-w-[240px]">
                          <p className="font-medium truncate" title={c.title}>{c.title}</p>
                          <p className="text-xs text-muted-foreground truncate" title={c.description}>{c.description || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.category || '-'}</TableCell>
                    <TableCell><AppBadge appId={c.appId} /></TableCell>
                    <TableCell>
                      {c.isPaid ? (
                        <span className="font-medium text-primary">¥{Number(c.price || 0).toFixed(2)}</span>
                      ) : (
                        <Badge variant="secondary">免费</Badge>
                      )}
                    </TableCell>
                    <TableCell>{c.sortOrder}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.enabled ? 'default' : 'secondary'}
                        className={`cursor-pointer ${c.enabled ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                        onClick={() => handleToggle(c)}
                      >
                        {c.enabled ? '上架' : '下架'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="relative group cursor-default">
                        {reviewBadge(c.reviewStatus, c.reviewNote)}
                        {c.reviewNote && (
                          <span className="invisible group-hover:visible absolute z-50 left-0 top-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md p-3 max-w-[320px] whitespace-pre-wrap break-words text-xs leading-relaxed">
                            {c.reviewNote}
                            {c.reviewedAt && <span className="block mt-1 text-muted-foreground">{formatTime(c.reviewedAt)}</span>}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{c.createdAt ? formatTime(c.createdAt) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" title="审核" onClick={() => openReview(c)}>
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page} pageSize={pageSize} total={total}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
        </CardContent>
      </Card>

      {/* 创建/编辑弹窗 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑课程' : '新增课程'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingId && (
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
            )}
            <div className="space-y-2">
              <Label>课程标题 *</Label>
              <Input value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="如：Stable Diffusion 入门到精通" />
            </div>
            <div className="space-y-2">
              <Label>课程描述</Label>
              <Textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类</Label>
                <Input value={form.category} onChange={(e) => updateField('category', e.target.value)} placeholder="如：AI绘画" />
              </div>
              <div className="space-y-2">
                <Label>排序（小在前）</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => updateField('sort_order', Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>封面图</Label>
              <div className="flex items-center gap-2">
                <Input value={form.cover_url} onChange={(e) => updateField('cover_url', e.target.value)} placeholder="封面 URL，或直接上传" />
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = '' }} />
                <Button variant="outline" size="icon" disabled={uploading} onClick={() => coverInputRef.current?.click()}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
              {form.cover_url && (
                <img src={toFullUrl(form.cover_url)} alt="封面预览" className="h-20 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>付费课程</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={form.is_paid} onCheckedChange={(v) => updateField('is_paid', v)} />
                  <span className="text-sm text-muted-foreground">{form.is_paid ? '付费' : '免费'}</span>
                </div>
              </div>
              {form.is_paid && (
                <div className="space-y-2">
                  <Label>价格（元）</Label>
                  <Input type="number" step="0.01" min={0} value={form.price} onChange={(e) => updateField('price', Number(e.target.value))} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>网盘链接</Label>
              <Input value={form.pan_link} onChange={(e) => updateField('pan_link', e.target.value)} placeholder="付费课程仅购买后可见" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>网盘提取码</Label>
                <Input value={form.pan_password} onChange={(e) => updateField('pan_password', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>在线观看 URL</Label>
                <Input value={form.url} onChange={(e) => updateField('url', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => updateField('enabled', v)} />
              <Label>上架（客户端可见，另需审核通过）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审核弹窗 */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) setReviewTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>课程审核</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground">课程：</span>
                <span className="font-medium">{reviewTarget.title}</span>
                <span className="ml-2">{reviewBadge(reviewTarget.reviewStatus)}</span>
              </div>
              <div className="space-y-2">
                <Label>审核结果</Label>
                <Select value={reviewAction} onValueChange={(v) => setReviewAction(v as 'approve' | 'reject')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">通过（客户端可见）</SelectItem>
                    <SelectItem value="reject">驳回（客户端不可见）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>审核意见{reviewAction === 'reject' ? ' *' : ''}</Label>
                <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3}
                  placeholder={reviewAction === 'reject' ? '驳回必填，说明原因供创建者修改' : '可选，记录审核备注'} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>取消</Button>
            <Button onClick={handleReview} disabled={reviewing || (reviewAction === 'reject' && !reviewNote.trim())}
              variant={reviewAction === 'reject' ? 'destructive' : 'default'}>
              {reviewing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reviewAction === 'approve' ? '确认通过' : '确认驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}