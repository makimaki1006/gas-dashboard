/**
 * ApiHandler.js - ダッシュボード用APIハンドラ
 * HTMLからgoogle.script.runで呼び出される関数群
 */

/**
 * 最終CSVインポート時刻を取得（クライアント側で強制リフレッシュ判定に使用）
 * @returns {Object} 最終インポート時刻
 */
function getLastImportTimestamp() {
  const timestamp = PropertiesService.getScriptProperties().getProperty('lastImportTimestamp');
  return {
    success: true,
    timestamp: timestamp ? parseInt(timestamp, 10) : 0
  };
}

/**
 * ダッシュボード用の全データを取得
 * @returns {Object} ダッシュボードに必要な全集計データ
 */
function getDashboardData() {
  console.log('=== getDashboardData 開始 ===');
  const startTime = Date.now();

  try {
    // データソース診断ログ
    let metadata = null;
    try {
      metadata = DataPersistence.loadMetadata();
      console.log('DataPersistence状態: ' + (metadata ? 'recordCount=' + metadata.recordCount + ', lastUpdated=' + metadata.lastUpdated : 'なし'));
    } catch (metaError) {
      console.warn('メタデータ読み込みエラー:', metaError);
    }

    // セッション内で最新データを確保
    console.log('getAggregatedDataWithCache 呼び出し...');
    let aggregation = null;

    try {
      aggregation = getAggregatedDataWithCache();
    } catch (cacheError) {
      console.error('getAggregatedDataWithCache エラー:', cacheError);
    }

    // aggregationがnullの場合は強制再取得
    if (!aggregation || !aggregation.summary) {
      console.log('aggregationがnullまたは不完全 - 強制再取得');
      try {
        aggregation = DataLayer.getAggregation(true);
      } catch (dlError) {
        console.error('DataLayer.getAggregation エラー:', dlError);
      }
    }
    console.log('getAggregatedDataWithCache 完了: ' + (Date.now() - startTime) + 'ms');

    // それでもnullの場合は空の集計を使用
    if (!aggregation || !aggregation.summary) {
      console.warn('有効なデータなし - 空の集計を使用');
      aggregation = createEmptyAggregation();
    }

    // 自社給与データを追加（エラーがあってもスキップ）
    try {
      const targetSalary = getTargetSalaryForDashboard();
      aggregation.targetSalary = targetSalary;
      console.log('自社給与: min=' + (targetSalary.min || '-') + ', max=' + (targetSalary.max || '-'));
    } catch (salaryError) {
      console.warn('自社給与取得エラー:', salaryError);
      aggregation.targetSalary = { min: null, max: null, targets: [], combined: { min: null, max: null } };
    }

    console.log('データサイズ確認: totalCount=' + (aggregation.summary ? aggregation.summary.totalCount : 'N/A'));

    // 都道府県トップ3をログ（エラーがあってもスキップ）
    try {
      if (aggregation.locationData && aggregation.locationData.prefectures) {
        const top3 = aggregation.locationData.prefectures.slice(0, 3).map(p => p.prefecture + ':' + p.count).join(', ');
        console.log('都道府県トップ3: ' + top3);
      }
    } catch (locError) {
      console.warn('都道府県ログエラー:', locError);
    }

    // データサイズをログ（エラーがあってもスキップ）
    try {
      const jsonSize = JSON.stringify(aggregation).length;
      console.log('JSONサイズ: ' + Math.round(jsonSize / 1024) + 'KB');
      if (jsonSize > 500000) {
        console.warn('警告: データサイズが大きい（500KB超）。転送に時間がかかる可能性');
      }
    } catch (jsonError) {
      console.warn('JSONサイズ計算エラー:', jsonError);
    }

    console.log('=== getDashboardData 完了: ' + (Date.now() - startTime) + 'ms ===');
    return {
      success: true,
      data: aggregation
    };
  } catch (error) {
    console.error('getDashboardData エラー:', error);
    console.error('スタック:', error.stack);
    // 最終フォールバック: 空の集計データを返す
    return {
      success: true,
      data: createEmptyAggregation(),
      warning: 'エラーが発生したため空のデータを返しました: ' + error.toString()
    };
  }
}

/**
 * 検索対象シートから全ての自社給与データを取得（ダッシュボード用）
 * GeoData.jsのgetTargetLocations()と同じ設計思想で全件を返す
 * @returns {Object} {
 *   targets: [{ name, min, max }...],  // 全ターゲットの給与データ（円単位）
 *   combined: { min, max }              // 全ターゲットの最小～最大範囲（円単位）
 * }
 */
function getTargetSalaryForDashboard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('検索対象');
    if (!sheet) {
      return { targets: [], combined: { min: null, max: null } };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { targets: [], combined: { min: null, max: null } };
    }

    // A列: 市区町村名, C列: 希望給与下限(万円), D列: 希望給与上限(万円)
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

    const targets = [];
    let combinedMin = null;
    let combinedMax = null;

    data.forEach(row => {
      const name = row[0];
      const min = row[2];  // C列
      const max = row[3];  // D列

      if (!name) return;  // 名前がなければスキップ

      // 給与データがあるターゲットのみ追加
      if (min || max) {
        const minYen = min ? min * 10000 : null;  // 万円 → 円に変換
        const maxYen = max ? max * 10000 : null;

        targets.push({
          name: name,
          min: minYen,
          max: maxYen
        });

        // 全体の最小・最大を計算
        if (minYen !== null) {
          combinedMin = combinedMin === null ? minYen : Math.min(combinedMin, minYen);
        }
        if (maxYen !== null) {
          combinedMax = combinedMax === null ? maxYen : Math.max(combinedMax, maxYen);
        }
      }
    });

    return {
      targets: targets,
      combined: { min: combinedMin, max: combinedMax }
    };
  } catch (error) {
    console.error('getTargetSalaryForDashboard エラー:', error);
    return { targets: [], combined: { min: null, max: null } };
  }
}

/**
 * サマリーデータのみ取得（軽量版）
 * @returns {Object} サマリーデータ
 */
