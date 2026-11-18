/*
 * html: the small DOM helpers every component uses.
 *
 *   h(tag, attrs, children)   build an element (attrs: className, text, dataset, onClick ...; children: nodes, strings, arrays)
 *   toNodes(content)          a node, a string (as text), or an array of them -> array of nodes
 *   cx(...parts)              join class names, skipping empty ones
 *
 * Strings are always text, never HTML, so data from the API cannot inject markup.
 * core/dom.js re-exports h as el, so older screens share it.
 */

export function cx(...parts) {
  return parts.flat().filter(Boolean).join(' ');
}

export function toNodes(content) {
  if (content === null || content === undefined || content === false) return [];
  if (Array.isArray(content)) return content.flatMap(toNodes);
  if (content instanceof Node) return [content];
  return [document.createTextNode(String(content))];
}

export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val === undefined || val === null || val === false) continue;
    if (key === 'className') node.className = val;
    else if (key === 'text') node.textContent = String(val);
    else if (key === 'dataset' && typeof val === 'object') {
      for (const [dk, dv] of Object.entries(val)) if (dv !== undefined && dv !== null) node.dataset[dk] = String(dv);
    } else if (key.startsWith('on') && typeof val === 'function') node.addEventListener(key.slice(2).toLowerCase(), val);
    else if (val === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(val));
  }
  for (const child of toNodes(children)) node.appendChild(child);
  return node;
}

/** Replaces an element's children with `content` (see toNodes). */
export function fill(node, content) {
  node.replaceChildren(...toNodes(content));
  return node;
}
