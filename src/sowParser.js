export const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Complete', 'On Hold', 'Blocked']
export const PRIORITY_OPTIONS = ['P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low']

function parseDate(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const millis = value * 24 * 60 * 60 * 1000
    const converted = new Date(excelEpoch.getTime() + millis)
    if (!Number.isNaN(converted.getTime())) return converted.toISOString().slice(0, 10)
  }
  const raw = String(value).trim()
  if (!raw) return ''

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  return ''
}

function getRowValues(sheet, xlsx) {
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })
}

function findSheetByHeader(workbook, xlsx, matcher) {
  return workbook.SheetNames.find((name) => {
    const rows = getRowValues(workbook.Sheets[name], xlsx)
    return rows.some((row) => matcher(row.map((cell) => String(cell || '').trim())))
  })
}

function findHeaderRow(rows, requiredHeaders) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i].map((cell) => String(cell || '').trim())
    if (requiredHeaders.every((header) => row.includes(header))) return i
  }
  return -1
}

function getStatusPercent(status) {
  if (status === 'Complete') return 100
  if (status === 'In Progress') return 50
  return 0
}

function normaliseTask(row, headerIndex) {
  const cell = (name) => row[headerIndex[name]]
  const status = String(cell('Status') || 'Not Started').trim() || 'Not Started'

  return {
    id: Number(cell('ID')) || undefined,
    item: String(cell('Item') || '').trim(),
    description: String(cell('Task / Scope Description') || '').trim(),
    discipline: String(cell('Discipline') || '').trim(),
    priority: String(cell('Priority') || '').trim(),
    dependencies: String(cell('Dependencies / Permits') || '').trim(),
    acceptance: String(cell('Acceptance Criteria / Tests') || '').trim(),
    assignedTo: String(cell('Assigned To') || '').trim(),
    status,
    percentComplete:
      typeof cell('% Complete') === 'number'
        ? Math.round(cell('% Complete'))
        : getStatusPercent(status),
    plannedStart: parseDate(cell('Planned Start')),
    plannedFinish: parseDate(cell('Planned Finish')),
    overdue: String(cell('Overdue') || '').trim(),
    actualHours: Number(cell('Actual Hours (from Log)') || 0),
    evidence: String(cell('Completion Evidence') || '').trim(),
  }
}

function normaliseLog(row, headerIndex) {
  const cell = (name) => row[headerIndex[name]]
  return {
    id: `${cell('Task ID') || 'log'}-${parseDate(cell('Date')) || 'undated'}-${Math.random().toString(36).slice(2, 8)}`,
    date: parseDate(cell('Date')),
    technician: String(cell('Technician') || '').trim(),
    taskId: String(cell('Task ID') || '').trim(),
    taskSummary: String(cell('Task Summary') || '').trim(),
    hours: Number(cell('Hours') || 0),
    notes: String(cell('Work Performed / Notes') || '').trim(),
    initials: String(cell('Client/PM Initials') || '').trim(),
  }
}

export function createFallbackData() {
  return {
    sourceName: 'PBE SOW CSS092 filled.xlsx',
    projectDetails: [
      { label: 'Project', value: 'CSS092' },
      { label: 'Client', value: 'T2D' },
      { label: 'Site / Location', value: 'Adelaide, Waterloo' },
      { label: 'Work Order / Ref', value: '' },
      { label: 'Prepared By', value: 'Chris H' },
      { label: 'Prepared Date', value: '2026-03-16' },
      { label: 'Revision', value: '1' },
    ],
    notes:
      '• All works to comply with site WHS, isolation/LOTO and permit requirements.\n• Technician to confirm latest drawings/approved configuration before modifications.\n• Record pre-works condition with photos; record any as-found defects as notes/NCRs.\n• Provide completion evidence: photos, test results (where applicable), and sign-off.',
    tasks: [],
    dailyLogs: [],
  }
}

export async function parseWorkbook(arrayBuffer, sourceName = 'Imported workbook') {
  const xlsx = await import('xlsx')
  const workbook = xlsx.read(arrayBuffer, { type: 'array', cellDates: true })

  const taskSheetName =
    findSheetByHeader(workbook, xlsx, (row) =>
      row.includes('Task / Scope Description') && row.includes('Assigned To') && row.includes('Status')
    ) || workbook.SheetNames[0]

  const logSheetName =
    findSheetByHeader(workbook, xlsx, (row) => row.includes('Task ID') && row.includes('Work Performed / Notes')) ||
    workbook.SheetNames.find((name) => name.toLowerCase().includes('daily'))

  const taskRows = getRowValues(workbook.Sheets[taskSheetName], xlsx)
  const logRows = logSheetName ? getRowValues(workbook.Sheets[logSheetName], xlsx) : []

  const taskHeaderRow = findHeaderRow(taskRows, [
    'ID',
    'Item',
    'Task / Scope Description',
    'Assigned To',
    'Status',
    '% Complete',
  ])

  const logHeaderRow = findHeaderRow(logRows, ['Date', 'Technician', 'Task ID', 'Hours', 'Work Performed / Notes'])

  const fallback = createFallbackData()
  const projectDetails = []
  const detailLabels = ['Project', 'Client', 'Site / Location', 'Work Order / Ref', 'Prepared By', 'Prepared Date', 'Revision']

  if (taskHeaderRow > 0) {
    for (let i = Math.max(0, taskHeaderRow - 7); i < taskHeaderRow; i += 1) {
      const row = taskRows[i] || []
      const label = String(row[0] || '').trim()
      if (detailLabels.includes(label)) {
        projectDetails.push({
          label,
          value: parseDate(row[1]) || String(row[1] || '').trim(),
        })
      }
    }
  }

  let notes = ''
  for (let i = 0; i < Math.min(taskRows.length, 12); i += 1) {
    const row = taskRows[i] || []
    if (String(row[0] || '').trim() === 'Project Details') notes = String(row[2] || '').trim()
  }

  const taskHeader = taskRows[taskHeaderRow] || []
  const taskIndex = Object.fromEntries(taskHeader.map((name, i) => [String(name).trim(), i]))
  const tasks = []

  if (taskHeaderRow >= 0) {
    for (let i = taskHeaderRow + 1; i < taskRows.length; i += 1) {
      const row = taskRows[i]
      const description = row[taskIndex['Task / Scope Description']]
      if (!String(description || '').trim()) continue
      const task = normaliseTask(row, taskIndex)
      task.id = task.id || tasks.length + 1
      tasks.push(task)
    }
  }

  const logHeader = logRows[logHeaderRow] || []
  const logIndex = Object.fromEntries(logHeader.map((name, i) => [String(name).trim(), i]))
  const dailyLogs = []

  if (logHeaderRow >= 0) {
    for (let i = logHeaderRow + 1; i < logRows.length; i += 1) {
      const row = logRows[i]
      const hasAny = row.some((cell) => String(cell || '').trim() !== '')
      if (!hasAny) continue
      const log = normaliseLog(row, logIndex)
      if (!log.date && !log.taskId && !log.notes && !log.hours) continue
      dailyLogs.push(log)
    }
  }

  return {
    sourceName,
    projectDetails: projectDetails.length ? projectDetails : fallback.projectDetails,
    notes: notes || fallback.notes,
    tasks,
    dailyLogs,
  }
}

export function formatDisplayDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getTodayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function isOverdue(task) {
  return Boolean(task.plannedFinish && task.status !== 'Complete' && task.plannedFinish < getTodayIso())
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function escapeCsv(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}
