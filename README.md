# Discord 日本語翻訳 Chrome拡張機能

Discordのメッセージにカーソルを合わせると 🌐 ボタンが表示され、クリックで日本語翻訳を表示します。翻訳には DeepL API を使用します。

また、コメント入力欄に日本語を入力すると **英訳** ボタンが表示され、クリックすると入力中の日本語を英語に置き換えられます。

## セットアップ

1. [DeepL API](https://www.deepl.com/ja/pro-api) で無料アカウント登録しAPIキーを取得
2. Chrome で `chrome://extensions` を開く
3. **「デベロッパーモード」** を ON にする
4. **「パッケージ化されていない拡張機能を読み込む」** でこのフォルダを選択
5. ツールバーの拡張機能アイコンをクリックしてAPIキーを入力・保存

## 使い方

| 操作 | 動作 |
|------|------|
| メッセージにホバー → 🌐 クリック | 日本語翻訳を表示 |
| ✅ をクリック | 翻訳を非表示 |
| コメント入力欄に日本語を入力 → 英訳をクリック | 入力中の日本語を英語に置き換え |

## GitHub Actions

`.github/workflows/chrome-extension.yml` でChrome拡張の公開準備用ワークフローを用意しています。

| トリガー | 動作 |
|---|---|
| `push` to `main` | `manifest.json` を検証し、公開用ZIPをartifactとして作成 |
| `pull_request` to `main` | `manifest.json` を検証し、公開用ZIPをartifactとして作成 |
| `workflow_dispatch` | ZIP作成に加えて、必要なSecretsがあればChrome Web Storeへのアップロード/公開も実行可能 |

### Chrome Web Storeへアップロードする場合

GitHubリポジトリの `Settings` → `Secrets and variables` → `Actions` に以下を登録します。

| Secret | 内容 |
|---|---|
| `CHROME_EXTENSION_ID` | Chrome Web Storeの拡張機能ID |
| `CHROME_CLIENT_ID` | Google Cloud OAuth Client ID |
| `CHROME_CLIENT_SECRET` | Google Cloud OAuth Client Secret |
| `CHROME_REFRESH_TOKEN` | Chrome Web Store API用のOAuth Refresh Token |

Secretsを登録後、GitHub Actionsの **Chrome Extension** ワークフローを手動実行し、`upload_to_chrome_web_store` を `true` にするとChrome Web StoreへZIPをアップロードできます。`publish` も `true` にすると、アップロード後に公開リクエストを送ります。

## DeepL 無料枠

無料プランは **月50万文字** まで使用可能。

| メッセージの長さ | 月の目安回数 |
|---|---|
| 短め（50文字） | 約10,000回 |
| 普通（150文字） | 約3,300回 |
| 長め（500文字） | 約1,000回 |

1日100メッセージ翻訳しても月450,000文字程度なので、通常利用では無料枠で十分です。  
残り文字数は [DeepL アカウントページ](https://www.deepl.com/ja/account) で確認できます。
