# Codex Sample Game

GitHub Pages にデプロイするための最小構成の Web ゲームです。リポジトリの `Settings > Pages` で `main` ブランチのルートを公開すれば、そのままホスティングできます。

## 開発

```bash
npm install # 依存はありませんが lockfile の更新に利用します
npm test    # Node.js の組み込みテスティングフレームワークで実行
```

開発時は任意の HTTP サーバーでルートを配信してください。例: `npx serve .`。
CI では GitHub Actions が `npm test` を自動実行し、ゲームロジックのユニットテストを検証します。

## 仕組み

- `index.html` – ページのマークアップと UI。
- `style.css` – GitHub Pages でもそのまま読み込めるシンプルなスタイル。
- `game.js` – Canvas を使ったシンプルなコア集めゲーム。ハイスコアは `localStorage` に保存されます。

## デプロイ手順

1. main ブランチにプッシュ。
2. GitHub の `Settings > Pages` で Branch を `main`, Folder を `/ (root)` に設定。
3. 数分待つと `https://<your-account>.github.io/<repo-name>/` でアクセスできます。
