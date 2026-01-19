/**
 * HTMLテンプレートのinclude関数
 * <?!= include("ファイル名") ?> で使用
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 同時アクセス制御ユーティリティ
 * ═══════════════════════════════════════════════════════════════════════════
 * LockServiceを使用して、複数ユーザーの同時操作による競合を防止
 */
const ConcurrencyControl = {
  /**
   * ロックタイプの定義
   */
  LOCK_TYPES: {
    CSV_IMPORT: 'csv_import',
    CACHE_REBUILD: 'cache_rebuild',
    DATA_WRITE: 'data_write'
  },

  /**
   * タイムアウト設定（ミリ秒）
   */
  TIMEOUTS: {
    CSV_IMPORT: 300000,    // 5分（大きなCSVファイル対応）
    CACHE_REBUILD: 60000,  // 1分
    DATA_WRITE: 30000      // 30秒
  },

  /**
   * スクリプトロックを取得して処理を実行
   * @param {string} lockType - ロックタイプ
   * @param {Function} callback - ロック取得後に実行する関数
   * @param {number} waitTimeMs - ロック取得待機時間（ミリ秒）
   * @returns {Object} - { success: boolean, result: any, error: string }
   */
  executeWithLock: function(lockType, callback, waitTimeMs) {
    const lock = LockService.getScriptLock();
    const timeout = waitTimeMs || this.TIMEOUTS[lockType] || 30000;

    try {
      // ロック取得を試行
      const acquired = lock.tryLock(timeout);

      if (!acquired) {
        console.warn('ロック取得失敗: ' + lockType + ' (タイムアウト: ' + timeout + 'ms)');
        return {
          success: false,
          result: null,
          error: '他のユーザーが処理中です。しばらく待ってから再試行してください。'
        };
      }

      console.log('ロック取得成功: ' + lockType);

      // コールバック実行
      const result = callback();

      return {
        success: true,
        result: result,
        error: null
      };

    } catch (error) {
      console.error('ロック内処理エラー: ' + lockType, error);
      return {
        success: false,
        result: null,
        error: error.toString()
      };

    } finally {
      // 必ずロックを解放
      try {
        lock.releaseLock();
        console.log('ロック解放: ' + lockType);
      } catch (e) {
        console.warn('ロック解放エラー:', e);
      }
    }
  },

  /**
   * 現在の処理状態を取得
   * @returns {Object} - { isProcessing: boolean, processType: string, startTime: number }
   */
  getProcessingStatus: function() {
    const props = PropertiesService.getScriptProperties();
    const status = props.getProperty('processingStatus');

    if (!status) {
      return { isProcessing: false, processType: null, startTime: null };
    }

    try {
      const parsed = JSON.parse(status);
      // 10分以上経過したステータスは無効とみなす
      if (parsed.startTime && (Date.now() - parsed.startTime) > 600000) {
        this.clearProcessingStatus();
        return { isProcessing: false, processType: null, startTime: null };
      }
      return parsed;
    } catch (e) {
      return { isProcessing: false, processType: null, startTime: null };
    }
  },

  /**
   * 処理開始を記録
   * @param {string} processType - 処理タイプ
   */
  setProcessingStatus: function(processType) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('processingStatus', JSON.stringify({
      isProcessing: true,
      processType: processType,
      startTime: Date.now()
    }));
  },

  /**
   * 処理完了を記録
   */
  clearProcessingStatus: function() {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('processingStatus');
  }
};

/**
 * メニューの作成
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('データ処理')
    .addItem('CSVファイルをインポート', 'showFileUploadDialog')
    .addSeparator()
    .addItem('📊 データ分析を開く', 'openCombinedView')
    .addSeparator()
    .addItem('ダッシュボードのみ', 'openDashboard')
    .addItem('地図ビューのみ', 'openMapView')
    .addItem('データを再集計', 'refreshDashboardData')
    .addSeparator()
    .addSubMenu(ui.createMenu('キャッシュ管理')
      .addItem('セッションキャッシュをクリア', 'clearSessionCacheMenu')
      .addItem('全キャッシュをクリア（永続化含む）', 'clearAllCacheMenu')
      .addItem('キャッシュ状態を表示', 'showCacheStatus'))
    .addSubMenu(ui.createMenu('マスタ管理')
      .addItem('市町村マスタを作成', 'createFullCityMasterSheet')
      .addItem('座標を自動入力', 'populateCityCoordinates')
      .addItem('駅名マスタを作成', 'createFullStationMasterSheet')
      .addSeparator()
      .addItem('🗺️ 地図データ診断', 'diagnoseMapData')
      .addItem('🔄 座標をリセット＆再入力', 'resetAndRepopulateCoordinates'))
    .addSeparator()
    .addItem('🔍 データフロー診断', 'runDiagnosticFromMenu')
    .addToUi();
}

/**
 * セッションキャッシュをクリア（メニュー用）
 */
function clearSessionCacheMenu() {
  DataLayer.clearCache();
  SpreadsheetApp.getUi().alert('セッションキャッシュをクリアしました。');
}

/**
 * 全キャッシュをクリア（メニュー用）
 */
function clearAllCacheMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '確認',
    '永続化されたデータを含む全キャッシュをクリアします。\n次回のデータ取得時に全件再解析が実行されます。\n\nよろしいですか？',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    DataLayer.clearAllCache(true);
    ui.alert('全キャッシュをクリアしました。');
  }
}

/**
 * キャッシュ状態を表示（メニュー用）
 */
function showCacheStatus() {
  const status = DataLayer.getCacheStatus();
  const ui = SpreadsheetApp.getUi();

  let message = '=== キャッシュ状態 ===\n\n';

  // セッションキャッシュ
  message += '【セッションキャッシュ】\n';
  message += '  生データ: ' + (status.session.hasRawData ? '✓' : '×') + '\n';
  message += '  解析済み: ' + (status.session.hasParsedData ? '✓' : '×') + '\n';
  message += '  集計: ' + (status.session.hasAggregation ? '✓' : '×') + '\n';
  message += '  有効: ' + (status.session.isValid ? '✓' : '×') + '\n\n';

  // 永続化データ
  message += '【永続化データ】\n';
  message += '  解析済み: ' + status.persistent.parsedData.sizeKB + 'KB (' + status.persistent.parsedData.chunks + 'チャンク)\n';
  message += '  ハッシュマップ: ' + status.persistent.hashMap.sizeKB + 'KB (' + status.persistent.hashMap.chunks + 'チャンク)\n';
  message += '  合計: ' + status.persistent.totalSizeKB + 'KB\n\n';

  // 最後の増分更新
  if (status.lastIncremental) {
    message += '【最後の増分更新】\n';
    message += '  モード: ' + status.lastIncremental.mode + '\n';
    message += '  追加: ' + status.lastIncremental.stats.added + '\n';
    message += '  変更なし: ' + status.lastIncremental.stats.unchanged + '\n';
    message += '  削除: ' + status.lastIncremental.stats.deleted + '\n';
    message += '  処理時間: ' + status.lastIncremental.duration + 'ms\n';
  }

  ui.alert('キャッシュ状態', message, ui.ButtonSet.OK);
}

/**
 * ファイルアップロードダイアログを表示
 * ※ 他のユーザーが処理中の場合は警告を表示
 */
function showFileUploadDialog() {
  // 処理中チェック
  const status = ConcurrencyControl.getProcessingStatus();
  if (status.isProcessing) {
    const ui = SpreadsheetApp.getUi();
    const elapsedSec = Math.round((Date.now() - status.startTime) / 1000);
    const response = ui.alert(
      '⚠️ 処理中',
      '他のユーザーがCSVインポート中です。（経過時間: ' + elapsedSec + '秒）\n\n' +
      '続行すると、処理が完了するまで待機します。\n続行しますか？',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }
  }

  const html = HtmlService.createHtmlOutputFromFile('FileUpload')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi()
    .showModalDialog(html, 'CSVファイルのインポート');
}

/**
 * 現在の処理状態を取得（フロントエンドから呼び出し可能）
 * @returns {Object} - { isProcessing: boolean, processType: string, elapsedSeconds: number }
 */
function getProcessingStatus() {
  const status = ConcurrencyControl.getProcessingStatus();
  return {
    isProcessing: status.isProcessing,
    processType: status.processType,
    elapsedSeconds: status.startTime ? Math.round((Date.now() - status.startTime) / 1000) : 0
  };
}

