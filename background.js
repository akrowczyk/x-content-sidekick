// X Content Sidekick — Background Service Worker
// Handles xAI API integration and message passing

const XAI_API_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const XAI_TEXT_MODEL = 'grok-4-1-fast-non-reasoning';
const XAI_VISION_MODEL = 'grok-4-1-fast-non-reasoning';

// ============================================================
// SYSTEM PROMPTS
// ============================================================

// Engage prompt: helps reply to tweets in a thoughtful, brand-building way
const SIDEKICK_ENGAGE_PROMPT = (voiceProfile) => `You are a professional content assistant helping ${voiceProfile.name || 'a professional'} engage on X (Twitter) in a way that builds their personal brand and professional reputation.

ABOUT THE USER:
- Name/Handle: ${voiceProfile.name || 'the user'}
- Professional Domain: ${voiceProfile.domain || 'technology / business'}
- Voice Style: ${voiceProfile.voiceStyle || 'Conversational'}
- Engagement Goal: ${voiceProfile.engagementGoal || 'Build thought leadership'}
- Voice Notes: ${voiceProfile.voiceNotes || 'Be thoughtful, direct, and genuine.'}

YOUR ROLE:
Generate reply options that help the user engage meaningfully on X. Each reply should feel like it came from a real, intelligent professional — not a bot, not a hype machine.

TONE RULES:
- Sound like a smart human, not an AI assistant
- Match the energy of the tweet being replied to
- Be specific — reference the actual content of the tweet
- No sycophantic openers ("Great point!", "Totally agree!", "Love this!")
- No hollow affirmations — add real substance
- Avoid jargon unless it genuinely fits the domain
- Natural length: 80–250 characters usually. Never over 280.
- Contractions are fine. Casual is fine. Just not sloppy.
- One clear thought per reply — don't try to say everything

ENGAGEMENT MODES (the user picks one — honor it):
- INSIGHT: Add a smart, substantive perspective. A data point, a related observation, an angle they didn't mention.
- QUESTION: Ask a single compelling, genuine question that makes people think and want to respond. Not rhetorical — actually curious.
- CONNECT: A warm but professional reply that builds genuine rapport with the author. Show you read it carefully.
- CHALLENGE: Respectfully push back with a counter-perspective or a nuance they missed. Be direct, not combative.
- EXPAND: Build on their point — add a related idea, example, or implication that enriches the conversation.

OUTPUT FORMAT:
Return exactly the number of replies requested, one per line. No numbering, no labels, no quotes. Just the reply text, ready to post.
`;

// Compose prompt: helps draft original tweets and threads
const SIDEKICK_COMPOSE_PROMPT = (voiceProfile) => `You are a professional content strategist helping ${voiceProfile.name || 'the user'} create original content on X (Twitter).

ABOUT THE USER:
- Professional Domain: ${voiceProfile.domain || 'technology / business'}
- Voice Style: ${voiceProfile.voiceStyle || 'Conversational'}
- Engagement Goal: ${voiceProfile.engagementGoal || 'Build thought leadership'}
- Voice Notes: ${voiceProfile.voiceNotes || 'Be thoughtful, direct, and genuine.'}

YOUR ROLE:
Draft polished, engaging tweet options that sound authentically like the user — not AI-generated, not generic, not hollow.

QUALITY PRINCIPLES:
- Hook matters most: The first line must make people stop scrolling
- Specificity beats vagueness every time
- Real perspective > safe takes
- Teach, challenge, or entertain — ideally all three
- No buzzword soup ("game-changer", "leverage synergies", etc.)
- End with something that invites response (implicit or explicit)
- Match the requested format (single tweet, thread, etc.)

TWEET CHARACTER LIMITS:
- Single tweet: max 280 characters
- Thread: each tweet max 280 characters, but make each one count standalone too

OUTPUT FORMAT:
If single tweet: return each draft separated by a blank line. No numbering or labels.
If thread: format as numbered tweets like "1/ [text]", "2/ [text]" etc. Separate different thread options with "---".
`;

// Chat prompt: conversational content strategy coach
const SIDEKICK_CHAT_PROMPT = (voiceProfile) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `You are a smart, direct content strategy coach specializing in X (Twitter) for professionals who want to build genuine authority and audience in their field.

TODAY'S DATE: ${dateStr}
(Use this as the authoritative current date for any week-based, seasonal, or time-sensitive advice.)

ABOUT THE USER YOU'RE COACHING:
- Name/Handle: ${voiceProfile.name || 'a professional'}
- Professional Domain: ${voiceProfile.domain || 'technology / business'}
- Voice Style: ${voiceProfile.voiceStyle || 'Conversational'}
- Engagement Goal: ${voiceProfile.engagementGoal || 'Build thought leadership'}
- Voice Notes: ${voiceProfile.voiceNotes || ''}

YOUR APPROACH:
- Be direct and practical. Give specific, actionable advice — not vague platitudes.
- Draw on real knowledge of how X algorithms, engagement patterns, and audience growth work.
- Help them think, don't just do the work for them.
- If they share a draft tweet, give candid feedback and a better version.
- If they ask for content ideas, give specific, interesting angles — not "write about your journey".
- Keep responses concise. This is a conversation, not an essay.
- You understand their domain. Engage with the actual substance of their topics.

Remember: the goal is authentic brand building, not chasing viral moments. Quality over quantity. Genuine engagement over performance.
`;
};

