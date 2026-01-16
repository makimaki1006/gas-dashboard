/**
 * パフォーマンステスト
 * 大量データでの処理速度を検証
 *
 * 実行方法:
 * node tests/test_performance.js
 */

// テスト結果
let testResults = { passed: 0, failed: 0, errors: [] };

function logTest(condition, testId, message) {
  if (condition) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message);
    console.log('❌ ' + testId + ': ' + message);
  }
}

// ============================================================
// テスト対象関数（生データ版）
// ============================================================

/** 月給ヒストグラム作成（生データ版） */
function createSalaryHistogram(salaryValues) {
  if (!salaryValues || salaryValues.length === 0) {
    return { labels: [], values: [] };
  }

  const validValues = salaryValues.filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0);
  if (validValues.length === 0) {
    return { labels: [], values: [] };
  }

  const bins = {};
  validValues.forEach(value => {
    const manValue = Math.round(value / 10000);
    const label = manValue + '万';
    bins[label] = (bins[label] || 0) + 1;
  });

  const sortedBins = Object.entries(bins).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

  return {
    labels: sortedBins.map(b => b[0]),
    values: sortedBins.map(b => b[1])
  };
}

/** 時給ヒストグラム作成（生データ版） */
function createHourlyHistogram(hourlyValues) {
  if (!hourlyValues || hourlyValues.length === 0) {
    return { labels: [], values: [] };
  }

  const validValues = hourlyValues.filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0 && v < 5000);
  if (validValues.length === 0) {
    return { labels: [], values: [] };
  }

  const bins = {};
  validValues.forEach(value => {
    const label = value + '円';
    bins[label] = (bins[label] || 0) + 1;
  });

  const sortedBins = Object.entries(bins).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  return {
    labels: sortedBins.map(b => b[0]),
    values: sortedBins.map(b => b[1])
  };
}

/** 下限・上限別ヒストグラム作成（生データ版） */
function createMinMaxHistograms(minValues, maxValues) {
  if (minValues.length === 0 && maxValues.length === 0) {
    return { labels: [], minHistogram: [], maxHistogram: [], stats: {} };
  }

  const minBins = {};
  const maxBins = {};

  minValues.forEach(v => {
    const label = Math.round(v / 10000) + '万';
    minBins[label] = (minBins[label] || 0) + 1;
  });
  maxValues.forEach(v => {
    const label = Math.round(v / 10000) + '万';
    maxBins[label] = (maxBins[label] || 0) + 1;
  });

  const labels = [...new Set([...Object.keys(minBins), ...Object.keys(maxBins)])]
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  return {
    labels: labels,
    minHistogram: labels.map(l => minBins[l] || 0),
    maxHistogram: labels.map(l => maxBins[l] || 0)
  };
}

/** 統計計算 */
function calculateStatistics(values) {
  if (!values || values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];

  // 最頻値（生データ版）
  const freq = {};
  values.forEach(v => freq[v] = (freq[v] || 0) + 1);
  const maxFreq = Math.max(...Object.values(freq));
  const mode = parseInt(Object.keys(freq).find(k => freq[k] === maxFreq));

  // 標準偏差
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  // パーセンタイル
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  return { mean, median, mode, stdDev, p5, p25, p75, p95, count: sorted.length };
}

