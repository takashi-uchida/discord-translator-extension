const input = document.getElementById('apiKey');
const status = document.getElementById('status');

chrome.storage.sync.get('deeplApiKey', ({ deeplApiKey }) => {
  if (deeplApiKey) input.value = deeplApiKey;
});

function showStatus(msg, isError = false) {
  status.textContent = msg;
  status.className = isError ? 'error' : '';
}

document.getElementById('save').addEventListener('click', () => {
  const key = input.value.trim();
  if (!key) {
    showStatus('APIキーを入力してください', true);
    return;
  }
  chrome.storage.sync.set({ deeplApiKey: key }, () => {
    showStatus('✅ 保存しました');
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});

document.getElementById('test').addEventListener('click', async () => {
  const key = input.value.trim();
  if (!key) {
    showStatus('先にAPIキーを入力してください', true);
    return;
  }

  showStatus('⏳ テスト中...');

  const baseUrl = key.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com';

  try {
    const res = await fetch(`${baseUrl}/v2/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: ['Hello'], target_lang: 'JA' }),
    });

    if (res.ok) {
      const data = await res.json();
      const translated = data.translations?.[0]?.text ?? '?';
      showStatus(`✅ 成功: "Hello" → "${translated}"`);
    } else {
      showStatus(`❌ エラー: HTTP ${res.status}`, true);
    }
  } catch (e) {
    showStatus(`❌ 接続エラー: ${e.message}`, true);
  }
});
