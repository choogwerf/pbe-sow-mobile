import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  NotebookPen,
  Info,
  Upload,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  Smartphone,
} from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  createFallbackData,
  parseWorkbook,
  formatDisplayDate,
  getTodayIso,
  isOverdue,
  downloadTextFile,
  escapeCsv,
} from './sowParser'

const PBE = {
  dark: '#1f1826',
  green: '#70c040',
}

const STATUS_META = {
  'Not Started': { tone: 'status-neutral', chart: '#94a3b8' },
  'In Progress': { tone: 'status-blue', chart: '#3b82f6' },
  Complete: { tone: 'status-green', chart: '#22c55e' },
  'On Hold': { tone: 'status-amber', chart: '#f59e0b' },
  Blocked: { tone: 'status-red', chart: '#ef4444' },
}

const PRIORITY_META = {
  'P1 - Critical': 'priority-critical',
  'P2 - High': 'priority-high',
  'P3 - Medium': 'priority-medium',
  'P4 - Low': 'priority-low',
}

function statusPercent(status) {
  if (status === 'Complete') return 100
  if (status === 'In Progress') return 50
  return 0
}

function KpiCard({ title, value, hint }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-head">{title}</div>
      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-hint">{hint}</div>
      </div>
    </div>
  )
}

function SectionTitle({ title, right }) {
  return (
    <div className="section-title-row">
      <div className="section-pill">{title}</div>
      {right ? <div>{right}</div> : null}
    </div>
  )
}

function StatusBadge({ status }) {
  const tone = STATUS_META[status]?.tone || 'status-neutral'
  return <span className={`badge ${tone}`}>{status}</span>
}

function PriorityBadge({ priority }) {
  const tone = PRIORITY_META[priority] || 'priority-low'
  return <span className={`badge ${tone}`}>{priority || 'No priority'}</span>
}

function TopHeader({ title, subtitle }) {
  return (
    <div className="top-header">
      <div className="top-header-main">
        <div>
          <div className="app-title">PBE SOW Mobile</div>
          <div className="app-subtitle">{title}</div>
        </div>
        <div className="mode-chip">
          <Smartphone size={16} />
          <div>
            <div className="mode-label">Mode</div>
            <div className="mode-value">Phone-friendly field app</div>
          </div>
        </div>
      </div>
      <div className="top-header-copy">{subtitle}</div>
      <div className="top-header-accent" />
    </div>
  )
}

function Toolbar({ onImport, onExportJson, onExportCsv, onReset, onLoadBundled }) {
  const fileInputRef = useRef(null)

  return (
    <div className="card toolbar-card">
      <div className="toolbar-grid">
        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
          Import workbook
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          className="hidden-input"
          onChange={onImport}
        />

        <button className="btn btn-secondary" onClick={onLoadBundled}>
          <LinkIcon size={16} />
          Load bundled CSS092 file
        </button>

        <button className="btn btn-secondary" onClick={onExportJson}>
          <Download size={16} />
          Export JSON
        </button>

        <button className="btn btn-secondary" onClick={onExportCsv}>
          <FileSpreadsheet size={16} />
          Export task CSV
        </button>

        <button className="btn btn-secondary" onClick={onReset}>
          <RotateCcw size={16} />
          Reset app data
        </button>
      </div>

      <div className="toolbar-note">
        This version is GitHub and Vercel friendly. It reads the SOW workbook cleanly and gives you a proper mobile UI. True live 2-way sync into the same styled Excel file is still the fragile bit, so this stays honest: local edits, clean export, no fake magic.
      </div>
    </div>
  )
}

