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
import { MessageCircle, Loader2, RefreshCw, Search, Send, Eye } from 'lucide-react'
import api, { toFullUrl } from '@/lib/api'
import toast from 'react-hot-toast'
import { formatTime } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { AppFilter, AppBadge } from '@/components/admin/app-filter'
import { withAppId } from '@/lib/admin-apps'

interface FeedbackItem {
  objectId: string
  username: string
  appId: string
  type: string
  title: string
  content: string
  contact: string
  images: string[]
  status: string
  reply: string
  repliedAt: string
  createdAt: string
}

const typeLabels: Record<string, string> = { bug: '问题反馈', suggestion: '建议', other: '其他' }
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' }> = {
  pending: { label: '待处理', variant: 'warning' },
  processing: { label: '处理中', variant: 'default' },
  resolved: { label: '已解决', variant: 'success' },
  closed: { label: '已关闭', variant: 'secondary' },
}

export default function AdminFeedbackPage() {
  const { adminAppId } = useUIStore()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  // 详情/回复弹窗
  const [detail, setDetail] = useState<FeedbackItem | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyStatus, setReplyStatus] = useState('resolved')
  const [replying, setReplying] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const params = withAppId({
        page, limit: pageSize,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
        ...(search ? { search } : {}),
      }, adminAppId)
      const { data } = await api.get<{ items: FeedbackItem[]; total: number; statusCounts: Record<string, number> }>('/admin/feedback/list', params)
      setItems(data.items || [])
      setTotal(data.total || 0)
      setStatusCounts(data.statusCounts || {})
    } catch { setItems([]); setTotal(0) } finally { setLoading(false) }
  }, [page, pageSize, statusFilter, typeFilter, search, adminAppId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openDetail = (fb: FeedbackItem) => {
    setDetail(fb)
    setReplyContent(fb.reply || '')
    setReplyStatus('resolved')
  }

  const handleReply = async () => {
    if (!detail || !replyContent.trim()) { toast.error('请输入回复内容'); return }
    setReplying(true)
    try {
      await api.post(`/admin/feedback/${detail.objectId}/reply`, { reply: replyContent, status: replyStatus })
      toast.success('回复成功')
      setDetail(null)
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setReplying(false) }
  }

  const handleStatus = async (fb: FeedbackItem, status: string) => {
    try {
      await api.post(`/admin/feedback/${fb.objectId}/status`, { status })
      toast.success('状态已更新')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          反馈管理
        </h1>
        <Button variant="outline" onClick={fetchItems} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 状态统计卡片（点击筛选） */}
      <div className="grid grid-cols-4 gap-4">
        {(['pending', 'processing', 'resolved', 'closed'] as const).map((s) => (
          <Card key={s} className="cursor-pointer hover:border-primary/50"
            onClick={() => { setStatusFilter(statusFilter === s ? 'all' : s); setPage(1) }}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{statusCounts[s] || 0}</div>
              <p className="text-xs text-muted-foreground">{statusConfig[s].label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索标题/内容/用户名..." className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <AppFilter onChange={() => setPage(1)} />
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="bug">问题反馈</SelectItem>
            <SelectItem value="suggestion">建议</SelectItem>
            <SelectItem value="other">其他</SelectItem>
          </SelectContent>
        </Select>
        {statusFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setPage(1) }}>清除状态筛选</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>提交时间</TableHead>
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
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">暂无反馈</TableCell>
                </TableRow>
              ) : (
                items.map((fb) => {
                  const st = statusConfig[fb.status] || { label: fb.status, variant: 'secondary' as const }
                  return (
                    <TableRow key={fb.objectId}>
                      <TableCell>
                        <p className="font-medium truncate max-w-[260px]" title={fb.title}>{fb.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[260px]" title={fb.content}>{fb.content}</p>
                      </TableCell>
                      <TableCell className="text-sm">{fb.username || '-'}</TableCell>
                      <TableCell><AppBadge appId={fb.appId} /></TableCell>
                      <TableCell><Badge variant="outline">{typeLabels[fb.type] || fb.type}</Badge></TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fb.createdAt ? formatTime(fb.createdAt) : '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(fb)}>
                            <Eye className="h-4 w-4 mr-1" />查看
                          </Button>
                          {fb.status !== 'closed' && (
                            <Button variant="ghost" size="sm" onClick={() => handleStatus(fb, 'closed')}>关闭</Button>
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

      {/* 详情/回复弹窗 */}
      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span>用户: {detail.username || '-'}</span>
                <AppBadge appId={detail.appId} />
                <Badge variant="outline">{typeLabels[detail.type] || detail.type}</Badge>
                <span>{detail.createdAt ? formatTime(detail.createdAt) : ''}</span>
                {detail.contact && <span>联系方式: {detail.contact}</span>}
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="whitespace-pre-wrap text-sm">{detail.content}</p>
              </div>
              {detail.images?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {detail.images.map((img, i) => (
                    <a key={i} href={toFullUrl(img)} target="_blank" rel="noreferrer">
                      <img src={toFullUrl(img)} alt={`附图${i + 1}`} className="h-20 rounded object-cover border" />
                    </a>
                  ))}
                </div>
              )}
              {detail.reply && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">已有回复{detail.repliedAt ? `（${formatTime(detail.repliedAt)}）` : ''}</p>
                  <p className="whitespace-pre-wrap text-sm">{detail.reply}</p>
                </div>
              )}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>回复内容</Label>
                  <Select value={replyStatus} onValueChange={setReplyStatus}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="processing">处理中</SelectItem>
                      <SelectItem value="resolved">已解决</SelectItem>
                      <SelectItem value="closed">关闭</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea rows={4} placeholder="输入回复内容，用户可在客户端查看..." value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>取消</Button>
            <Button onClick={handleReply} disabled={replying || !replyContent.trim()}>
              {replying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              发送回复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}