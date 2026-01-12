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

### 1. CSVインポートの流れ（★重い処理はここで完了）

```
[ユーザー] CSVファイル選択
      ↓
[FileUpload.html] ファイル読み込み
      ↓
[Code.js] processCSVFile(fileContent, fileName)
      ↓
[ConcurrencyControl] ロック取得（同時アクセス防止）
      ↓
[processCSVFileInternal]
  ├─ CSVをGoogleドライブに一時保存
  ├─ importCSVToNewSheet() → 一時シートにインポート
  ├─ cleanDataFromSheet() → データクレンジング
  ├─ 「データ」シートの既存データをクリア
  ├─ DataPersistence.clearAll() → 永続化データをクリア
  ├─ transferDataToDestination() → 「済み」→「データ」シートに転記
  │
  ├─ ★★★ rebuildCacheAfterImport() ★★★ 【全計算をここで実行】
  │     │
  │     ├─ [解析] DataLayer.forceIncrementalUpdate(true)
  │     │     ├─ 全レコードをループ処理
  │     │     ├─ LocationParser.parseLocationWithMaster() → 勤務地解析
  │     │     └─ SalaryParser.parseSalary() → 給与解析
  │     │
  │     ├─ [集計] DataLayer.getAggregation(true)
  │     │     └─ Aggregator で統計計算（給与分布、地域別、タグ別等）
  │     │
  │     └─ [保存] DataPersistence.savePrecomputedDashboard(aggregation)
  │           └─ ★ 計算結果を永続化（ダッシュボードはこれを読むだけ）
  │
  └─ lastImportTimestamp を保存
```

**設計思想**: 計算は1回（インポート時）、表示は読み込むだけ（タイムアウト回避）

### 2. ダッシュボード表示の流れ（★読み込むだけ、計算なし）

```
[ユーザー] メニュー「ダッシュボード」をクリック
      ↓
[Dashboard.html] loadData() 実行
      ↓
[Step 1] getDashboardSummary() → サマリーを先に表示
      ↓
[Step 2] getDashboardData() 呼び出し
      ↓
[ApiHandler.js] getDashboardData()
  │
  ├─ ★ DataPersistence.loadPrecomputedDashboard()
  │     └─ インポート時に保存した計算済みデータを読み込み
  │     └─ 【計算なし】そのまま返す → 高速（数百ms）
  │
  └─ （万が一、事前計算データがない場合のみ）フォールバック
        └─ DataLayer.getAggregation() → リアルタイム集計（遅い）
      ↓
[Dashboard.html] onDataLoaded() → グラフ・テーブル描画
```

**通常フロー**: 事前計算データがあるので「読み込み→表示」のみ

### 3. マップ表示の流れ

```
[ユーザー] メニュー「マップビュー」をクリック
      ↓
[MapView.html] loadData() 実行
      ↓
google.script.run.getMapData()
      ↓
[GeoData.js] getMapData()
  ├─ DataLayer.getAggregation(true) → 集計データ（forceRefresh）
  ├─ getTargetLocations() → 「検索対象」シートからターゲット地域取得
  │     └─ getCityCoordinates() で各ターゲットの座標を解決
  ├─ DataLayer.getCityAggregation(true) → 都市別集計
  │     └─ getCityCoordinates(group.name) で各都市の座標を解決
  ├─ calculateMapBounds() → マップ表示範囲を計算
  └─ DataLayer.calculateInflow() → 流入率分析
      ↓
{ success: true, data: { targets, cities, bounds, summary, ... } }
      ↓
[MapView.html] handleData() → Leaflet.js でマップ描画
```

### 4. 座標解決の詳細フロー

```
[都市名] "みなかみ町"
      ↓
[getCityCoordinates(cityName)]
  │
  ├─ [Step 1] 完全一致検索
  │     CITY_COORDINATES["みなかみ町"] → [36.78, 138.9967] ✓ 発見
  │
  ├─ [Step 2] 部分一致検索（Step 1で見つからない場合）
  │     for (city in CITY_COORDINATES)
  │       if (cityName.includes(city) || city.includes(cityName))
  │
  └─ [Step 3] 都道府県フォールバック（Step 2で見つからない場合）
        for (pref in PREFECTURE_COORDINATES)
          if (cityName.includes(pref) || pref.includes(cityName))
      ↓
[座標配列] [36.78, 138.9967] または null
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
