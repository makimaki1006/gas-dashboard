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

/** サマリーデータを作成 */
function createSummary(parsedData) {
  const totalCount = parsedData.length;
  const newCount = parsedData.filter(d => d.isNew === "新着" || d.isNew === "NEW").length;
  const validSalaries = parsedData.filter(d => d.salaryParsed.unifiedMonthly !== null);
  const salaryStats = calculateSalaryStatistics(validSalaries.map(d => d.salaryParsed));
  const fullTimeCount = parsedData.filter(d => d.employmentParsed.category === "正規雇用").length;
  const fullTimeRate = totalCount > 0 ? Math.round((fullTimeCount / totalCount) * 100 * 10) / 10 : 0;

  // 拡張統計の計算（Statistics.js の関数を使用）
  const salaryValues = validSalaries.map(d => d.salaryParsed.unifiedMonthly);
  let enhancedStats = null;
  let formattedStats = null;

  // Statistics.js が読み込まれている場合のみ実行
  if (typeof calculateEnhancedSalaryStatistics === 'function') {
    enhancedStats = calculateEnhancedSalaryStatistics(salaryValues);
    formattedStats = formatStatisticsForDisplay(enhancedStats);
  }

  return {
    totalCount, newCount,
    newRate: totalCount > 0 ? Math.round((newCount / totalCount) * 100 * 10) / 10 : 0,
    avgMonthlySalary: salaryStats.mean, medianMonthlySalary: salaryStats.median,
    modeSalary: salaryStats.mode, modeRange: salaryStats.modeRange, modeCount: salaryStats.modeCount,
    minSalary: salaryStats.min, maxSalary: salaryStats.max, stdDevSalary: salaryStats.stdDev,
    fullTimeCount, fullTimeRate, lastUpdated: new Date().toISOString(),
    // 拡張統計（Statistics.js）
    enhancedStats: enhancedStats,
    formattedStats: formattedStats
  };
}

