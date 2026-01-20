/**
 * Aggregator.js - 集計ロジックモジュール
 * データを解析・集計してダッシュボード用のデータを生成
 * Phase 1最適化: DataLayerとの連携
 */

/**
 * スプレッドシートから全データを取得して解析・集計
 * DataLayerを使用して最適化
 */
function aggregateAllData() {
  return DataLayer.getAggregation();
}

/**
 * シートから生データを取得（後方互換性のため残す）
 */
function getRawDataFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const range = sheet.getRange(2, 4, lastRow - 1, 21);
  const values = range.getValues();
  const records = [];
  values.forEach((row, index) => {
    if (!row[0] && !row[3]) return;
    records.push({
      rowIndex: index + 2,
      jobTitle: row[0] || "",
      jobUrl: row[1] || "",
      isNew: row[2] || "",
      companyName: row[3] || "",
      location: row[4] || "",
      tags: row[5] || "",
      salary: row[6] || "",
      employmentType: row[7] || ""
    });
  });
  return records;
}

/**
 * 全データを解析（後方互換性のため残す）
 * @param {Array} rawData - 生データ配列
 * @param {string|null} contextPrefecture - コンテキスト都道府県（省略時は検索対象から取得）
 */
function parseAllData(rawData, contextPrefecture) {
  // コンテキスト都道府県が指定されていない場合は検索対象から取得
  const contextPref = contextPrefecture !== undefined ? contextPrefecture : getContextPrefectureFromTarget();

  return rawData.map(record => {
    const salaryParsed = parseSalary(record.salary);
    const locationParsed = parseLocationWithMaster(record.location, contextPref);
    const employmentParsed = parseEmploymentType(record.employmentType);
    const tagsParsed = parseTags(record.tags);
    return { ...record, salaryParsed, locationParsed, employmentParsed, tagsParsed };
  });
}

/** 雇用形態を解析 */
function parseEmploymentType(employmentText) {
  if (!employmentText) return { category: "不明", subcategory: "不明", code: "UN" };
  for (const keyword of EMPLOYMENT_TYPE_KEYWORDS) {
    if (employmentText.includes(keyword)) return EMPLOYMENT_TYPE_MAP[keyword];
  }
  return { category: "不明", subcategory: "不明", code: "UN" };
}

/** タグを解析 */
function parseTags(tagsText) {
  if (!tagsText) return { tags: [], categories: {} };
  const tagList = tagsText.split(/[,、]/).map(t => t.trim()).filter(t => t);
  const categories = {};
  Object.keys(TAG_CATEGORIES).forEach(cat => { categories[cat] = []; });
  categories["その他"] = [];
  tagList.forEach(tag => {
    let found = false;
    for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
      if (tags.includes(tag)) { categories[category].push(tag); found = true; break; }
    }
    if (!found) categories["その他"].push(tag);
  });
  return { tags: tagList, categories };
}

/**
 * 給与モードに応じたデータフィルタと給与値取得
 * @param {Array} parsedData - 解析済みデータ配列
 * @param {boolean} isHourly - 時給モードかどうか
 * @returns {Object} { filteredData, getSalary: (d) => 給与値 }
 */