function getSummaryData() {
  try {
    const aggregation = getAggregatedDataWithCache();
    return {
      success: true,
      data: aggregation.summary
    };
  } catch (error) {
    console.error('getSummaryData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 給与データのみ取得
 * @returns {Object} 給与集計データ
 */
function getSalaryData() {
  try {
    const aggregation = getAggregatedDataWithCache();
    return {
      success: true,
      data: aggregation.salaryData
    };
  } catch (error) {
    console.error('getSalaryData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 所在地データのみ取得
 * @returns {Object} 所在地集計データ
 */
function getLocationData() {
  try {
    const aggregation = getAggregatedDataWithCache();
    return {
      success: true,
      data: aggregation.locationData
    };
  } catch (error) {
    console.error('getLocationData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 雇用形態データのみ取得
 * @returns {Object} 雇用形態集計データ
 */
function getEmploymentData() {
  try {
    const aggregation = getAggregatedDataWithCache();
    return {
      success: true,
      data: aggregation.employmentData
    };
  } catch (error) {
    console.error('getEmploymentData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * タグデータのみ取得
 * @returns {Object} タグ集計データ
 */
function getTagData() {
  try {
    const aggregation = getAggregatedDataWithCache();
    return {
      success: true,
      data: aggregation.tagData
    };
  } catch (error) {
    console.error('getTagData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * データを再計算（キャッシュクリア）
 * @returns {Object} 再計算結果
 */
function refreshDashboardData() {
  console.log('=== refreshDashboardData 開始 ===');
  const startTime = Date.now();

  try {
    // Step 1: キャッシュをクリア
    console.log('Step 1: キャッシュクリア...');
    clearAggregationCache();
    console.log('Step 1: 完了');

    // Step 2: 永続化データもクリアして全更新
    console.log('Step 2: 永続化データクリア＆全更新...');
    DataLayer.clearAllCache(true);
    const incrementalResult = DataLayer.forceIncrementalUpdate(true);
    console.log('Step 2: 完了 - モード:' + incrementalResult.mode + ', 件数:' + incrementalResult.stats.total);

    // Step 3: 再計算
    console.log('Step 3: 集計データ取得...');
    const aggregation = DataLayer.getAggregation(true);
    console.log('Step 3: 完了 - totalCount:' + (aggregation.summary ? aggregation.summary.totalCount : 'N/A'));

    // Step 3.5: 自社給与データを追加
    const targetSalary = getTargetSalaryForDashboard();
    aggregation.targetSalary = targetSalary;
    console.log('自社給与: min=' + (targetSalary.min || '-') + ', max=' + (targetSalary.max || '-'));

    // Step 4: キャッシュに保存
    const cache = CacheService.getScriptCache();
    try {
      const jsonStr = JSON.stringify(aggregation);
      console.log('JSONサイズ: ' + Math.round(jsonStr.length / 1024) + 'KB');
      cache.put('dashboard_aggregation', jsonStr, CACHE_TTL.summary);
      console.log('Step 4: キャッシュ保存完了');
    } catch (e) {
      console.warn('キャッシュ保存に失敗:', e);
    }

    console.log('=== refreshDashboardData 完了: ' + (Date.now() - startTime) + 'ms ===');
    return {
      success: true,
      data: aggregation
    };
  } catch (error) {
    console.error('refreshDashboardData エラー:', error);
    console.error('スタック:', error.stack);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 通信テスト用関数
 */
function testConnection() {
  console.log('testConnection 呼び出し');
  return { success: true, message: 'OK', timestamp: new Date().toISOString() };
}

/**
 * 統一ダッシュボードデータ取得（HTML用の安定したエントリポイント）
 * 動的メソッド呼び出しの問題を回避するための関数
 * @param {boolean} forceRefresh - 強制リフレッシュフラグ
 * @returns {Object} ダッシュボードデータ
 */
function fetchDashboardData(forceRefresh) {
  console.log('=== fetchDashboardData 開始 (forceRefresh=' + forceRefresh + ') ===');

  try {
    let result;
    if (forceRefresh === true) {
      result = refreshDashboardData();
    } else {
      result = getDashboardData();
    }

    // 戻り値を安全にシリアライズ可能な形式に変換
    // google.script.runはJSON.parse(JSON.stringify())相当の処理を行うため、
    // 事前に変換してエラーを検出する
    try {
      const safeResult = JSON.parse(JSON.stringify(result));
      console.log('fetchDashboardData: シリアライズ成功');
      return safeResult;
    } catch (serializeError) {
      console.error('fetchDashboardData: シリアライズエラー:', serializeError);
      // シリアライズできない場合は空データを返す
      return {
        success: true,
        data: JSON.parse(JSON.stringify(createEmptyAggregation())),
        warning: 'データのシリアライズに失敗しました'
      };
    }
  } catch (error) {
    console.error('fetchDashboardData エラー:', error);
    // 最終フォールバック
    return {
      success: true,
      data: JSON.parse(JSON.stringify(createEmptyAggregation())),
      warning: 'データ取得に失敗しました: ' + error.toString()
    };
  }
}

/**
 * ダッシュボードを新しいウィンドウで開く
 */
function openDashboard() {
  const html = HtmlService.createTemplateFromFile('Dashboard').evaluate()
    .setWidth(1800)
    .setHeight(1000)
    .setTitle('求人データ ダッシュボード');

  SpreadsheetApp.getUi().showModalDialog(html, '求人データ ダッシュボード');
}

/**
 * 地図ビューを新しいウィンドウで開く
 */
function openMapView() {
  const html = HtmlService.createTemplateFromFile('MapView').evaluate()
    .setWidth(1800)
    .setHeight(1000)
    .setTitle('求人地図ビュー');
  SpreadsheetApp.getUi().showModalDialog(html, '求人地図ビュー');
}

/**
 * ダッシュボードをサイドバーで開く
 */

/**
 * 統合ビュー（ダッシュボード＋地図）を最大サイズで開く
 */
function openCombinedView() {
  const html = HtmlService.createTemplateFromFile('CombinedView').evaluate()
    .setWidth(1800)
    .setHeight(1000)
    .setTitle('求人データ分析');

  SpreadsheetApp.getUi().showModalDialog(html, '求人データ分析');
}

/**
 * CSVインポート後のキャッシュ強制再構築
 * 件数に関係なく、常にキャッシュをクリアして再構築する
 * これにより、CSVインポート後は必ず最新データがダッシュボードに反映される
 */
function rebuildCacheAfterImport() {
  console.log('═'.repeat(50));
  console.log('📦 CSVインポート後のキャッシュ再構築');
  console.log('═'.repeat(50));

  const startTime = Date.now();

  try {
    // Step 1: シートのデータ件数確認
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('データ');
    const sheetRowCount = dataSheet ? dataSheet.getLastRow() - 1 : 0;
    console.log('Step 1: シートデータ件数 = ' + sheetRowCount);

    // Step 1.5: 検索対象シートの状態を確認（古いデータが残っていないか）
    const targetSheet = ss.getSheetByName('検索対象');
    if (targetSheet) {
      const targetLastRow = targetSheet.getLastRow();
      console.log('Step 1.5: 検索対象シート行数 = ' + targetLastRow);
      if (targetLastRow > 1) {
        const firstTarget = targetSheet.getRange(2, 1).getValue();
        console.log('  ⚠️ 検索対象残存: "' + firstTarget + '"');
        // 強制クリア
        targetSheet.getRange(2, 1, targetLastRow - 1, targetSheet.getLastColumn()).clearContent();
        console.log('  → 検索対象を強制クリアしました');
      }
    }

    // Step 2: 全キャッシュをクリア（永続化含む）
    console.log('Step 2: 全キャッシュクリア...');

    // ScriptCacheの全キャッシュキーを明示的に削除
    const scriptCache = CacheService.getScriptCache();
    const cacheKeysToRemove = [
      'dashboard_aggregation',
      'map_data',
      'city_aggregation',
      'salary_stats',
      'parsed_data',
      'station_master',
      'city_master'
    ];
    scriptCache.removeAll(cacheKeysToRemove);
    console.log('  ScriptCacheクリア: ' + cacheKeysToRemove.length + 'キー');

    // DataPersistence（ScriptProperties）をクリア
    DataPersistence.clearAll();
    console.log('  DataPersistenceクリア完了');

    // DataLayerのセッションキャッシュをクリア
    DataLayer.clearAllCache(true);
    console.log('  DataLayerキャッシュクリア完了');

    // Aggregatorのキャッシュをクリア
    clearAggregationCache();

    // LocationParserのマスタキャッシュもクリア
    if (typeof clearLocationMasterCache === 'function') {
      clearLocationMasterCache();
      console.log('  LocationParserマスタキャッシュクリア完了');
    }

    // Step 2.5: クリア検証（デバッグ用）
    const clearVerified = DataPersistence.verifyClearAll();
    if (!clearVerified) {
      console.error('Step 2.5: ❌ キャッシュクリア検証失敗！永続化データが残っています');
      // 再度クリアを試行
      DataPersistence.clearAll();
    } else {
      console.log('Step 2.5: ✅ キャッシュクリア検証成功');
    }
    console.log('Step 2: 完了');

    // Step 3: データを再構築
    console.log('Step 3: データ再構築...');
    const updateResult = DataLayer.forceIncrementalUpdate(true);
    console.log('Step 3: 完了 - モード:' + updateResult.mode + ', 件数:' + updateResult.stats.total);

    // Step 4: 集計データを事前計算してキャッシュ
    console.log('Step 4: 集計データ事前計算...');
    const aggregation = DataLayer.getAggregation(true);
    const totalCount = aggregation.summary ? aggregation.summary.totalCount : 0;
    console.log('Step 4: 完了 - totalCount:' + totalCount);

    // Step 5: 集計キャッシュに保存
    const cache = CacheService.getScriptCache();
    try {
      const jsonStr = JSON.stringify(aggregation);
      console.log('JSONサイズ: ' + Math.round(jsonStr.length / 1024) + 'KB');
      if (jsonStr.length < 100000) { // 100KB以下なら保存
        cache.put('dashboard_aggregation', jsonStr, 21600); // 6時間
        console.log('Step 5: 集計キャッシュ保存完了');
      }
    } catch (e) {
      console.warn('Step 5: 集計キャッシュ保存スキップ（サイズ超過）');
    }

    const elapsed = Date.now() - startTime;

    // Step 6: 地域分布確認（デバッグ用）
    console.log('Step 6: 地域分布確認...');
    if (aggregation.locationData && aggregation.locationData.prefectureDistribution) {
      const nonZero = aggregation.locationData.prefectureDistribution.nonZero || {};
      const topPrefs = Object.entries(nonZero)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      console.log('  上位都道府県: ' + topPrefs.map(p => p[0] + '(' + p[1] + ')').join(', '));
    }

    // Step 6.5: topCities確認（根本原因調査用）
    console.log('Step 6.5: topCities確認...');
    if (aggregation.locationData && aggregation.locationData.topCities) {
      const topCities = aggregation.locationData.topCities;
      console.log('  topCities: ' + JSON.stringify(topCities));
    }

    // Step 6.6: パース結果サンプル（根本原因調査用）
    console.log('Step 6.6: パース結果サンプル...');
    const parsedData = DataLayer.getParsedData(false);
    if (parsedData && parsedData.length > 0) {
      const samples = parsedData.slice(0, 5);
      samples.forEach((d, i) => {
        console.log('  [' + i + '] 所在地: "' + d.location + '" → 県:' + d.locationParsed?.prefecture + ', 市:' + d.locationParsed?.cityWard);
      });
    }

    console.log('═'.repeat(50));
    console.log('✅ キャッシュ再構築完了');
    console.log('  シート: ' + sheetRowCount + '件');
    console.log('  集計: ' + totalCount + '件');
    console.log('  処理時間: ' + elapsed + 'ms');
    console.log('═'.repeat(50));

    return {
      success: true,
      sheetCount: sheetRowCount,
      aggregationCount: totalCount,
      elapsed: elapsed
    };

  } catch (error) {
    console.error('キャッシュ再構築エラー: ' + error.toString());
    console.error('スタック: ' + error.stack);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * データ状態診断（デバッグ用）
 * CSVインポート後に古いデータが残る問題の調査用
 */
function diagnoseDataState() {
  console.log('═'.repeat(60));
  console.log('データ状態診断');
  console.log('═'.repeat(60));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');
  const cache = CacheService.getScriptCache();

  // 1. シート状態
  console.log('\n[1] シート状態:');
  if (dataSheet) {
    const lastRow = dataSheet.getLastRow();
    const lastCol = dataSheet.getLastColumn();
    console.log('  lastRow: ' + lastRow);
    console.log('  lastCol: ' + lastCol);
    console.log('  データ行数（推定）: ' + (lastRow - 1));

    // 最初と最後の5行のD列（勤務地）を表示
    if (lastRow > 1) {
      const firstRows = dataSheet.getRange(2, 8, Math.min(5, lastRow - 1), 1).getValues();
      console.log('  最初の5行の勤務地: ' + firstRows.map(r => r[0]).join(', '));

      if (lastRow > 6) {
        const lastRows = dataSheet.getRange(Math.max(2, lastRow - 4), 8, Math.min(5, lastRow - 1), 1).getValues();
        console.log('  最後の5行の勤務地: ' + lastRows.map(r => r[0]).join(', '));
      }
    }
  } else {
    console.log('  シートなし');
  }

  // 2. DataPersistence状態
  console.log('\n[2] DataPersistence状態:');
  const metadata = DataPersistence.loadMetadata();
  if (metadata) {
    console.log('  recordCount: ' + metadata.recordCount);
    console.log('  lastUpdated: ' + metadata.lastUpdated);
    console.log('  mode: ' + metadata.mode);
  } else {
    console.log('  メタデータなし');
  }

  const parsedData = DataPersistence.loadParsedData();
  if (parsedData && parsedData.length > 0) {
    console.log('  parsedData件数: ' + parsedData.length);
    // 最初と最後のレコードの勤務地を表示
    console.log('  最初のレコード勤務地: ' + (parsedData[0].location || 'なし'));
    console.log('  最後のレコード勤務地: ' + (parsedData[parsedData.length - 1].location || 'なし'));
    // 都道府県の分布
    const prefCounts = {};
    parsedData.forEach(d => {
      const pref = d.locationParsed?.prefecture || '不明';
      prefCounts[pref] = (prefCounts[pref] || 0) + 1;
    });
    console.log('  都道府県分布: ' + JSON.stringify(prefCounts));
  } else {
    console.log('  parsedDataなし');
  }

  // 3. スクリプトキャッシュ状態
  console.log('\n[3] スクリプトキャッシュ状態:');
  const cachedAgg = cache.get('dashboard_aggregation');
  if (cachedAgg) {
    try {
      const agg = JSON.parse(cachedAgg);
      console.log('  totalCount: ' + (agg.summary?.totalCount || 'N/A'));
      console.log('  locationDataトップ5: ' + JSON.stringify(agg.locationData?.prefectures?.slice(0, 5) || []));
    } catch (e) {
      console.log('  キャッシュ解析エラー: ' + e);
    }
  } else {
    console.log('  キャッシュなし');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('診断完了');
  console.log('═'.repeat(60));
}

/**
 * データ整合性を自動チェック＆修復
 * - 空行を削除
 * - キャッシュとシートの件数が不一致なら再構築
 */
function ensureDataIntegrity() {
  console.log('=== データ整合性チェック開始 ===');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');
  if (!dataSheet) return;

  const lastRow = dataSheet.getLastRow();
  if (lastRow <= 1) return;

  // Step 1: 空行をカウント
  const range = dataSheet.getRange(2, 4, lastRow - 1, 4); // D列からG列
  const values = range.getValues();
  let emptyRowCount = 0;
  const emptyRowIndices = [];

  values.forEach((row, index) => {
    if (!row[0] && !row[3]) { // jobTitle(D列)とcompanyName(G列)が両方空
      emptyRowCount++;
      emptyRowIndices.push(index + 2);
    }
  });

  // Step 2: 空行があれば削除
  if (emptyRowCount > 0) {
    console.log('空行を削除: ' + emptyRowCount + '行');
    // 下から削除（行番号がずれないように）
    for (let i = emptyRowIndices.length - 1; i >= 0; i--) {
      dataSheet.deleteRow(emptyRowIndices[i]);
    }
  }

  // Step 3: キャッシュとシートの件数チェック
  const newLastRow = dataSheet.getLastRow();
  const sheetRowCount = newLastRow - 1;
  const metadata = DataPersistence.loadMetadata();
  const cacheCount = metadata ? metadata.recordCount : 0;

  console.log('シート件数: ' + sheetRowCount + ', キャッシュ件数: ' + cacheCount);

  // Step 4: 不一致があれば再構築
  if (sheetRowCount !== cacheCount) {
    console.log('件数不一致 → キャッシュ再構築');
    DataPersistence.clearAll();
    DataLayer.clearAllCache(true);
    DataLayer.forceIncrementalUpdate(true);
  }

  console.log('=== データ整合性チェック完了 ===');
}

function openDashboardSidebar() {
  const html = HtmlService.createTemplateFromFile('Dashboard').evaluate()
    .setTitle('求人データ ダッシュボード');

  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * CSVインポート後にダッシュボードを表示
 * （processCSVFileの後に呼び出し用）
 */
function showDashboardAfterImport() {
  // キャッシュをクリアして最新データで表示
  clearAggregationCache();
  openDashboard();
}

/**
 * フィルター適用済みデータを取得
 * @param {Object} filters - フィルター条件
 * @returns {Object} フィルター適用済みデータ
 */
function getFilteredData(filters) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('データ');

    if (!dataSheet) {
      throw new Error('「データ」シートが見つかりません');
    }

    // 全データを取得
    const rawData = getRawDataFromSheet(dataSheet);
    let parsedData = parseAllData(rawData);

    // フィルター適用
    if (filters) {
      parsedData = applyFilters(parsedData, filters);
    }

    // 集計
    const aggregation = {
      summary: createSummary(parsedData),
      salaryData: createSalaryAggregation(parsedData),
      locationData: createLocationAggregation(parsedData),
      employmentData: createEmploymentAggregation(parsedData),
      tagData: createTagAggregation(parsedData),
      rawRecords: []  // ダッシュボードで未使用のため空配列
    };

    return {
      success: true,
      data: aggregation,
      filteredCount: parsedData.length
    };
  } catch (error) {
    console.error('getFilteredData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * フィルターを適用
 */
function applyFilters(data, filters) {
  let filtered = [...data];

  // 都道府県フィルター
  if (filters.prefectures && filters.prefectures.length > 0) {
    filtered = filtered.filter(d =>
      filters.prefectures.includes(d.locationParsed.prefecture)
    );
  }

  // 地域ブロックフィルター
  if (filters.regionBlocks && filters.regionBlocks.length > 0) {
    filtered = filtered.filter(d =>
      filters.regionBlocks.includes(d.locationParsed.regionBlock)
    );
  }

  // 雇用形態フィルター
  if (filters.employmentTypes && filters.employmentTypes.length > 0) {
    filtered = filtered.filter(d =>
      filters.employmentTypes.includes(d.employmentParsed.subcategory) ||
      filters.employmentTypes.includes(d.employmentParsed.category)
    );
  }

  // 給与レンジフィルター
  if (filters.salaryMin !== undefined && filters.salaryMin !== null) {
    filtered = filtered.filter(d =>
      d.salaryParsed.unifiedMonthly === null ||
      d.salaryParsed.unifiedMonthly >= filters.salaryMin
    );
  }
  if (filters.salaryMax !== undefined && filters.salaryMax !== null) {
    filtered = filtered.filter(d =>
      d.salaryParsed.unifiedMonthly === null ||
      d.salaryParsed.unifiedMonthly <= filters.salaryMax
    );
  }

  // タグフィルター
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(d =>
      filters.tags.some(tag => d.tagsParsed.tags.includes(tag))
    );
  }

  // キーワード検索
  if (filters.keyword && filters.keyword.trim() !== '') {
    const keyword = filters.keyword.toLowerCase();
    filtered = filtered.filter(d =>
      d.jobTitle.toLowerCase().includes(keyword) ||
      d.companyName.toLowerCase().includes(keyword) ||
      d.location.toLowerCase().includes(keyword)
    );
  }

  return filtered;
}

/**
 * フィルターオプションを取得（ドロップダウン用）
 */
function getFilterOptions() {
  try {
    const aggregation = getAggregatedDataWithCache();

    return {
      success: true,
      data: {
        prefectures: Object.keys(aggregation.locationData.prefectureDistribution.nonZero),
        regionBlocks: Object.keys(aggregation.locationData.regionBlockDistribution).filter(k => k !== '不明'),
        employmentTypes: Object.keys(aggregation.employmentData.subcategoryDistribution),
        tags: aggregation.tagData.topTags.map(t => t.tag)
      }
    };
  } catch (error) {
    console.error('getFilterOptions error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 企業分析データを取得
 * @returns {Object} 企業分析データ
 */
function getCompanyAnalysis() {
  try {
    // 最新データを使用
    const parsedData = DataLayer.getParsedData(true);
    const companyData = createCompanyAggregation(parsedData);
    return {
      success: true,
      data: companyData
    };
  } catch (error) {
    console.error('getCompanyAnalysis error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * スキル・タグと給与の相関分析データを取得
 * @returns {Object} タグ×給与相関分析データ
 */
function getTagSalaryAnalysis() {
  try {
    // 最新データを使用
    const parsedData = DataLayer.getParsedData(true);
    const correlationData = createTagSalaryCorrelation(parsedData);
    return {
      success: true,
      data: correlationData
    };
  } catch (error) {
    console.error('getTagSalaryAnalysis error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * PDFレポートを生成してダウンロードURLを返す
 * @returns {Object} PDF生成結果
 */
function generatePdfReport() {
  try {
    // 最新データを使用するため forceRefresh=true で取得
    const aggregation = DataLayer.getAggregation(true);
    const parsedData = DataLayer.getParsedData(true);
    const companyData = createCompanyAggregation(parsedData);
    const tagSalaryData = createTagSalaryCorrelation(parsedData);

    // レポート用HTMLを生成
    const reportHtml = createPdfReportHtml(aggregation, companyData, tagSalaryData);

    // HTMLをBlob化
    const blob = HtmlService.createHtmlOutput(reportHtml).getBlob();
    blob.setName('求人分析レポート_' + Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd_HHmmss') + '.html');

    // Googleドライブに保存
    const file = DriveApp.createFile(blob);
    const fileUrl = file.getUrl();

    return {
      success: true,
      data: {
        fileUrl: fileUrl,
        fileName: file.getName(),
        message: 'レポートを生成しました。Googleドライブに保存されています。'
      }
    };
  } catch (error) {
    console.error('generatePdfReport error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * PDFレポート用HTMLを生成（網羅的な情報を含む）
 */
function createPdfReportHtml(aggregation, companyData, tagSalaryData) {
  const summary = aggregation.summary;
  const salaryData = aggregation.salaryData;
  const locationData = aggregation.locationData;
  const employmentData = aggregation.employmentData;
  const tagData = aggregation.tagData;
  const now = Utilities.formatDate(new Date(), 'JST', 'yyyy年MM月dd日 HH:mm');

  // 給与統計の整形
  const formatSalary = (val) => val ? Math.round(val / 10000) + '万円' : '-';

  // 地域別TOP10を作成
  const topCities = Object.entries(locationData.topCities || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 都道府県分布
  const prefDistribution = Object.entries(locationData.prefectureDistribution?.nonZero || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 雇用形態分布
  const empDistribution = Object.entries(employmentData.subcategoryDistribution || {})
    .filter(([k]) => k !== '不明')
    .sort((a, b) => b[1] - a[1]);

  // 地域ブロック分布
  const regionDistribution = Object.entries(locationData.regionBlockDistribution || {})
    .filter(([k]) => k !== '不明')
    .sort((a, b) => b[1] - a[1]);

  // 都市タイプ分布
  const cityTypeDistribution = Object.entries(locationData.cityTypeDistribution || {})
    .filter(([k]) => k !== '不明' && k)
    .sort((a, b) => b[1] - a[1]);

  // 給与タイプ別統計
  const bySalaryType = salaryData.bySalaryType || {};
  const hourlyStats = salaryData.hourlyStats || {};

  // タグカテゴリ別
  const tagCategories = Object.entries(tagData.categoryTotals || {})
    .filter(([k, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>求人分析レポート</title>
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #1a73e8; border-bottom: 3px solid #1a73e8; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; border-left: 4px solid #1a73e8; padding-left: 10px; page-break-after: avoid; }
    h3 { color: #555; margin-top: 20px; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .summary-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #1a73e8; }
    .summary-card .label { font-size: 12px; color: #666; margin-top: 5px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .stat-box { background: #f0f7ff; padding: 12px; border-radius: 8px; text-align: center; }
    .stat-box .stat-value { font-size: 20px; font-weight: bold; color: #1a73e8; }
    .stat-box .stat-label { font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; }
    tr:nth-child(even) { background: #f9f9f9; }
    .positive { color: #0d904f; }
    .negative { color: #c53929; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .bar { background: #e0e0e0; height: 16px; border-radius: 4px; overflow: hidden; }
    .bar-fill { background: linear-gradient(90deg, #4285f4, #1a73e8); height: 100%; }
    .bar-container { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
    .bar-label { width: 100px; font-size: 12px; text-align: right; }
    .bar-value { width: 50px; font-size: 12px; }
    .section { margin-bottom: 30px; }
    .note { background: #fff3cd; padding: 10px; border-radius: 4px; font-size: 12px; margin: 10px 0; }
    .footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>📊 求人分析レポート</h1>
  <p>生成日時: ${now}</p>

  <!-- 1. サマリー -->
  <div class="section">
    <h2>📈 サマリー</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="value">${summary.totalCount.toLocaleString()}</div>
        <div class="label">総求人数</div>
      </div>
      <div class="summary-card">
        <div class="value">${formatSalary(summary.avgMonthlySalary)}</div>
        <div class="label">平均月給</div>
      </div>
      <div class="summary-card">
        <div class="value">${summary.fullTimeRate}%</div>
        <div class="label">正社員率</div>
      </div>
      <div class="summary-card">
        <div class="value">${summary.newRate}%</div>
        <div class="label">新着率</div>
      </div>
    </div>
  </div>

  <!-- 2. 給与統計 -->
  <div class="section">
    <h2>💰 給与統計</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${formatSalary(summary.avgMonthlySalary)}</div>
        <div class="stat-label">平均月給</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatSalary(summary.medianMonthlySalary)}</div>
        <div class="stat-label">中央値</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${summary.modeRange || '-'}</div>
        <div class="stat-label">最頻値帯</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatSalary(summary.minSalary)}</div>
        <div class="stat-label">最小値</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatSalary(summary.maxSalary)}</div>
        <div class="stat-label">最大値</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${salaryData.validCount}件</div>
        <div class="stat-label">有効データ数</div>
      </div>
    </div>

    ${hourlyStats.count > 0 ? `
    <h3>⏰ 時給データ統計（${hourlyStats.count}件）</h3>
    <p>平均時給: <strong>${hourlyStats.avg.toLocaleString()}円</strong> /
       中央値: <strong>${hourlyStats.median.toLocaleString()}円</strong> /
       範囲: ${hourlyStats.min.toLocaleString()}円 ～ ${hourlyStats.max.toLocaleString()}円</p>
    <p class="note">※ 月給換算: 時給 × ${SALARY_CONVERSION_RATES.hourly_to_monthly}時間（8時間×20日）</p>
    ` : ''}

    ${bySalaryType.daily && bySalaryType.daily.count > 0 ? `
    <h3>📅 日給データ統計（${bySalaryType.daily.count}件）</h3>
    <p>平均日給: <strong>${bySalaryType.daily.avg.toLocaleString()}円</strong> /
       範囲: ${bySalaryType.daily.min.toLocaleString()}円 ～ ${bySalaryType.daily.max.toLocaleString()}円</p>
    ` : ''}
  </div>

  <!-- 3. 雇用形態分布 -->
  <div class="section">
    <h2>👔 雇用形態分布</h2>
    ${empDistribution.map(([type, count]) => {
      const pct = Math.round((count / summary.totalCount) * 100);
      return `
      <div class="bar-container">
        <span class="bar-label">${type}</span>
        <div class="bar" style="flex: 1;"><div class="bar-fill" style="width: ${pct}%;"></div></div>
        <span class="bar-value">${count}件 (${pct}%)</span>
      </div>`;
    }).join('')}
  </div>

  <!-- 4. 地域分析 -->
  <div class="section">
    <h2>📍 地域分析</h2>
    <div class="two-column">
      <div>
        <h3>地域ブロック別</h3>
        <table>
          <tr><th>地域</th><th>件数</th><th>割合</th></tr>
          ${regionDistribution.map(([region, count]) => `
          <tr>
            <td>${region}</td>
            <td>${count}件</td>
            <td>${Math.round((count / summary.totalCount) * 100)}%</td>
          </tr>`).join('')}
        </table>
      </div>
      <div>
        <h3>都道府県TOP10</h3>
        <table>
          <tr><th>都道府県</th><th>件数</th><th>割合</th></tr>
          ${prefDistribution.map(([pref, count]) => `
          <tr>
            <td>${pref}</td>
            <td>${count}件</td>
            <td>${Math.round((count / summary.totalCount) * 100)}%</td>
          </tr>`).join('')}
        </table>
      </div>
    </div>

    <h3>市区町村TOP10</h3>
    <table>
      <tr><th>順位</th><th>市区町村</th><th>件数</th><th>割合</th></tr>
      ${topCities.map(([city, count], i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${city}</td>
        <td>${count}件</td>
        <td>${Math.round((count / summary.totalCount) * 100)}%</td>
      </tr>`).join('')}
    </table>

    ${cityTypeDistribution.length > 0 ? `
    <h3>都市タイプ別</h3>
    <table>
      <tr><th>都市タイプ</th><th>件数</th><th>割合</th></tr>
      ${cityTypeDistribution.map(([type, count]) => `
      <tr>
        <td>${type}</td>
        <td>${count}件</td>
        <td>${Math.round((count / summary.totalCount) * 100)}%</td>
      </tr>`).join('')}
    </table>
    ` : ''}
  </div>

  <!-- 5. 企業ランキング -->
  <div class="section">
    <h2>🏢 企業ランキング（求人数順）</h2>
    <table>
      <tr><th>順位</th><th>企業名</th><th>求人数</th><th>平均給与</th><th>主な雇用形態</th></tr>
      ${companyData.topByCount.slice(0, 15).map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${c.name}</td>
        <td>${c.jobCount}件</td>
        <td>${c.avgSalaryMan ? c.avgSalaryMan + '万円' : '-'}</td>
        <td>${c.mainEmploymentType}</td>
      </tr>`).join('')}
    </table>
  </div>

  <!-- 6. タグ分析 -->
  <div class="section">
    <h2>🏷️ タグ分析</h2>
    <div class="two-column">
      <div>
        <h3>人気タグTOP15</h3>
        <table>
          <tr><th>タグ</th><th>件数</th></tr>
          ${(tagData.topTags || []).slice(0, 15).map(t => `
          <tr>
            <td>${t.tag}</td>
            <td>${t.count}件</td>
          </tr>`).join('')}
        </table>
      </div>
      <div>
        <h3>タグカテゴリ別</h3>
        <table>
          <tr><th>カテゴリ</th><th>該当件数</th></tr>
          ${tagCategories.map(([cat, count]) => `
          <tr>
            <td>${cat}</td>
            <td>${count}件</td>
          </tr>`).join('')}
        </table>
      </div>
    </div>
  </div>

  <!-- 7. タグと給与の相関 -->
  <div class="section">
    <h2>💡 タグと給与の相関</h2>
    <p>全体平均月給: <strong>${tagSalaryData.overallAvgMan}万円</strong></p>
    <table>
      <tr><th>タグ</th><th>件数</th><th>平均給与</th><th>全体比</th></tr>
      ${tagSalaryData.tagCorrelations.slice(0, 20).map(t => `
      <tr>
        <td>${t.tag}</td>
        <td>${t.count}件</td>
        <td>${t.avgSalaryMan}万円</td>
        <td class="${t.diffFromAvg >= 0 ? 'positive' : 'negative'}">${t.diffFromAvg >= 0 ? '+' : ''}${t.diffFromAvgMan}万円 (${t.diffFromAvg >= 0 ? '+' : ''}${t.diffPercent}%)</td>
      </tr>`).join('')}
    </table>

    ${tagSalaryData.combinations && tagSalaryData.combinations.length > 0 ? `
    <h3>🔗 タグ組み合わせ分析</h3>
    <table>
      <tr><th>組み合わせ</th><th>件数</th><th>平均給与</th><th>全体比</th></tr>
      ${tagSalaryData.combinations.slice(0, 10).map(c => `
      <tr>
        <td>${c.combination}</td>
        <td>${c.count}件</td>
        <td>${c.avgSalaryMan}万円</td>
        <td class="${c.diffFromAvg >= 0 ? 'positive' : 'negative'}">${c.diffFromAvg >= 0 ? '+' : ''}${c.diffFromAvgMan}万円</td>
      </tr>`).join('')}
    </table>
    ` : ''}
  </div>

  <!-- 8. 雇用形態別給与 -->
  ${salaryData.byEmploymentType && Object.keys(salaryData.byEmploymentType).length > 0 ? `
  <div class="section">
    <h2>💼 雇用形態別給与</h2>
    <table>
      <tr><th>雇用形態</th><th>件数</th><th>平均月給</th><th>中央値</th><th>最小</th><th>最大</th></tr>
      ${Object.entries(salaryData.byEmploymentType)
        .filter(([type, stats]) => stats && stats.count > 0)
        .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
        .map(([type, stats]) => `
      <tr>
        <td>${type}</td>
        <td>${stats.count}件</td>
        <td>${stats.mean ? Math.round(stats.mean / 10000) + '万円' : '-'}</td>
        <td>${stats.median ? Math.round(stats.median / 10000) + '万円' : '-'}</td>
        <td>${stats.min ? Math.round(stats.min / 10000) + '万円' : '-'}</td>
        <td>${stats.max ? Math.round(stats.max / 10000) + '万円' : '-'}</td>
      </tr>`).join('')}
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>このレポートは求人データ分析ダッシュボードから自動生成されました</p>
    <p>データ件数: ${summary.totalCount}件 / 有効給与データ: ${salaryData.validCount}件</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * 🔍 API動作テスト
 * GASエディタで実行して、APIが正常に動作するか確認
 */
function testDashboardAPI() {
  console.log('═'.repeat(60));
  console.log('📊 Dashboard API テスト');
  console.log('═'.repeat(60));

  // Test 1: getDashboardData
  console.log('\n【Test 1: getDashboardData】');
  try {
    const result = getDashboardData();
    console.log('成功: ' + result.success);
    if (result.success) {
      console.log('  totalCount: ' + result.data.summary.totalCount);
      console.log('  avgSalary: ' + result.data.summary.avgMonthlySalary);
      console.log('  salaryData件数: ' + result.data.salaryData.validCount);
      console.log('  locationData都道府県数: ' + Object.keys(result.data.locationData.prefectureDistribution.nonZero || {}).length);
      console.log('  employmentData種類数: ' + Object.keys(result.data.employmentData.subcategoryDistribution || {}).length);
      console.log('  tagData上位タグ数: ' + (result.data.tagData.topTags ? result.data.tagData.topTags.length : 0));
    } else {
      console.log('  エラー: ' + result.error);
    }
  } catch (e) {
    console.error('例外: ' + e.toString());
  }

  // Test 2: データサイズ確認
  console.log('\n【Test 2: データサイズ】');
  try {
    const result = getDashboardData();
    if (result.success) {
      const jsonStr = JSON.stringify(result);
      console.log('返却データサイズ: ' + Math.round(jsonStr.length / 1024) + 'KB');

      // 各部分のサイズ
      console.log('  summary: ' + Math.round(JSON.stringify(result.data.summary).length / 1024) + 'KB');
      console.log('  salaryData: ' + Math.round(JSON.stringify(result.data.salaryData).length / 1024) + 'KB');
      console.log('  locationData: ' + Math.round(JSON.stringify(result.data.locationData).length / 1024) + 'KB');
      console.log('  employmentData: ' + Math.round(JSON.stringify(result.data.employmentData).length / 1024) + 'KB');
      console.log('  tagData: ' + Math.round(JSON.stringify(result.data.tagData).length / 1024) + 'KB');
      console.log('  rawRecords: ' + Math.round(JSON.stringify(result.data.rawRecords).length / 1024) + 'KB');
    }
  } catch (e) {
    console.error('例外: ' + e.toString());
  }

  console.log('\n' + '═'.repeat(60));
  console.log('テスト完了');
  console.log('═'.repeat(60));
}

/**
 * 🔧 キャッシュ強制クリア＆再構築
 * CSVインポート後にダッシュボードに反映されない場合に実行
 */
function forceRefreshAllData() {
  console.log('═'.repeat(60));
  console.log('🔧 強制キャッシュクリア＆再構築');
  console.log('═'.repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: シートのデータ件数確認
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('データ');
    const sheetRowCount = dataSheet ? dataSheet.getLastRow() - 1 : 0;
    console.log('Step 1: シートデータ件数 = ' + sheetRowCount);

    // Step 2: 現在のキャッシュ状態
    const beforeInfo = DataPersistence.getStorageInfo();
    console.log('Step 2: クリア前キャッシュ = ' + (beforeInfo.metadata ? beforeInfo.metadata.recordCount : 0) + '件');

    // Step 3: 永続化データを完全クリア
    console.log('Step 3: DataPersistence.clearAll() 実行...');
    DataPersistence.clearAll();
    console.log('Step 3: 永続化データクリア完了');

    // Step 4: セッションキャッシュもクリア
    console.log('Step 4: DataLayer.clearAllCache(true) 実行...');
    DataLayer.clearAllCache(true);
    console.log('Step 4: セッションキャッシュクリア完了');

    // Step 5: クリア後の確認
    const afterInfo = DataPersistence.getStorageInfo();
    console.log('Step 5: クリア後キャッシュ = ' + (afterInfo.metadata ? afterInfo.metadata.recordCount : 0) + '件');

    // Step 6: データを強制再構築
    console.log('Step 6: DataLayer.forceIncrementalUpdate(true) 実行...');
    const updateResult = DataLayer.forceIncrementalUpdate(true);
    console.log('Step 6: 再構築結果 = ' + JSON.stringify(updateResult));

    // Step 7: 再構築後の確認
    const finalInfo = DataPersistence.getStorageInfo();
    const finalCount = finalInfo.metadata ? finalInfo.metadata.recordCount : 0;
    console.log('Step 7: 再構築後キャッシュ = ' + finalCount + '件');

    // Step 8: 集計データを取得して確認
    console.log('Step 8: 集計データ取得...');
    const aggregation = getAggregatedDataWithCache();
    const totalCount = aggregation.summary ? aggregation.summary.totalCount : 0;
    console.log('Step 8: 集計totalCount = ' + totalCount);

    const elapsed = Date.now() - startTime;

    console.log('\n' + '═'.repeat(60));
    console.log('✅ 完了');
    console.log('  シート: ' + sheetRowCount + '件');
    console.log('  キャッシュ: ' + finalCount + '件');
    console.log('  集計: ' + totalCount + '件');
    console.log('  処理時間: ' + elapsed + 'ms');

    if (sheetRowCount === totalCount) {
      console.log('  状態: ✅ 正常（件数一致）');
    } else {
      console.log('  状態: ⚠️ 不一致あり（要確認）');
    }
    console.log('═'.repeat(60));

    return {
      success: true,
      sheetCount: sheetRowCount,
      cacheCount: finalCount,
      aggregationCount: totalCount,
      elapsed: elapsed
    };

  } catch (error) {
    console.error('エラー: ' + error.toString());
    console.error('スタック: ' + error.stack);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 🧹 シートから空行を削除
 * jobTitleとcompanyNameが両方空の行を削除
 */
function cleanEmptyRowsFromDataSheet() {
  console.log('═'.repeat(60));
  console.log('🧹 空行削除処理');
  console.log('═'.repeat(60));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');

  if (!dataSheet) {
    console.log('❌ 「データ」シートが見つかりません');
    return { success: false, error: 'シートが見つかりません' };
  }

  const lastRow = dataSheet.getLastRow();
  if (lastRow <= 1) {
    console.log('データがありません');
    return { success: true, deletedRows: 0 };
  }

  console.log('処理前の行数: ' + (lastRow - 1));

  // D列とG列のデータを取得（jobTitleとcompanyName）
  const range = dataSheet.getRange(2, 4, lastRow - 1, 4); // D列からG列
  const values = range.getValues();

  // 空行を下から削除（上から削除すると行番号がずれる）
  let deletedCount = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const jobTitle = values[i][0];   // D列
    const companyName = values[i][3]; // G列

    if (!jobTitle && !companyName) {
      const rowToDelete = i + 2; // 1-indexed, ヘッダー行を考慮
      dataSheet.deleteRow(rowToDelete);
      deletedCount++;
    }
  }

  const newLastRow = dataSheet.getLastRow();
  console.log('削除した行数: ' + deletedCount);
  console.log('処理後の行数: ' + (newLastRow - 1));
  console.log('═'.repeat(60));

  return {
    success: true,
    deletedRows: deletedCount,
    beforeCount: lastRow - 1,
    afterCount: newLastRow - 1
  };
}
