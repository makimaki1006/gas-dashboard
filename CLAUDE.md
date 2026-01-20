# GAS Dashboard プロジェクト指示

## 🔴 CRITICAL: GAS関連の情報提示ルール

**GASの関数を実行してもらう際は、必ず以下を明示すること:**

| 必須項目 | 例 |
|----------|-----|
| **ファイル名** | `ApiHandler.gs` |
| **関数名** | `getDashboardData` |

### 正しい例
```
ApiHandler.gs の getDashboardData を実行してください
```

### ダメな例
```
getDashboardData を実行してください  ← ファイル名がない
```

## GASファイル構成

| ファイル名 | 役割 |
|-----------|------|
| Code.gs | エントリポイント、メニュー構成 |
| ApiHandler.gs | APIエンドポイント、診断関数 |
| GeoData.gs | 地理データ、座標管理 |
| CityMasterData.gs | 市区町村・駅マスタデータ |
| DataLayer.gs | 統一データレイヤー、キャッシュ |
| DataPersistence.gs | データ永続化 |
| Aggregator.gs | データ集計ロジック |
| LocationParser.gs | 勤務地テキスト解析 |
| SalaryParser.gs | 給与テキスト解析 |
| Constants.gs | 定数定義 |

## デバッグ用関数一覧

| ファイル | 関数名 | 用途 |
|----------|--------|------|
| ApiHandler.gs | `diagnosePrecomputedData` | 事前計算データの状態確認（ダッシュボード/地図/分析） |
| ApiHandler.gs | `forceRegeneratePrecomputedData` | 事前計算データを強制再生成 |
| ApiHandler.gs | `diagnoseDataState` | データ状態全体の診断 |
| ApiHandler.gs | `getDashboardData` | ダッシュボードデータ取得テスト |
| ApiHandler.gs | `getCompanyAnalysis` | 企業分析データ取得テスト |
| ApiHandler.gs | `getTagSalaryAnalysis` | タグ×給与相関データ取得テスト |
| ApiHandler.gs | `debugKumamotoIssue` | 熊本県誤認識デバッグ（住所パースバグ調査） |
| ApiHandler.gs | `testLocationParserComprehensive` | 🔴網羅的住所パーステスト（北区/中央区等の衝突検証） |
| ApiHandler.gs | `diagnoseMapPinIssue` | 🗺️地図ピン問題の診断（座標解決・フォールバック状況） |
| GeoData.gs | `testGetCityCoordinates` | 座標解決ロジックのテスト |
| CityMasterData.gs | `diagnoseMapData` | 地図データ診断 |

## GASエディタURL

```
https://script.google.com/d/1XVs-9zCl9HORvWDKoft2B9P2jcn6j3tnSg86RicXfPx3KBAjtSwPhhpN/edit
```

## スプレッドシートURL

```
https://docs.google.com/spreadsheets/d/1OaSTHobXnz23O3D98aFo6wFD08fDmjqn6YtI_lJv1Pk/edit
```
