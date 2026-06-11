const STORAGE_KEY = 'ava:global_jobs:v1'

export function getGlobalJobs() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGlobalJobs(jobs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(jobs) ? jobs : []))
    window.dispatchEvent(new CustomEvent('ava:global-jobs-changed'))
  } catch {}
}

export function upsertGlobalJob(job) {
  if (!job?.id) return null
  const jobs = getGlobalJobs()
  const now = new Date().toISOString()
  const index = jobs.findIndex((item) => item.id === job.id)
  const nextJob = {
    ...(index >= 0 ? jobs[index] : {}),
    ...job,
    updatedAt: now,
    createdAt: job.createdAt || (index >= 0 ? jobs[index].createdAt : now),
  }
  if (index >= 0) jobs[index] = nextJob
  else jobs.unshift(nextJob)
  saveGlobalJobs(jobs.slice(0, 30))
  return nextJob
}

export function markGlobalJobNotified(id) {
  if (!id) return
  saveGlobalJobs(getGlobalJobs().map((job) => (
    job.id === id ? { ...job, notified: true, updatedAt: new Date().toISOString() } : job
  )))
}

export function pickLatestGeneratorJob() {
  return getGlobalJobs()
    .filter((job) => job.source === 'standalone_generator')
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] || null
}

export function isDoneStatus(status = '') {
  const s = String(status || '').toLowerCase()
  return ['completed', 'done', 'ready', 'success'].some((x) => s.includes(x))
}

export function isFailedStatus(status = '') {
  const s = String(status || '').toLowerCase()
  return ['failed', 'error', 'blocked', 'missing', 'not_found', 'canceled', 'cancelled', 'cancel_requested'].some((x) => s.includes(x))
}

export function pickVideoUrl(data = {}) {
  return (
    data.videoUrl ||
    data.video_url ||
    data.outputVideoUrl ||
    data.output_video_url ||
    data.resultVideoUrl ||
    data.result_video_url ||
    data.videoApiPath ||
    data.video_api_path ||
    data.output_url ||
    data.outputUrl ||
    ''
  )
}