// ============================================================
// HELPERS
// ============================================================

function buildVoiceProfile(settings) {
  return {
    name: settings.profileName || '',
    domain: settings.profileDomain || 'technology / business',
    voiceStyle: settings.profileVoiceStyle || 'Conversational',
    engagementGoal: settings.profileGoal || 'Build thought leadership',
    voiceNotes: settings.profileNotes || ''
  };
}

function buildEngagePrompt(context, settings) {
  let prompt = '';

  if (context.threadContext && context.threadContext.length > 0) {
    prompt += `CONVERSATION CONTEXT:\n`;
    context.threadContext.forEach((tweet, index) => {
      prompt += `${index + 1}. @${tweet.author}: "${tweet.text}"\n`;
    });
    prompt += `\n---\n\n`;
  }

  prompt += `TWEET TO REPLY TO`;
  if (context.author) prompt += ` (by @${context.author})`;
  prompt += `:\n`;
  prompt += context.text ? `"${context.text}"\n\n` : `[Image/video-only tweet]\n\n`;

  if (context.images && context.images.length > 0) {
    prompt += `[Tweet includes ${context.images.length} image(s)]\n`;
  }
  if (context.hasVideo) {
    prompt += `[Tweet includes a video]\n`;
  }

  const mode = context.engageMode || 'INSIGHT';
  prompt += `\nENGAGEMENT MODE: ${mode.toUpperCase()}\n`;

  switch (mode.toLowerCase()) {
    case 'insight':
      prompt += `Add a smart, substantive perspective — a data point, angle, or observation that enriches the conversation.\n`;
      break;
    case 'question':
      prompt += `Ask a single compelling, genuine question that makes people think. It should feel naturally curious, not rhetorical.\n`;
      break;
    case 'connect':
      prompt += `Write a warm, professional reply that builds genuine rapport with the author — show you read carefully and engage with specifics.\n`;
      break;
    case 'challenge':
      prompt += `Respectfully push back with a counter-perspective or nuance they missed. Be direct and honest, not combative.\n`;
      break;
    case 'expand':
      prompt += `Build on their point — add a related idea, example, or implication that makes the conversation richer.\n`;
      break;
  }

  if (context.refinementInstruction) {
    prompt += `\nADDITIONAL INSTRUCTION: ${context.refinementInstruction}\n`;
  }

  prompt += `\nGenerate ${settings.numReplies} distinct reply options. Each on its own line. No numbering, no labels, no quotes.`;

  return prompt;
}

function buildComposePrompt(context) {
  let prompt = `TOPIC: ${context.topic}\n`;
  prompt += `FORMAT: ${context.format || 'single tweet'}\n`;
  if (context.tone) prompt += `TONE: ${context.tone}\n`;
  prompt += `\nGenerate 3 distinct draft options for this content.`;
  if (context.format && context.format.includes('thread')) {
    prompt += ` Format each as a numbered thread (1/, 2/, etc.). Separate different thread options with "---".`;
  } else {
    prompt += ` Separate each draft with a blank line.`;
  }
  return prompt;
}

// ============================================================
// API CALL
// ============================================================

