# GAS Dashboard - 求人データ分析ダッシュボード

## 🔗 重要リンク

| 項目 | URL |
|------|-----|
| **スプレッドシート** | https://docs.google.com/spreadsheets/d/1OaSTHobXnz23O3D98aFo6wFD08fDmjqn6YtI_lJv1Pk |
| **GASエディタ** | https://script.google.com/home/projects/1XVs-9zCl9HORvWDKoft2B9P2jcn6j3tnSg86RicXfPx3KBAjtSwPhhpN/edit |

## 📁 プロジェクト構成

| ファイル | 説明 |
|----------|------|
| `Code.js` | メイン処理（CSVインポート、メニュー、診断） |
| `LocationParser.js` | 住所解析モジュール（都道府県・市区町村抽出） |
| `DataLayer.js` | データアクセス層（キャッシュ・増分更新） |
| `ApiHandler.js` | API処理（クライアント向けデータ提供） |
| `Aggregator.js` | 集計処理（給与・雇用形態・地域分析） |
| `CombinedView.html` | ダッシュボードUI |

## 🧪 テスト関数一覧

### GASエディタでの実行方法
1. 上記GASエディタURLを開く
2. 左側のファイル一覧から `LocationParser.js` を選択
3. 上部の関数選択ドロップダウンで関数を選択
4. ▶ 実行ボタンをクリック
5. 「実行ログ」タブで結果を確認

### 主要テスト関数

| 関数名 | 説明 | ファイル |
|--------|------|----------|
| `runAllLocationTests` | **包括的テストスイート（推奨）** - 全7カテゴリ77テスト | LocationParser.js |
| `runNationwideComprehensiveTest` | **全国網羅テスト** - 6カテゴリ133テスト（汎用性検証） | LocationParser.js |
| `testCompanyLocationSeparation` | 事業所名と所在地の誤変換テスト | LocationParser.js |
| `testAliasConversion` | エイリアス変換テスト | LocationParser.js |
| `testSameNameWards` | 同名区問題テスト（中央区・北区など） | LocationParser.js |
| `testReverseProof` | 逆証明テスト（修正検証） | LocationParser.js |
| `testContextPrefecture` | コンテキスト都道府県テスト | LocationParser.js |
| `testBoundaryValues` | 境界値テスト | LocationParser.js |
| `testRealDataPatterns` | 実データパターンテスト | LocationParser.js |
| `testDataFlowIntegrity` | データフロー整合性テスト | LocationParser.js |
| `testTokyoKyotoFix` | 東京/京都誤変換テスト | LocationParser.js |
| `testAllPrefectures` | 47都道府県認識テスト | LocationParser.js |
| `testAllDesignatedCities` | 全20政令指定都市テスト | LocationParser.js |
| `testSameNameCities` | 同名市区町村テスト（府中市、伊達市など） | LocationParser.js |
| `testDangerousPatterns` | 危険パターンテスト（誤変換防止） | LocationParser.js |
| `runComprehensiveDiagnostic` | 20パターン包括診断 | Code.js |
| `diagnoseDashboardData` | データフロー診断 | Code.js |

## 🔧 開発用コマンド

```bash
# ローカル変更をGASにプッシュ
clasp push

# GASからローカルにプル
clasp pull

# GASエディタを開く
clasp open
```

## 📋 データシート構成

### バッチ管理列（A-C）

| 列 | フィールド名 | 説明 |
|----|-------------|------|
| A | バッチID | インポート識別子（例: `B20260111_183000_tanaka`） |
| B | 担当者 | インポートしたユーザー名 |
| C | インポート日時 | `yyyy-MM-dd HH:mm:ss` 形式 |

### データ列（D-K）

| 列 | フィールド名 | 説明 |
|----|-------------|------|
| D | 求人タイトル | 求人名 |
| E | 求人URL | リンク |
| F | 新着 | 新着フラグ |
| G | 事業所名 | 会社名（**解析対象外**） |
| H | 所在地 | 住所（**LocationParserで解析**） |
| I | タグ | 条件タグ |
| J | 給与 | 給与情報 |
| K | 雇用形態 | 正社員/派遣など |

## ⚠️ 既知の問題と修正履歴

### 2026-01-11: LocationParser 包括的バグ修正

**詳細ドキュメント**: [`docs/LocationParser-BugFix-Report.md`](docs/LocationParser-BugFix-Report.md)

**修正内容**:
1. **東京都 vs 京都府問題**: 「東京都」が「京都府」に誤認識される問題を修正
2. **政令指定都市の同名区問題**: 「札幌市中央区」→「中央区」（東京）誤認識を修正
3. **東京区エイリアス**: `TOKYO_WARD_ALIASES` が適用されていなかった問題を修正

**テスト結果**: 209/210 (99.5%)
- 既存テスト: 77/77 (100%)
- 全国網羅テスト: 132/133 (99%)

**検証**: `runNationwideComprehensiveTest` で全国規模の汎用性を確認

---

### 2024年: 「中央」「北」「港」誤変換問題

**問題**: 事業所名に「中央病院」「北町」などが含まれると、「中央区」「北区」に誤変換されていた

**原因**: `TOKYO_WARD_ALIASES`に短いエイリアス（`'中央': '中央区'`など）が存在

**修正**: 危険なエイリアスを削除
```javascript
// 削除済み: '中央', '北', '港'
// 残存（安全）: '渋谷', '新宿', '世田谷', '品川' など
```

**検証**: `runAllLocationTests` で全テスト合格を確認すること

## 📚 ドキュメント

| ファイル | 説明 |
|----------|------|
| [`docs/LocationParser-BugFix-Report.md`](docs/LocationParser-BugFix-Report.md) | LocationParserバグ修正の詳細レポート |
| [`docs/ConcurrencyControl.md`](docs/ConcurrencyControl.md) | 同時アクセス制御（LockService）の実装 |
| [`docs/MultiUserBatchManagement.md`](docs/MultiUserBatchManagement.md) | マルチユーザーバッチ管理システム |
| [`docs/cache-consistency-fix.md`](docs/cache-consistency-fix.md) | キャッシュ整合性の修正 |

## 🔒 マルチユーザー対応

### 同時アクセス制御

複数ユーザーが同時にスプレッドシートを使用する場合の対策：

| 操作 | 対策 |
|------|------|
| **CSVインポート** | LockServiceで排他制御（同時実行を防止） |
| **ダッシュボード閲覧** | 問題なし（読み取りのみ） |
| **キャッシュ再構築** | インポートと連動してロック |

詳細: [`docs/ConcurrencyControl.md`](docs/ConcurrencyControl.md)

### バッチ管理（データ共存）

複数ユーザーがそれぞれのデータをインポートし、共存させる仕組み：

| 機能 | 説明 |
|------|------|
| **バッチID** | 各インポートに一意のID（例: `B20260111_183000_tanaka`） |
| **追記モード** | データを上書きせず追記 |
| **自動アーカイブ** | 1000件超過時に古いバッチを月次シートに移動 |
| **集計キャッシュ** | アーカイブデータの高速集計 |

#### メニュー操作

```
データ処理 → 📦 バッチ管理
├─ バッチ一覧を表示
├─ 手動アーカイブ実行
└─ アーカイブ状態を表示
```

詳細: [`docs/MultiUserBatchManagement.md`](docs/MultiUserBatchManagement.md)