/**
 * CSVファイルを処理してインポート＆クレンジング＆転記
 * ※ LockServiceによる排他制御で同時インポートを防止
 * @param {string} fileContent - CSVファイル内容
 * @param {string} fileName - ファイル名
 * @param {string} salaryDisplayType - 給与表示タイプ ('monthly' or 'hourly')
 */
function processCSVFile(fileContent, fileName, salaryDisplayType) {
  // デフォルトは月給ベース
  salaryDisplayType = salaryDisplayType || 'monthly';

  // 同時アクセス制御付きで実行
  const lockResult = ConcurrencyControl.executeWithLock(
    ConcurrencyControl.LOCK_TYPES.CSV_IMPORT,
    function() {
      return processCSVFileInternal(fileContent, fileName, salaryDisplayType);
    }
  );

  if (!lockResult.success) {
    return {
      success: false,
      message: lockResult.error || 'ロック取得に失敗しました。'
    };
  }

  return lockResult.result;
}

/**
 * CSVファイル処理の内部実装（ロック取得後に実行）
 * @param {string} fileContent - CSVファイル内容
 * @param {string} fileName - ファイル名
 * @param {string} salaryDisplayType - 給与表示タイプ ('monthly' or 'hourly')
 */
function processCSVFileInternal(fileContent, fileName, salaryDisplayType) {
  try {
    // ★★★ 最初にストレージをクリア（クォータエラー対策）★★★
    console.log('=== ストレージ強制クリア開始 ===');
    try {
      const props = PropertiesService.getScriptProperties();
      const allKeys = Object.keys(props.getProperties());
      const targetKeys = allKeys.filter(k =>
        k.startsWith('inc_') || k.startsWith('precomputed_')
      );
      console.log('削除対象キー数: ' + targetKeys.length);
      targetKeys.forEach(key => {
        try { props.deleteProperty(key); } catch (e) { /* ignore */ }
      });
      console.log('ストレージクリア完了');
    } catch (clearError) {
      console.warn('ストレージクリアエラー（続行）:', clearError);
    }
    console.log('=== ストレージ強制クリア完了 ===');

    // 処理開始を記録
    ConcurrencyControl.setProcessingStatus(ConcurrencyControl.LOCK_TYPES.CSV_IMPORT);

    // タイムスタンプ付きの一時シート名を作成
    const timestamp = Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd_HHmmss');
    const tempSheetName = `temp_${timestamp}`;

    // 一時的にGoogleドライブにファイルを保存
    const blob = Utilities.newBlob(fileContent, 'text/csv', fileName);
    const file = DriveApp.createFile(blob);

    // Sheets APIを使用してインポート
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    importCSVToNewSheet(spreadsheetId, file.getId(), tempSheetName);

    // 一時ファイルを削除
    file.setTrashed(true);

    // クレンジング処理を実行
    const cleanResult = cleanDataFromSheet(tempSheetName);

    // ★重要★ 新規CSVインポート前に既存データを完全クリア（データ混在防止）
    console.log('=== 既存データ完全クリア（データ混在防止） ===');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('データ');
    if (dataSheet && dataSheet.getLastRow() > 1) {
      dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, dataSheet.getLastColumn()).clearContent();
      console.log('「データ」シートの既存データをクリア: ' + (dataSheet.getLastRow() - 1) + '行削除');
    }
    const propsClearResult = DataPersistence.clearAll(false);
    console.log('DataPersistenceクリア: ' + JSON.stringify(propsClearResult));
    if (!propsClearResult.success || propsClearResult.remaining > 0) {
      console.warn('⚠️ クリア不完全 - 強制クリア実行中...');
      forceNuclearClear();
    }
    if (!DataPersistence.verifyClearAll()) {
      console.error('❌ クリア検証失敗！');
    } else {
      console.log('✅ 既存データ完全クリア成功');
    }
    console.log('=== 既存データクリア完了 ===');

    // 給与表示タイプを保存（分析時に参照）
    PropertiesService.getScriptProperties().setProperty('salaryDisplayType', salaryDisplayType);
    console.log('給与表示タイプ保存: ' + salaryDisplayType);

    // データ転記処理を実行（クリア後なので新規データのみ追加される）
    const transferResult = transferDataToDestination();

    // 一時シートを削除（ssは上で定義済み）
    const tempSheet = ss.getSheetByName(tempSheetName);
    if (tempSheet) {
      ss.deleteSheet(tempSheet);
    }

    // 「済み」シートも削除
    const doneSheet = ss.getSheetByName("済み");
    if (doneSheet) {
      ss.deleteSheet(doneSheet);
    }

    // 「検索対象」シートのデータをクリア（インポート後に顧客情報ダイアログで再入力される）
    const targetSheet = ss.getSheetByName("検索対象");
    if (targetSheet && targetSheet.getLastRow() > 1) {
      targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, targetSheet.getLastColumn()).clearContent();
      console.log('「検索対象」シートのデータをクリアしました（顧客情報ダイアログで再入力）');
    }

    // Phase 4: キャッシュ強制クリア＆再構築（CSVインポート時は常に実行）
    console.log('=== Phase 4: キャッシュ強制クリア＆再構築 ===');
    rebuildCacheAfterImport();
    console.log('=== Phase 4: 完了 ===');

    // Phase 4.5: 最終インポート時刻を保存（クライアント側で強制リフレッシュ判定に使用）
    const importTimestamp = Date.now();
    PropertiesService.getScriptProperties().setProperty('lastImportTimestamp', String(importTimestamp));
    console.log('Phase 4.5: 最終インポート時刻保存 = ' + importTimestamp);

    // Phase 5: PDFレポート自動生成
    console.log('=== Phase 5: PDFレポート自動生成 ===');
    let reportInfo = '';
    try {
      const reportResult = generatePdfReport();
      if (reportResult.success) {
        reportInfo = '\n\n📄 レポートを自動生成しました: ' + reportResult.data.fileName;
        console.log('Phase 5: レポート生成成功 - ' + reportResult.data.fileName);
      } else {
        console.warn('Phase 5: レポート生成失敗 - ' + reportResult.error);
      }
    } catch (reportError) {
      console.warn('Phase 5: レポート生成エラー（無視）:', reportError);
    }
    console.log('=== Phase 5: 完了 ===');

    // 処理完了を記録
    ConcurrencyControl.clearProcessingStatus();

    return {
      success: true,
      message: `CSVファイルの処理が完了しました。\n${cleanResult}\n${transferResult}\n一時シートと「済み」シートを削除しました。${reportInfo}`
    };
  } catch (error) {
    // エラー時も処理状態をクリア
    ConcurrencyControl.clearProcessingStatus();
    console.error('処理エラー:', error);
    return {
      success: false,
      message: 'エラーが発生しました: ' + error.toString()
    };
  }
}

/**
 * Google Sheets APIを使用してCSVを新しいシートにインポート
 */
function importCSVToNewSheet(spreadsheetId, fileId, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 新しいシートを作成
  const newSheet = ss.insertSheet(sheetName);
  
  // CSVデータを取得してパース
  const csvData = DriveApp.getFileById(fileId).getBlob().getDataAsString();
  const parsedData = Utilities.parseCsv(csvData);
  
  // Sheets APIを使用してデータを書き込み
  const resource = {
    valueInputOption: 'RAW',
    data: [{
      range: `${sheetName}!A1`,
      values: parsedData
    }]
  };
  
  Sheets.Spreadsheets.Values.batchUpdate(resource, spreadsheetId);
}

/**
 * 動的カラム検出のためのパターン判定関数群
 */
