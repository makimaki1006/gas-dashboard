# キャッシュ整合性修正ドキュメント

## 概要

CSVインポート後に古いデータがダッシュボードやレポートに表示される問題を修正しました。

## 問題の症状

1. 新しいCSVをインポートした後、ダッシュボードに古いデータが表示される
2. レポート生成時に古い地域データ（例：以前インポートした「北区」など）が含まれる
3. ダッシュボードとレポートで表示されるデータが異なる

## 原因分析

### データ取得の階層構造

```
┌─────────────────────────────────────────────────────────────┐
│                    スプレッドシート                          │
│                    （「データ」シート）                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    DataPersistence                          │
│              （ScriptProperties - 永続化）                   │
│         - inc_parsed_data: 解析済みデータ                    │
│         - inc_hash_map: ハッシュマップ                       │
│         - inc_metadata: メタデータ（lastUpdated含む）        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Script Cache                             │
│           （CacheService - 6時間TTL）                        │
│         - dashboard_aggregation: 集計データ                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Session Cache                            │
│              （メモリ内 - セッション限定）                    │
│         - _parsedDataCache                                  │
│         - _aggregationCache                                 │
└─────────────────────────────────────────────────────────────┘
```

### 問題の原因

1. **キャッシュのタイムスタンプ不整合**: CSVインポート時にDataPersistenceは更新されるが、Script Cacheに古いデータが残っている場合があった

2. **forceRefreshの不統一**: 各API関数でデータ取得時の`forceRefresh`パラメータが統一されておらず、一部の関数が古いキャッシュを使用していた

3. **clearAll()の不完全さ**: DataPersistence.clearAll()が個別のキーを削除していたため、孤立したチャンクが残る可能性があった

## 修正内容

### 1. DataPersistence.clearAll() の強化

**ファイル**: `DataPersistence.js`

```javascript
// 修正前: 個別のキーを順番に削除
clearAll: function() {
  deleteData(KEYS.PARSED_DATA);
  deleteData(KEYS.HASH_MAP);
  props.deleteProperty(KEYS.METADATA);
}

// 修正後: inc_プレフィックスを持つ全プロパティを一括削除
clearAll: function() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();

  Object.keys(allProps).forEach(key => {
    if (key.startsWith('inc_')) {
      props.deleteProperty(key);
    }
  });
}
```

**追加**: `verifyClearAll()` - クリアが成功したか検証するメソッド

### 2. rebuildCacheAfterImport() に検証ステップ追加

**ファイル**: `ApiHandler.js`

```javascript
// Step 2.5: クリア検証
const clearVerified = DataPersistence.verifyClearAll();
if (!clearVerified) {
  console.error('キャッシュクリア検証失敗！');
  DataPersistence.clearAll(); // 再度クリアを試行
}

// Step 6: 地域分布確認ログ
if (aggregation.locationData) {
  const topPrefs = Object.entries(nonZero).sort(...).slice(0, 5);
  console.log('上位都道府県: ' + topPrefs.map(...).join(', '));
}
```

### 3. getAggregatedDataWithCache() の改善

**ファイル**: `Aggregator.js`

キャッシュの鮮度をチェックし、永続化データより古い場合は再取得するように改善：

```javascript
function getAggregatedDataWithCache() {
  // 永続化データのタイムスタンプを確認
  const metadata = DataPersistence.loadMetadata();
  const persistenceTime = metadata ? new Date(metadata.lastUpdated).getTime() : 0;

  // スクリプトキャッシュを確認
  const cache = CacheService.getScriptCache();
  const cachedStr = cache.get('dashboard_aggregation');

  if (cachedStr) {
    const cached = JSON.parse(cachedStr);
    const cacheTime = cached._cacheTimestamp || 0;

    // 永続化データの方が新しい場合は再取得
    if (persistenceTime > cacheTime) {
      console.log('キャッシュが古い - 再取得');
      return DataLayer.getAggregation(true);
    }

    return cached;
  }

  // キャッシュがない場合は通常取得
  const aggregation = DataLayer.getAggregation();
  aggregation._cacheTimestamp = Date.now();
  cache.put('dashboard_aggregation', JSON.stringify(aggregation), 21600);
  return aggregation;
}
```

### 4. 各API関数のデータ取得統一

| 関数 | 修正内容 |
|------|---------|
| `getDashboardData()` | キャッシュ優先 + フォールバック |
| `generatePdfReport()` | `forceRefresh=true` |
| `getCompanyAnalysis()` | `forceRefresh=true` |
| `getTagSalaryAnalysis()` | `forceRefresh=true` |
| `getMapData()` | `forceRefresh=true` |

## データフロー

### CSVインポート時

```
processCSVFile()
    ↓
transferDataToDestination()  ← スプレッドシートのデータ更新
    ↓
rebuildCacheAfterImport()
    ├─ DataPersistence.clearAll()      ← 永続化データクリア
    ├─ DataLayer.clearAllCache(true)   ← セッション＆スクリプトキャッシュクリア
    ├─ verifyClearAll()                ← クリア検証
    ├─ forceIncrementalUpdate(true)    ← 新データで永続化
    └─ getAggregation(true)            ← 新データで集計＆キャッシュ保存
```

