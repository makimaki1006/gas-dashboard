# 求職者視点分析機能 実装ドキュメント

## 概要

求人ダッシュボードに「求職者視点分析」機能を追加。求人を掲載する側の分析に加え、求職者が求人一覧を見たときの認知・心理パターンを分析する機能を実装した。

## 設計思想

### 二極化アプローチ

| ペルソナ | 目的 | 既存/新規 |
|---------|------|----------|
| 求人掲載側 | 市場調査、競合分析、給与設定の参考 | 既存機能 |
| 求職者側 | 求人一覧を見たときの認知パターン分析 | **新規実装** |

### 求職者視点分析の特徴

- 「隠れたお得な求人を探す」機能ではない
- 求職者が求人一覧を見て形成する「心理・認知パターン」を分析
- 例：平均値より最頻値が求職者の「体感相場」になる

---

## 実装した分析機能

### 1. 給与レンジの心理的解釈

**目的**: 「25万〜35万円」のようなレンジ表記を求職者がどう解釈するか

**出力データ**:
- 下限平均、上限平均、心理的中点
- 求職者の期待値推定（下限から1/3地点）
- レンジ幅の分布（狭い/標準/広い）

**解釈例**:
> 求人票に「25万〜35万円」と表記されている場合、求職者の期待値は約28万円（下限寄り）です。

### 2. 新着求人の特徴分析

**目的**: 「新着」バッジ付き求人の給与傾向を分析

**出力データ**:
- 新着求人数、新着率
- 新着求人の平均給与
- 全体平均との差分
- 新着求人の上位タグ

**解釈例**:
> 現在100件中25件（25%）が新着です。新着求人は全体平均より約2万円高い傾向があります。

### 3. 未経験可 vs 経験者向け 給与比較

**目的**: 「未経験可」タグの有無による給与差を明確化

**出力データ**:

| 指標 | 未経験可 | 経験者向け | 差額 |
|-----|---------|-----------|-----|
| 件数 | XX件 | XX件 | - |
| 平均月給 | XX万円 | XX万円 | ±X万円 |
| 中央値 | XX万円 | XX万円 | ±X万円 |
| 最頻値 | XX万円 | XX万円 | - |

**解釈例**:
> 「未経験可」タグあり: 平均23万円（40件）、タグなし: 平均28万円（60件）。未経験可の求人は約5万円低い傾向があります。

### 4. 暗黙の相場観

**目的**: 求職者が最初に見る上位N件から形成される「体感相場」を分析

**出力データ**:
- 上位20件の平均・中央値・最頻値
- 全体平均との差分
- 上位求人の特徴タグ

**解釈例**:
> 求職者が最初に見る上位20件の分析: 平均27万円、最頻値25万円。これが求職者の「体感相場」になります。

---

## ファイル構成

### 新規作成ファイル

| ファイル名 | 役割 |
|-----------|------|
| `JobSeekerAnalysis.js` | 求職者視点分析のコアロジック |
| `Statistics.js` | 高度な統計関数（Bootstrap法、刈り込み平均等） |

### 変更ファイル

| ファイル名 | 変更内容 |
|-----------|---------|
| `ApiHandler.js` | getJobSeekerAnalysis() API追加、レポートセクション追加 |
| `Aggregator.js` | 拡張統計をサマリーに追加 |
| `CombinedView.html` | 求職者視点分析UIセクション追加 |
| `MapView.html` | 右サイドバーUI改善 |

---

## API仕様

### getJobSeekerAnalysis()

```javascript
// 戻り値
{
  success: true,
  data: {
    salaryRangePerception: { ... },    // 給与レンジ心理分析
    newListingsAnalysis: { ... },      // 新着求人分析
    inexperiencedTagAnalysis: { ... }, // 未経験可分析
    implicitMarketRate: { ... },       // 暗黙相場観
    analyzedAt: "2025-01-12T...",
    totalRecords: 100
  }
}
```

### データ構造詳細