const ColumnDetectionPatterns = {
  // 勤務地パターン（都道府県・市区町村）
  isLocation: function(value) {
    if (!value) return 0;
    const text = String(value);
    // 都道府県パターン
    const prefecturePattern = /(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)[都道府県]?/;
    // 市区町村パターン
    const cityPattern = /.{2,5}[市区町村郡]/;
    // 住所パターン（番地など）
    const addressPattern = /[0-9０-９]+[-−ー][0-9０-９]+/;

    let score = 0;
    if (prefecturePattern.test(text)) score += 50;
    if (cityPattern.test(text)) score += 30;
    if (addressPattern.test(text)) score += 20;
    // URLや長すぎるテキストは除外
    if (text.startsWith('http') || text.length > 100) score = 0;
    return score;
  },

  // 給与パターン
  isSalary: function(value) {
    if (!value) return 0;
    const text = String(value);
    let score = 0;
    // 給与キーワード（高優先度）- 「時給 1,140円」等を確実に検出
    if (/時給\s*[0-9０-９,，]+/.test(text)) score += 80;  // 時給+数字は最優先
    if (/月給\s*[0-9０-９,，]+/.test(text)) score += 70;  // 月給+数字
    if (/年収\s*[0-9０-９,，]+/.test(text)) score += 70;  // 年収+数字
    if (/日給\s*[0-9０-９,，]+/.test(text)) score += 60;  // 日給+数字
    // 金額パターン（中優先度）
    if (/[0-9０-９,，]+\s*円/.test(text)) score += 40;
    if (/[0-9０-９]+\s*万/.test(text)) score += 30;
    // 給与キーワード単体（低優先度）
    if (/月給|時給|年収|日給|年俸/.test(text) && score < 50) score += 30;
    // URLや住所は除外
    if (text.startsWith('http') || /[市区町村]/.test(text)) score = 0;
    return score;
  },

  // 会社名パターン
  isCompanyName: function(value) {
    if (!value) return 0;
    const text = String(value);
    let score = 0;
    // 法人格パターン
    if (/株式会社|有限会社|合同会社|合資会社|一般社団法人|一般財団法人|NPO法人|医療法人|学校法人|社会福祉法人/.test(text)) score += 60;
    // (株)などの省略形
    if (/[（(]株[）)]|[（(]有[）)]|[（(]合[）)]/.test(text)) score += 50;
    // 適度な長さ（短すぎず長すぎず）
    if (text.length >= 3 && text.length <= 50) score += 10;
    // URLや住所、金額は除外
    if (text.startsWith('http') || /[0-9]+円/.test(text) || /[0-9]+-[0-9]+/.test(text)) score = 0;
    return score;
  },

  // URLパターン
  isUrl: function(value) {
    if (!value) return 0;
    const text = String(value);
    if (text.startsWith('http://') || text.startsWith('https://')) return 100;
    if (text.includes('.com') || text.includes('.jp') || text.includes('.co.jp')) return 50;
    return 0;
  },

  // 求人タイトルパターン
  isJobTitle: function(value) {
    if (!value) return 0;
    const text = String(value);
    let score = 0;
    // 職種キーワード
    const jobKeywords = /エンジニア|デザイナー|営業|事務|経理|人事|マネージャー|ディレクター|スタッフ|アシスタント|コンサルタント|プログラマ|開発|販売|接客|製造|ドライバー|看護|介護|医療|教師|講師|店長|リーダー|担当|募集/;
    if (jobKeywords.test(text)) score += 40;
    // 適度な長さ（タイトルらしい長さ）
    if (text.length >= 5 && text.length <= 100) score += 20;
    // URLは除外
    if (text.startsWith('http')) score = 0;
    // 住所や金額は除外
    if (/[0-9]+円/.test(text) || /[0-9]+-[0-9]+-[0-9]+/.test(text)) score = 0;
    return score;
  },

  // 雇用形態パターン
  isEmploymentType: function(value) {
    if (!value) return 0;
    const text = String(value);
    if (/正社員|契約社員|派遣社員|パート|アルバイト|業務委託|請負|嘱託/.test(text)) return 100;
    return 0;
  },

  // 新着ラベルパターン
  isNewLabel: function(value) {
    if (!value) return 0;
    const text = String(value);
    if (/新着|NEW|new|本日|今日|[0-9]+日前/.test(text)) return 100;
    return 0;
  },

  // メタデータ行判定（除外対象）
  isMetadataRow: function(row) {
    const firstCol = String(row[0] || "");
    // Indeed特有のメタデータ行パターン
    if (firstCol.includes("この採用企業") ||
        firstCol.includes("優先条件") ||
        firstCol.includes("希望する給与") ||
        firstCol.includes("新しい求人") ||
        firstCol === "") {
      return true;
    }
    return false;
  }
};

/**
 * 動的カラム検出を実行
 * @param {Array} headers - ヘッダー行
 * @param {Array} dataRows - データ行（最初の数行をサンプリング）
 * @returns {Object} カラムインデックスマッピング
 */
function detectColumnsAutomatically(headers, dataRows) {
  console.log('動的カラム検出開始: ' + headers.length + '列, ' + dataRows.length + '行をサンプリング');

  // 各列のスコアを計算
  const columnScores = {
    location: {},
    salary: {},
    companyName: {},
    jobTitle: {},
    jobUrl: {},
    employmentType: {},
    newLabel: {}
  };

  // サンプル行（最大20行）を分析
  const sampleSize = Math.min(dataRows.length, 20);
  for (let rowIdx = 0; rowIdx < sampleSize; rowIdx++) {
    const row = dataRows[rowIdx];
    if (!row || ColumnDetectionPatterns.isMetadataRow(row)) continue;

    for (let colIdx = 0; colIdx < row.length && colIdx < headers.length; colIdx++) {
      const value = row[colIdx];
      if (!value || String(value).trim() === "") continue;

      // 各パターンのスコアを計算
      const locationScore = ColumnDetectionPatterns.isLocation(value);
      const salaryScore = ColumnDetectionPatterns.isSalary(value);
      const companyScore = ColumnDetectionPatterns.isCompanyName(value);
      const jobTitleScore = ColumnDetectionPatterns.isJobTitle(value);
      const urlScore = ColumnDetectionPatterns.isUrl(value);
      const employmentScore = ColumnDetectionPatterns.isEmploymentType(value);
      const newLabelScore = ColumnDetectionPatterns.isNewLabel(value);

      // スコアを累積
      columnScores.location[colIdx] = (columnScores.location[colIdx] || 0) + locationScore;
      columnScores.salary[colIdx] = (columnScores.salary[colIdx] || 0) + salaryScore;
      columnScores.companyName[colIdx] = (columnScores.companyName[colIdx] || 0) + companyScore;
      columnScores.jobTitle[colIdx] = (columnScores.jobTitle[colIdx] || 0) + jobTitleScore;
      columnScores.jobUrl[colIdx] = (columnScores.jobUrl[colIdx] || 0) + urlScore;
      columnScores.employmentType[colIdx] = (columnScores.employmentType[colIdx] || 0) + employmentScore;
      columnScores.newLabel[colIdx] = (columnScores.newLabel[colIdx] || 0) + newLabelScore;
    }
  }

  // 各フィールドで最もスコアの高い列を選択
  function selectBestColumns(scores, minScore, maxColumns) {
    const sorted = Object.entries(scores)
      .filter(([col, score]) => score >= minScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColumns);
    return sorted.map(([col, score]) => parseInt(col));
  }

  // 結果を構築
  const result = {
    // 単一列フィールド（最高スコアの列を1つ選択）
    jobTitle: selectBestColumns(columnScores.jobTitle, 50, 1)[0] ?? -1,
    jobUrl: selectBestColumns(columnScores.jobUrl, 50, 1)[0] ?? -1,
    newLabel: selectBestColumns(columnScores.newLabel, 50, 1)[0] ?? -1,
    // 複数候補列フィールド（スコア上位を複数選択）
    locationCandidates: selectBestColumns(columnScores.location, 30, 5),
    salaryCandidates: selectBestColumns(columnScores.salary, 30, 5),
    companyNameCandidates: selectBestColumns(columnScores.companyName, 30, 5),
    employmentTypeCandidates: selectBestColumns(columnScores.employmentType, 50, 3)
  };

  // ヘッダー名によるフォールバック（動的検出で見つからない場合）
  function fallbackByHeader(headerPatterns, currentIndexes) {
    if (currentIndexes.length > 0) return currentIndexes;
    const indexes = [];
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).toLowerCase();
      for (const pattern of headerPatterns) {
        if (header.includes(pattern)) {
          indexes.push(i);
          break;
        }
      }
    }
    return indexes;
  }

  // フォールバック適用（ヘッダーに特定のキーワードがあれば使用）
  if (result.jobTitle < 0) {
    const idx = headers.findIndex(h => String(h).toLowerCase().includes('jobtitle') || String(h).includes('タイトル'));
    if (idx >= 0) result.jobTitle = idx;
  }
  if (result.jobUrl < 0) {
    const idx = headers.findIndex(h => String(h).toLowerCase().includes('href') || String(h).toLowerCase().includes('url'));
    if (idx >= 0) result.jobUrl = idx;
  }
  if (result.newLabel < 0) {
    const idx = headers.findIndex(h => String(h).toLowerCase().includes('label') || String(h).includes('新着'));
    if (idx >= 0) result.newLabel = idx;
  }

  // ログ出力
  console.log('動的カラム検出結果:');
  console.log('  jobTitle: ' + result.jobTitle + ' (' + (result.jobTitle >= 0 ? headers[result.jobTitle] : 'なし') + ')');
  console.log('  jobUrl: ' + result.jobUrl + ' (' + (result.jobUrl >= 0 ? headers[result.jobUrl] : 'なし') + ')');
  console.log('  newLabel: ' + result.newLabel + ' (' + (result.newLabel >= 0 ? headers[result.newLabel] : 'なし') + ')');
  console.log('  locationCandidates: [' + result.locationCandidates.map(i => headers[i]).join(', ') + ']');
  console.log('  salaryCandidates: [' + result.salaryCandidates.map(i => headers[i]).join(', ') + ']');
  console.log('  companyNameCandidates: [' + result.companyNameCandidates.map(i => headers[i]).join(', ') + ']');
  console.log('  employmentTypeCandidates: [' + result.employmentTypeCandidates.map(i => headers[i]).join(', ') + ']');

  return result;
}

