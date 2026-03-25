// X Content Sidekick — Content Script
// Persistent sidebar for engaging, composing, and strategizing on X

// ============================================================
// CONFIG
// ============================================================

const CONFIG = {
  tweetSelector: 'article[data-testid="tweet"]',
  replyButtonSelector: '[data-testid="reply"]',
  tweetTextSelector: '[data-testid="tweetText"]',
  sidebarId: 'xcs-sidebar',
  toggleBtnId: 'xcs-toggle-btn',
  engageBtnClass: 'xcs-engage-btn'
};

const processedTweets = new WeakSet();

// ============================================================
// SIDEBAR STATE
// ============================================================

let sidebarState = {
  isOpen: false,
  activeTab: 'engage',         // engage | create | chat
  currentTweetContext: null,   // tweet loaded into engage tab
  chatHistory: [],             // conversation history for chat tab
  composeDrafts: [],           // generated tweet drafts
  engageReplies: [],           // generated reply options
  isLoading: false
};

// ============================================================
// INITIALIZATION
// ============================================================

function init() {
  injectSidebar();
  injectToggleButton();
  processTweets();

  const observer = new MutationObserver(() => {
    processTweets();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// SIDEBAR INJECTION
// ============================================================

function injectSidebar() {
  if (document.getElementById(CONFIG.sidebarId)) return;

  const sidebar = document.createElement('div');
  sidebar.id = CONFIG.sidebarId;
  sidebar.className = 'xcs-sidebar xcs-sidebar--closed';

  sidebar.innerHTML = `
    <div class="xcs-header">
      <div class="xcs-header-top">
        <span class="xcs-logo">✦ Content Sidekick</span>
        <button class="xcs-close-btn" id="xcs-close-btn" title="Close sidebar">✕</button>
      </div>
      <div class="xcs-tabs">
        <button class="xcs-tab xcs-tab--active" data-tab="engage">
          <span class="xcs-tab-icon">💬</span>
          <span>Engage</span>
        </button>
        <button class="xcs-tab" data-tab="create">
          <span class="xcs-tab-icon">✏️</span>
          <span>Create</span>
        </button>
        <button class="xcs-tab" data-tab="chat">
          <span class="xcs-tab-icon">🧭</span>
          <span>Strategy</span>
        </button>
      </div>
    </div>

    <!-- ENGAGE TAB -->
    <div class="xcs-panel xcs-panel--active" id="xcs-panel-engage">
      <div class="xcs-engage-prompt" id="xcs-engage-prompt">
        <div class="xcs-empty-state">
          <div class="xcs-empty-icon">💬</div>
          <p>Click <strong>Engage</strong> on any tweet below to load it here and craft a thoughtful reply.</p>
        </div>
      </div>
      <div class="xcs-engage-tweet-preview" id="xcs-engage-tweet-preview" style="display:none">
        <div class="xcs-tweet-preview-label">Replying to</div>
        <div class="xcs-tweet-preview-author" id="xcs-tweet-author"></div>
        <div class="xcs-tweet-preview-text" id="xcs-tweet-text"></div>
      </div>
      <div class="xcs-engage-modes" id="xcs-engage-modes" style="display:none">
        <div class="xcs-mode-label">Engagement mode</div>
        <div class="xcs-mode-grid">
          <button class="xcs-mode-btn xcs-mode-btn--active" data-mode="insight" title="Add a smart, substantive angle">
            <span>💡</span><span>Insight</span>
          </button>
          <button class="xcs-mode-btn" data-mode="question" title="Ask a compelling question">
            <span>❓</span><span>Question</span>
          </button>
          <button class="xcs-mode-btn" data-mode="connect" title="Build rapport with the author">
            <span>🤝</span><span>Connect</span>
          </button>
          <button class="xcs-mode-btn" data-mode="challenge" title="Respectfully push back">
            <span>⚡</span><span>Challenge</span>
          </button>
          <button class="xcs-mode-btn" data-mode="expand" title="Build on their point">
            <span>➕</span><span>Expand</span>
          </button>
        </div>
      </div>
      <div class="xcs-engage-actions" id="xcs-engage-actions" style="display:none">
        <button class="xcs-generate-btn" id="xcs-engage-generate-btn">
          <span class="xcs-btn-icon">✦</span> Generate Replies
        </button>
      </div>
      <div class="xcs-engage-replies" id="xcs-engage-replies"></div>
      <div class="xcs-refine-row" id="xcs-engage-refine" style="display:none">
        <input type="text" class="xcs-refine-input" id="xcs-engage-refine-input" placeholder="Refine: 'shorter', 'add a data point'…">
        <button class="xcs-refine-btn" id="xcs-engage-refine-btn">↺</button>
      </div>
    </div>

    <!-- CREATE TAB -->
    <div class="xcs-panel" id="xcs-panel-create">
      <div class="xcs-create-form">
        <div class="xcs-field">
          <label class="xcs-label">What do you want to write about?</label>
          <textarea class="xcs-textarea" id="xcs-compose-topic" rows="3" placeholder="e.g. Why most product launches fail silently, the overlooked signals that predict churn, my take on AI replacing junior devs…"></textarea>
        </div>
        <div class="xcs-field-row">
          <div class="xcs-field">
            <label class="xcs-label">Format</label>
            <select class="xcs-select" id="xcs-compose-format">
              <option value="single tweet">Single tweet</option>
              <option value="3-tweet thread">3-tweet thread</option>
              <option value="5-tweet thread">5-tweet thread</option>
              <option value="question tweet">Question tweet</option>
            </select>
          </div>
          <div class="xcs-field">
            <label class="xcs-label">Tone</label>
            <select class="xcs-select" id="xcs-compose-tone">
              <option value="conversational">Conversational</option>
              <option value="declarative and confident">Declarative</option>
              <option value="curious and exploratory">Curious</option>
              <option value="contrarian and challenging">Contrarian</option>
              <option value="educational and clear">Educational</option>
            </select>
          </div>
        </div>
        <button class="xcs-generate-btn" id="xcs-compose-generate-btn">
          <span class="xcs-btn-icon">✦</span> Generate Drafts
        </button>
      </div>
      <div class="xcs-compose-drafts" id="xcs-compose-drafts"></div>
    </div>

    <!-- CHAT TAB -->
    <div class="xcs-panel" id="xcs-panel-chat">
      <div class="xcs-chat-messages" id="xcs-chat-messages">
        <div class="xcs-chat-welcome">
          <div class="xcs-welcome-icon">🧭</div>
          <p>Your content strategy co-pilot. Ask me anything about growing your voice on X.</p>
          <div class="xcs-chat-starters">
            <button class="xcs-starter-btn" data-msg="What should I be posting about this week to build my audience?">What should I post this week?</button>
            <button class="xcs-starter-btn" data-msg="Give me 5 tweet hook ideas for my domain.">5 tweet hook ideas</button>
            <button class="xcs-starter-btn" data-msg="How do I build genuine engagement, not just likes?">Building genuine engagement</button>
          </div>
        </div>
      </div>
      <div class="xcs-chat-input-row">
        <textarea class="xcs-chat-input" id="xcs-chat-input" rows="2" placeholder="Ask anything about your X strategy…"></textarea>
        <button class="xcs-chat-send-btn" id="xcs-chat-send-btn">↑</button>
      </div>
    </div>

    <div class="xcs-loading-overlay" id="xcs-loading-overlay" style="display:none">
      <div class="xcs-spinner"></div>
      <span id="xcs-loading-text">Thinking…</span>
    </div>
  `;

  document.body.appendChild(sidebar);
  attachSidebarEvents(sidebar);
}

function injectToggleButton() {
  if (document.getElementById(CONFIG.toggleBtnId)) return;

  const btn = document.createElement('button');
  btn.id = CONFIG.toggleBtnId;
  btn.className = 'xcs-toggle-btn';
  btn.innerHTML = `<span class="xcs-toggle-icon">✦</span>`;
  btn.title = 'Open X Content Sidekick';
  btn.addEventListener('click', toggleSidebar);

  document.body.appendChild(btn);
}

// ============================================================
// SIDEBAR EVENTS
// ============================================================

function attachSidebarEvents(sidebar) {
  // Close button
  sidebar.querySelector('#xcs-close-btn').addEventListener('click', closeSidebar);

  // Tab switching
  sidebar.querySelectorAll('.xcs-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // ENGAGE TAB
  const engageModes = sidebar.querySelector('#xcs-engage-modes');
  engageModes && engageModes.querySelectorAll('.xcs-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      engageModes.querySelectorAll('.xcs-mode-btn').forEach(b => b.classList.remove('xcs-mode-btn--active'));
      btn.classList.add('xcs-mode-btn--active');
    });
  });

  sidebar.querySelector('#xcs-engage-generate-btn').addEventListener('click', generateReplies);

  const refineBtn = sidebar.querySelector('#xcs-engage-refine-btn');
  refineBtn && refineBtn.addEventListener('click', () => {
    const instruction = sidebar.querySelector('#xcs-engage-refine-input').value.trim();
    if (sidebarState.currentTweetContext) {
      sidebarState.currentTweetContext.refinementInstruction = instruction;
      generateReplies();
    }
  });
  sidebar.querySelector('#xcs-engage-refine-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') refineBtn && refineBtn.click();
  });

  // CREATE TAB
  sidebar.querySelector('#xcs-compose-generate-btn').addEventListener('click', generateCompose);

  // CHAT TAB
  sidebar.querySelector('#xcs-chat-send-btn').addEventListener('click', sendChatMessage);
  sidebar.querySelector('#xcs-chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  sidebar.querySelectorAll('.xcs-starter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sidebar.querySelector('#xcs-chat-input').value = btn.dataset.msg;
      sendChatMessage();
    });
  });
}

