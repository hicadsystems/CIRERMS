'use strict';

/* The handbook as HTML for the docs-book template: every word escaped, links inside the book kept as links. */

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A place a long path may break: after a slash, never in the middle of a word. */
const breakable = (s) => esc(s).replace(/\//g, '/<wbr>');

/** The level of a Markdown heading inside the book: the intro's headings sit one level up from the other files'. */
const levelOf = (file, depth) => Math.min(5, file.isIntro ? depth : depth + 1);

function inl(nodes) {
  return nodes.map((n) => {
    if (n.t === 'text') return esc(n.v);
    if (n.t === 'code') return `<code>${breakable(n.v)}</code>`;
    if (n.t === 'strong') return `<b>${inl(n.c)}</b>`;
    if (n.t === 'em') return `<i>${inl(n.c)}</i>`;
    if (n.t === 'br') return '<br>';
    if (n.t === 'link') {
      if (n.to.kind === 'internal') return `<a class="xref" href="#${n.to.id}">${inl(n.c)}</a>`;
      if (n.to.kind === 'external') return `${inl(n.c)} <span class="url">(${esc(n.to.url)})</span>`;
      return inl(n.c);
    }
    return '';
  }).join('');
}

function blocksHtml(file, bs) {
  return bs.map((b) => {
    if (b.k === 'h') { const l = levelOf(file, b.level); return `<h${l} id="${b.id}" class="bk-h bk-h${l}">${inl(b.c)}</h${l}>`; }
    if (b.k === 'p') return `<p>${inl(b.c)}</p>`;
    if (b.k === 'hr') return '<hr>';
    if (b.k === 'note') return `<div class="bk-note">${blocksHtml(file, b.b)}</div>`;
    if (b.k === 'code') {
      const lines = b.text.split('\n').length;
      return `<pre class="bk-code${lines <= 22 ? ' keep' : ''}"${b.lang ? ` data-lang="${esc(b.lang)}"` : ''}><code>${esc(b.text.replace(/\t/g, '  '))}</code></pre>`;
    }
    if (b.k === 'list') {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag} class="bk-list"${b.ordered && b.start !== 1 ? ` start="${b.start}"` : ''}>${b.items.map((i) => `<li>${blocksHtml(file, i)}</li>`).join('')}</${tag}>`;
    }
    if (b.k === 'table') {
      const cols = b.head.length;
      const cls = cols >= 5 ? 'dense' : cols >= 4 ? 'mid' : '';
      const al = (i) => (b.align[i] ? ` style="text-align:${b.align[i]}"` : '');
      return `<table class="data bk-table ${cls}" data-cols="${cols}"><thead><tr>${b.head.map((c, i) => `<th${al(i)}>${inl(c)}</th>`).join('')}</tr></thead>`
        + `<tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => `<td${al(i)}>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    return '';
  }).join('\n');
}

/** What the template reads. toc: every part, file and level 2 heading, with the ids the pages are looked up by. */
function bookData(model, cover) {
  const toc = [];
  const fileData = (file) => {
    toc.push({ id: file.id, level: file.isIntro ? 1 : 2, title: file.title, page: '' });
    return { id: file.id, title: file.title, isIntro: !!file.isIntro, html: blocksHtml(file, file.blocks), source: file.path };
  };
  const addH2 = (file) => {
    const level = file.isIntro ? 2 : 3;
    file.blocks.filter((b) => b.k === 'h' && b.level === 2).forEach((b) => toc.push({ id: b.id, level, title: b.text, page: '' }));
  };
  const intro = (() => {
    toc.push({ id: 'intro', level: 1, title: model.intro.title, page: '' });
    const d = { id: 'intro', title: model.intro.title, html: blocksHtml(model.intro, model.intro.blocks) };
    addH2(model.intro);
    return d;
  })();
  const parts = model.parts.map((p) => {
    toc.push({ id: p.id, level: 1, title: `Part ${p.n}: ${p.title}`, page: '' });
    const files = p.files.map((f) => { const d = fileData(f); addH2(f); return d; });
    return { id: p.id, n: p.n, title: p.title, blurb: p.blurb, files: files.map((f) => ({ id: f.id, title: f.title })), body: files, source: p.dir };
  });
  return { title: 'Technical Handbook', cover, intro, parts, toc };
}

module.exports = { bookData, levelOf, esc };
