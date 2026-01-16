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
 * 事前計算データを読み込むのみ（高速化）
 * @returns {Object} ダッシュボードに必要な全集計データ
 */
function getDashboardData() {
  console.log('=== getDashboardData 開始（読み込み専用モード） ===');
  const startTime = Date.now();

  try {
    // 事前計算データを読み込み
    let aggregation = DataPersistence.loadPrecomputedDashboard();

    if (aggregation && aggregation.summary) {
      console.log('事前計算データ読み込み成功: totalCount=' + aggregation.summary.totalCount);
      console.log('事前計算時刻: ' + new Date(aggregation._precomputedAt).toISOString());
      console.log('=== getDashboardData 完了: ' + (Date.now() - startTime) + 'ms ===');
      return {
        success: true,
        data: aggregation
      };
    }

    // 事前計算データがない場合はフォールバック（従来の処理）
    console.log('事前計算データなし - フォールバック処理実行');

    // ★ストレージクォータ対策: フォールバック前に古いデータをクリア
    try {
      const props = PropertiesService.getScriptProperties();
      const allProps = props.getProperties();
      const incKeys = Object.keys(allProps).filter(k => k.startsWith('inc_'));
      let incSize = 0;
      incKeys.forEach(k => { incSize += (allProps[k] || '').length; });
      const usagePercent = Math.round(incSize / 500000 * 100);
      console.log('ストレージ状態: inc_* ' + incKeys.length + 'キー, ' + Math.round(incSize / 1024) + 'KB (使用率' + usagePercent + '%)');

      // 使用率が50%超なら古いデータをクリア
      if (usagePercent > 50) {
        console.log('⚠️ ストレージ使用率が高いためクリア実行中...');
        DataPersistence.clearAll(false);
        DataLayer.clearAllCache(false);
        console.log('✅ ストレージクリア完了');
      }
    } catch (storageCheckError) {
      console.warn('ストレージチェックエラー（無視）:', storageCheckError);
    }

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
    aggregation = null;

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
 * 事前計算データも更新する
 * @returns {Object} 再計算結果
 */
function refreshDashboardData() {
  console.log('=== refreshDashboardData 開始 ===');
  const startTime = Date.now();

  try {
    // Step 1: 全キャッシュを徹底クリア（データ混在防止）
    console.log('Step 1: 全キャッシュクリア...');
    clearAggregationCache();
    const clearResult = DataPersistence.clearAll(false);
    console.log('  DataPersistenceクリア: ' + JSON.stringify(clearResult));

    // クリア失敗時は強制クリア
    if (!clearResult.success || clearResult.remaining > 0) {
      console.warn('  ⚠️ クリア不完全 - 強制クリア実行中...');
      forceNuclearClear();
    }

    DataLayer.clearAllCache(true);

    // クリア検証
    const clearVerified = DataPersistence.verifyClearAll();
    if (!clearVerified) {
      console.error('Step 1: ❌ クリア検証失敗');
    } else {
      console.log('Step 1: ✅ クリア完了');
    }

    // Step 2: データを再構築（軽量モード）
    console.log('Step 2: データ再構築（軽量モード）...');
    const incrementalResult = DataLayer.forceIncrementalUpdate(true, true);  // skipParsedDataSave=true
    console.log('Step 2: 完了 - モード:' + incrementalResult.mode + ', 件数:' + incrementalResult.stats.total);

    // Step 3: 事前計算データを生成・保存
    console.log('Step 3: 事前計算データ生成...');
    precomputeAllData();
    console.log('Step 3: 完了');

    // Step 4: 事前計算データから読み込んで返す
    const aggregation = DataPersistence.loadPrecomputedDashboard();
    console.log('Step 4: 事前計算データ読み込み完了 - totalCount:' + (aggregation && aggregation.summary ? aggregation.summary.totalCount : 'N/A'));

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

    // Step 2: 全キャッシュを徹底クリア（永続化含む）
    console.log('Step 2: 全キャッシュクリア...');

    // ScriptCacheの全キャッシュキーを明示的に削除（スプレッドシート固有キー含む）
    const scriptCache = CacheService.getScriptCache();
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const cacheKeysToRemove = [
      'dashboard_aggregation_' + ssId,
      'map_data_' + ssId,
      'city_aggregation_' + ssId,
      'salary_stats_' + ssId,
      'parsed_data_' + ssId,
      'station_master',
      'city_master'
    ];
    scriptCache.removeAll(cacheKeysToRemove);
    console.log('  ScriptCacheクリア: ' + cacheKeysToRemove.length + 'キー');

    // DataPersistence（ScriptProperties）を徹底クリア（リトライ付き）
    const clearResult = DataPersistence.clearAll(false);  // throwOnFailure=false
    console.log('  DataPersistenceクリア: ' + JSON.stringify(clearResult));

    // クリア失敗時は追加の強制クリアを試行
    if (!clearResult.success || clearResult.remaining > 0) {
      console.warn('  ⚠️ クリア不完全 - 強制クリア実行中...');
      forceNuclearClear();
    }

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

    // Step 2.5: クリア最終検証
    const clearVerified = DataPersistence.verifyClearAll();
    if (!clearVerified) {
      const errorMsg = 'Step 2.5: ❌ クリア検証失敗！古いデータが残っている可能性があります';
      console.error(errorMsg);
      // エラーを投げてCSVインポートを中断させる
      throw new Error(errorMsg);
    }
    console.log('Step 2.5: ✅ クリア検証成功');

    // Step 3: データを再構築（軽量モード：inc_parsed_dataを保存しない）
    console.log('Step 3: データ再構築（軽量モード）...');
    const updateResult = DataLayer.forceIncrementalUpdate(true, true);  // 第2引数: skipParsedDataSave
    console.log('Step 3: 完了 - モード:' + updateResult.mode + ', 件数:' + updateResult.stats.total);

    // Step 4: 集計データを事前計算
    console.log('Step 4: 集計データ事前計算...');
    const aggregation = DataLayer.getAggregation(true);
    const totalCount = aggregation.summary ? aggregation.summary.totalCount : 0;
    console.log('Step 4: 完了 - totalCount:' + totalCount);

    // Step 5: ScriptCacheに集計キャッシュ保存（スプレッドシート固有キー）
    const cache = CacheService.getScriptCache();
    try {
      const jsonStr = JSON.stringify(aggregation);
      const cacheKey = DataLayer.getCacheKey('dashboard_aggregation');
      console.log('JSONサイズ: ' + Math.round(jsonStr.length / 1024) + 'KB');
      if (jsonStr.length < 100000) {
        cache.put(cacheKey, jsonStr, 21600);
        console.log('Step 5: 集計キャッシュ保存完了');
      }
    } catch (e) {
      console.warn('Step 5: 集計キャッシュ保存スキップ');
    }

    // Step 6: 事前計算データを生成・保存
    console.log('Step 6: 事前計算データ生成...');
    const precomputeResult = precomputeAllData();
    if (!precomputeResult.success) {
      console.error('Step 6: ❌ 事前計算失敗: ' + precomputeResult.error);
    } else {
      console.log('Step 6: ✅ 事前計算完了');
    }

    // Step 7: 最終検証
    console.log('Step 7: 最終検証...');
    if (aggregation.locationData && aggregation.locationData.prefectureDistribution) {
      const nonZero = aggregation.locationData.prefectureDistribution.nonZero || {};
      const topPrefs = Object.entries(nonZero)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      console.log('  上位都道府県: ' + topPrefs.map(p => p[0] + '(' + p[1] + ')').join(', '));
    }

    const elapsed = Date.now() - startTime;

    console.log('═'.repeat(50));
    console.log('✅ キャッシュ再構築完了');
    console.log('  シート: ' + sheetRowCount + '件');
    console.log('  集計: ' + totalCount + '件');
    console.log('  処理時間: ' + elapsed + 'ms');
    console.log('═'.repeat(50));

    // 件数不一致警告
    if (sheetRowCount !== totalCount && sheetRowCount > 0) {
      console.warn('⚠️ 件数不一致: シート=' + sheetRowCount + ', 集計=' + totalCount);
    }

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
 * 強制的に全プロパティを削除（核オプション）
 * clearAll()が失敗した場合の最終手段
 */
function forceNuclearClear() {
  console.log('🔥 forceNuclearClear: 開始');
  const props = PropertiesService.getScriptProperties();
  const allKeys = Object.keys(props.getProperties());

  let deleted = 0;
  allKeys.forEach(key => {
    if (key.startsWith('inc_') || key.startsWith('precomputed_')) {
      try {
        props.deleteProperty(key);
        deleted++;
      } catch (e) {
        console.error('  削除失敗: ' + key);
      }
    }
  });

  console.log('🔥 forceNuclearClear: ' + deleted + 'キー削除');

  // 確認
  const remaining = Object.keys(props.getProperties()).filter(k =>
    k.startsWith('inc_') || k.startsWith('precomputed_')
  );
  if (remaining.length > 0) {
    console.error('🔥 残留キー: ' + remaining.join(', '));
  }

  return { deleted: deleted, remaining: remaining.length };
}

/**
 * 事前計算データを生成・保存
 * CSVインポート時に呼び出され、ダッシュボードと地図のデータを事前に計算
 * これによりダッシュボード/地図表示時は読み込みのみで高速化
 */
function precomputeAllData() {
  console.log('═'.repeat(50));
  console.log('📊 事前計算データ生成開始');
  console.log('═'.repeat(50));

  const startTime = Date.now();

  try {
    // ===== ダッシュボードデータの事前計算 =====
    console.log('[1/3] ダッシュボードデータ計算中...');
    const dashboardStart = Date.now();

    // 集計データを取得（forceRefresh=trueで最新データ）
    const aggregation = DataLayer.getAggregation(true);

    // 自社給与データを追加
    const targetSalary = getTargetSalaryForDashboard();
    aggregation.targetSalary = targetSalary;

    // タイムスタンプを追加
    aggregation._precomputedAt = Date.now();

    // ===== データサイズ最適化（保存前）=====
    // enhancedStats/formattedStats は表示時に再計算するため、保存から除外
    if (aggregation.summary) {
      aggregation.summary.enhancedStats = null;
      aggregation.summary.formattedStats = null;
    }

    // 注: salaryBinningとminMaxHistogramsのlabelsは表示に必要なため保持
    // 軽量化が必要な場合はクライアント側で再生成する仕組みを実装

    console.log('  データ最適化完了（enhancedStats/formattedStats/labels除外）');

    // ダッシュボードデータを保存
    const dashboardSaved = DataPersistence.savePrecomputedDashboard(aggregation);
    console.log('  ダッシュボード保存: ' + (dashboardSaved ? '成功' : '失敗') +
                ' (' + (Date.now() - dashboardStart) + 'ms)');
    console.log('  totalCount: ' + (aggregation.summary ? aggregation.summary.totalCount : 'N/A'));

    // ===== 地図データの事前計算 =====
    console.log('[2/3] 地図データ計算中...');
    const mapStart = Date.now();

    // 検索対象データを取得
    const targets = getTargetLocations();
    targets.forEach(target => {
      if (target.salaryMin || target.salaryMax) {
        target.positionAll = DataLayer.calculatePosition(target.salaryMin, target.salaryMax, null);
        target.positionLocal = DataLayer.calculatePosition(target.salaryMin, target.salaryMax, target.name);
      }
    });

    // 都市別集計データを取得（ストレージ最適化: 上位50件に制限）
    let cityData = DataLayer.getCityAggregation(true);
    if (cityData.length > 50) {
      cityData = cityData.slice(0, 50);
      console.log('  都市データを50件に制限');
    }

    // 地図の表示範囲を計算
    const bounds = calculateMapBounds(targets, cityData);

    // 給与統計を取得
    const salaryStats = DataLayer.getSalaryStats(true);

    // 流入分析を実行
    const targetCityNames = targets.map(t => t.name);
    const inflowAnalysis = targetCityNames.length > 0
      ? DataLayer.calculateInflow(targetCityNames, true)
      : { error: "検索対象が設定されていません" };

    // 地図データをまとめる
    const mapData = {
      targets: targets,
      cities: cityData,
      bounds: bounds,
      summary: aggregation.summary,
      salaryStats: salaryStats,
      inflowAnalysis: inflowAnalysis,
      _precomputedAt: Date.now()
    };

    // 地図データを保存
    const mapSaved = DataPersistence.savePrecomputedMap(mapData);
    console.log('  地図保存: ' + (mapSaved ? '成功' : '失敗') +
                ' (' + (Date.now() - mapStart) + 'ms)');
    console.log('  targets: ' + targets.length + '件, cities: ' + cityData.length + '件');

    // ===== 分析データの事前計算 =====
    console.log('[3/3] 分析データ計算中...');
    const analysisStart = Date.now();

    // parsedDataを取得（企業分析・タグ×給与相関に必要）
    const parsedData = DataLayer.getParsedData(true);

    // 企業分析データ
    const companyData = createCompanyAggregation(parsedData);

    // タグ×給与相関データ
    const tagSalaryData = createTagSalaryCorrelation(parsedData);

    // 求職者視点分析データ（JobSeekerAnalysis.js）
    let jobSeekerData = null;
    if (typeof analyzeJobSeekerPerspective === 'function') {
      jobSeekerData = analyzeJobSeekerPerspective(parsedData);
      console.log('  求職者視点分析: 計算完了');
    }

    // 分析データをまとめる
    const analysisData = {
      companyAnalysis: companyData,
      tagSalaryAnalysis: tagSalaryData,
      jobSeekerAnalysis: jobSeekerData,
      _precomputedAt: Date.now()
    };

    // 分析データを保存（レポート生成に必要）
    const analysisSaved = DataPersistence.savePrecomputedAnalysis(analysisData);
    console.log('  分析保存: ' + (analysisSaved ? '成功' : '失敗') +
                ' (' + (Date.now() - analysisStart) + 'ms)');
    console.log('  企業数: ' + companyData.totalCompanies + '件, タグ相関: ' + tagSalaryData.tagCorrelations.length + '件');
    console.log('  求職者分析: ' + (jobSeekerData ? '有' : '無'));

    const elapsed = Date.now() - startTime;
    console.log('═'.repeat(50));
    console.log('✅ 事前計算完了 (' + elapsed + 'ms)');
    console.log('═'.repeat(50));

    return {
      success: true,
      dashboardSaved: dashboardSaved,
      mapSaved: mapSaved,
      analysisSaved: analysisSaved,
      elapsed: elapsed
    };

  } catch (error) {
    console.error('事前計算エラー: ' + error.toString());
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

  // 3. スクリプトキャッシュ状態（スプレッドシート固有）
  console.log('\n[3] スクリプトキャッシュ状態:');
  const cacheKey = DataLayer.getCacheKey('dashboard_aggregation');
  console.log('  キャッシュキー: ' + cacheKey);
  const cachedAgg = cache.get(cacheKey);
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
    DataLayer.forceIncrementalUpdate(true, true);  // skipParsedDataSave=true
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
 * 全分析データを一括取得（高速化）
 * 3つのAPIを1回にまとめてPropertiesServiceアクセスを削減
 * @returns {Object} 企業分析、タグ分析、求職者視点分析を含む
 */
function getAllAnalysisData() {
  console.log('=== getAllAnalysisData 開始（一括読み込み） ===');
  const startTime = Date.now();

  try {
    // 事前計算データを1回だけ読み込み
    const analysisData = DataPersistence.loadPrecomputedAnalysis();

    if (analysisData) {
      console.log('事前計算データ読み込み成功');
      console.log('=== getAllAnalysisData 完了: ' + (Date.now() - startTime) + 'ms ===');
      return {
        success: true,
        data: {
          companyAnalysis: analysisData.companyAnalysis || null,
          tagSalaryAnalysis: analysisData.tagSalaryAnalysis || null,
          jobSeekerAnalysis: analysisData.jobSeekerAnalysis || null,
          _precomputedAt: analysisData._precomputedAt
        }
      };
    }

    // 事前計算データがない場合はフォールバック
    console.log('事前計算データなし - フォールバック処理実行');
    const parsedData = DataLayer.getParsedData(true);

    if (!parsedData || parsedData.length === 0) {
      return {
        success: false,
        error: 'データがありません。CSVをインポートしてください。'
      };
    }

    const result = {
      companyAnalysis: createCompanyAggregation(parsedData),
      tagSalaryAnalysis: createTagSalaryCorrelation(parsedData),
      jobSeekerAnalysis: typeof analyzeJobSeekerPerspective === 'function'
        ? analyzeJobSeekerPerspective(parsedData) : null
    };

    console.log('=== getAllAnalysisData 完了（フォールバック）: ' + (Date.now() - startTime) + 'ms ===');
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('getAllAnalysisData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 企業分析データを取得
 * 事前計算データを読み込むのみ（高速化）
 * @returns {Object} 企業分析データ
 */
function getCompanyAnalysis() {
  console.log('=== getCompanyAnalysis 開始（読み込み専用モード） ===');
  const startTime = Date.now();

  try {
    // 事前計算データを読み込み
    const analysisData = DataPersistence.loadPrecomputedAnalysis();

    if (analysisData && analysisData.companyAnalysis) {
      console.log('事前計算データ読み込み成功: 企業数=' + analysisData.companyAnalysis.totalCompanies);
      console.log('=== getCompanyAnalysis 完了: ' + (Date.now() - startTime) + 'ms ===');
      return {
        success: true,
        data: analysisData.companyAnalysis
      };
    }

    // 事前計算データがない場合はフォールバック（従来の処理）
    console.log('事前計算データなし - フォールバック処理実行');
    const parsedData = DataLayer.getParsedData(true);
    const companyData = createCompanyAggregation(parsedData);
    console.log('=== getCompanyAnalysis 完了（フォールバック）: ' + (Date.now() - startTime) + 'ms ===');
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
 * 事前計算データを読み込むのみ（高速化）
 * @returns {Object} タグ×給与相関分析データ
 */
function getTagSalaryAnalysis() {
  console.log('=== getTagSalaryAnalysis 開始（読み込み専用モード） ===');
  const startTime = Date.now();

  try {
    // 事前計算データを読み込み
    const analysisData = DataPersistence.loadPrecomputedAnalysis();

    if (analysisData && analysisData.tagSalaryAnalysis) {
      console.log('事前計算データ読み込み成功: タグ相関=' + analysisData.tagSalaryAnalysis.tagCorrelations.length + '件');
      console.log('=== getTagSalaryAnalysis 完了: ' + (Date.now() - startTime) + 'ms ===');
      return {
        success: true,
        data: analysisData.tagSalaryAnalysis
      };
    }

    // 事前計算データがない場合はフォールバック（従来の処理）
    console.log('事前計算データなし - フォールバック処理実行');
    const parsedData = DataLayer.getParsedData(true);
    const correlationData = createTagSalaryCorrelation(parsedData);
    console.log('=== getTagSalaryAnalysis 完了（フォールバック）: ' + (Date.now() - startTime) + 'ms ===');
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
 * 求職者視点分析データを取得
 * 求職者が求人一覧をどう見るかの認知パターン分析
 * @returns {Object} 求職者視点分析データ
 */
function getJobSeekerAnalysis() {
  console.log('=== getJobSeekerAnalysis 開始 ===');
  const startTime = Date.now();

  try {
    // 事前計算データから分析データを読み込み
    const analysisData = DataPersistence.loadPrecomputedAnalysis();

    if (analysisData && analysisData.jobSeekerAnalysis) {
      console.log('事前計算データ読み込み成功');
      console.log('=== getJobSeekerAnalysis 完了: ' + (Date.now() - startTime) + 'ms ===');
      return {
        success: true,
        data: analysisData.jobSeekerAnalysis
      };
    }

    // 事前計算データがない場合はリアルタイム計算
    console.log('事前計算データなし - リアルタイム計算実行');
    const parsedData = DataLayer.getParsedData(true);

    if (!parsedData || parsedData.length === 0) {
      return {
        success: false,
        error: 'データがありません。CSVをインポートしてください。'
      };
    }

    // JobSeekerAnalysis.js の関数を呼び出し
    const jobSeekerData = analyzeJobSeekerPerspective(parsedData);
    console.log('=== getJobSeekerAnalysis 完了（リアルタイム）: ' + (Date.now() - startTime) + 'ms ===');

    return {
      success: true,
      data: jobSeekerData
    };
  } catch (error) {
    console.error('getJobSeekerAnalysis error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * PDFレポートを生成してダウンロードURLを返す
 * 事前計算データを使用（高速化）
 * @returns {Object} PDF生成結果
 */
function generatePdfReport() {
  console.log('=== generatePdfReport 開始 ===');
  const startTime = Date.now();

  try {
    // 事前計算データを読み込み
    const dashboardData = DataPersistence.loadPrecomputedDashboard();
    const mapData = DataPersistence.loadPrecomputedMap();
    let analysisData = DataPersistence.loadPrecomputedAnalysis();

    if (!dashboardData || !dashboardData.summary) {
      throw new Error('事前計算データがありません。CSVをインポートしてください。');
    }

    // 分析データがない場合はオンデマンド計算（フォールバック）
    if (!analysisData || !analysisData.companyAnalysis || !analysisData.tagSalaryAnalysis) {
      console.log('分析データなし - オンデマンド計算実行');
      const parsedData = DataLayer.getParsedData(true);
      if (parsedData && parsedData.length > 0) {
        analysisData = {
          companyAnalysis: createCompanyAggregation(parsedData),
          tagSalaryAnalysis: createTagSalaryCorrelation(parsedData),
          jobSeekerAnalysis: typeof analyzeJobSeekerPerspective === 'function'
            ? analyzeJobSeekerPerspective(parsedData) : null
        };
        console.log('  企業: ' + analysisData.companyAnalysis.totalCompanies + '社, タグ相関: ' + analysisData.tagSalaryAnalysis.tagCorrelations.length + '件');
      }
    }

    // レポート用HTMLを生成
    const reportHtml = createPdfReportHtml(dashboardData, mapData, analysisData);

    // HTMLをBlob化
    const blob = HtmlService.createHtmlOutput(reportHtml).getBlob();
    blob.setName('求人分析レポート_' + Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd_HHmmss') + '.html');

    // Googleドライブに保存
    const file = DriveApp.createFile(blob);
    const fileUrl = file.getUrl();

    console.log('=== generatePdfReport 完了: ' + (Date.now() - startTime) + 'ms ===');

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
 * SVGグラフ、検索対象、流入分析を含む
 */
function createPdfReportHtml(dashboardData, mapData, analysisData) {
  const summary = dashboardData.summary || {};
  const salaryData = dashboardData.salaryData || {};
  const locationData = dashboardData.locationData || {};
  const employmentData = dashboardData.employmentData || {};
  const tagData = dashboardData.tagData || {};
  const targetSalary = dashboardData.targetSalary || {};
  const annualHolidaysData = dashboardData.annualHolidaysData || {};
  const salaryBinning = dashboardData.salaryBinning || {};

  // 分析データ
  const companyData = analysisData?.companyAnalysis || { topByCount: [], topBySalary: [], totalCompanies: 0 };
  const tagSalaryData = analysisData?.tagSalaryAnalysis || { tagCorrelations: [], overallAvgMan: 0, combinations: [] };
  const jobSeekerData = analysisData?.jobSeekerAnalysis || null;

  // 地図データ
  const targets = mapData?.targets || [];
  const cities = mapData?.cities || [];
  const inflowAnalysis = mapData?.inflowAnalysis || {};

  const now = Utilities.formatDate(new Date(), 'JST', 'yyyy年MM月dd日 HH:mm');

  // 給与統計の整形
  const formatSalary = (val) => val ? (val / 10000).toFixed(1) + '万円' : '-';

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

  // 給与ヒストグラムデータ
  const histogram = salaryData.histogram || { labels: [], values: [] };
  const minMaxHistograms = salaryData.minMaxHistograms || { labels: [], minHistogram: [], maxHistogram: [], stats: {} };

  // 雇用形態別給与
  const byEmploymentType = salaryData.byEmploymentType || {};

  // タグカテゴリ別
  const tagCategories = Object.entries(tagData.categoryTotals || {})
    .filter(([k, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  // SVG棒グラフ生成関数
  function createBarChartSvg(labels, values, title, color, width, height) {
    if (!labels || labels.length === 0) return '<p>データなし</p>';
    const maxVal = Math.max(...values, 1);
    const barWidth = Math.max(15, Math.floor((width - 80) / labels.length) - 2);
    const chartHeight = height - 60;

    let svg = '<svg width="' + width + '" height="' + height + '" style="background:#fafafa;border-radius:8px;">';
    svg += '<text x="' + (width/2) + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + title + '</text>';

    labels.forEach((label, i) => {
      const barHeight = (values[i] / maxVal) * chartHeight;
      const x = 50 + i * (barWidth + 2);
      const y = height - 40 - barHeight;

      svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + color + '" rx="2"/>';
      if (values[i] > 0) {
        svg += '<text x="' + (x + barWidth/2) + '" y="' + (y - 3) + '" text-anchor="middle" font-size="9">' + values[i] + '</text>';
      }
      svg += '<text x="' + (x + barWidth/2) + '" y="' + (height - 25) + '" text-anchor="middle" font-size="8" transform="rotate(-45 ' + (x + barWidth/2) + ' ' + (height - 25) + ')">' + label + '</text>';
    });

    svg += '</svg>';
    return svg;
  }

  // 水平棒グラフ生成関数
  function createHorizontalBarSvg(items, title, width, height) {
    if (!items || items.length === 0) return '<p>データなし</p>';
    const maxVal = Math.max(...items.map(i => i.value), 1);
    const barHeight = Math.min(25, Math.floor((height - 50) / items.length) - 5);

    let svg = '<svg width="' + width + '" height="' + height + '" style="background:#fafafa;border-radius:8px;">';
    svg += '<text x="' + (width/2) + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + title + '</text>';

    items.forEach((item, i) => {
      const barWidth = (item.value / maxVal) * (width - 200);
      const y = 40 + i * (barHeight + 5);

      svg += '<text x="90" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-size="11">' + item.label + '</text>';
      svg += '<rect x="95" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + item.color + '" rx="3"/>';
      svg += '<text x="' + (100 + barWidth + 5) + '" y="' + (y + barHeight/2 + 4) + '" font-size="10">' + item.value + '件</text>';
    });

    svg += '</svg>';
    return svg;
  }

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>求人分析レポート</title>
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; padding: 40px; max-width: 1100px; margin: 0 auto; line-height: 1.6; }
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
    .positive { color: #0d904f; font-weight: bold; }
    .negative { color: #c53929; font-weight: bold; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .three-column { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .bar { background: #e0e0e0; height: 20px; border-radius: 4px; overflow: hidden; }
    .bar-fill { background: linear-gradient(90deg, #4285f4, #1a73e8); height: 100%; }
    .bar-container { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    .bar-label { width: 100px; font-size: 12px; text-align: right; }
    .bar-value { width: 80px; font-size: 12px; }
    .section { margin-bottom: 35px; page-break-inside: avoid; }
    .chart-container { margin: 20px 0; text-align: center; }
    .note { background: #fff3cd; padding: 10px; border-radius: 4px; font-size: 12px; margin: 10px 0; }
    .highlight-box { background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4caf50; }
    .warning-box { background: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ff9800; }
    .target-card { background: #e3f2fd; padding: 12px; border-radius: 8px; margin: 8px 0; }
    .footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
    /* 編集可能エリアのスタイル */
    .editable { outline: none; }
    .editable:hover { background: rgba(26, 115, 232, 0.05); }
    .editable:focus { background: rgba(26, 115, 232, 0.1); border-radius: 4px; }
    .edit-guide { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    .edit-guide strong { color: #1565c0; }
    .user-note { background: #fffde7; border: 1px dashed #fbc02d; border-radius: 8px; padding: 15px; margin: 20px 0; min-height: 60px; }
    .user-note-label { font-size: 11px; color: #f57f17; margin-bottom: 5px; }
    /* 印刷最適化 - A4縦 */
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 18mm 15mm;
    }
    @media print {
      /* 基本レイアウト - 余白確保 */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      body {
        font-size: 10px !important;
        line-height: 1.35 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* 非表示要素 */
      .edit-guide { display: none !important; }
      .user-note { display: none !important; }
      .no-print { display: none !important; }
      /* h1調整 */
      h1 {
        font-size: 20px !important;
        margin: 0 0 8px 0 !important;
        padding-bottom: 6px !important;
      }
      h2 {
        font-size: 14px !important;
        margin: 12px 0 8px 0 !important;
      }
      h3 {
        font-size: 11px !important;
        margin: 8px 0 4px 0 !important;
      }
      /* ページ区切り制御 */
      h1, h2, h3 { page-break-after: avoid; }
      .section {
        margin-bottom: 12px !important;
      }
      /* 小さいセクションのみ分割を避ける */
      .section.no-break {
        page-break-inside: avoid;
      }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      /* サマリーグリッド - コンパクト化 */
      .summary-grid {
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 8px !important;
        margin: 10px 0 !important;
      }
      .summary-card {
        padding: 8px !important;
      }
      .summary-card .value {
        font-size: 18px !important;
      }
      .summary-card .label {
        font-size: 9px !important;
      }
      /* 統計グリッド */
      .stats-grid {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 8px !important;
        margin: 8px 0 !important;
      }
      .stat-box {
        padding: 6px !important;
      }
      .stat-box .stat-value {
        font-size: 14px !important;
      }
      .stat-box .stat-label {
        font-size: 8px !important;
      }
      /* 2列/3列レイアウト */
      .two-column {
        grid-template-columns: 1fr 1fr !important;
        gap: 12px !important;
      }
      .three-column {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 8px !important;
      }
      /* テーブル最適化 */
      table {
        font-size: 9px !important;
        margin: 6px 0 !important;
      }
      th, td {
        padding: 4px 5px !important;
      }
      th {
        font-size: 9px !important;
      }
      /* チャート最適化 */
      .chart-container {
        margin: 8px 0 !important;
      }
      .chart-container svg {
        max-width: 100% !important;
        height: auto !important;
      }
      /* バーチャート - コンパクト */
      .bar-container {
        margin: 3px 0 !important;
      }
      .bar-label {
        width: 70px !important;
        font-size: 9px !important;
      }
      .bar-value {
        width: 55px !important;
        font-size: 9px !important;
      }
      .bar {
        height: 14px !important;
      }
      /* ボックス類 - コンパクト */
      .highlight-box, .warning-box, .target-card {
        padding: 8px !important;
        margin: 6px 0 !important;
        font-size: 10px !important;
      }
      .note {
        padding: 6px !important;
        font-size: 9px !important;
        margin: 6px 0 !important;
      }
      /* フッター */
      .footer {
        margin-top: 15px !important;
        padding-top: 8px !important;
        font-size: 9px !important;
      }
      /* セクション間隔調整 */
      .section + .section {
        margin-top: 15px !important;
      }
      /* 給与帯別休日のバー */
      .holiday-charts-container {
        display: block !important;
      }
    }
  </style>
</head>
<body>
  <div class="edit-guide" contenteditable="false">
    <strong>編集モード:</strong> このレポートは直接編集できます。テキストをクリックして変更し、Ctrl+S（Mac: Cmd+S）で保存してください。印刷時にこのガイドは非表示になります。
  </div>

  <h1 class="editable" contenteditable="true">求人分析レポート</h1>
  <p class="editable" contenteditable="true">生成日時: ${now}</p>

  <!-- 1. サマリー -->
  <div class="section no-break">
    <h2>サマリー</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="value">${(summary.totalCount || 0).toLocaleString()}</div>
        <div class="label">総求人数</div>
      </div>
      <div class="summary-card">
        <div class="value">${formatSalary(summary.avgMonthlySalary)}</div>
        <div class="label">平均月給</div>
      </div>
      <div class="summary-card">
        <div class="value">${summary.fullTimeRate || 0}%</div>
        <div class="label">正社員率</div>
      </div>
      <div class="summary-card">
        <div class="value">${summary.newRate || 0}%</div>
        <div class="label">新着率</div>
      </div>
    </div>
  </div>

  <!-- 2. 検索対象（ターゲット）情報 -->
  ${targets.length > 0 ? `
  <div class="section no-break">
    <h2>検索対象</h2>
    <p>設定された検索対象: <strong>${targets.length}件</strong></p>
    <div class="three-column">
      ${targets.map(t => `
      <div class="target-card">
        <strong>${t.name}</strong><br>
        ${t.salaryMin || t.salaryMax ? `希望給与: ${t.salaryMin ? (t.salaryMin/10000).toFixed(1) + '万' : '-'} ～ ${t.salaryMax ? (t.salaryMax/10000).toFixed(1) + '万円' : '-'}` : '給与条件なし'}
        ${t.positionAll ? `<br><small>市場位置: 全体${Math.round(t.positionAll*100)}%</small>` : ''}
      </div>`).join('')}
    </div>
    ${targetSalary.combined && (targetSalary.combined.min || targetSalary.combined.max) ? `
    <div class="highlight-box">
      <strong>希望給与範囲（全対象合算）:</strong> ${targetSalary.combined.min ? (targetSalary.combined.min/10000).toFixed(1) + '万円' : '-'} ～ ${targetSalary.combined.max ? (targetSalary.combined.max/10000).toFixed(1) + '万円' : '-'}
    </div>
    ` : ''}
  </div>
  ` : ''}

  <!-- 3. 給与分布グラフ -->
  <div class="section">
    <h2>給与分布</h2>
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
    </div>

    ${minMaxHistograms.rawMinLabels && minMaxHistograms.rawMinLabels.length > 0 ? `
    <h3>下限給与分布（生データ）</h3>
    <p style="text-align:center;font-size:12px;margin-bottom:10px;">平均: ${minMaxHistograms.stats.minMean ? (minMaxHistograms.stats.minMean/10000).toFixed(1) + '万円' : '-'} / 中央値: ${minMaxHistograms.stats.minMedian ? (minMaxHistograms.stats.minMedian/10000).toFixed(1) + '万円' : '-'}</p>
    <div class="chart-container">
      ${createBarChartSvg(minMaxHistograms.rawMinLabels.slice(0, 40), minMaxHistograms.rawMinHistogram.slice(0, 40), '', '#3498db', 900, 250)}
    </div>
    ` : ''}

    ${minMaxHistograms.rawMaxLabels && minMaxHistograms.rawMaxLabels.length > 0 ? `
    <h3 style="margin-top:25px;">上限給与分布（生データ）</h3>
    <p style="text-align:center;font-size:12px;margin-bottom:10px;">平均: ${minMaxHistograms.stats.maxMean ? (minMaxHistograms.stats.maxMean/10000).toFixed(1) + '万円' : '-'} / 中央値: ${minMaxHistograms.stats.maxMedian ? (minMaxHistograms.stats.maxMedian/10000).toFixed(1) + '万円' : '-'}</p>
    <div class="chart-container">
      ${createBarChartSvg(minMaxHistograms.rawMaxLabels.slice(0, 40), minMaxHistograms.rawMaxHistogram.slice(0, 40), '', '#e74c3c', 900, 250)}
    </div>
    ` : ''}

    ${minMaxHistograms.labels && minMaxHistograms.labels.length > 0 ? `
    <h3 style="margin-top:25px;">下限給与分布（5,000円刻み）</h3>
    <div class="chart-container">
      ${createBarChartSvg(minMaxHistograms.labels.slice(0, 30), minMaxHistograms.minHistogram.slice(0, 30), '', '#3498db', 900, 250)}
    </div>

    <h3 style="margin-top:25px;">上限給与分布（5,000円刻み）</h3>
    <div class="chart-container">
      ${createBarChartSvg(minMaxHistograms.labels.slice(0, 30), minMaxHistograms.maxHistogram.slice(0, 30), '', '#e74c3c', 900, 250)}
    </div>
    ` : ''}
  </div>

  <!-- 4. 雇用形態分布 -->
  <div class="section">
    <h2>雇用形態分布</h2>
    <div class="chart-container">
      ${createHorizontalBarSvg(empDistribution.slice(0, 8).map(([type, count]) => ({ label: type, value: count, color: '#1a73e8' })), '雇用形態別求人数', 700, 280)}
    </div>

    ${Object.keys(byEmploymentType).length > 0 ? `
    <h3>雇用形態別給与比較</h3>
    <table>
      <tr><th>雇用形態</th><th>件数</th><th>平均月給</th><th>中央値</th><th>範囲</th></tr>
      ${Object.entries(byEmploymentType)
        .filter(([type, stats]) => stats && stats.count > 0)
        .sort((a, b) => (b[1].mean || 0) - (a[1].mean || 0))
        .map(([type, stats]) => `
      <tr>
        <td>${type}</td>
        <td>${stats.count}件</td>
        <td><strong>${stats.mean ? (stats.mean / 10000).toFixed(1) + '万円' : '-'}</strong></td>
        <td>${stats.median ? (stats.median / 10000).toFixed(1) + '万円' : '-'}</td>
        <td>${stats.min ? (stats.min / 10000).toFixed(1) : '-'} ～ ${stats.max ? (stats.max / 10000).toFixed(1) + '万円' : '-'}</td>
      </tr>`).join('')}
    </table>
    ` : ''}
  </div>

  <!-- 5. 地域分析 -->
  <div class="section">
    <h2>地域分析</h2>
    <div class="two-column">
      <div>
        <h3>地域ブロック別</h3>
        ${createHorizontalBarSvg(regionDistribution.slice(0, 8).map(([region, count]) => ({ label: region, value: count, color: '#26a69a' })), '', 450, 250)}
      </div>
      <div>
        <h3>都道府県TOP10</h3>
        <table>
          <tr><th>都道府県</th><th>件数</th><th>割合</th></tr>
          ${prefDistribution.map(([pref, count]) => `
          <tr>
            <td>${pref}</td>
            <td>${count}件</td>
            <td>${Math.round((count / (summary.totalCount || 1)) * 100)}%</td>
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
        <td>${Math.round((count / (summary.totalCount || 1)) * 100)}%</td>
      </tr>`).join('')}
    </table>
  </div>

  <!-- 6. 流入分析 -->
  ${inflowAnalysis && !inflowAnalysis.error && inflowAnalysis.targetCities ? `
  <div class="section">
    <h2>人材流入分析</h2>
    <p>検索対象エリアへの人材流入パターンを分析</p>
    ${inflowAnalysis.targetCities.map(tc => `
    <div class="highlight-box">
      <h3 style="margin-top:0;">${tc.cityName}</h3>
      <p>総求人数: <strong>${tc.totalJobs}件</strong> / 流入率: <strong>${tc.inflowRate}%</strong></p>
      ${tc.topSourcePrefectures && tc.topSourcePrefectures.length > 0 ? `
      <p>主な流入元: ${tc.topSourcePrefectures.slice(0, 5).map(p => p.prefecture + '(' + p.count + '件)').join(', ')}</p>
      ` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- 7. 企業ランキング -->
  <div class="section">
    <h2>企業分析</h2>
    <p>総企業数: <strong>${companyData.totalCompanies}社</strong></p>

    <div class="two-column">
      <div>
        <h3>求人数ランキングTOP15</h3>
        <table>
          <tr><th>#</th><th>企業名</th><th>求人数</th><th>平均給与</th></tr>
          ${(companyData.topByCount || []).slice(0, 15).map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${c.name}</td>
            <td>${c.jobCount}件</td>
            <td>${c.avgSalaryMan ? c.avgSalaryMan + '万円' : '-'}</td>
          </tr>`).join('')}
        </table>
      </div>
      <div>
        <h3>平均給与ランキングTOP15</h3>
        <table>
          <tr><th>#</th><th>企業名</th><th>平均給与</th><th>求人数</th></tr>
          ${(companyData.topBySalary || []).slice(0, 15).map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${c.name}</td>
            <td><strong>${c.avgSalaryMan}万円</strong></td>
            <td>${c.jobCount}件</td>
          </tr>`).join('')}
        </table>
      </div>
    </div>
  </div>

  <!-- 8. タグ分析 -->
  <div class="section">
    <h2>タグ分析</h2>
    <div class="two-column">
      <div>
        <h3>人気タグTOP20</h3>
        ${createHorizontalBarSvg((tagData.topTags || []).slice(0, 15).map(t => ({ label: t.tag, value: t.count, color: '#7e57c2' })), '', 450, 400)}
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

  <!-- 9. タグと給与の相関 -->
  <div class="section">
    <h2>💡 タグと給与の相関分析</h2>
    <p>全体平均月給: <strong>${tagSalaryData.overallAvgMan || '-'}万円</strong></p>

    <h3>高給与タグTOP10</h3>
    <table>
      <tr><th>タグ</th><th>件数</th><th>平均給与</th><th>全体比</th></tr>
      ${(tagSalaryData.tagCorrelations || []).slice(0, 10).map(t => `
      <tr>
        <td>${t.tag}</td>
        <td>${t.count}件</td>
        <td><strong>${t.avgSalaryMan}万円</strong></td>
        <td class="${t.diffFromAvg >= 0 ? 'positive' : 'negative'}">${t.diffFromAvg >= 0 ? '+' : ''}${t.diffFromAvgMan}万円 (${t.diffFromAvg >= 0 ? '+' : ''}${t.diffPercent}%)</td>
      </tr>`).join('')}
    </table>

    ${tagSalaryData.combinations && tagSalaryData.combinations.length > 0 ? `
    <h3>🔗 高給与タグ組み合わせTOP10</h3>
    <table>
      <tr><th>組み合わせ</th><th>件数</th><th>平均給与</th><th>全体比</th></tr>
      ${tagSalaryData.combinations.slice(0, 10).map(c => `
      <tr>
        <td>${c.combination}</td>
        <td>${c.count}件</td>
        <td><strong>${c.avgSalaryMan}万円</strong></td>
        <td class="${c.diffFromAvg >= 0 ? 'positive' : 'negative'}">${c.diffFromAvg >= 0 ? '+' : ''}${c.diffFromAvgMan}万円</td>
      </tr>`).join('')}
    </table>
    ` : ''}
  </div>

  <!-- 10. 求職者視点分析 -->
  ${jobSeekerData ? `
  <div class="section">
    <h2>10. 求職者視点分析（参考）</h2>
    <p>求職者が求人一覧を見たときの認知・心理パターンを分析（※サンプル数が限られるため参考値）</p>

    ${jobSeekerData.salaryRangePerception ? `
    <div class="highlight-box">
      <h3 style="margin-top:0;">給与レンジの心理的解釈</h3>
      <p>求職者が給与レンジを見たときの心理的な解釈パターン</p>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${(jobSeekerData.salaryRangePerception.conservativeEstimate || jobSeekerData.salaryRangePerception.avgLower) ? ((jobSeekerData.salaryRangePerception.conservativeEstimate || jobSeekerData.salaryRangePerception.avgLower) / 10000).toFixed(1) + '万円' : '-'}</div>
          <div class="stat-label">控えめ予測（下限の平均）</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${(jobSeekerData.salaryRangePerception.optimisticEstimate || jobSeekerData.salaryRangePerception.avgUpper) ? ((jobSeekerData.salaryRangePerception.optimisticEstimate || jobSeekerData.salaryRangePerception.avgUpper) / 10000).toFixed(1) + '万円' : '-'}</div>
          <div class="stat-label">楽観的予測（上限の平均）</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${(jobSeekerData.salaryRangePerception.psychologicalMidpoint || jobSeekerData.salaryRangePerception.expectedValue) ? ((jobSeekerData.salaryRangePerception.psychologicalMidpoint || jobSeekerData.salaryRangePerception.expectedValue) / 10000).toFixed(1) + '万円' : '-'}</div>
          <div class="stat-label">心理的中点</div>
        </div>
      </div>
      <p style="margin-top:10px;font-size:12px;color:#666;">
        ${jobSeekerData.salaryRangePerception.interpretation || ''}
      </p>
      ${jobSeekerData.salaryRangePerception.rangeSpreadAnalysis ? `
      <table style="margin-top:10px;">
        <tr><th>レンジタイプ</th><th>件数</th><th>割合</th></tr>
        ${Object.entries(jobSeekerData.salaryRangePerception.rangeSpreadAnalysis).map(([type, data]) => `
        <tr>
          <td>${type}</td>
          <td>${data.count}件</td>
          <td>${data.percent}%</td>
        </tr>`).join('')}
      </table>
      ` : ''}
    </div>
    ` : ''}

    ${jobSeekerData.newListingsAnalysis ? `
    <div class="highlight-box" style="background:#fff3e0;border-left-color:#ff9800;">
      <h3 style="margin-top:0;">新着求人の特徴</h3>
      <p>「新着」バッジが付いた求人と既存求人の比較分析</p>
      <div class="two-column">
        <div>
          <p><strong>新着求人</strong></p>
          <ul style="margin:0;padding-left:20px;">
            <li>件数: ${jobSeekerData.newListingsAnalysis.newListings?.count || 0}件 (${jobSeekerData.newListingsAnalysis.newListings?.percent || 0}%)</li>
            <li>平均月給: ${jobSeekerData.newListingsAnalysis.newListings?.avgSalaryMan || '-'}万円</li>
          </ul>
        </div>
        <div>
          <p><strong>既存求人</strong></p>
          <ul style="margin:0;padding-left:20px;">
            <li>件数: ${jobSeekerData.newListingsAnalysis.existingListings?.count || 0}件 (${jobSeekerData.newListingsAnalysis.existingListings?.percent || 0}%)</li>
            <li>平均月給: ${jobSeekerData.newListingsAnalysis.existingListings?.avgSalaryMan || '-'}万円</li>
          </ul>
        </div>
      </div>
      ${jobSeekerData.newListingsAnalysis.salaryDifference ? `
      <p style="margin-top:10px;" class="${jobSeekerData.newListingsAnalysis.salaryDifference >= 0 ? 'positive' : 'negative'}">
        給与差: ${jobSeekerData.newListingsAnalysis.salaryDifference >= 0 ? '+' : ''}${(jobSeekerData.newListingsAnalysis.salaryDifference / 10000).toFixed(1)}万円
      </p>
      ` : ''}
      <p style="font-size:12px;color:#666;">${jobSeekerData.newListingsAnalysis.interpretation || ''}</p>
    </div>
    ` : ''}

    ${jobSeekerData.inexperiencedTagAnalysis && jobSeekerData.inexperiencedTagAnalysis.hasData ? `
    <div class="highlight-box" style="background:#e8f5e9;border-left-color:#4caf50;">
      <h3 style="margin-top:0;">未経験可 vs 経験者向け 給与比較</h3>
      <p>「未経験可」タグの有無による給与の違い（下限・上限別）</p>
      <table style="width:100%;margin-top:12px;">
        <tr>
          <th style="text-align:left;"></th>
          <th style="text-align:center;background:#e3f2fd;color:#1565c0;">未経験可</th>
          <th style="text-align:center;background:#fff3e0;color:#e65100;">経験者向け</th>
          <th style="text-align:center;">差額</th>
        </tr>
        <tr>
          <td>件数</td>
          <td style="text-align:center;">${jobSeekerData.inexperiencedTagAnalysis.withInexperienced?.count || 0}件</td>
          <td style="text-align:center;">${jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced?.count || 0}件</td>
          <td style="text-align:center;">-</td>
        </tr>
        ${jobSeekerData.inexperiencedTagAnalysis.withInexperienced?.minSalary && jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced?.minSalary ? `
        <tr style="background:#fafafa;">
          <td colspan="4" style="font-weight:600;color:#666;font-size:11px;padding:8px;">下限給与（月給換算）</td>
        </tr>
        <tr>
          <td style="padding-left:15px;">平均</td>
          <td style="text-align:center;"><strong>${jobSeekerData.inexperiencedTagAnalysis.withInexperienced.minSalary.meanMan}万円</strong></td>
          <td style="text-align:center;"><strong>${jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced.minSalary.meanMan}万円</strong></td>
          <td style="text-align:center;" class="${(jobSeekerData.inexperiencedTagAnalysis.difference?.minMan || 0) >= 0 ? 'positive' : 'negative'}">
            ${(jobSeekerData.inexperiencedTagAnalysis.difference?.minMan || 0) >= 0 ? '+' : ''}${jobSeekerData.inexperiencedTagAnalysis.difference?.minMan || 0}万円
          </td>
        </tr>
        <tr>
          <td style="padding-left:15px;">中央値</td>
          <td style="text-align:center;">${jobSeekerData.inexperiencedTagAnalysis.withInexperienced.minSalary.medianMan}万円</td>
          <td style="text-align:center;">${jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced.minSalary.medianMan}万円</td>
          <td style="text-align:center;">-</td>
        </tr>
        ` : ''}
        ${jobSeekerData.inexperiencedTagAnalysis.withInexperienced?.maxSalary && jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced?.maxSalary ? `
        <tr style="background:#fafafa;">
          <td colspan="4" style="font-weight:600;color:#666;font-size:11px;padding:8px;">上限給与（月給換算）</td>
        </tr>
        <tr>
          <td style="padding-left:15px;">平均</td>
          <td style="text-align:center;"><strong>${jobSeekerData.inexperiencedTagAnalysis.withInexperienced.maxSalary.meanMan}万円</strong></td>
          <td style="text-align:center;"><strong>${jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced.maxSalary.meanMan}万円</strong></td>
          <td style="text-align:center;" class="${(jobSeekerData.inexperiencedTagAnalysis.difference?.maxMan || 0) >= 0 ? 'positive' : 'negative'}">
            ${(jobSeekerData.inexperiencedTagAnalysis.difference?.maxMan || 0) >= 0 ? '+' : ''}${jobSeekerData.inexperiencedTagAnalysis.difference?.maxMan || 0}万円
          </td>
        </tr>
        <tr>
          <td style="padding-left:15px;">中央値</td>
          <td style="text-align:center;">${jobSeekerData.inexperiencedTagAnalysis.withInexperienced.maxSalary.medianMan}万円</td>
          <td style="text-align:center;">${jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced.maxSalary.medianMan}万円</td>
          <td style="text-align:center;">-</td>
        </tr>
        ` : ''}
      </table>
      <p style="font-size:12px;color:#666;margin-top:10px;">${jobSeekerData.inexperiencedTagAnalysis.interpretation || ''}</p>
    </div>
    ` : ''}

    ${jobSeekerData.implicitMarketRate ? `
    <div class="highlight-box" style="background:#e3f2fd;border-left-color:#2196f3;">
      <h3 style="margin-top:0;">暗黙の相場観</h3>
      <p>求職者が一覧を見て形成する「相場感」の分析</p>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${jobSeekerData.implicitMarketRate.mode?.range || (jobSeekerData.implicitMarketRate.implicitRate?.modeMan ? jobSeekerData.implicitMarketRate.implicitRate.modeMan + '万円台' : '-')}</div>
          <div class="stat-label">最頻値帯（体感相場）</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${jobSeekerData.implicitMarketRate.mode?.count || '-'}件</div>
          <div class="stat-label">最頻値帯の求人数</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${(jobSeekerData.implicitMarketRate.median || jobSeekerData.implicitMarketRate.implicitRate?.median) ? ((jobSeekerData.implicitMarketRate.median || jobSeekerData.implicitMarketRate.implicitRate?.median) / 10000).toFixed(1) + '万円' : '-'}</div>
          <div class="stat-label">中央値</div>
        </div>
      </div>
      ${jobSeekerData.implicitMarketRate.topRanges && jobSeekerData.implicitMarketRate.topRanges.length > 0 ? `
      <h4 style="font-size:13px;margin-top:15px;">給与帯分布TOP5</h4>
      <table>
        <tr><th>給与帯</th><th>件数</th><th>割合</th></tr>
        ${jobSeekerData.implicitMarketRate.topRanges.slice(0, 5).map(r => `
        <tr>
          <td>${r.range}</td>
          <td>${r.count}件</td>
          <td>${r.percent}%</td>
        </tr>`).join('')}
      </table>
      ` : ''}
      <p style="font-size:12px;color:#666;margin-top:10px;">${jobSeekerData.implicitMarketRate.interpretation || ''}</p>
    </div>
    ` : ''}

  </div>
  ` : ''}

  <!-- 11. 年間休日分析 -->
  ${annualHolidaysData && annualHolidaysData.hasData ? `
  <div class="section">
    <h2>📅 年間休日分析</h2>
    <p>有効データ: <strong>${annualHolidaysData.validCount || 0}件</strong>（全${annualHolidaysData.totalCount || 0}件中）</p>

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${annualHolidaysData.stats?.mean || '-'}日</div>
        <div class="stat-label">平均年間休日</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${annualHolidaysData.stats?.median || '-'}日</div>
        <div class="stat-label">中央値</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${annualHolidaysData.stats?.min || '-'}〜${annualHolidaysData.stats?.max || '-'}日</div>
        <div class="stat-label">範囲</div>
      </div>
    </div>

    ${annualHolidaysData.categoryDistribution ? `
    <h3>休日カテゴリ別分布</h3>
    <table>
      <tr><th>カテゴリ</th><th>件数</th><th>割合</th></tr>
      ${Object.entries(annualHolidaysData.categoryDistribution).map(function(entry) {
        var cat = entry[0], count = entry[1];
        var pct = annualHolidaysData.validCount > 0 ? Math.round(count / annualHolidaysData.validCount * 100) : 0;
        return '<tr><td>' + cat + '</td><td>' + count + '件</td><td>' + pct + '%</td></tr>';
      }).join('')}
    </table>
    ` : ''}

    ${annualHolidaysData.salaryCorrelation ? `
    <h3>📊 給与帯別 平均年間休日（給与×休日 相関分析）</h3>
    <p style="font-size:12px;color:#666;">給与が高い求人ほど年間休日が多い傾向があるかを分析</p>
    ${(function() {
      var corr = annualHolidaysData.salaryCorrelation;
      var sortedEntries = Object.entries(corr)
        .filter(function(e) { return e[1].count >= 3; })  // 3件以上のみ
        .sort(function(a, b) { return a[1].salaryBin - b[1].salaryBin; })
        .slice(0, 15);
      if (sortedEntries.length === 0) return '<p>データ不足</p>';
      var labels = sortedEntries.map(function(e) { return e[0]; });
      var values = sortedEntries.map(function(e) { return e[1].mean; });
      var maxVal = Math.max.apply(null, values);
      var minVal = Math.min.apply(null, values);
      var barHeight = 22;
      var height = sortedEntries.length * (barHeight + 5) + 60;
      var width = 700;

      var svg = '<svg width="' + width + '" height="' + height + '" style="background:#f0f7ff;border-radius:8px;">';
      svg += '<text x="' + (width/2) + '" y="20" text-anchor="middle" font-size="13" font-weight="bold">給与帯別 平均年間休日</text>';

      sortedEntries.forEach(function(entry, i) {
        var label = entry[0];
        var data = entry[1];
        var barWidth = ((data.mean - minVal + 10) / (maxVal - minVal + 20)) * (width - 200);
        var y = 40 + i * (barHeight + 5);
        var color = data.mean >= 120 ? '#2ecc71' : (data.mean >= 110 ? '#f1c40f' : '#e74c3c');

        svg += '<text x="70" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-size="11">' + label + '</text>';
        svg += '<rect x="75" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + color + '" rx="3"/>';
        svg += '<text x="' + (80 + barWidth + 5) + '" y="' + (y + barHeight/2 + 4) + '" font-size="10">' + data.mean + '日 (' + data.count + '件)</text>';
      });

      svg += '</svg>';
      return '<div class="chart-container">' + svg + '</div>';
    })()}
    <p style="font-size:11px;color:#888;margin-top:8px;">
      ※ 緑: 120日以上 / 黄: 110-119日 / 赤: 110日未満 / 3件以上のデータがある給与帯のみ表示
    </p>
    ` : ''}
  </div>
  ` : ''}

  <!-- 12. 給与詳細分布（ビニング） -->
  ${salaryBinning && (salaryBinning.monthly?.labels?.length > 0 || salaryBinning.hourly?.labels?.length > 0) ? `
  <div class="section">
    <h2>💹 給与詳細分布</h2>

    ${salaryBinning.monthly?.labels?.length > 0 ? `
    <h3>月給分布（5,000円刻み）</h3>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${salaryBinning.monthly.stats?.mean || '-'}</div>
        <div class="stat-label">平均</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${salaryBinning.monthly.stats?.median || '-'}</div>
        <div class="stat-label">中央値</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${salaryBinning.monthly.stats?.modeLabel || '-'}</div>
        <div class="stat-label">最頻値帯</div>
      </div>
    </div>
    <p style="font-size:12px;color:#666;">有効データ: ${salaryBinning.monthly.stats?.count || 0}件</p>
    ${createBarChartSvg(salaryBinning.monthly.labels.slice(0, 30), salaryBinning.monthly.values.slice(0, 30), '月給分布（5,000円刻み）', '#3498db', 900, 250)}
    ` : ''}

    ${salaryBinning.hourly?.labels?.length > 0 ? `
    <h3>時給分布（50円刻み）</h3>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${salaryBinning.hourly.stats?.mean || '-'}</div>
        <div class="stat-label">平均</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${salaryBinning.hourly.stats?.median || '-'}</div>
        <div class="stat-label">中央値</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${salaryBinning.hourly.stats?.modeLabel || '-'}</div>
        <div class="stat-label">最頻値帯</div>
      </div>
    </div>
    <p style="font-size:12px;color:#666;">有効データ: ${salaryBinning.hourly.stats?.count || 0}件</p>
    ${createBarChartSvg(salaryBinning.hourly.labels.slice(0, 30), salaryBinning.hourly.values.slice(0, 30), '時給分布（50円刻み）', '#e74c3c', 900, 250)}
    ` : ''}
  </div>
  ` : ''}

  <!-- ユーザーメモ欄（レポート末尾、印刷時は空なら非表示） -->
  <div class="user-note" id="user-memo-area" style="margin-top: 30px;">
    <div class="user-note-label">メモ・コメント欄</div>
    <div class="editable memo-content" contenteditable="true" style="min-height: 60px; padding: 10px; background: #fff;"></div>
  </div>

  <div class="footer">
    <p>このレポートは求人データ分析ダッシュボードから自動生成されました</p>
    <p>データ件数: ${summary.totalCount || 0}件 / 有効給与データ: ${salaryData.validCount || 0}件 / 企業数: ${companyData.totalCompanies || 0}社</p>
    <p>事前計算時刻: ${dashboardData._precomputedAt ? new Date(dashboardData._precomputedAt).toLocaleString('ja-JP') : '-'}</p>

  <script>
  (function() {
    var editableSelectors = 'h1, h2, h3, p, td, th, li, .stat-value, .stat-label, .value, .label, .summary-card, .highlight-box, .target-card';
    document.querySelectorAll(editableSelectors).forEach(function(el) {
      if (el.closest('svg') || el.classList.contains('edit-guide')) return;
      el.setAttribute('contenteditable', 'true');
      el.classList.add('editable');
    });
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        var blob = new Blob([document.documentElement.outerHTML], {type: 'text/html'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'report_edited.html';
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });
    document.querySelectorAll('.editable').forEach(function(el) {
      el.addEventListener('input', function() {
        this.style.borderBottom = '2px solid #ffc107';
      });
    });
  })();
  </script>

  </div>
</body>
</html>`;

  return html;
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
    console.log('Step 6: DataLayer.forceIncrementalUpdate(true, true) 実行...');
    const updateResult = DataLayer.forceIncrementalUpdate(true, true);  // skipParsedDataSave=true
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
 * 🔍 事前計算データの診断
 * GASエディタで実行して状態を確認
 */
function diagnosePrecomputedData() {
  console.log('═'.repeat(60));
  console.log('📊 事前計算データ診断');
  console.log('═'.repeat(60));

  // 1. 事前計算データの存在確認
  console.log('\n[1] 事前計算データの存在確認:');
  const hasPrecomputed = DataPersistence.hasPrecomputedData();
  console.log('  hasPrecomputedData: ' + hasPrecomputed);

  // 2. ダッシュボードデータの読み込み確認
  console.log('\n[2] ダッシュボードデータ:');
  const startDash = Date.now();
  const dashData = DataPersistence.loadPrecomputedDashboard();
  const dashTime = Date.now() - startDash;
  if (dashData) {
    console.log('  読み込み時間: ' + dashTime + 'ms');
    console.log('  totalCount: ' + (dashData.summary ? dashData.summary.totalCount : 'N/A'));
    console.log('  _precomputedAt: ' + (dashData._precomputedAt ? new Date(dashData._precomputedAt).toISOString() : 'N/A'));
    console.log('  JSONサイズ: ' + Math.round(JSON.stringify(dashData).length / 1024) + 'KB');
  } else {
    console.log('  ❌ データなし');
  }

  // 3. 地図データの読み込み確認
  console.log('\n[3] 地図データ:');
  const startMap = Date.now();
  const mapData = DataPersistence.loadPrecomputedMap();
  const mapTime = Date.now() - startMap;
  if (mapData) {
    console.log('  読み込み時間: ' + mapTime + 'ms');
    console.log('  targets: ' + (mapData.targets ? mapData.targets.length : 'N/A') + '件');
    console.log('  cities: ' + (mapData.cities ? mapData.cities.length : 'N/A') + '件');
    console.log('  _precomputedAt: ' + (mapData._precomputedAt ? new Date(mapData._precomputedAt).toISOString() : 'N/A'));
    console.log('  JSONサイズ: ' + Math.round(JSON.stringify(mapData).length / 1024) + 'KB');
  } else {
    console.log('  ❌ データなし');
  }

  // 4. 分析データの読み込み確認
  console.log('\n[4] 分析データ:');
  const startAnalysis = Date.now();
  const analysisData = DataPersistence.loadPrecomputedAnalysis();
  const analysisTime = Date.now() - startAnalysis;
  if (analysisData) {
    console.log('  読み込み時間: ' + analysisTime + 'ms');
    console.log('  企業数: ' + (analysisData.companyAnalysis ? analysisData.companyAnalysis.totalCompanies : 'N/A') + '件');
    console.log('  タグ相関: ' + (analysisData.tagSalaryAnalysis ? analysisData.tagSalaryAnalysis.tagCorrelations.length : 'N/A') + '件');
    console.log('  _precomputedAt: ' + (analysisData._precomputedAt ? new Date(analysisData._precomputedAt).toISOString() : 'N/A'));
    console.log('  JSONサイズ: ' + Math.round(JSON.stringify(analysisData).length / 1024) + 'KB');
  } else {
    console.log('  ❌ データなし');
  }

  // 5. PropertiesServiceの状態（★inc_*も含む完全診断）
  console.log('\n[5] PropertiesService状態:');
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  const allKeys = Object.keys(allProps);

  // 総使用量を計算
  let totalSize = 0;
  allKeys.forEach(key => {
    totalSize += allProps[key] ? allProps[key].length : 0;
  });
  console.log('  総プロパティ数: ' + allKeys.length);
  console.log('  総使用量: ' + Math.round(totalSize / 1024) + 'KB / 500KB (上限)');
  console.log('  使用率: ' + Math.round(totalSize / 500000 * 100) + '%');

  // inc_* キー
  const incKeys = allKeys.filter(k => k.startsWith('inc_'));
  let incSize = 0;
  incKeys.forEach(k => { incSize += allProps[k] ? allProps[k].length : 0; });
  console.log('  inc_* キー数: ' + incKeys.length + ' (' + Math.round(incSize / 1024) + 'KB)');
  if (incKeys.length > 0 && incKeys.length <= 10) {
    incKeys.forEach(k => console.log('    - ' + k + ': ' + Math.round((allProps[k] || '').length / 1024) + 'KB'));
  } else if (incKeys.length > 10) {
    incKeys.slice(0, 5).forEach(k => console.log('    - ' + k + ': ' + Math.round((allProps[k] || '').length / 1024) + 'KB'));
    console.log('    ... 他 ' + (incKeys.length - 5) + ' キー');
  }

  // precomputed_* キー
  const precomputedKeys = allKeys.filter(k => k.startsWith('precomputed_'));
  let precomputedSize = 0;
  precomputedKeys.forEach(k => { precomputedSize += allProps[k] ? allProps[k].length : 0; });
  console.log('  precomputed_* キー数: ' + precomputedKeys.length + ' (' + Math.round(precomputedSize / 1024) + 'KB)');
  precomputedKeys.forEach(key => {
    const size = allProps[key] ? allProps[key].length : 0;
    console.log('    ' + key + ': ' + Math.round(size / 1024) + 'KB');
  });

  // その他のキー
  const otherKeys = allKeys.filter(k => !k.startsWith('inc_') && !k.startsWith('precomputed_'));
  let otherSize = 0;
  otherKeys.forEach(k => { otherSize += allProps[k] ? allProps[k].length : 0; });
  console.log('  その他キー数: ' + otherKeys.length + ' (' + Math.round(otherSize / 1024) + 'KB)');

  // 警告
  if (totalSize > 400000) {
    console.log('  ⚠️ ストレージ使用率が80%超！nuclearStorageClear()を実行してください');
  }

  // 6. getDashboardData()の実行時間
  console.log('\n[6] getDashboardData()実行テスト:');
  const startGet = Date.now();
  const result = getDashboardData();
  const getTime = Date.now() - startGet;
  console.log('  実行時間: ' + getTime + 'ms');
  console.log('  success: ' + result.success);
  console.log('  totalCount: ' + (result.data && result.data.summary ? result.data.summary.totalCount : 'N/A'));

  console.log('\n' + '═'.repeat(60));
  console.log('診断完了');
  console.log('═'.repeat(60));

  return {
    hasPrecomputed: hasPrecomputed,
    dashboardLoadTime: dashTime,
    mapLoadTime: mapTime,
    analysisLoadTime: analysisTime,
    getDashboardDataTime: getTime
  };
}

/**
 * 🔧 事前計算データを強制再生成
 * GASエディタで実行
 */
function forceRegeneratePrecomputedData() {
  console.log('═'.repeat(60));
  console.log('🔧 事前計算データ強制再生成');
  console.log('═'.repeat(60));

  // Step 1: 全データを徹底クリア（inc_* と precomputed_* 両方）
  console.log('Step 1: 全データクリア中...');
  const clearResult = DataPersistence.clearAll(false);
  console.log('  DataPersistenceクリア: ' + JSON.stringify(clearResult));

  // クリア失敗時は強制クリアを実行
  if (!clearResult.success || clearResult.remaining > 0) {
    console.warn('  ⚠️ クリア不完全 - 強制クリア実行中...');
    forceNuclearClear();
  }

  DataLayer.clearAllCache(true);
  clearAggregationCache();

  // クリア検証
  const clearVerified = DataPersistence.verifyClearAll();
  if (!clearVerified) {
    console.error('Step 1: ❌ クリア検証失敗');
    throw new Error('古いデータが残っています。手動でclearAllScriptProperties()を実行してください。');
  }
  console.log('Step 1: ✅ クリア完了＆検証成功');

  // Step 2: データを再構築（軽量モード：inc_parsed_dataを保存しない）
  console.log('Step 2: データ再構築中（軽量モード）...');
  const updateResult = DataLayer.forceIncrementalUpdate(true, true);  // skipParsedDataSave=true
  console.log('Step 2: 完了 - モード:' + updateResult.mode + ', 件数:' + updateResult.stats.total);

  // Step 3: 事前計算データを生成
  console.log('Step 3: 事前計算データ生成中...');
  const result = precomputeAllData();
  console.log('Step 3: 結果 = ' + JSON.stringify(result));

  // Step 4: 確認
  console.log('Step 4: 診断実行...');
  diagnosePrecomputedData();

  return result;
}

/**
 * 🧹 PropertiesServiceを完全クリア
 * クォータ超過エラーが解消しない場合に使用
 */
function clearAllScriptProperties() {
  console.log('═'.repeat(60));
  console.log('🧹 PropertiesService完全クリア');
  console.log('═'.repeat(60));

  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  const keys = Object.keys(allProps);

  console.log('クリア前のプロパティ数: ' + keys.length);

  // inc_ と precomputed_ で始まるプロパティを削除
  let deletedCount = 0;
  keys.forEach(key => {
    if (key.startsWith('inc_') || key.startsWith('precomputed_')) {
      props.deleteProperty(key);
      deletedCount++;
      console.log('  削除: ' + key);
    }
  });

  console.log('削除したプロパティ数: ' + deletedCount);

  // 確認
  const remaining = Object.keys(props.getProperties());
  console.log('残りのプロパティ数: ' + remaining.length);
  console.log('═'.repeat(60));

  return { deleted: deletedCount, remaining: remaining.length };
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

/**
 * 🔍 ストレージ使用量詳細診断
 * プロパティの保存容量上限エラーが発生した場合に実行
 * GASエディタで実行: diagnoseStorageUsage()
 */
function diagnoseStorageUsage() {
  console.log('═'.repeat(60));
  console.log('🔍 ストレージ使用量詳細診断');
  console.log('═'.repeat(60));

  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  const keys = Object.keys(allProps);

  console.log('\n📊 全体統計:');
  console.log('  プロパティ総数: ' + keys.length);

  let totalSize = 0;
  const categories = {
    'inc_parsed_data': { count: 0, size: 0, keys: [] },
    'inc_hash_map': { count: 0, size: 0, keys: [] },
    'inc_metadata': { count: 0, size: 0, keys: [] },
    'precomputed_dashboard': { count: 0, size: 0, keys: [] },
    'precomputed_map': { count: 0, size: 0, keys: [] },
    'precomputed_analysis': { count: 0, size: 0, keys: [] },
    'other': { count: 0, size: 0, keys: [] }
  };

  keys.forEach(key => {
    const size = allProps[key] ? allProps[key].length : 0;
    totalSize += size;

    let category = 'other';
    if (key.startsWith('inc_parsed_data')) category = 'inc_parsed_data';
    else if (key.startsWith('inc_hash_map')) category = 'inc_hash_map';
    else if (key.startsWith('inc_metadata')) category = 'inc_metadata';
    else if (key.startsWith('precomputed_dashboard')) category = 'precomputed_dashboard';
    else if (key.startsWith('precomputed_map')) category = 'precomputed_map';
    else if (key.startsWith('precomputed_analysis')) category = 'precomputed_analysis';

    categories[category].count++;
    categories[category].size += size;
    categories[category].keys.push(key);
  });

  console.log('  総使用量: ' + Math.round(totalSize / 1024) + 'KB / 500KB (上限)');
  console.log('  使用率: ' + Math.round(totalSize / 500000 * 100) + '%');

  console.log('\n📁 カテゴリ別使用量:');
  Object.keys(categories).forEach(cat => {
    const c = categories[cat];
    if (c.count > 0) {
      console.log('  ' + cat + ':');
      console.log('    キー数: ' + c.count);
      console.log('    サイズ: ' + Math.round(c.size / 1024) + 'KB');
      if (c.keys.length <= 5) {
        c.keys.forEach(k => console.log('      - ' + k));
      } else {
        c.keys.slice(0, 3).forEach(k => console.log('      - ' + k));
        console.log('      ... 他 ' + (c.keys.length - 3) + ' キー');
      }
    }
  });

  // 警告判定
  console.log('\n⚠️ 診断結果:');
  if (totalSize > 450000) {
    console.log('  🔴 危険: ストレージ使用量が90%超');
    console.log('  → nuclearStorageClear() を実行してください');
  } else if (totalSize > 400000) {
    console.log('  🟡 警告: ストレージ使用量が80%超');
    console.log('  → clearAllScriptProperties() を実行してください');
  } else {
    console.log('  🟢 正常: ストレージに余裕があります');
  }

  console.log('═'.repeat(60));

  return {
    totalKeys: keys.length,
    totalSizeKB: Math.round(totalSize / 1024),
    usagePercent: Math.round(totalSize / 500000 * 100),
    categories: categories
  };
}

/**
 * ☢️ 核オプション：ストレージ完全クリア
 * クォータエラーが解消しない場合の最終手段
 * GASエディタで実行: nuclearStorageClear()
 *
 * 実行手順:
 * 1. GASエディタで nuclearStorageClear() を実行
 * 2. 完了後、CSVを再インポート
 */
function nuclearStorageClear() {
  console.log('═'.repeat(60));
  console.log('☢️ 核オプション：ストレージ完全クリア');
  console.log('═'.repeat(60));

  const props = PropertiesService.getScriptProperties();

  // Step 1: 現在の状態を記録
  const before = Object.keys(props.getProperties());
  const targetKeys = before.filter(k =>
    k.startsWith('inc_') || k.startsWith('precomputed_')
  );
  console.log('\nStep 1: クリア前の状態');
  console.log('  総プロパティ数: ' + before.length);
  console.log('  削除対象: ' + targetKeys.length + ' キー');

  // Step 2: 全対象プロパティを削除（3回繰り返し）
  console.log('\nStep 2: 削除実行（3回繰り返し）');
  let totalDeleted = 0;

  for (let round = 1; round <= 3; round++) {
    const currentKeys = Object.keys(props.getProperties()).filter(k =>
      k.startsWith('inc_') || k.startsWith('precomputed_')
    );

    if (currentKeys.length === 0) {
      console.log('  Round ' + round + ': 削除対象なし（完了）');
      break;
    }

    console.log('  Round ' + round + ': ' + currentKeys.length + ' キーを削除中...');

    currentKeys.forEach(key => {
      try {
        props.deleteProperty(key);
        totalDeleted++;
      } catch (e) {
        console.error('    削除失敗: ' + key + ' - ' + e.message);
      }
    });

    // GASのPropertiesServiceは非同期なので少し待つ
    Utilities.sleep(200);
  }

  // Step 3: 確認
  console.log('\nStep 3: 確認');
  const after = Object.keys(props.getProperties());
  const remainingTargets = after.filter(k =>
    k.startsWith('inc_') || k.startsWith('precomputed_')
  );

  console.log('  削除完了: ' + totalDeleted + ' キー');
  console.log('  残プロパティ数: ' + after.length);
  console.log('  残対象キー: ' + remainingTargets.length);

  if (remainingTargets.length > 0) {
    console.log('  ⚠️ 残留キー:');
    remainingTargets.forEach(k => console.log('    - ' + k));
  }

  // Step 4: キャッシュもクリア
  console.log('\nStep 4: キャッシュクリア');
  try {
    CacheService.getScriptCache().removeAll(['dashboard_aggregation_1OaSTHobXnz23O3D98aFo6wFD08fDmjqn6YtI_lJv1Pk']);
    console.log('  ScriptCacheクリア完了');
  } catch (e) {
    console.log('  ScriptCacheクリアスキップ: ' + e.message);
  }

  // 結果
  console.log('\n' + '═'.repeat(60));
  if (remainingTargets.length === 0) {
    console.log('✅ ストレージクリア完了！');
    console.log('次のステップ: CSVを再インポートしてください');
  } else {
    console.log('⚠️ 一部残留あり - もう一度実行してください');
  }
  console.log('═'.repeat(60));

  return {
    success: remainingTargets.length === 0,
    deleted: totalDeleted,
    remaining: remainingTargets.length,
    remainingKeys: remainingTargets
  };
}