function DashboardTab({ tasks, statusData }) {
  const total = tasks.length
  const complete = tasks.filter((task) => task.status === 'Complete').length
  const inProgress = tasks.filter((task) => task.status === 'In Progress').length
  const blocked = tasks.filter((task) => task.status === 'Blocked' || task.status === 'On Hold').length
  const overdue = tasks.filter((task) => isOverdue(task)).length
  const overall =
    total > 0 ? Math.round(tasks.reduce((sum, task) => sum + Number(task.percentComplete || 0), 0) / total) : 0

  const nextDue = [...tasks]
    .filter((task) => task.status !== 'Complete' && task.plannedFinish)
    .sort((a, b) => (a.plannedFinish > b.plannedFinish ? 1 : -1))[0]

  return (
    <div className="stack-lg">
      <SectionTitle title="Progress Summary" />

      <div className="kpi-grid">
        <KpiCard title="Total Tasks" value={total} hint="All loaded tasks" />
        <KpiCard title="Complete" value={complete} hint="Closed out" />
        <KpiCard title="In Progress" value={inProgress} hint="Currently moving" />
        <KpiCard title="Blocked / On Hold" value={blocked} hint="Needs intervention" />
        <KpiCard title="Overdue" value={overdue} hint="Past planned finish" />
        <KpiCard title="Overall %" value={`${overall}%`} hint="Average completion" />
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-title">Tasks by status</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={54} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_META[entry.status]?.chart || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stack-md">
          <div className="card side-card">
            <div className="card-title">Next item likely to go feral</div>
            {nextDue ? (
              <div className="stack-sm">
                <div className="side-title">{nextDue.item}</div>
                <div className="muted">{nextDue.description}</div>
                <div className="badge-row">
                  <StatusBadge status={nextDue.status} />
                  <span className="badge priority-low">Due {formatDisplayDate(nextDue.plannedFinish)}</span>
                </div>
              </div>
            ) : (
              <div className="muted">No incomplete task has a planned finish date yet. Convenient, but not exactly disciplined.</div>
            )}
          </div>

          <div className="card side-card">
            <div className="card-title">What matters</div>
            <ul className="plain-list">
              <li>P1 items still open stay at the front of the queue.</li>
              <li>Blocked work usually means shutdown, permit or access friction, not a motivation problem.</li>
              <li>This layout is built for the real world, not for thumb-wrestling a spreadsheet on site.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, onUpdate }) {
  const overdue = isOverdue(task)

  return (
    <div className="card task-card">
      <div className="task-card-top">
        <div className="stack-sm grow">
          <div className="task-title-row">
            <div className="task-title">#{task.id} {task.item || 'Untitled task'}</div>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="task-desc">{task.description}</div>
        </div>
        {overdue ? (
          <div className="alert-chip alert-overdue">
            <AlertTriangle size={14} />
            Overdue
          </div>
        ) : task.status === 'Complete' ? (
          <div className="alert-chip alert-done">
            <CheckCircle2 size={14} />
            Done
          </div>
        ) : null}
      </div>

      <div className="form-grid">
        <div>
          <label className="field-label">Status</label>
          <select
            className="field"
            value={task.status}
            onChange={(event) =>
              onUpdate(task.id, {
                status: event.target.value,
                percentComplete:
                  [0, 50, 100].includes(task.percentComplete) ? statusPercent(event.target.value) : task.percentComplete,
              })
            }
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Assigned To</label>
          <input
            className="field"
            value={task.assignedTo || ''}
            onChange={(event) => onUpdate(task.id, { assignedTo: event.target.value })}
            placeholder="Technician / owner"
          />
        </div>

        <div>
          <label className="field-label">Planned Start</label>
          <input
            type="date"
            className="field"
            value={task.plannedStart || ''}
            onChange={(event) => onUpdate(task.id, { plannedStart: event.target.value })}
          />
        </div>

        <div>
          <label className="field-label">Planned Finish</label>
          <input
            type="date"
            className="field"
            value={task.plannedFinish || ''}
            onChange={(event) => onUpdate(task.id, { plannedFinish: event.target.value })}
          />
        </div>
      </div>

      <div className="progress-block">
        <div className="progress-row">
          <div className="field-label no-margin">Progress</div>
          <div className="progress-value">{task.percentComplete}%</div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={task.percentComplete}
          onChange={(event) => {
            const value = Number(event.target.value)
            let status = task.status
            if (value >= 100) status = 'Complete'
            else if (value > 0 && task.status === 'Not Started') status = 'In Progress'
            else if (value === 0 && task.status === 'Complete') status = 'Not Started'
            onUpdate(task.id, { percentComplete: value, status })
          }}
          className="range"
        />
      </div>

      <div className="mini-grid">
        <div className="mini-card">
          <div className="field-label">Discipline</div>
          <div>{task.discipline || '—'}</div>
        </div>
        <div className="mini-card">
          <div className="field-label">Actual Hours</div>
          <div>{Number(task.actualHours || 0).toFixed(1)}</div>
        </div>
      </div>

      <details className="task-detail">
        <summary>More detail</summary>
        <div className="detail-grid">
          <div>
            <div className="field-label">Dependencies / Permits</div>
            <div className="detail-copy">{task.dependencies || '—'}</div>
          </div>
          <div>
            <div className="field-label">Acceptance Criteria / Tests</div>
            <div className="detail-copy">{task.acceptance || '—'}</div>
          </div>
          <div>
            <label className="field-label">Completion Evidence</label>
            <textarea
              className="field textarea"
              value={task.evidence || ''}
              onChange={(event) => onUpdate(task.id, { evidence: event.target.value })}
            />
          </div>
        </div>
      </details>
    </div>
  )
}