/** 給与パース（簡易版） */
function parseSalary(text) {
  if (!text || typeof text !== 'string') return { salaryType: 'unknown', minValue: null, maxValue: null };

  let salaryType = 'unknown';
  let minValue = null;
  let maxValue = null;

  if (text.includes('時給') || /^\d{3,4}円/.test(text)) {
    salaryType = 'hourly';
    const match = text.match(/(\d{1,2},?\d{3})円?\s*[~～〜ー−-]\s*(\d{1,2},?\d{3})円?/);
    if (match) {
      minValue = parseInt(match[1].replace(',', ''));
      maxValue = parseInt(match[2].replace(',', ''));
    }
  } else if (text.includes('年収')) {
    salaryType = 'yearly';
    const match = text.match(/(\d{2,4})万?\s*[~～〜ー−-]\s*(\d{2,4})万/);
    if (match) {
      minValue = parseInt(match[1]) * 10000;
      maxValue = parseInt(match[2]) * 10000;
    }
  } else if (text.includes('月給') || /\d+万/.test(text)) {
    salaryType = 'monthly';
    const match = text.match(/(\d{1,3}(?:\.\d)?)\s*万?\s*[~～〜ー−-]\s*(\d{1,3}(?:\.\d)?)\s*万/);
    if (match) {
      minValue = parseFloat(match[1]) * 10000;
      maxValue = parseFloat(match[2]) * 10000;
    }
  }

  return { salaryType, minValue, maxValue };
}

// ============================================================
// テストデータ生成
// ============================================================

function generateRandomSalaries(count, min, max) {
  return Array.from({ length: count }, () =>
    Math.round((Math.random() * (max - min) + min) / 1000) * 1000
  );
}

function generateRandomHourlySalaries(count, min, max) {
  return Array.from({ length: count }, () =>
    Math.round(Math.random() * (max - min) + min)
  );
}

function generateSalaryTexts(count) {
  const templates = [
    '月給25万〜35万',
    '月給30万〜40万',
    '年収400万〜600万',
    '時給1000円〜1500円',
    '月給28万〜38万',
    '年収350万〜500万'
  ];
  return Array.from({ length: count }, () =>
    templates[Math.floor(Math.random() * templates.length)]
  );
}

// ============================================================
// パフォーマンス計測
// ============================================================

function measureTime(fn, label) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1000000;
  return { result, durationMs, label };
}

// ============================================================
// テストケース
// ============================================================

console.log('========================================');
console.log('パフォーマンステスト');
console.log('========================================\n');

// ============================================================
// Category A: 小規模データ (100件)
// ============================================================
console.log('=== Category A: 小規模データ (100件) ===');

const small100 = generateRandomSalaries(100, 200000, 500000);
const smallHourly100 = generateRandomHourlySalaries(100, 900, 1500);

const a1 = measureTime(() => createSalaryHistogram(small100), '月給ヒストグラム');
logTest(a1.durationMs < 50, 'A01', '月給ヒストグラム: ' + a1.durationMs.toFixed(2) + 'ms (<50ms)');

const a2 = measureTime(() => createHourlyHistogram(smallHourly100), '時給ヒストグラム');
logTest(a2.durationMs < 50, 'A02', '時給ヒストグラム: ' + a2.durationMs.toFixed(2) + 'ms (<50ms)');

const a3 = measureTime(() => calculateStatistics(small100), '統計計算');
logTest(a3.durationMs < 50, 'A03', '統計計算: ' + a3.durationMs.toFixed(2) + 'ms (<50ms)');

// ============================================================
// Category B: 中規模データ (1,000件)
// ============================================================
console.log('\n=== Category B: 中規模データ (1,000件) ===');

const medium1000 = generateRandomSalaries(1000, 200000, 500000);
const mediumHourly1000 = generateRandomHourlySalaries(1000, 900, 1500);
const mediumMin1000 = generateRandomSalaries(1000, 200000, 400000);
const mediumMax1000 = generateRandomSalaries(1000, 300000, 600000);

const b1 = measureTime(() => createSalaryHistogram(medium1000), '月給ヒストグラム');
logTest(b1.durationMs < 100, 'B01', '月給ヒストグラム: ' + b1.durationMs.toFixed(2) + 'ms (<100ms)');

const b2 = measureTime(() => createHourlyHistogram(mediumHourly1000), '時給ヒストグラム');
logTest(b2.durationMs < 100, 'B02', '時給ヒストグラム: ' + b2.durationMs.toFixed(2) + 'ms (<100ms)');

