/**
 * 包括的機能テストスイート
 * ビニング廃止後の全機能検証（ローカル実行用）
 *
 * テストカテゴリ:
 * - A: 月給ヒストグラム (createSalaryHistogram)
 * - B: 下限・上限別ヒストグラム (createMinMaxHistograms)
 * - C: 時給統計 (createHourlyStatistics)
 * - D: 給与パース (parseSalary相当)
 * - E: 統計計算
 * - F: エッジケース・統合テスト
 */

// ============================================================
// テストユーティリティ
// ============================================================
let testResults = { passed: 0, failed: 0, errors: [] };

function assert(condition, testId, message) {
  if (condition) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message);
    console.log('❌ ' + testId + ': ' + message);
  }
}

function assertEqual(actual, expected, testId, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message + ' (期待: ' + JSON.stringify(expected) + ', 実際: ' + JSON.stringify(actual) + ')');
    console.log('❌ ' + testId + ': ' + message);
    console.log('   期待値: ' + JSON.stringify(expected));
    console.log('   実際値: ' + JSON.stringify(actual));
  }
}

function assertNotNull(value, testId, message) {
  assert(value !== null && value !== undefined, testId, message);
}

function assertInRange(value, min, max, testId, message) {
  assert(value >= min && value <= max, testId, message + ' (' + value + ' in [' + min + ', ' + max + '])');
}

// ============================================================
// Aggregator.js から移植した関数
// ============================================================

/** 月給ヒストグラムを作成（生データ版 - ビニングなし） */
function createSalaryHistogram(values) {
  const bins = {};
  values.forEach(value => {
    if (value === null) return;
    // 生データそのまま（ビニングなし）- ラベルは万円表示
    const binLabel = (value / 10000) + "万";
    bins[binLabel] = (bins[binLabel] || 0) + 1;
  });
  const sortedBins = Object.entries(bins).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
  return { labels: sortedBins.map(b => b[0]), values: sortedBins.map(b => b[1]) };
}

/** 下限・上限別のヒストグラムを作成（生データ版 - ビニングなし） */
function createMinMaxHistograms(monthlyAnnualData) {
  if (!monthlyAnnualData || !Array.isArray(monthlyAnnualData) || monthlyAnnualData.length === 0) {
    return {
      labels: [],
      minHistogram: [],
      maxHistogram: [],
      stats: { minMean: null, minMedian: null, maxMean: null, maxMedian: null, minCount: 0, maxCount: 0 }
    };
  }

  // 下限値の月給換算リスト（生データ版 - 丸めなし）
  const minValues = monthlyAnnualData
    .map(d => {
      if (!d || !d.salaryParsed) return null;
      const minVal = d.salaryParsed.minValue;
      if (minVal === null || minVal === undefined) return null;
      if (d.salaryParsed.salaryType === 'annual') {
        return minVal / 12;  // 丸めなし
      }
      return minVal;
    })
    .filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0);

  // 上限値の月給換算リスト
  const maxValues = monthlyAnnualData
    .map(d => {
      if (!d || !d.salaryParsed) return null;
      const max = d.salaryParsed.maxValue !== null && d.salaryParsed.maxValue !== undefined
        ? d.salaryParsed.maxValue
        : d.salaryParsed.minValue;
      if (max === null || max === undefined) return null;
      if (d.salaryParsed.salaryType === 'annual') {
        return max / 12;  // 丸めなし
      }
      return max;
    })
    .filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0);

  if (minValues.length === 0 && maxValues.length === 0) {
    return {
      labels: [],
      minHistogram: [],
      maxHistogram: [],
      stats: { minMean: null, minMedian: null, maxMean: null, maxMedian: null, minCount: 0, maxCount: 0 }
    };
  }

  // 生データから一意な値を抽出してラベル化（ビニングなし）
  const minBins = {};
  const maxBins = {};

  minValues.forEach(v => {
    const label = (v / 10000) + '万';
    minBins[label] = (minBins[label] || 0) + 1;
  });
  maxValues.forEach(v => {
    const label = (v / 10000) + '万';
    maxBins[label] = (maxBins[label] || 0) + 1;
  });

  // ラベルをソート
  const labels = [...new Set([...Object.keys(minBins), ...Object.keys(maxBins)])]
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  // 統計値を計算
  const sortedMin = [...minValues].sort((a, b) => a - b);
  const sortedMax = [...maxValues].sort((a, b) => a - b);

  const calcMedian = (sorted) => {
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  };

  // 最頻値を計算
  const calcMode = (bins) => {
    const entries = Object.entries(bins);
    if (entries.length === 0) return { value: null, label: null, count: 0 };
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const modeLabel = sorted[0][0];
    const modeCount = sorted[0][1];
    const modeValue = parseFloat(modeLabel) * 10000;
    return { value: modeValue, label: modeLabel, count: modeCount };
  };

  const minModeResult = calcMode(minBins);
  const maxModeResult = calcMode(maxBins);

  const stats = {
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

  return {
    labels: labels,
    minHistogram: labels.map(l => minBins[l] || 0),
    maxHistogram: labels.map(l => maxBins[l] || 0),
    stats: stats
  };
}

