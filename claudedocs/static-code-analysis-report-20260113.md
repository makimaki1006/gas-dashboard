# 静的コード分析レポート

**実行日時**: 2026年01月13日
**分析対象**: GAS Dashboard プロジェクト
**分析目的**: データ乖離問題、熊本県誤認識問題の原因調査

---

## 1. エグゼクティブサマリー

### 静的コード分析の結論

**コードロジックに明らかな問題は発見されませんでした。**

観測された問題（データ乖離、熊本県誤認識）は、静的コード分析では再現できず、
**ランタイム（実行時）のデータ状態**に起因する可能性が高いと判断されます。

---

## 2. 分析対象と手法

### 2.1 分析対象ファイル

| ファイル | 役割 | 分析観点 |
|----------|------|----------|
| `ApiHandler.js` | APIエンドポイント、レポート生成 | データフロー、テンプレート |
| `DataLayer.js` | 統一データレイヤー | キャッシュ整合性 |
| `DataPersistence.js` | 永続化 | PropertiesService操作 |
| `IncrementalUpdate.js` | 増分更新 | データ更新ロジック |
| `JobSeekerAnalysis.js` | 求職者視点分析 | 計算ロジック |
| `LocationParser.js` | 住所解析 | 共有区名処理 |

### 2.2 分析手法

1. **順方向トレース**: CSVインポート → パース → キャッシュ → 事前計算 → レポート生成
2. **逆方向トレース**: レポート表示値 → テンプレート → データソース → 計算ロジック
3. **分岐網羅**: 条件分岐の全パターン検証
4. **データ整合性**: キャッシュ層間の同期メカニズム確認

---

## 3. 詳細分析結果

### 3.1 データフロー分析

#### CSVインポート後のデータ再構築フロー

```
rebuildCacheAfterImport()
├─ Step 1: シートデータ件数確認
├─ Step 1.5: 検索対象シート強制クリア
├─ Step 2: 全キャッシュクリア
│   ├─ ScriptCache.removeAll()
│   ├─ DataPersistence.clearAll() ← inc_*, precomputed_* キー削除
│   ├─ DataLayer.clearAllCache(true)
│   └─ clearAggregationCache()
├─ Step 2.5: クリア検証 (verifyClearAll)
├─ Step 3: データ再構築 (forceIncrementalUpdate)
├─ Step 4: 集計データ事前計算 (getAggregation)
├─ Step 5: ScriptCache保存
├─ Step 6: precomputeAllData() ← ダッシュボード/地図/分析データ保存
└─ Step 7: 最終検証
```

**検証結果**: ✅ ロジックは正しい。クリア→再構築の順序が保証されている。

#### 事前計算データ生成フロー (precomputeAllData)

```
precomputeAllData()
├─ [1/3] ダッシュボードデータ計算
│   ├─ DataLayer.getAggregation(true)
│   ├─ getTargetSalaryForDashboard()
│   └─ DataPersistence.savePrecomputedDashboard()
├─ [2/3] 地図データ計算
│   ├─ getTargetLocations()
│   ├─ DataLayer.getCityAggregation(true)
│   └─ DataPersistence.savePrecomputedMap()
└─ [3/3] 分析データ計算
    ├─ DataLayer.getParsedData(true) ← 新しいデータを強制取得
    ├─ createCompanyAggregation()
    ├─ createTagSalaryCorrelation()
    ├─ analyzeJobSeekerPerspective() ← 求職者分析
    └─ DataPersistence.savePrecomputedAnalysis()
```

**検証結果**: ✅ forceRefresh=true により、常に最新データが使用される。

---

### 3.2 キャッシュ整合性分析

#### キャッシュ層構造

| 層 | 保存先 | TTL | クリア方法 |
|----|--------|-----|------------|
| セッションキャッシュ | メモリ (`_parsedDataCache`) | 5分 | `clearSessionCache()` |
| ScriptCache | CacheService | 6時間 | `cache.remove()` |
| PropertiesService | ScriptProperties | 永続 | `deleteProperty()` |

#### クリアロジック検証

```javascript
// DataPersistence.clearAll()
const keysToDelete = Object.keys(allProps).filter(k =>
  k.startsWith('inc_') || k.startsWith('precomputed_')
);
```

**検証結果**: ✅ `inc_*` と `precomputed_*` で始まるキーは全て削除対象。

#### 増分更新のクイックチェック

```javascript
// IncrementalUpdate.js:138-159
if (!forceFullRefresh) {
  // レコード数が同じなら永続化データを直接返す（クイックチェック）
  if (metadata.recordCount === currentRowCount) {
    return { parsedData: previousParsedData };
  }
}
```

**検証結果**: ✅ `forceFullRefresh=true` の場合はクイックチェックをスキップ。

---

### 3.3 求職者分析ロジック分析

#### analyzeSalaryRangePerception()

```javascript
// 有効データのフィルタ条件
var validData = parsedData.filter(function(d) {
  return d.salaryParsed &&
         d.salaryParsed.minValue !== null &&
         d.salaryParsed.maxValue !== null &&
         d.salaryParsed.hasRange === true;
});

// 計算結果
return {
  avgLower: avgLower,                    // 平均下限
  avgUpper: avgUpper,                    // 平均上限
  expectedValue: expectedValue,          // 期待値
  // HTMLテンプレート用エイリアス
  conservativeEstimate: avgLower,        // ← avgLower と同値
  optimisticEstimate: avgUpper,          // ← avgUpper と同値
  psychologicalMidpoint: expectedValue,  // ← expectedValue と同値
  ...
};
```

