/**
 * ApiHandler.js - ダッシュボード用APIハンドラ
 * HTMLからgoogle.script.runで呼び出される関数群
 */

/**
 * ダッシュボード用の全データを取得
 * @returns {Object} ダッシュボードに必要な全集計データ
 */
function getDashboardData() {
  try {
    const aggregation = getAggregatedDataWithCache();
    return {
      success: true,
      data: aggregation
    };
  } catch (error) {
    console.error('getDashboardData error:', error);
    return {
      success: false,
      error: error.toString()
    };
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
  try {
    // キャッシュをクリア
    clearAggregationCache();

    // 再計算
    const aggregation = aggregateAllData();

    // キャッシュに保存
    const cache = CacheService.getScriptCache();
    try {
      cache.put('dashboard_aggregation', JSON.stringify(aggregation), CACHE_TTL.summary);
    } catch (e) {
      console.warn('キャッシュ保存に失敗:', e);
    }

    return {
      success: true,
      data: aggregation
    };
  } catch (error) {
    console.error('refreshDashboardData error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * ダッシュボードを新しいウィンドウで開く
 */
function openDashboard() {
  const html = HtmlService.createTemplateFromFile('Dashboard').evaluate()
    .setWidth(1600)
    .setHeight(900)
    .setTitle('求人データ ダッシュボード');

  SpreadsheetApp.getUi().showModalDialog(html, '求人データ ダッシュボード');
}
/** * 地図ビューを新しいウィンドウで開く */function openMapView() {  const html = HtmlService.createTemplateFromFile('MapView').evaluate()    .setWidth(1600)    .setHeight(900)    .setTitle('求人地図ビュー');  SpreadsheetApp.getUi().showModalDialog(html, '求人地図ビュー');}

/**
 * ダッシュボードをサイドバーで開く
 */

/**
 * 統合ビュー（ダッシュボード＋地図）を最大サイズで開く
 */
function openCombinedView() {
  const html = HtmlService.createTemplateFromFile('CombinedView').evaluate()
    .setWidth(1600)
    .setHeight(900)
    .setTitle('求人データ分析');

  SpreadsheetApp.getUi().showModalDialog(html, '求人データ分析');
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
      rawRecords: parsedData.slice(0, 100)
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