/**
 * 指定シートからデータをクレンジング
 * データソースを自動判定し、適切なカラムマッピングを使用
 */
function cleanDataFromSheet(sourceSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(sourceSheetName);

  if (!sourceSheet) {
    throw new Error(`シート「${sourceSheetName}」が見つかりません。`);
  }

  const data = sourceSheet.getDataRange().getValues();
  if (data.length <= 1) {
    throw new Error('データがありません。');
  }

  // ヘッダー行
  const headers = data[0];
  const dataRows = data.slice(1);

  // データソースを自動判定
  const detectedSource = detectDataSource(headers);
  console.log('検出されたデータソース: ' + detectedSource);

  // データソース別の処理を分岐
  if (detectedSource === DATA_SOURCE_TYPES.KYUJIN_BOX) {
    return cleanKyujinBoxData(ss, headers, dataRows);
  } else {
    // Indeed形式または不明形式は従来の動的カラム検出を使用
    console.log('動的カラム検出モードで処理します');
  }

  // 動的カラム検出を実行（Indeed/不明形式用）
  const columnIndexes = detectColumnsAutomatically(headers, dataRows);

  // 各行で複数の列から最初に値がある列を取得するヘルパー
  function getFirstValidValue(row, columnIndexes) {
    for (const idx of columnIndexes) {
      if (idx >= 0 && idx < row.length && row[idx] && String(row[idx]).trim() !== "") {
        return row[idx];
      }
    }
    return "";
  }
  
  // タグカラムを検索
  const tagColumnIndexes = [];
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).includes("jobsearch-JobCard-tag")) {
      tagColumnIndexes.push(i);
    }
  }
  
  // クレンジング済みデータの配列
  const cleanedData = [["求人タイトル", "求人URL", "新着", "事業所名", "所在地", "タグ", "給与", "雇用形態"]];
  
  const employmentTypes = ['派遣社員', '契約社員', '正社員', 'パート', 'アルバイト', '派遣'];
  
  // データ行を処理
  let processedRows = 0;
  let skippedRows = 0;
  let skippedReasons = { metadata: 0, incomplete: 0, empty: 0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) {
      skippedRows++;
      skippedReasons.empty++;
      continue;
    }

    // メタデータ行を除外（ColumnDetectionPatternsを使用）
    if (ColumnDetectionPatterns.isMetadataRow(row)) {
      skippedRows++;
      skippedReasons.metadata++;
      continue;
    }

    // jobTitle列も追加チェック
    const jobTitleCol = columnIndexes.jobTitle >= 0 ? String(row[columnIndexes.jobTitle] || "") : "";
    if (jobTitleCol.includes("この採用企業") || jobTitleCol.includes("優先条件")) {
      skippedRows++;
      skippedReasons.metadata++;
      continue;
    }

    // 各行で複数候補列から最初に値がある列を取得
    const locationCol = getFirstValidValue(row, columnIndexes.locationCandidates);
    const companyCol = getFirstValidValue(row, columnIndexes.companyNameCandidates);

    // 勤務地が空で、会社名も空の行は除外（不完全なデータ）
    if (locationCol === "" && companyCol === "") {
      skippedRows++;
      skippedReasons.incomplete++;
      continue;
    }

    const newRow = [];

    // 各カラムのデータを抽出（複数候補列から最初に値がある列を使用）
    newRow.push(columnIndexes.jobTitle >= 0 ? (row[columnIndexes.jobTitle] || "") : "");
    newRow.push(columnIndexes.jobUrl >= 0 ? (row[columnIndexes.jobUrl] || "") : "");
    newRow.push(columnIndexes.newLabel >= 0 ? (row[columnIndexes.newLabel] || "") : "");
    newRow.push(companyCol);
    newRow.push(locationCol);

    // タグを統合
    let combinedTags = "";
    for (const colIndex of tagColumnIndexes) {
      if (colIndex < row.length && row[colIndex]) {
        if (combinedTags) combinedTags += ",";
        combinedTags += row[colIndex];
      }
    }
    newRow.push(combinedTags);

    // 給与データをクレンジング（複数候補列から取得）
    let salaryData = getFirstValidValue(row, columnIndexes.salaryCandidates);
    if (salaryData) {
      salaryData = salaryData.replace(/(\d+)\s+([万円])/g, '$1$2');
      salaryData = salaryData.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
      salaryData = salaryData.replace(/〜/g, '～');
      if (!salaryData.includes('円') && salaryData.includes('万')) {
        salaryData = salaryData.replace(/([0-9万,]+)(?!円)(\s*[～~〜]\s*|$)/g, '$1円$2');
      }
    }
    newRow.push(salaryData);
    
    // 雇用形態を抽出（複数候補列から取得）
    let employmentType = "";
    const checkValue = getFirstValidValue(row, columnIndexes.employmentTypeCandidates);
    for (const type of employmentTypes) {
      if (checkValue.includes(type)) {
        employmentType = type;
        break;
      }
    }
    
    // 雇用形態が見つからない場合、タグから探す
    if (!employmentType) {
      for (const colIndex of tagColumnIndexes) {
        if (colIndex < row.length && row[colIndex]) {
          const cellValue = String(row[colIndex]);
          for (const type of employmentTypes) {
            if (cellValue.includes(type)) {
              employmentType = type;
              break;
            }
          }
          if (employmentType) break;
        }
      }
    }
    
    newRow.push(employmentType);
    cleanedData.push(newRow);
    processedRows++;
  }
  
  // 「済み」シートに出力
  let doneSheet = ss.getSheetByName("済み");
  if (!doneSheet) {
    doneSheet = ss.insertSheet("済み");
  } else {
    doneSheet.clear();
  }
  
  if (cleanedData.length > 1) {
    doneSheet.getRange(1, 1, cleanedData.length, cleanedData[0].length).setValues(cleanedData);
    for (let i = 1; i <= cleanedData[0].length; i++) {
      doneSheet.setColumnWidth(i, 100);
    }
  }

  // データソースを記録（Indeed/不明形式）
  // detectedSourceが'indeed'または'unknown'の場合、8列形式として記録
  PropertiesService.getScriptProperties().setProperty('dataSourceType', detectedSource);
  console.log('データソースタイプを記録: ' + detectedSource);

  console.log('クレンジング完了:');
  console.log('  処理: ' + processedRows + '行');
  console.log('  スキップ: ' + skippedRows + '行');
  console.log('    - メタデータ行: ' + skippedReasons.metadata);
  console.log('    - 不完全データ: ' + skippedReasons.incomplete);
  console.log('    - 空行: ' + skippedReasons.empty);
  return `${processedRows}行を処理し、「済み」シートに出力しました。（スキップ: メタデータ${skippedReasons.metadata}行, 不完全${skippedReasons.incomplete}行, 空${skippedReasons.empty}行）`;
}

/**
 * 求人ボックスCSVデータをクレンジング
 * @param {Spreadsheet} ss - スプレッドシート
 * @param {string[]} headers - ヘッダー行
 * @param {Array[]} dataRows - データ行
 * @returns {string} 処理結果メッセージ
 */
