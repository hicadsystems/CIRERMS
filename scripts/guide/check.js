#!/usr/bin/env node
'use strict';

/*
 * npm run guide:check: reads every chapter in docs/manual with the parser the server uses and prints each problem
 * (a mistake in the format, a slug used twice, a link or a `needs` that names nothing, a picture without its spec),
 * and the pictures that are missing or stale. Exit 1 when there is a problem.
 */
const lib = require('./lib');

const { chapters, problems } = lib.store.get();
const old = [];
chapters.forEach((c) => Object.values(c.shots).forEach((spec) => { if (lib.isStale(c.slug, spec)) old.push(`${c.slug}/${spec.id}`); }));
const sections = chapters.reduce((n, c) => n + c.sections.length, 0);
const tasks = chapters.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.tasks.length, 0), 0);
const shots = chapters.reduce((n, c) => n + Object.keys(c.shots).length, 0);
console.log(`guide:check: ${chapters.length} chapters, ${sections} sections, ${tasks} tasks, ${shots} pictures`);
if (old.length) console.log(`  ${old.length} picture(s) to take or retake (npm run guide:shots -- --stale): ${old.join(', ')}`);
if (problems.length) { console.error(`  ${problems.length} problem(s):\n  ${problems.join('\n  ')}`); process.exit(1); }
