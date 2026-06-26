const processed = new WeakSet();
const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff]/;

let activeComposer = null;

// Find message content inside a message list item.
// li id format: "chat-messages-{channelId}-{messageId}"
// Content id format: "message-content-{messageId}"
// Using the message ID ensures we get the actual message, not a reply preview.
function getContentEl(liEl) {
  const parts = liEl.id.split('-');
  const messageId = parts[parts.length - 1];

  if (messageId) {
    const exact = liEl.querySelector(`[id="message-content-${messageId}"]`);
    if (exact) return exact;
  }

  // Fallback: class-based, but skip reply preview containers
  const replyPreview = liEl.querySelector('[class*="repliedMessage"], [class*="replyContext"]');
  const candidates = liEl.querySelectorAll('[class*="messageContent"], [class*="markup_"]');
  for (const el of candidates) {
    if (!replyPreview?.contains(el)) return el;
  }

  return null;
}

function processMessage(liEl) {
  if (processed.has(liEl)) return;

  const contentEl = getContentEl(liEl);
  if (!contentEl || !contentEl.textContent.trim()) return;

  processed.add(liEl);

  const btn = document.createElement('button');
  btn.className = 'djt-btn';
  btn.title = '日本語に翻訳';
  btn.textContent = '🌐';

  // Append button directly into the list item so React doesn't remove it
  liEl.appendChild(btn);

  let resultEl = null;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();

    if (resultEl) {
      resultEl.remove();
      resultEl = null;
      btn.textContent = '🌐';
      return;
    }

    const text = contentEl.innerText.trim();
    if (!text) return;

    btn.textContent = '⏳';
    btn.disabled = true;

    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: 'TRANSLATE', text, targetLang: 'JA' });
    } catch (err) {
      btn.textContent = '❌';
      btn.disabled = false;
      return;
    }

    btn.disabled = false;

    if (res.ok) {
      resultEl = document.createElement('div');
      resultEl.className = 'djt-result';
      resultEl.textContent = res.text;
      liEl.appendChild(resultEl);
      btn.textContent = '✅';
    } else if (res.error === 'already_japanese') {
      btn.textContent = '🇯🇵';
      setTimeout(() => { btn.textContent = '🌐'; }, 1500);
    } else {
      resultEl = document.createElement('div');
      resultEl.className = 'djt-result djt-error';
      resultEl.textContent = `❌ ${res.error ?? '翻訳失敗'}`;
      liEl.appendChild(resultEl);
      btn.textContent = '❌';
      setTimeout(() => { btn.textContent = '🌐'; }, 3000);
    }
  });
}

function hasJapanese(text) {
  return JAPANESE_RE.test(text);
}

function getComposerEditor() {
  const selectors = [
    '[data-slate-editor="true"][contenteditable="true"][role="textbox"]',
    '[data-slate-editor="true"][contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
  ];

  for (const selector of selectors) {
    const editor = document.querySelector(selector);
    if (editor) return editor;
  }

  return null;
}

function getComposerContainer(editor) {
  return editor.closest('[class*="channelTextArea"], [class*="scrollableContainer"], [class*="textArea"], form')
    ?? editor.parentElement;
}

function getComposerText(editor) {
  return (editor.innerText || editor.textContent || '')
    .replace(/\u200B/g, '')
    .trim();
}

function showComposerStatus(statusEl, message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('djt-input-status-error', isError);

  if (message) {
    const shownMessage = message;
    setTimeout(() => {
      if (statusEl.textContent === shownMessage) {
        statusEl.textContent = '';
        statusEl.classList.remove('djt-input-status-error');
      }
    }, 3000);
  }
}

function updateComposerButtonVisibility(editor, button) {
  button.hidden = !hasJapanese(getComposerText(editor));
}

function setComposerText(editor, text) {
  editor.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);

  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, text);
  } catch (_err) {
    inserted = false;
  }

  if (!inserted) {
    editor.textContent = text;
    const event = typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
      : new Event('input', { bubbles: true });
    editor.dispatchEvent(event);
  }

  const endRange = document.createRange();
  endRange.selectNodeContents(editor);
  endRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(endRange);
}

function resetActiveComposer() {
  if (!activeComposer) return;

  activeComposer.editor.removeEventListener('input', activeComposer.onInput, true);
  activeComposer.editor.removeEventListener('keyup', activeComposer.onInput, true);
  activeComposer.button.remove();
  activeComposer.status.remove();
  activeComposer = null;
}

async function translateComposerToEnglish(editor, button, statusEl) {
  const text = getComposerText(editor);
  if (!text) return;

  if (!hasJapanese(text)) {
    showComposerStatus(statusEl, '日本語が含まれていません', true);
    return;
  }

  button.hidden = false;
  button.disabled = true;
  button.textContent = '⏳';
  showComposerStatus(statusEl, '英訳中...');

  let res;
  try {
    res = await chrome.runtime.sendMessage({
      type: 'TRANSLATE',
      text,
      targetLang: 'EN-US',
      sourceLang: 'JA',
    });
  } catch (err) {
    showComposerStatus(statusEl, `翻訳失敗: ${err.message}`, true);
    button.textContent = '❌';
    button.disabled = false;
    setTimeout(() => {
      button.textContent = '英訳';
      updateComposerButtonVisibility(editor, button);
    }, 2000);
    return;
  }

  button.disabled = false;

  if (res.ok && res.text) {
    setComposerText(editor, res.text);
    button.hidden = false;
    button.textContent = '✅';
    showComposerStatus(statusEl, '英訳しました');
    setTimeout(() => {
      button.textContent = '英訳';
      updateComposerButtonVisibility(editor, button);
    }, 1500);
  } else {
    button.textContent = '❌';
    showComposerStatus(statusEl, `翻訳失敗: ${res.error ?? 'unknown error'}`, true);
    setTimeout(() => {
      button.textContent = '英訳';
      updateComposerButtonVisibility(editor, button);
    }, 2500);
  }
}

function ensureComposerTranslateButton() {
  const editor = getComposerEditor();
  if (!editor) {
    resetActiveComposer();
    return;
  }

  if (activeComposer?.editor === editor && activeComposer.button.isConnected) {
    updateComposerButtonVisibility(editor, activeComposer.button);
    return;
  }

  resetActiveComposer();

  const container = getComposerContainer(editor);
  if (!container) return;

  container.classList.add('djt-input-anchor');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'djt-input-btn';
  button.title = '入力中の日本語を英語に翻訳';
  button.textContent = '英訳';

  const status = document.createElement('span');
  status.className = 'djt-input-status';

  const onInput = () => updateComposerButtonVisibility(editor, button);

  editor.addEventListener('input', onInput, true);
  editor.addEventListener('keyup', onInput, true);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    translateComposerToEnglish(editor, button, status);
  });

  container.appendChild(button);
  container.appendChild(status);

  activeComposer = { editor, button, status, onInput };
  updateComposerButtonVisibility(editor, button);
}

function scanMessages() {
  // Primary: stable Discord message list item IDs
  const byMsgId = document.querySelectorAll('li[id^="chat-messages-"]');
  if (byMsgId.length > 0) {
    byMsgId.forEach(processMessage);
    return;
  }

  // Fallback: class-based message list items
  document.querySelectorAll('[class*="messageListItem"]').forEach(processMessage);
}

function scan() {
  scanMessages();
  ensureComposerTranslateButton();
}

const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });

// Wait for Discord to finish rendering before first scan
setTimeout(scan, 1500);

// Discord's composer can update without always replacing large DOM chunks.
setInterval(ensureComposerTranslateButton, 2000);
