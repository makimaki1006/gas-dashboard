# 同時アクセス制御（ConcurrencyControl）

**作成日**: 2026-01-11
**対象ファイル**: `Code.js`

---

## 1. 概要

複数ユーザーが同じスプレッドシートを共有して同時にCSVインポートを行った場合の競合を防止するため、`LockService`を使用した排他制御を実装。

## 2. 問題点（修正前）

| 項目 | 状態 | リスク |
|------|------|--------|
| LockService | ❌ 未使用 | 同時インポートで上書き競合 |
| CacheService | `getScriptCache()` (全ユーザー共有) | キャッシュ不整合 |
| PropertiesService | `getScriptProperties()` (全ユーザー共有) | タイムスタンプ競合 |

### 競合シナリオ

```
時刻     ユーザーA              ユーザーB
─────────────────────────────────────────────────
10:00    CSVインポート開始
10:01                           CSVインポート開始
10:02    データ書き込み中
10:03                           データ書き込み（Aを上書き）
10:04    キャッシュ再構築
10:05                           キャッシュ再構築（Aの結果を上書き）
10:06    完了（Bのデータになっている！）
```

## 3. 解決策

### ConcurrencyControlオブジェクト

```javascript
const ConcurrencyControl = {
  LOCK_TYPES: {
    CSV_IMPORT: 'csv_import',
    CACHE_REBUILD: 'cache_rebuild',
    DATA_WRITE: 'data_write'
  },

  TIMEOUTS: {
    CSV_IMPORT: 300000,    // 5分
    CACHE_REBUILD: 60000,  // 1分
    DATA_WRITE: 30000      // 30秒
  },

  executeWithLock: function(lockType, callback, waitTimeMs) { ... },
  getProcessingStatus: function() { ... },
  setProcessingStatus: function(processType) { ... },
  clearProcessingStatus: function() { ... }
};
```

### 保護された処理フロー

```
時刻     ユーザーA              ユーザーB
─────────────────────────────────────────────────
10:00    ロック取得 ✅
10:00    CSVインポート開始
10:01                           ロック取得試行...待機中
10:02    データ書き込み中
10:03    キャッシュ再構築
10:04    ロック解放 ✅
10:04                           ロック取得 ✅
10:04                           CSVインポート開始
10:05    完了                   データ書き込み中
10:06                           キャッシュ再構築
10:07                           ロック解放 ✅
10:07                           完了
```

## 4. 実装詳細

### 4.1 processCSVFile関数

```javascript
function processCSVFile(fileContent, fileName) {
  // 同時アクセス制御付きで実行
  const lockResult = ConcurrencyControl.executeWithLock(
    ConcurrencyControl.LOCK_TYPES.CSV_IMPORT,
    function() {
      return processCSVFileInternal(fileContent, fileName);
    }
  );

  if (!lockResult.success) {
    return {
      success: false,
      message: lockResult.error
    };
  }

  return lockResult.result;
}
```

### 4.2 ダイアログ表示前チェック

```javascript
function showFileUploadDialog() {
  const status = ConcurrencyControl.getProcessingStatus();
  if (status.isProcessing) {
    // 警告ダイアログを表示
    // ユーザーは続行するか選択可能
  }
  // ...
}
```

### 4.3 フロントエンドAPI

```javascript
// 処理状態を取得
function getProcessingStatus() {
  return {
    isProcessing: boolean,
    processType: string,
    elapsedSeconds: number
  };
}
```

## 5. ユーザー体験

### インポート試行時

1. **他ユーザーが処理中の場合**:
   - 警告ダイアログ表示
   - 経過時間を表示
   - 続行/キャンセルを選択可能

2. **続行した場合**:
   - 最大5分間ロック取得を待機
   - タイムアウト時はエラーメッセージ

3. **正常時**:
   - 通常通りインポート処理

### エラーメッセージ

| 状況 | メッセージ |
|------|-----------|
| ロック取得失敗 | 「他のユーザーが処理中です。しばらく待ってから再試行してください。」 |
| 処理中警告 | 「他のユーザーがCSVインポート中です。（経過時間: XX秒）」 |

## 6. 制限事項

1. **ロックタイムアウト**: 最大5分。それ以上かかる処理は分割が必要
2. **スコープ**: スクリプトロックはスプレッドシート単位。複数スプレッドシートには別々のロック
3. **エラー回復**: 処理中にエラーが発生した場合、10分後にステータスが自動クリア

## 7. 今後の拡張候補

| 機能 | 説明 | 優先度 |
|------|------|--------|
| ユーザー名表示 | 「○○さんが処理中」と表示 | 中 |
| 進捗表示 | 処理進捗をリアルタイム表示 | 低 |
| 通知機能 | 処理完了時に他ユーザーに通知 | 低 |
| キュー機能 | 複数リクエストを順番に処理 | 低 |