// ============================================================
// SIDEBAR CONTROLS
// ============================================================

function openSidebar() {
  const sidebar = document.getElementById(CONFIG.sidebarId);
  const toggleBtn = document.getElementById(CONFIG.toggleBtnId);
  if (!sidebar) return;
  sidebar.classList.remove('xcs-sidebar--closed');
  sidebar.classList.add('xcs-sidebar--open');
  if (toggleBtn) toggleBtn.classList.add('xcs-toggle-btn--active');
  sidebarState.isOpen = true;

  // Push X content to make room
  const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
  if (primaryColumn) primaryColumn.style.marginRight = '380px';
}

function closeSidebar() {
  const sidebar = document.getElementById(CONFIG.sidebarId);
  const toggleBtn = document.getElementById(CONFIG.toggleBtnId);
  if (!sidebar) return;
  sidebar.classList.add('xcs-sidebar--closed');
  sidebar.classList.remove('xcs-sidebar--open');
  if (toggleBtn) toggleBtn.classList.remove('xcs-toggle-btn--active');
  sidebarState.isOpen = false;

  const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
  if (primaryColumn) primaryColumn.style.marginRight = '';
}

function toggleSidebar() {
  sidebarState.isOpen ? closeSidebar() : openSidebar();
}

function switchTab(tab) {
  sidebarState.activeTab = tab;
  document.querySelectorAll('.xcs-tab').forEach(t => {
    t.classList.toggle('xcs-tab--active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.xcs-panel').forEach(p => {
    p.classList.toggle('xcs-panel--active', p.id === `xcs-panel-${tab}`);
  });
}

function showLoading(text = 'Thinking…') {
  const overlay = document.getElementById('xcs-loading-overlay');
  const loadingText = document.getElementById('xcs-loading-text');
  if (overlay) overlay.style.display = 'flex';
  if (loadingText) loadingText.textContent = text;
  sidebarState.isLoading = true;
}

function hideLoading() {
  const overlay = document.getElementById('xcs-loading-overlay');
  if (overlay) overlay.style.display = 'none';
  sidebarState.isLoading = false;
}

// ============================================================
// TWEET PROCESSING (inject per-tweet buttons)
// ============================================================

function processTweets() {
  const tweets = document.querySelectorAll(CONFIG.tweetSelector);
  tweets.forEach(tweet => {
    if (!processedTweets.has(tweet)) {
      processedTweets.add(tweet);
      injectEngageButton(tweet);
    }
  });
}

function injectEngageButton(tweetElement) {
  const replyButton = tweetElement.querySelector(CONFIG.replyButtonSelector);
  if (!replyButton) return;

  const actionBar = replyButton.closest('[role="group"]');
  if (!actionBar) return;

  if (actionBar.querySelector(`.${CONFIG.engageBtnClass}`)) return;

  const btn = document.createElement('button');
  btn.className = CONFIG.engageBtnClass;
  btn.innerHTML = `<span>✦ Engage</span>`;
  btn.title = 'Load this tweet into X Content Sidekick';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    loadTweetIntoSidebar(tweetElement);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'xcs-btn-wrapper';
  wrapper.appendChild(btn);
  actionBar.appendChild(wrapper);
}

// ============================================================
// ENGAGE TAB LOGIC
// ============================================================

function loadTweetIntoSidebar(tweetElement) {
  const context = extractTweetContext(tweetElement);
  sidebarState.currentTweetContext = context;
  sidebarState.engageReplies = [];

  // Open sidebar & switch to engage tab
  if (!sidebarState.isOpen) openSidebar();
  switchTab('engage');

  // Populate preview
  const previewEl = document.getElementById('xcs-engage-tweet-preview');
  const promptEl = document.getElementById('xcs-engage-prompt');
  const modesEl = document.getElementById('xcs-engage-modes');
  const actionsEl = document.getElementById('xcs-engage-actions');
  const refineEl = document.getElementById('xcs-engage-refine');
  const repliesEl = document.getElementById('xcs-engage-replies');
  const authorEl = document.getElementById('xcs-tweet-author');
  const textEl = document.getElementById('xcs-tweet-text');

  if (promptEl) promptEl.style.display = 'none';
  if (previewEl) previewEl.style.display = 'block';
  if (modesEl) modesEl.style.display = 'block';
  if (actionsEl) actionsEl.style.display = 'block';
  if (refineEl) refineEl.style.display = 'none';
  if (repliesEl) repliesEl.innerHTML = '';

  if (authorEl) authorEl.textContent = context.author ? `@${context.author}` : 'Unknown';
  if (textEl) textEl.textContent = context.text || '[Image/video only]';
}

function getSelectedEngageMode() {
  const activeBtn = document.querySelector('.xcs-mode-btn--active');
  return activeBtn ? activeBtn.dataset.mode : 'insight';
}

async function generateReplies() {
  if (sidebarState.isLoading || !sidebarState.currentTweetContext) return;

  const context = {
    ...sidebarState.currentTweetContext,
    engageMode: getSelectedEngageMode()
  };

  showLoading('Crafting replies…');

  sendMessageWithTimeout({ action: 'generateReplies', context }).then((response) => {
    hideLoading();
    if (response.error) { showEngageError(response.error); return; }
    if (response.replies) {
      sidebarState.engageReplies = response.replies;
      renderReplies(response.replies, sidebarState.currentTweetContext);
    }
  });
}

function renderReplies(replies, tweetContext) {
  const container = document.getElementById('xcs-engage-replies');
  const refineEl = document.getElementById('xcs-engage-refine');
  if (!container) return;

  container.innerHTML = replies.map((reply, i) => {
    const charCount = reply.length;
    const charClass = charCount > 280 ? 'xcs-char--error' : charCount > 240 ? 'xcs-char--warn' : '';
    return `
      <div class="xcs-reply-card" data-index="${i}">
        <textarea class="xcs-reply-textarea" rows="3">${escapeHtml(reply)}</textarea>
        <div class="xcs-reply-footer">
          <span class="xcs-char-count ${charClass}">${charCount} / 280</span>
          <div class="xcs-reply-btns">
            <button class="xcs-action-btn xcs-copy-btn">Copy</button>
            <button class="xcs-action-btn xcs-use-btn xcs-use-btn--primary">Use Reply</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Wire buttons
  container.querySelectorAll('.xcs-reply-card').forEach((card, i) => {
    const textarea = card.querySelector('.xcs-reply-textarea');
    const charCount = card.querySelector('.xcs-char-count');

    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len} / 280`;
      charCount.className = `xcs-char-count ${len > 280 ? 'xcs-char--error' : len > 240 ? 'xcs-char--warn' : ''}`;
    });

    card.querySelector('.xcs-copy-btn').addEventListener('click', (e) => {
      navigator.clipboard.writeText(textarea.value).then(() => {
        e.target.textContent = '✓';
        setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
      });
    });

    card.querySelector('.xcs-use-btn').addEventListener('click', () => {
      if (tweetContext && tweetContext.tweetElement) {
        populateReply(tweetContext.tweetElement, textarea.value);
      } else {
        navigator.clipboard.writeText(textarea.value);
        showToast('Copied to clipboard — paste into reply composer');
      }
      closeSidebar();
    });
  });

  if (refineEl) refineEl.style.display = 'flex';
}

