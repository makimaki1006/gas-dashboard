# GAS Dashboard コードリファレンス

このドキュメントは、GAS Dashboard の各関数とモジュールの機能を説明します。

## ファイル構成

| ファイル名 | 役割 |
|-----------|------|
| Code.js | エントリポイント、メニュー構成、API統合 |
| GeoData.js | 地理データ、座標管理、マップデータ取得 |
| CityMasterData.js | 市区町村・駅マスタデータ、座標管理機能 |
| DataLayer.js | 統一データレイヤー、キャッシュ管理 |
| DataPersistence.js | データ永続化、増分更新 |
| Aggregator.js | データ集計ロジック |
| LocationParser.js | 勤務地テキスト解析 |
| SalaryParser.js | 給与テキスト解析 |
| ApiHandler.js | APIエンドポイント処理 |
| Constants.js | 定数定義 |

---

## GeoData.js - 地理データモジュール

### 定数

#### `CITY_COORDINATES`
```javascript
const CITY_COORDINATES = {
  "札幌市": [43.0618, 141.3545],
  "渋谷区": [35.6640, 139.6982],
  // ... 約213件の市区町村座標
};
```
- **用途**: 市区町村名から緯度・経度を取得するためのハードコードデータ
- **形式**: `{ "市区町村名": [緯度, 経度] }`

#### `PREFECTURE_COORDINATES`
```javascript
const PREFECTURE_COORDINATES = {
  "北海道": [43.0646, 141.3468],
  "東京都": [35.6762, 139.6503],
  // ... 47都道府県
};
```
- **用途**: 都道府県の座標（県庁所在地）。市区町村座標が見つからない場合のフォールバック

### 関数

#### `getCityCoordinates(cityName)`
```javascript
function getCityCoordinates(cityName) {
  // 1. 完全一致
  if (CITY_COORDINATES[cityName]) return CITY_COORDINATES[cityName];

  // 2. 部分一致（市区町村）
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (cityName.includes(city) || city.includes(cityName)) return coords;
  }

  // 3. 部分一致（都道府県）
  for (const [pref, coords] of Object.entries(PREFECTURE_COORDINATES)) {
    if (cityName.includes(pref) || pref.includes(cityName)) return coords;
  }

  return null;
}
```
- **引数**: `cityName` - 市区町村名または地名
- **戻り値**: `[緯度, 経度]` または `null`
- **検索順序**:
  1. CITY_COORDINATES で完全一致
  2. CITY_COORDINATES で部分一致
  3. PREFECTURE_COORDINATES で部分一致
  4. 見つからなければ null

#### `getTargetLocations()`
- **用途**: 「検索対象」シートからターゲット地域一覧を取得
- **戻り値**: 座標と給与情報を含むオブジェクト配列

#### `getMapData()`
- **用途**: マップ表示用の統合データを取得
- **内部処理**:
  1. DataLayer から集計データ取得
  2. ターゲット地域の座標を解決
  3. 給与分布位置を計算
  4. 都市別集計データを取得
  5. マップ表示範囲を計算
- **戻り値**: `{ success: true, data: { targets, cities, bounds, summary, ... } }`

#### `fetchMapData()`
- **用途**: HTML から呼び出される安定したエントリポイント
- **特徴**: JSON.parse/stringify で安全にシリアライズ

#### `calculateMapBounds(targets, cities)`
- **用途**: マップの表示範囲（center, zoom, bounds）を計算
- **ロジック**: 全座標から最適なズームレベルを自動計算

---

## CityMasterData.js - マスタデータモジュール

### 定数

#### `JAPAN_MUNICIPALITIES`
```javascript
const JAPAN_MUNICIPALITIES = {
  '北海道': ['札幌市', '函館市', '小樽市', ...],
  '東京都': ['千代田区', '中央区', '港区', ...],
  // ... 47都道府県の市区町村（約1,700件）
};
```
- **用途**: 全国市区町村の一覧データ

#### `JAPAN_STATIONS`
```javascript
const JAPAN_STATIONS = {
  '東京駅': { city: '千代田区', prefecture: '東京都' },
  '新宿駅': { city: '新宿区', prefecture: '東京都' },
  // ... 約220駅
};
```
- **用途**: 駅名から市区町村への逆引きマッピング

### 関数

#### `createFullCityMasterSheet()`
- **用途**: 「市町村マスタ」シートを作成し、全国市区町村データを入力
- **カラム**: A:市区町村名, B:都道府県, C:別名/表記ゆれ, D:緯度, E:経度

#### `createFullStationMasterSheet()`
- **用途**: 「駅名マスタ」シートを作成し、駅データを入力
- **カラム**: A:駅名, B:市区町村名, C:都道府県