#### inexperiencedTagAnalysis

```javascript
{
  hasData: true,
  withInexperienced: {
    count: 40,
    mean: 230000,
    meanMan: 23,
    median: 225000,
    medianMan: 22,
    mode: 220000,
    modeMan: 22
  },
  withoutInexperienced: {
    count: 60,
    mean: 280000,
    meanMan: 28,
    median: 275000,
    medianMan: 27,
    mode: 270000,
    modeMan: 27
  },
  difference: {
    mean: -50000,
    meanMan: -5,
    median: -50000,
    medianMan: -5,
    percentDiff: -18
  },
  interpretation: "「未経験可」タグあり: 平均23万円..."
}
```

---

## UI実装

### ダッシュボード（CombinedView.html）

求職者視点タブに4つのカードを追加：

1. 給与レンジの心理的解釈
2. 新着求人の特徴
3. 未経験可 vs 経験者向け（詳細テーブル）
4. 暗黙の相場観

### PDFレポート

セクション10として追加：
- タイトル: 「10. 求職者視点分析（参考）」
- 注記: 「※サンプル数が限られるため参考値」

### 地図タブサイドバー改善

| 項目 | Before | After |
|-----|--------|-------|
| サイドバー幅 | 320px | 380px |
| フォントサイズ | 11-12px | 12-13px |
| パディング | 16px | 20px |
| 流入率分析 | 1行圧縮 | グリッド+詳細リスト |

---

## 統計関数（Statistics.js）

### getBootstrapConfidenceInterval(data, iterations)

Bootstrap法による95%信頼区間の算出。少数データでも母集団の分布を仮定せず信頼区間を推定。

```javascript
// 戻り値例
{
  lower: 220000,
  upper: 280000,
  bootstrapMean: 250000,
  sampleMean: 248000,
  sampleSize: 25,
  confidenceLevel: 0.95,
  iterations: 2000
}
```

### getTrimmedMean(data, trimPercent)

刈り込み平均。外れ値の影響を排除した頑健な平均値。

```javascript
// trimPercent = 0.1 で上下10%ずつカット
{
  trimmedMean: 250000,
  originalMean: 280000,  // 外れ値含む
  trimmedCount: 80,
  removedCount: 20
}
```

### getQuartileStats(data)

四分位統計とIQR法による外れ値検出。

```javascript
{
  q1: 220000,
  q2: 250000,  // 中央値
  q3: 280000,
  iqr: 60000,
  lowerBound: 130000,
  upperBound: 370000,
  outlierCount: 3,
  outliers: [450000, 500000, 120000]
}
```

---

## 事前計算データへの統合

`generatePrecomputedData()` で求職者視点分析データも事前計算：

```javascript
// ApiHandler.js 内
let jobSeekerData = null;
if (typeof analyzeJobSeekerPerspective === 'function') {
  jobSeekerData = analyzeJobSeekerPerspective(parsedData);
}

const analysisData = {
  companyAnalysis: companyData,
  tagSalaryAnalysis: tagSalaryData,
  jobSeekerAnalysis: jobSeekerData,  // 追加
  _precomputedAt: Date.now()
};
```

---

## 動作確認手順

1. GASエディタで `ApiHandler.js` の `forceRegeneratePrecomputedData` を実行
2. ダッシュボードをリロード
3. 「求職者視点」タブで4つの分析結果を確認
4. レポート生成でセクション10を確認

---

## 今後の拡張案

- [ ] 雇用形態別の求職者視点分析
- [ ] 地域別の相場観比較
- [ ] 時系列での相場観変化追跡
- [ ] 求職者の行動シミュレーション機能

---

## 更新履歴

| 日付 | 内容 |
|-----|------|
| 2025-01-12 | 初版作成 - 求職者視点分析4機能実装 |
| 2025-01-12 | 地図タブサイドバーUI改善 |
| 2025-01-12 | 未経験可/経験者向け詳細表示追加 |
