// Shared docked terminal: mounted on every page.
// Exposes: window.AurigaTerminal.mountDock(opts)
// opts:
//   greeting: string : first line printed on cold mount (default: "// resumed at <pathname>")
//   collapsed: bool  : start collapsed (default: from session state)
//   autoFocus: bool  : focus input after mount (default: false)
(function () {
  'use strict';

  // ─── Routing tables ───────────────────────────────────────────────
  // Internal hrefs are base-relative (no leading slash) so they resolve
  // against the static <base href="/"> tag in each HTML head.
  const PORTFOLIO = {
    about:      { label: 'about',      desc: 'who I am',                       href: 'about/' },
    skills:     { label: 'skills',     desc: 'what I work with',               href: 'skills/' },
    projects:   { label: 'projects',   desc: "what I've built (5 entries)",    href: 'projects/' },
    resume:     { label: 'resume',     desc: '1-page CV',                      href: 'resume/' },
    reflection: { label: 'reflection', desc: 'signature work essay',           href: 'https://github.com/joshcd99/joshcd99.github.io#readme' },
  };
  const PROJECTS = {
    ember:     { label: 'Ember',      desc: 'personal finance tracker', href: 'https://ember.auriga.fyi' },
    greenstep: { label: 'GreenStep',  desc: 'sustainability challenge', href: 'https://greenstep.auriga.fyi' },
    plants:    { label: 'Plants',     desc: 'plant care tracker',       href: 'https://plants.auriga.fyi' },
    redacted:  { label: '[redacted]', desc: 'private',                  href: 'redacted.html' },
  };
  const ROUTES = Object.assign({}, PORTFOLIO, PROJECTS);

  // Aliases: short navigational commands. Same base-relative convention.
  const ALIASES = {
    home: './', '~': './', cv: 'resume/', work: 'projects/',
    me: 'about/', who: 'about/', stack: 'skills/',
    capstone: 'projects/greenstep/', // capstone IS GreenStep
  };

  // Resolve a base-relative or absolute href against document.baseURI to
  // a fully-resolved same-origin pathname suitable for fetch / pushState /
  // location.href. The static <base href="/"> in each HTML head anchors
  // resolution at the deploy root.
  function resolveInternal(href) {
    try {
      const u = new URL(href, document.baseURI);
      return u.pathname + u.search + u.hash;
    } catch (_) {
      return href;
    }
  }

  // ─── Session state ────────────────────────────────────────────────
  const STORAGE_KEY = 'auriga.terminal.v1';
  const HISTORY_LIMIT = 24;

  function loadState() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function saveState(patch) {
    const state = Object.assign(loadState(), patch);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function pushHistory(line) {
    const s = loadState();
    s.history = (s.history || []).concat([line]).slice(-HISTORY_LIMIT);
    saveState(s);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ─── Dock DOM ─────────────────────────────────────────────────────
  function buildDock() {
    const root = document.createElement('aside');
    root.className = 'terminal-dock';
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', 'Terminal');
    root.innerHTML = `
      <div class="dock-bar" data-role="toggle" title="Click to collapse/expand">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="bar-title">josh dunlap · zsh</span>
        <span class="dock-hint dim">\` to focus · click to collapse</span>
      </div>
      <div class="dock-body" data-role="body"></div>
      <div class="dock-input-row" data-role="input-row">
        <span class="prompt">$ </span>
        <span class="input-display" data-role="display"></span>
        <span class="cursor"></span>
        <input class="real-input" type="text" autocomplete="off" autocorrect="off"
               autocapitalize="off" spellcheck="false" data-role="real-input" />
      </div>
    `;
    return root;
  }

  function appendLine(body, html) {
    const span = document.createElement('span');
    span.className = 'dock-line';
    span.innerHTML = html == null ? '' : html;
    body.appendChild(span);
    body.scrollTop = body.scrollHeight;
    return span;
  }
  function appendListing(body, title, table) {
    appendLine(body, `<span class="dim">${title}</span>`);
    for (const [key, p] of Object.entries(table)) {
      const isRedacted = key === 'redacted';
      const row = document.createElement('span');
      row.className = 'dock-line listing-row';
      row.innerHTML = `<span class="proj-arrow">→ </span><span class="proj-name${isRedacted ? ' redacted' : ''}">${p.label}</span><span class="proj-desc${isRedacted ? ' redacted' : ''}">${p.desc}</span>`;
      body.appendChild(row);
    }
    appendLine(body, '');
    body.scrollTop = body.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── Command resolution ───────────────────────────────────────────
  function resolveCommand(raw) {
    const val = (raw || '').trim();
    if (!val) return { kind: 'noop' };
    const lower = val.toLowerCase();

    if (lower === 'help' || lower === '?' || lower === 'ls') return { kind: 'help' };
    if (lower === 'clear' || lower === 'cls') return { kind: 'clear' };
    if (lower === 'whoami') return { kind: 'whoami' };
    if (lower === 'back' || lower === '..' || lower === '../' || lower === '-') return { kind: 'back' };
    if (lower === 'pwd') return { kind: 'pwd' };
    if (lower === 'date' || lower === 'now') return { kind: 'date' };

    if (ALIASES[lower]) return { kind: 'nav', href: ALIASES[lower], label: lower };
    if (ROUTES[lower]) return { kind: 'nav', href: ROUTES[lower].href, label: ROUTES[lower].label };

    return { kind: 'unknown', raw: val };
  }

  // ─── Mount ────────────────────────────────────────────────────────
  function mountDock(opts) {
    opts = opts || {};
    const state = loadState();
    const startCentered = !!opts.centered;
    const isIntroRun = !!opts.intro && startCentered;
    // Fresh page mounts always come up expanded; the idle timer takes
    // over and auto-collapses after a few seconds of no interaction.
    // Caller can still force an initial collapsed state via opts.collapsed.
    const startCollapsed = startCentered ? false : !!opts.collapsed;

    const dock = buildDock();
    if (startCentered) dock.classList.add('centered');
    document.body.appendChild(dock);

    // In docked mode we add body padding so content can scroll past.
    // In centered mode the terminal floats over content; no padding needed.
    if (!startCentered) document.body.classList.add('has-dock');
    if (startCollapsed) {
      dock.classList.add('collapsed');
      document.body.classList.add('dock-collapsed');
    }

    const body = dock.querySelector('[data-role="body"]');
    const display = dock.querySelector('[data-role="display"]');
    const realInput = dock.querySelector('[data-role="real-input"]');
    const toggleEl = dock.querySelector('[data-role="toggle"]');

    // ─── Initial body content ───
    //   intro mode: runIntro() will type the intro into an empty body.
    //   restored history: replay the saved HTML.
    //   else: short greeting.
    if (isIntroRun) {
      // leave body empty: runIntro will fill it
    } else if (state.dockHTML) {
      body.innerHTML = state.dockHTML;
      const path = location.pathname.replace(/\/$/, '') || '/';
      appendLine(body, `<span class="dim">// → arrived at ${escapeHtml(path)}</span>`);
    } else {
      const path = location.pathname.replace(/\/$/, '') || '/';
      appendLine(body, `<span class="dim">${opts.greeting || `// ready at ${escapeHtml(path)}. type \`help\``}</span>`);
    }
    body.scrollTop = body.scrollHeight;

    // Helper for saving the current dock body to sessionStorage.
    function persistDockHTML() {
      saveState({ dockHTML: body.innerHTML });
    }

    // ─── Morph between centered and docked states ───
    // The single dock element changes its CSS class, which triggers
    // transitions on top/left/width/height/transform/border. Both
    // helpers return a promise that resolves when the morph finishes.
    function awaitDockTransition() {
      return new Promise((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          dock.removeEventListener('transitionend', onEnd);
          resolve();
        };
        const onEnd = (e) => {
          if (e.target === dock && (e.propertyName === 'transform' || e.propertyName === 'top')) {
            finish();
          }
        };
        dock.addEventListener('transitionend', onEnd);
        setTimeout(finish, 950); // safety: max transition is 0.72s
      });
    }

    // Pin the dock body to its bottom across the entire morph. The dock's
    // clientHeight changes throughout the transition, so a single scrollTop
    // set at the start would be wrong by the next frame. Returns a stop
    // function that cancels the rAF loop.
    function pinToBottomDuring() {
      const stick = () => { body.scrollTop = body.scrollHeight; };
      stick();
      let rafId = requestAnimationFrame(function tick() {
        stick();
        rafId = requestAnimationFrame(tick);
      });
      return () => {
        cancelAnimationFrame(rafId);
        stick();
      };
    }

    function transitionToDocked() {
      if (!dock.classList.contains('centered')) return Promise.resolve();
      // Reserve scroll space before the dock lands.
      document.body.classList.add('has-dock');
      dock.classList.remove('centered');
      const unpin = pinToBottomDuring();
      // Reserve a grace window NOW so any mouseleave during the morph
      // can't schedule a 100ms collapse that beats the initial delay.
      startGrace(INITIAL_IDLE_MS + 720);
      return awaitDockTransition().then(() => {
        unpin();
        // Extend the grace another INITIAL_IDLE_MS from morph-end, then
        // schedule the first collapse.
        startGrace(INITIAL_IDLE_MS);
        scheduleCollapse(INITIAL_IDLE_MS);
      });
    }

    function transitionToCentered() {
      if (dock.classList.contains('centered')) return Promise.resolve();
      // Drop the scroll-reservation so content can use the whole viewport.
      document.body.classList.remove('has-dock');
      dock.classList.add('centered');
      const unpin = pinToBottomDuring();
      return awaitDockTransition().then(unpin);
    }

    // ─── Intro typing animation ───
    // Used only when mountDock({ centered: true, intro: true }) is called
    // from the landing page.
    async function typeAndRun(text) {
      const line = document.createElement('span');
      line.className = 'dock-line';
      const promptEl = document.createElement('span');
      promptEl.className = 'prompt';
      promptEl.textContent = '$ ';
      const cmd = document.createElement('span');
      cmd.className = 'cmd';
      const cur = document.createElement('span');
      cur.className = 'cursor';
      line.appendChild(promptEl);
      line.appendChild(cmd);
      line.appendChild(cur);
      body.appendChild(line);
      body.scrollTop = body.scrollHeight;
      for (const ch of text) {
        cmd.textContent += ch;
        await sleep(50 + Math.random() * 20);
        body.scrollTop = body.scrollHeight;
      }
      await sleep(220);
      cur.remove();
    }

    function renderListing(title, table) {
      appendLine(body, `<span class="dim">${title}</span>`);
      for (const [key, p] of Object.entries(table)) {
        const isRedacted = key === 'redacted';
        const row = document.createElement('span');
        row.className = 'dock-line listing-row';
        row.innerHTML = `<span class="proj-arrow">→ </span><span class="proj-name${isRedacted ? ' redacted' : ''}">${p.label}</span><span class="proj-desc${isRedacted ? ' redacted' : ''}">${p.desc}</span>`;
        body.appendChild(row);
      }
      appendLine(body, '');
      body.scrollTop = body.scrollHeight;
    }

    async function runIntro() {
      await sleep(800);

      await typeAndRun('whoami');
      appendLine(body, '<span class="accent">josh dunlap</span><span class="dim">, cs \'26, university of st. thomas</span>');
      appendLine(body, '');
      await sleep(260);

      await typeAndRun('ls portfolio/');
      renderListing('portfolio (CISC 480):', PORTFOLIO);

      appendLine(body, '<span class="dim">type a command, or `help`</span>');
      appendLine(body, '');
      body.scrollTop = body.scrollHeight;
      // Make input visible / focused so the cursor blinks at the prompt.
      realInput.focus();
    }

    // ─── Input handling ───
    let typed = '';

    function setTyped(v) {
      typed = v;
      display.textContent = v;
    }

    realInput.addEventListener('input', () => setTyped(realInput.value));

    realInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await submit();
      } else if (e.key === 'Escape') {
        setTyped('');
        realInput.value = '';
      } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        body.innerHTML = '';
      }
    });

    // ─── Auto-collapse on idle, expand on user activity ──────────────
    // Behavior:
    //   - Collapses to just the prompt row after IDLE_MS of inactivity.
    //   - Mouse INSIDE the dock pauses the timer (hovering, even without
    //     moving, keeps it open).
    //   - Mouse leaves the dock: timer starts.
    //   - Click on the title bar (only visible when expanded): manual
    //     collapse. Sets a "user closed" flag so hovering doesn't auto-
    //     expand. Clicking the prompt row or typing clears the flag.
    //   - Aggressive focus: any printable keystroke anywhere on the page
    //     (when not in another input) gets routed to the dock input.
    const IDLE_MS = 100;        // default: snap shut shortly after cursor leaves
    const INITIAL_IDLE_MS = 1500; // first collapse after mount/morph: give a beat
    let idleTimer = null;
    let mouseOverDock = false;
    let userClosed = false;   // true when user manually collapsed via bar click
    let graceUntil = 0;       // unix-ms timestamp: collapse cannot fire before this

    function clearIdle() {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    }
    function scheduleCollapse(delay) {
      clearIdle();
      if (dock.classList.contains('centered')) return; // hero mode: never
      if (mouseOverDock) return;                       // don't tick while hovered
      // Even if a caller asks for a snappy 100ms collapse, the dock can't
      // fire before graceUntil. Mount and the centered->docked morph each
      // set a grace window so a mouseleave during/right after the morph
      // doesn't snap the dock shut before the user notices it's there.
      const requested = delay != null ? delay : IDLE_MS;
      const effective = Math.max(requested, graceUntil - Date.now());
      idleTimer = setTimeout(() => {
        if (dock.classList.contains('centered')) return;
        if (mouseOverDock) return;
        dock.classList.add('collapsed');
        document.body.classList.add('dock-collapsed');
      }, Math.max(0, effective));
    }
    function startGrace(ms) {
      graceUntil = Math.max(graceUntil, Date.now() + ms);
    }
    function expand(opts) {
      if (dock.classList.contains('centered')) return;
      if (userClosed && !(opts && opts.force)) return;
      if (dock.classList.contains('collapsed')) {
        dock.classList.remove('collapsed');
        document.body.classList.remove('dock-collapsed');
        body.scrollTop = body.scrollHeight;
      }
      scheduleCollapse();
    }
    function manualCollapse() {
      clearIdle();
      dock.classList.add('collapsed');
      document.body.classList.add('dock-collapsed');
      userClosed = true;
    }

    // Mouse enter: stop the idle timer + soft-expand (respects userClosed).
    dock.addEventListener('mouseenter', () => {
      mouseOverDock = true;
      clearIdle();
      expand();
    });
    // Mouse leave: start the idle timer.
    dock.addEventListener('mouseleave', () => {
      mouseOverDock = false;
      scheduleCollapse();
    });

    // Click anywhere on the dock: force-expand + focus + clear userClosed.
    // (The title-bar click handler below uses stopPropagation so this
    // doesn't fire on bar clicks.)
    dock.addEventListener('click', () => {
      userClosed = false;
      expand({ force: true });
      realInput.focus();
    });

    // Title-bar click → manual collapse (only reachable when expanded,
    // since the bar is display:none in collapsed state).
    toggleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      manualCollapse();
    });

    // Typing or focus on the input expands + clears userClosed.
    realInput.addEventListener('focus', () => {
      userClosed = false;
      expand({ force: true });
    });
    realInput.addEventListener('input', () => {
      userClosed = false;
      expand({ force: true });
    });

    // Aggressive focus: any printable keystroke anywhere on the page
    // gets routed to the dock input. The user can click into a content
    // page and still just start typing to interact with the terminal.
    document.addEventListener('keydown', (e) => {
      // If the dock input is already focused, let the native behavior happen.
      if (document.activeElement === realInput) return;
      if (isTypingInOtherInput(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Backtick: focus + force expand, then bail.
      if (e.key === '`') {
        e.preventDefault();
        userClosed = false;
        expand({ force: true });
        realInput.focus();
        return;
      }
      // Only redirect printable, single-character keys. Skips Tab, Esc,
      // Arrows, Backspace, Enter, function keys, etc.
      if (e.key.length !== 1) return;

      e.preventDefault();
      userClosed = false;
      expand({ force: true });
      realInput.value += e.key;
      setTyped(realInput.value);
      realInput.focus();
      try {
        realInput.setSelectionRange(realInput.value.length, realInput.value.length);
      } catch (_) {}
    });

    // Initial mount: longer delay so the user sees the dock briefly
    // before the snappy auto-collapse takes over. Suppressed in the
    // centered intro mode.
    if (!startCentered) {
      startGrace(INITIAL_IDLE_MS);
      scheduleCollapse(INITIAL_IDLE_MS);
    }

    if (opts.autoFocus) realInput.focus();

    // Bind back/forward handler once the dock is live.
    bindSpaListeners();

    // ─── Submit ────
    async function submit() {
      const raw = typed;
      const cmd = resolveCommand(raw);
      // Echo the command line
      appendLine(body, `<span class="prompt">$ </span><span class="cmd">${escapeHtml(raw)}</span>`);
      setTyped(''); realInput.value = '';
      if (raw.trim()) pushHistory(raw.trim());

      switch (cmd.kind) {
        case 'noop': break;
        case 'help':
          appendListing(body, 'portfolio (CISC 480):', PORTFOLIO);
          appendListing(body, 'live projects:', PROJECTS);
          appendLine(body, '<span class="dim">extras: <span class="kw">help</span> · <span class="kw">clear</span> · <span class="kw">whoami</span> · <span class="kw">back</span> · <span class="kw">pwd</span> · <span class="kw">date</span></span>');
          break;
        case 'clear':
          body.innerHTML = '';
          break;
        case 'whoami':
          appendLine(body, '<span class="accent">josh dunlap</span><span class="dim">, cs \'26, university of st. thomas</span>');
          break;
        case 'pwd':
          appendLine(body, `<span class="kw">${escapeHtml(location.pathname)}</span>`);
          break;
        case 'date':
          appendLine(body, `<span class="dim">${new Date().toString()}</span>`);
          break;
        case 'back':
          appendLine(body, '<span class="dim">going back...</span>');
          await sleep(180);
          history.length > 0 ? window.history.back() : (location.href = '/');
          break;
        case 'nav':
          if (isInternalSpaRoute(cmd.href)) {
            appendLine(body, `<span class="dim">→ ${escapeHtml(cmd.label)}</span>`);
            persistDockHTML(); // save before swap so reloads still work

            const wasCentered = dock.classList.contains('centered');
            const goingHome = isRootPath(new URL(cmd.href, location.origin).pathname);
            // If leaving the centered intro for the first time, lock the
            // intro flag so future hard-reloads on / skip it.
            if (wasCentered && !goingHome) markIntroDone();

            const navPromise = spaNavigate(cmd.href, cmd.label).catch(() => {
              location.href = cmd.href;
            });

            // Match the dock's state to the destination:
            //   centered → docked  (leaving home)
            //   docked   → centered (returning home)
            //   no-op otherwise
            let morphPromise = Promise.resolve();
            if (wasCentered && !goingHome) {
              morphPromise = transitionToDocked();
            } else if (!wasCentered && goingHome) {
              morphPromise = transitionToCentered();
            }

            await Promise.all([morphPromise, navPromise]);
          } else {
            // External URL or non-SPA-able file/page (PDF, redacted, subdomain):
            // do a real navigation. Resolve through document.baseURI for the
            // internal cases (e.g. redacted.html) so we don't accidentally
            // navigate to a relative path under the current page.
            appendLine(body, `<span class="dim">navigating to ${escapeHtml(cmd.label)}...</span>`);
            await sleep(220);
            // External (with protocol) → use as-is; internal → resolve.
            const target = /^[a-z]+:\/\//i.test(cmd.href) ? cmd.href : resolveInternal(cmd.href);
            location.href = target;
          }
          break;
        case 'unknown':
        default:
          appendLine(body, `<span class="err">zsh: command not found: ${escapeHtml(cmd.raw)}</span><span class="dim">  (try \`help\`)</span>`);
          break;
      }

      // Persist the dock's current body HTML so the next page restores it.
      persistDockHTML();
    }

    // If caller requested intro, kick it off after the dock is mounted.
    if (isIntroRun) {
      runIntro().catch((err) => console.error('runIntro failed', err));
    }

    // Reveal page content with a top-to-bottom staggered fade-in.
    // Skipped on the landing page (no <main>) and when the dock was
    // mounted in centered+intro mode.
    if (!isIntroRun) triggerPageReveal();

    const instance = {
      dock,
      submit,
      focus: () => { expand(); realInput.focus(); },
      collapse: () => { clearIdle(); dock.classList.add('collapsed'); document.body.classList.add('dock-collapsed'); },
      expand,
      transitionToDocked,
      transitionToCentered,
      runIntro,
      isCentered: () => dock.classList.contains('centered'),
    };
    activeDock = instance;
    return instance;
  }

  function isTypingInOtherInput(e) {
    const t = e.target;
    if (!t) return false;
    const tag = t.tagName && t.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return !t.classList.contains('real-input');
    if (t.isContentEditable) return true;
    return false;
  }

  // Mark intro as done (called by landing page after centered intro flies down).
  function markIntroDone() { saveState({ introDone: true }); }
  function wasIntroDone() { return !!loadState().introDone; }

  // Seed the dock's persisted history: used by the landing page just before
  // flying down, so the dock restores the centered intro + the command the
  // user submitted.
  function seedDockHTML(html) { saveState({ dockHTML: html }); }
  function clearDockHTML() { saveState({ dockHTML: null }); }
  function hasDockHistory() { return !!loadState().dockHTML; }

  // Module-level reference to the most recently mounted dock instance.
  // Used by spaReplaceContent + popstate to sync dock state with the URL.
  let activeDock = null;

  // ─── Page content reveal ─────────────────────────────────────────
  // Top-to-bottom staggered fade-in on the direct children of <main>.
  // Used both on initial page load (when content arrives via the static
  // HTML) and after every SPA navigation (after the new <main> is
  // swapped in).
  function triggerPageReveal(opts) {
    opts = opts || {};
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // respect the user's preference
    }
    const main = (opts.scope && opts.scope.tagName === 'MAIN')
      ? opts.scope
      : document.querySelector('main');
    if (!main) return;

    const children = Array.from(main.children);
    if (children.length === 0) return;

    const STAGGER = 55;     // ms between siblings
    const MAX_INDEX = 11;   // cap so very long pages don't drag on forever
    const DURATION = 380;

    children.forEach((child, i) => {
      const delay = Math.min(i, MAX_INDEX) * STAGGER;
      // Start hidden so the very first paint shows nothing in this slot.
      child.style.opacity = '0';
      // Defer the animate() call by one frame so the opacity:0 actually
      // takes effect before the keyframes resolve their `from` snapshot.
      requestAnimationFrame(() => {
        const anim = child.animate(
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: DURATION,
            delay,
            fill: 'forwards',
            easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
          }
        );
        // Clean up the inline opacity once the anim finishes so other
        // logic (theme changes, etc.) can still mutate the element.
        anim.onfinish = () => { child.style.opacity = ''; };
      });
    });
  }

  // The deploy "base path": empty for both Vercel root and joshcd99.github.io root.
  function getBasePath() {
    return "";
  }

  function isRootPath(p) {
    if (!p) return true;
    const base = getBasePath();
    return p === base + '/' || p === base + '/index.html' || p === base || p === '';
  }

  // ─── Lazy script loading ─────────────────────────────────────────
  // Used to pull in D3 + the constellation module on demand when the
  // user navigates back to / from a content page.
  const scriptPromises = {};
  function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
    return scriptPromises[src];
  }

  async function ensureConstellation() {
    if (window.Constellation) return;
    if (typeof window.d3 === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js');
    }
    await loadScript('/assets/constellation.js');
  }

  async function syncDockStateForPath(pathname) {
    if (!activeDock) return;
    const atRoot = isRootPath(pathname);

    // Morph the dock between centered (at /) and docked (elsewhere).
    if (atRoot && !activeDock.isCentered()) {
      await activeDock.transitionToCentered();
    } else if (!atRoot && activeDock.isCentered()) {
      await activeDock.transitionToDocked();
    }

    // Manage the constellation in parallel: lazy-load it on the first
    // visit back to /, hide it when leaving. Reveals without animation
    // on SPA returns; the initial / load handles its own animated reveal.
    if (atRoot) {
      try {
        await ensureConstellation();
        if (window.Constellation) window.Constellation.render({ skipAnimation: true });
      } catch (err) {
        console.warn('Constellation lazy-load failed', err);
      }
    } else {
      if (window.Constellation) window.Constellation.hide();
    }
  }

  // ─── SPA navigation ────────────────────────────────────────────────
  // Internal routes that SPA-navigate (fetch + swap <main>, no page reload).
  // Anything else (external subdomains, GitHub README, /redacted, file
  // downloads) falls back to a real navigation.
  function isInternalSpaRoute(href) {
    if (!href || typeof href !== 'string') return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    try {
      const u = new URL(href, document.baseURI);
      if (u.origin !== location.origin) return false; // external
      if (/redacted/i.test(u.pathname)) return false; // standalone page
      // File downloads (PDF, images, etc.): never SPA-navigate.
      if (/\.(pdf|png|jpe?g|gif|svg|webp|zip|css|js|json|xml|ico)$/i.test(u.pathname)) return false;
    } catch (_) {
      return false;
    }
    return true;
  }

  // Fetch destination URL, swap its <main> into the current document,
  // update title + per-page <style> tags, fire resize for the starfield.
  // Does NOT touch history (callers handle pushState / popstate).
  async function spaReplaceContent(href) {
    const res = await fetch(href, { headers: { 'Accept': 'text/html' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Title
    if (doc.title) document.title = doc.title;

    // Swap <main>
    const newMain = doc.querySelector('main');
    const currentMain = document.querySelector('main');
    if (currentMain && newMain) {
      currentMain.replaceWith(newMain);
    } else if (newMain && !currentMain) {
      // Inject before the dock if present, else before #auriga-label, else at end.
      const dock = document.querySelector('.terminal-dock');
      const label = document.getElementById('auriga-label');
      const anchor = dock || label;
      if (anchor) document.body.insertBefore(newMain, anchor);
      else document.body.appendChild(newMain);
    } else if (currentMain && !newMain) {
      currentMain.remove();
    }

    // Stagger-fade in the new content if we have one.
    if (newMain) triggerPageReveal({ scope: newMain });

    // Per-page <style> tags: swap any previously injected ones for the new set.
    document.querySelectorAll('style[data-spa-page-style]').forEach(el => el.remove());
    doc.querySelectorAll('head > style').forEach(style => {
      const cloned = style.cloneNode(true);
      cloned.setAttribute('data-spa-page-style', '');
      document.head.appendChild(cloned);
    });

    // Body classes: add destination's classes, preserve runtime classes
    // (animation states, dock state). Never clobber the whole className,
    // since mid-animation that would yank flying-to-dock and snap the
    // transition back to its starting state.
    const destClasses = (doc.body.className || '').split(/\s+/).filter(Boolean);
    destClasses.forEach(c => document.body.classList.add(c));
    // Make sure scroll-page is on for content pages; remove fixed-page if set.
    document.body.classList.add('scroll-page');
    document.body.classList.remove('fixed-page');

    // Re-fire resize so the starfield canvas re-extends to the new content height.
    window.dispatchEvent(new Event('resize'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Public navigate: replace content + push history. Resolves the input
  // href through document.baseURI so it works on both root and sub-path
  // deploys without callers having to know which one they're on.
  async function spaNavigate(href, label) {
    const resolved = resolveInternal(href);
    try {
      await spaReplaceContent(resolved);
      try { history.pushState({ spa: true, href: resolved }, '', resolved); } catch (_) {}
    } catch (err) {
      console.warn('SPA navigation failed, falling back', err);
      location.href = resolved;
    }
  }

  // Back/forward: replay the URL without pushing new history, AND morph
  // the dock between centered/docked to match the destination.
  let spaListenersBound = false;
  function bindSpaListeners() {
    if (spaListenersBound) return;
    spaListenersBound = true;
    window.addEventListener('popstate', async () => {
      try {
        await spaReplaceContent(location.pathname + location.search);
        await syncDockStateForPath(location.pathname);
      } catch (_) {
        location.reload();
      }
    });
    // Replace initial history state so popstate has something to anchor to.
    try { history.replaceState({ spa: true, href: location.pathname }, '', location.pathname + location.search); } catch (_) {}
  }

  window.AurigaTerminal = {
    mountDock, markIntroDone, wasIntroDone,
    seedDockHTML, clearDockHTML, hasDockHistory,
    spaNavigate, spaReplaceContent, isInternalSpaRoute, bindSpaListeners,
    PORTFOLIO, PROJECTS, ROUTES
  };
})();