/** 給与集計データを作成 */
function createSalaryAggregation(parsedData) {
  const validData = parsedData.filter(d => d.salaryParsed.unifiedMonthly !== null);
  const rangeDistribution = getSalaryRangeDistribution(validData.map(d => d.salaryParsed));
  const typeDistribution = getSalaryTypeDistribution(validData.map(d => d.salaryParsed));
  const histogram = createSalaryHistogram(validData.map(d => d.salaryParsed.unifiedMonthly), 10000);  // 1万円刻み

  // 月給・年収データの下限・上限別ヒストグラム
  const monthlyAnnualData = validData.filter(d =>
    d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual'
  );
  const minMaxHistograms = createMinMaxHistograms(monthlyAnnualData);

  // 雇用形態別の給与統計
  const byEmploymentType = {};
  const groupedByEmployment = groupBy(validData, d => d.employmentParsed.subcategory);
  Object.entries(groupedByEmployment).forEach(([type, records]) => {
    const salaries = records.map(r => r.salaryParsed);
    byEmploymentType[type] = calculateSalaryStatistics(salaries);
  });

  // 時給データの統計（時給のまま集計）
  const hourlyData = parsedData.filter(d => d.salaryParsed.salaryType === 'hourly' && d.salaryParsed.minValue !== null);
  const hourlyStats = createHourlyStatistics(hourlyData);

  // 給与タイプ別の統計（月給換算前の生データ）
  const bySalaryType = createBySalaryTypeStats(parsedData);

  return {
    rangeDistribution,
    typeDistribution,
    histogram,
    minMaxHistograms,   // 下限・上限別ヒストグラム
    byEmploymentType,
    validCount: validData.length,
    hourlyStats,        // 時給帯の統計
    bySalaryType        // 給与タイプ別統計
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
  parsedData.forEach(d => {
    d.tagsParsed.tags.forEach(tag => { tagFrequency[tag] = (tagFrequency[tag] || 0) + 1; });
    Object.entries(d.tagsParsed.categories).forEach(([category, tags]) => {
      tags.forEach(tag => {
        if (!categoryFrequency[category]) categoryFrequency[category] = {};
        categoryFrequency[category][tag] = (categoryFrequency[category][tag] || 0) + 1;
      });
    });
  });
  const topTags = Object.entries(tagFrequency)
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

  // 給与データがある求人のみ対象
  const validData = parsedData.filter(d =>
    d.salaryParsed && d.salaryParsed.unifiedMonthly &&
    (d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual')
  );

  validData.forEach(d => {
    const salary = d.salaryParsed.unifiedMonthly;
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
 */
function calculateSalaryHolidaysCorrelationForHolidays(validData) {
  var dataWithSalary = validData.filter(function(d) {
    return d.salaryParsed && d.salaryParsed.unifiedMonthly && d.salaryParsed.unifiedMonthly > 0;
  });

  if (dataWithSalary.length === 0) {
    return null;
  }

  var salaryBins = {};
  dataWithSalary.forEach(function(d) {
    var salary = d.salaryParsed.unifiedMonthly;
    // 5000円刻みでビニング
    var bin = Math.floor(salary / 5000) * 5000;
    var label = Math.round(bin / 10000) + '万';

    if (!salaryBins[label]) {
      salaryBins[label] = { holidays: [], salaryBin: bin };
    }
    salaryBins[label].holidays.push(parseInt(d.annualHolidays));
  });

  var result = {};
  Object.keys(salaryBins).forEach(function(label) {
    var holidays = salaryBins[label].holidays;
    var sum = holidays.reduce(function(a, b) { return a + b; }, 0);
    result[label] = {
      count: holidays.length,
      mean: Math.round(sum / holidays.length * 10) / 10,
      salaryBin: salaryBins[label].salaryBin
    };
  });

  return result;
}

/**
 * 給与ビニングデータを作成（詳細分布用）
 * 月給: 5000円刻み、時給: 50円刻み
 */
function createSalaryBinningData(parsedData) {
  // 月給ビニング（5000円刻み）- 月給・年収データ対象
  var monthlyData = parsedData.filter(function(d) {
    return d.salaryParsed &&
           (d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual') &&
           d.salaryParsed.unifiedMonthly && d.salaryParsed.unifiedMonthly > 0;
  });

  var monthlyBins = {};
  var monthlyValues = [];

  monthlyData.forEach(function(d) {
    var salary = d.salaryParsed.unifiedMonthly;
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
  const companyData = {};

  // 企業ごとにデータを集計
  parsedData.forEach(d => {
    const companyName = d.companyName || '不明';
    if (companyName === '' || companyName === '不明') return;

    if (!companyData[companyName]) {
      companyData[companyName] = {
        name: companyName,
        count: 0,
        salaries: [],
        locations: {},
        employmentTypes: {},
        tags: {},
        newCount: 0
      };
    }

    const company = companyData[companyName];
    company.count++;

    // 給与データ
    if (d.salaryParsed && d.salaryParsed.unifiedMonthly) {
      company.salaries.push(d.salaryParsed.unifiedMonthly);
    }

    // 勤務地
    const cityWard = d.locationParsed?.cityWard;
    if (cityWard) {
      company.locations[cityWard] = (company.locations[cityWard] || 0) + 1;
    }

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
    if (d.isNew === '新着' || d.isNew === 'NEW') {
      company.newCount++;
    }
  });

  // 統計計算と整形
  const companyList = Object.values(companyData).map(company => {
    const avgSalary = company.salaries.length > 0
      ? Math.round(company.salaries.reduce((a, b) => a + b, 0) / company.salaries.length)
      : null;

    // 主要勤務地（上位3件）
    const topLocations = Object.entries(company.locations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([loc, cnt]) => ({ location: loc, count: cnt }));

    // 主要雇用形態
    const topEmploymentType = Object.entries(company.employmentTypes)
      .sort((a, b) => b[1] - a[1])[0];

    // よく使うタグ（上位5件）
    const topTags = Object.entries(company.tags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, cnt]) => tag);

    return {
      name: company.name,
      jobCount: company.count,
      avgSalary: avgSalary,
      avgSalaryMan: avgSalary ? Math.round(avgSalary / 10000 * 10) / 10 : null,
      topLocations: topLocations,
      mainEmploymentType: topEmploymentType ? topEmploymentType[0] : '不明',
      topTags: topTags,
      newCount: company.newCount,
      newRate: company.count > 0 ? Math.round((company.newCount / company.count) * 100) : 0
    };
  });

  // 求人数でソート（TOP15）
  const sortedByCount = [...companyList].sort((a, b) => b.jobCount - a.jobCount).slice(0, 15);

  // 平均給与でソート（給与データがある企業のみ、TOP15）
  const sortedBySalary = [...companyList]
    .filter(c => c.avgSalary !== null)
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 15);

  return {
    topByCount: sortedByCount,
    topBySalary: sortedBySalary,
    totalCompanies: companyList.length
  };
}

/**
 * タグと給与の相関分析データを作成
 * @param {Array} parsedData - 解析済みデータ
 * @returns {Object} タグ×給与相関分析結果
 */
function createTagSalaryCorrelation(parsedData) {
  // 有効な給与データがあるレコードのみ
  const validData = parsedData.filter(d =>
    d.salaryParsed && d.salaryParsed.unifiedMonthly !== null
  );

  if (validData.length === 0) {
    return { tagCorrelations: [], overallAvg: null, combinations: [] };
  }

  // 全体平均
  const allSalaries = validData.map(d => d.salaryParsed.unifiedMonthly);
  const overallAvg = Math.round(allSalaries.reduce((a, b) => a + b, 0) / allSalaries.length);

  // タグごとの給与データを集計
  const tagSalaryData = {};

  validData.forEach(d => {
    if (!d.tagsParsed || !d.tagsParsed.tags) return;

    d.tagsParsed.tags.forEach(tag => {
      if (!tagSalaryData[tag]) {
        tagSalaryData[tag] = [];
      }
      tagSalaryData[tag].push(d.salaryParsed.unifiedMonthly);
    });
  });

  // タグごとの統計を計算
  const tagCorrelations = Object.entries(tagSalaryData)
    .filter(([tag, salaries]) => salaries.length >= 3) // 3件以上あるタグのみ
    .map(([tag, salaries]) => {
      const avg = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
      const diff = avg - overallAvg;
      const diffPercent = Math.round((diff / overallAvg) * 100);

      return {
        tag: tag,
        count: salaries.length,
        avgSalary: avg,
        avgSalaryMan: Math.round(avg / 10000 * 10) / 10,
        diffFromAvg: diff,
        diffFromAvgMan: Math.round(diff / 10000 * 10) / 10,
        diffPercent: diffPercent
      };
    })
    .sort((a, b) => b.diffFromAvg - a.diffFromAvg);

  // タグ組み合わせ分析（上位の高給与タグ2つの組み合わせ）
  const combinations = analyzeTagCombinations(validData, overallAvg);

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
    overallAvgMan: Math.round(overallAvg / 10000 * 10) / 10,
    totalWithSalary: validData.length,
    combinations: combinations
  };
}

/**
 * タグの組み合わせ分析
 */
function analyzeTagCombinations(validData, overallAvg) {
  const comboCounts = {};

  validData.forEach(d => {
    if (!d.tagsParsed || !d.tagsParsed.tags || d.tagsParsed.tags.length < 2) return;

    const tags = d.tagsParsed.tags.slice(0, 5); // 最初の5タグまで

    // 2タグの組み合わせ
    for (let i = 0; i < tags.length - 1; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const combo = [tags[i], tags[j]].sort().join(' + ');
        if (!comboCounts[combo]) {
          comboCounts[combo] = { salaries: [], count: 0 };
        }
        comboCounts[combo].salaries.push(d.salaryParsed.unifiedMonthly);
        comboCounts[combo].count++;
      }
    }
  });

  // 3件以上ある組み合わせのみ
  const combinations = Object.entries(comboCounts)
    .filter(([combo, data]) => data.count >= 3)
    .map(([combo, data]) => {
      const avg = Math.round(data.salaries.reduce((a, b) => a + b, 0) / data.salaries.length);
      return {
        combination: combo,
        count: data.count,
        avgSalary: avg,
        avgSalaryMan: Math.round(avg / 10000 * 10) / 10,
        diffFromAvg: avg - overallAvg,
        diffFromAvgMan: Math.round((avg - overallAvg) / 10000 * 10) / 10
      };
    })
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 8);  // ストレージ最適化

  return combinations;
}

