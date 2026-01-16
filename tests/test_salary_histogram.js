/**
 * 給与ヒストグラム機能のユニットテスト
 * 外れ値削除、アノテーション、グラフ表示の検証
 */

// テストユーティリティ
function assertEqual(actual, expected, testId, message) {
  if (actual !== expected) {
    console.log(`❌ ${testId}: ${message}`);
    console.log(`   期待: ${expected}`);
    console.log(`   実際: ${actual}`);
    return false;
  }
  console.log(`✅ ${testId}: ${message}`);
  return true;
}

function assertArrayEqual(actual, expected, testId, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    console.log(`❌ ${testId}: ${message}`);
    console.log(`   期待: ${expectedStr}`);
    console.log(`   実際: ${actualStr}`);
    return false;
  }
  console.log(`✅ ${testId}: ${message}`);
  return true;
}

function assertNotNull(value, testId, message) {
  if (value === null || value === undefined) {
    console.log(`❌ ${testId}: ${message} - 値がnull/undefined`);
    return false;
  }
  console.log(`✅ ${testId}: ${message}`);
  return true;
}

function assertGreaterThan(actual, expected, testId, message) {
  if (actual <= expected) {
    console.log(`❌ ${testId}: ${message}`);
    console.log(`   ${actual} > ${expected} ではありません`);
    return false;
  }
  console.log(`✅ ${testId}: ${message}`);
  return true;
}

// ========================================
// テスト1: 外れ値削除（上下10%）の検証
// ========================================
function test_outlierRemoval() {
  console.log('\n=== テスト1: 外れ値削除（上下10%）===');

  // 10件のテストデータ（上下1件ずつが外れ値として削除されるべき）
  const testData = [
    { salaryParsed: { minValue: 100000, maxValue: 120000, salaryType: 'monthly' } },  // 外れ値（下位10%）
    { salaryParsed: { minValue: 200000, maxValue: 220000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 210000, maxValue: 230000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 220000, maxValue: 240000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 230000, maxValue: 250000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 240000, maxValue: 260000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 250000, maxValue: 270000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 260000, maxValue: 280000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 270000, maxValue: 290000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 500000, maxValue: 600000, salaryType: 'monthly' } },  // 外れ値（上位10%）
  ];

  const result = createMinMaxHistograms(testData);

  // 期待値: 上下10%削除後は8件
  // 生データに外れ値が含まれていないことを確認
  let passed = true;

  // 外れ値の100000（10万）が生データに含まれていないはず
  const has100k = result.rawMinLabels.includes('10.0万');
  if (has100k) {
    console.log('❌ T1-1: 下位外れ値（10万）が削除されていない');
    passed = false;
  } else {
    console.log('✅ T1-1: 下位外れ値（10万）が正しく削除されている');
  }

  // 外れ値の500000（50万）が生データに含まれていないはず
  const has500k = result.rawMinLabels.includes('50.0万');
  if (has500k) {
    console.log('❌ T1-2: 上位外れ値（50万）が削除されていない');
    passed = false;
  } else {
    console.log('✅ T1-2: 上位外れ値（50万）が正しく削除されている');
  }

  // statsのカウントは外れ値削除後の件数
  console.log('   生データ件数:', result.rawMinLabels.length);
  console.log('   stats.minCount:', result.stats.minCount);

  return passed;
}

// ========================================
// テスト2: 統計値（平均/中央値/最頻値）の計算
// ========================================
function test_statisticsCalculation() {
  console.log('\n=== テスト2: 統計値の計算 ===');

  const testData = [
    { salaryParsed: { minValue: 200000, maxValue: 250000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 200000, maxValue: 250000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 300000, maxValue: 350000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 300000, maxValue: 350000, salaryType: 'monthly' } },
  ];

  const result = createMinMaxHistograms(testData);
  let passed = true;

  // 平均: (200000*2 + 250000 + 300000*2) / 5 = 250000
  passed = assertEqual(result.stats.minMean, 250000, 'T2-1', '下限平均値が正しい') && passed;

  // 中央値: ソート後 [200000, 200000, 250000, 300000, 300000] → 250000
  passed = assertEqual(result.stats.minMedian, 250000, 'T2-2', '下限中央値が正しい') && passed;

  // 最頻値: 20万と30万が2件ずつ → どちらか（実装依存）
  passed = assertNotNull(result.stats.minMode, 'T2-3', '下限最頻値が存在する') && passed;
  passed = assertNotNull(result.stats.minModeLabel, 'T2-4', '下限最頻値ラベルが存在する') && passed;

  console.log('   計算結果:');
  console.log('     minMean:', result.stats.minMean);
  console.log('     minMedian:', result.stats.minMedian);
  console.log('     minMode:', result.stats.minMode);
  console.log('     minModeLabel:', result.stats.minModeLabel);

  return passed;
}

