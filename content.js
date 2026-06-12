const processed = new WeakSet();

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
      res = await chrome.runtime.sendMessage({ type: 'TRANSLATE', text });
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

function scan() {
  // Primary: stable Discord message list item IDs
  const byMsgId = document.querySelectorAll('li[id^="chat-messages-"]');
  if (byMsgId.length > 0) {
    byMsgId.forEach(processMessage);
    return;
  }
  // Fallback: class-based message list items
  document.querySelectorAll('[class*="messageListItem"]').forEach(processMessage);
}

const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });

// Wait for Discord to finish rendering before first scan
setTimeout(scan, 1500);
