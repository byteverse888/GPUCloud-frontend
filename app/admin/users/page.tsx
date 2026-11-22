'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Search, MoreHorizontal, Edit, Ban, DollarSign, Trash2, Loader2, RefreshCw, Plus, UserPlus, CheckCircle, Settings2, KeyRound, Crown } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { useUIStore } from '@/stores/ui-store'
import { AppFilter, AppBadge } from '@/components/admin/app-filter'
import { ADMIN_APPS } from '@/lib/admin-apps'

interface AdminUser {
  id: string
  email: string
  nickname: string
  balance: number
  status: string
  verified: boolean
  instances: number
  instance_quota: number
  created_at: string
  app_id?: string
  phone?: string
  web3_address?: string
  account_type?: string
  member_level?: string
  member_expire_at?: string
  points?: number
}

const accountTypeLabels: Record<string, string> = {
  email: '邮箱', phone: '手机', web3: 'Web3', wechat_sub: '订阅号',
}

export default function UsersPage() {
  const { adminAppId } = useUIStore()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // 添加用户弹窗
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', nickname: '', password: '', role: 'user', app_id: 'gpucloud' })
  
  // 调整余额弹窗
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceUser, setBalanceUser] = useState<AdminUser | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceReason, setBalanceReason] = useState('')
  
  // 删除确认弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)

  // 调整配额弹窗
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [quotaUser, setQuotaUser] = useState<AdminUser | null>(null)
  const [quotaValue, setQuotaValue] = useState('')

  // 重置密码弹窗
  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false)
  const [resetPwdLoading, setResetPwdLoading] = useState(false)
  const [resetPwdUser, setResetPwdUser] = useState<AdminUser | null>(null)
  const [resetPwdValue, setResetPwdValue] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = { page, size: 20 }
      if (searchQuery) params.search = searchQuery
      if (statusFilter !== 'all') params.status = statusFilter
      if (adminAppId && adminAppId !== 'all') params.app_id = adminAppId
      
      const { data } = await api.get<{ list: AdminUser[]; total: number }>('/admin/users', params)
      setUsers(data.list || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('获取用户列表失败:', err)
      toast.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, statusFilter, adminAppId])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // 创建用户
  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error('请填写邮箱和密码')
      return
    }
    try {
      setCreateLoading(true)
      await api.post('/admin/users', newUser)
      toast.success('用户创建成功')
      setCreateDialogOpen(false)
      setNewUser({ email: '', nickname: '', password: '', role: 'user', app_id: 'gpucloud' })
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '创建失败')
    } finally {
      setCreateLoading(false)
    }
  }

  // 更新用户状态
  const handleUpdateStatus = async (userId: string, status: string) => {
    try {
      await api.put(`/admin/users/${userId}/status?status=${status}`)
      toast.success(`用户已${status === 'banned' ? '封禁' : '解封'}`)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '操作失败')
    }
  }

  // 调整余额
  const handleAdjustBalance = async () => {
    if (!balanceUser || !balanceAmount || !balanceReason) {
      toast.error('请填写调整金额和原因')
      return
    }
    try {
      setBalanceLoading(true)
      await api.put(`/admin/users/${balanceUser.id}/balance?amount=${balanceAmount}&reason=${encodeURIComponent(balanceReason)}`)
      toast.success('余额调整成功')
      setBalanceDialogOpen(false)
      setBalanceAmount('')
      setBalanceReason('')
      setBalanceUser(null)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '调整失败')
    } finally {
      setBalanceLoading(false)
    }
  }

  // 删除用户
  const handleDeleteUser = async () => {
    if (!deleteUser) return
    try {
      setDeleteLoading(true)
      await api.delete(`/admin/users/${deleteUser.id}`)
      toast.success('用户已删除')
      setDeleteDialogOpen(false)
      setDeleteUser(null)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '删除失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  // 调整配额
  const handleAdjustQuota = async () => {
    if (!quotaUser || !quotaValue) {
      toast.error('请填写配额值')
      return
    }
    try {
      setQuotaLoading(true)
      await api.put(`/admin/users/${quotaUser.id}/quota?quota=${quotaValue}`)
      toast.success('配额调整成功')
      setQuotaDialogOpen(false)
      setQuotaValue('')
      setQuotaUser(null)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '调整失败')
    } finally {
      setQuotaLoading(false)
    }
  }

  // 重置密码
  const handleResetPassword = async () => {
    if (!resetPwdUser || resetPwdValue.length < 6) {
      toast.error('新密码长度至少6位')
      return
    }
    try {
      setResetPwdLoading(true)
      await api.post(`/admin/users/${resetPwdUser.id}/reset-password`, { new_password: resetPwdValue })
      toast.success('密码已重置')
      setResetPwdDialogOpen(false)
      setResetPwdValue('')
      setResetPwdUser(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '重置失败')
    } finally {
      setResetPwdLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive'; dotClass: string }> = {
      active: { label: '正常', variant: 'success', dotClass: 'bg-emerald-500' },
      banned: { label: '已封禁', variant: 'destructive', dotClass: 'bg-red-500' },
      inactive: { label: '未激活', variant: 'secondary', dotClass: 'bg-gray-400' },
    }
    const { label, variant, dotClass } = config[status] || { label: status, variant: 'secondary' as const, dotClass: 'bg-gray-400' }
    return (
      <Badge variant={variant} className="gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            刷新
          </Button>
          <Button onClick={() => { setNewUser(prev => ({ ...prev, app_id: adminAppId !== 'all' ? adminAppId : 'gpucloud' })); setCreateDialogOpen(true) }}>
            <UserPlus className="h-4 w-4 mr-2" />
            添加用户
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索邮箱/昵称/手机/Web3地址..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <AppFilter onChange={() => setPage(1)} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">正常</SelectItem>
            <SelectItem value="banned">已封禁</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>会员</TableHead>
                <TableHead>邮箱验证</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>实例数/配额</TableHead>
                <TableHead>注册时间</TableHead>
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
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.nickname}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        {user.account_type && user.account_type !== 'email' && (
                          <div className="text-xs text-muted-foreground">
                            {accountTypeLabels[user.account_type] || user.account_type}
                            {user.phone ? `: ${user.phone}` : ''}
                          </div>
                        )}
                        {user.web3_address && (
                          <div className="text-xs text-muted-foreground font-mono" title={user.web3_address}>
                            {user.web3_address.slice(0, 6)}...{user.web3_address.slice(-4)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><AppBadge appId={user.app_id} /></TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      {user.member_level && user.member_level !== 'normal' ? (
                        <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                          <Crown className="h-3 w-3" />{user.member_level.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">普通</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.verified ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">已激活</Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-500 border-orange-500">未激活</Badge>
                      )}
                    </TableCell>
                    <TableCell>¥{user.balance.toFixed(2)}</TableCell>
                    <TableCell>{user.instances} / {user.instance_quota ?? 20}</TableCell>
                    <TableCell>{user.created_at}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setBalanceUser(user); setBalanceDialogOpen(true); }}>
                            <DollarSign className="h-4 w-4 mr-2" />调整余额
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setQuotaUser(user); setQuotaValue(String(user.instance_quota ?? 20)); setQuotaDialogOpen(true); }}>
                            <Settings2 className="h-4 w-4 mr-2" />调整配额
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setResetPwdUser(user); setResetPwdValue(''); setResetPwdDialogOpen(true); }}>
                            <KeyRound className="h-4 w-4 mr-2" />重置密码
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(user.id, 'banned')}>
                              <Ban className="h-4 w-4 mr-2" />封禁用户
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(user.id, 'active')}>
                              <CheckCircle className="h-4 w-4 mr-2" />解除封禁
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive" 
                            onClick={() => { setDeleteUser(user); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />删除用户
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页 */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            上一页
          </Button>
          <span className="flex items-center px-3 text-sm">第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* 添加用户弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加用户</DialogTitle>
            <DialogDescription>创建新的平台用户账号</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>所属应用 *</Label>
              <Select value={newUser.app_id} onValueChange={(v) => setNewUser(prev => ({ ...prev, app_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADMIN_APPS.map((app) => (
                    <SelectItem key={app.value} value={app.value}>{app.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">同一邮箱在不同应用是独立账号、独立余额</p>
            </div>
            <div className="space-y-2">
              <Label>邮箱 *</Label>
              <Input 
                type="email"
                value={newUser.email} 
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} 
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>昵称</Label>
              <Input 
                value={newUser.nickname} 
                onChange={(e) => setNewUser(prev => ({ ...prev, nickname: e.target.value }))} 
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label>密码 *</Label>
              <Input 
                type="password"
                value={newUser.password} 
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))} 
                placeholder="至少6位"
              />
            </div>
            <div className="space-y-2">
              <Label>用户类型 *</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser(prev => ({ ...prev, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateUser} disabled={createLoading} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white">
              {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 调整余额弹窗 */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整余额</DialogTitle>
            <DialogDescription>
              用户: {balanceUser?.nickname} ({balanceUser?.email})<br/>
              当前余额: ¥{balanceUser?.balance.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>调整金额</Label>
              <Input 
                type="number"
                value={balanceAmount} 
                onChange={(e) => setBalanceAmount(e.target.value)} 
                placeholder="正数增加，负数扣减"
              />
            </div>
            <div className="space-y-2">
              <Label>调整原因</Label>
              <Input 
                value={balanceReason} 
                onChange={(e) => setBalanceReason(e.target.value)} 
                placeholder="如：充值、退款、补偿等"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>取消</Button>
            <Button onClick={handleAdjustBalance} disabled={balanceLoading} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white">
              {balanceLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认调整
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
            <AlertDialogDescription>
              您即将删除用户 <strong>{deleteUser?.nickname}</strong> ({deleteUser?.email})。
              <br/>此操作不可撤销，用户的所有数据将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重置密码弹窗 */}
      <Dialog open={resetPwdDialogOpen} onOpenChange={setResetPwdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              用户: {resetPwdUser?.nickname} ({resetPwdUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={resetPwdValue}
                onChange={(e) => setResetPwdValue(e.target.value)}
                placeholder="至少6位"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwdDialogOpen(false)}>取消</Button>
            <Button onClick={handleResetPassword} disabled={resetPwdLoading} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white">
              {resetPwdLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 调整配额弹窗 */}
      <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整实例配额</DialogTitle>
            <DialogDescription>
              用户: {quotaUser?.nickname} ({quotaUser?.email})<br/>
              当前配额: {quotaUser?.instance_quota ?? 20}，已使用: {quotaUser?.instances ?? 0}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>新配额值</Label>
              <Input 
                type="number"
                min={0}
                max={1000}
                value={quotaValue} 
                onChange={(e) => setQuotaValue(e.target.value)} 
                placeholder="实例配额上限，如 20"
              />
              <p className="text-xs text-muted-foreground">配额范围 0 - 1000，包含容器实例和智能体实例总数</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaDialogOpen(false)}>取消</Button>
            <Button onClick={handleAdjustQuota} disabled={quotaLoading} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white">
              {quotaLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认调整
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