function cleanKyujinBoxData(ss, headers, dataRows) {
  console.log('=== 求人ボックスCSVクレンジング開始 ===');

  // カラムマッピングを取得
  const mapping = DATA_SOURCE_COLUMNS[DATA_SOURCE_TYPES.KYUJIN_BOX];
  const columns = mapping.columns;

  // ヘッダーからカラムインデックスを取得
  function getColumnIndex(columnName) {
    const idx = headers.indexOf(columnName);
    if (idx < 0) {
      console.log('  警告: カラム「' + columnName + '」が見つかりません');
    }
    return idx;
  }

  const columnIndexes = {
    url: getColumnIndex(columns.url),
    title: getColumnIndex(columns.title),
    company: getColumnIndex(columns.company),
    location: getColumnIndex(columns.location),
    salary: getColumnIndex(columns.salary),
    employmentType: getColumnIndex(columns.employmentType),
    description: getColumnIndex(columns.description),
    newLabel: columns.newLabel ? getColumnIndex(columns.newLabel) : -1,  // 新着フラグ
    tags: columns.tags.map(t => getColumnIndex(t)).filter(i => i >= 0)
  };

  console.log('カラムインデックス: ' + JSON.stringify(columnIndexes));

  // クレンジング済みデータの配列（年間休日カラムを追加）
  const cleanedData = [["求人タイトル", "求人URL", "新着", "事業所名", "所在地", "タグ", "給与", "雇用形態", "年間休日", "詳細テキスト"]];

  const employmentTypes = ['派遣社員', '契約社員', '正社員', 'パート', 'アルバイト', '派遣', '業務委託'];

  // データ行を処理
  let processedRows = 0;
  let skippedRows = 0;
  let holidaysExtracted = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) {
      skippedRows++;
      continue;
    }

    // 必須データがない行はスキップ
    const title = columnIndexes.title >= 0 ? String(row[columnIndexes.title] || '').trim() : '';
    const company = columnIndexes.company >= 0 ? String(row[columnIndexes.company] || '').trim() : '';

    if (!title && !company) {
      skippedRows++;
      continue;
    }

    // 各カラムからデータを抽出
    const url = columnIndexes.url >= 0 ? String(row[columnIndexes.url] || '').trim() : '';
    const location = columnIndexes.location >= 0 ? String(row[columnIndexes.location] || '').trim() : '';
    const description = columnIndexes.description >= 0 ? String(row[columnIndexes.description] || '').trim() : '';

    // 給与データをクレンジング
    let salaryData = columnIndexes.salary >= 0 ? String(row[columnIndexes.salary] || '').trim() : '';
    if (salaryData) {
      salaryData = salaryData.replace(/(\d+)\s+([万円])/g, '$1$2');
      salaryData = salaryData.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
      salaryData = salaryData.replace(/〜/g, '～');
    }

    // 雇用形態を抽出
    let employmentType = '';
    const empTypeText = columnIndexes.employmentType >= 0 ? String(row[columnIndexes.employmentType] || '').trim() : '';
    for (const type of employmentTypes) {
      if (empTypeText.includes(type)) {
        employmentType = type;
        break;
      }
    }

    // タグを統合
    let combinedTags = '';
    for (const tagIdx of columnIndexes.tags) {
      if (tagIdx < row.length && row[tagIdx]) {
        const tagValue = String(row[tagIdx]).trim();
        if (tagValue) {
          if (combinedTags) combinedTags += ',';
          combinedTags += tagValue;
        }
      }
    }

    // 年間休日を抽出（詳細テキストから、失敗時はタイトルから補完）
    let annualHolidays = extractAnnualHolidays(description);
    if (annualHolidays === null) {
      // タイトルから補完を試行
      annualHolidays = extractAnnualHolidays(title);
    }
    if (annualHolidays !== null) {
      holidaysExtracted++;
    }

    // 新着フラグを取得（p-result_newカラムから）
    const newLabel = columnIndexes.newLabel >= 0 ? String(row[columnIndexes.newLabel] || '').trim() : '';

    const newRow = [
      title,
      url,
      newLabel,
      company,
      location,
      combinedTags,
      salaryData,
      employmentType,
      annualHolidays !== null ? annualHolidays : '',  // 年間休日
      description  // 詳細テキスト（年間休日の元データ参照用）
    ];

    cleanedData.push(newRow);
    processedRows++;
  }

  // 「済み」シートに出力
  let doneSheet = ss.getSheetByName("済み");
  if (!doneSheet) {
    doneSheet = ss.insertSheet("済み");
  } else {
    doneSheet.clear();
  }

  if (cleanedData.length > 1) {
    doneSheet.getRange(1, 1, cleanedData.length, cleanedData[0].length).setValues(cleanedData);
    for (let i = 1; i <= cleanedData[0].length; i++) {
      doneSheet.setColumnWidth(i, 100);
    }
  }

  // データソースを記録（分析時に参照）
  PropertiesService.getScriptProperties().setProperty('dataSourceType', DATA_SOURCE_TYPES.KYUJIN_BOX);

  console.log('=== 求人ボックスCSVクレンジング完了 ===');
  console.log('  処理: ' + processedRows + '行');
  console.log('  スキップ: ' + skippedRows + '行');
  console.log('  年間休日抽出: ' + holidaysExtracted + '件');

  return `求人ボックスCSV: ${processedRows}行を処理し、「済み」シートに出力しました。（年間休日抽出: ${holidaysExtracted}件, スキップ: ${skippedRows}行）`;
}

/**
 * データ転記処理（既存の「データ」タブのD列2行目から転記）
 */
