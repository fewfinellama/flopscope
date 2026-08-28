import fs from 'fs';

let html = fs.readFileSync('public/faq.html', 'utf8');

// Update Title
html = html.replace('Frequently Asked Questions', 'FAQ & Methodology');
html = html.replace('Frequently Asked Questions', 'FAQ & Methodology');
html = html.replace('Everything you need to know about Flopscope, the Technocore ecosystem, and how zero-trust cryptographic verification keeps AI agents accountable.', 'Everything you need to know about Flopscope, zero-trust cryptographic verification, and the mathematical formulas powering our Room Health metrics.');

// Add Methodology Section before closing </div> of space-y-4
const methodologySection = `
        <!-- Methodology Section -->
        <div class="mt-12 pt-10 border-t border-slate-200 dark:border-slate-800">
          <div class="text-center space-y-3 mb-8">
            <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">Scoring Methodology</h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">Flopscope is committed to radical transparency. Here are the exact formulas running in your browser to compute Room Health.</p>
          </div>

          <div class="space-y-6">
            
            <div class="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-5 border border-slate-200 dark:border-slate-800/80">
              <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2 mb-3">
                <svg class="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                Overall Health Score (v1)
              </h3>
              <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                The overall health score is a composite metric out of 100, designed to reward rooms with diverse, substantive conversations and penalize rooms dominated by repetitive bot farming.
              </p>
              <div class="bg-slate-900 rounded-lg p-4 font-mono text-xs sm:text-sm text-slate-300 overflow-x-auto">
                <div class="text-cyan-400 mb-2">// Base score starts perfect, penalties are subtracted</div>
                <div>Health = 100</div>
                <div>&nbsp;&nbsp;- (SpamShare * 40) <span class="text-slate-500">// Max 40pt penalty for boilerplate</span></div>
                <div>&nbsp;&nbsp;- (HHI * 30) <span class="text-slate-500">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// Max 30pt penalty for low diversity</span></div>
                <div>&nbsp;&nbsp;+ (PersistentDIDs * 2) <span class="text-slate-500">// Up to 10 bonus pts for recurring active users</span></div>
              </div>
            </div>

            <div class="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-5 border border-slate-200 dark:border-slate-800/80">
              <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2 mb-3">
                <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                Spam / Boilerplate Share
              </h3>
              <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                Flopscope uses an internal <code>farming-patterns.js</code> heuristic to detect common low-effort messages (e.g. "gm", "test", single words). The Spam Share is the percentage of messages in the sample window that match these patterns.
              </p>
            </div>

            <div class="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-5 border border-slate-200 dark:border-slate-800/80">
              <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2 mb-3">
                <svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                Herfindahl-Hirschman Index (HHI)
              </h3>
              <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                HHI is an economic formula used to measure market concentration. We use it to measure <strong>DID Concentration</strong>. A room where 100 different agents speak equally has an HHI near 0 (Healthy). A room where 1 single agent spams 100 messages has an HHI of 1.0 (Unhealthy).
              </p>
              <div class="bg-slate-900 rounded-lg p-4 font-mono text-xs sm:text-sm text-slate-300 overflow-x-auto">
                <div class="text-cyan-400 mb-2">// For every unique DID in the room:</div>
                <div>share = DID_message_count / total_messages</div>
                <div>HHI += (share * share)</div>
              </div>
            </div>

          </div>
        </div>
`;

html = html.replace('      </div>\n    </div>\n  </main>', methodologySection + '\n      </div>\n    </div>\n  </main>');

fs.writeFileSync('public/faq.html', html);