const b3 = measureTime(() => createMinMaxHistograms(mediumMin1000, mediumMax1000), '下限上限ヒストグラム');
logTest(b3.durationMs < 100, 'B03', '下限上限ヒストグラム: ' + b3.durationMs.toFixed(2) + 'ms (<100ms)');

const b4 = measureTime(() => calculateStatistics(medium1000), '統計計算');
logTest(b4.durationMs < 100, 'B04', '統計計算: ' + b4.durationMs.toFixed(2) + 'ms (<100ms)');

// ============================================================
// Category C: 大規模データ (10,000件)
// ============================================================
console.log('\n=== Category C: 大規模データ (10,000件) ===');

const large10000 = generateRandomSalaries(10000, 200000, 500000);
const largeHourly10000 = generateRandomHourlySalaries(10000, 900, 1500);
const largeMin10000 = generateRandomSalaries(10000, 200000, 400000);
const largeMax10000 = generateRandomSalaries(10000, 300000, 600000);

const c1 = measureTime(() => createSalaryHistogram(large10000), '月給ヒストグラム');
logTest(c1.durationMs < 500, 'C01', '月給ヒストグラム: ' + c1.durationMs.toFixed(2) + 'ms (<500ms)');

const c2 = measureTime(() => createHourlyHistogram(largeHourly10000), '時給ヒストグラム');
logTest(c2.durationMs < 500, 'C02', '時給ヒストグラム: ' + c2.durationMs.toFixed(2) + 'ms (<500ms)');

const c3 = measureTime(() => createMinMaxHistograms(largeMin10000, largeMax10000), '下限上限ヒストグラム');
logTest(c3.durationMs < 500, 'C03', '下限上限ヒストグラム: ' + c3.durationMs.toFixed(2) + 'ms (<500ms)');

const c4 = measureTime(() => calculateStatistics(large10000), '統計計算');
logTest(c4.durationMs < 500, 'C04', '統計計算: ' + c4.durationMs.toFixed(2) + 'ms (<500ms)');

// ============================================================
// Category D: 超大規模データ (50,000件)
// ============================================================
console.log('\n=== Category D: 超大規模データ (50,000件) ===');

const huge50000 = generateRandomSalaries(50000, 200000, 500000);
const hugeHourly50000 = generateRandomHourlySalaries(50000, 900, 1500);

const d1 = measureTime(() => createSalaryHistogram(huge50000), '月給ヒストグラム');
logTest(d1.durationMs < 2000, 'D01', '月給ヒストグラム: ' + d1.durationMs.toFixed(2) + 'ms (<2000ms)');

const d2 = measureTime(() => createHourlyHistogram(hugeHourly50000), '時給ヒストグラム');
logTest(d2.durationMs < 2000, 'D02', '時給ヒストグラム: ' + d2.durationMs.toFixed(2) + 'ms (<2000ms)');

const d3 = measureTime(() => calculateStatistics(huge50000), '統計計算');
logTest(d3.durationMs < 2000, 'D03', '統計計算: ' + d3.durationMs.toFixed(2) + 'ms (<2000ms)');

// ============================================================
// Category E: 給与パース性能 (10,000件)
// ============================================================
console.log('\n=== Category E: 給与パース性能 (10,000件) ===');

const salaryTexts10000 = generateSalaryTexts(10000);

const e1 = measureTime(() => salaryTexts10000.map(t => parseSalary(t)), '給与パース');
logTest(e1.durationMs < 500, 'E01', '給与パース: ' + e1.durationMs.toFixed(2) + 'ms (<500ms)');

// スループット計算
const throughput = Math.round(10000 / (e1.durationMs / 1000));
logTest(throughput > 10000, 'E02', 'スループット: ' + throughput + '件/秒 (>10000)');

// ============================================================
// Category F: メモリ効率テスト
// ============================================================
console.log('\n=== Category F: メモリ効率テスト ===');

// メモリ使用量計測
const memBefore = process.memoryUsage().heapUsed;