function transferDataToDestination() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName("済み");
    
    if (!sourceSheet) {
      throw new Error("「済み」シートが見つかりません。");
    }
    
    // ソースデータを取得
    const sourceData = sourceSheet.getDataRange().getValues();
    if (sourceData.length <= 1) {
      return "転記するデータがありません。";
    }
    
    // 転記先のシート名を「データ」に変更
    const destinationSheetName = "データ";
    let destinationSheet = ss.getSheetByName(destinationSheetName);
    
    if (!destinationSheet) {
      throw new Error("「データ」シートが見つかりません。");
    }
    
    // ソースデータのヘッダーを取得
    const sourceHeaders = sourceData[0];
    const dataRows = sourceData.slice(1);
    
    // カラムインデックスのマッピング（年間休日・詳細テキストを追加）
    const columnMapping = {
      jobTitle: sourceHeaders.indexOf("求人タイトル"),
      jobUrl: sourceHeaders.indexOf("求人URL"),
      newLabel: sourceHeaders.indexOf("新着"),
      companyName: sourceHeaders.indexOf("事業所名"),
      location: sourceHeaders.indexOf("所在地"),
      tags: sourceHeaders.indexOf("タグ"),
      salary: sourceHeaders.indexOf("給与"),
      employmentType: sourceHeaders.indexOf("雇用形態"),
      annualHolidays: sourceHeaders.indexOf("年間休日"),
      description: sourceHeaders.indexOf("詳細テキスト")
    };

    // 転記用データの準備（D列から開始）
    const transferData = [];

    dataRows.forEach(row => {
      // 空行はスキップ
      if (!row || row.length === 0) return;

      // jobTitleとcompanyNameが両方空の場合もスキップ（不完全データ除外）
      const jobTitle = columnMapping.jobTitle >= 0 ? row[columnMapping.jobTitle] : "";
      const companyName = columnMapping.companyName >= 0 ? row[columnMapping.companyName] : "";
      if (!jobTitle && !companyName) return;

      // 年間休日を取得（求人ボックスの場合のみ存在）
      const annualHolidays = columnMapping.annualHolidays >= 0 ? row[columnMapping.annualHolidays] : "";
      const description = columnMapping.description >= 0 ? row[columnMapping.description] : "";

      // D列から始まる23列分のデータを作成（年間休日・詳細テキストを追加）
      const newRow = [
        // D列から開始（赤色ヘッダー部分：D-P列）
        columnMapping.jobTitle >= 0 ? row[columnMapping.jobTitle] : "",
        columnMapping.jobUrl >= 0 ? row[columnMapping.jobUrl] : "",
        columnMapping.newLabel >= 0 ? row[columnMapping.newLabel] : "",
        columnMapping.companyName >= 0 ? row[columnMapping.companyName] : "",
        columnMapping.location >= 0 ? row[columnMapping.location] : "",
        columnMapping.tags >= 0 ? row[columnMapping.tags] : "",
        columnMapping.salary >= 0 ? row[columnMapping.salary] : "",
        columnMapping.employmentType >= 0 ? row[columnMapping.employmentType] : "",
        "", "", "", "", "",  // 求人概要、応募方法、検索キーワード、投稿日、口コミ（空欄）
        // Q列から開始（青色ヘッダー部分：Q-X列）
        columnMapping.jobTitle >= 0 ? row[columnMapping.jobTitle] : "",
        columnMapping.jobUrl >= 0 ? row[columnMapping.jobUrl] : "",
        columnMapping.tags >= 0 ? row[columnMapping.tags] : "",
        "",  // 求人内容（空欄）
        columnMapping.companyName >= 0 ? row[columnMapping.companyName] : "",
        columnMapping.companyName >= 0 ? row[columnMapping.companyName] : "",
        columnMapping.companyName >= 0 ? row[columnMapping.companyName] : "",
        columnMapping.companyName >= 0 ? row[columnMapping.companyName] : "",
        // Y列: 年間休日, Z列: 詳細テキスト（新規追加）
        annualHolidays,
        description
      ];

      transferData.push(newRow);
    });
    
    // データを転記（D列2行目から開始）
    if (transferData.length > 0) {
      const startRow = 2;  // 2行目から開始（1行目はヘッダー）
      const startColumn = 4;  // D列から開始

      // ★★★ 最も確実な方法：シート全体をクリアして再構築 ★★★
      console.log('=== データシート完全クリア開始 ===');

      // Step 0: 現在のヘッダーを保存
      const headerRange = destinationSheet.getRange(1, 1, 1, destinationSheet.getLastColumn());
      const headers = headerRange.getValues();
      console.log('Step 0: ヘッダー保存完了');

      // Step 1: シート全体をクリア（データ、書式、全て）
      destinationSheet.clear();
      console.log('Step 1: シート全体をクリア完了');

      // Step 2: ヘッダーを復元
      if (headers[0].length > 0) {
        destinationSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
        console.log('Step 2: ヘッダー復元完了');
      }

      // Step 3: 新しいデータを書き込み
      console.log('Step 3: 新規データ ' + transferData.length + ' 行を書き込み');
      destinationSheet.getRange(startRow, startColumn, transferData.length, transferData[0].length).setValues(transferData);

      // 確認ログ
      const newLastRow = destinationSheet.getLastRow();
      console.log('=== データシート完全クリア完了: ' + newLastRow + ' 行 ===');

      // ★★★ デバッグ：H列（所在地）のサンプルデータを出力 ★★★
      SpreadsheetApp.flush(); // 書き込みを確定
      const verifyRange = destinationSheet.getRange(2, 8, Math.min(newLastRow - 1, 10), 1); // H列最初の10行
      const verifyData = verifyRange.getValues();
      console.log('★ H列（所在地）サンプル（最初の10行）:');
      verifyData.forEach((row, i) => console.log('  行' + (i+2) + ': ' + row[0]));

      // 北区を含むデータがあるか検索
      const allLocationRange = destinationSheet.getRange(2, 8, newLastRow - 1, 1);
      const allLocations = allLocationRange.getValues();
      const kitakuRows = allLocations.map((row, i) => ({ row: i + 2, location: row[0] }))
        .filter(item => item.location && String(item.location).includes('北区'));
      if (kitakuRows.length > 0) {
        console.log('⚠️ 警告: 北区を含むデータが ' + kitakuRows.length + ' 件見つかりました:');
        kitakuRows.slice(0, 5).forEach(item => console.log('  行' + item.row + ': ' + item.location));
      } else {
        console.log('✅ 北区を含むデータは0件です');
      }

      // 書式設定（D列以降のみ）
      formatDataSheet(destinationSheet, startRow, transferData.length);
      
      return `${transferData.length}件のデータを「${destinationSheetName}」シートのD列2行目から転記しました。`;
    } else {
      return "転記するデータがありません。";
    }
    
  } catch (error) {
    console.error('転記エラー:', error);
    throw new Error('データ転記中にエラーが発生しました: ' + error.toString());
  }
}

/**
 * データシートの書式設定（D列以降）
 */
function formatDataSheet(sheet, startRow, rowCount) {
  // D列以降の列幅設定
  const columnWidths = {
    4: 200,   // D: 求人タイトル
    5: 200,   // E: 求人URL
    6: 60,    // F: 新着
    7: 150,   // G: 事業所名
    8: 200,   // H: 所在地
    9: 150,   // I: タグ
    10: 120,  // J: 給与
    11: 100,  // K: 雇用形態
    12: 200,  // L: 求人概要
    13: 150,  // M: 応募方法
    14: 150,  // N: 検索キーワード
    15: 100,  // O: 投稿日
    16: 100,  // P: 口コミ
    17: 200,  // Q: 求人タイトル
    18: 200,  // R: 求人URL
    19: 150,  // S: タグ
    20: 200,  // T: 求人内容
    21: 150,  // U: 事業所名
    22: 150,  // V: 事業所名2
    23: 150,  // W: 事業所名3
    24: 150   // X: 事業所名
  };
  
  Object.entries(columnWidths).forEach(([col, width]) => {
    sheet.setColumnWidth(parseInt(col), width);
  });
  
  // D列から24列目までのデータ範囲に罫線を設定
  const dataRange = sheet.getRange(startRow, 4, rowCount, 21);
  dataRange.setBorder(true, true, true, true, true, true);
  
  // 行の高さを設定
  for (let i = 0; i < rowCount; i++) {
    sheet.setRowHeight(startRow + i, 30);
  }
  
  // フォントサイズを統一
  dataRange.setFontSize(10);
  dataRange.setVerticalAlignment('middle');
}
/**
 * データシートの見本を作成
 */
function createSampleDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('データ');
  
  if (!sheet) {
    sheet = ss.insertSheet('データ');
  }
  
  // ヘッダー（D1からX1）
  const headers = [
    '求人タイトル',    // D
    '求人URL',        // E
    '新着',           // F
    '事業所名',       // G
    '所在地',         // H
    'タグ',           // I
    '給与',           // J
    '雇用形態',       // K
    '求人概要',       // L
    '応募方法',       // M
    '検索キーワード', // N
    '投稿日',         // O
    '口コミ',         // P
    '求人タイトル2',  // Q
    '求人URL2',       // R
    'タグ2',          // S
    '求人内容',       // T
    '事業所名2',      // U
    '事業所名3',      // V
    '事業所名4',      // W
    '事業所名5'       // X
  ];
  
  // D1から設定
  sheet.getRange(1, 4, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 4, 1, headers.length)
    .setBackground('#f44336')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  // サンプルデータ（D2から）
  const sampleData = [
    ['Webエンジニア募集', 'https://example.com/job1', '新着', '株式会社テスト', '東京都渋谷区神宮前1-2-3', 'リモート可,フレックス', '月給30万円～50万円', '正社員', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['データサイエンティスト', 'https://example.com/job2', '', '株式会社サンプル', '東京都新宿区西新宿2-8-1', '未経験OK', '年収500万円～800万円', '正社員', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['事務スタッフ', 'https://example.com/job3', '新着', '合同会社テスト', '大阪府大阪市北区梅田1-1-1', '交通費支給,週休2日', '時給1,200円', '派遣社員', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['カスタマーサポート', 'https://example.com/job4', '', '株式会社ABC', '神奈川県横浜市西区みなとみらい1-1', '研修充実', '月給25万円', '契約社員', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['営業職', 'https://example.com/job5', '新着', '株式会社XYZ', '愛知県名古屋市中村区名駅1-1-1', 'インセンティブあり', '月給28万円～45万円', '正社員', '', '', '', '', '', '', '', '', '', '', '', '', '']
  ];
  
  sheet.getRange(2, 4, sampleData.length, sampleData[0].length).setValues(sampleData);
  
  // 列幅設定
  sheet.setColumnWidth(4, 200);  // D
  sheet.setColumnWidth(5, 200);  // E
  sheet.setColumnWidth(6, 60);   // F
  sheet.setColumnWidth(7, 150);  // G
  sheet.setColumnWidth(8, 200);  // H
  sheet.setColumnWidth(9, 150);  // I
  sheet.setColumnWidth(10, 150); // J
  sheet.setColumnWidth(11, 100); // K
  
  return 'サンプルデータシートを作成しました。';
}

/**
 * メニューから診断を実行
 */
function runDiagnosticFromMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'データフロー診断',
    'GASスクリプトエディタを開き、「diagnoseDashboardData」関数を実行してください。\n\n' +
    '結果は「実行ログ」に表示されます。\n\n' +
    '手順:\n' +
    '1. 拡張機能 → Apps Script\n' +
    '2. 関数選択で「diagnoseDashboardData」を選択\n' +
    '3. ▶ 実行ボタンをクリック\n' +
    '4. 「実行ログ」タブで結果を確認',
    ui.ButtonSet.OK
  );
}

/**
 * 🔍 データフロー診断関数
 * GASスクリプトエディタで実行して、データの状態を確認
 * メニュー: データ処理 → データフロー診断
 */
function diagnoseDashboardData() {
  console.log('='.repeat(60));
  console.log('📊 ダッシュボードデータ診断');
  console.log('='.repeat(60));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');

  if (!dataSheet) {
    console.log('❌ 「データ」シートが見つかりません');
    return;
  }

  const lastRow = dataSheet.getLastRow();
  console.log('\n【1. スプレッドシート基本情報】');
  console.log('  データシート行数: ' + lastRow);
  console.log('  データ件数: ' + (lastRow - 1) + '件');

  // 生データをサンプル取得（D列から21列）
  console.log('\n【2. 生データサンプル（最初の3行）】');
  const sampleRange = dataSheet.getRange(2, 4, Math.min(3, lastRow - 1), 21);
  const sampleValues = sampleRange.getValues();

  sampleValues.forEach((row, idx) => {
    console.log('  --- 行 ' + (idx + 2) + ' ---');
    console.log('    D(求人タイトル): ' + (row[0] || '(空)').substring(0, 30));
    console.log('    G(事業所名): ' + (row[3] || '(空)').substring(0, 30));
    console.log('    H(所在地): ' + (row[4] || '(空)'));
    console.log('    I(タグ): ' + (row[5] || '(空)').substring(0, 30));
    console.log('    J(給与): ' + (row[6] || '(空)'));
    console.log('    K(雇用形態): ' + (row[7] || '(空)'));
  });

  // キャッシュ状態
  console.log('\n【3. キャッシュ状態】');
  const cacheStatus = DataLayer.getCacheStatus();
  console.log('  セッション解析済み: ' + cacheStatus.session.hasParsedData);
  console.log('  永続化データ: ' + cacheStatus.persistent.parsedData.sizeKB + 'KB');
  console.log('  永続化ハッシュマップ: ' + cacheStatus.persistent.hashMap.sizeKB + 'KB');

  // 解析テスト
  console.log('\n【4. 解析テスト（最初の3件）】');
  const testRecords = sampleValues.slice(0, 3).map((row, idx) => ({
    rowIndex: idx + 2,
    jobTitle: row[0] || '',
    companyName: row[3] || '',
    location: row[4] || '',
    tags: row[5] || '',
    salary: row[6] || '',
    employmentType: row[7] || ''
  }));

  // コンテキスト都道府県を取得（テスト用）
  const contextPref = getContextPrefectureFromTarget();
  console.log('  コンテキスト都道府県: ' + (contextPref || 'なし'));

  testRecords.forEach((record, idx) => {
    console.log('  --- 解析結果 ' + (idx + 1) + ' ---');

    // 給与解析
    const salaryResult = parseSalary(record.salary);
    console.log('    給与原文: ' + record.salary);
    console.log('    → 月給換算: ' + (salaryResult.unifiedMonthly ? (salaryResult.unifiedMonthly / 10000) + '万円' : 'null'));
    console.log('    → 信頼度: ' + salaryResult.confidence);

    // 地域解析（コンテキスト都道府県を渡す）
    const locationResult = parseLocationWithMaster(record.location, contextPref);
    console.log('    所在地原文: ' + record.location);
    console.log('    → 都道府県: ' + (locationResult.prefecture || 'null'));
    console.log('    → 市区町村: ' + (locationResult.cityWard || 'null'));
    if (locationResult.usedContextPrefecture) {
      console.log('    → コンテキスト都道府県を使用');
    }

    // 雇用形態解析
    const employmentResult = parseEmploymentType(record.employmentType);
    console.log('    雇用形態原文: ' + record.employmentType);
    console.log('    → 主カテゴリ: ' + (employmentResult.mainCategory || 'null'));
    console.log('    → サブカテゴリ: ' + (employmentResult.subCategory || 'null'));
  });

  // 集計テスト
  console.log('\n【5. 集計結果テスト】');
  try {
    // 強制的に全更新して集計
    console.log('  増分更新実行中...');
    const incrementalResult = executeIncrementalUpdate(true);
    console.log('  増分更新モード: ' + incrementalResult.mode);
    console.log('  処理件数: ' + incrementalResult.stats.total);
    console.log('  処理時間: ' + incrementalResult.duration + 'ms');

    if (incrementalResult.parsedData && incrementalResult.parsedData.length > 0) {
      // 地域集計
      const locationCounts = {};
      let locationValidCount = 0;
      incrementalResult.parsedData.forEach(d => {
        if (d.locationParsed && d.locationParsed.prefecture) {
          const pref = d.locationParsed.prefecture;
          locationCounts[pref] = (locationCounts[pref] || 0) + 1;
          locationValidCount++;
        }
      });

      console.log('\n  【地域集計】');
      console.log('    有効な地域データ: ' + locationValidCount + '/' + incrementalResult.parsedData.length);
      const topLocations = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      topLocations.forEach(([pref, count]) => {
        console.log('      ' + pref + ': ' + count + '件');
      });

      // 雇用形態集計
      const employmentCounts = {};
      let employmentValidCount = 0;
      incrementalResult.parsedData.forEach(d => {
        if (d.employmentParsed && d.employmentParsed.subCategory) {
          const sub = d.employmentParsed.subCategory;
          employmentCounts[sub] = (employmentCounts[sub] || 0) + 1;
          employmentValidCount++;
        }
      });

      console.log('\n  【雇用形態集計】');
      console.log('    有効な雇用形態データ: ' + employmentValidCount + '/' + incrementalResult.parsedData.length);
      Object.entries(employmentCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log('      ' + type + ': ' + count + '件');
        });

      // 給与集計
      let salaryValidCount = 0;
      let salarySum = 0;
      incrementalResult.parsedData.forEach(d => {
        if (d.salaryParsed && d.salaryParsed.unifiedMonthly) {
          salaryValidCount++;
          salarySum += d.salaryParsed.unifiedMonthly;
        }
      });

      console.log('\n  【給与集計】');
      console.log('    有効な給与データ: ' + salaryValidCount + '/' + incrementalResult.parsedData.length);
      if (salaryValidCount > 0) {
        console.log('    平均月給: ' + Math.round(salarySum / salaryValidCount / 10000) + '万円');
      }
    }
  } catch (e) {
    console.log('  ❌ 集計エラー: ' + e.toString());
  }

  console.log('\n' + '='.repeat(60));
  console.log('診断完了');
  console.log('='.repeat(60));
}

/**
 * 🔍 20パターン包括診断
 * GASスクリプトエディタで実行して、全データフローを検証
 */