function filterAndGetSalaryByMode(parsedData, isHourly) {
  if (isHourly) {
    // 時給モード: salaryType === 'hourly' のみ、minValue（時給円）を使用
    // 外れ値除外: 時給700円未満、5000円超は異常値として除外
    const filteredData = parsedData.filter(d =>
      d.salaryParsed &&
      d.salaryParsed.salaryType === 'hourly' &&
      d.salaryParsed.minValue !== null &&
      d.salaryParsed.minValue >= 700 &&   // 最低時給以上
      d.salaryParsed.minValue <= 5000     // 異常な高時給を除外
    );
    return {
      filteredData,
      getSalary: (d) => d.salaryParsed.minValue  // 時給（円）
    };
  } else {
    // 月給モード: salaryType === 'monthly' または 'annual' のみ、年収は÷12して月給に
    // daily等の他の種類は除外
    const filteredData = parsedData.filter(d =>
      d.salaryParsed &&
      (d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual') &&
      d.salaryParsed.minValue !== null &&
      d.salaryParsed.minValue > 0
    );
    return {
      filteredData,
      getSalary: (d) => {
        // 年収の場合は÷12、それ以外はminValueをそのまま
        if (d.salaryParsed.salaryType === 'annual') {
          return Math.round(d.salaryParsed.minValue / 12);
        }
        return d.salaryParsed.minValue;  // 月給（円）
      }
    };
  }
}

/**
 * 給与表示モードを取得
 * @returns {boolean} 時給モードならtrue
 */
function getIsHourlyMode() {
  try {
    const salaryDisplayType = PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
    return salaryDisplayType === 'hourly';
  } catch (e) {
    return false;
  }
}

/** サマリーデータを作成 */
function createSummary(parsedData) {
  const totalCount = parsedData.length;
  const newCount = parsedData.filter(d => d.isNew === "新着" || d.isNew === "NEW").length;
  const fullTimeCount = parsedData.filter(d => d.employmentParsed.category === "正規雇用").length;
  const fullTimeRate = totalCount > 0 ? Math.round((fullTimeCount / totalCount) * 100 * 10) / 10 : 0;

  // データソースタイプを取得（Indeed/求人ボックス/不明）
  let dataSourceType = 'unknown';
  let salaryDisplayType = 'monthly';
  try {
    dataSourceType = PropertiesService.getScriptProperties().getProperty('dataSourceType') || 'unknown';
    salaryDisplayType = PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
  } catch (e) {
    console.warn('プロパティ取得エラー:', e);
  }
  const isIndeed = dataSourceType === 'indeed' || dataSourceType === 'unknown';
  const isKyujinBox = dataSourceType === 'kyujin_box';
  const isHourly = salaryDisplayType === 'hourly';

  // 給与モードに応じたデータフィルタ（unifiedMonthly廃止）
  const { filteredData, getSalary } = filterAndGetSalaryByMode(parsedData, isHourly);
  const salaryValues = filteredData.map(getSalary);

  // 給与統計の計算（時給は時給、月給は月給で集計）
  let salaryStats = { mean: null, median: null, mode: null, modeRange: null, modeCount: 0, min: null, max: null, stdDev: null };
  if (salaryValues.length > 0) {
    const sorted = [...salaryValues].sort((a, b) => a - b);
    const sum = salaryValues.reduce((a, b) => a + b, 0);
    salaryStats.mean = Math.round(sum / salaryValues.length);
    salaryStats.median = sorted[Math.floor(sorted.length / 2)];
    salaryStats.min = sorted[0];
    salaryStats.max = sorted[sorted.length - 1];
    // 標準偏差
    const variance = salaryValues.reduce((acc, v) => acc + Math.pow(v - salaryStats.mean, 2), 0) / salaryValues.length;
    salaryStats.stdDev = Math.round(Math.sqrt(variance));
  }

  // 拡張統計の計算（Statistics.js の関数を使用）
  let enhancedStats = null;
  let formattedStats = null;
  if (typeof calculateEnhancedSalaryStatistics === 'function' && salaryValues.length > 0) {
    enhancedStats = calculateEnhancedSalaryStatistics(salaryValues);
    formattedStats = formatStatisticsForDisplay(enhancedStats);
  }

  return {
    totalCount, newCount,
    newRate: totalCount > 0 ? Math.round((newCount / totalCount) * 100 * 10) / 10 : 0,
    // 給与統計（時給モードなら時給、月給モードなら月給）
    avgSalary: salaryStats.mean,
    medianSalary: salaryStats.median,
    minSalary: salaryStats.min,
    maxSalary: salaryStats.max,
    stdDevSalary: salaryStats.stdDev,
    salaryDataCount: filteredData.length,
    // 後方互換性のため（月給として扱う旧プロパティ）
    avgMonthlySalary: salaryStats.mean,
    medianMonthlySalary: salaryStats.median,
    modeSalary: salaryStats.mode,
    modeRange: salaryStats.modeRange,
    modeCount: salaryStats.modeCount,
    fullTimeCount, fullTimeRate, lastUpdated: new Date().toISOString(),
    // 拡張統計（Statistics.js）
    enhancedStats: enhancedStats,
    formattedStats: formattedStats,
    // データソース情報
    dataSourceType: dataSourceType,
    isIndeed: isIndeed,
    isKyujinBox: isKyujinBox,
    hasAnnualHolidaysData: isKyujinBox,
    // 給与表示タイプ
    isHourly: isHourly
  };
}

/** 給与集計データを作成 */
function createSalaryAggregation(parsedData) {
  const isHourly = getIsHourlyMode();
  const { filteredData, getSalary } = filterAndGetSalaryByMode(parsedData, isHourly);

  // 給与値配列を取得（時給は時給円、月給は月給円）
  const salaryValues = filteredData.map(getSalary);

  // ヒストグラムの刻み幅（時給:100円、月給:1万円）
  const binSize = isHourly ? 100 : 10000;
  const histogram = createSalaryHistogram(salaryValues, binSize);

  // 給与タイプ分布（参考情報として残す）
  const typeDistribution = getSalaryTypeDistribution(filteredData.map(d => d.salaryParsed));

  // 雇用形態別の給与統計（新方式：時給/月給のまま）
  const byEmploymentType = {};
  const groupedByEmployment = groupBy(filteredData, d => d.employmentParsed.subcategory);
  Object.entries(groupedByEmployment).forEach(([type, records]) => {
    const typeSalaries = records.map(getSalary);
    if (typeSalaries.length > 0) {
      const sorted = [...typeSalaries].sort((a, b) => a - b);
      const sum = typeSalaries.reduce((a, b) => a + b, 0);
      byEmploymentType[type] = {
        count: typeSalaries.length,
        mean: Math.round(sum / typeSalaries.length),
        median: sorted[Math.floor(sorted.length / 2)],
        min: sorted[0],
        max: sorted[sorted.length - 1]
      };
    }
  });

  // 時給モードの場合は時給統計、月給モードの場合は下限・上限ヒストグラム
  let hourlyStats = null;
  let minMaxHistograms = null;

  if (isHourly) {
    // 時給モード: 時給統計を生成
    hourlyStats = createHourlyStatistics(filteredData);
  } else {
    // 月給モード: 下限・上限別ヒストグラム
    minMaxHistograms = createMinMaxHistograms(filteredData);
  }

  // 給与タイプ別の統計
  const bySalaryType = createBySalaryTypeStats(parsedData);

  return {
    histogram,
    typeDistribution,
    minMaxHistograms,
    byEmploymentType,
    validCount: filteredData.length,
    hourlyStats,
    bySalaryType,
    isHourly: isHourly,
    binSize: binSize
  };
}

/** 下限・上限別のヒストグラムを作成 */
function createMinMaxHistograms(monthlyAnnualData) {
  // 空の戻り値を定義
  var emptyResult = {
    labels: [],
    minHistogram: [],
    maxHistogram: [],
    rawMinLabels: [],
    rawMinHistogram: [],
    rawMaxLabels: [],
    rawMaxHistogram: [],
    stats: { minMean: null, minMedian: null, maxMean: null, maxMedian: null, minMode: null, maxMode: null, minCount: 0, maxCount: 0, originalMinCount: 0, originalMaxCount: 0 }
  };

  // 入力チェック
  if (!monthlyAnnualData || !Array.isArray(monthlyAnnualData) || monthlyAnnualData.length === 0) {
    return emptyResult;
  }

  var binSize = 5000; // 5000円刻み
  var trimPercent = 0.1; // 上下10%カット

  // 外れ値削除関数
  function trimOutliers(values, percent) {
    if (values.length < 5) return values; // 5件未満は削除しない
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var trimCount = Math.floor(sorted.length * percent);
    if (trimCount === 0) return values;
    return sorted.slice(trimCount, sorted.length - trimCount);
  }

  // 下限値の月給換算リスト
  var minValues = monthlyAnnualData
    .map(function(d) {
      if (!d || !d.salaryParsed) return null;
      var minVal = d.salaryParsed.minValue;
      if (minVal === null || minVal === undefined) return null;
      if (d.salaryParsed.salaryType === 'annual') {
        return Math.round(minVal / 12);
      }
      return minVal;
    })
    .filter(function(v) { return v !== null && !isNaN(v) && isFinite(v) && v > 0; });

  // 上限値の月給換算リスト（上限がない場合は下限を使用）
  var maxValues = monthlyAnnualData
    .map(function(d) {
      if (!d || !d.salaryParsed) return null;
      var max = d.salaryParsed.maxValue !== null && d.salaryParsed.maxValue !== undefined
        ? d.salaryParsed.maxValue
        : d.salaryParsed.minValue;
      if (max === null || max === undefined) return null;
      if (d.salaryParsed.salaryType === 'annual') {
        return Math.round(max / 12);
      }
      return max;
    })
    .filter(function(v) { return v !== null && !isNaN(v) && isFinite(v) && v > 0; });

  // 元の件数を保存
  var originalMinCount = minValues.length;
  var originalMaxCount = maxValues.length;

  // 外れ値削除（上下10%）
  var trimmedMinValues = trimOutliers(minValues, trimPercent);
  var trimmedMaxValues = trimOutliers(maxValues, trimPercent);

  // 共通のラベル範囲を決定（外れ値削除後）
  var allTrimmedValues = trimmedMinValues.concat(trimmedMaxValues);
  if (allTrimmedValues.length === 0) {
    return emptyResult;
  }

  // 実際のデータ範囲に基づいてラベルを生成（外れ値削除後）
  var dataMin = Math.min.apply(null, allTrimmedValues);
  var dataMax = Math.max.apply(null, allTrimmedValues);
  var minBinVal = Math.floor(dataMin / binSize) * binSize;
  var maxBinVal = Math.floor(dataMax / binSize) * binSize;

  // ラベルを生成（データ範囲に基づく、ただし下限は15万以上、上限は100万以下）
  var labels = [];
  var labelMin = Math.max(minBinVal, 150000);
  var labelMax = Math.min(maxBinVal, 1000000);
  for (var bin = labelMin; bin <= labelMax; bin += binSize) {
    labels.push((bin / 10000).toFixed(1) + '万');
  }

  // ビニング（外れ値削除後のデータを使用）
  var minBins = {};
  var maxBins = {};
  labels.forEach(function(label) {
    minBins[label] = 0;
    maxBins[label] = 0;
  });

  trimmedMinValues.forEach(function(v) {
    var label = (Math.floor(v / binSize) * binSize / 10000).toFixed(1) + '万';
    if (minBins[label] !== undefined) minBins[label]++;
  });

  trimmedMaxValues.forEach(function(v) {
    var label = (Math.floor(v / binSize) * binSize / 10000).toFixed(1) + '万';
    if (maxBins[label] !== undefined) maxBins[label]++;
  });

  // 統計値を計算（外れ値削除後）
  var sortedMin = trimmedMinValues.slice().sort(function(a, b) { return a - b; });
  var sortedMax = trimmedMaxValues.slice().sort(function(a, b) { return a - b; });

  function calcMedian(sorted) {
    if (sorted.length === 0) return null;
    var mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  }

  // 最頻値を計算（ビンの中で最も件数が多いもの）
  function calcMode(bins, labelList) {
    if (labelList.length === 0) return { value: null, label: null, count: 0 };
    var modeLabel = null;
    var modeCount = 0;
    labelList.forEach(function(label) {
      if (bins[label] > modeCount) {
        modeCount = bins[label];
        modeLabel = label;
      }
    });
    var modeValue = modeLabel ? parseFloat(modeLabel) * 10000 : null;
    return { value: modeValue, label: modeLabel, count: modeCount };
  }

  var minModeResult = calcMode(minBins, labels);
  var maxModeResult = calcMode(maxBins, labels);

  // 平均計算
  function calcSum(arr) {
    var sum = 0;
    for (var i = 0; i < arr.length; i++) { sum += arr[i]; }
    return sum;
  }

  var stats = {
    minMean: trimmedMinValues.length > 0 ? Math.round(calcSum(trimmedMinValues) / trimmedMinValues.length) : null,
    minMedian: calcMedian(sortedMin),
    minMode: minModeResult.value,
    minModeLabel: minModeResult.label,
    minModeCount: minModeResult.count,
    maxMean: trimmedMaxValues.length > 0 ? Math.round(calcSum(trimmedMaxValues) / trimmedMaxValues.length) : null,
    maxMedian: calcMedian(sortedMax),
    maxMode: maxModeResult.value,
    maxModeLabel: maxModeResult.label,
    maxModeCount: maxModeResult.count,
    minCount: trimmedMinValues.length,
    maxCount: trimmedMaxValues.length,
    originalMinCount: originalMinCount,
    originalMaxCount: originalMaxCount
  };

  // 生データ版（ビニングなし）のヒストグラムを作成（外れ値削除後）
  var minRawCounts = {};
  trimmedMinValues.forEach(function(v) {
    minRawCounts[v] = (minRawCounts[v] || 0) + 1;
  });
  var minRawLabelsNum = Object.keys(minRawCounts).map(Number).sort(function(a, b) { return a - b; });
  var minRawHistogram = minRawLabelsNum.map(function(v) { return minRawCounts[v]; });
  var minRawLabelsFormatted = minRawLabelsNum.map(function(v) { return (v / 10000).toFixed(1) + '万'; });

  var maxRawCounts = {};
  trimmedMaxValues.forEach(function(v) {
    maxRawCounts[v] = (maxRawCounts[v] || 0) + 1;
  });
  var maxRawLabelsNum = Object.keys(maxRawCounts).map(Number).sort(function(a, b) { return a - b; });
  var maxRawHistogram = maxRawLabelsNum.map(function(v) { return maxRawCounts[v]; });
  var maxRawLabelsFormatted = maxRawLabelsNum.map(function(v) { return (v / 10000).toFixed(1) + '万'; });

  return {
    labels: labels,
    minHistogram: labels.map(function(l) { return minBins[l]; }),
    maxHistogram: labels.map(function(l) { return maxBins[l]; }),
    rawMinLabels: minRawLabelsFormatted,
    rawMinHistogram: minRawHistogram,
    rawMaxLabels: maxRawLabelsFormatted,
    rawMaxHistogram: maxRawHistogram,
    stats: stats
  };
}

/** 時給データの統計を作成（下限・上限別ヒストグラム対応、50円刻み） */
function createHourlyStatistics(hourlyData) {
  const emptyResult = {
    count: 0,
    histogram: { labels: [], values: [] },
    minMaxHistograms: { labels: [], minHistogram: [], maxHistogram: [], stats: {} }
  };

  if (hourlyData.length === 0) {
    return emptyResult;
  }

  const binSize = 50; // 50円刻み

  // 下限値リスト
  const minValues = hourlyData
    .map(d => d.salaryParsed && d.salaryParsed.minValue)
    .filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v) && v > 0);

  // 上限値リスト（上限がない場合は下限を使用）
  const maxValues = hourlyData
    .map(d => {
      if (!d.salaryParsed) return null;
      const max = d.salaryParsed.maxValue;
      const min = d.salaryParsed.minValue;
      return (max !== null && max !== undefined) ? max : min;
    })
    .filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v) && v > 0);

  // フィルタ後に空になった場合
  if (minValues.length === 0 && maxValues.length === 0) {
    return emptyResult;
  }

  // ラベル範囲を決定
  const allValues = [...minValues, ...maxValues];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const minBin = Math.floor(dataMin / binSize) * binSize;
  const maxBin = Math.floor(dataMax / binSize) * binSize;

  // ラベル生成
  const labels = [];
  for (let bin = minBin; bin <= maxBin; bin += binSize) {
    labels.push(bin + '円');
  }

  // ビニング
  const minBins = {};
  const maxBins = {};
  labels.forEach(label => {
    minBins[label] = 0;
    maxBins[label] = 0;
  });

  minValues.forEach(v => {
    const label = (Math.floor(v / binSize) * binSize) + '円';
    if (minBins[label] !== undefined) minBins[label]++;
  });

  maxValues.forEach(v => {
    const label = (Math.floor(v / binSize) * binSize) + '円';
    if (maxBins[label] !== undefined) maxBins[label]++;
  });

  // 統計値を計算
  const sortedMin = [...minValues].sort((a, b) => a - b);
  const sortedMax = [...maxValues].sort((a, b) => a - b);

  const calcMedian = (sorted) => {
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  };

  // 最頻値を計算
  const calcMode = (binData, labelList) => {
    if (labelList.length === 0) return { value: null, label: null, count: 0 };
    let modeLabel = null;
    let modeCount = 0;
    labelList.forEach(label => {
      if (binData[label] > modeCount) {
        modeCount = binData[label];
        modeLabel = label;
      }
    });
    const modeValue = modeLabel ? parseInt(modeLabel) : null;
    return { value: modeValue, label: modeLabel, count: modeCount };
  };

  const minModeResult = calcMode(minBins, labels);
  const maxModeResult = calcMode(maxBins, labels);

  const minMaxStats = {
    minMean: minValues.length > 0 ? Math.round(minValues.reduce((a, b) => a + b, 0) / minValues.length) : null,
    minMedian: calcMedian(sortedMin),
    minMode: minModeResult.value,
    minModeLabel: minModeResult.label,
    minModeCount: minModeResult.count,
    maxMean: maxValues.length > 0 ? Math.round(maxValues.reduce((a, b) => a + b, 0) / maxValues.length) : null,
    maxMedian: calcMedian(sortedMax),
    maxMode: maxModeResult.value,
    maxModeLabel: maxModeResult.label,
    maxModeCount: maxModeResult.count,
    minCount: minValues.length,
    maxCount: maxValues.length
  };

  // 従来の中央値ベースのヒストグラムも生成（後方互換性）
  const hourlyValues = hourlyData
    .map(d => {
      if (!d.salaryParsed) return null;
      const min = d.salaryParsed.minValue;
      const max = d.salaryParsed.maxValue;
      return max ? (min + max) / 2 : min;
    })
    .filter(v => v !== null && !isNaN(v) && isFinite(v));

  const bins = {};
  hourlyValues.forEach(value => {
    const binStart = Math.floor(value / binSize) * binSize;
    const binLabel = binStart + '円';
    bins[binLabel] = (bins[binLabel] || 0) + 1;
  });
  const sortedBins = Object.entries(bins).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  const sorted = [...hourlyValues].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  // 🔴 FIX: 生データヒストグラムを追加（rawMinLabels, rawMaxLabels）
  // 下限の生データ
  const minRawCounts = {};
  minValues.forEach(v => {
    minRawCounts[v] = (minRawCounts[v] || 0) + 1;
  });
  const minRawLabelsNum = Object.keys(minRawCounts).map(Number).sort((a, b) => a - b);
  const rawMinHistogram = minRawLabelsNum.map(v => minRawCounts[v]);
  const rawMinLabels = minRawLabelsNum.map(v => v + '円');

  // 上限の生データ
  const maxRawCounts = {};
  maxValues.forEach(v => {
    maxRawCounts[v] = (maxRawCounts[v] || 0) + 1;
  });
  const maxRawLabelsNum = Object.keys(maxRawCounts).map(Number).sort((a, b) => a - b);
  const rawMaxHistogram = maxRawLabelsNum.map(v => maxRawCounts[v]);
  const rawMaxLabels = maxRawLabelsNum.map(v => v + '円');

  return {
    count: hourlyValues.length,
    min: hourlyValues.length > 0 ? Math.round(sorted[0]) : null,
    max: hourlyValues.length > 0 ? Math.round(sorted[sorted.length - 1]) : null,
    avg: hourlyValues.length > 0 ? Math.round(sum / hourlyValues.length) : null,
    median: hourlyValues.length > 0 ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null,
    histogram: {
      labels: sortedBins.map(b => b[0]),
      values: sortedBins.map(b => b[1])
    },
    minMaxHistograms: {
      labels,
      minHistogram: labels.map(l => minBins[l]),
      maxHistogram: labels.map(l => maxBins[l]),
      rawMinLabels,
      rawMinHistogram,
      rawMaxLabels,
      rawMaxHistogram,
      stats: minMaxStats
    },
    conversionNote: '月給換算: 時給 × ' + SALARY_CONVERSION_RATES.hourly_to_monthly + '時間（8h×20日）'
  };
}

