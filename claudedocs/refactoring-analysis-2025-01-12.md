# GAS Dashboard リファクタリング分析レポート

**作成日:** 2025-01-12
**バックアップコミット:** `8113efb` (backup: pre-refactoring state)

---

## 分析サマリー

| 項目 | 数 |
|------|-----|
| 対象ファイル | 13ファイル |
| 定義関数数 | 約130個 |
| 未使用/重複関数 | 9個 |
| テスト/デバッグ関数 | 8個 |

---

## 削除対象リスト

### 1. 重複関数（削除安全性: 高）

| 関数名 | ファイル | 行番号 | 理由 |
|--------|---------|--------|------|
| `debugUnknownLocations()` | DataLayer.js | 607-636 | LocationParser.js版と完全重複 |

### 2. テスト/デバッグ関数（削除安全性: 高）

| 関数名 | ファイル | 行番号 | 理由 |
|--------|---------|--------|------|
| `testStatistics()` | Statistics.js | 370-410 | テスト専用 |
| `testDataLayer()` | DataLayer.js | 579-602 | テスト専用 |
| `testDataPersistence()` | DataPersistence.js | 415-500 | テスト専用 |
| `testConnection()` | ApiHandler.js | 339-346 | テスト専用 |
| `testGetCityCoordinates()` | GeoData.js | 538-564 | テスト専用 |
| `testDynamicColumnDetection()` | Code.js | 1457-1551 | テスト専用 |
| `testLocationParserComprehensive()` | ApiHandler.js | 897-1100 | テスト専用、約200行 |
| `debugKumamotoIssue()` | ApiHandler.js | 1108-1178 | デバッグ専用 |

---

## 残すべき関数

### メニュー/エントリーポイント（Code.js）

| 関数名 | 理由 |
|--------|------|
| `onOpen()` | メニュー構築 |
| `showFileUploadDialog()` | ファイルアップロードUI |
| `processCSVFile()` | CSVインポート処理 |
| `openCombinedView()` | ダッシュボード表示 |
| `forceRefreshAllData()` | 手動リフレッシュ |

### API関数（ApiHandler.js）

| 関数名 | 理由 |
|--------|------|
| `getDashboardData()` | ダッシュボードデータ取得 |
| `fetchDashboardData()` | HTML用エントリーポイント |
| `getCompanyAnalysis()` | 企業分析 |
| `getTagSalaryAnalysis()` | タグ×給与分析 |
| `getAllAnalysisData()` | 一括分析データ取得 |
| `generatePdfReport()` | レポート生成 |
| `forceRegeneratePrecomputedData()` | 事前計算データ再生成 |
| `diagnosePrecomputedData()` | 診断（保守用） |
| `diagnoseDataState()` | 診断（保守用） |

### GeoData.js

| 関数名 | 理由 |
|--------|------|
| `getMapData()` | マップデータ取得 |
| `fetchMapData()` | HTML用エントリーポイント |
| `getTargetLocations()` | 検索対象取得 |
| `calculateMapBounds()` | マップ範囲計算 |

---

## コード削減見込み

| 削除対象 | 行数（概算） |
|---------|-------------|
| 重複関数 | 30行 |
| テスト関数 | 500行 |
| デバッグ関数 | 270行 |
| **合計** | **約800行** |

---

## 削除手順

### Phase 1: 重複関数の削除

```
1. DataLayer.js: debugUnknownLocations() を削除（607-636行）
```

### Phase 2: テスト関数の削除

```
1. Statistics.js: testStatistics() を削除
2. DataLayer.js: testDataLayer() を削除
3. DataPersistence.js: testDataPersistence() を削除
4. ApiHandler.js: testConnection(), testLocationParserComprehensive(), debugKumamotoIssue() を削除
5. GeoData.js: testGetCityCoordinates() を削除
6. Code.js: testDynamicColumnDetection() を削除
```

### Phase 3: 検証

```
1. clasp push
2. GASエディタで forceRegeneratePrecomputedData を実行
3. ダッシュボードの動作確認
```

---

## 削除しないもの

以下は保守/診断用として残す：

| 関数名 | ファイル | 理由 |
|--------|---------|------|
| `diagnosePrecomputedData()` | ApiHandler.js | 本番トラブルシューティング用 |
| `diagnoseDataState()` | ApiHandler.js | データ状態確認用 |
| `diagnoseMapData()` | CityMasterData.js | マップデータ診断用 |

---

## ロールバック手順

```bash
# バックアップコミットに戻す場合
git checkout 8113efb -- .

# または特定ファイルのみ
git checkout 8113efb -- DataLayer.js
```