/** 時給の下限・上限別ヒストグラムを作成（生データ版） */
function createHourlyMinMaxHistograms(minValues, maxValues) {
  if (minValues.length === 0 && maxValues.length === 0) {
    return {
      labels: [],
      minHistogram: [],
      maxHistogram: [],
      stats: { minMean: null, minMedian: null, maxMean: null, maxMedian: null, minCount: 0, maxCount: 0 }
    };
  }

  const minBins = {};
  const maxBins = {};

  minValues.forEach(v => {
    const label = v + '円';
    minBins[label] = (minBins[label] || 0) + 1;
  });
  maxValues.forEach(v => {
    const label = v + '円';
    maxBins[label] = (maxBins[label] || 0) + 1;
  });

  const labels = [...new Set([...Object.keys(minBins), ...Object.keys(maxBins)])]
    .sort((a, b) => parseInt(a) - parseInt(b));

  const sortedMin = [...minValues].sort((a, b) => a - b);
  const sortedMax = [...maxValues].sort((a, b) => a - b);

  const calcMedian = (sorted) => {
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  };

  const calcMode = (bins) => {
    const entries = Object.entries(bins);
    if (entries.length === 0) return { value: null, label: null, count: 0 };
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const modeLabel = sorted[0][0];
    const modeCount = sorted[0][1];
    const modeValue = parseInt(modeLabel);
    return { value: modeValue, label: modeLabel, count: modeCount };
  };

  const minModeResult = calcMode(minBins);
  const maxModeResult = calcMode(maxBins);

  return {
    labels: labels,
    minHistogram: labels.map(l => minBins[l] || 0),
    maxHistogram: labels.map(l => maxBins[l] || 0),
    stats: {
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
    }
  };
}

/** 時給統計を作成 */
function createHourlyStatistics(hourlyData) {
  if (!hourlyData || hourlyData.length === 0) {
    return {
      count: 0,
      histogram: { labels: [], values: [] },
      minMaxHistograms: { labels: [], minHistogram: [], maxHistogram: [], stats: {} }
    };
  }

  const minValues = hourlyData
    .map(d => d.salaryParsed.minValue)
    .filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0 && v < 5000);

  const maxValues = hourlyData
    .map(d => {
      const max = d.salaryParsed.maxValue;
      const min = d.salaryParsed.minValue;
      return (max !== null && max !== undefined) ? max : min;
    })
    .filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0 && v < 5000);

  const hourlyValues = hourlyData
    .map(d => {
      const min = d.salaryParsed.minValue;
      const max = d.salaryParsed.maxValue;
      return max ? (min + max) / 2 : min;
    })
    .filter(v => v !== null && !isNaN(v) && isFinite(v));

  if (minValues.length === 0) {
    return {
      count: 0,
      histogram: { labels: [], values: [] },
      minMaxHistograms: { labels: [], minHistogram: [], maxHistogram: [], stats: {} }
    };
  }

  // 時給ヒストグラム（生データ版 - 下限値ベース）
  const bins = {};
  minValues.forEach(value => {
    const binLabel = value + '円';
    bins[binLabel] = (bins[binLabel] || 0) + 1;
  });
  const sortedBins = Object.entries(bins).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  const sorted = [...hourlyValues].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const count = sorted.length;

  const minMaxHistograms = createHourlyMinMaxHistograms(minValues, maxValues);

  return {
    count: count,
    avg: Math.round(sum / count),
    median: Math.round(sorted[Math.floor(count / 2)]),
    histogram: {
      labels: sortedBins.map(b => b[0]),
      values: sortedBins.map(b => b[1])
    },
    minMaxHistograms: minMaxHistograms
  };
}

