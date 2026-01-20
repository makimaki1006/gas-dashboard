# 市区町村データ実装レポート

**日付**: 2026-01-20
**作業者**: Claude Code

---

## 概要

市区町村レベルの地理データと給与分析機能を実装・修正しました。

---

## 実装内容

### 1. 全国市区町村座標データの拡充

**ファイル**: `GeoData.js`

- **変更前**: 約200件の主要都市のみ
- **変更後**: 1,916件（全国市区町村を網羅）
- **データソース**: code4fukui/localgovjp（オープンデータ）

```javascript
const CITY_COORDINATES = {
  "札幌市": [43.0646, 141.3468],
  "小樽市": [43.19070647, 140.9944857],
  "旭川市": [43.77083333, 142.365],
  // ... 1,916件
};
```

### 2. 市区町村別給与分析（レポート）

**ファイル**: `Aggregator.js`, `ApiHandler.js`

- `createRegionSalaryAnalysis()`に市区町村集計を追加
- レポート3ページ目に「市区町村別 給与分析TOP15」テーブルを追加
- 表示項目: 市区町村名、都道府県、件数、平均給与、中央値

### 3. 市区町村別給与チャート（ダッシュボード）

**ファイル**: `Dashboard.html`

- 「市区町村別 平均給与TOP10」横棒チャートを追加
- 求人数が多い市区町村の平均給与を比較表示
- 時給/月給モード対応

```javascript
function renderCitySalaryChart() {
  // regionSalaryAnalysis.citySalaryListからTOP10を表示
}
```

### 4. 市町村マスタ座標データ修正

**問題**: スプレッドシートの市町村マスタで多くの市区町村が同じ座標を共有していた

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| ユニーク座標数 | 162件 | 1,835件 |
| カバー率 | 8.5% | 96% |

**解決方法**: `resetAndRepopulateCoordinates`を実行し、GeoData.jsの正確な座標で再入力

---

## データソース対応状況

| データソース | 給与モード | 市区町村×給与 |
|-------------|-----------|--------------|
| 求人ボックス月給 | monthly | ✅ 対応 |
| Indeed月給 | monthly | ✅ 対応 |
| Indeed時給 | hourly | ✅ 対応 |

※CSVインポート時に`salaryDisplayType`が設定され、適切なモードで計算される

---

## 関連コミット

| ハッシュ | 内容 |
|---------|------|
| `b8ce164` | ダッシュボードに市区町村給与チャート追加 |
| `b08c733` | 全国市区町村座標データを1,916件に拡充 |
| `3101bc0` | 市区町村別給与分析を追加 |
| `c44952b` | 給与分布-詳細分布を2ページ目に移動 |

---

## 診断・確認手順

### 地図データ診断
```
CityMasterData.gs の diagnoseMapData を実行
```

期待される結果:
- 市区町村座標: 1,884件
- ユニーク座標数: 1,835件以上

### 座標再入力（問題発生時）
```
CityMasterData.gs の resetAndRepopulateCoordinates を実行
```

---

## アーキテクチャ

```
GeoData.js (CITY_COORDINATES: 1,916件)
    ↓ populateCityCoordinates()
市町村マスタシート (座標入力)
    ↓ loadCityMasterCoordinates()
getCityCoordinates() → 地図ピン表示
    ↓
createRegionSalaryAnalysis() → citySalaryList
    ↓
レポート: 市区町村別給与TOP15
ダッシュボード: 市区町村別給与TOP10チャート
```

---

## 注意事項

1. **CSVインポートで更新**: forceRegeneratePrecomputedDataは使用せず、CSVインポートで事前計算データを更新
2. **単一データソース**: 事前計算データは上書き方式のため、最後にインポートしたデータソースのみが反映される
3. **座標キャッシュ**: 座標データはキャッシュされるため、変更後は`resetAndRepopulateCoordinates`でリセット推奨
