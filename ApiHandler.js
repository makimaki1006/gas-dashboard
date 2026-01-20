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

    // Step 3: データを再構築（パース済みデータを保存する）
    console.log('Step 3: データ再構築（完全モード）...');
    const updateResult = DataLayer.forceIncrementalUpdate(true, false);  // 第2引数: skipParsedDataSave=false（必ず保存）
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
 * 給与データ診断（デバッグ用）
 * 給与カラムの検出状況と給与パース結果を確認
 */
function diagnoseSalaryData() {
  console.log('═'.repeat(60));
  console.log('給与データ診断');
  console.log('═'.repeat(60));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');

  if (!dataSheet) {
    console.log('データシートがありません');
    return;
  }

  const lastRow = dataSheet.getLastRow();
  if (lastRow <= 1) {
    console.log('データがありません');
    return;
  }

  // ヘッダー確認
  const headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
  console.log('\n[1] ヘッダー:');
  headers.forEach((h, i) => console.log('  ' + i + ': ' + h));

  // 給与カラム（7列目）のサンプルを確認
  console.log('\n[2] 給与カラム（7列目）サンプル（最初20件）:');
  const sampleSize = Math.min(20, lastRow - 1);
  const salaryCol = dataSheet.getRange(2, 7, sampleSize, 1).getValues();
  const salaryValues = salaryCol.map((r, i) => {
    const v = r[0] || '';
    return '  #' + (i+1) + ': [' + String(v).substring(0, 60) + ']';
  });
  salaryValues.forEach(v => console.log(v));

  // パース済みデータの給与情報を確認
  console.log('\n[3] パース済みデータの給与情報:');
  const parsedData = DataPersistence.loadParsedData();
  if (parsedData && parsedData.length > 0) {
    console.log('  総件数: ' + parsedData.length);

    // 給与タイプ別カウント
    const typeCounts = { monthly: 0, hourly: 0, daily: 0, annual: 0, unknown: 0, none: 0 };
    let withSalary = 0;
    let withUnified = 0;
    let withMinMax = 0;

    parsedData.forEach(d => {
      if (d.salaryParsed) {
        const type = d.salaryParsed.salaryType || 'unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        if (d.salaryParsed.minValue || d.salaryParsed.maxValue) withMinMax++;
        if (d.salaryParsed.unifiedMonthly) withUnified++;
        withSalary++;
      } else {
        typeCounts.none++;
      }
    });

    console.log('  給与パースあり: ' + withSalary);
    console.log('  minValue/maxValueあり: ' + withMinMax);
    console.log('  unifiedMonthlyあり: ' + withUnified);
    console.log('  タイプ別:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > 0) console.log('    ' + type + ': ' + count);
    });

    // サンプル表示
    console.log('\n  給与パースサンプル（最初10件）:');
    parsedData.slice(0, 10).forEach((d, i) => {
      const sp = d.salaryParsed || {};
      console.log('    #' + (i+1) + ': type=' + (sp.salaryType || 'なし') +
                  ', min=' + (sp.minValue || '-') +
                  ', max=' + (sp.maxValue || '-') +
                  ', unified=' + (sp.unifiedMonthly || '-') +
                  ', raw=[' + String(d.salary || '').substring(0, 30) + ']');
    });
  } else {
    console.log('  パース済みデータなし');
  }

  // 設定確認
  console.log('\n[4] 給与表示設定:');
  const props = PropertiesService.getScriptProperties();
  const salaryDisplayType = props.getProperty('salaryDisplayType');
  const dataSourceType = props.getProperty('dataSourceType');
  console.log('  salaryDisplayType: ' + (salaryDisplayType || 'なし'));
  console.log('  dataSourceType: ' + (dataSourceType || 'なし'));

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
  const regionSalaryAnalysis = dashboardData.regionSalaryAnalysis || { hasData: false };

  // 分析データ
  const companyData = analysisData?.companyAnalysis || { topByCount: [], topBySalary: [], totalCompanies: 0 };
  const tagSalaryData = analysisData?.tagSalaryAnalysis || { tagCorrelations: [], overallAvgMan: 0, combinations: [] };
  const jobSeekerData = analysisData?.jobSeekerAnalysis || null;

  // 地図データ
  const targets = mapData?.targets || [];
  const cities = mapData?.cities || [];
  const inflowAnalysis = mapData?.inflowAnalysis || {};

  const now = Utilities.formatDate(new Date(), 'JST', 'yyyy年MM月dd日 HH:mm');

  // 🔴 FIX: 時給モード判定
  const isHourly = summary.isHourly === true;
  const hourlyStats = salaryData.hourlyStats || {};

  // 給与統計の整形
  const formatSalary = (val) => val ? (val / 10000).toFixed(1) + '万円' : '-';
  const formatHourlySalary = (val) => val ? Math.round(val).toLocaleString() + '円' : '-';

  // 🔴 FIX: 汎用給与フォーマット（万円値を受け取り、時給/月給に応じてフォーマット）
  const formatReportSalary = (valMan) => {
    if (!valMan && valMan !== 0) return '-';
    if (isHourly) {
      const hourly = Math.round(valMan * 10000 / 160);
      return hourly.toLocaleString() + '円';
    }
    return valMan + '万円';
  };

  // 🔴 FIX: 円値を受け取り、時給/月給に応じてフォーマット
  const formatReportSalaryYen = (valYen) => {
    if (!valYen && valYen !== 0) return '-';
    if (isHourly) {
      const hourly = Math.round(valYen / 160);
      return hourly.toLocaleString() + '円';
    }
    return (valYen / 10000).toFixed(1) + '万円';
  };

  // 🔴 FIX: JobSeekerAnalysis用フォーマット（既に適切な単位で変換済みの値）
  const formatJobSeekerValue = (val, isManValue = false) => {
    if (!val && val !== 0) return '-';
    if (isHourly) {
      // 時給モード: 値はそのまま円表示
      return Math.round(val).toLocaleString() + '円';
    }
    // 月給モード: 万円値ならそのまま、円値なら万円換算
    if (isManValue) {
      return val + '万円';
    }
    return (val / 10000).toFixed(1) + '万円';
  };

  const salaryLabel = isHourly ? '時給' : '月給';
  const salaryUnit = isHourly ? '円' : '万円';
  const salaryConvLabel = isHourly ? '時給換算' : '月給換算';

  // 時給モード用の表示値
  const displayAvgSalary = isHourly ? formatHourlySalary(hourlyStats.avg) : formatSalary(summary.avgMonthlySalary);
  const displayMedianSalary = isHourly ? formatHourlySalary(hourlyStats.median) : formatSalary(summary.medianMonthlySalary);
  const displayMinSalary = isHourly ? formatHourlySalary(hourlyStats.min) : formatSalary(summary.minSalary);
  const displayMaxSalary = isHourly ? formatHourlySalary(hourlyStats.max) : formatSalary(summary.maxSalary);

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

  // SVG棒グラフ生成関数（動的幅計算対応）
  function createBarChartSvg(labels, values, title, color, width, height) {
    if (!labels || labels.length === 0) return '<p>データなし</p>';
    const maxVal = Math.max(...values, 1);
    const leftMargin = 40;
    const rightMargin = 20;
    const availableWidth = width - leftMargin - rightMargin;
    // バー幅を動的に計算（最小8px、隙間2px）
    const barWidth = Math.max(8, Math.floor(availableWidth / labels.length) - 2);
    // 必要な幅を計算し、足りない場合はSVG幅を調整
    const requiredWidth = leftMargin + labels.length * (barWidth + 2) + rightMargin;
    const actualWidth = Math.max(width, requiredWidth);
    const chartHeight = height - 60;

    let svg = '<svg width="' + actualWidth + '" height="' + height + '" style="background:#fafafa;border-radius:8px;max-width:100%;" viewBox="0 0 ' + actualWidth + ' ' + height + '" preserveAspectRatio="xMidYMid meet">';
    if (title) {
      svg += '<text x="' + (actualWidth/2) + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + title + '</text>';
    }

    labels.forEach((label, i) => {
      const barHeight = (values[i] / maxVal) * chartHeight;
      const x = leftMargin + i * (barWidth + 2);
      const y = height - 40 - barHeight;

      svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + color + '" rx="2"/>';
      if (values[i] > 0 && barWidth >= 12) {
        svg += '<text x="' + (x + barWidth/2) + '" y="' + (y - 3) + '" text-anchor="middle" font-size="9">' + values[i] + '</text>';
      }
      // ラベルは間引いて表示（バーが細い場合）
      if (barWidth >= 15 || i % Math.ceil(labels.length / 15) === 0) {
        svg += '<text x="' + (x + barWidth/2) + '" y="' + (height - 25) + '" text-anchor="middle" font-size="7" transform="rotate(-45 ' + (x + barWidth/2) + ' ' + (height - 25) + ')">' + label + '</text>';
      }
    });

    svg += '</svg>';
    return svg;
  }

  // SVG棒グラフ生成関数（統計ライン付き・動的幅計算対応）
  function createBarChartSvgWithStats(labels, values, title, color, width, height, stats, targetSalary, binSize) {
    if (!labels || labels.length === 0) return '<p>データなし</p>';
    const maxVal = Math.max(...values, 1);
    const chartStartX = 40;
    const rightMargin = 20;
    const availableWidth = width - chartStartX - rightMargin;
    // バー幅を動的に計算（最小8px、隙間2px）
    const barWidth = Math.max(8, Math.floor(availableWidth / labels.length) - 2);
    // 必要な幅を計算
    const requiredWidth = chartStartX + labels.length * (barWidth + 2) + rightMargin;
    const actualWidth = Math.max(width, requiredWidth);
    const chartHeight = height - 80;
    const chartEndY = height - 50;

    let svg = '<svg width="' + actualWidth + '" height="' + height + '" style="background:#fafafa;border-radius:8px;max-width:100%;" viewBox="0 0 ' + actualWidth + ' ' + height + '" preserveAspectRatio="xMidYMid meet">';
    svg += '<text x="' + (actualWidth/2) + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + title + '</text>';

    // 棒グラフ描画
    labels.forEach((label, i) => {
      const barHeight = (values[i] / maxVal) * chartHeight;
      const x = chartStartX + i * (barWidth + 2);
      const y = chartEndY - barHeight;

      svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + color + '" rx="2" opacity="0.7"/>';
      if (values[i] > 0 && values[i] >= maxVal * 0.1 && barWidth >= 12) {
        svg += '<text x="' + (x + barWidth/2) + '" y="' + (y - 2) + '" text-anchor="middle" font-size="8">' + values[i] + '</text>';
      }
      // ラベルは間引いて表示
      const labelInterval = barWidth >= 15 ? 2 : Math.ceil(labels.length / 12);
      if (i % labelInterval === 0) {
        svg += '<text x="' + (x + barWidth/2) + '" y="' + (chartEndY + 12) + '" text-anchor="middle" font-size="7" transform="rotate(-45 ' + (x + barWidth/2) + ' ' + (chartEndY + 12) + ')">' + label + '</text>';
      }
    });

    // ラベル値を数値配列に変換（ビン下限値）
    const labelValues = labels.map(l => {
      const num = parseFloat(l.replace(/[^0-9.]/g, ''));
      return binSize === 5000 ? num * 10000 : num; // 月給なら万円単位→円、時給ならそのまま
    });

    // 統計ライン描画ヘルパー
    function drawStatLine(value, lineColor, label) {
      if (value == null) return;
      // valueに最も近いラベルを見つける
      let idx = -1;
      for (let i = 0; i < labelValues.length; i++) {
        if (labelValues[i] >= value) { idx = i; break; }
      }
      if (idx === -1) idx = labelValues.length - 1;
      // 補間してx位置を計算
      let x;
      if (idx === 0 || labelValues[idx] === value) {
        x = chartStartX + idx * (barWidth + 2) + barWidth / 2;
      } else {
        const ratio = (value - labelValues[idx-1]) / (labelValues[idx] - labelValues[idx-1]);
        const x1 = chartStartX + (idx-1) * (barWidth + 2) + barWidth / 2;
        const x2 = chartStartX + idx * (barWidth + 2) + barWidth / 2;
        x = x1 + ratio * (x2 - x1);
      }
      // 垂直線を描画
      svg += '<line x1="' + x + '" y1="35" x2="' + x + '" y2="' + chartEndY + '" stroke="' + lineColor + '" stroke-width="2" stroke-dasharray="5,3"/>';
      // ラベル
      svg += '<text x="' + x + '" y="32" text-anchor="middle" font-size="9" fill="' + lineColor + '" font-weight="bold">' + label + '</text>';
    }

    // 統計ライン描画
    if (stats) {
      if (stats.meanRaw) drawStatLine(stats.meanRaw, '#e74c3c', '平均');
      if (stats.medianRaw) drawStatLine(stats.medianRaw, '#27ae60', '中央');
      if (stats.modeRaw) drawStatLine(stats.modeRaw, '#9b59b6', '最頻');
    }
    // 会社給与ライン
    if (targetSalary && targetSalary.combined) {
      if (targetSalary.combined.min) drawStatLine(targetSalary.combined.min, '#f39c12', '希望下限');
      if (targetSalary.combined.max) drawStatLine(targetSalary.combined.max, '#e67e22', '希望上限');
    }

    // 凡例（actualWidthを使用）
    svg += '<g transform="translate(' + (actualWidth - 250) + ', 5)">';
    svg += '<rect x="0" y="0" width="240" height="20" fill="white" fill-opacity="0.8" rx="3"/>';
    svg += '<line x1="5" y1="10" x2="20" y2="10" stroke="#e74c3c" stroke-width="2" stroke-dasharray="5,3"/><text x="25" y="13" font-size="8">平均</text>';
    svg += '<line x1="55" y1="10" x2="70" y2="10" stroke="#27ae60" stroke-width="2" stroke-dasharray="5,3"/><text x="75" y="13" font-size="8">中央値</text>';
    svg += '<line x1="110" y1="10" x2="125" y2="10" stroke="#9b59b6" stroke-width="2" stroke-dasharray="5,3"/><text x="130" y="13" font-size="8">最頻値</text>';
    svg += '<line x1="170" y1="10" x2="185" y2="10" stroke="#f39c12" stroke-width="2" stroke-dasharray="5,3"/><text x="190" y="13" font-size="8">希望給与</text>';
    svg += '</g>';

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
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-compact { margin-bottom: 10px; page-break-inside: avoid; }
    .section-continuation { margin-top: 0; page-break-before: avoid; }
    .chart-container { margin: 15px 0; text-align: center; }
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
            /* ===== A4縦ジャストフィット印刷CSS ===== */
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    @media print {
      /* 基本設定 */
      * { box-sizing: border-box !important; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 190mm !important;
        max-width: 190mm !important;
        font-size: 9pt !important;
        line-height: 1.3 !important;
        background: white !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* 非印刷要素 */
      .edit-guide, .user-note, .no-print, .footer { display: none !important; }

      /* セクション - ページを効率的に使用 */
      .section {
        page-break-inside: auto !important;
        break-inside: auto !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 0 2mm 0 !important;
      }
      .section-compact {
        page-break-inside: auto !important;
        break-inside: auto !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 0 1mm 0 !important;
      }
      .section-continuation {
        margin-top: 0 !important;
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
      /* 強制改ページが必要なセクションのみ */
      .section.page-start {
        page-break-before: always !important;
        break-before: page !important;
      }
      .section:last-of-type {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      /* タイトル */
      h1 {
        font-size: 18pt !important;
        text-align: center !important;
        margin: 0 0 3mm 0 !important;
        padding-bottom: 2mm !important;
        border-bottom: 1.5pt solid #1a73e8 !important;
      }
      h1 + p {
        text-align: center !important;
        font-size: 9pt !important;
        margin: 0 0 5mm 0 !important;
      }

      /* セクションタイトル */
      h2 {
        font-size: 13pt !important;
        margin: 0 0 3mm 0 !important;
        padding: 3pt 8pt !important;
        background: #1a73e8 !important;
        color: white !important;
        border-radius: 3pt !important;
        border-left: none !important;
      }
      h3 {
        font-size: 10pt !important;
        margin: 3mm 0 2mm 0 !important;
        color: #333 !important;
        border-bottom: 0.5pt solid #ccc !important;
        padding-bottom: 1mm !important;
      }
      p { margin: 1mm 0 !important; font-size: 8pt !important; }

      /* サマリーカード - 2x2グリッド */
      .summary-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 3mm !important;
        margin: 3mm 0 !important;
      }
      .summary-card {
        padding: 3mm !important;
        border-radius: 2mm !important;
        border: 0.5pt solid #ddd !important;
        background: #f8f9fa !important;
        text-align: center !important;
      }
      .summary-card .value {
        font-size: 16pt !important;
        font-weight: bold !important;
        color: #1a73e8 !important;
      }
      .summary-card .label {
        font-size: 7pt !important;
        margin-top: 1mm !important;
      }

      /* 統計ボックス */
      .stats-grid {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 2mm !important;
        margin: 2mm 0 !important;
      }
      .stat-box {
        padding: 2mm !important;
        border-radius: 2mm !important;
        background: #f0f7ff !important;
        text-align: center !important;
      }
      .stat-box .stat-value { font-size: 11pt !important; font-weight: bold !important; }
      .stat-box .stat-label { font-size: 7pt !important; }

      /* 2列/3列レイアウト */
      .two-column {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 4mm !important;
      }
      .three-column {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 3mm !important;
      }

      /* テーブル */
      table {
        font-size: 7pt !important;
        margin: 2mm 0 !important;
        width: 100% !important;
        border-collapse: collapse !important;
      }
      th, td {
        padding: 1.5mm 2mm !important;
        border: 0.3pt solid #ccc !important;
      }
      th {
        font-size: 7pt !important;
        background: #1a73e8 !important;
        color: white !important;
        font-weight: bold !important;
      }

      /* SVGチャート - A4幅にフィット */
      .chart-container {
        margin: 2mm 0 !important;
        text-align: center !important;
      }
      .chart-container svg,
      svg {
        max-width: 175mm !important;
        max-height: 55mm !important;
        width: auto !important;
        height: auto !important;
      }

      /* ボックス類 */
      .highlight-box, .warning-box, .target-card {
        padding: 2mm !important;
        margin: 1.5mm 0 !important;
        font-size: 8pt !important;
        border-radius: 2mm !important;
      }
      .note { padding: 1.5mm !important; font-size: 7pt !important; }
      .target-card { padding: 2mm !important; font-size: 7pt !important; }

      /* 読み方ガイドボックス - コンパクト化 */
      [style*="background:#f8f9fa"][style*="border-radius:8px"][style*="padding:12px"] {
        padding: 4px 8px !important;
        margin-bottom: 4px !important;
        font-size: 7pt !important;
      }
      [style*="background:#f0f0f0"][style*="padding:8px"] {
        padding: 3px 6px !important;
        font-size: 7pt !important;
      }
      [style*="background:#f0f0f0"][style*="padding:6px"] {
        padding: 2px 4px !important;
        font-size: 6pt !important;
      }
    }
  </style>
</head>
<body>
  <div class="edit-guide" contenteditable="false">
    <strong>編集モード:</strong> このレポートは直接編集できます。テキストをクリックして変更してください。
    <button onclick="printAsPDF()" style="margin-left:20px;padding:8px 16px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">PDF保存 / 印刷</button>
  </div>

  <h1 class="editable" contenteditable="true">求人分析レポート</h1>
  <p class="editable" contenteditable="true">生成日時: ${now}</p>

  <!-- 1. サマリー -->
  <div class="section no-break">
    <h2>サマリー</h2>
    <div style="background:#f8f9fa;border-radius:8px;padding:12px;margin-bottom:12px;">
      <p style="font-size:9pt;color:#555;margin:0 0 8px 0;">
        <strong>【読み方ガイド】</strong>分析対象の求人市場全体像を示します。${isHourly ? '時給データとして解析されています。' : '平均月給は全求人の給与を統合月給換算したものです。'}
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:8pt;">
        <div style="background:#f0f0f0;padding:6px;border-radius:4px;">
          <strong>総求人数</strong><br>
          分析対象となった<br>
          求人の総件数
        </div>
        <div style="background:#f0f0f0;padding:6px;border-radius:4px;">
          <strong>平均${salaryLabel}</strong><br>
          全求人の給与平均<br>
          市場相場の目安
        </div>
        <div style="background:#f0f0f0;padding:6px;border-radius:4px;">
          <strong>正社員率</strong><br>
          正社員求人の割合<br>
          高いほど安定志向向け
        </div>
        <div style="background:#f0f0f0;padding:6px;border-radius:4px;">
          <strong>新着率</strong><br>
          新規掲載求人の割合<br>
          高いと市場が活発
        </div>
      </div>
    </div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="value">${(summary.totalCount || 0).toLocaleString()}</div>
        <div class="label">総求人数</div>
      </div>
      <div class="summary-card">
        <div class="value">${displayAvgSalary}</div>
        <div class="label">平均${salaryLabel}</div>
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

  <!-- 2. 検索対象（ターゲット）情報 - サマリーと同一ページに -->
  ${targets.length > 0 ? `
  <div style="margin-top:15px;page-break-before:avoid;page-break-after:avoid;">
    <h2>検索対象</h2>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="background:#f8f9fa;border-radius:8px;padding:10px;">
        <p style="font-size:9pt;color:#555;margin:0 0 6px 0;">
          <strong>【読み方ガイド】</strong>検索対象とは、あなたが設定した求人検索の条件です。「市場位置」は希望給与が全求人の中でどの位置かを示します。
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:8pt;">
          <div style="background:#f0f0f0;padding:6px;border-radius:4px;">
            <strong>市場位置の読み方</strong><br>
            上位10%=高条件(競争率高) / 上位30%=やや高い<br>
            上位50%=平均レベル / 上位70%以上=求人豊富
          </div>
          <div style="background:#f0f0f0;padding:6px;border-radius:4px;">
            <strong>活用のヒント</strong><br>
            上位30%以内→競争率に注意<br>
            50%前後→狙いやすいゾーン
          </div>
        </div>
      </div>
      <div style="background:#f0f0f0;border-radius:8px;padding:10px;border-left:3px solid #e53935;">
        <strong style="font-size:9pt;">複数クエリで調査を</strong>
        <p style="font-size:8pt;margin:4px 0 0 0;color:#555;">
          より正確な市場把握のため<strong>キーワード・地域・職種を変えて複数回検索</strong>を推奨。<br>
          例：「営業 東京」→「法人営業 都内」「ルート営業 関東」
        </p>
      </div>
    </div>
    <p>設定された検索対象: <strong>${targets.length}件</strong></p>
    <div class="three-column">
      ${targets.map(t => `
      <div class="target-card">
        <strong>${t.name}</strong><br>
        ${t.salaryMin || t.salaryMax ? `希望給与: ${t.salaryMin ? formatReportSalaryYen(t.salaryMin) : '-'} ～ ${t.salaryMax ? formatReportSalaryYen(t.salaryMax) : '-'}` : '給与条件なし'}
        ${t.positionAll ? `<br><small>市場位置: 全体${Math.round(t.positionAll*100)}%</small>` : ''}
      </div>`).join('')}
    </div>
    ${targetSalary.combined && (targetSalary.combined.min || targetSalary.combined.max) ? `
    <div class="highlight-box">
      <strong>希望給与範囲（全対象合算）:</strong> ${targetSalary.combined.min ? formatReportSalaryYen(targetSalary.combined.min) : '-'} ～ ${targetSalary.combined.max ? formatReportSalaryYen(targetSalary.combined.max) : '-'}
    </div>
    ` : ''}
  </div>
  ` : ''}

  <!-- 3. 給与分布（統計情報＋生データ分布） -->
  <div class="section-compact" style="page-break-after:avoid;">
    <h2>給与分布 - 統計情報</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">
      <strong>【読み方ガイド】</strong>${isHourly ? '時給データの統計情報。' : '下限給与=最低保証額、上限給与=経験者向け上限。'}中央値≒希望給与=現実的目標、平均以上=チャレンジ目標。
    </p>
    <div class="stats-grid" style="margin-bottom:10px;">
      <div class="stat-box">
        <div class="stat-value">${displayAvgSalary}</div>
        <div class="stat-label">平均${salaryLabel}</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${displayMedianSalary}</div>
        <div class="stat-label">中央値</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${isHourly ? (hourlyStats.min && hourlyStats.max ? hourlyStats.min + '～' + hourlyStats.max + '円' : '-') : (summary.modeRange || '-')}</div>
        <div class="stat-label">${isHourly ? '給与範囲' : '最頻値帯'}</div>
      </div>
    </div>

    ${minMaxHistograms.rawMinLabels && minMaxHistograms.rawMinLabels.length > 0 ? `
    <div style="margin-bottom:12px;">
      <h3 style="margin:0 0 4px 0;font-size:11pt;">下限給与分布</h3>
      <p style="text-align:center;font-size:9px;margin:0 0 4px 0;">平均: ${formatReportSalaryYen(minMaxHistograms.stats.minMean)} / 中央値: ${formatReportSalaryYen(minMaxHistograms.stats.minMedian)}</p>
      <div class="chart-container" style="margin:0;">
        ${createBarChartSvg(minMaxHistograms.rawMinLabels.slice(0, 25), minMaxHistograms.rawMinHistogram.slice(0, 25), '', '#3498db', 700, 120)}
      </div>
    </div>
    ` : ''}

    ${minMaxHistograms.rawMaxLabels && minMaxHistograms.rawMaxLabels.length > 0 ? `
    <div>
      <h3 style="margin:0 0 4px 0;font-size:11pt;">上限給与分布</h3>
      <p style="text-align:center;font-size:9px;margin:0 0 4px 0;">平均: ${formatReportSalaryYen(minMaxHistograms.stats.maxMean)} / 中央値: ${formatReportSalaryYen(minMaxHistograms.stats.maxMedian)}</p>
      <div class="chart-container" style="margin:0;">
        ${createBarChartSvg(minMaxHistograms.rawMaxLabels.slice(0, 25), minMaxHistograms.rawMaxHistogram.slice(0, 25), '', '#e74c3c', 700, 120)}
      </div>
    </div>
    ` : ''}
  </div>

  <!-- 3-2. 給与分布（詳細分布）- 2ページ目開始 -->
  ${minMaxHistograms.labels && minMaxHistograms.labels.length > 0 ? `
  <div class="section-compact" style="page-break-before:always;">
    <h2>給与分布 - 詳細分布（${isHourly ? '50円刻み' : '5,000円刻み'}）</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">
      <strong>【読み方ガイド】</strong>山が高い=求人多い給与帯。左偏り=低給与集中、右偏り=高給与集中。複数の山=複数の相場帯存在。
    </p>
    <div style="margin-bottom:12px;">
      <h3 style="margin:0 0 4px 0;font-size:11pt;">下限給与分布</h3>
      <div class="chart-container" style="margin:0;">
        ${createBarChartSvg(minMaxHistograms.labels.slice(0, 25), minMaxHistograms.minHistogram.slice(0, 25), '', '#3498db', 700, 130)}
      </div>
    </div>
    <div>
      <h3 style="margin:0 0 4px 0;font-size:11pt;">上限給与分布</h3>
      <div class="chart-container" style="margin:0;">
        ${createBarChartSvg(minMaxHistograms.labels.slice(0, 25), minMaxHistograms.maxHistogram.slice(0, 25), '', '#e74c3c', 700, 130)}
      </div>
    </div>
  </div>
  ` : ''}

  <!-- 4. 雇用形態分布（詳細分布と同一ページ） -->
  <div class="section-compact section-continuation">
    <h2>雇用形態分布</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">
      <strong>【読み方ガイド】</strong>正社員=安定◎、契約社員=専門性、派遣=柔軟、パート=時間融通。安定重視→正社員、収入重視→雇用形態別給与比較。
    </p>
    <div class="two-column" style="gap:15px;">
      <div>
        ${createHorizontalBarSvg(empDistribution.slice(0, 6).map(([type, count]) => ({ label: type, value: count, color: '#1a73e8' })), '', 320, 140)}
      </div>
      <div>
        ${Object.keys(byEmploymentType).length > 0 ? `
        <table style="font-size:11px;">
          <tr><th>雇用形態</th><th>件数</th><th>平均${salaryLabel}</th><th>中央値</th></tr>
          ${Object.entries(byEmploymentType)
            .filter(([type, stats]) => stats && stats.count > 0)
            .sort((a, b) => (b[1].mean || 0) - (a[1].mean || 0))
            .slice(0, 6)
            .map(([type, stats]) => `
          <tr>
            <td>${type}</td>
            <td>${stats.count}件</td>
            <td><strong>${formatReportSalaryYen(stats.mean)}</strong></td>
            <td>${formatReportSalaryYen(stats.median)}</td>
          </tr>`).join('')}
        </table>
        ` : ''}
      </div>
    </div>
  </div>

  <!-- 5. 地域分析（雇用形態分布と同一ページに） -->
  <div class="section-compact section-continuation">
    <h2>地域分析</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">
      <strong>【読み方ガイド】</strong>関東(東京等)・関西(大阪等)・東海(愛知等)。求人多=選択肢豊富、少=競争率注意。複数エリア検討推奨。
    </p>
    <div class="two-column" style="gap:15px;">
      <div>
        <h3 style="margin-top:0;">地域ブロック別</h3>
        ${createHorizontalBarSvg(regionDistribution.slice(0, 6).map(([region, count]) => ({ label: region, value: count, color: '#26a69a' })), '', 320, 130)}
      </div>
      <div>
        <h3 style="margin-top:0;">都道府県TOP10</h3>
        <table style="font-size:10px;">
          <tr><th>都道府県</th><th>件数</th><th>割合</th></tr>
          ${prefDistribution.slice(0, 8).map(([pref, count]) => `
          <tr>
            <td>${pref}</td>
            <td>${count}件</td>
            <td>${Math.round((count / (summary.totalCount || 1)) * 100)}%</td>
          </tr>`).join('')}
        </table>
      </div>
    </div>

    <h3 style="margin-top:8px;">市区町村別 給与分析TOP15</h3>
    <table style="font-size:10px;width:100%;">
      <tr><th>#</th><th>市区町村</th><th>都道府県</th><th>件数</th><th>平均${salaryLabel}</th><th>中央値</th></tr>
      ${(regionSalaryAnalysis.citySalaryList || []).slice(0, 15).map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${c.name}</td>
        <td style="font-size:9px;color:#666;">${c.prefecture || ''}</td>
        <td>${c.count}件</td>
        <td><strong>${formatReportSalaryYen(c.avgSalary)}</strong></td>
        <td>${formatReportSalaryYen(c.medianSalary)}</td>
      </tr>`).join('')}
    </table>
  </div>

  <!-- 6. 流入分析 - 企業分析と同一ページに収まるよう調整 -->
  ${inflowAnalysis && !inflowAnalysis.error && inflowAnalysis.targetCities ? `
  <div class="section" style="page-break-after:avoid;">
    <h2>人材流入分析</h2>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:10px;font-size:8pt;">
      <div style="background:#f8f9fa;border-radius:6px;padding:8px;">
        <strong>【読み方ガイド】</strong> 流入率=他県から働きに来る人の割合。高い＝広域採用エリア。流入元エリア居住者は通勤実績ありで採用されやすい傾向。
      </div>
      <div style="background:#f0f0f0;border-radius:6px;padding:8px;">
        <strong>目安</strong><br>0-10%:地元密着 / 10-30%:近隣流入 / 30%+:広域
      </div>
      <div style="background:#f0f0f0;border-radius:6px;padding:8px;">
        <strong>活用</strong><br>流入元地域なら通勤実績として有利にアピール可
      </div>
    </div>
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
  <div class="section" style="page-break-before:always;">
    <h2>企業分析</h2>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:10px;font-size:8pt;">
      <div style="background:#f8f9fa;border-radius:6px;padding:8px;">
        <strong>【読み方ガイド】</strong> 求人数多い=積極採用中。給与上位=好待遇。両方にランクインする企業は「狙い目」。求人数多＋給与低は離職率注意。
      </div>
      <div style="background:#f0f0f0;border-radius:6px;padding:8px;">
        <strong>指標</strong><br>上限中央値=経験者向け<br>下限中央値=最低保証
      </div>
      <div style="background:#f0f0f0;border-radius:6px;padding:8px;">
        <strong>確認</strong><br>口コミサイトで評判チェックも重要
      </div>
    </div>
    <p>総企業数: <strong>${companyData.totalCompanies}社</strong></p>

    <div class="two-column">
      <div>
        <h3>求人数ランキングTOP15</h3>
        <table>
          <tr><th>#</th><th>企業名</th><th>求人数</th><th>平均${salaryLabel}</th></tr>
          ${(companyData.topByCount || []).slice(0, 15).map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${c.name}</td>
            <td>${c.jobCount}件</td>
            <td>${isHourly ? (c.avgSalary ? Math.round(c.avgSalary).toLocaleString() + '円' : '-') : (c.avgSalary ? (c.avgSalary / 10000).toFixed(1) + '万円' : '-')}</td>
          </tr>`).join('')}
        </table>
      </div>
      <div>
        <h3>給与レンジランキングTOP15（上限中央値順）</h3>
        <table>
          <tr><th>#</th><th>企業名</th><th>下限中央値</th><th>上限中央値</th><th>求人数</th></tr>
          ${(companyData.topBySalary || []).filter(c => c.maxMedian).slice(0, 15).map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${c.name}</td>
            <td>${isHourly ? (c.minMedian ? Math.round(c.minMedian).toLocaleString() + '円' : '-') : (c.minMedian ? (c.minMedian / 10000).toFixed(1) + '万円' : '-')}</td>
            <td><strong>${isHourly ? (c.maxMedian ? Math.round(c.maxMedian).toLocaleString() + '円' : '-') : (c.maxMedian ? (c.maxMedian / 10000).toFixed(1) + '万円' : '-')}</strong></td>
            <td>${c.jobCount}件</td>
          </tr>`).join('')}
        </table>
      </div>
    </div>
    <div style="margin-top:15px;">
      <h3>給与レンジランキングTOP15（下限中央値順）</h3>
      <table>
        <tr><th>#</th><th>企業名</th><th>下限中央値</th><th>上限中央値</th><th>求人数</th></tr>
        ${(companyData.topBySalary || []).filter(c => c.minMedian).sort((a, b) => (b.minMedian || 0) - (a.minMedian || 0)).slice(0, 15).map((c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${c.name}</td>
          <td><strong>${isHourly ? (c.minMedian ? Math.round(c.minMedian).toLocaleString() + '円' : '-') : (c.minMedian ? (c.minMedian / 10000).toFixed(1) + '万円' : '-')}</strong></td>
          <td>${isHourly ? (c.maxMedian ? Math.round(c.maxMedian).toLocaleString() + '円' : '-') : (c.maxMedian ? (c.maxMedian / 10000).toFixed(1) + '万円' : '-')}</td>
          <td>${c.jobCount}件</td>
        </tr>`).join('')}
      </table>
    </div>
  </div>

  <!-- 7.5 地域別×給与クロス分析（コンパクト版） -->
  ${regionSalaryAnalysis.hasData ? `
  <div class="section-compact" style="page-break-after:avoid;">
    <h2>地域別×給与クロス分析</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">
      <strong>【読み方ガイド】</strong>給与TOP地域=生活費も高い傾向。給与−生活費で実質手取り比較。下限〜上限の幅広=昇給余地大。(有効: ${regionSalaryAnalysis.totalWithData || 0}件)
    </p>

    <div class="two-column" style="gap:12px;">
      <div>
        <h3 style="margin:0 0 4px 0;">都道府県別 給与水準TOP10</h3>
        <table style="font-size:10px;">
          <tr><th>都道府県</th><th>件数</th><th>平均${salaryLabel}</th><th>下限平均</th><th>上限平均</th></tr>
          ${(regionSalaryAnalysis.prefectureSalaryList || []).slice(0, 8).map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${p.count}件</td>
            <td><strong>${isHourly ? (p.avgSalary ? Math.round(p.avgSalary).toLocaleString() + '円' : '-') : (p.avgSalary ? (p.avgSalary / 10000).toFixed(1) + '万円' : '-')}</strong></td>
            <td>${isHourly ? (p.avgMin ? Math.round(p.avgMin).toLocaleString() + '円' : '-') : (p.avgMin ? (p.avgMin / 10000).toFixed(1) + '万円' : '-')}</td>
            <td>${isHourly ? (p.avgMax ? Math.round(p.avgMax).toLocaleString() + '円' : '-') : (p.avgMax ? (p.avgMax / 10000).toFixed(1) + '万円' : '-')}</td>
          </tr>`).join('')}
        </table>
      </div>
      <div>
        <h3 style="margin:0 0 4px 0;">地域ブロック別 給与水準</h3>
        <table style="font-size:10px;">
          <tr><th>地域</th><th>件数</th><th>平均${salaryLabel}</th><th>下限平均</th><th>上限平均</th></tr>
          ${(regionSalaryAnalysis.regionBlockSalaryList || []).map(r => `
          <tr>
            <td>${r.name}</td>
            <td>${r.count}件</td>
            <td><strong>${isHourly ? (r.avgSalary ? Math.round(r.avgSalary).toLocaleString() + '円' : '-') : (r.avgSalary ? (r.avgSalary / 10000).toFixed(1) + '万円' : '-')}</strong></td>
            <td>${isHourly ? (r.avgMin ? Math.round(r.avgMin).toLocaleString() + '円' : '-') : (r.avgMin ? (r.avgMin / 10000).toFixed(1) + '万円' : '-')}</td>
            <td>${isHourly ? (r.avgMax ? Math.round(r.avgMax).toLocaleString() + '円' : '-') : (r.avgMax ? (r.avgMax / 10000).toFixed(1) + '万円' : '-')}</td>
          </tr>`).join('')}
        </table>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- 7.6 市区町村別TOP（削除：既に5.地域分析に含まれている） -->

  <!-- 8. タグ分析 - タグ×給与相関と同一ページに収まるよう調整 -->
  <div class="section" style="page-break-after:avoid;">
    <h2>タグ分析</h2>
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:10px;margin-bottom:10px;font-size:8pt;">
      <div style="background:#f8f9fa;border-radius:6px;padding:8px;">
        <strong>【読み方ガイド】</strong> 出現頻度が高いタグ=市場ニーズ高。自分が持つタグが多いほどアピールしやすい。「未経験可」が多い市場は参入しやすい。
      </div>
      <div style="background:#f0f0f0;border-radius:6px;padding:8px;">
        <strong>タグカテゴリ</strong> スキル系(技術・資格) / 待遇系(給与・福利厚生) / 勤務条件系(リモート・時短) / 環境系(雰囲気・研修)
      </div>
    </div>
    <div class="two-column">
      <div>
        <h3>人気タグTOP20</h3>
        ${createHorizontalBarSvg((tagData.topTags || []).slice(0, 12).map(t => ({ label: t.tag, value: t.count, color: '#7e57c2' })), '', 350, 250)}
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

  <!-- 9. タグと給与の相関 - タグ分析と同一ページに -->
  <div style="margin-top:15px;page-break-before:avoid;">
    <h2 style="margin-top:0;">タグと給与の相関分析</h2>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:10px;font-size:8pt;">
      <div style="background:#f8f9fa;border-radius:6px;padding:8px;">
        <strong>【読み方ガイド】</strong> 高給与タグ=そのスキル・条件を持つ求人の平均給与が高い。<span style="color:green">緑(+)</span>=平均超、<span style="color:red">赤(-)</span>=平均以下。組み合わせで相乗効果あり。
      </div>
      <div style="background:#f0f0f0;border-radius:6px;padding:8px;">
        <strong>高給与の傾向</strong><br>専門スキル・資格 / マネジメント経験 / 語学力 / 経験年数
      </div>
      <div style="background:#f0f0f0;border-radius:6px;padding:8px;">
        <strong>戦略</strong><br>高給与タグ2-3個を組み合わせて狙う。不足スキルは習得を検討。
      </div>
    </div>
    <p>全体平均${salaryLabel}: <strong>${isHourly ? (tagSalaryData.overallAvg ? Math.round(tagSalaryData.overallAvg).toLocaleString() + '円' : '-') : (tagSalaryData.overallAvg ? (tagSalaryData.overallAvg / 10000).toFixed(1) + '万円' : '-')}</strong></p>

    <h3>高給与タグTOP10</h3>
    <table>
      <tr><th>タグ</th><th>件数</th><th>平均${salaryLabel}</th><th>全体比</th></tr>
      ${(tagSalaryData.tagCorrelations || []).slice(0, 10).map(t => `
      <tr>
        <td>${t.tag}</td>
        <td>${t.count}件</td>
        <td><strong>${isHourly ? (t.avgSalary ? Math.round(t.avgSalary).toLocaleString() + '円' : '-') : (t.avgSalary ? (t.avgSalary / 10000).toFixed(1) + '万円' : '-')}</strong></td>
        <td class="${t.diffFromAvg >= 0 ? 'positive' : 'negative'}">${t.diffFromAvg >= 0 ? '+' : ''}${isHourly ? Math.round(t.diffFromAvg).toLocaleString() + '円' : (t.diffFromAvg / 10000).toFixed(1) + '万円'} (${t.diffFromAvg >= 0 ? '+' : ''}${t.diffPercent}%)</td>
      </tr>`).join('')}
    </table>

    ${tagSalaryData.combinations && tagSalaryData.combinations.length > 0 ? `
    <h3>高給与タグ組み合わせTOP10</h3>
    <table>
      <tr><th>組み合わせ</th><th>件数</th><th>平均${salaryLabel}</th><th>全体比</th></tr>
      ${tagSalaryData.combinations.slice(0, 10).map(c => `
      <tr>
        <td>${c.combination}</td>
        <td>${c.count}件</td>
        <td><strong>${isHourly ? (c.avgSalary ? Math.round(c.avgSalary).toLocaleString() + '円' : '-') : (c.avgSalary ? (c.avgSalary / 10000).toFixed(1) + '万円' : '-')}</strong></td>
        <td class="${c.diffFromAvg >= 0 ? 'positive' : 'negative'}">${c.diffFromAvg >= 0 ? '+' : ''}${isHourly ? Math.round(c.diffFromAvg).toLocaleString() + '円' : (c.diffFromAvg / 10000).toFixed(1) + '万円'}</td>
      </tr>`).join('')}
    </table>
    ` : ''}
  </div>

  <!-- 10. 求職者視点分析（コンパクト版） -->
  ${jobSeekerData ? `
  <div class="section" style="page-break-inside:avoid;">
    <h2>求職者視点分析（参考）</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">求人一覧を見たときの認知・心理パターン（※サンプル数が限られるため参考値）</p>

    <div class="two-column" style="gap:10px;">
      ${jobSeekerData.salaryRangePerception ? `
      <div style="background:#e8f5e9;padding:8px;border-radius:6px;border-left:3px solid #4caf50;">
        <strong style="font-size:10pt;">給与レンジの心理的解釈</strong>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:6px;font-size:9px;">
          <div style="background:#fff;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:12pt;font-weight:bold;color:#1a73e8;">${formatJobSeekerValue(jobSeekerData.salaryRangePerception.conservativeEstimate || jobSeekerData.salaryRangePerception.avgLower)}</div>
            <div style="font-size:7pt;color:#666;">控えめ予測</div>
          </div>
          <div style="background:#fff;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:12pt;font-weight:bold;color:#1a73e8;">${formatJobSeekerValue(jobSeekerData.salaryRangePerception.psychologicalMidpoint || jobSeekerData.salaryRangePerception.expectedValue)}</div>
            <div style="font-size:7pt;color:#666;">心理的中点</div>
          </div>
          <div style="background:#fff;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:12pt;font-weight:bold;color:#1a73e8;">${formatJobSeekerValue(jobSeekerData.salaryRangePerception.optimisticEstimate || jobSeekerData.salaryRangePerception.avgUpper)}</div>
            <div style="font-size:7pt;color:#666;">楽観的予測</div>
          </div>
        </div>
      </div>
      ` : ''}

      ${jobSeekerData.newListingsAnalysis ? `
      <div style="background:#f0f0f0;padding:8px;border-radius:6px;border-left:3px solid #9e9e9e;">
        <strong style="font-size:10pt;">新着 vs 既存</strong>
        ${jobSeekerData.newListingsAnalysis.hasData ? `
        <table style="font-size:9px;margin-top:4px;">
          <tr><th></th><th>新着</th><th>既存</th><th>差</th></tr>
          <tr>
            <td>件数</td>
            <td>${jobSeekerData.newListingsAnalysis.newCount || 0}件</td>
            <td>${jobSeekerData.newListingsAnalysis.oldCount || 0}件</td>
            <td>-</td>
          </tr>
          <tr>
            <td>平均${salaryLabel}</td>
            <td>${formatJobSeekerValue(jobSeekerData.newListingsAnalysis.newStats?.unified?.meanMan, true)}</td>
            <td>${formatJobSeekerValue(jobSeekerData.newListingsAnalysis.oldStats?.unified?.meanMan, true)}</td>
            <td class="${(jobSeekerData.newListingsAnalysis.diffVsOld?.unified?.mean || 0) >= 0 ? 'positive' : 'negative'}">${jobSeekerData.newListingsAnalysis.diffVsOld?.unified?.mean ? ((jobSeekerData.newListingsAnalysis.diffVsOld.unified.mean >= 0 ? '+' : '') + formatJobSeekerValue(Math.abs(jobSeekerData.newListingsAnalysis.diffVsOld.unified.mean), true)) : '-'}</td>
          </tr>
        </table>
        ` : `<p style="font-size:9px;margin:4px 0 0 0;color:#666;">新着求人データがありません</p>`}
      </div>
      ` : ''}
    </div>

    <div class="two-column" style="gap:10px;margin-top:8px;">
      ${jobSeekerData.inexperiencedTagAnalysis && jobSeekerData.inexperiencedTagAnalysis.hasData ? `
      <div style="background:#f0f0f0;padding:8px;border-radius:6px;border-left:3px solid #9e9e9e;">
        <strong style="font-size:10pt;">未経験可 vs 経験者向け</strong>
        <table style="font-size:9px;margin-top:4px;">
          <tr><th></th><th>未経験可</th><th>経験者</th><th>差</th></tr>
          <tr>
            <td>件数</td>
            <td>${jobSeekerData.inexperiencedTagAnalysis.withInexperienced?.count || 0}件</td>
            <td>${jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced?.count || 0}件</td>
            <td>-</td>
          </tr>
          ${jobSeekerData.inexperiencedTagAnalysis.withInexperienced?.minSalary ? `
          <tr>
            <td>下限平均</td>
            <td>${formatJobSeekerValue(jobSeekerData.inexperiencedTagAnalysis.withInexperienced.minSalary.meanMan, true)}</td>
            <td>${formatJobSeekerValue(jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced?.minSalary?.meanMan, true)}</td>
            <td class="${(jobSeekerData.inexperiencedTagAnalysis.difference?.minMan || 0) >= 0 ? 'positive' : 'negative'}">${(jobSeekerData.inexperiencedTagAnalysis.difference?.minMan || 0) >= 0 ? '+' : ''}${formatJobSeekerValue(Math.abs(jobSeekerData.inexperiencedTagAnalysis.difference?.minMan || 0), true)}</td>
          </tr>
          ` : ''}
          ${jobSeekerData.inexperiencedTagAnalysis.withInexperienced?.maxSalary ? `
          <tr>
            <td>上限平均</td>
            <td>${formatJobSeekerValue(jobSeekerData.inexperiencedTagAnalysis.withInexperienced.maxSalary.meanMan, true)}</td>
            <td>${formatJobSeekerValue(jobSeekerData.inexperiencedTagAnalysis.withoutInexperienced?.maxSalary?.meanMan, true)}</td>
            <td class="${(jobSeekerData.inexperiencedTagAnalysis.difference?.maxMan || 0) >= 0 ? 'positive' : 'negative'}">${(jobSeekerData.inexperiencedTagAnalysis.difference?.maxMan || 0) >= 0 ? '+' : ''}${formatJobSeekerValue(Math.abs(jobSeekerData.inexperiencedTagAnalysis.difference?.maxMan || 0), true)}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      ` : ''}

      ${jobSeekerData.implicitMarketRate ? `
      <div style="background:#f0f0f0;padding:8px;border-radius:6px;border-left:3px solid #9e9e9e;">
        <strong style="font-size:10pt;">暗黙の相場観</strong>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:6px;font-size:9px;">
          <div style="background:#fff;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:11pt;font-weight:bold;color:#1a73e8;">${jobSeekerData.implicitMarketRate.mode?.range || (jobSeekerData.implicitMarketRate.implicitRate?.modeMan ? (isHourly ? jobSeekerData.implicitMarketRate.implicitRate.modeMan + '円台' : jobSeekerData.implicitMarketRate.implicitRate.modeMan + '万円台') : '-')}</div>
            <div style="font-size:7pt;color:#666;">最頻値帯</div>
          </div>
          <div style="background:#fff;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:11pt;font-weight:bold;color:#1a73e8;">${jobSeekerData.implicitMarketRate.mode?.count || '-'}件</div>
            <div style="font-size:7pt;color:#666;">最頻帯件数</div>
          </div>
          <div style="background:#fff;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:11pt;font-weight:bold;color:#1a73e8;">${(jobSeekerData.implicitMarketRate.medianMan || jobSeekerData.implicitMarketRate.implicitRate?.medianMan) ? formatJobSeekerValue(jobSeekerData.implicitMarketRate.medianMan || jobSeekerData.implicitMarketRate.implicitRate?.medianMan, true) : '-'}</div>
            <div style="font-size:7pt;color:#666;">中央値</div>
          </div>
        </div>
      </div>
      ` : ''}
    </div>
  </div>
  ` : ''}

  <!-- 11. 年間休日分析（コンパクト版） -->
  ${annualHolidaysData && annualHolidaysData.hasData && summary.hasAnnualHolidaysData !== false ? `
  <div class="section-compact" style="page-break-after:avoid;">
    <h2>年間休日分析</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">
      <strong>【読み方ガイド】</strong><span style="color:green">120日以上</span>=ホワイト水準、<span style="color:#f1c40f">110-119日</span>=標準、<span style="color:red">110日未満</span>=やや少なめ。完全週休2日+祝日≒120日。
    </p>

    <div class="two-column" style="gap:15px;">
      <div>
        <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div class="stat-box" style="padding:6px;">
            <div class="stat-value" style="font-size:14pt;">${annualHolidaysData.stats?.mean || '-'}日</div>
            <div class="stat-label">平均</div>
          </div>
          <div class="stat-box" style="padding:6px;">
            <div class="stat-value" style="font-size:14pt;">${annualHolidaysData.stats?.median || '-'}日</div>
            <div class="stat-label">中央値</div>
          </div>
          <div class="stat-box" style="padding:6px;">
            <div class="stat-value" style="font-size:12pt;">${annualHolidaysData.stats?.min || '-'}〜${annualHolidaysData.stats?.max || '-'}日</div>
            <div class="stat-label">範囲</div>
          </div>
        </div>
        <p style="font-size:9px;margin-top:4px;">有効: ${annualHolidaysData.validCount || 0}件/${annualHolidaysData.totalCount || 0}件</p>
      </div>

      <div>
        ${annualHolidaysData.categoryDistribution ? `
        <table style="font-size:10px;">
          <tr><th>カテゴリ</th><th>件数</th><th>割合</th></tr>
          ${Object.entries(annualHolidaysData.categoryDistribution).map(function(entry) {
            var cat = entry[0], count = entry[1];
            var pct = annualHolidaysData.validCount > 0 ? Math.round(count / annualHolidaysData.validCount * 100) : 0;
            return '<tr><td>' + cat + '</td><td>' + count + '件</td><td>' + pct + '%</td></tr>';
          }).join('')}
        </table>
        ` : ''}
      </div>
    </div>

    ${annualHolidaysData.salaryCorrelation ? `
    <h3 style="margin-top:10px;">給与帯別 平均年間休日</h3>
    ${(function() {
      var corr = annualHolidaysData.salaryCorrelation;
      var sortedEntries = Object.entries(corr)
        .filter(function(e) { return e[1].count >= 3; })
        .sort(function(a, b) { return a[1].salaryBin - b[1].salaryBin; })
        .slice(0, 10);
      if (sortedEntries.length === 0) return '<p>データ不足</p>';
      var maxVal = Math.max.apply(null, sortedEntries.map(function(e) { return e[1].mean; }));
      var minVal = Math.min.apply(null, sortedEntries.map(function(e) { return e[1].mean; }));
      var barHeight = 18;
      var height = sortedEntries.length * (barHeight + 4) + 30;
      var width = 600;

      var svg = '<svg width="' + width + '" height="' + height + '" style="background:#fafafa;border-radius:6px;">';
      sortedEntries.forEach(function(entry, i) {
        var label = entry[0];
        var data = entry[1];
        var barWidth = ((data.mean - minVal + 10) / (maxVal - minVal + 20)) * (width - 180);
        var y = 10 + i * (barHeight + 4);
        var color = data.mean >= 120 ? '#2ecc71' : (data.mean >= 110 ? '#f1c40f' : '#e74c3c');

        svg += '<text x="65" y="' + (y + barHeight/2 + 4) + '" text-anchor="end" font-size="9">' + label + '</text>';
        svg += '<rect x="70" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + color + '" rx="2"/>';
        svg += '<text x="' + (75 + barWidth + 3) + '" y="' + (y + barHeight/2 + 4) + '" font-size="9">' + data.mean + '日 (' + data.count + '件)</text>';
      });
      svg += '</svg>';
      return '<div class="chart-container" style="margin:6px 0;">' + svg + '</div>';
    })()}
    <p style="font-size:9px;color:#888;margin-top:4px;">緑:120日以上 / 黄:110-119日 / 赤:110日未満</p>
    ` : ''}
  </div>
  ` : ''}

  <!-- 12. 給与詳細分布（コンパクト版） -->
  ${salaryBinning && (salaryBinning.monthly?.labels?.length > 0 || salaryBinning.hourly?.labels?.length > 0) ? `
  <div class="section-compact section-continuation">
    <h2>給与詳細分布</h2>
    <p style="font-size:8pt;color:#555;margin:0 0 6px 0;">
      <strong>【読み方ガイド】</strong>中央値=典型的な給与。平均>中央値:高給求人で平均押上げ。中央値付近=現実的目標、平均以上=チャレンジ目標。
    </p>

    ${!isHourly && salaryBinning.monthly?.labels?.length > 0 ? `
    <div style="display:flex;align-items:center;gap:15px;margin-bottom:8px;">
      <h3 style="margin:0;">月給分布（5,000円刻み）</h3>
      <div style="display:flex;gap:10px;font-size:10px;">
        <span><strong>平均:</strong> ${salaryBinning.monthly.stats?.mean || '-'}</span>
        <span><strong>中央値:</strong> ${salaryBinning.monthly.stats?.median || '-'}</span>
        <span><strong>最頻値帯:</strong> ${salaryBinning.monthly.stats?.modeLabel || '-'}</span>
        <span style="color:#666;">(${salaryBinning.monthly.stats?.count || 0}件)</span>
      </div>
    </div>
    ${createBarChartSvgWithStats(salaryBinning.monthly.labels.slice(0, 25), salaryBinning.monthly.values.slice(0, 25), '', '#3498db', 650, 180, salaryBinning.monthly.stats, targetSalary, 5000)}
    ` : ''}

    ${isHourly && salaryBinning.hourly?.labels?.length > 0 ? `
    <div style="display:flex;align-items:center;gap:15px;margin-bottom:8px;">
      <h3 style="margin:0;">時給分布（50円刻み）</h3>
      <div style="display:flex;gap:10px;font-size:10px;">
        <span><strong>平均:</strong> ${salaryBinning.hourly.stats?.mean || '-'}</span>
        <span><strong>中央値:</strong> ${salaryBinning.hourly.stats?.median || '-'}</span>
        <span><strong>最頻値帯:</strong> ${salaryBinning.hourly.stats?.modeLabel || '-'}</span>
        <span style="color:#666;">(${salaryBinning.hourly.stats?.count || 0}件)</span>
      </div>
    </div>
    ${createBarChartSvgWithStats(salaryBinning.hourly.labels.slice(0, 25), salaryBinning.hourly.values.slice(0, 25), '', '#e74c3c', 650, 180, salaryBinning.hourly.stats, null, 50)}
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
    // 編集可能にする要素のセレクタ（説明文・divも含む）
    var editableSelectors = 'h1, h2, h3, p, td, th, li, strong, span, .stat-value, .stat-label, .value, .label, .summary-card, .highlight-box, .target-card, div[style*="background:#f8f9fa"], div[style*="background:#f0f0f0"], div[style*="background:#e8f5e9"]';
    document.querySelectorAll(editableSelectors).forEach(function(el) {
      // SVG内、編集ガイド、印刷ボタンは除外
      if (el.closest('svg') || el.classList.contains('edit-guide') || el.closest('.no-print')) return;
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

  <script>
  // PDF保存/印刷機能
  function printAsPDF() {
    // 印刷前の準備
    document.body.classList.add('printing');

    // 少し待ってから印刷ダイアログを開く
    setTimeout(function() {
      window.print();

      // 印刷後のクリーンアップ
      setTimeout(function() {
        document.body.classList.remove('printing');
      }, 1000);
    }, 100);
  }

  // Ctrl+P のショートカットをオーバーライド
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      printAsPDF();
    }
  });
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

  // 1.5. salaryDisplayTypeの確認
  console.log('\n[1.5] salaryDisplayType確認:');
  const salaryDisplayType = PropertiesService.getScriptProperties().getProperty('salaryDisplayType');
  console.log('  salaryDisplayType: ' + salaryDisplayType);

  // 2. ダッシュボードデータの読み込み確認
  console.log('\n[2] ダッシュボードデータ:');
  const startDash = Date.now();
  const dashData = DataPersistence.loadPrecomputedDashboard();
  const dashTime = Date.now() - startDash;
  if (dashData) {
    console.log('  読み込み時間: ' + dashTime + 'ms');
    console.log('  totalCount: ' + (dashData.summary ? dashData.summary.totalCount : 'N/A'));
    console.log('  🔴 isHourly: ' + (dashData.summary ? dashData.summary.isHourly : 'N/A'));
    console.log('  hourlyStats: ' + (dashData.salaryData && dashData.salaryData.hourlyStats ? JSON.stringify(dashData.salaryData.hourlyStats) : 'N/A'));
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
 * 🗺️ 地図ピン問題の診断
 * GASエディタで実行: ApiHandler.gs の diagnoseMapPinIssue
 */
function diagnoseMapPinIssue() {
  console.log('═'.repeat(60));
  console.log('🗺️ 地図ピン問題の診断');
  console.log('═'.repeat(60));

  // 1. parsedDataを取得
  const parsedData = DataLayer.getParsedData(true);
  console.log('\n[1] 総レコード数: ' + parsedData.length + '件');

  // 2. cityWardの抽出状況を確認
  const cityWardStats = {};
  const noCityWard = [];
  const prefectureStats = {};

  parsedData.forEach((record, index) => {
    const cityWard = record.locationParsed?.cityWard || null;
    const prefecture = record.locationParsed?.prefecture || '不明';

    prefectureStats[prefecture] = (prefectureStats[prefecture] || 0) + 1;

    if (!cityWard || cityWard === '不明') {
      if (noCityWard.length < 10) {
        noCityWard.push({
          index: index,
          original: record.location?.substring(0, 50) || '(空)',
          prefecture: prefecture
        });
      }
    } else {
      cityWardStats[cityWard] = (cityWardStats[cityWard] || 0) + 1;
    }
  });

  const uniqueCityWards = Object.keys(cityWardStats).length;
  const recordsWithCityWard = Object.values(cityWardStats).reduce((a, b) => a + b, 0);
  const recordsWithoutCityWard = parsedData.length - recordsWithCityWard;

  console.log('\n[2] 市区町村抽出状況:');
  console.log('  ・市区町村あり: ' + recordsWithCityWard + '件');
  console.log('  ・市区町村なし: ' + recordsWithoutCityWard + '件');
  console.log('  ・ユニーク市区町村数: ' + uniqueCityWards + '種類');

  // 3. 座標解決状況を確認
  console.log('\n[3] 座標解決状況:');
  const coordResults = { found: 0, fallbackPref: 0, notFound: 0 };
  const fallbackExamples = [];
  const uniqueCoords = new Set();

  Object.keys(cityWardStats).forEach(cityWard => {
    // 任意のレコードから都道府県を取得
    const sampleRecord = parsedData.find(r => r.locationParsed?.cityWard === cityWard);
    const prefecture = sampleRecord?.locationParsed?.prefecture || null;

    const coords = getCityCoordinates(cityWard, prefecture);
    if (coords) {
      const coordKey = coords[0].toFixed(4) + ',' + coords[1].toFixed(4);
      uniqueCoords.add(coordKey);

      // 都道府県座標と一致するか確認（フォールバック判定）
      if (prefecture && PREFECTURE_COORDINATES[prefecture]) {
        const prefCoords = PREFECTURE_COORDINATES[prefecture];
        const isPrefFallback = Math.abs(coords[0] - prefCoords[0]) < 0.1 &&
                               Math.abs(coords[1] - prefCoords[1]) < 0.1;
        if (isPrefFallback) {
          coordResults.fallbackPref++;
          if (fallbackExamples.length < 5) {
            fallbackExamples.push(cityWard + ' (' + prefecture + ')');
          }
        } else {
          coordResults.found++;
        }
      } else {
        coordResults.found++;
      }
    } else {
      coordResults.notFound++;
    }
  });

  console.log('  ・正常に座標取得: ' + coordResults.found + '件');
  console.log('  ・都道府県座標にフォールバック: ' + coordResults.fallbackPref + '件');
  console.log('  ・座標なし: ' + coordResults.notFound + '件');
  console.log('  ・ユニーク座標数: ' + uniqueCoords.size + '種類');

  if (fallbackExamples.length > 0) {
    console.log('\n  【都道府県フォールバックの例】');
    fallbackExamples.forEach(ex => console.log('    - ' + ex));
  }

  // 4. 市区町村なしレコードの例
  if (noCityWard.length > 0) {
    console.log('\n[4] 市区町村が抽出できなかった例（最大10件）:');
    noCityWard.forEach(item => {
      console.log('  - [' + item.index + '] "' + item.original + '..." (都道府県: ' + item.prefecture + ')');
    });
  }

  // 5. 診断結果
  console.log('\n' + '═'.repeat(60));
  console.log('診断結果:');

  if (uniqueCoords.size <= 5 && parsedData.length > 50) {
    console.log('🔴 問題検出: ユニーク座標が少なすぎます（' + uniqueCoords.size + '種類）');
    console.log('   → 多くの市区町村が同じ座標にフォールバックしています');
  }

  if (coordResults.fallbackPref > uniqueCityWards * 0.3) {
    console.log('🔴 問題検出: ' + Math.round(coordResults.fallbackPref / uniqueCityWards * 100) + '%が都道府県座標にフォールバック');
    console.log('   → 市町村マスタまたはCITY_COORDINATESに座標を追加してください');
  }

  if (recordsWithoutCityWard > parsedData.length * 0.3) {
    console.log('🔴 問題検出: ' + Math.round(recordsWithoutCityWard / parsedData.length * 100) + '%のレコードで市区町村が抽出できていません');
    console.log('   → LocationParserの改善が必要です');
  }

  if (coordResults.fallbackPref === 0 && recordsWithoutCityWard < parsedData.length * 0.1 && uniqueCoords.size > 10) {
    console.log('✅ 問題なし: 座標解決は正常に動作しています');
  }

  console.log('═'.repeat(60));

  return {
    totalRecords: parsedData.length,
    recordsWithCityWard: recordsWithCityWard,
    recordsWithoutCityWard: recordsWithoutCityWard,
    uniqueCityWards: uniqueCityWards,
    uniqueCoords: uniqueCoords.size,
    fallbackCount: coordResults.fallbackPref,
    fallbackExamples: fallbackExamples
  };
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

/**
 * 🔍 時給データ診断
 * 時給データがパースされているか確認するための関数
 * GASエディタで実行: diagnoseHourlySalary()
 */
function diagnoseHourlySalary() {
  console.log('═'.repeat(60));
  console.log('🔍 時給データ診断');
  console.log('═'.repeat(60));

  // Step 1: salaryDisplayType確認
  const salaryDisplayType = PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
  console.log('\n【Step 1】salaryDisplayType: ' + salaryDisplayType);

  // Step 2: スプレッドシートの給与データ確認
  console.log('\n【Step 2】スプレッドシートの給与データ（最初の10件）');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('データ');
  if (!dataSheet) {
    console.log('❌ 「データ」シートが見つかりません');
    return;
  }
  const lastRow = dataSheet.getLastRow();
  if (lastRow <= 1) {
    console.log('❌ データがありません');
    return;
  }
  // J列（10列目）が給与
  const salaryRange = dataSheet.getRange(2, 10, Math.min(10, lastRow - 1), 1);
  const salaryValues = salaryRange.getValues();
  salaryValues.forEach((row, i) => {
    console.log('  行' + (i + 2) + ': "' + row[0] + '"');
  });

  // Step 3: parseSalary結果確認
  console.log('\n【Step 3】parseSalary結果（最初の10件）');
  salaryValues.forEach((row, i) => {
    const result = parseSalary(row[0], salaryDisplayType);
    console.log('  行' + (i + 2) + ': type=' + result.salaryType + ', min=' + result.minValue + ', max=' + result.maxValue);
  });

  // Step 4: 時給データ件数確認
  console.log('\n【Step 4】永続化データの時給件数');
  const parsedData = DataPersistence.loadParsedData();
  if (!parsedData || parsedData.length === 0) {
    console.log('❌ 永続化データがありません（CSVを再インポートしてください）');
  } else {
    const hourlyCount = parsedData.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'hourly').length;
    const monthlyCount = parsedData.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'monthly').length;
    const annualCount = parsedData.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'annual').length;
    console.log('  総件数: ' + parsedData.length);
    console.log('  時給(hourly): ' + hourlyCount + '件');
    console.log('  月給(monthly): ' + monthlyCount + '件');
    console.log('  年収(annual): ' + annualCount + '件');

    // 時給データのサンプル表示
    if (hourlyCount > 0) {
      console.log('\n  時給データサンプル（最初の5件）:');
      const hourlySamples = parsedData.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'hourly').slice(0, 5);
      hourlySamples.forEach((d, i) => {
        console.log('    ' + (i + 1) + ': "' + d.salary + '" → min=' + d.salaryParsed.minValue + ', max=' + d.salaryParsed.maxValue);
      });
    }
  }

  // Step 5: 事前計算データの時給確認
  console.log('\n【Step 5】事前計算データの時給統計');
  const precomputed = DataPersistence.loadPrecomputedDashboard();
  if (!precomputed || !precomputed.salaryData) {
    console.log('❌ 事前計算データがありません');
  } else {
    const bySalaryType = precomputed.salaryData.bySalaryType || {};
    console.log('  月給(monthly): ' + (bySalaryType.monthly?.count || 0) + '件');
    console.log('  時給(hourly): ' + (bySalaryType.hourly?.count || 0) + '件');
    console.log('  年収(annual): ' + (bySalaryType.annual?.count || 0) + '件');

    const hourlyStats = precomputed.salaryData.hourlyStats || {};
    console.log('\n  hourlyStats:');
    console.log('    count: ' + (hourlyStats.count || 0));
    console.log('    min: ' + (hourlyStats.min || 'N/A'));
    console.log('    max: ' + (hourlyStats.max || 'N/A'));
    console.log('    avg: ' + (hourlyStats.avg || 'N/A'));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('診断完了');
  console.log('═'.repeat(60));
}