**検証結果**: ✅ エイリアスは正しく設定されている。

#### テンプレートのフォールバック

```javascript
// ApiHandler.js:1698
${(jobSeekerData.salaryRangePerception.conservativeEstimate ||
   jobSeekerData.salaryRangePerception.avgLower) ?
   Math.round((jobSeekerData.salaryRangePerception.conservativeEstimate ||
               jobSeekerData.salaryRangePerception.avgLower) / 10000) + '万円' : '-'}
```

**検証結果**: ✅ `conservativeEstimate` がなければ `avgLower` を使用。

---

### 3.4 熊本県誤認識分析

#### 共有区名処理ロジック

```javascript
// LocationParser.js:292
const SHARED_WARD_NAMES = ['北区', '中央区'];

// 共有区名のみの場合はスキップ（後続処理で曖昧として扱う）
if (isSharedWard && isWardOnly && !hasTokyoPrefecture) {
  continue;
}
```

**検証結果**: ✅ 「北区」「中央区」のみの場合、東京と決め打ちしない。

#### 複数都市に同名区がある場合

```javascript
// LocationParser.js:348-378
const matchingCities = findCitiesWithWard(ward);
if (matchingCities.length > 1) {
  // 市名がテキストに含まれるか確認
  for (const candidateCity of matchingCities) {
    if (text.includes(candidateCity)) {
      // → その市に確定
    }
  }
  // 都道府県名がテキストに含まれるか確認
  for (const candidateCity of matchingCities) {
    if (text.includes(prefecture)) {
      // → その都道府県に確定
    }
  }
}
```

**検証結果**: ✅ 市名・都道府県名がなければ曖昧なまま。熊本県への誤解決は起きない。

---

## 4. 逆検証（問題の再現試行）

### 4.1 データ乖離問題の逆検証

**観測された現象**:
- 診断ログ: `avgLower: 235171` (≈24万円)
- レポート: 15万円

**逆検証結果**:

| 検証項目 | 結果 | 説明 |
|----------|------|------|
| テンプレートのフォールバック | ✅ 正常 | `conservativeEstimate || avgLower` で正しく取得 |
| エイリアスの設定 | ✅ 正常 | `conservativeEstimate = avgLower` |
| データソース | ✅ 正常 | `loadPrecomputedAnalysis()` から取得 |
| 計算ロジック | ✅ 正常 | `average(lowerValues)` で計算 |

**結論**: 静的コードには問題なし。15万円という値が出るには、入力データ自体が異なる必要がある。

### 4.2 熊本県誤認識の逆検証

**観測された現象**:
- レポートに「熊本県 (1件)」と表示

**逆検証結果**:

| 検証項目 | 結果 | 説明 |
|----------|------|------|
| 共有区名処理 | ✅ 正常 | 曖昧な場合は決め打ちしない |
| コンテキスト都道府県 | ✅ 正常 | 検索対象から推測（空なら影響なし） |
| 直接マッチ | ✅ 正常 | 「熊本」を含む住所のみマッチ |

**結論**: 静的コードには問題なし。「熊本」を含む住所データが1件存在する可能性がある。

---

## 5. 考察：ランタイム問題の可能性

### 5.1 データ乖離の推定原因

診断ログ（01:30）とレポート（01:33）で異なるデータが表示された原因として、
以下のランタイムシナリオが考えられます：

1. **タイミング問題**: 診断後、レポート生成前に別のCSVがインポートされた
2. **並列実行問題**: 複数のGASトリガーが同時実行され、データ競合が発生
3. **古いファイルの閲覧**: 以前生成されたレポートファイルを参照

### 5.2 熊本県の推定原因

1. **入力データに「熊本」が含まれる**: 例「熊本県から転勤可」「熊本出身者歓迎」
2. **住所テキストの表記ゆれ**: 解析できない形式で熊本が含まれていた

---

## 6. 推奨される追加調査

### 6.1 ランタイムデータ確認

```
ApiHandler.gs の debugKumamotoIssue を実行
→ 熊本県と判定された具体的なレコードを特定
```

### 6.2 データ整合性テスト

```
ApiHandler.gs の testLocationParserComprehensive を実行
→ 住所パースの網羅的テスト
```

### 6.3 キャッシュ強制リセット

```
ApiHandler.gs の clearAllScriptProperties を実行
ApiHandler.gs の forceRegeneratePrecomputedData を実行
→ 全キャッシュをクリアして再生成
```

---

## 7. 結論

### 静的コード分析の最終判定

| 分析項目 | 判定 | 詳細 |
|----------|------|------|
| データフロー | ✅ 正常 | クリア→再構築の順序が保証 |
| キャッシュ整合性 | ✅ 正常 | 全キャッシュ層が適切にクリア |
| 求職者分析ロジック | ✅ 正常 | 計算・エイリアス・テンプレートすべて正常 |
| 住所パースロジック | ✅ 正常 | 共有区名の曖昧性処理が適切 |

### 問題の本質

観測された問題は、**コードのバグではなく、ランタイムのデータ状態**に起因する可能性が高い。
具体的には：

1. **異なるCSVデータがインポートされた** → 件数・給与データの乖離
2. **入力データに「熊本」が含まれていた** → 熊本県の表示

### 次のステップ

1. `debugKumamotoIssue` で熊本県レコードを特定
2. 実際のCSVデータ（127件）を確認
3. 必要に応じてキャッシュ強制リセット

---

**分析者**: Claude Code
**分析完了日時**: 2026年01月13日
