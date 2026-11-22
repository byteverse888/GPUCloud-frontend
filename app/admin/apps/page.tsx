'use client'

/**
 * 应用管理（运营管理 → 应用管理）
 * - 应用注册表：apps 表 CRUD（code/名称/启用/Token TTL/前端地址）
 * - 按应用专有数据面板：
 *   gpubox      集群接入（.env 自动下发，只读）+ btfs bootstrap（唯一手填项）+ 全网统计预览
 *   gpucloud    GPU 卡计费（与算力工坊共享同一套定价）
 *   gpustudio   GPU 卡计费（同上）
 *   modelstudio AI 应用部署模板目录 + 模型市场（去 Parse 化后的原生数据）
 */

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Edit, Trash2, AppWindow, Server, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import SpecPanel from '../spec-pricing/spec-panel'
import GpuPanel from '../spec-pricing/gpu-panel'

interface AppItem {
  code: string
  name: string
  enabled: boolean
  config: Record<string, any>
  created_at?: string
  updated_at?: string
}

// ── 应用注册表 ───────────────────────────────────────────

function RegistrySection({ apps, onChanged }: { apps: AppItem[]; onChanged: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AppItem | null>(null)
  const [form, setForm] = useState({ code: '', name: '', token_ttl_minutes: 30, frontend_url: '' })
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm({ code: '', name: '', token_ttl_minutes: 30, frontend_url: '' })
    setDialogOpen(true)
  }
  const openEdit = (a: AppItem) => {
    setEditing(a)
    setForm({
      code: a.code, name: a.name,
      token_ttl_minutes: a.config?.token_ttl_minutes ?? 30,
      frontend_url: a.config?.frontend_url ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('请输入应用名称'); return }
    if (!editing && !/^[a-z][a-z0-9_-]{1,31}$/.test(form.code.trim().toLowerCase())) {
      toast.error('code 需为 2-32 位小写字母/数字/_-，字母开头'); return
    }
    setSaving(true)
    try {
      const config: Record<string, any> = { token_ttl_minutes: Number(form.token_ttl_minutes) || 30 }
      if (form.frontend_url.trim()) config.frontend_url = form.frontend_url.trim()
      if (editing) {
        await api.put(`/admin/apps/${editing.code}`, { name: form.name.trim(), config })
        toast.success('应用已更新')
      } else {
        await api.post('/admin/apps', { code: form.code.trim().toLowerCase(), name: form.name.trim(), config })
        toast.success('应用已创建')
      }
      setDialogOpen(false)
      onChanged()
    } catch (e: any) { toast.error(e?.message || '保存失败') } finally { setSaving(false) }
  }

  const handleToggle = async (a: AppItem, enabled: boolean) => {
    try {
      await api.put(`/admin/apps/${a.code}`, { enabled })
      toast.success(enabled ? '已启用' : '已停用')
      onChanged()
    } catch (e: any) { toast.error(e?.message || '操作失败') }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">应用注册表</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新增应用</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead><TableHead>名称</TableHead><TableHead>启用</TableHead>
              <TableHead>Token TTL(分)</TableHead><TableHead>前端地址</TableHead><TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map(a => (
              <TableRow key={a.code}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell><Switch checked={a.enabled} onCheckedChange={v => handleToggle(a, v)} /></TableCell>
                <TableCell>{a.config?.token_ttl_minutes ?? '-'}</TableCell>
                <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{a.config?.frontend_url || '-'}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Edit className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? `编辑应用 ${editing.code}` : '新增应用'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <div><Label>Code（唯一标识，创建后不可改）</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="如 modelstudio" /></div>
            )}
            <div><Label>名称</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如 模型工坊" /></div>
            <div><Label>Token TTL（分钟）</Label>
              <Input type="number" value={form.token_ttl_minutes} onChange={e => setForm(f => ({ ...f, token_ttl_minutes: Number(e.target.value) }))} /></div>
            <div><Label>前端地址（邀请/邮件链接用，可空）</Label>
              <Input value={form.frontend_url} onChange={e => setForm(f => ({ ...f, frontend_url: e.target.value }))} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ── gpubox：集群接入（.env 自动）+ btfs 手填 + 全网统计预览 ──

interface TokenInfo {
  token: string; expiresAt: string | null; expired: boolean; error: string | null
  cloud?: { cloudname: string; ip: string; port: number }
}

function GpuboxPanel() {
  const [btfsText, setBtfsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<{ value: any }>('/admin/apps/gpubox/config/cluster_config')
      const v = data?.value || {}
      setBtfsText((Array.isArray(v.btfs) ? v.btfs : [])
        .map((b: any) => (typeof b === 'string' ? b : b?.bootstrapnode || '')).filter(Boolean).join('\n'))
    } catch { /* 未配置视为空 */ }
    try {
      const { data } = await api.get<TokenInfo>('/admin/apps/gpubox/cluster-token')
      setTokenInfo(data)
    } catch { setTokenInfo(null) }
    try {
      const { data } = await api.get<Record<string, any>>('/network-stats')
      setStats(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSave = async () => {
    setSaving(true)
    try {
      const btfs = btfsText.split('\n').map(s => s.trim()).filter(Boolean).map(bootstrapnode => ({ bootstrapnode }))
      await api.put('/admin/apps/gpubox/config/cluster_config', { value: { btfs } })
      toast.success('BTFS bootstrap 配置已保存')
    } catch (e: any) { toast.error(e?.message || '保存失败') } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>

  const cloud = tokenInfo?.cloud
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" />集群接入（云端 .env 自动下发，只读）</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-1" />刷新</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {cloud ? (
            <div className="grid grid-cols-3 gap-3">
              {[['区域', cloud.cloudname], ['接入点（IP/域名）', cloud.ip], ['端口', cloud.port]].map(([label, v]) => (
                <div key={label as string} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-sm font-semibold font-mono">{String(v ?? '-')}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">接入点信息不可用</p>}
          {tokenInfo ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">Join Token：</span>
                {tokenInfo.expired ? (
                  <Badge variant="destructive">已过期</Badge>
                ) : tokenInfo.token ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30">有效</Badge>
                ) : (
                  <Badge variant="destructive">不可用</Badge>
                )}
                {tokenInfo.expiresAt && (
                  <span className="text-xs text-muted-foreground">有效期至：{new Date(tokenInfo.expiresAt).toLocaleString()}</span>
                )}
                {tokenInfo.token && (
                  <span className="font-mono text-xs text-muted-foreground">{tokenInfo.token.slice(0, 12)}…{tokenInfo.token.slice(-6)}</span>
                )}
              </div>
              {tokenInfo.error && <p className="text-xs text-destructive">{tokenInfo.error}</p>}
            </div>
          ) : <p className="text-sm text-muted-foreground">token 状态不可用（后端未配 kubeconfig 或 K8s 不可达）</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">BTFS Bootstrap 节点（唯一需手填项）</CardTitle>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}保存</Button>
        </CardHeader>
        <CardContent>
          <Label>每行一个 multiaddr；留空 = 客户端不加入 BTFS 集群、不启用 btfs 组件</Label>
          <Textarea rows={3} value={btfsText} onChange={e => setBtfsText(e.target.value)}
            placeholder="/ip4/1.2.3.4/tcp/4001/p2p/Qm..." className="font-mono text-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">全网算力统计（Node 表实时聚合，只读）</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-1" />刷新</Button>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['总节点', stats.totalNodes], ['在线节点', stats.onlineNodes],
                ['GPU 总卡数', stats.totalGPU], ['运行 Pod', stats.runningPods],
                ['贡献发放', stats.totalContributionIssued], ['已结算', stats.totalSettled],
                ['成熟因子', stats.maturityFactor], ['短缺因子', stats.shortageFactor],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold">{String(v ?? 0)}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">统计不可用</p>}
          <p className="mt-2 text-xs text-muted-foreground">贡献发放/已结算等激励域字段在激励移植前为 0。</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── modelstudio：AI 应用目录 / 模型市场 CRUD ─────────────

const STRIP_KEYS = ['objectId', 'createdAt', 'updatedAt', 'ownerAppId', 'name', 'category', 'apptype', 'status',
  'likeCount', 'favoriteCount', 'useCount', 'downloadCount', 'downloads']

function CatalogPanel({ kind }: { kind: 'apps' | 'models' }) {
  const base = kind === 'apps' ? '/apps' : '/apps/models'
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', category: '', status: 'active', dataJson: '{}' })
  const [saving, setSaving] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<{ results: any[] }>(`${base}?limit=500&order=-createdAt`)
      setRows(data.results || [])
    } catch (e: any) { toast.error(e?.message || '加载失败') }
    setLoading(false)
  }, [base])
  useEffect(() => { fetchList() }, [fetchList])

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', category: '', status: 'active', dataJson: '{\n  "description": ""\n}' })
    setDialogOpen(true)
  }
  const openEdit = (r: any) => {
    setEditingId(r.objectId)
    const data: Record<string, any> = {}
    Object.entries(r).forEach(([k, v]) => { if (!STRIP_KEYS.includes(k)) data[k] = v })
    setForm({ name: r.name || '', category: r.category || '', status: r.status || 'active', dataJson: JSON.stringify(data, null, 2) })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('请输入名称'); return }
    let payload: Record<string, any>
    try { payload = JSON.parse(form.dataJson || '{}') } catch { toast.error('扩展字段需为合法 JSON'); return }
    const body = { ...payload, name: form.name.trim(), category: form.category.trim() || undefined, status: form.status }
    setSaving(true)
    try {
      if (editingId) await api.put(`${base}/${editingId}`, body)
      else await api.post(base, body)
      toast.success('已保存')
      setDialogOpen(false)
      fetchList()
    } catch (e: any) { toast.error(e?.message || '保存失败') } finally { setSaving(false) }
  }

  const handleDelete = async (r: any) => {
    if (!confirm(`确认删除「${r.name}」？`)) return
    try {
      await api.delete(`${base}/${r.objectId}`)
      toast.success('已删除')
      fetchList()
    } catch (e: any) { toast.error(e?.message || '删除失败') }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{kind === 'apps' ? 'AI 应用部署模板' : '模型市场'}</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新增</Button>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead><TableHead>分类</TableHead><TableHead>状态</TableHead>
                <TableHead>{kind === 'apps' ? '部署量' : '下载量'}</TableHead><TableHead>更新时间</TableHead><TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无数据</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r.objectId}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.category || '-'}</Badge></TableCell>
                  <TableCell><Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                  <TableCell>{kind === 'apps' ? (r.useCount ?? 0) : (r.downloads ?? 0)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.updatedAt ? String(r.updatedAt).slice(0, 10) : '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? '编辑条目' : '新增条目'}（{kind === 'apps' ? 'AI 应用' : '模型'}）</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label>名称</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>分类</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="image/text/audio/llm" /></div>
              <div><Label>状态</Label><Input value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} placeholder="active" /></div>
            </div>
            <div>
              <Label>扩展字段（完整 camelCase JSON：description/icon/tags{kind === 'apps' ? '/deployment/service/pvc 等 K8s 模板' : '/paramSize/download[] 等'}）</Label>
              <Textarea rows={12} value={form.dataJson} onChange={e => setForm(f => ({ ...f, dataJson: e.target.value }))} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ── 页面主体 ─────────────────────────────────────────────

export default function AdminAppsPage() {
  const [apps, setApps] = useState<AppItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApps = useCallback(async () => {
    try {
      const { data } = await api.get<{ items: AppItem[] }>('/admin/apps')
      setApps(data.items || [])
    } catch (e: any) { toast.error(e?.message || '加载应用列表失败') }
    setLoading(false)
  }, [])
  useEffect(() => { fetchApps() }, [fetchApps])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AppWindow className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">应用管理</h1>
      </div>

      <RegistrySection apps={apps} onChanged={fetchApps} />

      <Card>
        <CardHeader><CardTitle className="text-base">应用专有数据</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue={apps[0]?.code || 'gpucloud'}>
            <TabsList className="flex-wrap h-auto">
              {apps.map(a => <TabsTrigger key={a.code} value={a.code}>{a.name}</TabsTrigger>)}
            </TabsList>
            {apps.map(a => (
              <TabsContent key={a.code} value={a.code} className="mt-4">
                {a.code === 'gpubox' && <GpuboxPanel />}
                {(a.code === 'gpucloud' || a.code === 'gpustudio') && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">GPU 卡计费：算力云与算力工坊共享同一套定价（规格定价页同源数据）。</p>
                    <SpecPanel />
                    <GpuPanel />
                  </div>
                )}
                {a.code === 'modelstudio' && (
                  <div className="space-y-6">
                    <CatalogPanel kind="apps" />
                    <CatalogPanel kind="models" />
                  </div>
                )}
                {!['gpubox', 'gpucloud', 'gpustudio', 'modelstudio'].includes(a.code) && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">该应用暂无专有数据面板，当前 config：</p>
                    <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-auto">{JSON.stringify(a.config || {}, null, 2)}</pre>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
