'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Timer, RefreshCw, Loader2, ScrollText, Activity } from 'lucide-react'
import api from '@/lib/api'
import { formatTime } from '@/lib/utils'

// 任务名 → 中文说明（与后端 app/tasks.py WorkerSettings.cron_jobs 对应）
const taskLabels: Record<string, string> = {
  sync_instance_status_task: '实例状态同步',
  sync_running_status_task: '运行状态同步',
  process_all_billing_task: '计费结算',
  cleanup_expired_instances_task: '过期实例清理',
  generate_daily_report_task: '日报生成',
  agent_model_key_monitor: '模型 Key 监控',
  agent_channel_monitor: '渠道监控',
  agent_instance_sync: '智能体实例同步',
  cancel_expired_orders_task: '过期订单取消',
  downgrade_expired_members_task: '过期会员降级',
  gb_offline_sweep_task: 'GPUBox 离线清扫',
  gb_retention_sweep_task: 'GPUBox 保留清扫',
  prune_task_run_logs_task: '任务日志清理',
  incentive_collect_task: '激励节点采集',
  incentive_settle_task: '激励积分清算',
  incentive_revenue_task: 'GPUCloud 消费分账',
  incentive_gbsettle_task: '算力宝会话分账',
  incentive_prune_task: '离线节点清理',
}

interface ScheduledTask {
  name: string
  description: string
  cronExpr: string
  timeout: number
  unique: boolean
  lastStatus: string | null
  lastRunAt: string | null
  lastDurationMs: number | null
  runs24h: number
  failed24h: number
}

interface WorkerState {
  active: boolean
  lastRunAt: string | null
  queued: number
  running: { jobId: string; taskName: string; startedAt: string | null }[]
}

interface TaskLog {
  id: number
  jobId: string
  taskName: string
  trigger: string
  status: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  resultSummary: string
  error: string
}

