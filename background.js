chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'TRANSLATE') {
    handleTranslate(request).then(sendResponse);
    return true; // keep channel open for async response
  }
});

function normalizeLanguageCode(lang) {
  return String(lang || '')
    .split('-')[0]
    .toUpperCase();
}

async function handleTranslate(request) {
  const { deeplApiKey } = await chrome.storage.sync.get('deeplApiKey');
  if (!deeplApiKey) {
    return { ok: false, error: 'API key not set. Click the extension icon to configure.' };
  }

  const text = request.text;
  const targetLang = request.targetLang || 'JA';
  const sourceLang = request.sourceLang;

  if (!text?.trim()) {
    return { ok: false, error: 'Text is empty.' };
  }

  const baseUrl = deeplApiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com';

  const body = {
    text: [text],
    target_lang: targetLang,
  };

  if (sourceLang) {
    body.source_lang = sourceLang;
  }

  try {
    const res = await fetch(`${baseUrl}/v2/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ok: false, error: `DeepL error: ${res.status}` };
    }

    const data = await res.json();
    const translation = data.translations?.[0];

    // Skip if it is already in the requested target language.
    if (
      translation?.detected_source_language
      && normalizeLanguageCode(translation.detected_source_language) === normalizeLanguageCode(targetLang)
    ) {
      return {
        ok: false,
        error: normalizeLanguageCode(targetLang) === 'JA' ? 'already_japanese' : 'already_target_language',
      };
    }

    return { ok: true, text: translation?.text ?? '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