function TasksTab({ tasks, search, setSearch, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, onUpdateTask }) {
  return (
    <div className="stack-lg">
      <SectionTitle title="Task Register" right={<div className="muted strongish">{tasks.length} task{tasks.length === 1 ? '' : 's'}</div>} />

      <div className="card filters-card">
        <div className="filters-grid">
          <div className="field-icon-wrap">
            <Search size={16} className="field-icon" />
            <input
              className="field field-with-icon"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item, task, assignee"
            />
          </div>
          <div className="field-icon-wrap">
            <Filter size={16} className="field-icon" />
            <select className="field field-with-icon" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <select className="field" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="All">All priorities</option>
            {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </div>
      </div>

      <div className="stack-md">
        {tasks.length ? tasks.map((task) => <TaskCard key={task.id} task={task} onUpdate={onUpdateTask} />) : (
          <div className="card empty-card">No tasks match the current filters.</div>
        )}
      </div>
    </div>
  )
}

function DailyLogTab({ tasks, logs, onAddLog, onDeleteLog }) {
  const [form, setForm] = useState({
    date: getTodayIso(),
    technician: '',
    taskId: '',
    hours: '',
    notes: '',
    initials: '',
  })

  const selectedTask = tasks.find((task) => String(task.id) === String(form.taskId))
  const totalHours = logs.reduce((sum, log) => sum + Number(log.hours || 0), 0)

  return (
    <div className="stack-lg">
      <SectionTitle title="Daily Log" right={<div className="muted strongish">{totalHours.toFixed(1)} hrs logged</div>} />

      <div className="card">
        <div className="form-grid">
          <div>
            <label className="field-label">Date</label>
            <input type="date" className="field" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
          </div>
          <div>
            <label className="field-label">Technician</label>
            <input className="field" value={form.technician} onChange={(event) => setForm((prev) => ({ ...prev, technician: event.target.value }))} placeholder="Name" />
          </div>
          <div>
            <label className="field-label">Task</label>
            <select className="field" value={form.taskId} onChange={(event) => setForm((prev) => ({ ...prev, taskId: event.target.value }))}>
              <option value="">Select task</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>#{task.id} {task.item}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Hours</label>
            <input type="number" min="0" step="0.5" className="field" value={form.hours} onChange={(event) => setForm((prev) => ({ ...prev, hours: event.target.value }))} placeholder="0.0" />
          </div>
          <div className="full-width">
            <label className="field-label">Work Performed / Notes</label>
            <textarea className="field textarea" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="What actually happened on site?" />
          </div>
          <div>
            <label className="field-label">Client / PM Initials</label>
            <input className="field" value={form.initials} onChange={(event) => setForm((prev) => ({ ...prev, initials: event.target.value }))} placeholder="Initials" />
          </div>
        </div>

        {selectedTask ? <div className="callout">Task summary: {selectedTask.description}</div> : null}

        <button
          className="btn btn-primary top-gap"
          onClick={() => {
            if (!form.date || !form.taskId || !form.hours) return
            onAddLog({
              id: `${form.taskId}-${Date.now()}`,
              date: form.date,
              technician: form.technician,
              taskId: String(form.taskId),
              taskSummary: selectedTask?.item || selectedTask?.description || '',
              hours: Number(form.hours),
              notes: form.notes,
              initials: form.initials,
            })
            setForm((prev) => ({
              date: getTodayIso(),
              technician: prev.technician,
              taskId: '',
              hours: '',
              notes: '',
              initials: '',
            }))
          }}
        >
          Add log entry
        </button>
      </div>

      <div className="stack-md">
        {logs.length ? [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((log) => (
          <div key={log.id} className="card log-card">
            <div className="log-top">
              <div>
                <div className="log-title">{formatDisplayDate(log.date)} · #{log.taskId || '—'} {log.taskSummary || 'Unlinked task'}</div>
                <div className="muted">{log.notes || 'No notes entered.'}</div>
              </div>
              <button className="btn btn-danger" onClick={() => onDeleteLog(log.id)}>Delete</button>
            </div>
            <div className="badge-row top-gap-sm">
              <span className="badge priority-low">{log.technician || 'No technician'}</span>
              <span className="badge priority-low">{Number(log.hours || 0).toFixed(1)} hrs</span>
              {log.initials ? <span className="badge priority-low">Initials: {log.initials}</span> : null}
            </div>
          </div>
        )) : <div className="card empty-card">No daily log entries yet.</div>}
      </div>
    </div>
  )
}

function ProjectTab({ projectDetails, notes, setNotes, sourceName }) {
  return (
    <div className="stack-lg">
      <SectionTitle title="Project Details" right={<div className="badge priority-low">Source: {sourceName}</div>} />

      <div className="project-grid">
        <div className="card stack-sm">
          {projectDetails.map((detail) => (
            <div key={detail.label} className="mini-card">
              <div className="field-label">{detail.label}</div>
              <div>{detail.value || '—'}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <label className="field-label">General Notes / Preconditions</label>
          <textarea className="field textarea tall" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="muted top-gap-sm">
            This app is local-first and mobile-friendly. It is built to make field updates easy, not to cosplay as a perfect Excel sync engine.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const fallback = useMemo(() => createFallbackData(), [])
  const [sourceName, setSourceName] = useState(fallback.sourceName)
  const [projectDetails, setProjectDetails] = useState(fallback.projectDetails)
  const [notes, setNotes] = useState(fallback.notes)
  const [baseTasks, setBaseTasks] = useState(fallback.tasks)
  const [dailyLogs, setDailyLogs] = useState(fallback.dailyLogs)
  const [tab, setTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')

  useEffect(() => {
    const saved = localStorage.getItem('pbe-sow-mobile-state')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSourceName(parsed.sourceName || fallback.sourceName)
        setProjectDetails(parsed.projectDetails || fallback.projectDetails)
        setNotes(parsed.notes ?? fallback.notes)
        setBaseTasks(parsed.baseTasks || fallback.tasks)
        setDailyLogs(parsed.dailyLogs || fallback.dailyLogs)
        return
      } catch {
        // ignore bad local state
      }
    }

    loadBundledWorkbook()
  }, [])

  useEffect(() => {
    localStorage.setItem(
      'pbe-sow-mobile-state',
      JSON.stringify({ sourceName, projectDetails, notes, baseTasks, dailyLogs })
    )
  }, [sourceName, projectDetails, notes, baseTasks, dailyLogs])

  async function loadBundledWorkbook() {
    try {
      const response = await fetch('/sample/sample-data.json')
      if (!response.ok) throw new Error('sample json missing')
      const parsed = await response.json()
      setSourceName(parsed.sourceName || 'PBE SOW CSS092 filled.xlsx')
      setProjectDetails(parsed.projectDetails || fallback.projectDetails)
      setNotes(parsed.notes ?? fallback.notes)
      setBaseTasks(parsed.tasks || fallback.tasks)
      setDailyLogs(parsed.dailyLogs || fallback.dailyLogs)
    } catch {
      try {
        const response = await fetch('/sample/PBE SOW CSS092 filled.xlsx')
        if (!response.ok) return
        const buffer = await response.arrayBuffer()
        const parsed = await parseWorkbook(buffer, 'PBE SOW CSS092 filled.xlsx')
        setSourceName(parsed.sourceName)
        setProjectDetails(parsed.projectDetails)
        setNotes(parsed.notes)
        setBaseTasks(parsed.tasks)
        setDailyLogs(parsed.dailyLogs)
      } catch {
        // stay on fallback
      }
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    const parsed = await parseWorkbook(buffer, file.name)
    setSourceName(parsed.sourceName)
    setProjectDetails(parsed.projectDetails)
    setNotes(parsed.notes)
    setBaseTasks(parsed.tasks)
    setDailyLogs(parsed.dailyLogs)
    setTab('dashboard')
    event.target.value = ''
  }

  const tasks = useMemo(() => {
    const hourMap = {}
    for (const log of dailyLogs) {
      const key = String(log.taskId || '')
      hourMap[key] = (hourMap[key] || 0) + Number(log.hours || 0)
    }

    return baseTasks.map((task) => ({
      ...task,
      actualHours: Number(hourMap[String(task.id)] || task.actualHours || 0),
    }))
  }, [baseTasks, dailyLogs])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const haystack = `${task.item} ${task.description} ${task.assignedTo}`.toLowerCase()
      const matchesSearch = haystack.includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'All' || task.status === statusFilter
      const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [tasks, search, statusFilter, priorityFilter])

  const statusData = useMemo(() => STATUS_OPTIONS.map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  })), [tasks])

  function updateTask(taskId, patch) {
    setBaseTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...patch } : task))
  }

  function exportJson() {
    const slug = (projectDetails.find((detail) => detail.label === 'Project')?.value || 'sow').replace(/\s+/g, '-').toLowerCase()
    const payload = JSON.stringify({ sourceName, projectDetails, notes, tasks, dailyLogs }, null, 2)
    downloadTextFile(`${slug}-mobile-export.json`, payload, 'application/json;charset=utf-8')
  }

  function exportCsv() {
    const slug = (projectDetails.find((detail) => detail.label === 'Project')?.value || 'sow').replace(/\s+/g, '-').toLowerCase()
    const rows = [
      ['ID', 'Item', 'Task / Scope Description', 'Discipline', 'Priority', 'Dependencies / Permits', 'Acceptance Criteria / Tests', 'Assigned To', 'Status', '% Complete', 'Planned Start', 'Planned Finish', 'Actual Hours', 'Completion Evidence'],
      ...tasks.map((task) => [
        task.id,
        task.item,
        task.description,
        task.discipline,
        task.priority,
        task.dependencies,
        task.acceptance,
        task.assignedTo,
        task.status,
        task.percentComplete,
        task.plannedStart,
        task.plannedFinish,
        task.actualHours,
        task.evidence,
      ]),
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
    downloadTextFile(`${slug}-tasks.csv`, csv, 'text/csv;charset=utf-8')
  }

  function resetApp() {
    localStorage.removeItem('pbe-sow-mobile-state')
    setSourceName(fallback.sourceName)
    setProjectDetails(fallback.projectDetails)
    setNotes(fallback.notes)
    setBaseTasks(fallback.tasks)
    setDailyLogs(fallback.dailyLogs)
    setSearch('')
    setStatusFilter('All')
    setPriorityFilter('All')
    setTab('dashboard')
    loadBundledWorkbook()
  }

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'tasks', label: 'Tasks', icon: ClipboardList },
    { key: 'log', label: 'Daily Log', icon: NotebookPen },
    { key: 'project', label: 'Project', icon: Info },
  ]

  const projectCode = projectDetails.find((detail) => detail.label === 'Project')?.value || 'Scope of Works'

  return (
    <div className="app-shell">
      <div className="container">
        <TopHeader
          title={`${projectCode} · Technician Scope of Works`}
          subtitle={`${tasks.length} tasks · ${sourceName}`}
        />

        <div className="top-gap">
          <Toolbar
            onImport={handleImport}
            onExportJson={exportJson}
            onExportCsv={exportCsv}
            onReset={resetApp}
            onLoadBundled={loadBundledWorkbook}
          />
        </div>

        <div className="page-body">
          {tab === 'dashboard' ? <DashboardTab tasks={tasks} statusData={statusData} /> : null}
          {tab === 'tasks' ? (
            <TasksTab
              tasks={filteredTasks}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              onUpdateTask={updateTask}
            />
          ) : null}
          {tab === 'log' ? (
            <DailyLogTab
              tasks={tasks}
              logs={dailyLogs}
              onAddLog={(log) => setDailyLogs((current) => [log, ...current])}
              onDeleteLog={(logId) => setDailyLogs((current) => current.filter((log) => log.id !== logId))}
            />
          ) : null}
          {tab === 'project' ? (
            <ProjectTab projectDetails={projectDetails} notes={notes} setNotes={setNotes} sourceName={sourceName} />
          ) : null}
        </div>
      </div>

      <nav className="bottom-nav">
        {tabs.map((item) => {
          const Icon = item.icon
          const active = tab === item.key
          return (
            <button
              key={item.key}
              className={`nav-btn ${active ? 'nav-btn-active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
