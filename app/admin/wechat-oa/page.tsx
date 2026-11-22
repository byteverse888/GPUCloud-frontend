'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { QrCode, Loader2, RefreshCw, Upload, Pencil, Trash2 } from 'lucide-react'
import api, { uploadFileToS3, toFullUrl } from '@/lib/api'
import toast from 'react-hot-toast'
import { formatTime } from '@/lib/utils'
import { appName } from '@/lib/admin-apps'

interface OaConfig {
  app_id: string
  wx_app_id: string
  has_app_secret: boolean
  has_token: boolean
  qr_image_url: string
  enabled: boolean
  welcome_reply: string
  success_reply: string
  updated_at: string | null
}

const defaultForm = {
  wx_app_id: '', app_secret: '', token: '', qr_image_url: '',
  enabled: true, welcome_reply: '', success_reply: '',
}

export default function AdminWechatOaPage() {
  const [items, setItems] = useState<OaConfig[]>([])
  const [appNames, setAppNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const [showDialog, setShowDialog] = useState(false)
  const [editingApp, setEditingApp] = useState<string | null>(null)
  const [form, setForm] = useState({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const qrInputRef = useRef<HTMLInputElement>(null)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get<{ items: OaConfig[]; app_names: Record<string, string> }>('/admin/wechat-oa')
      setItems(data.items || [])
      setAppNames(data.app_names || {})
    } catch { setItems([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const displayName = (appId: string) => appNames[appId] || appName(appId)

  const handleEdit = (cfg: OaConfig) => {
    setEditingApp(cfg.app_id)
    setForm({
      wx_app_id: cfg.wx_app_id, app_secret: '', token: '', qr_image_url: cfg.qr_image_url,
      enabled: cfg.enabled, welcome_reply: cfg.welcome_reply, success_reply: cfg.success_reply,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!editingApp) return
    setSaving(true)
    try {
      // secret/token 传空 = 保留原值（凭证只写不回显）
      await api.put(`/admin/wechat-oa/${editingApp}`, form)
      toast.success('配置已保存')
      setShowDialog(false)
      fetchItems()
    } catch { /* api 层已 toast */ } finally { setSaving(false) }
  }

  const handleToggle = async (cfg: OaConfig) => {
    if (!cfg.wx_app_id) { toast.error('请先完成订阅号配置'); return }
    try {
      await api.patch(`/admin/wechat-oa/${cfg.app_id}/toggle?enabled=${!cfg.enabled}`)
      toast.success(!cfg.enabled ? '已开启订阅号登录' : '已关闭订阅号登录')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleDelete = async (cfg: OaConfig) => {
    if (!confirm(`确定删除「${displayName(cfg.app_id)}」的订阅号配置？${cfg.app_id === 'gpucloud' ? '（删除后回退 .env 配置）' : ''}`)) return
    try {
      await api.delete(`/admin/wechat-oa/${cfg.app_id}`)
      toast.success('已删除')
      fetchItems()
    } catch { /* api 层已 toast */ }
  }

  const handleQrUpload = async (file: File) => {
    setUploading(true)
    try {
      const { file_url } = await uploadFileToS3(file, 'upload')
      setForm(p => ({ ...p, qr_image_url: file_url }))
      toast.success('二维码上传成功')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '二维码上传失败')
    } finally { setUploading(false) }
  }

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <QrCode className="h-6 w-6 text-primary" />
          订阅号配置
        </h1>
        <Button variant="outline" onClick={fetchItems} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        每个应用绑定各自的微信订阅号，公众号后台回调地址配置为
        <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">/api/v1/wechat/sub/callback/应用码</code>，AppSecret/Token 只写不回显。
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((cfg) => (
            <Card key={cfg.app_id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{displayName(cfg.app_id)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{cfg.app_id}</Badge>
                    <Switch checked={cfg.enabled} onCheckedChange={() => handleToggle(cfg)} />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  {cfg.qr_image_url ? (
                    <img src={toFullUrl(cfg.qr_image_url)} alt="公众号二维码" className="h-20 w-20 rounded border object-contain" />
                  ) : (
                    <div className="h-20 w-20 rounded border bg-muted/50 flex items-center justify-center">
                      <QrCode className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="text-sm space-y-1">
                    <p>AppID: <span className="font-mono">{cfg.wx_app_id || '未配置'}</span></p>
                    <p>Secret: {cfg.has_app_secret ? <Badge variant="secondary">已配置</Badge> : <Badge variant="outline">未配置</Badge>}</p>
                    <p>Token: {cfg.has_token ? <Badge variant="secondary">已配置</Badge> : <Badge variant="outline">未配置</Badge>}</p>
                  </div>
                </div>
                {cfg.updated_at && (
                  <p className="text-xs text-muted-foreground">更新于 {formatTime(cfg.updated_at)}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(cfg)}>
                    <Pencil className="h-4 w-4 mr-1" />配置
                  </Button>
                  {(cfg.wx_app_id || cfg.has_app_secret) && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(cfg)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 配置弹窗 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingApp ? displayName(editingApp) : ''} · 订阅号配置</DialogTitle>
            <DialogDescription>
              回调地址：/api/v1/wechat/sub/callback/{editingApp}（配置到微信公众号后台服务器地址）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>微信 AppID</Label>
              <Input value={form.wx_app_id} onChange={(e) => updateField('wx_app_id', e.target.value)} placeholder="wx 开头的公众号 AppID" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>AppSecret</Label>
                <Input type="password" value={form.app_secret} onChange={(e) => updateField('app_secret', e.target.value)} placeholder="留空保留原值" />
              </div>
              <div className="space-y-2">
                <Label>Token（验签）</Label>
                <Input type="password" value={form.token} onChange={(e) => updateField('token', e.target.value)} placeholder="留空保留原值" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>公众号二维码</Label>
              <div className="flex items-center gap-2">
                <Input value={form.qr_image_url} onChange={(e) => updateField('qr_image_url', e.target.value)} placeholder="二维码图片 URL，或直接上传" />
                <input ref={qrInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQrUpload(f); e.target.value = '' }} />
                <Button variant="outline" size="icon" disabled={uploading} onClick={() => qrInputRef.current?.click()}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
              {form.qr_image_url && (
                <img src={toFullUrl(form.qr_image_url)} alt="二维码预览" className="h-24 w-24 rounded border object-contain" />
              )}
            </div>
            <div className="space-y-2">
              <Label>关注欢迎语（含登录引导）</Label>
              <Textarea rows={3} value={form.welcome_reply} onChange={(e) => updateField('welcome_reply', e.target.value)}
                placeholder="欢迎关注！回复「登录」获取验证码" />
            </div>
            <div className="space-y-2">
              <Label>登录成功回复</Label>
              <Textarea rows={2} value={form.success_reply} onChange={(e) => updateField('success_reply', e.target.value)}
                placeholder="登录成功，请回到客户端继续操作" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => updateField('enabled', v)} />
              <Label>启用订阅号登录</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}