// AVA_TEXT_EDITOR_GUARD_V70
// Keeps text editing local to the focused editor and restores the caret after
// React-controlled rerenders of input, textarea and contentEditable fields.

const AVA_EDITABLE_SELECTOR = [
  'textarea',
  'input:not([type])',
  'input[type="text"]',
  'input[type="search"]',
  'input[type="email"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input[type="password"]',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="textbox"]',
].join(',')

const attachedEditors = new WeakSet()
let activeEditor = null
let lastGoodSelection = null
let restoreQueued = false
let editorCounter = 0

function isTextEditor(element) {
  return element instanceof Element && element.matches(AVA_EDITABLE_SELECTOR)
}

function findTextEditor(node) {
  if (!(node instanceof Element)) return null
  if (isTextEditor(node)) return node
  return node.closest?.(AVA_EDITABLE_SELECTOR) || null
}

function ensureEditorId(element) {
  if (!element?.dataset) return ''
  if (!element.dataset.avaTextEditorGuardId) {
    editorCounter += 1
    element.dataset.avaTextEditorGuardId = `ava-editor-${editorCounter}`
  }
  return element.dataset.avaTextEditorGuardId
}

function captureContentEditableSelection(element) {
  const selection = window.getSelection?.()
  if (!selection || selection.rangeCount < 1) return null
  const range = selection.getRangeAt(0)
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null

  const beforeStart = range.cloneRange()
  beforeStart.selectNodeContents(element)
  beforeStart.setEnd(range.startContainer, range.startOffset)

  const beforeEnd = range.cloneRange()
  beforeEnd.selectNodeContents(element)
  beforeEnd.setEnd(range.endContainer, range.endOffset)

  return {
    kind: 'contenteditable',
    start: beforeStart.toString().length,
    end: beforeEnd.toString().length,
  }
}

function captureSelection(element) {
  if (!element || !element.isConnected) return null
  let selection = null

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const start = Number(element.selectionStart)
    const end = Number(element.selectionEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    selection = {
      kind: 'control',
      start,
      end,
      direction: element.selectionDirection || 'none',
    }
  } else {
    selection = captureContentEditableSelection(element)
  }

  if (!selection) return null
  return {
    ...selection,
    editorId: ensureEditorId(element),
    capturedAt: performance.now(),
  }
}

function textNodeAtOffset(element, requestedOffset) {
  const targetOffset = Math.max(0, Number(requestedOffset) || 0)
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  let consumed = 0
  let lastTextNode = null

  while (node) {
    lastTextNode = node
    const length = node.nodeValue?.length || 0
    if (targetOffset <= consumed + length) {
      return { node, offset: Math.max(0, Math.min(length, targetOffset - consumed)) }
    }
    consumed += length
    node = walker.nextNode()
  }

  if (lastTextNode) return { node: lastTextNode, offset: lastTextNode.nodeValue?.length || 0 }
  return { node: element, offset: 0 }
}

function restoreContentEditableSelection(element, snapshot) {
  const selection = window.getSelection?.()
  if (!selection) return
  const start = textNodeAtOffset(element, snapshot.start)
  const end = textNodeAtOffset(element, snapshot.end)
  const range = document.createRange()

  try {
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    selection.removeAllRanges()
    selection.addRange(range)
  } catch {
    // A concurrent render may replace a text node between lookup and restore.
  }
}

function resolveEditor(snapshot) {
  if (activeEditor?.isConnected) return activeEditor
  if (!snapshot?.editorId) return null
  return document.querySelector(
    `[data-ava-text-editor-guard-id="${CSS.escape(snapshot.editorId)}"]`,
  )
}

function restoreSelection(snapshot = lastGoodSelection) {
  if (!snapshot || performance.now() - snapshot.capturedAt > 750) return
  const element = resolveEditor(snapshot)
  if (!element || !element.isConnected) return

  const focused = document.activeElement
  if (focused !== element && !element.contains(focused)) return

  if (snapshot.kind === 'control') {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return
    const length = String(element.value ?? '').length
    const start = Math.max(0, Math.min(length, snapshot.start))
    const end = Math.max(start, Math.min(length, snapshot.end))
    try {
      element.setSelectionRange(start, end, snapshot.direction || 'none')
    } catch {
      // Unsupported input type.
    }
    return
  }

  restoreContentEditableSelection(element, snapshot)
}

function queueSelectionRestore(snapshot = lastGoodSelection) {
  if (!snapshot) return
  lastGoodSelection = snapshot
  if (restoreQueued) return
  restoreQueued = true

  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreQueued = false
        restoreSelection(lastGoodSelection)
      })
    })
  })
}

function shouldContainTextKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  const key = String(event.key || '')
  return (
    key.length === 1 ||
    key === 'Shift' ||
    key === 'Backspace' ||
    key === 'Delete' ||
    key === 'Home' ||
    key === 'End' ||
    key === 'PageUp' ||
    key === 'PageDown' ||
    key.startsWith('Arrow')
  )
}

function containEditorKeyboardEvent(event) {
  if (!shouldContainTextKey(event)) return
  // Preserve the browser edit itself; only block page/timeline/card shortcuts.
  event.stopPropagation()
}

function attachEditor(element) {
  if (!element || attachedEditors.has(element)) return
  attachedEditors.add(element)
  ensureEditorId(element)

  element.addEventListener('keydown', containEditorKeyboardEvent)
  element.addEventListener('keyup', containEditorKeyboardEvent)
  element.addEventListener('keypress', containEditorKeyboardEvent)

  element.addEventListener('beforeinput', () => {
    const snapshot = captureSelection(element)
    if (snapshot) lastGoodSelection = snapshot
  })

  element.addEventListener('input', () => {
    // At target/input time the browser still has the correct caret. React may
    // move it while committing controlled state, so remember and restore it.
    const snapshot = captureSelection(element)
    if (snapshot) queueSelectionRestore(snapshot)
  })

  element.addEventListener('compositionend', () => {
    const snapshot = captureSelection(element)
    if (snapshot) queueSelectionRestore(snapshot)
  })
}

function activateEditor(element) {
  activeEditor = element
  attachEditor(element)
  const snapshot = captureSelection(element)
  if (snapshot) lastGoodSelection = snapshot
}

document.addEventListener('focusin', (event) => {
  const editor = findTextEditor(event.target)
  if (editor) activateEditor(editor)
}, true)

document.addEventListener('selectionchange', () => {
  if (!activeEditor?.isConnected) return
  const focused = document.activeElement
  if (focused !== activeEditor && !activeEditor.contains(focused)) return
  const snapshot = captureSelection(activeEditor)
  if (snapshot) lastGoodSelection = snapshot
}, true)

document.addEventListener('focusout', () => {
  window.setTimeout(() => {
    const next = findTextEditor(document.activeElement)
    if (next) {
      activateEditor(next)
      return
    }
    activeEditor = null
    lastGoodSelection = null
  }, 0)
}, true)

const mutationObserver = new MutationObserver(() => {
  if (!activeEditor || !lastGoodSelection) return
  queueSelectionRestore(lastGoodSelection)
})

mutationObserver.observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
})

document.querySelectorAll(AVA_EDITABLE_SELECTOR).forEach(attachEditor)