### ダッシュボード表示時

```
getDashboardData()
    ↓
getAggregatedDataWithCache()
    ├─ 永続化データのlastUpdated取得
    ├─ スクリプトキャッシュの_cacheTimestamp取得
    ├─ 比較: 永続化 > キャッシュ ?
    │   ├─ Yes → DataLayer.getAggregation(true)  ← 最新データ取得
    │   └─ No  → キャッシュを返す
    └─ キャッシュなし → DataLayer.getAggregation()
```

## 確認方法

### GAS実行ログで確認

CSVインポート後、以下のログが出力されることを確認：

```
═══════════════════════════════════════════════════════
📦 CSVインポート後のキャッシュ再構築
═══════════════════════════════════════════════════════
Step 1: シートデータ件数 = XX
Step 2: 全キャッシュクリア...
DataPersistence: 全データをクリア（Xプロパティ削除）
Step 2.5: ✅ キャッシュクリア検証成功
Step 3: データ再構築...
Step 4: 集計データ事前計算...
Step 5: 集計キャッシュ保存完了
Step 6: 地域分布確認...
  上位都道府県: ○○県(XX), △△県(XX), ...
═══════════════════════════════════════════════════════
✅ キャッシュ再構築完了
```

### ダッシュボード表示時のログ

```
=== getDashboardData 開始 ===
DataPersistence状態: recordCount=XX, lastUpdated=2024-XX-XX...
getAggregatedDataWithCache 呼び出し...
キャッシュが古い（永続化: 2024-XX-XX...）- 再取得
DataLayer: 集計を実行
...
```

## 関連ファイル

- `DataPersistence.js` - データ永続化モジュール
- `DataLayer.js` - データレイヤー（キャッシュ管理）
- `Aggregator.js` - 集計ロジック
- `ApiHandler.js` - API関数群
- `IncrementalUpdate.js` - 増分更新モジュール
- `GeoData.js` - 地図データAPI

## 追加修正: null対策の強化

### 問題

ダッシュボード表示時に「結果がnullです」エラーが発生する問題。

### 原因

`getAggregatedDataWithCache()`や`getDashboardData()`で予期しないエラーが発生した場合、
nullが返される可能性があった。

### 修正内容

#### 1. getAggregatedDataWithCache() の防御的実装

**ファイル**: `Aggregator.js`

- 関数全体をtry-catchで囲む
- lastUpdatedのパースエラーをハンドリング
- キャッシュデータの有効性チェック（`summary`プロパティの存在確認）
- nullの場合は`createEmptyAggregation()`を返す
- 再取得失敗時は古いキャッシュを使用

```javascript
function getAggregatedDataWithCache() {
  try {
    // ... 処理 ...

    // それでもnullの場合は空の集計を返す
    if (!aggregation || !aggregation.summary) {
      console.warn('有効なデータを取得できません - 空の集計を返します');
      return createEmptyAggregation();
    }

    return aggregation;
  } catch (error) {
    console.error('getAggregatedDataWithCache 例外:', error);
    // 最終フォールバック: 空の集計を返す
    return createEmptyAggregation();
  }
}
```

#### 2. getDashboardData() の多段階フォールバック

**ファイル**: `ApiHandler.js`

- 各処理ステップを個別のtry-catchで囲む
- 一部のエラーがあっても処理を継続
- 最終的に必ず有効なオブジェクトを返す

```javascript
function getDashboardData() {
  try {
    // ... 各ステップで個別エラーハンドリング ...

    // それでもnullの場合は空の集計を使用
    if (!aggregation || !aggregation.summary) {
      console.warn('有効なデータなし - 空の集計を使用');
      aggregation = createEmptyAggregation();
    }

    return { success: true, data: aggregation };
  } catch (error) {
    // 最終フォールバック: 空の集計データを返す
    return {
      success: true,
      data: createEmptyAggregation(),
      warning: 'エラーが発生したため空のデータを返しました'
    };
  }
}
```

### 設計思想

1. **絶対にnullを返さない**: クライアント側でnullチェックエラーが発生しないよう保証
2. **部分的な失敗を許容**: 一部の処理が失敗しても、残りの処理を継続
3. **空データで動作継続**: データが取得できなくても、空のダッシュボードを表示

## 今後の注意点

1. **新しいAPI関数を追加する場合**: データ取得時は`forceRefresh`パラメータを明示的に指定する
2. **キャッシュを使う場合**: `getAggregatedDataWithCache()`を使用し、直接`DataLayer.getAggregation()`を呼ばない
3. **重要な処理（レポート生成など）**: 必ず`forceRefresh=true`を使用する
4. **null対策**: API関数では絶対にnullを返さず、最低でも空のデータ構造を返す