const fmtDuration = (ms: number | null) => {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const statusBadge = (status: string | null) => {
  if (!status) return <Badge variant="outline">未运行</Badge>
  if (status === 'success') return <Badge className="bg-emerald-500 hover:bg-emerald-600">成功</Badge>
  return <Badge variant="destructive">失败</Badge>
}

export default function AdminScheduledTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [worker, setWorker] = useState<WorkerState | null>(null)
  const [loading, setLoading] = useState(true)

  const [logs, setLogs] = useState<TaskLog[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [logsLoading, setLogsLoading] = useState(true)
  const [logPage, setLogPage] = useState(1)
  const [logPageSize, setLogPageSize] = useState(20)
  const [logTask, setLogTask] = useState('all')
  const [logStatus, setLogStatus] = useState('all')

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get<{ worker: WorkerState; tasks: ScheduledTask[] }>('/admin/scheduled-tasks')
      setTasks(data.tasks || [])
      setWorker(data.worker || null)
    } catch { setTasks([]); setWorker(null) } finally { setLoading(false) }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true)
      const params: Record<string, string | number> = { page: logPage, limit: logPageSize }
      if (logTask !== 'all') params.task_name = logTask
      if (logStatus !== 'all') params.status = logStatus
      const { data } = await api.get<{ items: TaskLog[]; total: number }>('/admin/scheduled-tasks/logs', params)
      setLogs(data.items || [])
      setLogTotal(data.total || 0)
    } catch { setLogs([]); setLogTotal(0) } finally { setLogsLoading(false) }
  }, [logPage, logPageSize, logTask, logStatus])

  useEffect(() => { fetchOverview() }, [fetchOverview])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  const viewTaskLogs = (name: string) => {
    setLogTask(name)
    setLogPage(1)
    document.getElementById('task-logs')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Timer className="h-6 w-6 text-primary" />
          定时任务
        </h1>
        <Button variant="outline" onClick={() => { fetchOverview(); fetchLogs() }} disabled={loading || logsLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading || logsLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Worker 状态概览 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-6 flex-wrap text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Worker：</span>
              {worker?.active
                ? <Badge className="bg-emerald-500 hover:bg-emerald-600">运行中</Badge>
                : <Badge variant="destructive">离线 / 无近期执行</Badge>}
            </div>
            <div className="text-muted-foreground">
              最近执行：<span className="text-foreground">{worker?.lastRunAt ? formatTime(worker.lastRunAt) : '-'}</span>
            </div>
            <div className="text-muted-foreground">
              队列等待：<span className="text-foreground">{worker?.queued ?? 0}</span>
            </div>
            <div className="text-muted-foreground">
              正在执行：<span className="text-foreground">{worker?.running?.length ?? 0}</span>
              {(worker?.running?.length ?? 0) > 0 && (
                <span className="ml-2 text-xs">
                  （{worker!.running.map(r => taskLabels[r.taskName] || r.taskName).join('、')}）
                </span>
              )}
            </div>
            <div className="text-muted-foreground">
              任务总数：<span className="text-foreground">{tasks.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 任务清单 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务</TableHead>
                <TableHead>调度（秒 分 时 日 月 周）</TableHead>
                <TableHead>超时</TableHead>
                <TableHead>最近状态</TableHead>
                <TableHead>最近执行</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead>24h 执行/失败</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">暂无定时任务</TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell>
                      <p className="font-medium">{taskLabels[t.name] || t.name}</p>
                      <p className="text-xs text-muted-foreground" title={t.description}>{t.name}</p>
                    </TableCell>
                    <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{t.cronExpr}</code></TableCell>
                    <TableCell className="text-sm">{t.timeout ?? 300}s</TableCell>
                    <TableCell>{statusBadge(t.lastStatus)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{t.lastRunAt ? formatTime(t.lastRunAt) : '-'}</TableCell>
                    <TableCell className="text-sm">{fmtDuration(t.lastDurationMs)}</TableCell>
                    <TableCell className="text-sm">
                      {t.runs24h}
                      {t.failed24h > 0 && <span className="text-destructive ml-1">/ {t.failed24h} 失败</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => viewTaskLogs(t.name)}>
                        <ScrollText className="h-4 w-4" />
                        日志
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 执行日志 */}
      <div id="task-logs" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            执行日志
            <span className="text-xs font-normal text-muted-foreground">（保留 7 天）</span>
          </h2>
          <div className="flex items-center gap-3">
            <Select value={logTask} onValueChange={(v) => { setLogTask(v); setLogPage(1) }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="任务" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部任务</SelectItem>
                {tasks.map((t) => (
                  <SelectItem key={t.name} value={t.name}>{taskLabels[t.name] || t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={logStatus} onValueChange={(v) => { setLogStatus(v); setLogPage(1) }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>完成时间</TableHead>
                  <TableHead>任务</TableHead>
                  <TableHead>触发</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>耗时</TableHead>
                  <TableHead>结果 / 错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">暂无执行日志（Worker 重启后开始记录）</TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">{log.finishedAt ? formatTime(log.finishedAt) : '-'}</TableCell>
                      <TableCell className="text-sm" title={log.taskName}>{taskLabels[log.taskName] || log.taskName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.trigger === 'manual' ? '手动' : '定时'}</Badge>
                      </TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="text-sm">{fmtDuration(log.durationMs)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[360px]">
                        <span className="relative group cursor-default">
                          <span className={`truncate block ${log.error ? 'text-destructive' : ''}`}>
                            {log.error || log.resultSummary || '-'}
                          </span>
                          {(log.error || log.resultSummary) && (
                            <span className="invisible group-hover:visible absolute z-50 right-0 top-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md p-3 max-w-[480px] whitespace-pre-wrap break-words text-xs leading-relaxed">
                              {log.error || log.resultSummary}
                            </span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination
              page={logPage} pageSize={logPageSize} total={logTotal}
              onPageChange={setLogPage} onPageSizeChange={(s) => { setLogPageSize(s); setLogPage(1) }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}