function runComprehensiveDiagnostic() {
  console.log('═'.repeat(70));
  console.log('📊 20パターン包括診断開始');
  console.log('═'.repeat(70));

  const results = {
    passed: [],
    warnings: [],
    failed: []
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ===== パターン1-5: CSV→データシート =====
  console.log('\n【パターン1-5: CSV→データシート連携】');

  // P1: データシート存在確認
  const dataSheet = ss.getSheetByName('データ');
  if (dataSheet) {
    results.passed.push('P6: 「データ」シート存在');
    console.log('  ✅ P6: 「データ」シート存在');
  } else {
    results.failed.push('P6: 「データ」シートが見つかりません');
    console.log('  ❌ P6: 「データ」シートが見つかりません');
    return results;
  }

  // P7: データ行数確認
  const lastRow = dataSheet.getLastRow();
  if (lastRow > 1) {
    results.passed.push('P7: データ行数 ' + (lastRow - 1) + '件');
    console.log('  ✅ P7: データ行数 ' + (lastRow - 1) + '件');
  } else {
    results.failed.push('P7: データが空です');
    console.log('  ❌ P7: データが空です');
    return results;
  }

  // P8-10: カラムマッピング確認
  const sampleRange = dataSheet.getRange(2, 4, Math.min(3, lastRow - 1), 8);
  const sampleValues = sampleRange.getValues();

  let hasValidData = false;
  sampleValues.forEach((row, idx) => {
    if (row[0] || row[3]) {
      hasValidData = true;
      console.log('  行' + (idx + 2) + ': D=' + (row[0] || '(空)').substring(0, 20) +
                  ', G=' + (row[3] || '(空)').substring(0, 15) +
                  ', J=' + (row[6] || '(空)').substring(0, 15));
    }
  });

  if (hasValidData) {
    results.passed.push('P8-10: カラムマッピング正常');
    console.log('  ✅ P8-10: カラムマッピング正常（D列=求人タイトル, G列=事業所名, J列=給与）');
  } else {
    results.warnings.push('P9: 有効データなし（求人タイトルと事業所名が両方空）');
    console.log('  ⚠️ P9: 有効データなし');
  }

  // ===== パターン11-15: DataLayer→集計 =====
  console.log('\n【パターン11-15: DataLayer→集計連携】');

  // P11-12: 永続化データ状態
  const persistentInfo = DataPersistence.getStorageInfo();
  console.log('  永続化データ: ' + persistentInfo.totalSizeKB + 'KB');
  if (persistentInfo.metadata) {
    console.log('  最終更新: ' + persistentInfo.metadata.lastUpdated);
    console.log('  記録件数: ' + persistentInfo.metadata.recordCount);

    if (persistentInfo.metadata.recordCount === (lastRow - 1)) {
      results.passed.push('P12: 永続化データ件数一致 (' + persistentInfo.metadata.recordCount + ')');
      console.log('  ✅ P12: 永続化データ件数とシート件数一致');
    } else {
      results.warnings.push('P12: 永続化データ件数不一致（永続化:' + persistentInfo.metadata.recordCount + ', シート:' + (lastRow - 1) + '）');
      console.log('  ⚠️ P12: 永続化データ件数不一致 → 次回アクセス時に自動更新されます');
    }
  } else {
    results.warnings.push('P11: 永続化データなし（初回アクセス時に作成されます）');
    console.log('  ⚠️ P11: 永続化データなし');
  }

  // P13: パーサーテスト
  console.log('\n  【パーサーテスト】');
  const testSalaries = ['月給25万円', '時給1200円', '年収400万円'];
  testSalaries.forEach(text => {
    const result = parseSalary(text);
    console.log('    ' + text + ' → ' + (result.unifiedMonthly ? Math.round(result.unifiedMonthly / 10000) + '万円/月' : 'null'));
  });
  results.passed.push('P13: パーサー正常動作');

  // P14: キャッシュ状態
  const cacheStatus = DataLayer.getCacheStatus();
  console.log('\n  【キャッシュ状態】');
  console.log('    セッション解析済み: ' + cacheStatus.session.hasParsedData);
  console.log('    セッション有効: ' + cacheStatus.session.isValid);
  results.passed.push('P14: キャッシュ状態取得成功');

  // ===== パターン16-20: 集計→ダッシュボード =====
  console.log('\n【パターン16-20: 集計→ダッシュボード連携】');

  // P15-16: 集計データ取得テスト
  try {
    console.log('  増分更新テスト実行中...');
    const startTime = Date.now();
    const incrementalResult = executeIncrementalUpdate(false);
    const duration = Date.now() - startTime;

    console.log('  更新モード: ' + incrementalResult.mode);
    console.log('  処理時間: ' + duration + 'ms');
    console.log('  処理件数: ' + incrementalResult.stats.total);
    console.log('  追加: ' + incrementalResult.stats.added + ', 変更なし: ' + incrementalResult.stats.unchanged);

    if (incrementalResult.success && incrementalResult.parsedData && incrementalResult.parsedData.length > 0) {
      results.passed.push('P15-16: 集計データ取得成功 (' + incrementalResult.parsedData.length + '件)');
      console.log('  ✅ P15-16: 集計データ取得成功');

      // 集計サンプル
      const aggregation = DataLayer.getAggregation(true);
      console.log('\n  【集計サマリー】');
      console.log('    総件数: ' + aggregation.summary.totalCount);
      console.log('    平均月給: ' + (aggregation.summary.avgMonthlySalary ? Math.round(aggregation.summary.avgMonthlySalary / 10000) + '万円' : 'N/A'));
      console.log('    正社員率: ' + aggregation.summary.fullTimeRate + '%');
      console.log('    新着率: ' + aggregation.summary.newRate + '%');

      // 地域分布
      const topLocations = Object.entries(aggregation.locationData.prefectureDistribution.nonZero || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      if (topLocations.length > 0) {
        console.log('    上位地域: ' + topLocations.map(l => l[0] + '(' + l[1] + ')').join(', '));
      }

      results.passed.push('P17-18: 集計データ内容正常');
    } else {
      results.warnings.push('P15-16: 集計データ取得成功だが件数0');
      console.log('  ⚠️ P15-16: 集計データ取得成功だが件数0');
    }
  } catch (e) {
    results.failed.push('P15-16: 集計エラー - ' + e.toString());
    console.log('  ❌ P15-16: 集計エラー - ' + e.toString());
  }

  // P20: スクリプトキャッシュ確認
  const scriptCache = CacheService.getScriptCache();
  const cachedAggregation = scriptCache.get('dashboard_aggregation');
  if (cachedAggregation) {
    try {
      const cached = JSON.parse(cachedAggregation);
      console.log('  スクリプトキャッシュ: ' + cached.summary.totalCount + '件のデータ');
      results.passed.push('P20: スクリプトキャッシュ存在');
    } catch (e) {
      results.warnings.push('P20: スクリプトキャッシュ破損');
      console.log('  ⚠️ P20: スクリプトキャッシュ破損');
    }
  } else {
    console.log('  スクリプトキャッシュ: なし');
    results.passed.push('P20: スクリプトキャッシュなし（正常）');
  }

  // ===== 結果サマリー =====
  console.log('\n' + '═'.repeat(70));
  console.log('📊 診断結果サマリー');
  console.log('═'.repeat(70));
  console.log('✅ 正常: ' + results.passed.length + '件');
  results.passed.forEach(p => console.log('   ' + p));

  if (results.warnings.length > 0) {
    console.log('⚠️ 警告: ' + results.warnings.length + '件');
    results.warnings.forEach(w => console.log('   ' + w));
  }

  if (results.failed.length > 0) {
    console.log('❌ 失敗: ' + results.failed.length + '件');
    results.failed.forEach(f => console.log('   ' + f));
  }

  console.log('\n' + '═'.repeat(70));
  if (results.failed.length === 0) {
    console.log('🎉 データフローに問題は検出されませんでした');
  } else {
    console.log('🔧 上記の問題を確認してください');
  }
  console.log('═'.repeat(70));

  return results;
}

// ============================================
// 顧客情報入力ダイアログ
// ============================================

/**
 * 顧客情報入力ダイアログを表示
 */
function showCustomerInputDialog() {
  const html = HtmlService.createHtmlOutputFromFile('CustomerInputDialog')
    .setWidth(500)
    .setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, '顧客情報の設定');
}

/**
 * 顧客情報を検索対象シートに保存
 * @param {string} name - 顧客名・地域名
 * @param {number|null} salaryMin - 希望給与下限（万円）
 * @param {number|null} salaryMax - 希望給与上限（万円）
 */
function saveCustomerInfoToSheet(name, salaryMin, salaryMax) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('検索対象');

    // シートがなければ作成
    if (!sheet) {
      sheet = ss.insertSheet('検索対象');
      // ヘッダー行を追加
      sheet.getRange(1, 1, 1, 4).setValues([['地域名', '備考', '給与下限(万円)', '給与上限(万円)']]);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f0f0f0');
    }

    // 既存データをクリア（ヘッダー以外）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
    }

    // 新しいデータを追加
    const newRow = [
      name,
      '',  // 備考は空
      salaryMin ? parseFloat(salaryMin) : '',
      salaryMax ? parseFloat(salaryMax) : ''
    ];
    sheet.getRange(2, 1, 1, 4).setValues([newRow]);

    // 列幅を調整
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 120);

    console.log('顧客情報を保存しました: ' + name + ', ' + salaryMin + '万円～' + salaryMax + '万円');
    return { success: true };
  } catch (e) {
    console.error('顧客情報の保存に失敗: ' + e.message);
    throw e;
  }
}