// ========================================
// テスト3: 返却データ構造の検証
// ========================================
function test_returnStructure() {
  console.log('\n=== テスト3: 返却データ構造 ===');

  const testData = [
    { salaryParsed: { minValue: 200000, maxValue: 250000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' } },
  ];

  const result = createMinMaxHistograms(testData);
  let passed = true;

  // 必須フィールドの存在確認
  passed = assertNotNull(result.labels, 'T3-1', 'labelsが存在する') && passed;
  passed = assertNotNull(result.minHistogram, 'T3-2', 'minHistogramが存在する') && passed;
  passed = assertNotNull(result.maxHistogram, 'T3-3', 'maxHistogramが存在する') && passed;
  passed = assertNotNull(result.rawMinLabels, 'T3-4', 'rawMinLabelsが存在する') && passed;
  passed = assertNotNull(result.rawMinHistogram, 'T3-5', 'rawMinHistogramが存在する') && passed;
  passed = assertNotNull(result.rawMaxLabels, 'T3-6', 'rawMaxLabelsが存在する') && passed;
  passed = assertNotNull(result.rawMaxHistogram, 'T3-7', 'rawMaxHistogramが存在する') && passed;
  passed = assertNotNull(result.stats, 'T3-8', 'statsが存在する') && passed;

  // 配列の長さの整合性
  passed = assertEqual(result.labels.length, result.minHistogram.length, 'T3-9', 'labels.length == minHistogram.length') && passed;
  passed = assertEqual(result.labels.length, result.maxHistogram.length, 'T3-10', 'labels.length == maxHistogram.length') && passed;
  passed = assertEqual(result.rawMinLabels.length, result.rawMinHistogram.length, 'T3-11', 'rawMinLabels.length == rawMinHistogram.length') && passed;
  passed = assertEqual(result.rawMaxLabels.length, result.rawMaxHistogram.length, 'T3-12', 'rawMaxLabels.length == rawMaxHistogram.length') && passed;

  return passed;
}

// ========================================
// テスト4: 空データの処理
// ========================================
function test_emptyData() {
  console.log('\n=== テスト4: 空データの処理 ===');

  let passed = true;

  // null
  const result1 = createMinMaxHistograms(null);
  passed = assertEqual(result1.labels.length, 0, 'T4-1', 'null入力で空配列を返す') && passed;

  // 空配列
  const result2 = createMinMaxHistograms([]);
  passed = assertEqual(result2.labels.length, 0, 'T4-2', '空配列入力で空配列を返す') && passed;

  // 無効なデータ
  const result3 = createMinMaxHistograms([{ invalid: true }]);
  passed = assertEqual(result3.labels.length, 0, 'T4-3', '無効データで空配列を返す') && passed;

  return passed;
}

// ========================================
// テスト実行
// ========================================
function runAllTests() {
  console.log('========================================');
  console.log('給与ヒストグラム ユニットテスト');
  console.log('========================================');

  const results = [];

  results.push({ name: '外れ値削除', passed: test_outlierRemoval() });
  results.push({ name: '統計値計算', passed: test_statisticsCalculation() });
  results.push({ name: '返却構造', passed: test_returnStructure() });
  results.push({ name: '空データ', passed: test_emptyData() });

  console.log('\n========================================');
  console.log('テスト結果サマリー');
  console.log('========================================');

  let totalPassed = 0;
  let totalFailed = 0;

  results.forEach(r => {
    if (r.passed) {
      console.log(`✅ ${r.name}: PASSED`);
      totalPassed++;
    } else {
      console.log(`❌ ${r.name}: FAILED`);
      totalFailed++;
    }
  });

  console.log('----------------------------------------');
  console.log(`合計: ${totalPassed}/${results.length} テスト成功`);

  if (totalFailed > 0) {
    console.log(`\n⚠️ ${totalFailed}件のテストが失敗しました`);
  } else {
    console.log('\n✅ すべてのテストが成功しました');
  }

  return totalFailed === 0;
}

// Node.js環境で実行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests };
}
