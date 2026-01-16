/**
 * 時給データのビニング廃止検証テスト
 * ローカル実行用（Node.js）
 */

// テスト結果
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
    testResults.errors.push(testId + ': ' + message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
    console.log('❌ ' + testId + ': ' + message);
    console.log('   期待値: ' + JSON.stringify(expected));
    console.log('   実際値: ' + JSON.stringify(actual));
  }
}

// ============================================================
// Aggregator.js から移植した関数（テスト用）
// ============================================================

/** 時給の下限・上限別ヒストグラムを作成（生データ版 - ビニングなし） */
function createHourlyMinMaxHistograms(minValues, maxValues) {
  if (minValues.length === 0 && maxValues.length === 0) {
    return {
      labels: [],
      minHistogram: [],
      maxHistogram: [],
      stats: { minMean: null, minMedian: null, maxMean: null, maxMedian: null, minCount: 0, maxCount: 0 }
    };
  }

  // 生データから一意な値を抽出（ビニングなし）
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

  // ラベルをソート
  const labels = [...new Set([...Object.keys(minBins), ...Object.keys(maxBins)])]
    .sort((a, b) => parseInt(a) - parseInt(b));

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

  // 最頻値を計算（最も件数が多い値）
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

/** 時給統計を作成 */
function createHourlyStatistics(hourlyData) {
  if (!hourlyData || hourlyData.length === 0) {
    return {
      count: 0,
      histogram: { labels: [], values: [] },
      minMaxHistograms: { labels: [], minHistogram: [], maxHistogram: [], stats: {} }
    };
  }

  // 下限値リスト（5000円未満）
  const minValues = hourlyData
    .map(d => d.salaryParsed.minValue)
    .filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0 && v < 5000);

  // 上限値リスト（上限がない場合は下限を使用、5000円未満）
  const maxValues = hourlyData
    .map(d => {
      const max = d.salaryParsed.maxValue;
      const min = d.salaryParsed.minValue;
      return (max !== null && max !== undefined) ? max : min;
    })
    .filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0 && v < 5000);

  // 統計計算用の値（下限と上限の中央値）
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

  // 統計値
  const sorted = [...hourlyValues].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const count = sorted.length;

  // 下限・上限別ヒストグラム
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

// ============================================================
// テストケース
// ============================================================

console.log('========================================');
console.log('時給データ ビニング廃止検証テスト');
console.log('========================================\n');

// テスト1: 基本的な時給データ（生データ版でラベルが保持されるか）
console.log('=== Test 1: 基本的な時給データ ===');
const testData1 = [
  { salaryParsed: { minValue: 985, maxValue: 1100, salaryType: 'hourly' } },
  { salaryParsed: { minValue: 1005, maxValue: 1200, salaryType: 'hourly' } },
  { salaryParsed: { minValue: 1050, maxValue: 1300, salaryType: 'hourly' } },
  { salaryParsed: { minValue: 985, maxValue: 1100, salaryType: 'hourly' } },  // 985が2件
  { salaryParsed: { minValue: 1100, maxValue: 1400, salaryType: 'hourly' } }
];

const result1 = createHourlyStatistics(testData1);

// ビニングなしで生データのラベルが表示されるか確認
assert(result1.histogram.labels.includes('985円'), 'T1-1', '985円のラベルが存在する（生データ版）');
assert(result1.histogram.labels.includes('1005円'), 'T1-2', '1005円のラベルが存在する（生データ版）');
assert(result1.histogram.labels.includes('1050円'), 'T1-3', '1050円のラベルが存在する（生データ版）');

// 100円刻みのビニングラベルが存在しないことを確認
assert(!result1.histogram.labels.includes('900円'), 'T1-4', '900円（ビニング）が存在しない');
assert(!result1.histogram.labels.includes('1000円'), 'T1-5', '1000円（ビニング）が存在しない（1005円と1050円が別々）');

console.log('');
console.log('生成されたラベル:', result1.histogram.labels);
console.log('');