/** 給与タイプ別の統計を作成 */
function createBySalaryTypeStats(parsedData) {
  const types = ['hourly', 'daily', 'monthly', 'annual'];
  const stats = {};

  types.forEach(type => {
    const typeData = parsedData.filter(d => d.salaryParsed.salaryType === type && d.salaryParsed.minValue !== null);
    if (typeData.length === 0) {
      stats[type] = { count: 0 };
      return;
    }

    // 値を抽出し、null/NaN/Infinityを除外
    const values = typeData
      .map(d => {
        const min = d.salaryParsed.minValue;
        const max = d.salaryParsed.maxValue;
        return max ? (min + max) / 2 : min;
      })
      .filter(v => v !== null && !isNaN(v) && isFinite(v));

    // フィルタ後に空になった場合
    if (values.length === 0) {
      stats[type] = { count: 0 };
      return;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    stats[type] = {
      count: values.length,
      min: Math.round(sorted[0]),
      max: Math.round(sorted[sorted.length - 1]),
      avg: Math.round(sum / values.length),
      median: Math.round(sorted[Math.floor(sorted.length / 2)])
    };
  });

  return stats;
}

/** 給与ヒストグラムを作成 */
function createSalaryHistogram(values, binSize) {
  const bins = {};
  values.forEach(value => {
    if (value === null) return;
    const binStart = Math.floor(value / binSize) * binSize;
    const binLabel = (binStart / 10000) + "万";
    bins[binLabel] = (bins[binLabel] || 0) + 1;
  });
  const sortedBins = Object.entries(bins).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
  return { labels: sortedBins.map(b => b[0]), values: sortedBins.map(b => b[1]) };
}

/** 所在地集計データを作成 */
function createLocationAggregation(parsedData) {
  const parsedLocations = parsedData.map(d => d.locationParsed);
  return {
    prefectureDistribution: getPrefectureDistribution(parsedLocations),
    regionBlockDistribution: getRegionBlockDistribution(parsedLocations),
    cityTypeDistribution: getCityTypeDistribution(parsedLocations),
    topCities: getTopCitiesDistribution(parsedLocations, 15)
  };
}

/**
 * 地域別×給与クロス分析データを作成
 * @param {Array} parsedData - 解析済みデータ
 * @returns {Object} 地域別給与分析結果
 */
function createRegionSalaryAnalysis(parsedData) {
  const isHourly = getIsHourlyMode();

  // 給与モードに応じたフィルタ＋地域データがあるレコードのみ
  const { filteredData, getSalary } = filterAndGetSalaryByMode(parsedData, isHourly);
  const validData = filteredData.filter(d => d.locationParsed && d.locationParsed.prefecture);

  if (validData.length === 0) {
    return { prefectureSalary: {}, regionBlockSalary: {}, hasData: false, isHourly };
  }

  // 統計計算関数（外れ値補正あり：時給モードは15%、月給モードは10%トリミング）
  const trimRate = isHourly ? 0.15 : 0.1; // 時給は外れ値が多いため強めのトリミング
  const calcStats = (arr) => {
    if (arr.length === 0) return { avg: null, median: null };
    const sorted = [...arr].sort((a, b) => a - b);
    let trimmed = sorted;
    if (sorted.length >= 5) {
      const trimCount = Math.floor(sorted.length * trimRate);
      if (trimCount > 0) {
        trimmed = sorted.slice(trimCount, sorted.length - trimCount);
      }
    }
    const avg = trimmed.length > 0 ? Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length) : null;
    const median = trimmed[Math.floor(trimmed.length / 2)];
    return { avg, median: Math.round(median) };
  };

  // 都道府県別集計（時給は時給、月給は月給のまま）
  const prefectureData = {};
  validData.forEach(d => {
    const pref = d.locationParsed.prefecture;
    const salary = getSalary(d);
    const minVal = d.salaryParsed.minValue;
    const maxVal = d.salaryParsed.maxValue;

    if (!prefectureData[pref]) {
      prefectureData[pref] = { salaries: [], minValues: [], maxValues: [] };
    }
    prefectureData[pref].salaries.push(salary);
    if (minVal !== null) prefectureData[pref].minValues.push(minVal);
    if (maxVal !== null) prefectureData[pref].maxValues.push(maxVal);
  });

  // 都道府県別統計
  const prefectureSalary = {};
  Object.entries(prefectureData).forEach(([pref, data]) => {
    const salaryStats = calcStats(data.salaries);
    const minStats = calcStats(data.minValues);
    const maxStats = calcStats(data.maxValues);
    prefectureSalary[pref] = {
      count: data.salaries.length,
      avgSalary: salaryStats.avg,
      medianSalary: salaryStats.median,
      avgMin: minStats.avg,
      avgMax: maxStats.avg
    };
  });

  // 地域ブロック別集計
  const regionBlockData = {};
  validData.forEach(d => {
    const block = d.locationParsed.regionBlock || '不明';
    const salary = getSalary(d);
    const minVal = d.salaryParsed.minValue;
    const maxVal = d.salaryParsed.maxValue;

    if (!regionBlockData[block]) {
      regionBlockData[block] = { salaries: [], minValues: [], maxValues: [] };
    }
    regionBlockData[block].salaries.push(salary);
    if (minVal !== null) regionBlockData[block].minValues.push(minVal);
    if (maxVal !== null) regionBlockData[block].maxValues.push(maxVal);
  });

  // 地域ブロック別統計
  const regionBlockSalary = {};
  Object.entries(regionBlockData).forEach(([block, data]) => {
    const salaryStats = calcStats(data.salaries);
    const minStats = calcStats(data.minValues);
    const maxStats = calcStats(data.maxValues);
    regionBlockSalary[block] = {
      count: data.salaries.length,
      avgSalary: salaryStats.avg,
      medianSalary: salaryStats.median,
      avgMin: minStats.avg,
      avgMax: maxStats.avg
    };
  });

  // ソート（件数順）
  const sortedPrefecture = Object.entries(prefectureSalary)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);
  const sortedRegionBlock = Object.entries(regionBlockSalary)
    .sort((a, b) => b[1].count - a[1].count);

  return {
    hasData: true,
    totalWithData: validData.length,
    isHourly: isHourly,
    prefectureSalary: Object.fromEntries(sortedPrefecture),
    prefectureSalaryList: sortedPrefecture.map(([name, data]) => ({ name, ...data })),
    regionBlockSalary: regionBlockSalary,
    regionBlockSalaryList: sortedRegionBlock.map(([name, data]) => ({ name, ...data }))
  };
}

