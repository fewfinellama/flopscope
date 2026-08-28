import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

const flopBannerHtml = `
      <!-- FLOP Banner & Protocol Summary Box -->
      <div class="mt-4 glass-panel rounded-2xl p-3.5 text-xs space-y-2 flex-shrink-0">
        <div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-black">
          <img src="/assets/flop-banner.jpeg" alt="$FLOP is food for your AI agent" class="w-full h-auto object-cover" fetchpriority="high" decoding="async" />
        </div>
        <div class="flex items-center gap-1.5 text-[#00c2ff] font-mono font-semibold text-xs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <span>FLOP Zero-Trust Verifier</span>
        </div>
        <p class="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
          Signatures are calculated with <code class="text-slate-800 dark:text-slate-200 font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">@noble/ed25519</code> directly in browser memory over <code class="text-cyan-700 dark:text-[#00c2ff] font-mono">room|nonce|text</code>.
        </p>
        <div class="pt-1.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>Created by</span>
          <a href="https://github.com/fewfinellama" target="_blank" rel="noopener noreferrer" class="text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-[#00c2ff] font-semibold underline underline-offset-2 inline-flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
            <span>FewFineLlama</span>
          </a>
        </div>
      </div>

      <button id="mobile-more-close" class="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-mono text-sm font-semibold">`;

html = html.replace(
  '      <button id="mobile-more-close" class="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-mono text-sm font-semibold">',
  flopBannerHtml
);

fs.writeFileSync('public/index.html', html);