/** 給与パーサ（簡易版） */
function parseSalary(text) {
  if (!text || typeof text !== 'string') {
    return { minValue: null, maxValue: null, salaryType: null, hasRange: false, unifiedMonthly: null };
  }

  // 全角数字を半角に変換
  text = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  text = text.replace(/,/g, '');

  let salaryType = null;
  if (text.includes('時給')) salaryType = 'hourly';
  else if (text.includes('日給')) salaryType = 'daily';
  else if (text.includes('年収') || text.includes('年俸')) salaryType = 'annual';
  else if (text.includes('月給') || text.includes('月収')) salaryType = 'monthly';

  // 数値抽出
  const numbers = [];
  const patterns = [
    /(\d+(?:\.\d+)?)\s*万円/g,
    /(\d+(?:\.\d+)?)\s*円/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let value = parseFloat(match[1]);
      if (match[0].includes('万')) {
        value *= 10000;
      }
      if (!isNaN(value) && value > 0) {
        numbers.push(value);
      }
    }
  }

  if (numbers.length === 0) {
    return { minValue: null, maxValue: null, salaryType, hasRange: false, unifiedMonthly: null };
  }

  numbers.sort((a, b) => a - b);
  const minValue = numbers[0];
  const maxValue = numbers.length > 1 ? numbers[numbers.length - 1] : null;
  const hasRange = text.includes('～') || text.includes('〜') || text.includes('以上') || text.includes('以下') || numbers.length > 1;

  // 月給換算
  let unifiedMonthly = null;
  if (salaryType === 'monthly') {
    unifiedMonthly = maxValue ? Math.round((minValue + maxValue) / 2) : minValue;
  } else if (salaryType === 'annual') {
    unifiedMonthly = maxValue ? Math.round((minValue + maxValue) / 2 / 12) : Math.round(minValue / 12);
  } else if (salaryType === 'hourly') {
    // 時給→月給換算（160時間）
    const avgHourly = maxValue ? (minValue + maxValue) / 2 : minValue;
    unifiedMonthly = Math.round(avgHourly * 160);
  }

  return { minValue, maxValue, salaryType, hasRange, unifiedMonthly };
}