/** 雇用形態集計データを作成 */
function createEmploymentAggregation(parsedData) {
  const categoryDistribution = {};
  const subcategoryDistribution = {};
  parsedData.forEach(d => {
    const cat = d.employmentParsed.category;
    const subcat = d.employmentParsed.subcategory;
    categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    subcategoryDistribution[subcat] = (subcategoryDistribution[subcat] || 0) + 1;
  });
  return { categoryDistribution, subcategoryDistribution };
}

/** タグ集計データを作成 */
function createTagAggregation(parsedData) {
  const tagFrequency = {};
  const categoryFrequency = {};
  Object.keys(TAG_CATEGORIES).forEach(cat => { categoryFrequency[cat] = {}; });
  categoryFrequency["その他"] = {};

  // 無効なタグを判定する関数（「8+」「10+」等の数値+記号パターンを除外）
  const isInvalidTag = (tag) => {
    if (!tag || typeof tag !== 'string') return true;
    // 数字+「+」のパターン（例：8+, 10+, 3+）を除外
    if (/^\d+\+$/.test(tag.trim())) return true;
    // 短すぎるタグを除外
    if (tag.trim().length < 2) return true;
    return false;
  };

  parsedData.forEach(d => {
    d.tagsParsed.tags.forEach(tag => {
      if (isInvalidTag(tag)) return; // 無効タグをスキップ
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });
    Object.entries(d.tagsParsed.categories).forEach(([category, tags]) => {
      tags.forEach(tag => {
        if (isInvalidTag(tag)) return; // 無効タグをスキップ
        if (!categoryFrequency[category]) categoryFrequency[category] = {};
        categoryFrequency[category][tag] = (categoryFrequency[category][tag] || 0) + 1;
      });
    });
  });
  const topTags = Object.entries(tagFrequency)
    .filter(([tag]) => !isInvalidTag(tag)) // 念のため再フィルタ
    .sort((a, b) => b[1] - a[1]).slice(0, 30).map(([tag, count]) => ({ tag, count }));
  const categoryTotals = {};
  Object.entries(categoryFrequency).forEach(([category, tags]) => {
    categoryTotals[category] = Object.values(tags).reduce((sum, count) => sum + count, 0);
  });
  return { tagFrequency, categoryFrequency, topTags, categoryTotals };
}