#### `populateCityCoordinates()`
- **用途**: 市町村マスタの座標（D列・E列）を自動入力
- **処理**:
  1. CITY_COORDINATES から座標を検索
  2. 見つからなければ PREFECTURE_COORDINATES を使用
  3. 結果をD列（緯度）・E列（経度）に書き込み

#### `diagnoseMapData()`
- **用途**: 地図データの診断レポートを表示
- **チェック項目**:
  - ハードコード座標数
  - 市町村マスタの座標入力状況
  - 重複座標の検出
  - データシートの勤務地認識状況

#### `resetAndRepopulateCoordinates()`
- **用途**: 座標をクリアして再入力
- **処理**: D列・E列をクリア → populateCityCoordinates() 実行

---

## DataLayer.js - 統一データレイヤー

### 概要
シングルトンパターンでデータアクセスを一元管理。キャッシュにより重複読み込みを防止。

### 公開API

| メソッド | 説明 |
|---------|------|
| `getRawData(forceRefresh)` | スプレッドシートから生データを取得 |
| `getParsedData(forceRefresh)` | 解析済みデータを取得（増分更新対応） |
| `getAggregation(forceRefresh)` | 集計データを取得 |
| `getValidSalaryData(forceRefresh)` | 有効な給与データを取得 |
| `getSalaryStats(forceRefresh)` | 給与統計（min, max, avg, percentile）を取得 |
| `getCityAggregation(forceRefresh)` | 都市別集計（マップ用） |
| `calculatePosition(salaryMin, salaryMax, cityName)` | 給与の分布位置を計算 |
| `calculateInflow(targetCityNames)` | 流入率分析 |
| `clearCache()` | セッションキャッシュをクリア |
| `clearAllCache(includePersistent)` | 全キャッシュをクリア |

### キャッシュ戦略
- **セッションキャッシュ**: 5分間有効（メモリ内）
- **スクリプトキャッシュ**: 6時間有効（CacheService）
- **永続化データ**: DataPersistence 経由で保存

---

## LocationParser.js - 勤務地解析

### `parseLocationWithMaster(locationText, contextPref)`
- **用途**: 勤務地テキストを解析して都道府県・市区町村を抽出
- **入力例**: `"東京都渋谷区 渋谷駅から徒歩5分"`
- **出力例**: `{ prefecture: "東京都", cityWard: "渋谷区", ... }`

### 解析優先順位
1. 駅名マスタからの逆引き
2. 市町村マスタからの一致
3. 都道府県名のパターンマッチ
4. コンテキスト都道府県（検索対象シートから推測）

---

## SalaryParser.js - 給与解析

### `parseSalary(salaryText)`
- **用途**: 給与テキストを解析して月給・年収に統一
- **対応形式**:
  - 月給: `"月給25万円"`, `"月給25万〜35万円"`
  - 年収: `"年収400万円"`, `"年収400〜600万円"`
  - 時給: `"時給1,200円"`
- **出力**: `{ unifiedMonthly: 250000, type: "monthly", ... }`

---

## データフロー概要

```
[スプレッドシート]
      ↓
[DataLayer.getRawData()]
      ↓
[DataLayer.getParsedData()] ← LocationParser, SalaryParser
      ↓
[DataLayer.getAggregation()] ← Aggregator
      ↓
[getMapData()] ← getCityCoordinates()
      ↓
[MapView.html] で表示
```

---

## 座標解決の流れ

```
勤務地テキスト "群馬県みなかみ町"
      ↓
LocationParser.parseLocationWithMaster()
      ↓
{ prefecture: "群馬県", cityWard: "みなかみ町" }
      ↓
getCityCoordinates("みなかみ町")
      ↓
CITY_COORDINATES["みなかみ町"] = [36.78, 138.9967]
      ↓
マップに表示
```

---

## メニュー構成 (Code.js)

```
求人ダッシュボード
├── 🔄 最新データに更新
├── データ管理
│   ├── CSVからインポート
│   └── 新しい検索を追加
├── マスタ管理
│   ├── 市町村マスタを作成
│   ├── 座標を自動入力
│   ├── 駅名マスタを作成
│   ├── ───────────────
│   ├── 地図データ診断
│   └── 座標をリセット＆再入力
├── ビューを開く
│   ├── ダッシュボード
│   ├── マップビュー
│   └── 複合ビュー
└── 設定
    └── キャッシュクリア
```

---

## 注意事項

### 座標データについて
- CITY_COORDINATES は現在約213件の市区町村をカバー
- カバーされていない市区町村は都道府県座標にフォールバック
- 市町村マスタの D列・E列 に手動で座標を入力することで補完可能

### キャッシュについて
- データ更新後は「キャッシュクリア」を実行するか、「最新データに更新」で自動クリア
- 永続化データは DataPersistence 経由で管理

### パフォーマンス
- 初回ロードは全データ解析のため時間がかかる
- 2回目以降はキャッシュにより高速化
- 増分更新により差分のみ解析

---

*最終更新: 2026-01-12*
