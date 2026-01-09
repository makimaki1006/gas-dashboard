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
 */
function parseAllData(rawData) {
  return rawData.map(record => {
    const salaryParsed = parseSalary(record.salary);
    const locationParsed = parseLocationWithMaster(record.location);
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
  return {
    totalCount, newCount,
    newRate: totalCount > 0 ? Math.round((newCount / totalCount) * 100 * 10) / 10 : 0,
    avgMonthlySalary: salaryStats.mean, medianMonthlySalary: salaryStats.median,
    modeSalary: salaryStats.mode, modeRange: salaryStats.modeRange, modeCount: salaryStats.modeCount,
    minSalary: salaryStats.min, maxSalary: salaryStats.max, stdDevSalary: salaryStats.stdDev,
    fullTimeCount, fullTimeRate, lastUpdated: new Date().toISOString()
  };
}

/** 給与集計データを作成 */
function createSalaryAggregation(parsedData) {
  const validData = parsedData.filter(d => d.salaryParsed.unifiedMonthly !== null);
  const rangeDistribution = getSalaryRangeDistribution(validData.map(d => d.salaryParsed));
  const typeDistribution = getSalaryTypeDistribution(validData.map(d => d.salaryParsed));
  const histogram = createSalaryHistogram(validData.map(d => d.salaryParsed.unifiedMonthly), 50000);
  const byEmploymentType = {};
  const groupedByEmployment = groupBy(validData, d => d.employmentParsed.subcategory);
  Object.entries(groupedByEmployment).forEach(([type, records]) => {
    const salaries = records.map(r => r.salaryParsed);
    byEmploymentType[type] = calculateSalaryStatistics(salaries);
  });
  return { rangeDistribution, typeDistribution, histogram, byEmploymentType, validCount: validData.length };
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

/** キャッシュを使用した集計データ取得（DataLayer使用） */
function getAggregatedDataWithCache() {
  return DataLayer.getAggregation();
}

/** キャッシュをクリア */
function clearAggregationCache() {
  const cache = CacheService.getScriptCache();
  cache.remove("dashboard_aggregation");
  DataLayer.clearCache();
}

/** テスト関数 */
function testAggregator() {
  console.log("=== 集計テスト (DataLayer使用) ===");
  const result = DataLayer.getAggregation();
  console.log("サマリー:", JSON.stringify(result.summary, null, 2));
  console.log("キャッシュ状態:", DataLayer.getCacheStatus());
}