/**
 * タグカテゴリ別の平均給与を集計
 * @param {Array} parsedData - 解析済み求人データ
 * @returns {Object} カテゴリ別平均給与データ
 */
function createCategorySalaryAggregation(parsedData) {
  const categoryData = {};
  const isHourly = getIsHourlyMode();

  // 給与モードに応じたデータフィルタ（unifiedMonthly廃止）
  const { filteredData, getSalary } = filterAndGetSalaryByMode(parsedData, isHourly);

  filteredData.forEach(d => {
    const salary = getSalary(d);
    const categories = d.tagsParsed?.categories || {};

    // 各カテゴリに対して集計
    Object.entries(categories).forEach(([category, tags]) => {
      if (tags && tags.length > 0) {
        if (!categoryData[category]) {
          categoryData[category] = { totalSalary: 0, count: 0 };
        }
        categoryData[category].totalSalary += salary;
        categoryData[category].count += 1;
      }
    });
  });

  // 平均給与を計算
  const result = {};
  Object.entries(categoryData).forEach(([category, data]) => {
    if (data.count > 0) {
      result[category] = {
        avgSalary: Math.round(data.totalSalary / data.count),
        count: data.count
      };
    }
  });

  return result;
}

/**
 * 年間休日データの集計を作成
 * @param {Array} parsedData - 解析済み求人データ
 * @returns {Object} 年間休日集計データ
 */
function createAnnualHolidaysAggregation(parsedData) {
  var validData = parsedData.filter(function(d) {
    var holidays = parseInt(d.annualHolidays);
    return !isNaN(holidays) && holidays >= 50 && holidays <= 200;
  });

  if (validData.length === 0) {
    return {
      hasData: false,
      validCount: 0,
      totalCount: parsedData.length,
      stats: null,
      distribution: {},
      categoryDistribution: {},
      salaryCorrelation: null
    };
  }

  var holidayValues = validData.map(function(d) { return parseInt(d.annualHolidays); });
  var sorted = holidayValues.slice().sort(function(a, b) { return a - b; });
  var sum = sorted.reduce(function(a, b) { return a + b; }, 0);
  var count = sorted.length;
  var mean = sum / count;

  var variance = sorted.reduce(function(acc, v) { return acc + Math.pow(v - mean, 2); }, 0) / count;
  var stats = {
    mean: Math.round(mean * 10) / 10,
    median: sorted[Math.floor(count / 2)],
    min: sorted[0],
    max: sorted[count - 1],
    stdDev: Math.round(Math.sqrt(variance) * 10) / 10
  };

  var distribution = {};
  holidayValues.forEach(function(v) {
    var bin = Math.floor(v / 5) * 5;
    var label = bin + '日';
    distribution[label] = (distribution[label] || 0) + 1;
  });

  var categoryDistribution = {};
  ANNUAL_HOLIDAYS_RANGES.forEach(function(range) {
    categoryDistribution[range.label] = 0;
  });

  holidayValues.forEach(function(v) {
    var category = getAnnualHolidaysCategory(v);
    if (category) {
      categoryDistribution[category.label] = (categoryDistribution[category.label] || 0) + 1;
    }
  });

  var salaryCorrelation = calculateSalaryHolidaysCorrelationForHolidays(validData);

  return {
    hasData: true,
    validCount: count,
    totalCount: parsedData.length,
    stats: stats,
    distribution: distribution,
    categoryDistribution: categoryDistribution,
    salaryCorrelation: salaryCorrelation
  };
}

/**
 * 給与帯別の年間休日平均を計算（年間休日用）
 * 下限給与、上限給与で分析（月給・年収データのみ、時給は除外）
 * unifiedMonthly廃止により、minValue/maxValueを直接使用（年収は÷12）
 */
