/**
 * HTMLテンプレートのinclude関数
 * <?!= include("ファイル名") ?> で使用
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

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
 */
function showFileUploadDialog() {
  const html = HtmlService.createHtmlOutputFromFile('FileUpload')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi()
    .showModalDialog(html, 'CSVファイルのインポート');
}

/**
 * CSVファイルを処理してインポート＆クレンジング＆転記
 */
function processCSVFile(fileContent, fileName) {
  try {
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
    
    // データ転記処理を実行
    const transferResult = transferDataToDestination();
    
    // 一時シートを削除
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tempSheet = ss.getSheetByName(tempSheetName);
    if (tempSheet) {
      ss.deleteSheet(tempSheet);
    }
    
    // 「済み」シートも削除
    const doneSheet = ss.getSheetByName("済み");
    if (doneSheet) {
      ss.deleteSheet(doneSheet);
    }

    // Phase 4: データ更新後に増分更新をトリガー
    try {
      console.log('CSVインポート後: 増分更新を実行');
      DataLayer.clearAllCache(false);  // セッション・スクリプトキャッシュのみクリア
      const incrementalResult = DataLayer.forceIncrementalUpdate(false);
      console.log('増分更新結果:', JSON.stringify(incrementalResult.stats));
    } catch (e) {
      console.warn('増分更新に失敗（通常動作は継続）:', e);
    }

    return {
      success: true,
      message: `CSVファイルの処理が完了しました。\n${cleanResult}\n${transferResult}\n一時シートと「済み」シートを削除しました。`
    };
  } catch (error) {
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
 * 指定シートからデータをクレンジング
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
  
  // ▼▼▼ 変更箇所 ▼▼▼
  // ヘッダー行からカラムのインデックスを取得
  const headers = data[0];

  // 存在するカラムを優先順位で選択するヘルパー
  function findFirstValidIndex(...columnNames) {
    for (const name of columnNames) {
      const idx = headers.indexOf(name);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const columnIndexes = {
    jobTitle: headers.indexOf("jcs-JobTitle"),
    jobUrl: headers.indexOf("jcs-JobTitle href"),
    newLabel: headers.indexOf("label"),
    // 優先順位: 最初に見つかったカラムを使用
    companyName: findFirstValidIndex("css-19eicqx", "css-1ssrdda", "css-1h7lukg"),
    location: findFirstValidIndex("css-1f06pz4", "css-n5nzmv", "css-1restlb"),
    salary: findFirstValidIndex("mosaic-provider-jobcards-1f1q1js", "css-5ooe72"),
    employmentTypeColumn: findFirstValidIndex("mosaic-provider-jobcards-1f1q1js (2)", "css-18z4q2i (2)")
  };

  console.log('カラムマッピング:', JSON.stringify(columnIndexes));
  // ▲▲▲ 変更箇所 ▲▲▲
  
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
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || !row[0]) continue;
    
    const newRow = [];
    
    // 各カラムのデータを抽出
    newRow.push(columnIndexes.jobTitle >= 0 ? (row[columnIndexes.jobTitle] || "") : "");
    newRow.push(columnIndexes.jobUrl >= 0 ? (row[columnIndexes.jobUrl] || "") : "");
    newRow.push(columnIndexes.newLabel >= 0 ? (row[columnIndexes.newLabel] || "") : "");
    newRow.push(columnIndexes.companyName >= 0 ? (row[columnIndexes.companyName] || "") : "");
    newRow.push(columnIndexes.location >= 0 ? (row[columnIndexes.location] || "") : "");
    
    // タグを統合
    let combinedTags = "";
    for (const colIndex of tagColumnIndexes) {
      if (colIndex < row.length && row[colIndex]) {
        if (combinedTags) combinedTags += ",";
        combinedTags += row[colIndex];
      }
    }
    newRow.push(combinedTags);
    
    // 給与データをクレンジング
    let salaryData = columnIndexes.salary >= 0 ? String(row[columnIndexes.salary] || "") : "";
    if (salaryData) {
      salaryData = salaryData.replace(/(\d+)\s+([万円])/g, '$1$2');
      salaryData = salaryData.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
      salaryData = salaryData.replace(/〜/g, '～');
      if (!salaryData.includes('円') && salaryData.includes('万')) {
        salaryData = salaryData.replace(/([0-9万,]+)(?!円)(\s*[～~〜]\s*|$)/g, '$1円$2');
      }
    }
    newRow.push(salaryData);
    
    // 雇用形態を抽出
    let employmentType = "";
    const checkValue = columnIndexes.employmentTypeColumn >= 0 ? String(row[columnIndexes.employmentTypeColumn] || "") : "";
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
  
  return `${processedRows}行を処理し、「済み」シートに出力しました。`;
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
    
    // カラムインデックスのマッピング
    const columnMapping = {
      jobTitle: sourceHeaders.indexOf("求人タイトル"),
      jobUrl: sourceHeaders.indexOf("求人URL"),
      newLabel: sourceHeaders.indexOf("新着"),
      companyName: sourceHeaders.indexOf("事業所名"),
      location: sourceHeaders.indexOf("所在地"),
      tags: sourceHeaders.indexOf("タグ"),
      salary: sourceHeaders.indexOf("給与"),
      employmentType: sourceHeaders.indexOf("雇用形態")
    };
    
    // 転記用データの準備（D列から開始）
    const transferData = [];
    
    dataRows.forEach(row => {
      // 空行はスキップ
      if (!row || row.length === 0) return;
      
      // D列から始まる21列分のデータを作成
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
        columnMapping.companyName >= 0 ? row[columnMapping.companyName] : ""
      ];
      
      transferData.push(newRow);
    });
    
    // データを転記（D列2行目から開始）
    if (transferData.length > 0) {
      const startRow = 2;  // 2行目から開始（1行目はヘッダー）
      const startColumn = 4;  // D列から開始
      
      // D列から21列分のデータを書き込み（既存のデータを上書き）
      destinationSheet.getRange(startRow, startColumn, transferData.length, transferData[0].length).setValues(transferData);
      
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
