#!/usr/bin/env node
'use strict';

const fs = require('fs');

const US = '\x1f';

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function decodeEntities(value = '') {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseInfo(filePath) {
  const text = readText(filePath);
  const lines = text.split(/\r?\n/);
  let title = '';
  let spaceKey = '';
  let url = '';

  for (const line of lines) {
    let match;
    if (!title && (match = line.match(/^\s*Title:\s*(.+)\s*$/i))) {
      title = match[1].trim();
    }
    if (!spaceKey && (match = line.match(/^\s*(?:Space Key|SpaceKey):\s*(.+)\s*$/i))) {
      spaceKey = match[1].trim();
    }
    if (!spaceKey && (match = line.match(/^\s*Space:\s*.*\(([^()]+)\)\s*$/i))) {
      spaceKey = match[1].trim();
    }
    if (!url && (match = line.match(/^\s*URL:\s*(.+)\s*$/i))) {
      url = match[1].trim();
    }
  }

  if (!spaceKey && url) {
    let match = url.match(/\/spaces\/([^/?#]+)\//i);
    if (match) spaceKey = match[1].trim();
    if (!spaceKey) {
      match = url.match(/[?&]spaceKey=([^&#]+)/i);
      if (match) spaceKey = decodeURIComponent(match[1]).trim();
    }
  }

  process.stdout.write(`${title}${US}${spaceKey}${US}${url}`);
}

function extractChildren(filePath) {
  const data = JSON.parse(readText(filePath));
  const ids = new Set();

  function walk(value) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }

    if ('id' in value && (('title' in value) || ('url' in value) || ('children' in value))) {
      const id = String(value.id);
      if (/^\d+$/.test(id)) {
        ids.add(id);
      }
    }

    for (const nested of Object.values(value)) {
      walk(nested);
    }
  }

  walk(data);
  for (const id of ids) {
    process.stdout.write(`${id}\n`);
  }
}

function attr(attrs, name) {
  const re = new RegExp(`${name}=(\"([^\"]*)\"|'([^']*)')`);
  const match = attrs.match(re);
  if (!match) return '';
  return decodeEntities(match[2] || match[3] || '');
}

function emitUnique(rows, row) {
  const clean = row.map((x) => String(x || '').replace(/[\r\n\t]+/g, ' ').trim());
  const key = JSON.stringify(clean);
  if (rows.has(key)) return;
  rows.add(key);
  process.stdout.write(`${clean.join(US)}\n`);
}

function extractLinks(filePath, currentSpace) {
  const xml = readText(filePath);
  const rows = new Set();
  let match;

  const contentEntityRe = /<ri:content-entity\b[^>]*ri:content-id="(\d+)"[^>]*\/?>/g;
  while ((match = contentEntityRe.exec(xml))) {
    emitUnique(rows, ['id', match[1]]);
  }

  const pageRe = /<ri:page\b([^>]*)\/?>/g;
  while ((match = pageRe.exec(xml))) {
    const attrs = match[1] || '';
    const contentId = attr(attrs, 'ri:content-id');
    if (contentId) {
      emitUnique(rows, ['id', contentId]);
    }

    const title = attr(attrs, 'ri:content-title').trim();
    if (!title) continue;
    const space = (attr(attrs, 'ri:space-key') || currentSpace || '').trim();
    emitUnique(rows, ['title', space, title]);
  }

  const pageParamRe = /<ac:parameter\b[^>]*ac:name="page"[^>]*>([\s\S]*?)<\/ac:parameter>/g;
  while ((match = pageParamRe.exec(xml))) {
    const raw = decodeEntities(match[1].replace(/<[^>]+>/g, '').trim());
    if (!raw) continue;

    let space = currentSpace || '';
    let title = raw;
    const explicit = raw.match(/^([A-Z0-9_.-]+):(.*)$/);
    if (explicit) {
      space = explicit[1].trim();
      title = explicit[2].trim();
    }
    if (title) {
      emitUnique(rows, ['title', space, title]);
    }
  }

  const hrefRe = /href=(\"([^\"]*)\"|'([^']*)')/g;
  while ((match = hrefRe.exec(xml))) {
    const href = decodeEntities(match[2] || match[3] || '');
    if (!/pageId=\d+/.test(href)) continue;
    if (!/viewpage\.action|\/pages\//i.test(href)) continue;
    const idMatch = href.match(/pageId=(\d+)/);
    if (idMatch) {
      emitUnique(rows, ['id', idMatch[1]]);
    }
  }
}

function die(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function main() {
  const command = process.argv[2];

  if (command === 'parse-info') {
    const filePath = process.argv[3];
    if (!filePath) die('parse-info requires file path');
    parseInfo(filePath);
    return;
  }

  if (command === 'extract-children') {
    const filePath = process.argv[3];
    if (!filePath) die('extract-children requires file path');
    extractChildren(filePath);
    return;
  }

  if (command === 'extract-links') {
    const filePath = process.argv[3];
    const currentSpace = process.argv[4] || '';
    if (!filePath) die('extract-links requires file path');
    extractLinks(filePath, currentSpace);
    return;
  }

  die(`unknown command: ${command || '<empty>'}`);
}

main();