async function callGrokAPI(apiKey, systemPrompt, userPrompt, context = {}, enableVision = true) {
  const useVision = (context.images && context.images.length > 0 && enableVision);
  const model = useVision ? XAI_VISION_MODEL : XAI_TEXT_MODEL;

  const userMessage = useVision
    ? {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          ...context.images.map(url => ({ type: 'image_url', image_url: { url } }))
        ]
      }
    : { role: 'user', content: userPrompt };

  // Keepalive: ping the runtime to prevent MV3 service worker from sleeping mid-fetch
  const keepaliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);

  try {
    const response = await fetch(XAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          userMessage
        ],
        temperature: 0.85,
        stream: false
      }),
      signal: AbortSignal.timeout(45000) // 45s hard timeout on the fetch
    });

    clearInterval(keepaliveInterval);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('xAI API error body:', JSON.stringify(errorData));
      if (response.status === 401) throw new Error('Invalid API key. Please check your xAI API key in settings.');
      if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      const detail = errorData.error?.message || errorData.message || errorData.error?.type || JSON.stringify(errorData);
      throw new Error(`API error ${response.status}: ${detail || 'unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from API');
    return content;

  } catch (error) {
    clearInterval(keepaliveInterval);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('Request timed out (45s). The model may be busy — please try again.');
    }
    throw error;
  }
}

// ============================================================
// PARSERS
// ============================================================

function parseReplies(content, numReplies) {
  let replies = [];

  // Numbered format
  if (content.match(/^\d+[\.)]\s*/m)) {
    replies = content.split(/^\d+[\.)]\s*/m).filter(r => r.trim().length > 0).map(r => r.trim());
  }
  // Double newline
  else if (content.includes('\n\n')) {
    replies = content.split('\n\n').filter(r => r.trim().length > 0).map(r => r.trim());
  }
  // Single newline matches expected count
  else if (content.split('\n').length === numReplies) {
    replies = content.split('\n').filter(r => r.trim().length > 0).map(r => r.trim());
  }
  else {
    replies = content.split('\n').filter(r => r.trim().length >= 10).map(r => r.trim());
  }

  replies = replies.map(r => {
    r = r.replace(/^[\d.)]+\s*/, '');
    if (r.startsWith('"') && r.endsWith('"')) r = r.slice(1, -1);
    return r.trim();
  }).filter(r => r.length >= 5);

  return replies.slice(0, numReplies);
}

function parseComposeDrafts(content) {
  // Split on "---" separators first (for threads)
  if (content.includes('---')) {
    return content.split('---').map(d => d.trim()).filter(d => d.length > 0);
  }
  // Otherwise split on double newlines
  const drafts = content.split('\n\n').map(d => d.trim()).filter(d => d.length > 10);
  return drafts.length > 0 ? drafts : [content.trim()];
}

// ============================================================
// MESSAGE HANDLERS
// ============================================================

async function handleGenerateReplies(context, sendResponse) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      sendResponse({ error: 'API key not configured. Click the extension icon to set your xAI API key.' });
      return;
    }
    const voiceProfile = buildVoiceProfile(settings);
    const systemPrompt = SIDEKICK_ENGAGE_PROMPT(voiceProfile);
    const userPrompt = buildEngagePrompt(context, settings);
    const rawContent = await callGrokAPI(settings.apiKey, systemPrompt, userPrompt, context, settings.enableVision);
    const replies = parseReplies(rawContent, settings.numReplies);
    sendResponse({ replies });
  } catch (error) {
    console.error('X Content Sidekick — Engage Error:', error);
    sendResponse({ error: error.message || 'Failed to generate replies. Please try again.' });
  }
}

async function handleComposeTweet(context, sendResponse) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      sendResponse({ error: 'API key not configured. Click the extension icon to set your xAI API key.' });
      return;
    }
    const voiceProfile = buildVoiceProfile(settings);
    const systemPrompt = SIDEKICK_COMPOSE_PROMPT(voiceProfile);
    const userPrompt = buildComposePrompt(context);
    const rawContent = await callGrokAPI(settings.apiKey, systemPrompt, userPrompt);
    const drafts = parseComposeDrafts(rawContent);
    sendResponse({ drafts });
  } catch (error) {
    console.error('X Content Sidekick — Compose Error:', error);
    sendResponse({ error: error.message || 'Failed to compose tweet. Please try again.' });
  }
}

async function handleChatMessage(context, sendResponse) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      sendResponse({ error: 'API key not configured. Click the extension icon to set your xAI API key.' });
      return;
    }
    const voiceProfile = buildVoiceProfile(settings);
    const systemPrompt = SIDEKICK_CHAT_PROMPT(voiceProfile);

    // Build conversation from history
    const messages = [{ role: 'system', content: systemPrompt }];
    if (context.history && context.history.length > 0) {
      context.history.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }
    messages.push({ role: 'user', content: context.message });

    const response = await fetch(XAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: XAI_TEXT_MODEL,
        messages,
        temperature: 0.85,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('Invalid API key.');
      if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.');
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('No response from API');
    sendResponse({ reply });
  } catch (error) {
    console.error('X Content Sidekick — Chat Error:', error);
    sendResponse({ error: error.message || 'Chat failed. Please try again.' });
  }
}

async function testApiConnection(sendResponse) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      sendResponse({ success: false, error: 'No API key configured' });
      return;
    }
    const voiceProfile = buildVoiceProfile(settings);
    const systemPrompt = SIDEKICK_ENGAGE_PROMPT(voiceProfile);
    const userPrompt = 'TWEET TO REPLY TO (by @example):\n"Excited to announce our new product launch!"\n\nENGAGEMENT MODE: QUESTION\nAsk a genuine, curious question.\n\nGenerate 1 reply.';
    const content = await callGrokAPI(settings.apiKey, systemPrompt, userPrompt);
    sendResponse({ success: true, message: 'Connection successful!', testReply: content.trim() });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================
// SETTINGS
// ============================================================

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      apiKey: '',
      numReplies: 3,
      enableVision: true,
      profileName: '',
      profileDomain: '',
      profileVoiceStyle: 'Conversational',
      profileGoal: 'Build thought leadership',
      profileNotes: ''
    }, resolve);
  });
}

// ============================================================
// MESSAGE LISTENER
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateReplies') {
    handleGenerateReplies(request.context, sendResponse);
    return true;
  }
  if (request.action === 'composeTweet') {
    handleComposeTweet(request.context, sendResponse);
    return true;
  }
  if (request.action === 'chatMessage') {
    handleChatMessage(request.context, sendResponse);
    return true;
  }
  if (request.action === 'testConnection') {
    testApiConnection(sendResponse);
    return true;
  }
});
