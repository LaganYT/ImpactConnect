// Simple rehype plugin to convert Discord-style spoilers `||text||` into
// <span class="spoiler">text</span> elements. Skips inside <code> and <pre>.

type HastNode = {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

function isElement(node: HastNode): node is HastNode & { tagName: string; children: HastNode[] } {
  return node && node.type === 'element' && typeof node.tagName === 'string'
}

function isText(node: HastNode): node is HastNode & { value: string } {
  return node && node.type === 'text' && typeof node.value === 'string'
}

function splitIntoSpoilerNodes(text: string): { nodes: HastNode[]; transformed: boolean } {
  let open = false
  let buffer = ''
  let transformed = false
  const out: HastNode[] = []

  // Fast check: must contain at least two pairs of | in sequence
  if (!text.includes('||')) {
    return { nodes: [{ type: 'text', value: text }], transformed: false }
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '|' && next === '|') {
      // toggle spoiler state
      if (open) {
        // closing: flush buffer as spoiler
        const content = buffer
        buffer = ''
        out.push({
          type: 'element',
          tagName: 'span',
          properties: { className: ['spoiler'] },
          children: [{ type: 'text', value: content }],
        })
        transformed = true
      } else {
        // opening: flush preceding as plain text
        if (buffer) out.push({ type: 'text', value: buffer })
        buffer = ''
      }
      open = !open
      i++ // skip second pipe
      continue
    }
    buffer += ch
  }

  if (open) {
    // Unbalanced markers; abort transform and return original text
    return { nodes: [{ type: 'text', value: text }], transformed: false }
  }

  if (buffer) out.push({ type: 'text', value: buffer })
  return { nodes: out, transformed }
}

export default function rehypeSpoiler() {
  return function transformer(tree: HastNode) {
    function visit(node: HastNode, ancestors: HastNode[]) {
      if (isElement(node)) {
        // Skip inside code and pre elements
        const parentIsCodeLike = node.tagName === 'code' || node.tagName === 'pre'
        if (parentIsCodeLike) return

        if (Array.isArray(node.children)) {
          // Process children in place, allowing replacement when needed
          for (let idx = 0; idx < node.children.length; idx++) {
            const child = node.children[idx]
            if (isText(child)) {
              const { nodes, transformed } = splitIntoSpoilerNodes(child.value)
              if (transformed) {
                // Replace the single text node with many nodes
                node.children.splice(idx, 1, ...nodes)
                idx += nodes.length - 1
                continue
              }
            }
            visit(child, ancestors.concat(node))
          }
        }
      }
    }

    visit(tree, [])
  }
}


