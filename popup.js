// X Content Sidekick — Popup Settings Script

const $ = (id) => document.getElementById(id);

const apiKeyInput = $('apiKey');
const numRepliesInput = $('numReplies');
const numRepliesValue = $('numRepliesValue');
const enableVisionInput = $('enableVision');
const profileNameInput = $('profileName');
const profileDomainInput = $('profileDomain');
const profileVoiceStyleInput = $('profileVoiceStyle');
const profileGoalInput = $('profileGoal');
const profileNotesInput = $('profileNotes');
const saveBtn = $('saveBtn');
const testBtn = $('testBtn');
const statusMsg = $('statusMsg');
const togglePasswordBtn = $('togglePassword');

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get({
    apiKey: '',
    numReplies: 3,
    enableVision: true,
    profileName: '',
    profileDomain: '',
    profileVoiceStyle: 'Conversational',
    profileGoal: 'Build thought leadership',
    profileNotes: ''
  }, (items) => {
    apiKeyInput.value = items.apiKey;
    numRepliesInput.value = items.numReplies;
    numRepliesValue.textContent = items.numReplies;
    enableVisionInput.checked = items.enableVision;
    profileNameInput.value = items.profileName;
    profileDomainInput.value = items.profileDomain;
    profileVoiceStyleInput.value = items.profileVoiceStyle;
    profileGoalInput.value = items.profileGoal;
    profileNotesInput.value = items.profileNotes;
  });
}

// Save settings
function saveSettings() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter your xAI API key', 'error');
    return;
  }

  if (!apiKey.startsWith('xai-')) {
    showStatus('API key should start with "xai-"', 'error');
    return;
  }

  chrome.storage.sync.set({
    apiKey,
    numReplies: parseInt(numRepliesInput.value),
    enableVision: enableVisionInput.checked,
    profileName: profileNameInput.value.trim(),
    profileDomain: profileDomainInput.value.trim(),
    profileVoiceStyle: profileVoiceStyleInput.value,
    profileGoal: profileGoalInput.value,
    profileNotes: profileNotesInput.value.trim()
  }, () => {
    showStatus('✓ Settings saved', 'success');
    setTimeout(hideStatus, 3000);
  });
}

// Test API connection
function testConnection() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { showStatus('Enter your API key first', 'error'); return; }

  testBtn.disabled = true;
  testBtn.textContent = 'Testing…';
  showStatus('Testing API connection…', 'success');

  chrome.storage.sync.set({ apiKey }, () => {
    chrome.runtime.sendMessage({ action: 'testConnection' }, (response) => {
      testBtn.disabled = false;
      testBtn.textContent = 'Test API';

      if (response && response.success) {
        showStatus(`✓ Connected! Sample: "${response.testReply.substring(0, 80)}…"`, 'success');
      } else {
        showStatus(`✗ Failed: ${response ? response.error : 'Unknown error'}`, 'error');
      }
    });
  });
}

function showStatus(message, type) {
  statusMsg.textContent = message;
  statusMsg.className = `status-msg ${type}`;
}

function hideStatus() {
  statusMsg.className = 'status-msg';
}

function togglePasswordVisibility() {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    togglePasswordBtn.textContent = 'Hide';
  } else {
    apiKeyInput.type = 'password';
    togglePasswordBtn.textContent = 'Show';
  }
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);
testBtn.addEventListener('click', testConnection);
togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
numRepliesInput.addEventListener('input', () => {
  numRepliesValue.textContent = numRepliesInput.value;
});
apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') saveSettings();
});

loadSettings();