// テスト2: 下限・上限別ヒストグラム
console.log('=== Test 2: 下限・上限別ヒストグラム ===');
assert(result1.minMaxHistograms.labels.includes('985円'), 'T2-1', 'minMaxHistogramsに985円のラベルが存在');
assert(result1.minMaxHistograms.labels.includes('1100円'), 'T2-2', 'minMaxHistogramsに1100円（maxValue）のラベルが存在');

console.log('');
console.log('下限・上限別ラベル:', result1.minMaxHistograms.labels);
console.log('');

// テスト3: 統計値（最頻値）
console.log('=== Test 3: 統計値（最頻値） ===');
assertEqual(result1.minMaxHistograms.stats.minMode, 985, 'T3-1', '下限最頻値が985（2件）');
console.log('');
console.log('下限最頻値:', result1.minMaxHistograms.stats.minMode + '円');
console.log('上限最頻値:', result1.minMaxHistograms.stats.maxMode + '円');
console.log('');

// テスト4: 細かい端数の時給データ
console.log('=== Test 4: 端数を含む時給データ ===');
const testData4 = [
  { salaryParsed: { minValue: 1013, maxValue: 1200, salaryType: 'hourly' } },
  { salaryParsed: { minValue: 1027, maxValue: 1250, salaryType: 'hourly' } },
  { salaryParsed: { minValue: 1041, maxValue: 1300, salaryType: 'hourly' } }
];

const result4 = createHourlyStatistics(testData4);
assert(result4.histogram.labels.includes('1013円'), 'T4-1', '1013円のラベルが存在（端数保持）');
assert(result4.histogram.labels.includes('1027円'), 'T4-2', '1027円のラベルが存在（端数保持）');
assert(result4.histogram.labels.includes('1041円'), 'T4-3', '1041円のラベルが存在（端数保持）');

console.log('');
console.log('端数ラベル:', result4.histogram.labels);
console.log('');

// テスト5: ビニングパターンが含まれていないことを確認
console.log('=== Test 5: ビニングパターン非存在確認 ===');
const codeCheck = createHourlyStatistics.toString();
assert(!codeCheck.includes('Math.floor(value / 100)'), 'T5-1', 'createHourlyStatisticsにMath.floor/100がない');
assert(!codeCheck.includes('* 100'), 'T5-2', 'createHourlyStatisticsに* 100がない');

const codeCheck2 = createHourlyMinMaxHistograms.toString();
assert(!codeCheck2.includes('Math.floor(v / 100)'), 'T5-3', 'createHourlyMinMaxHistogramsにMath.floor/100がない');

// テスト6: 空データ
console.log('=== Test 6: 空データ処理 ===');
const emptyResult = createHourlyStatistics([]);
assertEqual(emptyResult.count, 0, 'T6-1', '空データでcount=0');
assertEqual(emptyResult.histogram.labels.length, 0, 'T6-2', '空データでラベル配列空');

// テスト7: ラベルソート順
console.log('=== Test 7: ラベルソート順 ===');
const testData7 = [
  { salaryParsed: { minValue: 1200, maxValue: 1400, salaryType: 'hourly' } },
  { salaryParsed: { minValue: 900, maxValue: 1100, salaryType: 'hourly' } },
  { salaryParsed: { minValue: 1500, maxValue: 1800, salaryType: 'hourly' } }
];
const result7 = createHourlyStatistics(testData7);
const labels7 = result7.histogram.labels;
const isSorted = labels7.every((label, i) => {
  if (i === 0) return true;
  return parseInt(labels7[i-1]) < parseInt(label);
});
assert(isSorted, 'T7-1', 'ラベルが数値順にソートされている');
console.log('');
console.log('ソート済みラベル:', labels7);
console.log('');

// ============================================================
// 結果サマリー
// ============================================================

console.log('========================================');
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
console.log('ビニング廃止の検証ポイント');
console.log('========================================');
console.log('✓ 時給のヒストグラムラベルが「985円」「1005円」など生データで表示される');
console.log('✓ 「900円」「1000円」のような100円刻みのビニングラベルは存在しない');
console.log('✓ 下限・上限別ヒストグラムも生データのラベルを使用');
console.log('✓ 最頻値も生データの値（ビニングされていない）');

// 終了コード
process.exit(testResults.failed > 0 ? 1 : 0);