function showEngageError(message) {
  const container = document.getElementById('xcs-engage-replies');
  if (container) {
    container.innerHTML = `<div class="xcs-error-msg">⚠️ ${escapeHtml(message)}</div>`;
  }
}

// ============================================================
// CREATE TAB LOGIC
// ============================================================

async function generateCompose() {
  if (sidebarState.isLoading) return;

  const topicEl = document.getElementById('xcs-compose-topic');
  const formatEl = document.getElementById('xcs-compose-format');
  const toneEl = document.getElementById('xcs-compose-tone');

  const topic = topicEl ? topicEl.value.trim() : '';
  if (!topic) {
    showToast('Please enter a topic first');
    if (topicEl) topicEl.focus();
    return;
  }

  const context = {
    topic,
    format: formatEl ? formatEl.value : 'single tweet',
    tone: toneEl ? toneEl.value : 'conversational'
  };

  showLoading('Drafting content…');

  sendMessageWithTimeout({ action: 'composeTweet', context }).then((response) => {
    hideLoading();
    if (response.error) { renderComposeDrafts([], response.error); return; }
    if (response.drafts) {
      sidebarState.composeDrafts = response.drafts;
      renderComposeDrafts(response.drafts);
    }
  });
}

function renderComposeDrafts(drafts, error = null) {
  const container = document.getElementById('xcs-compose-drafts');
  if (!container) return;

  if (error) {
    container.innerHTML = `<div class="xcs-error-msg">⚠️ ${escapeHtml(error)}</div>`;
    return;
  }

  container.innerHTML = drafts.map((draft, i) => {
    const isThread = draft.includes('\n') && draft.includes('/');
    const charCount = draft.replace(/\d+\/\s/g, '').length; // rough count
    return `
      <div class="xcs-draft-card" data-index="${i}">
        <div class="xcs-draft-label">${isThread ? '🧵 Thread option' : 'Draft'} ${i + 1}</div>
        <textarea class="xcs-draft-textarea" rows="${isThread ? 6 : 3}">${escapeHtml(draft)}</textarea>
        <div class="xcs-reply-footer">
          <span class="xcs-char-count">${charCount} chars</span>
          <div class="xcs-reply-btns">
            <button class="xcs-action-btn xcs-copy-btn">Copy</button>
            <button class="xcs-action-btn xcs-use-btn xcs-use-btn--primary">Post on X ↗</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.xcs-draft-card').forEach(card => {
    const textarea = card.querySelector('.xcs-draft-textarea');
    const charCount = card.querySelector('.xcs-char-count');

    textarea.addEventListener('input', () => {
      charCount.textContent = `${textarea.value.length} chars`;
    });

    card.querySelector('.xcs-copy-btn').addEventListener('click', (e) => {
      navigator.clipboard.writeText(textarea.value).then(() => {
        e.target.textContent = '✓';
        setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
      });
    });

    card.querySelector('.xcs-use-btn').addEventListener('click', () => {
      const text = textarea.value.trim();

      // Always copy the full draft to clipboard first
      navigator.clipboard.writeText(text).then(() => {
        // For the URL param, use full text for single tweets, first tweet for threads
        const isThread = text.includes('\n') && /^\d+\//.test(text);
        const urlText = isThread
          ? text.split('\n')[0].replace(/^\d+\/\s*/, '').trim()
          : text;

        // Open compose in a new tab (use anchor click to avoid popup-blocker)
        const encoded = encodeURIComponent(urlText.substring(0, 280));
        const a = document.createElement('a');
        a.href = `https://x.com/compose/tweet?text=${encoded}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();

        showToast(isThread
          ? '🧵 Full thread copied — paste tweet 1 in, then continue from clipboard'
          : '✓ Copied & opening X composer — just paste if text is missing'
        );
      }).catch(() => {
        // Clipboard failed (e.g. permissions) — still open compose
        const encoded = encodeURIComponent(text.substring(0, 280));
        const a = document.createElement('a');
        a.href = `https://x.com/compose/tweet?text=${encoded}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      });
    });
  });
}

// ============================================================
// CHAT TAB LOGIC
// ============================================================

async function sendChatMessage() {
  if (sidebarState.isLoading) return;

  const inputEl = document.getElementById('xcs-chat-input');
  const message = inputEl ? inputEl.value.trim() : '';
  if (!message) return;

  if (inputEl) inputEl.value = '';

  // Remove welcome state if present
  const welcome = document.querySelector('.xcs-chat-welcome');
  if (welcome) welcome.remove();

  // Render user message
  appendChatMessage('user', message);

  sidebarState.chatHistory.push({ role: 'user', content: message });

  showLoading('Thinking…');

  sendMessageWithTimeout({
    action: 'chatMessage',
    context: { message, history: sidebarState.chatHistory.slice(-8) }
  }).then((response) => {
    hideLoading();
    if (response.error) { appendChatMessage('assistant', `⚠️ ${response.error}`); return; }
    if (response.reply) {
      sidebarState.chatHistory.push({ role: 'assistant', content: response.reply });
      appendChatMessage('assistant', response.reply);
    }
  });
}

function appendChatMessage(role, text) {
  const messagesEl = document.getElementById('xcs-chat-messages');
  if (!messagesEl) return;

  const msgEl = document.createElement('div');
  msgEl.className = `xcs-chat-msg xcs-chat-msg--${role}`;

  // Convert markdown-style text to some basic formatting
  const formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  msgEl.innerHTML = `<div class="xcs-chat-bubble">${formattedText}</div>`;

  if (role === 'assistant') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'xcs-chat-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    msgEl.appendChild(copyBtn);
  }

  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Wraps chrome.runtime.sendMessage with:
// - a guard for invalidated extension context (runtime undefined after reload)
// - a client-side timeout so loading never hangs forever
function sendMessageWithTimeout(message, timeoutMs = 50000) {
  return new Promise((resolve) => {
    // chrome.runtime can become undefined if the extension was reloaded
    // while the tab is still open
    if (!chrome?.runtime?.sendMessage) {
      resolve({ error: 'Extension context lost — please refresh the page to reconnect.' });
      return;
    }

    const timer = setTimeout(() => {
      resolve({ error: 'Request timed out. The model may be slow — please try again.' });
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime?.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { error: 'No response from background script.' });
        }
      });
    } catch (err) {
      clearTimeout(timer);
      resolve({ error: 'Extension context lost — please refresh the page.' });
    }
  });
}

function extractTweetContext(tweetElement) {
  const text = getTweetText(tweetElement);
  const author = getTweetAuthor(tweetElement);
  const imageElements = tweetElement.querySelectorAll('[data-testid="tweetPhoto"] img');
  const images = Array.from(imageElements)
    .map(img => img.src)
    .filter(src => src && src.startsWith('http'));
  const hasVideo = !!tweetElement.querySelector('[data-testid="videoPlayer"]');
  const threadContext = extractThreadContext(tweetElement);

  return {
    text,
    author,
    images,
    hasImage: images.length > 0,
    hasVideo,
    threadContext,
    tweetElement // keep reference for reply population
  };
}

function getTweetText(element) {
  const el = element.querySelector(CONFIG.tweetTextSelector);
  return el ? (el.innerText || el.textContent) : '';
}

function getTweetAuthor(element) {
  const el = element.querySelector('[data-testid="User-Name"] a[role="link"]');
  if (el) {
    const href = el.getAttribute('href');
    return href ? href.replace('/', '') : '';
  }
  return '';
}

function extractThreadContext(tweetElement) {
  // Only collect thread context on tweet detail pages (/status/...)
  // On the main timeline, home feed, search, and profile pages, adjacent
  // sibling tweets are independent posts — grabbing them causes false context.
  if (!window.location.pathname.includes('/status/')) {
    return [];
  }

  const thread = [];
  const cell = tweetElement.closest('[data-testid="cellInnerDiv"]');
  if (!cell) return thread;

  const currentAuthor = getTweetAuthor(tweetElement);

  let current = cell.previousElementSibling;
  let count = 0;

  while (current && count < 2) {
    const tweet = current.querySelector('article[data-testid="tweet"]');
    if (tweet) {
      const text = getTweetText(tweet);
      const author = getTweetAuthor(tweet);

      // Only include if it's from the same thread author or a direct reply chain
      // (skip if a completely different unrelated author appeared, e.g. a promoted tweet)
      if (text && author) {
        thread.unshift({ text, author });
        count++;
      }
    }
    current = current.previousElementSibling;
  }

  return thread;
}

// ============================================================
// REPLY POPULATION
// ============================================================

function populateReply(tweetElement, replyText) {
  const replyButton = tweetElement.querySelector(CONFIG.replyButtonSelector);
  if (!replyButton) {
    navigator.clipboard.writeText(replyText);
    showToast('Copied — reply button not found, paste manually');
    return;
  }

  replyButton.click();
  setTimeout(() => {
    const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (composer) {
      composer.focus();
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', replyText);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        });
        composer.dispatchEvent(pasteEvent);

        setTimeout(() => {
          if (!composer.textContent || composer.textContent.trim() === '') {
            composer.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, replyText);
          }
        }, 100);
      } catch (e) {
        composer.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, replyText);
      }
    } else {
      navigator.clipboard.writeText(replyText);
      showToast('Copied — paste into reply composer');
    }
  }, 600);
}

// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const existing = document.getElementById('xcs-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'xcs-toast';
  toast.className = 'xcs-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('xcs-toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('xcs-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================================
// BULK DELETE FEATURE (kept as-is)
// ============================================================

let deleteState = {
  isRunning: false,
  isPaused: false,
  deletedCount: 0,
  failedCount: 0,
  totalEstimate: 0,
  errors: [],
  skipLoading: false,
  zeroTweetsCount: 0
};

function getCurrentUsername() {
  const url = window.location.href;
  const match = url.match(/x\.com\/([^\/]+)/);
  if (match) return match[1].toLowerCase();
  return null;
}

function isOnProfileRepliesPage() {
  const url = window.location.href;
  const isRepliesTab = url.includes('/with_replies');
  if (!isRepliesTab) return false;

  const hasEditButton = document.querySelector('[data-testid="userActions"]') ||
                        document.querySelector('a[href="/settings/profile"]') ||
                        document.querySelector('[aria-label*="Edit profile"]') ||
                        document.querySelector('a[data-testid="editProfileButton"]');

  const hasSavedState = !!sessionStorage.getItem('grokDeleteState');
  if (hasSavedState && isRepliesTab) return true;

  return isRepliesTab && hasEditButton;
}

function injectDeleteButton() {
  if (document.getElementById('grok-delete-all-btn')) return;

  const button = document.createElement('button');
  button.id = 'grok-delete-all-btn';
  button.className = 'grok-delete-all-btn';
  button.innerHTML = '🗑️ Delete All Replies';
  button.title = 'Delete all your replies on this page';
  button.addEventListener('click', showDeleteConfirmationModal);
  document.body.appendChild(button);
}

function isOwnTweet(tweetElement) {
  const currentUsername = getCurrentUsername();
  if (!currentUsername) return false;
  const authorLink = tweetElement.querySelector('a[href^="/"][role="link"]');
  if (!authorLink) return false;
  const href = authorLink.getAttribute('href');
  if (!href) return false;
  const match = href.match(/^\/([^\/]+)/);
  if (!match) return false;
  return match[1].toLowerCase() === currentUsername;
}

function getOwnTweets() {
  const allTweets = document.querySelectorAll(CONFIG.tweetSelector);
  return Array.from(allTweets).filter(tweet => isOwnTweet(tweet));
}

function showDeleteConfirmationModal() {
  deleteState.isRunning = false;
  window.grokDeleteResuming = false;
  sessionStorage.removeItem('grokDeleteState');

  const ownReplies = getOwnTweets();
  if (ownReplies.length === 0) {
    alert('No replies found to delete on this page. Make sure you\'re on your profile\'s Replies tab.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'grok-modal';
  modal.id = 'grok-delete-confirm-modal';
  modal.innerHTML = `
    <div class="grok-modal-content" style="max-width: 500px;">
      <div class="grok-modal-header">
        <h2>⚠️ Delete All Replies</h2>
        <button class="grok-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="grok-delete-confirm-content">
        <p class="grok-warning-text">This will permanently delete ALL your replies. This cannot be undone.</p>
        <p class="grok-info-text">Currently visible: <strong>${ownReplies.length}</strong> of your replies</p>
        <label class="grok-checkbox-label">
          <input type="checkbox" id="grok-delete-confirm-checkbox">
          <span>I understand this cannot be undone</span>
        </label>
      </div>
      <div class="grok-modal-footer">
        <button class="grok-cancel-btn" id="grok-cancel-delete">Cancel</button>
        <button class="grok-start-delete-btn" id="grok-start-delete" disabled>Start Deletion</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const checkbox = modal.querySelector('#grok-delete-confirm-checkbox');
  const startBtn = modal.querySelector('#grok-start-delete');

  checkbox.addEventListener('change', () => { startBtn.disabled = !checkbox.checked; });
  startBtn.addEventListener('click', () => { modal.remove(); startDeletionProcess(); });
  modal.querySelector('#grok-cancel-delete').addEventListener('click', () => modal.remove());
  modal.querySelector('.grok-close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showProgressModal() {
  const modal = document.createElement('div');
  modal.className = 'grok-modal';
  modal.id = 'grok-delete-progress-modal';
  modal.innerHTML = `
    <div class="grok-modal-content" style="max-width: 500px;">
      <div class="grok-modal-header"><h2>🗑️ Deleting Replies…</h2></div>
      <div class="grok-delete-progress-content">
        <div class="grok-progress-stats">
          <div class="grok-stat"><span class="grok-stat-label">Deleted:</span><span class="grok-stat-value" id="grok-deleted-count">0</span></div>
          <div class="grok-stat"><span class="grok-stat-label">Failed:</span><span class="grok-stat-value grok-error-text" id="grok-failed-count">0</span></div>
          <div class="grok-stat"><span class="grok-stat-label">Status:</span><span class="grok-stat-value" id="grok-status">Loading…</span></div>
        </div>
        <div class="grok-progress-bar"><div class="grok-progress-fill" id="grok-progress-fill"></div></div>
        <div class="grok-error-log" id="grok-error-log"></div>
      </div>
      <div class="grok-modal-footer">
        <button class="grok-skip-loading-btn" id="grok-skip-loading" style="display:none;">Skip Loading & Start</button>
        <button class="grok-pause-btn" id="grok-pause-delete">Pause</button>
        <button class="grok-cancel-btn" id="grok-stop-delete">Stop & Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const pauseBtn = modal.querySelector('#grok-pause-delete');
  pauseBtn.addEventListener('click', () => {
    deleteState.isPaused = !deleteState.isPaused;
    pauseBtn.textContent = deleteState.isPaused ? 'Resume' : 'Pause';
    updateProgressStatus(deleteState.isPaused ? 'Paused' : 'Deleting…');
  });

  modal.querySelector('#grok-stop-delete').addEventListener('click', () => {
    deleteState.isRunning = false;
    modal.remove();
  });

  const skipBtn = modal.querySelector('#grok-skip-loading');
  skipBtn.addEventListener('click', () => { deleteState.skipLoading = true; skipBtn.style.display = 'none'; });
  setTimeout(() => { if (skipBtn) skipBtn.style.display = 'block'; }, 3000);
}

function updateProgress() {
  const deletedEl = document.getElementById('grok-deleted-count');
  const failedEl = document.getElementById('grok-failed-count');
  const progressFill = document.getElementById('grok-progress-fill');
  if (deletedEl) deletedEl.textContent = deleteState.deletedCount;
  if (failedEl) failedEl.textContent = deleteState.failedCount;
  if (progressFill && deleteState.totalEstimate > 0) {
    const pct = ((deleteState.deletedCount + deleteState.failedCount) / deleteState.totalEstimate) * 100;
    progressFill.style.width = `${Math.min(pct, 100)}%`;
  }
}

function updateProgressStatus(status) {
  const el = document.getElementById('grok-status');
  if (el) el.textContent = status;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function deleteTweet(tweetElement) {
  try {
    if (!document.body.contains(tweetElement)) throw new Error('Tweet no longer in DOM');
    tweetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
    await wait(800);

    const caretButton = tweetElement.querySelector('[data-testid="caret"]');
    if (!caretButton) throw new Error('Could not find menu button');

    caretButton.click();
    await wait(1500);

    let menuItems = document.querySelectorAll('[role="menuitem"]');
    if (menuItems.length === 0) { await wait(1000); menuItems = document.querySelectorAll('[role="menuitem"]'); }

    let deleteMenuItem = null;
    for (const item of menuItems) {
      if ((item.textContent || '').trim().includes('Delete')) { deleteMenuItem = item; break; }
    }

    if (!deleteMenuItem) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(500);
      throw new Error('No Delete option found');
    }

    deleteMenuItem.click();
    await wait(1200);

    let confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
    if (!confirmButton) {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        if ((btn.textContent || '').trim() === 'Delete' && btn.offsetParent !== null) { confirmButton = btn; break; }
      }
    }

    if (!confirmButton) throw new Error('Could not find confirmation button');

    confirmButton.click();
    await wait(2500);
    return true;
  } catch (error) {
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(500);
    } catch (e) {}
    return false;
  }
}

async function startDeletionProcess() {
  if (deleteState.isRunning) return;

  if (deleteState.deletedCount > 0 || deleteState.batchCount > 0) {
    deleteState.isRunning = true;
  } else {
    deleteState = { isRunning: true, isPaused: false, deletedCount: 0, failedCount: 0, totalEstimate: 0, errors: [], skipLoading: false, batchCount: 0, zeroTweetsCount: 0 };
  }

  showProgressModal();
  updateProgressStatus('Deleting visible replies…');

  const skipBtn = document.getElementById('grok-skip-loading');
  if (skipBtn) skipBtn.style.display = 'none';

  while (deleteState.isRunning) {
    while (deleteState.isPaused && deleteState.isRunning) { await wait(500); }
    if (!deleteState.isRunning) break;

    deleteState.batchCount = (deleteState.batchCount || 0) + 1;
    const ownTweets = getOwnTweets();

    if (ownTweets.length === 0) {
      if (!deleteState.zeroTweetsCount) deleteState.zeroTweetsCount = 0;
      deleteState.zeroTweetsCount++;

      if (deleteState.zeroTweetsCount >= 2) {
        updateProgressStatus(`Complete! Deleted: ${deleteState.deletedCount}`);
        sessionStorage.removeItem('grokDeleteState');
        window.grokDeleteResuming = false;
        return;
      }

      updateProgressStatus('Refreshing…');
      sessionStorage.setItem('grokDeleteState', JSON.stringify({
        deletedCount: deleteState.deletedCount, failedCount: deleteState.failedCount,
        batchCount: deleteState.batchCount, zeroTweetsCount: deleteState.zeroTweetsCount, isRunning: true
      }));
      await wait(1000);
      location.reload();
      return;
    }

    deleteState.zeroTweetsCount = 0;
    const batchSize = Math.min(ownTweets.length, 5);
    updateProgressStatus(`Batch ${deleteState.batchCount}: Deleting ${batchSize}…`);

    for (let i = 0; i < batchSize; i++) {
      if (!deleteState.isRunning) break;
      while (deleteState.isPaused && deleteState.isRunning) { await wait(500); }
      const currentTweets = getOwnTweets();
      if (currentTweets.length === 0) break;

      const success = await deleteTweet(currentTweets[0]);
      if (success) { deleteState.deletedCount++; } else { deleteState.failedCount++; }
      updateProgress();
      await wait(2000);
    }

    updateProgressStatus(`Batch ${deleteState.batchCount} done. Refreshing…`);
    await wait(2000);

    sessionStorage.setItem('grokDeleteState', JSON.stringify({
      deletedCount: deleteState.deletedCount, failedCount: deleteState.failedCount,
      batchCount: deleteState.batchCount, isRunning: true
    }));
    location.reload();
    return;
  }

  if (deleteState.isRunning) {
    updateProgressStatus(`Complete! Deleted: ${deleteState.deletedCount}, Failed: ${deleteState.failedCount}`);
    sessionStorage.removeItem('grokDeleteState');
  }
}

function checkAndInjectDeleteButton() {
  if (isOnProfileRepliesPage()) {
    injectDeleteButton();
    checkAndResumeDelete();
  } else {
    const existingBtn = document.getElementById('grok-delete-all-btn');
    if (existingBtn) existingBtn.remove();
    sessionStorage.removeItem('grokDeleteState');
  }
}

function checkAndResumeDelete() {
  const savedState = sessionStorage.getItem('grokDeleteState');
  if (window.grokDeleteResuming || !savedState) return;

  try {
    const state = JSON.parse(savedState);
    if (!state.isRunning) return;

    window.grokDeleteResuming = true;
    deleteState = {
      isRunning: false, isPaused: false,
      deletedCount: state.deletedCount || 0, failedCount: state.failedCount || 0,
      totalEstimate: 0, errors: [], skipLoading: false,
      batchCount: state.batchCount || 0, zeroTweetsCount: state.zeroTweetsCount || 0
    };
    setTimeout(() => startDeletionProcess(), 3000);
  } catch (e) {
    sessionStorage.removeItem('grokDeleteState');
    window.grokDeleteResuming = false;
  }
}

function retryInjectDeleteButton() {
  checkAndInjectDeleteButton();
  setTimeout(checkAndInjectDeleteButton, 1000);
  setTimeout(checkAndInjectDeleteButton, 2000);
  setTimeout(checkAndInjectDeleteButton, 3000);
}

// ============================================================
// STARTUP
// ============================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', retryInjectDeleteButton);
} else {
  retryInjectDeleteButton();
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    retryInjectDeleteButton();
  }
}).observe(document, { subtree: true, childList: true });
