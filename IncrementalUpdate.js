/**
 * IncrementalUpdate.js - 増分更新モジュール
 * データ変更検知とパース済みデータの永続化
 * Phase 4: 増分更新最適化
 */

/**
 * MD5ハッシュを計算
 * @param {string} text - ハッシュ対象テキスト
 * @returns {string} MD5ハッシュ値（16進数）
 */
function computeMD5(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
  return digest.map(b => {
    const hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * レコードのハッシュを計算
 * 主要フィールドを連結してハッシュ化
 * @param {Object} record - 生データレコード
 * @returns {string} レコードハッシュ
 */
function computeRecordHash(record) {
  const key = [
    record.jobTitle || '',
    record.companyName || '',
    record.location || '',
    record.salary || '',
    record.employmentType || '',
    record.tags || ''
  ].join('|');
  return computeMD5(key);
}

/**
 * 全データのハッシュマップを作成
 * @param {Array} records - 生データレコード配列
 * @returns {Object} ハッシュ→rowIndexのマップ
 */
function createHashMap(records) {
  const hashMap = {};
  records.forEach((record, index) => {
    const hash = computeRecordHash(record);
    hashMap[hash] = {
      rowIndex: record.rowIndex || index + 2,
      index: index
    };
  });
  return hashMap;
}

/**
 * 変更を検出
 * @param {Array} currentRecords - 現在の生データレコード
 * @param {Object} previousHashMap - 前回のハッシュマップ
 * @returns {Object} 変更情報 {added, unchanged, deleted}
 */
function detectChanges(currentRecords, previousHashMap) {
  const changes = {
    added: [],      // 新規レコード
    unchanged: [],  // 変更なしレコード（インデックスのみ）
    deleted: []     // 削除されたハッシュ
  };

  const currentHashMap = {};

  // 現在のレコードをチェック
  currentRecords.forEach((record, index) => {
    const hash = computeRecordHash(record);
    currentHashMap[hash] = true;

    if (previousHashMap && previousHashMap[hash]) {
      // 既存レコード（変更なし）- インデックスのみ記録
      changes.unchanged.push({
        hash: hash,
        currentIndex: index,
        previousIndex: previousHashMap[hash].index
      });
    } else {
      // 新規レコード
      changes.added.push({
        record: record,
        index: index,
        hash: hash
      });
    }
  });

  // 削除されたレコードをチェック
  if (previousHashMap) {
    Object.keys(previousHashMap).forEach(hash => {
      if (!currentHashMap[hash]) {
        changes.deleted.push({
          hash: hash,
          previousIndex: previousHashMap[hash].index
        });
      }
    });
  }

  return changes;
}

/**
 * 増分更新を実行
 * @param {boolean} forceFullRefresh - 強制全更新フラグ
 * @returns {Object} 更新結果
 */
function executeIncrementalUpdate(forceFullRefresh) {
  const startTime = Date.now();
  console.log('IncrementalUpdate: 増分更新開始' + (forceFullRefresh ? '（強制全更新）' : ''));

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('データ');

    if (!dataSheet) {
      throw new Error('「データ」シートが見つかりません');
    }

    const lastRow = dataSheet.getLastRow();
    if (lastRow <= 1) {
      DataPersistence.clearAll();
      return {
        success: true,
        mode: 'empty',
        stats: { total: 0, added: 0, unchanged: 0, deleted: 0 },
        duration: Date.now() - startTime
      };
    }

    const currentRowCount = lastRow - 1;

    // Phase 4.1: クイックチェック - レコード数が同じなら永続化データを直接返す
    if (!forceFullRefresh) {
      const metadata = DataPersistence.loadMetadata();
      const previousParsedData = DataPersistence.loadParsedData();

      if (metadata && previousParsedData &&
          metadata.recordCount === currentRowCount &&
          metadata.recordCount === previousParsedData.length) {
        console.log('IncrementalUpdate: クイックチェックパス - 永続化データを使用 (' + (Date.now() - startTime) + 'ms)');
        return {
          success: true,
          mode: 'quickcache',
          stats: {
            total: previousParsedData.length,
            added: 0,
            unchanged: previousParsedData.length,
            deleted: 0
          },
          duration: Date.now() - startTime,
          parsedData: previousParsedData
        };
      }
    }

    // レコード数が変わった場合のみスプレッドシートを読み込む
    console.log('IncrementalUpdate: スプレッドシート読み込み開始');
    const range = dataSheet.getRange(2, 4, lastRow - 1, 21);
    const values = range.getValues();
    const currentRecords = [];

    let skippedCount = 0;
    let skippedRows = [];
    values.forEach((row, index) => {
      if (!row[0] && !row[3]) {
        skippedCount++;
        if (skippedRows.length < 5) {
          skippedRows.push(index + 2); // 最初の5件の行番号を記録
        }
        return;
      }
      currentRecords.push({
        rowIndex: index + 2,
        jobTitle: row[0] || '',
        jobUrl: row[1] || '',
        isNew: row[2] || '',
        companyName: row[3] || '',
        location: row[4] || '',
        tags: row[5] || '',
        salary: row[6] || '',
        employmentType: row[7] || ''
      });
    });

    console.log('IncrementalUpdate: 現在のレコード数: ' + currentRecords.length);
    if (skippedCount > 0) {
      console.log('IncrementalUpdate: スキップされた行数: ' + skippedCount);
      console.log('IncrementalUpdate: スキップされた行（最初の5件）: ' + skippedRows.join(', '));
    }

    // 前回のハッシュマップと解析済みデータを読み込み
    const previousHashMap = forceFullRefresh ? null : DataPersistence.loadHashMap();
    const previousParsedData = forceFullRefresh ? null : DataPersistence.loadParsedData();

    let result;

    if (!previousHashMap || !previousParsedData) {
      // 初回または強制更新 - 全件解析
      result = performFullParse(currentRecords, startTime);
    } else {
      // 増分更新
      result = performIncrementalParse(currentRecords, previousHashMap, previousParsedData, startTime);
    }

    return result;

  } catch (error) {
    console.error('IncrementalUpdate error:', error);
    return {
      success: false,
      error: error.toString(),
      duration: Date.now() - startTime
    };
  }
}

/**
 * 全件解析を実行
 */
function performFullParse(currentRecords, startTime) {
  console.log('IncrementalUpdate: 全件解析モード');

  // コンテキスト都道府県を取得（検索対象シートから推測）
  const contextPref = getContextPrefectureFromTarget();
  if (contextPref) {
    console.log('IncrementalUpdate: コンテキスト都道府県 = ' + contextPref);
  }

  // 全レコードを解析
  const parsedData = currentRecords.map(record => {
    const salaryParsed = parseSalary(record.salary);
    const locationParsed = parseLocationWithMaster(record.location, contextPref);
    const employmentParsed = parseEmploymentType(record.employmentType);
    const tagsParsed = parseTags(record.tags);

    return {
      ...record,
      salaryParsed,
      locationParsed,
      employmentParsed,
      tagsParsed
    };
  });

  // ハッシュマップを作成
  const hashMap = createHashMap(currentRecords);

  // 永続化
  DataPersistence.saveParsedData(parsedData);
  DataPersistence.saveHashMap(hashMap);
  DataPersistence.saveMetadata({
    lastUpdated: new Date().toISOString(),
    recordCount: parsedData.length,
    mode: 'full'
  });

  const duration = Date.now() - startTime;
  console.log('IncrementalUpdate: 全件解析完了 (' + duration + 'ms)');

  return {
    success: true,
    mode: 'full',
    stats: {
      total: parsedData.length,
      added: parsedData.length,
      unchanged: 0,
      deleted: 0
    },
    duration: duration,
    parsedData: parsedData
  };
}

/**
 * 増分解析を実行
 */
function performIncrementalParse(currentRecords, previousHashMap, previousParsedData, startTime) {
  console.log('IncrementalUpdate: 増分解析モード');

  // コンテキスト都道府県を取得（検索対象シートから推測）
  const contextPref = getContextPrefectureFromTarget();
  if (contextPref) {
    console.log('IncrementalUpdate: コンテキスト都道府県 = ' + contextPref);
  }

  // 変更を検出
  const changes = detectChanges(currentRecords, previousHashMap);

  console.log('IncrementalUpdate: 変更検出 - 新規:' + changes.added.length +
    ', 変更なし:' + changes.unchanged.length +
    ', 削除:' + changes.deleted.length);

  // 変更がない場合は前回のデータをそのまま返す
  if (changes.added.length === 0 && changes.deleted.length === 0) {
    console.log('IncrementalUpdate: 変更なし - キャッシュを使用');
    return {
      success: true,
      mode: 'cached',
      stats: {
        total: previousParsedData.length,
        added: 0,
        unchanged: previousParsedData.length,
        deleted: 0
      },
      duration: Date.now() - startTime,
      parsedData: previousParsedData
    };
  }

  // 前回の解析済みデータをハッシュでインデックス化
  const previousParsedByHash = {};
  previousParsedData.forEach((data, index) => {
    const hash = computeRecordHash(data);
    previousParsedByHash[hash] = data;
  });

  // 新しい解析済みデータ配列を構築
  const newParsedData = [];

  // 変更なしレコードは前回の解析結果を再利用
  changes.unchanged.forEach(item => {
    const previousData = previousParsedByHash[item.hash];
    if (previousData) {
      // rowIndexを更新（位置が変わっている可能性）
      const currentRecord = currentRecords[item.currentIndex];
      newParsedData.push({
        ...previousData,
        rowIndex: currentRecord.rowIndex
      });
    }
  });

  // 新規レコードは解析
  changes.added.forEach(item => {
    const record = item.record;
    const salaryParsed = parseSalary(record.salary);
    const locationParsed = parseLocationWithMaster(record.location, contextPref);
    const employmentParsed = parseEmploymentType(record.employmentType);
    const tagsParsed = parseTags(record.tags);

    newParsedData.push({
      ...record,
      salaryParsed,
      locationParsed,
      employmentParsed,
      tagsParsed
    });
  });

  // rowIndexでソート
  newParsedData.sort((a, b) => a.rowIndex - b.rowIndex);

  // 新しいハッシュマップを作成
  const newHashMap = createHashMap(currentRecords);

  // 永続化
  DataPersistence.saveParsedData(newParsedData);
  DataPersistence.saveHashMap(newHashMap);
  DataPersistence.saveMetadata({
    lastUpdated: new Date().toISOString(),
    recordCount: newParsedData.length,
    mode: 'incremental',
    added: changes.added.length,
    deleted: changes.deleted.length
  });

  const duration = Date.now() - startTime;
  console.log('IncrementalUpdate: 増分解析完了 (' + duration + 'ms)');

  return {
    success: true,
    mode: 'incremental',
    stats: {
      total: newParsedData.length,
      added: changes.added.length,
      unchanged: changes.unchanged.length,
      deleted: changes.deleted.length
    },
    duration: duration,
    parsedData: newParsedData
  };
}

/**
 * テスト関数
 */
function testIncrementalUpdate() {
  console.log('=== 増分更新テスト ===');

  // 初回実行（全件解析）
  console.log('\n1. 初回実行:');
  const result1 = executeIncrementalUpdate(true);
  console.log('結果:', JSON.stringify(result1.stats));

  // 2回目実行（増分）
  console.log('\n2. 2回目実行:');
  const result2 = executeIncrementalUpdate(false);
  console.log('結果:', JSON.stringify(result2.stats));

  // メタデータ確認
  console.log('\n3. メタデータ:');
  console.log(JSON.stringify(DataPersistence.loadMetadata()));

  // ストレージ情報
  console.log('\n4. ストレージ情報:');
  console.log(JSON.stringify(DataPersistence.getStorageInfo()));
}

/**
 * シートデータを直接確認（デバッグ用）
 */
function debugSheetData() {
  console.log('═'.repeat(60));
  console.log('🔍 シートデータ診断');
  console.log('═'.repeat(60));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');

  if (!dataSheet) {
    console.log('❌ 「データ」シートが見つかりません');
    return;
  }

  const lastRow = dataSheet.getLastRow();
  const lastCol = dataSheet.getLastColumn();

  console.log('シート情報:');
  console.log('  最終行: ' + lastRow);
  console.log('  最終列: ' + lastCol);
  console.log('  データ行数: ' + (lastRow - 1));

  // ヘッダー行を確認
  const headers = dataSheet.getRange(1, 1, 1, Math.min(lastCol, 15)).getValues()[0];
  console.log('\nヘッダー（最初の15列）:');
  headers.forEach((h, i) => {
    console.log('  ' + (i + 1) + '列目: ' + h);
  });

  // D列（4列目）以降のデータを確認
  console.log('\nD列以降のデータ確認:');
  const range = dataSheet.getRange(2, 4, lastRow - 1, 8); // D列から8列分
  const values = range.getValues();

  let validCount = 0;
  let emptyCount = 0;
  let partialCount = 0;
  const emptyRows = [];

  values.forEach((row, index) => {
    const jobTitle = row[0];
    const companyName = row[3];

    if (!jobTitle && !companyName) {
      emptyCount++;
      if (emptyRows.length < 10) {
        emptyRows.push(index + 2);
      }
    } else if (!jobTitle || !companyName) {
      partialCount++;
    } else {
      validCount++;
    }
  });

  console.log('\nデータ分類:');
  console.log('  ✅ 有効行（jobTitle & companyName両方あり）: ' + validCount);
  console.log('  ⚠️ 部分的（片方のみ）: ' + partialCount);
  console.log('  ❌ 空行（両方なし）: ' + emptyCount);
  console.log('  合計: ' + (validCount + partialCount + emptyCount));

  if (emptyRows.length > 0) {
    console.log('\n空行の行番号（最初の10件）: ' + emptyRows.join(', '));
  }

  // 最後の5行を確認
  console.log('\n最後の5行のデータ:');
  for (let i = Math.max(0, values.length - 5); i < values.length; i++) {
    const row = values[i];
    console.log('  行' + (i + 2) + ': jobTitle="' + (row[0] || '').substring(0, 20) + '...", companyName="' + (row[3] || '') + '"');
  }

  console.log('\n' + '═'.repeat(60));
}
