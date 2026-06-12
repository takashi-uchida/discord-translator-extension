chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'TRANSLATE') {
    handleTranslate(request.text).then(sendResponse);
    return true; // keep channel open for async response
  }
});

async function handleTranslate(text) {
  const { deeplApiKey } = await chrome.storage.sync.get('deeplApiKey');
  if (!deeplApiKey) {
    return { ok: false, error: 'API key not set. Click the extension icon to configure.' };
  }

  const baseUrl = deeplApiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com';

  try {
    const res = await fetch(`${baseUrl}/v2/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text], target_lang: 'JA' }),
    });

    if (!res.ok) {
      return { ok: false, error: `DeepL error: ${res.status}` };
    }

    const data = await res.json();
    const translation = data.translations?.[0];

    // Skip if already Japanese
    if (translation?.detected_source_language === 'JA') {
      return { ok: false, error: 'already_japanese' };
    }

    return { ok: true, text: translation?.text ?? '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