function calculateSalaryHolidaysCorrelationForHolidays(validData) {
  // 月給換算ヘルパー（年収は÷12）
  function toMonthlyValue(d, valueType) {
    var value = valueType === 'min' ? d.salaryParsed.minValue : d.salaryParsed.maxValue;
    if (!value || value <= 0) return null;
    if (d.salaryParsed.salaryType === 'annual') {
      return value / 12;
    }
    return value; // monthly
  }

  // minValueベースのフィルタ（月給・年収のみ）
  var dataWithAvgSalary = validData.filter(function(d) {
    if (!d.salaryParsed || !d.salaryParsed.minValue || d.salaryParsed.minValue <= 0) return false;
    return d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual';
  });

  // 下限給与（minValue）でのビンニング - 月給換算
  var dataWithMinSalary = validData.filter(function(d) {
    if (!d.salaryParsed || !d.salaryParsed.minValue || d.salaryParsed.minValue <= 0) return false;
    // 時給は除外（月給・年収のみ対象）
    return d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual';
  });

  // 上限給与（maxValue）でのビンニング - 月給換算
  var dataWithMaxSalary = validData.filter(function(d) {
    if (!d.salaryParsed || !d.salaryParsed.maxValue || d.salaryParsed.maxValue <= 0) return false;
    return d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual';
  });

  // 給与値を月給に変換するヘルパー
  function toMonthly(value, salaryType) {
    if (salaryType === 'annual') {
      return value / 12;
    }
    return value; // monthly
  }

  // ビンニング処理の共通関数
  function createBins(data, getSalary) {
    var bins = {};
    data.forEach(function(d) {
      var salary = getSalary(d);
      if (!salary || salary <= 0) return;
      // 5万円刻みでビニング（見やすさのため）
      var bin = Math.floor(salary / 50000) * 50000;
      var label = Math.round(bin / 10000) + '万';
      if (!bins[label]) {
        bins[label] = { holidays: [], salaryBin: bin };
      }
      bins[label].holidays.push(parseInt(d.annualHolidays));
    });

    var result = {};
    Object.keys(bins).forEach(function(label) {
      var holidays = bins[label].holidays;
      var sum = holidays.reduce(function(a, b) { return a + b; }, 0);
      result[label] = {
        count: holidays.length,
        mean: Math.round(sum / holidays.length * 10) / 10,
        salaryBin: bins[label].salaryBin
      };
    });
    return result;
  }

  // 下限給与でのビンニング（minValueベース、年収は÷12）
  var avgResult = createBins(dataWithAvgSalary, function(d) {
    return toMonthlyValue(d, 'min');
  });

  // 下限給与でのビンニング（月給換算）
  var minResult = createBins(dataWithMinSalary, function(d) {
    return toMonthly(d.salaryParsed.minValue, d.salaryParsed.salaryType);
  });

  // 上限給与でのビンニング（月給換算）
  var maxResult = createBins(dataWithMaxSalary, function(d) {
    return toMonthly(d.salaryParsed.maxValue, d.salaryParsed.salaryType);
  });

  // 有効データがあるかチェック
  if (Object.keys(avgResult).length === 0 &&
      Object.keys(minResult).length === 0 &&
      Object.keys(maxResult).length === 0) {
    return null;
  }

  return {
    average: avgResult,      // 平均給与×年間休日
    minSalary: minResult,    // 下限給与×年間休日
    maxSalary: maxResult,    // 上限給与×年間休日
    // 後方互換性のため旧フォーマットも含める
    legacy: avgResult
  };
}

/**
 * 給与ビニングデータを作成（詳細分布用）
 * 月給: 5000円刻み、時給: 50円刻み
 * unifiedMonthly廃止: minValue使用（年収は÷12で月給換算）
 */
function createSalaryBinningData(parsedData) {
  // 月給ビニング（5000円刻み）- 月給・年収データ対象
  var monthlyData = parsedData.filter(function(d) {
    return d.salaryParsed &&
           (d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual') &&
           d.salaryParsed.minValue && d.salaryParsed.minValue > 0;
  });

  var monthlyBins = {};
  var monthlyValues = [];

  monthlyData.forEach(function(d) {
    // 年収は÷12で月給換算
    var salary = d.salaryParsed.salaryType === 'annual'
      ? Math.round(d.salaryParsed.minValue / 12)
      : d.salaryParsed.minValue;
    monthlyValues.push(salary);
    // 5000円刻みでビニング
    var bin = Math.floor(salary / 5000) * 5000;
    var label = Math.round(bin / 10000) + '万';
    monthlyBins[bin] = (monthlyBins[bin] || 0) + 1;
  });

  // 月給統計
  var monthlyStats = calculateBinningStats(monthlyValues, 'monthly');

  // ソートしてラベルと値の配列を作成
  var sortedMonthlyBins = Object.keys(monthlyBins)
    .map(Number)
    .sort(function(a, b) { return a - b; });

  var monthlyLabels = sortedMonthlyBins.map(function(bin) {
    return Math.round(bin / 10000) + '万';
  });
  var monthlyVals = sortedMonthlyBins.map(function(bin) {
    return monthlyBins[bin];
  });

  // 時給ビニング（50円刻み）
  var hourlyData = parsedData.filter(function(d) {
    return d.salaryParsed && d.salaryParsed.salaryType === 'hourly' &&
           d.salaryParsed.minValue && d.salaryParsed.minValue > 0 && d.salaryParsed.minValue < 5000;
  });

  var hourlyBins = {};
  var hourlyValues = [];

  hourlyData.forEach(function(d) {
    var salary = d.salaryParsed.minValue;
    hourlyValues.push(salary);
    // 50円刻みでビニング
    var bin = Math.floor(salary / 50) * 50;
    var label = bin + '円';
    hourlyBins[bin] = (hourlyBins[bin] || 0) + 1;
  });

  // 時給統計
  var hourlyStats = calculateBinningStats(hourlyValues, 'hourly');

  // ソートしてラベルと値の配列を作成
  var sortedHourlyBins = Object.keys(hourlyBins)
    .map(Number)
    .sort(function(a, b) { return a - b; });

  var hourlyLabels = sortedHourlyBins.map(function(bin) {
    return bin + '円';
  });
  var hourlyVals = sortedHourlyBins.map(function(bin) {
    return hourlyBins[bin];
  });

  return {
    monthly: {
      labels: monthlyLabels,
      values: monthlyVals,
      stats: monthlyStats
    },
    hourly: {
      labels: hourlyLabels,
      values: hourlyVals,
      stats: hourlyStats
    }
  };
}

/**
 * ビニング統計を計算
 */
function calculateBinningStats(values, type) {
  if (values.length === 0) {
    return { count: 0, mean: null, median: null, modeLabel: null };
  }

  var sorted = values.slice().sort(function(a, b) { return a - b; });
  var sum = sorted.reduce(function(a, b) { return a + b; }, 0);
  var count = sorted.length;
  var mean = Math.round(sum / count);
  var median = sorted[Math.floor(count / 2)];

  // 最頻値を計算
  var binSize = type === 'monthly' ? 5000 : 50;
  var bins = {};
  values.forEach(function(v) {
    var bin = Math.floor(v / binSize) * binSize;
    bins[bin] = (bins[bin] || 0) + 1;
  });

  var maxCount = 0;
  var modeBin = null;
  Object.keys(bins).forEach(function(bin) {
    if (bins[bin] > maxCount) {
      maxCount = bins[bin];
      modeBin = parseInt(bin);
    }
  });

  var modeLabel = null;
  if (modeBin !== null) {
    if (type === 'monthly') {
      modeLabel = Math.round(modeBin / 10000) + '万円';
    } else {
      modeLabel = modeBin + '円';
    }
  }

  var meanFormatted = type === 'monthly'
    ? Math.round(mean / 10000) + '万円'
    : mean.toLocaleString();
  var medianFormatted = type === 'monthly'
    ? Math.round(median / 10000) + '万円'
    : median.toLocaleString();

  return {
    count: count,
    mean: meanFormatted,
    median: medianFormatted,
    modeLabel: modeLabel,
    // グラフ描画用の生値
    meanRaw: mean,
    medianRaw: median,
    modeRaw: modeBin
  };
}

/** 空の集計結果を作成 */
function createEmptyAggregation() {
  return {
    summary: {
      totalCount: 0, newCount: 0, newRate: 0,
      avgMonthlySalary: null, medianMonthlySalary: null,
      modeSalary: null, modeRange: null, modeCount: 0,
      minSalary: null, maxSalary: null, stdDevSalary: null,
      fullTimeCount: 0, fullTimeRate: 0, lastUpdated: new Date().toISOString()
    },
    salaryData: { rangeDistribution: {}, typeDistribution: {},
      histogram: { labels: [], values: [] }, byEmploymentType: {}, validCount: 0 },
    locationData: { prefectureDistribution: { all: {}, nonZero: {} },
      regionBlockDistribution: {}, cityTypeDistribution: {}, topCities: {} },
    employmentData: { categoryDistribution: {}, subcategoryDistribution: {} },
    tagData: { tagFrequency: {}, categoryFrequency: {}, topTags: [], categoryTotals: {} },
    rawRecords: []
  };
}

/** グループ化ユーティリティ */
function groupBy(array, keyFn) {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {});
}