// 大量データ処理
const memTest100000 = generateRandomSalaries(100000, 200000, 500000);
const memResult = createSalaryHistogram(memTest100000);

const memAfter = process.memoryUsage().heapUsed;
const memUsedMB = (memAfter - memBefore) / 1024 / 1024;

logTest(memUsedMB < 100, 'F01', 'メモリ使用量: ' + memUsedMB.toFixed(2) + 'MB (<100MB)');
logTest(memResult.labels.length > 0, 'F02', 'ラベル数: ' + memResult.labels.length);

// ============================================================
// Category G: 繰り返し処理性能
// ============================================================
console.log('\n=== Category G: 繰り返し処理性能 ===');

const iterations = 100;
const repeatData = generateRandomSalaries(1000, 200000, 500000);

const g1Start = process.hrtime.bigint();
for (let i = 0; i < iterations; i++) {
  createSalaryHistogram(repeatData);
}
const g1End = process.hrtime.bigint();
const g1Total = Number(g1End - g1Start) / 1000000;
const g1Avg = g1Total / iterations;

logTest(g1Avg < 10, 'G01', '平均処理時間(100回): ' + g1Avg.toFixed(2) + 'ms (<10ms)');
logTest(g1Total < 1000, 'G02', '合計処理時間(100回): ' + g1Total.toFixed(2) + 'ms (<1000ms)');

// ============================================================
// Category H: 生データ版 vs ビニング版 比較
// ============================================================
console.log('\n=== Category H: 生データ版特性確認 ===');

// 時給データで多様な値を確認（時給は円単位なので生データの違いが顕著）
const diverseHourlyData = Array.from({ length: 500 }, (_, i) => 900 + i);

const h1 = measureTime(() => createHourlyHistogram(diverseHourlyData), '時給多様データ');
logTest(h1.result.labels.length >= 100, 'H01', '時給一意ラベル数: ' + h1.result.labels.length + ' (>=100)');

// 月給でも範囲を広げて確認（20万〜70万、1万刻み）
const diverseMonthlyData = Array.from({ length: 50 }, (_, i) => (20 + i) * 10000);
const h2 = measureTime(() => createSalaryHistogram(diverseMonthlyData), '月給多様データ');
logTest(h2.result.labels.length >= 30, 'H02', '月給一意ラベル数: ' + h2.result.labels.length + ' (>=30)');

// ============================================================
// パフォーマンスサマリー
// ============================================================

console.log('\n========================================');
console.log('パフォーマンスサマリー');
console.log('========================================');

const perfSummary = [
  { size: '100件', histogram: a1.durationMs, hourly: a2.durationMs, stats: a3.durationMs },
  { size: '1,000件', histogram: b1.durationMs, hourly: b2.durationMs, stats: b4.durationMs },
  { size: '10,000件', histogram: c1.durationMs, hourly: c2.durationMs, stats: c4.durationMs },
  { size: '50,000件', histogram: d1.durationMs, hourly: d2.durationMs, stats: d3.durationMs }
];

console.log('\nデータサイズ別処理時間 (ms):');
console.log('─────────────────────────────────────────────────');
console.log('サイズ\t\t月給Hist\t時給Hist\t統計計算');
console.log('─────────────────────────────────────────────────');
perfSummary.forEach(row => {
  console.log(row.size + '\t\t' + row.histogram.toFixed(2) + '\t\t' + row.hourly.toFixed(2) + '\t\t' + row.stats.toFixed(2));
});
console.log('─────────────────────────────────────────────────');

// ============================================================
// 結果サマリー
// ============================================================

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
console.log('パフォーマンス基準');
console.log('========================================');
console.log('✓ 100件: <50ms');
console.log('✓ 1,000件: <100ms');
console.log('✓ 10,000件: <500ms');
console.log('✓ 50,000件: <2000ms');
console.log('✓ メモリ: <100MB (100,000件)');
console.log('✓ スループット: >10,000件/秒');

// 終了コード
process.exit(testResults.failed > 0 ? 1 : 0);
