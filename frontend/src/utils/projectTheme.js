const PROJECT_THEMES = [
  { name: 'mint', accent: '#2affc4', accent2: '#45d8ff', glow: 'rgba(42, 255, 196, .26)' },
  { name: 'gold', accent: '#ffcf5a', accent2: '#ff7a45', glow: 'rgba(255, 207, 90, .26)' },
  { name: 'violet', accent: '#a78bfa', accent2: '#45d8ff', glow: 'rgba(167, 139, 250, .28)' },
  { name: 'rose', accent: '#ff7ad9', accent2: '#8f7cff', glow: 'rgba(255, 122, 217, .24)' },
  { name: 'sky', accent: '#45d8ff', accent2: '#5eead4', glow: 'rgba(69, 216, 255, .24)' },
  { name: 'lime', accent: '#b8ff5a', accent2: '#2affc4', glow: 'rgba(184, 255, 90, .22)' },
  { name: 'orange', accent: '#ff9f45', accent2: '#ffd166', glow: 'rgba(255, 159, 69, .24)' },
  { name: 'blue', accent: '#6ea8ff', accent2: '#8f7cff', glow: 'rgba(110, 168, 255, .24)' },
]

function hashText(value = '') {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
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

  const listIndex = projects.findIndex((item) => item.id === project.id)
  const index = listIndex >= 0 ? listIndex : hashText(project.id || project.name) % PROJECT_THEMES.length
  const theme = PROJECT_THEMES[index % PROJECT_THEMES.length]

  return {
    ...theme,
    index,
    style: {
      '--ava-project-accent': theme.accent,
      '--ava-project-accent-2': theme.accent2,
      '--ava-project-glow': theme.glow,
    },
  }
}

export function getProjectCardStyle(project, projects = []) {
  return getProjectTheme(project, projects).style
}
