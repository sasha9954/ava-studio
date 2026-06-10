// AVA_PROJECT_UNIQUE_COLOR_V77
// Project colors must help separate active work.
// If backend gives duplicate theme_index values, we ignore them and assign
// colors by stable creation order. The same theme is also exported as CSS vars
// for active project highlighting throughout the app.

const PROJECT_THEMES = [
  { name: 'mint', accent: '#2affc4', accent2: '#45d8ff', glow: 'rgba(42, 255, 196, .26)' },
  { name: 'gold', accent: '#ffcf5a', accent2: '#ff7a45', glow: 'rgba(255, 207, 90, .26)' },
  { name: 'violet', accent: '#a78bfa', accent2: '#45d8ff', glow: 'rgba(167, 139, 250, .28)' },
  { name: 'rose', accent: '#ff7ad9', accent2: '#8f7cff', glow: 'rgba(255, 122, 217, .24)' },
  { name: 'sky', accent: '#45d8ff', accent2: '#5eead4', glow: 'rgba(69, 216, 255, .24)' },
  { name: 'lime', accent: '#b8ff5a', accent2: '#2affc4', glow: 'rgba(184, 255, 90, .22)' },
  { name: 'orange', accent: '#ff9f45', accent2: '#ffd166', glow: 'rgba(255, 159, 69, .24)' },
  { name: 'blue', accent: '#6ea8ff', accent2: '#8f7cff', glow: 'rgba(110, 168, 255, .24)' },
  { name: 'red', accent: '#ff5a5f', accent2: '#ffb86b', glow: 'rgba(255, 90, 95, .24)' },
  { name: 'cyan', accent: '#22d3ee', accent2: '#818cf8', glow: 'rgba(34, 211, 238, .24)' },
]

function hashText(value = '') {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function numberOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function projectTime(project = {}) {
  const raw = project.created_at || project.createdAt || project.created || project.updated_at || project.updatedAt || ''
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortedProjectsForTheme(projects = []) {
  return [...(Array.isArray(projects) ? projects : [])].sort((a, b) => {
    const at = projectTime(a)
    const bt = projectTime(b)
    if (at !== bt) return at - bt
    return String(a?.id || a?.name || '').localeCompare(String(b?.id || b?.name || ''))
  })
}

function projectListIndex(project, projects = []) {
  if (!project) return -1
  const sorted = sortedProjectsForTheme(projects)
  return sorted.findIndex((item) => String(item?.id || '') === String(project?.id || ''))
}

function hasDuplicateThemeIndex(project, projects = []) {
  const current = numberOrNull(project?.theme_index ?? project?.themeIndex)
  if (current === null) return false
  const matches = (Array.isArray(projects) ? projects : []).filter((item) => {
    const other = numberOrNull(item?.theme_index ?? item?.themeIndex)
    return other !== null && other === current
  })
  return matches.length > 1
}

function resolveProjectThemeIndex(project, projects = []) {
  if (!project) return -1

  const explicit = numberOrNull(project.theme_index ?? project.themeIndex)
  if (explicit !== null && !hasDuplicateThemeIndex(project, projects)) {
    return explicit
  }

  const orderedIndex = projectListIndex(project, projects)
  if (orderedIndex >= 0) return orderedIndex

  return hashText(project.id || project.name || '')
}

export function getProjectTheme(project, projects = []) {
  if (!project) {
    return {
      name: 'workspace',
      accent: '#45d8ff',
      accent2: '#8f7cff',
      glow: 'rgba(69, 216, 255, .18)',
      index: -1,
      style: {},
    }
  }

  const index = resolveProjectThemeIndex(project, projects)
  const theme = PROJECT_THEMES[Math.abs(index) % PROJECT_THEMES.length]

  return {
    ...theme,
    index,
    style: {
      '--ava-project-accent': theme.accent,
      '--ava-project-accent-2': theme.accent2,
      '--ava-project-glow': theme.glow,
      '--ava-active-accent': theme.accent,
      '--ava-active-accent-2': theme.accent2,
      '--ava-active-glow': theme.glow,
      '--primary': theme.accent,
      '--primary-2': theme.accent2,
      '--accent': theme.accent,
    },
  }
}

export function getProjectCardStyle(project, projects = []) {
  return getProjectTheme(project, projects).style
}