/**
 * キャッシュを使用した集計データ取得（DataLayer使用）
 * キャッシュの鮮度を確認し、永続化データより古い場合は再取得
 * 常に有効なデータを返すことを保証する防御的実装
 */
function getAggregatedDataWithCache() {
  try {
    // 永続化データのタイムスタンプを確認
    const metadata = DataPersistence.loadMetadata();
    let persistenceTime = 0;
    if (metadata && metadata.lastUpdated) {
      try {
        persistenceTime = new Date(metadata.lastUpdated).getTime();
        // 無効な日付の場合は0にリセット
        if (isNaN(persistenceTime)) {
          console.warn('無効なlastUpdated値:', metadata.lastUpdated);
          persistenceTime = 0;
        }
      } catch (e) {
        console.warn('lastUpdatedパースエラー:', e);
        persistenceTime = 0;
      }
    }

    // スクリプトキャッシュを確認（スプレッドシート固有キー）
    const cache = CacheService.getScriptCache();
    const cacheKey = DataLayer.getCacheKey('dashboard_aggregation');
    const cachedStr = cache.get(cacheKey);

    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        // キャッシュの有効性チェック
        if (cached && cached.summary) {
          const cacheTime = cached._cacheTimestamp || 0;

          // 永続化データの方が新しい場合は再取得
          if (persistenceTime > cacheTime) {
            console.log('キャッシュが古い（永続化: ' + (metadata ? metadata.lastUpdated : 'N/A') + '）- 再取得');
            const freshData = DataLayer.getAggregation(true);
            // nullチェック
            if (freshData && freshData.summary) {
              return freshData;
            }
            console.warn('再取得でも有効データなし - キャッシュを使用');
            return cached;
          }

          console.log('スクリプトキャッシュを使用');
          return cached;
        } else {
          console.warn('キャッシュデータが不完全 - 再取得');
        }
      } catch (e) {
        console.warn('キャッシュのパースに失敗:', e);
      }
    }

    // キャッシュがない場合は最新データを取得（forceRefresh=true）
    console.log('キャッシュなし - 最新データを取得');
    let aggregation = DataLayer.getAggregation(true);

    // nullまたは不完全な場合はforceRefreshで再試行
    if (!aggregation || !aggregation.summary) {
      console.log('データが不完全 - forceRefreshで再試行');
      aggregation = DataLayer.getAggregation(true);
    }

    // それでもnullの場合は空の集計を返す
    if (!aggregation || !aggregation.summary) {
      console.warn('有効なデータを取得できません - 空の集計を返します');
      return createEmptyAggregation();
    }

    // タイムスタンプを追加してキャッシュ（スプレッドシート固有キー）
    aggregation._cacheTimestamp = Date.now();
    try {
      const saveKey = DataLayer.getCacheKey('dashboard_aggregation');
      cache.put(saveKey, JSON.stringify(aggregation), 21600);
      console.log('スクリプトキャッシュに保存完了 (key=' + saveKey + ')');
    } catch (e) {
      console.warn('キャッシュ保存に失敗:', e);
    }

    return aggregation;
  } catch (error) {
    console.error('getAggregatedDataWithCache 例外:', error);
    // 最終フォールバック: 空の集計を返す
    return createEmptyAggregation();
  }
}

/** キャッシュをクリア（スプレッドシート固有） */
function clearAggregationCache() {
  const cache = CacheService.getScriptCache();
  const cacheKey = DataLayer.getCacheKey('dashboard_aggregation');
  cache.remove(cacheKey);
  DataLayer.clearCache();
}

/**
 * 企業分析データを作成
 * @param {Array} parsedData - 解析済みデータ
 * @returns {Object} 企業分析結果
 */
