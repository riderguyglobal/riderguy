/**
 * Generate a professionally styled PDF from the System Architecture Overview markdown.
 * Usage: node scripts/generate-pdf.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Read Markdown ──
const mdPath = resolve(ROOT, 'docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md');
const md = readFileSync(mdPath, 'utf-8');

// ── Convert Markdown → HTML ──
const htmlBody = await marked.parse(md);

// ── Professional CSS styling ──
const css = `
@page {
  size: A4;
  margin: 25mm 20mm 25mm 20mm;

  @bottom-center {
    content: "RiderGuy — Confidential";
    font-size: 9px;
    color: #9ca3af;
    font-family: 'Segoe UI', system-ui, sans-serif;
  }

  @bottom-right {
    content: counter(page);
    font-size: 9px;
    color: #9ca3af;
    font-family: 'Segoe UI', system-ui, sans-serif;
  }
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #1a1a1a;
  line-height: 1.7;
  font-size: 13px;
  max-width: none;
  margin: 0;
  padding: 0;
}

/* ── Cover-style H1 ── */
h1 {
  color: #15803d;
  font-size: 32px;
  font-weight: 800;
  border-bottom: 4px solid #16a34a;
  padding-bottom: 14px;
  margin-bottom: 6px;
  margin-top: 0;
  letter-spacing: -0.5px;
}

h1 + h3 {
  color: #6b7280;
  font-weight: 400;
  font-size: 16px;
  margin-top: 0;
  margin-bottom: 20px;
}

/* ── Section headings ── */
h2 {
  color: #15803d;
  font-size: 20px;
  font-weight: 700;
  border-bottom: 2px solid #d1fae5;
  padding-bottom: 8px;
  margin-top: 36px;
  margin-bottom: 14px;
  page-break-after: avoid;
}

h3 {
  color: #166534;
  font-size: 15px;
  font-weight: 600;
  margin-top: 22px;
  margin-bottom: 8px;
  page-break-after: avoid;
}

h4 {
  color: #374151;
  font-size: 13.5px;
  font-weight: 600;
  margin-top: 16px;
  margin-bottom: 6px;
}

/* ── Blockquotes (vision statements) ── */
blockquote {
  border-left: 4px solid #16a34a;
  background: #f0fdf4;
  padding: 14px 18px;
  margin: 14px 0;
  color: #374151;
  border-radius: 0 6px 6px 0;
  font-size: 13px;
  line-height: 1.6;
}

blockquote strong {
  color: #15803d;
}

blockquote p {
  margin: 6px 0;
}

/* ── Tables ── */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 14px 0;
  font-size: 12px;
  page-break-inside: auto;
}

thead {
  display: table-header-group;
}

tr {
  page-break-inside: avoid;
}

th {
  background: linear-gradient(to bottom, #f0fdf4, #dcfce7);
  color: #166534;
  padding: 9px 11px;
  text-align: left;
  border: 1px solid #bbf7d0;
  font-weight: 600;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

td {
  padding: 8px 11px;
  border: 1px solid #e5e7eb;
  vertical-align: top;
  line-height: 1.5;
}

tr:nth-child(even) {
  background: #fafafa;
}

tr:hover {
  background: #f0fdf4;
}

/* ── Code blocks ── */
code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  color: #374151;
}

pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px 18px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 11px;
  line-height: 1.6;
  margin: 14px 0;
  border: 1px solid #334155;
}

pre code {
  background: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
}

/* ── Links ── */
a {
  color: #16a34a;
  text-decoration: none;
}

/* ── Lists ── */
ul, ol {
  padding-left: 20px;
  margin: 8px 0;
}

li {
  margin: 4px 0;
  line-height: 1.6;
}

li strong {
  color: #15803d;
}

/* ── Horizontal rules ── */
hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 28px 0;
}

/* ── Paragraphs ── */
p {
  margin: 8px 0;
  line-height: 1.7;
}

/* ── Table of Contents special styling ── */
h2#table-of-contents + ol,
h2#table-of-contents + ul {
  column-count: 2;
  column-gap: 24px;
  font-size: 12.5px;
}

/* ── Emphasis ── */
em {
  font-style: italic;
  color: #4b5563;
}

strong {
  font-weight: 600;
}

/* ── Print adjustments ── */
h2, h3, h4 {
  page-break-after: avoid;
}

table, pre, blockquote {
  page-break-inside: avoid;
}

/* ── The architecture diagram ── */
pre:has(code) {
  page-break-inside: avoid;
}

/* ── Footer line ── */
body::after {
  content: '';
  display: block;
  height: 1px;
}
`;

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RiderGuy — How The System Works</title>
  <style>${css}</style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;

// ── Launch Chrome and generate PDF ──
const outPath = resolve(ROOT, 'docs/exports/RiderGuy_System_Overview.pdf');

console.log('Launching Chrome...');
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

console.log('Generating PDF...');
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%;font-size:9px;color:#9ca3af;font-family:'Segoe UI',system-ui,sans-serif;padding:0 20mm;display:flex;justify-content:space-between;">
      <span>RiderGuy — Confidential</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `,
});

await browser.close();

console.log(`✅ PDF generated: ${outPath}`);
