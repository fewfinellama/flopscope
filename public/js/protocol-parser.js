/**
 * Structured Agent Protocol & Markdown Parser for Technocore Explorer.
 * Accurately parses ATTEST, DELIVER, pipeline flows, code blocks, and URLs.
 */
import { escapeHtml } from './utils.js';

/**
 * Parse and render an agent message with protocol tags, safe code blocks, and URLs.
 * @param {string} rawText
 * @returns {string} Formatted HTML
 */
export function formatMessageBody(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  const escaped = escapeHtml(rawText);

  // 1. Check for ATTEST v1 protocol pattern
  // Format: ATTEST v1 | <taskId> | <status> | <rh:hash> | <comments>
  const attestMatch = escaped.match(/^ATTEST\s+v1\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(.*)$/i);
  if (attestMatch) {
    const taskId = attestMatch[1].trim();
    const status = attestMatch[2].trim();
    const hash = attestMatch[3].trim();
    const comments = attestMatch[4].trim();

    const isUseful = status.toLowerCase() === 'useful';
    const statusClass = isUseful
      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';

    return `
      <div class="space-y-2.5 font-sans">
        <div class="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span class="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-semibold shadow-sm">
            ⚡ ATTEST v1
          </span>
          <span class="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            task: <code class="font-bold text-slate-900 dark:text-slate-100">${taskId}</code>
          </span>
          <span class="px-2.5 py-0.5 rounded-full border font-semibold ${statusClass}">
            ${status}
          </span>
          <span class="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 truncate max-w-[220px]" title="${hash}">
            ${hash}
          </span>
        </div>
        <div class="text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed pt-1">
          ${linkifyText(comments)}
        </div>
      </div>
    `;
  }

  // 2. Check for DELIVER v1 protocol pattern
  // Format: DELIVER v1 | <taskId> | <details>
  const deliverMatch = escaped.match(/^DELIVER\s+v1\s*\|\s*([^|]+)\s*\|\s*(.*)$/i);
  if (deliverMatch) {
    const taskId = deliverMatch[1].trim();
    const details = deliverMatch[2].trim();

    return `
      <div class="space-y-2.5 font-sans">
        <div class="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span class="px-2.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-[#00c2ff] border border-cyan-300 dark:border-cyan-700 font-semibold shadow-sm">
            📦 DELIVER v1
          </span>
          <span class="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            task: <code class="font-bold text-slate-900 dark:text-slate-100">${taskId}</code>
          </span>
        </div>
        <div class="text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed pt-1">
          ${linkifyText(details)}
        </div>
      </div>
    `;
  }

  // 3. Check for Pipeline Workflow (JOB → CLAIM → RESULT → ATTEST)
  if (escaped.includes('→') || escaped.includes('-&gt;')) {
    const workflowFormatted = escaped.replace(/(JOB|CLAIM|RESULT|ATTEST|DELIVER)/g, (match) => {
      return `<span class="font-mono font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-[#00c2ff] border border-slate-300 dark:border-slate-700 text-xs">${match}</span>`;
    });
    return linkifyText(workflowFormatted);
  }

  // 4. Standard Message with Markdown & Code highlights
  let formatted = escaped;

  // Code Blocks ```code```
  formatted = formatted.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    return `
      <div class="my-2.5 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-sm font-mono text-xs sm:text-sm">
        <div class="flex items-center justify-between px-3.5 py-1.5 bg-slate-200 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>${lang ? escapeHtml(lang) : 'code'}</span>
        </div>
        <pre class="p-3.5 overflow-x-auto text-slate-800 dark:text-slate-200 select-all leading-relaxed">${code}</pre>
      </div>
    `;
  });

  // Inline Code `code`
  formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
    return `<code class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-[#00c2ff] font-mono text-xs sm:text-sm border border-slate-300 dark:border-slate-700">${code}</code>`;
  });

  return linkifyText(formatted);
}

/**
 * Autolink URLs safely inside escaped strings.
 * @param {string} text
 * @returns {string}
 */
export function linkifyText(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s<>"`]+)/g;

  return text.replace(urlRegex, (url) => {
    let cleanUrl = url;
    let trailing = '';
    const lastChar = cleanUrl.slice(-1);
    if ([')', ']', '.', ',', ';'].includes(lastChar)) {
      trailing = lastChar;
      cleanUrl = cleanUrl.slice(0, -1);
    }
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-[#00c2ff] hover:text-cyan-700 dark:hover:text-cyan-300 underline underline-offset-2 break-all inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-medium">${cleanUrl}<svg class="w-3.5 h-3.5 inline-block flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>${trailing}`;
  });
}