function createCompanyAggregation(parsedData) {
  const isHourly = getIsHourlyMode();
  const { filteredData, getSalary } = filterAndGetSalaryByMode(parsedData, isHourly);

  const companyData = {};

  // 企業ごとにデータを集計（給与モードに応じたデータのみ）
  filteredData.forEach(d => {
    const companyName = d.companyName || '不明';
    if (companyName === '' || companyName === '不明') return;

    if (!companyData[companyName]) {
      companyData[companyName] = {
        name: companyName,
        count: 0,
        salaries: [],
        minValues: [],
        maxValues: [],
        rangeWidths: [],
        locations: {},
        employmentTypes: {},
        tags: {},
        newCount: 0
      };
    }

    const company = companyData[companyName];
    company.count++;

    // 給与データ（時給は時給、月給は月給のまま）
    const salary = getSalary(d);
    company.salaries.push(salary);

    // minValue/maxValueも年収の場合は月給換算
    const isAnnual = d.salaryParsed.salaryType === 'annual';
    if (d.salaryParsed.minValue !== null) {
      const minVal = isAnnual && !isHourly ? Math.round(d.salaryParsed.minValue / 12) : d.salaryParsed.minValue;
      company.minValues.push(minVal);
    }
    if (d.salaryParsed.maxValue !== null) {
      const maxVal = isAnnual && !isHourly ? Math.round(d.salaryParsed.maxValue / 12) : d.salaryParsed.maxValue;
      company.maxValues.push(maxVal);
    }
    if (d.salaryParsed.minValue !== null && d.salaryParsed.maxValue !== null) {
      const minVal = isAnnual && !isHourly ? Math.round(d.salaryParsed.minValue / 12) : d.salaryParsed.minValue;
      const maxVal = isAnnual && !isHourly ? Math.round(d.salaryParsed.maxValue / 12) : d.salaryParsed.maxValue;
      const width = maxVal - minVal;
      if (width > 0) company.rangeWidths.push(width);
    }

    // 勤務地
    const cityWard = d.locationParsed?.cityWard;
    if (cityWard) company.locations[cityWard] = (company.locations[cityWard] || 0) + 1;

    // 雇用形態
    const empType = d.employmentParsed?.subcategory || '不明';
    company.employmentTypes[empType] = (company.employmentTypes[empType] || 0) + 1;

    // タグ
    if (d.tagsParsed && d.tagsParsed.tags) {
      d.tagsParsed.tags.forEach(tag => {
        company.tags[tag] = (company.tags[tag] || 0) + 1;
      });
    }

    // 新着
    if (d.isNew === '新着' || d.isNew === 'NEW') company.newCount++;
  });

  // 中央値計算ヘルパー
  const calcMedian = (arr) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  };

  // 統計計算と整形
  const companyList = Object.values(companyData).map(company => {
    const avgSalary = company.salaries.length > 0
      ? Math.round(company.salaries.reduce((a, b) => a + b, 0) / company.salaries.length)
      : null;

    const minMedian = calcMedian(company.minValues);
    const maxMedian = calcMedian(company.maxValues);
    const avgRangeWidth = company.rangeWidths.length > 0
      ? Math.round(company.rangeWidths.reduce((a, b) => a + b, 0) / company.rangeWidths.length)
      : null;

    const topLocations = Object.entries(company.locations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([loc, cnt]) => ({ location: loc, count: cnt }));

    const topEmploymentType = Object.entries(company.employmentTypes)
      .sort((a, b) => b[1] - a[1])[0];

    const topTags = Object.entries(company.tags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, cnt]) => tag);

    return {
      name: company.name,
      jobCount: company.count,
      avgSalary: avgSalary,
      minMedian: minMedian,
      maxMedian: maxMedian,
      avgRangeWidth: avgRangeWidth,
      topLocations: topLocations,
      mainEmploymentType: topEmploymentType ? topEmploymentType[0] : '不明',
      topTags: topTags,
      newCount: company.newCount,
      newRate: company.count > 0 ? Math.round((company.newCount / company.count) * 100) : 0
    };
  });

  const sortedByCount = [...companyList].sort((a, b) => b.jobCount - a.jobCount).slice(0, 15);
  const sortedBySalary = [...companyList]
    .filter(c => c.avgSalary !== null)
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 15);

  return {
    topByCount: sortedByCount,
    topBySalary: sortedBySalary,
    totalCompanies: companyList.length,
    isHourly: isHourly
  };
}

/**
 * タグと給与の相関分析データを作成
 * @param {Array} parsedData - 解析済みデータ
 * @returns {Object} タグ×給与相関分析結果
 */
function createTagSalaryCorrelation(parsedData) {
  const isHourly = getIsHourlyMode();

  // 給与モードに応じたフィルタ（時給モードは時給のみ、月給モードは月給のみ）
  const { filteredData, getSalary } = filterAndGetSalaryByMode(parsedData, isHourly);

  if (filteredData.length === 0) {
    return { tagCorrelations: [], overallAvg: null, combinations: [], isHourly };
  }

  // 外れ値補正付き平均計算（時給モードは15%、月給モードは10%トリミング）
  const trimRate = isHourly ? 0.15 : 0.1; // 時給は外れ値が多いため強めのトリミング
  const calcTrimmedAvg = (arr) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    if (sorted.length < 5) {
      return Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
    }
    const trimCount = Math.floor(sorted.length * trimRate);
    const trimmed = trimCount > 0 ? sorted.slice(trimCount, sorted.length - trimCount) : sorted;
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  };

  // 全体平均（外れ値補正あり、時給は時給、月給は月給）
  const allSalaries = filteredData.map(getSalary);
  const overallAvg = calcTrimmedAvg(allSalaries);

  // 無効なタグを判定する関数（「8+」「10+」等の数値+記号パターンを除外）
  const isInvalidTag = (tag) => {
    if (!tag || typeof tag !== 'string') return true;
    if (/^\d+\+$/.test(tag.trim())) return true; // 数字+「+」のパターン
    if (tag.trim().length < 2) return true; // 短すぎるタグ
    return false;
  };

  // タグごとの給与データを集計
  const tagSalaryData = {};
  filteredData.forEach(d => {
    if (!d.tagsParsed || !d.tagsParsed.tags) return;
    const salary = getSalary(d);
    d.tagsParsed.tags.forEach(tag => {
      if (isInvalidTag(tag)) return; // 無効タグをスキップ
      if (!tagSalaryData[tag]) tagSalaryData[tag] = [];
      tagSalaryData[tag].push(salary);
    });
  });

  // タグごとの統計を計算（外れ値補正あり）
  const tagCorrelations = Object.entries(tagSalaryData)
    .filter(([tag, salaries]) => !isInvalidTag(tag) && salaries.length >= 3)
    .map(([tag, salaries]) => {
      const avg = calcTrimmedAvg(salaries);
      const diff = avg - overallAvg;
      const diffPercent = Math.round((diff / overallAvg) * 100);
      return {
        tag: tag,
        count: salaries.length,
        avgSalary: avg,
        diffFromAvg: diff,
        diffPercent: diffPercent
      };
    })
    .sort((a, b) => b.diffFromAvg - a.diffFromAvg);

  // タグ組み合わせ分析
  const combinations = analyzeTagCombinations(filteredData, overallAvg, getSalary, isHourly);

  // ストレージ最適化: タグ相関を上位15件+下位15件に制限
  let limitedTagCorrelations = tagCorrelations;
  if (tagCorrelations.length > 30) {
    const top15 = tagCorrelations.slice(0, 15);
    const bottom15 = tagCorrelations.slice(-15);
    limitedTagCorrelations = [...top15, ...bottom15];
  }

  return {
    tagCorrelations: limitedTagCorrelations,
    overallAvg: overallAvg,
    totalWithSalary: filteredData.length,
    combinations: combinations,
    isHourly: isHourly
  };
}

/**
 * タグの組み合わせ分析（外れ値補正あり）
 */
function analyzeTagCombinations(validData, overallAvg, getSalary, isHourly) {
  // 外れ値補正付き平均計算（時給モードは15%、月給モードは10%トリミング）
  const trimRate = isHourly ? 0.15 : 0.1;
  const calcTrimmedAvg = (arr) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    if (sorted.length < 5) {
      return Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
    }
    const trimCount = Math.floor(sorted.length * trimRate);
    const trimmed = trimCount > 0 ? sorted.slice(trimCount, sorted.length - trimCount) : sorted;
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  };

  const comboCounts = {};

  validData.forEach(d => {
    if (!d.tagsParsed || !d.tagsParsed.tags || d.tagsParsed.tags.length < 2) return;
    const salary = getSalary(d);
    const tags = d.tagsParsed.tags.slice(0, 5);

    for (let i = 0; i < tags.length - 1; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const combo = [tags[i], tags[j]].sort().join(' + ');
        if (!comboCounts[combo]) {
          comboCounts[combo] = { salaries: [], count: 0 };
        }
        comboCounts[combo].salaries.push(salary);
        comboCounts[combo].count++;
      }
    }
  });

  const combinations = Object.entries(comboCounts)
    .filter(([combo, data]) => data.count >= 3)
    .map(([combo, data]) => {
      const avg = calcTrimmedAvg(data.salaries);
      return {
        combination: combo,
        count: data.count,
        avgSalary: avg,
        diffFromAvg: avg - overallAvg
      };
    })
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 8);

  return combinations;
}