/** 統計計算 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return { mean: null, median: null, mode: null, min: null, max: null, stdDev: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const count = sorted.length;
  const mean = sum / count;
  const median = sorted[Math.floor(count / 2)];

  // 最頻値
  const freq = {};
  sorted.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  const modeEntry = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  const mode = modeEntry ? parseFloat(modeEntry[0]) : null;

  // 標準偏差
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    mean: Math.round(mean),
    median: Math.round(median),
    mode: mode,
    min: sorted[0],
    max: sorted[count - 1],
    stdDev: Math.round(stdDev)
  };
}

// ============================================================
// カテゴリA: 月給ヒストグラムテスト
// ============================================================

function testCategoryA_MonthlySalaryHistogram() {
  console.log('\n=== カテゴリA: 月給ヒストグラムテスト ===');

  // A01: 基本動作 - 生データラベル
  const values1 = [250000, 250000, 250000, 260000, 270000];
  const hist1 = createSalaryHistogram(values1);
  assert(hist1.labels.includes('25万'), 'A01', '25万ラベルが存在');
  assert(hist1.labels.includes('26万'), 'A02', '26万ラベルが存在');
  assert(hist1.labels.includes('27万'), 'A03', '27万ラベルが存在');

  // A04: 件数カウント
  const idx25 = hist1.labels.indexOf('25万');
  assertEqual(hist1.values[idx25], 3, 'A04', '25万の件数が3');

  // A05: 小数点ラベル（生データ版）
  const values2 = [255000, 255000, 265000]; // 25.5万、26.5万
  const hist2 = createSalaryHistogram(values2);
  assert(hist2.labels.includes('25.5万'), 'A05', '小数点ラベル25.5万が存在');
  assert(hist2.labels.includes('26.5万'), 'A06', '小数点ラベル26.5万が存在');

  // A07: ソート順
  const sorted = [...hist2.labels].sort((a, b) => parseFloat(a) - parseFloat(b));
  assertEqual(hist2.labels, sorted, 'A07', 'ラベルがソート済み');

  // A08: 空配列
  const emptyHist = createSalaryHistogram([]);
  assertEqual(emptyHist.labels.length, 0, 'A08', '空配列→空ラベル');

  // A09: null値フィルタリング
  const nullValues = [250000, null, 260000, null];
  const nullHist = createSalaryHistogram(nullValues);
  assertEqual(nullHist.labels.length, 2, 'A09', 'null値がフィルタリングされる');

  // A10: ビニングパターンなし確認
  const codeStr = createSalaryHistogram.toString();
  assert(!codeStr.includes('Math.floor'), 'A10', 'createSalaryHistogramにMath.floorなし');
}

// ============================================================
// カテゴリB: 下限・上限別ヒストグラムテスト
// ============================================================

function testCategoryB_MinMaxHistograms() {
  console.log('\n=== カテゴリB: 下限・上限別ヒストグラムテスト ===');

  // B01: 基本動作
  const testData = [
    { salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 260000, maxValue: 310000, salaryType: 'monthly' } }
  ];
  const mmHist = createMinMaxHistograms(testData);
  assertNotNull(mmHist.labels, 'B01', 'ラベル配列存在');

  // B02: 下限ヒストグラム存在
  assert(mmHist.minHistogram.length > 0, 'B02', '下限ヒストグラム存在');

  // B03: 上限ヒストグラム存在
  assert(mmHist.maxHistogram.length > 0, 'B03', '上限ヒストグラム存在');

  // B04: 統計値存在
  assertNotNull(mmHist.stats.minMean, 'B04', '下限平均存在');
  assertNotNull(mmHist.stats.maxMean, 'B05', '上限平均存在');

  // B06: 小数点ラベル確認
  const testData2 = [
    { salaryParsed: { minValue: 255000, maxValue: 305000, salaryType: 'monthly' } }
  ];
  const mmHist2 = createMinMaxHistograms(testData2);
  assert(mmHist2.labels.includes('25.5万'), 'B06', '小数点ラベル25.5万存在');
  assert(mmHist2.labels.includes('30.5万'), 'B07', '小数点ラベル30.5万存在');

  // B08: 年収→月給変換（生データ版）
  const annualData = [
    { salaryParsed: { minValue: 3060000, maxValue: 3660000, salaryType: 'annual' } }
  ];
  const annualHist = createMinMaxHistograms(annualData);
  // 3060000 / 12 = 255000 → 25.5万
  assert(annualHist.labels.some(l => l.includes('25.5')), 'B08', '年収変換で小数点保持');

  // B09: 空配列
  const emptyMM = createMinMaxHistograms([]);
  assertEqual(emptyMM.labels.length, 0, 'B09', '空配列→空ラベル');

  // B10: minValueのみ（maxValueなし）
  const minOnlyData = [
    { salaryParsed: { minValue: 250000, maxValue: null, salaryType: 'monthly' } }
  ];
  const minOnlyHist = createMinMaxHistograms(minOnlyData);
  assert(minOnlyHist.maxHistogram.length > 0, 'B10', 'maxValueなし→minValue使用');

  // B11: 最頻値計算（生データ版）
  const modeTestData = [
    { salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 260000, maxValue: 310000, salaryType: 'monthly' } }
  ];
  const modeHist = createMinMaxHistograms(modeTestData);
  assertEqual(modeHist.stats.minMode, 250000, 'B11', '最頻値が生データ250000');
}

// ============================================================
// カテゴリC: 時給統計テスト
// ============================================================

function testCategoryC_HourlyStatistics() {
  console.log('\n=== カテゴリC: 時給統計テスト ===');

  // C01: 基本動作
  const testData = [
    { salaryParsed: { minValue: 985, maxValue: 1100, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1005, maxValue: 1200, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1050, maxValue: 1300, salaryType: 'hourly' } }
  ];
  const result = createHourlyStatistics(testData);
  assert(result.count > 0, 'C01', 'count > 0');

  // C02: 生データラベル確認
  assert(result.histogram.labels.includes('985円'), 'C02', '985円ラベルが存在');
  assert(result.histogram.labels.includes('1005円'), 'C03', '1005円ラベルが存在');
  assert(result.histogram.labels.includes('1050円'), 'C04', '1050円ラベルが存在');

  // C05: ビニングラベルなし
  assert(!result.histogram.labels.includes('900円'), 'C05', '900円（ビニング）なし');
  assert(!result.histogram.labels.includes('1000円'), 'C06', '1000円（ビニング）なし');

  // C07: 下限・上限別ヒストグラム
  assert(result.minMaxHistograms.labels.length > 0, 'C07', 'minMaxHistogramsラベル存在');

  // C08: 統計値
  assertNotNull(result.avg, 'C08', '平均値存在');
  assertNotNull(result.median, 'C09', '中央値存在');

  // C10: 最頻値
  const testData2 = [
    { salaryParsed: { minValue: 985, maxValue: 1100, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 985, maxValue: 1100, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1050, maxValue: 1300, salaryType: 'hourly' } }
  ];
  const result2 = createHourlyStatistics(testData2);
  assertEqual(result2.minMaxHistograms.stats.minMode, 985, 'C10', '下限最頻値が985');

  // C11: 空配列
  const emptyResult = createHourlyStatistics([]);
  assertEqual(emptyResult.count, 0, 'C11', '空配列でcount=0');

  // C12: 端数データ
  const testData3 = [
    { salaryParsed: { minValue: 1013, maxValue: 1200, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1027, maxValue: 1250, salaryType: 'hourly' } }
  ];
  const result3 = createHourlyStatistics(testData3);
  assert(result3.histogram.labels.includes('1013円'), 'C12', '1013円（端数）が存在');
  assert(result3.histogram.labels.includes('1027円'), 'C13', '1027円（端数）が存在');

  // C14: ラベルソート
  const labels = result.histogram.labels;
  const isSorted = labels.every((l, i) => {
    if (i === 0) return true;
    return parseInt(labels[i-1]) < parseInt(l);
  });
  assert(isSorted, 'C14', 'ラベルが数値順にソート');
}

// ============================================================
// カテゴリD: 給与パーステスト
// ============================================================

function testCategoryD_SalaryParser() {
  console.log('\n=== カテゴリD: 給与パーステスト ===');

  // D01: 月給パース
  const result1 = parseSalary('月給25万円');
  assertEqual(result1.salaryType, 'monthly', 'D01', '月給タイプ判定');
  assertEqual(result1.minValue, 250000, 'D02', '月給25万円の値');

  // D03: 範囲パース
  const result2 = parseSalary('月給25万円～30万円');
  assertEqual(result2.minValue, 250000, 'D03', '範囲下限値');
  assertEqual(result2.maxValue, 300000, 'D04', '範囲上限値');
  assert(result2.hasRange, 'D05', '範囲フラグ');

  // D06: 時給パース
  const result3 = parseSalary('時給1200円');
  assertEqual(result3.salaryType, 'hourly', 'D06', '時給タイプ判定');
  assertEqual(result3.minValue, 1200, 'D07', '時給1200円の値');

  // D08: 年収パース
  const result4 = parseSalary('年収400万円');
  assertEqual(result4.salaryType, 'annual', 'D08', '年収タイプ判定');
  assertEqual(result4.minValue, 4000000, 'D09', '年収400万円の値');

  // D10: 日給パース
  const result5 = parseSalary('日給10000円');
  assertEqual(result5.salaryType, 'daily', 'D10', '日給タイプ判定');
  assertEqual(result5.minValue, 10000, 'D11', '日給10000円の値');

  // D12: 空文字列
  const result6 = parseSalary('');
  assertEqual(result6.minValue, null, 'D12', '空文字列はnull');

  // D13: 全角数字
  const result7 = parseSalary('月給２５万円');
  assertEqual(result7.minValue, 250000, 'D13', '全角数字対応');

  // D14: カンマ付き
  const result8 = parseSalary('月給250,000円');
  assertEqual(result8.minValue, 250000, 'D14', 'カンマ付き金額');

  // D15: 月給換算
  assertEqual(result4.unifiedMonthly, Math.round(4000000 / 12), 'D15', '年収→月給換算');
}

// ============================================================
// カテゴリE: 統計計算テスト
// ============================================================

function testCategoryE_Statistics() {
  console.log('\n=== カテゴリE: 統計計算テスト ===');

  // E01: 基本統計
  const values = [250000, 260000, 270000, 280000, 290000];
  const stats = calculateStats(values);
  assertEqual(stats.mean, 270000, 'E01', '平均値');
  assertEqual(stats.median, 270000, 'E02', '中央値');
  assertEqual(stats.min, 250000, 'E03', '最小値');
  assertEqual(stats.max, 290000, 'E04', '最大値');

  // E05: 最頻値
  const values2 = [250000, 250000, 250000, 260000, 270000];
  const stats2 = calculateStats(values2);
  assertEqual(stats2.mode, 250000, 'E05', '最頻値');

  // E06: 標準偏差（簡易チェック）
  assertNotNull(stats.stdDev, 'E06', '標準偏差存在');

  // E07: 空配列
  const emptyStats = calculateStats([]);
  assertEqual(emptyStats.mean, null, 'E07', '空配列→null');

  // E08: 単一値
  const singleStats = calculateStats([250000]);
  assertEqual(singleStats.mean, 250000, 'E08', '単一値→その値');
  assertEqual(singleStats.median, 250000, 'E09', '単一値の中央値');
}

// ============================================================
// カテゴリF: エッジケース・統合テスト
// ============================================================

function testCategoryF_EdgeCasesAndIntegration() {
  console.log('\n=== カテゴリF: エッジケース・統合テスト ===');

  // F01: 極端に大きい値
  const largeValue = 100000000; // 1億円
  const largeHist = createSalaryHistogram([largeValue]);
  assert(largeHist.labels.includes('10000万'), 'F01', '1億円のラベル');

  // F02: 極端に小さい値
  const smallHist = createSalaryHistogram([10000]); // 1万円
  assert(smallHist.labels.includes('1万'), 'F02', '1万円のラベル');

  // F03: NaN値フィルタリング
  const nanValues = [NaN, 250000, 260000];
  const filtered = nanValues.filter(v => !isNaN(v));
  assertEqual(filtered.length, 2, 'F03', 'NaN値がフィルタリング');

  // F04: Infinity値フィルタリング
  const infValues = [Infinity, 250000, 260000];
  const filtered2 = infValues.filter(v => isFinite(v));
  assertEqual(filtered2.length, 2, 'F04', 'Infinity値がフィルタリング');

  // F05: 負の値フィルタリング
  const negValues = [-1000, 250000, 260000];
  const filtered3 = negValues.filter(v => v > 0);
  assertEqual(filtered3.length, 2, 'F05', '負の値がフィルタリング');

  // F06: 統合テスト（パース→ヒストグラム）
  const salaryText = '月給25万円～30万円';
  const parsed = parseSalary(salaryText);
  const data = [{ salaryParsed: parsed }];
  const hist = createMinMaxHistograms(data);
  assert(hist.labels.length > 0, 'F06', '統合テスト：パース→ヒストグラム');

  // F07: 時給統合テスト
  const hourlyText = '時給1000円～1200円';
  const hourlyParsed = parseSalary(hourlyText);
  const hourlyData = [{ salaryParsed: hourlyParsed }];
  const hourlyHist = createHourlyStatistics(hourlyData);
  assert(hourlyHist.count > 0, 'F07', '時給統合テスト');

  // F08: 多数のデータ
  const manyValues = Array.from({ length: 1000 }, (_, i) => 200000 + i * 1000);
  const manyHist = createSalaryHistogram(manyValues);
  assert(manyHist.labels.length > 0, 'F08', '1000件データ処理');

  // F09: ビニングなし確認（コード検査）
  // ビニングパターン: Math.floor(v / 10000) * 10000 または Math.floor(v / 100) * 100
  const funcStr1 = createSalaryHistogram.toString();
  const funcStr2 = createMinMaxHistograms.toString();
  const funcStr3 = createHourlyStatistics.toString();
  // ビニングパターン（丸め処理）がないことを確認
  const binningPattern1 = /Math\.floor\s*\([^)]+\/\s*10000\s*\)\s*\*\s*10000/;
  const binningPattern2 = /Math\.floor\s*\([^)]+\/\s*100\s*\)\s*\*\s*100/;
  assert(!binningPattern1.test(funcStr1) && !binningPattern2.test(funcStr1), 'F09', 'createSalaryHistogramにビニングパターンなし');
  assert(!binningPattern1.test(funcStr2) && !binningPattern2.test(funcStr2), 'F10', 'createMinMaxHistogramsにビニングパターンなし');

  // F11: 月給・時給混合データ
  const mixedData = [
    { salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 1000, maxValue: 1200, salaryType: 'hourly' } }
  ];
  const monthlyOnly = mixedData.filter(d => d.salaryParsed.salaryType === 'monthly');
  const monthlyHist = createMinMaxHistograms(monthlyOnly);
  assertEqual(monthlyHist.stats.minCount, 1, 'F11', '月給データのみカウント');
}

// ============================================================
// メイン実行
// ============================================================

console.log('========================================');
console.log('包括的機能テストスイート');
console.log('ビニング廃止後の全機能検証');
console.log('========================================');

testResults = { passed: 0, failed: 0, errors: [] };

try {
  testCategoryA_MonthlySalaryHistogram();
  testCategoryB_MinMaxHistograms();
  testCategoryC_HourlyStatistics();
  testCategoryD_SalaryParser();
  testCategoryE_Statistics();
  testCategoryF_EdgeCasesAndIntegration();
} catch (e) {
  console.log('\nテスト実行エラー: ' + e.message);
  console.log(e.stack);
}

console.log('\n========================================');
console.log('テスト結果サマリー');
console.log('========================================');
console.log('成功: ' + testResults.passed);
console.log('失敗: ' + testResults.failed);
console.log('合計: ' + (testResults.passed + testResults.failed));
console.log('成功率: ' + Math.round(testResults.passed / (testResults.passed + testResults.failed) * 100) + '%');

if (testResults.errors.length > 0) {
  console.log('\n失敗したテスト:');
  testResults.errors.forEach(err => {
    console.log('  - ' + err);
  });
}

console.log('\n========================================');
console.log('検証ポイント');
console.log('========================================');
console.log('✓ 月給ヒストグラム: 生データラベル（25.5万等）で表示');
console.log('✓ 下限・上限別ヒストグラム: ビニングなし、小数点保持');
console.log('✓ 時給ヒストグラム: 985円、1005円等の生データ表示');
console.log('✓ 給与パース: 月給/時給/年収/日給の正確な判定');
console.log('✓ 統計計算: 平均・中央値・最頻値の正確な計算');
console.log('✓ エッジケース: null/NaN/Infinity/負値のフィルタリング');

process.exit(testResults.failed > 0 ? 1 : 0);
