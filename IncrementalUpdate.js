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
 * @param {boolean} skipParsedDataSave - trueの場合、inc_parsed_dataを保存しない（クォータ節約）
 * @returns {Object} 更新結果
 */
function executeIncrementalUpdate(forceFullRefresh, skipParsedDataSave) {
  const startTime = Date.now();
  console.log('IncrementalUpdate: 増分更新開始' + (forceFullRefresh ? '（強制全更新）' : '') + (skipParsedDataSave ? '（軽量モード）' : ''));

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
    // 23列 = D-Z（Y列: 年間休日, Z列: 詳細テキスト）
    const range = dataSheet.getRange(2, 4, lastRow - 1, 23);
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
        employmentType: row[7] || '',
        // 新規カラム（求人ボックス対応）
        annualHolidays: row[21] || '',  // Y列: 年間休日
        description: row[22] || ''       // Z列: 詳細テキスト
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
      result = performFullParse(currentRecords, startTime, skipParsedDataSave);
    } else {
      // 増分更新
      result = performIncrementalParse(currentRecords, previousHashMap, previousParsedData, startTime, skipParsedDataSave);
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
 * @param {Array} currentRecords - 現在のレコード配列
 * @param {number} startTime - 開始時刻
 * @param {boolean} skipParsedDataSave - trueの場合、inc_parsed_dataを保存しない
 */
function performFullParse(currentRecords, startTime, skipParsedDataSave) {
  console.log('IncrementalUpdate: 全件解析モード' + (skipParsedDataSave ? '（軽量保存）' : ''));

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

  // 永続化（軽量モードでは inc_parsed_data をスキップ）
  // ★保存失敗しても処理を続行（ストレージ上限対策）
  try {
    if (!skipParsedDataSave) {
      DataPersistence.saveParsedData(parsedData);
    } else {
      console.log('IncrementalUpdate: inc_parsed_data保存スキップ（軽量モード）');
    }
    DataPersistence.saveHashMap(hashMap);
    // 給与表示タイプを取得（ScriptPropertiesに保存済み）
    const salaryDisplayType = PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
    DataPersistence.saveMetadata({
      lastUpdated: new Date().toISOString(),
      recordCount: parsedData.length,
      mode: skipParsedDataSave ? 'full-lightweight' : 'full',
      salaryDisplayType: salaryDisplayType
    });
  } catch (saveError) {
    console.warn('IncrementalUpdate: 永続化スキップ（ストレージ上限）: ' + saveError.message);
  }
  const duration = Date.now() - startTime;
  console.log('IncrementalUpdate: 全件解析完了 (' + duration + 'ms)');

  return {
    success: true,
    mode: skipParsedDataSave ? 'full-lightweight' : 'full',
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
 * @param {Array} currentRecords - 現在のレコード配列
 * @param {Object} previousHashMap - 前回のハッシュマップ
 * @param {Array} previousParsedData - 前回の解析済みデータ
 * @param {number} startTime - 開始時刻
 * @param {boolean} skipParsedDataSave - trueの場合、inc_parsed_dataを保存しない
 */
function performIncrementalParse(currentRecords, previousHashMap, previousParsedData, startTime, skipParsedDataSave) {
  console.log('IncrementalUpdate: 増分解析モード' + (skipParsedDataSave ? '（軽量保存）' : ''));

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


  // 永続化（軽量モードでは inc_parsed_data をスキップ）
  // ★保存失敗しても処理を続行（ストレージ上限対策）
  try {
    if (!skipParsedDataSave) {
      DataPersistence.saveParsedData(newParsedData);
    } else {
      console.log('IncrementalUpdate: inc_parsed_data保存スキップ（軽量モード）');
    }
    DataPersistence.saveHashMap(newHashMap);
    // 給与表示タイプを取得（既存の設定を維持）
    const salaryDisplayType2 = PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
    DataPersistence.saveMetadata({
      lastUpdated: new Date().toISOString(),
      recordCount: newParsedData.length,
      mode: skipParsedDataSave ? 'incremental-lightweight' : 'incremental',
      added: changes.added.length,
      deleted: changes.deleted.length,
      salaryDisplayType: salaryDisplayType2
    });
  } catch (saveError) {
    console.warn('IncrementalUpdate: 永続化スキップ（ストレージ上限）: ' + saveError.message);
  }

  const duration = Date.now() - startTime;
  console.log('IncrementalUpdate: 増分解析完了 (' + duration + 'ms)');

  return {
    success: true,
    mode: skipParsedDataSave ? 'incremental-lightweight' : 'incremental',
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
