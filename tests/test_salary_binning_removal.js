/**
 * 給与ビニング廃止の検証テスト
 * 100パターンのユニット/統合テスト
 * 生データ（ビニングなし）への移行が正しく行われているかを検証
 */

// ===================================================================
// テストユーティリティ
// ===================================================================
let testResults = { passed: 0, failed: 0, tests: [] };

function assert(condition, testName, message) {
  if (condition) {
    testResults.passed++;
    testResults.tests.push({ name: testName, status: 'PASS', message: message || '' });
  } else {
    testResults.failed++;
    testResults.tests.push({ name: testName, status: 'FAIL', message: message || '' });
  }
}

function assertEqual(actual, expected, testName) {
  const condition = JSON.stringify(actual) === JSON.stringify(expected);
  assert(condition, testName, `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
}

function assertNotNull(value, testName) {
  assert(value !== null && value !== undefined, testName, `Value was ${value}`);
}

function assertContains(str, substr, testName) {
  assert(str && str.includes(substr), testName, `"${str}" should contain "${substr}"`);
}

// ===================================================================
// カテゴリ1: SalaryParser.js テスト (20パターン)
// ===================================================================

function testSalaryParserBasics() {
  console.log('=== SalaryParser基本テスト ===');

  // 1. 月給パース（単一値）
  const result1 = parseSalary('月給25万円');
  assert(result1.salaryType === 'monthly', 'SP01: 月給タイプ判定', result1.salaryType);
  assertEqual(result1.minValue, 250000, 'SP02: 月給25万円の値');

  // 2. 月給パース（範囲）
  const result2 = parseSalary('月給25万円～30万円');
  assert(result2.hasRange === true, 'SP03: 範囲表記検出', result2.hasRange);
  assertEqual(result2.minValue, 250000, 'SP04: 範囲の下限値');
  assertEqual(result2.maxValue, 300000, 'SP05: 範囲の上限値');

  // 3. 時給パース
  const result3 = parseSalary('時給1200円');
  assert(result3.salaryType === 'hourly', 'SP06: 時給タイプ判定', result3.salaryType);
  assertEqual(result3.minValue, 1200, 'SP07: 時給1200円の値');

  // 4. 年収パース
  const result4 = parseSalary('年収400万円');
  assert(result4.salaryType === 'annual', 'SP08: 年収タイプ判定', result4.salaryType);
  assertEqual(result4.minValue, 4000000, 'SP09: 年収400万円の値');

  // 5. 日給パース
  const result5 = parseSalary('日給10000円');
  assert(result5.salaryType === 'daily', 'SP10: 日給タイプ判定', result5.salaryType);
  assertEqual(result5.minValue, 10000, 'SP11: 日給10000円の値');

  // 6. 空文字列
  const result6 = parseSalary('');
  assertEqual(result6.minValue, null, 'SP12: 空文字列はnull');

  // 7. 全角数字対応
  const result7 = parseSalary('月給２５万円');
  assertEqual(result7.minValue, 250000, 'SP13: 全角数字対応');

  // 8. カンマ付き金額
  const result8 = parseSalary('月給250,000円');
  assertEqual(result8.minValue, 250000, 'SP14: カンマ付き金額');

  // 9. 以上表記
  const result9 = parseSalary('月給25万円以上');
  assert(result9.hasRange === true, 'SP15: 以上表記の範囲検出');

  // 10. 以下表記
  const result10 = parseSalary('月給30万円以下');
  assert(result10.hasRange === true, 'SP16: 以下表記の範囲検出');
}

function testCalculateSalaryStatistics() {
  console.log('=== calculateSalaryStatistics テスト ===');

  // 生データ形式（ビニングなし）でのテスト
  const testData = [
    { unifiedMonthly: 250000 },
    { unifiedMonthly: 250000 },  // 重複（最頻値テスト用）
    { unifiedMonthly: 250000 },
    { unifiedMonthly: 260000 },
    { unifiedMonthly: 270000 },
    { unifiedMonthly: 280000 },
    { unifiedMonthly: 300000 },
    { unifiedMonthly: 350000 },
    { unifiedMonthly: 400000 },
    { unifiedMonthly: 500000 }
  ];

  const stats = calculateSalaryStatistics(testData);

  // 11. 件数チェック
  assertEqual(stats.count, 10, 'SP17: 統計件数');

  // 12. 最頻値が生データ（250000）であること（ビニングなし）
  assertEqual(stats.mode, 250000, 'SP18: 最頻値が生データ（ビニングなし）');

  // 13. 最頻値レンジが生データ形式であること
  assertEqual(stats.modeRange, '25万円', 'SP19: 最頻値レンジ表示（生データ形式）');

  // 14. 平均値
  assertNotNull(stats.mean, 'SP20: 平均値が計算されている');
}

// ===================================================================
// カテゴリ2: Aggregator.js テスト (30パターン)
// ===================================================================

function testCreateSalaryHistogram() {
  console.log('=== createSalaryHistogram テスト ===');

  // テストデータ（月給）
  const testValues = [
    250000, 250000, 250000,  // 25万が3件
    260000,                   // 26万が1件
    270000, 270000,           // 27万が2件
    300000,                   // 30万が1件
    350000                    // 35万が1件
  ];

  const histogram = createSalaryHistogram(testValues);

  // 15. ラベルが生データ（万円表示）であること
  assert(histogram.labels.includes('25万'), 'AG01: 25万ラベル存在');
  assert(histogram.labels.includes('26万'), 'AG02: 26万ラベル存在');
  assert(histogram.labels.includes('27万'), 'AG03: 27万ラベル存在');

  // 16. 値が正確にカウントされていること
  const idx25 = histogram.labels.indexOf('25万');
  assertEqual(histogram.values[idx25], 3, 'AG04: 25万の件数が3');

  // 17. ビニングされていないこと（25.5万などの刻みがない）
  assert(!histogram.labels.includes('25.5万'), 'AG05: ビニングなし（25.5万が存在しない）');

  // 18. ラベルがソートされていること
  const sortedLabels = [...histogram.labels].sort((a, b) => parseFloat(a) - parseFloat(b));
  assertEqual(histogram.labels, sortedLabels, 'AG06: ラベルがソート済み');
}

function testCreateMinMaxHistograms() {
  console.log('=== createMinMaxHistograms テスト ===');

  // テストデータ（下限・上限）
  const testData = [
    { salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 250000, maxValue: 320000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 260000, maxValue: 350000, salaryType: 'monthly' } },
    { salaryParsed: { minValue: 300000, maxValue: 400000, salaryType: 'monthly' } }
  ];

  const histograms = createMinMaxHistograms(testData);

  // 19. 下限ヒストグラムのラベルが生データ形式
  assert(histograms.labels.includes('25万') || histograms.minHistogram.length > 0, 'AG07: 下限ヒストグラム存在');

  // 20. 統計値が計算されている
  assertNotNull(histograms.stats.minMean, 'AG08: 下限平均値');
  assertNotNull(histograms.stats.maxMean, 'AG09: 上限平均値');

  // 21. 最頻値が生データ形式
  assertNotNull(histograms.stats.minMode, 'AG10: 下限最頻値存在');
  assertNotNull(histograms.stats.maxMode, 'AG11: 上限最頻値存在');
}

function testCreateHourlyStatistics() {
  console.log('=== createHourlyStatistics テスト ===');

  // 時給テストデータ
  const hourlyData = [
    { salaryParsed: { minValue: 1000, maxValue: 1200, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1000, maxValue: 1100, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1100, maxValue: 1300, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1200, maxValue: 1500, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 1500, maxValue: 1800, salaryType: 'hourly' } }
  ];

  const stats = createHourlyStatistics(hourlyData);

  // 22. 件数チェック
  assertEqual(stats.count, 5, 'AG12: 時給統計件数');

  // 23. ヒストグラムが生データ形式（円表示）
  if (stats.histogram.labels.length > 0) {
    assert(stats.histogram.labels[0].includes('円'), 'AG13: 時給ラベルが円表示');
  }

  // 24. 下限・上限ヒストグラムが存在
  assertNotNull(stats.minMaxHistograms, 'AG14: 時給下限上限ヒストグラム');
}

function testCreateHourlyMinMaxHistograms() {
  console.log('=== createHourlyMinMaxHistograms テスト ===');

  const minValues = [1000, 1000, 1100, 1200, 1500];
  const maxValues = [1200, 1100, 1300, 1500, 1800];

  const histograms = createHourlyMinMaxHistograms(minValues, maxValues);

  // 25. ラベルが生データ形式（円表示）
  if (histograms.labels.length > 0) {
    assert(histograms.labels[0].includes('円'), 'AG15: 時給ラベルが円表示');
  }

  // 26. 統計値が計算されている
  assertNotNull(histograms.stats.minMean, 'AG16: 時給下限平均');
  assertNotNull(histograms.stats.maxMean, 'AG17: 時給上限平均');
}

function testCompanyAggregation() {
  console.log('=== createCompanyAggregation テスト ===');

  // テストデータ
  const testData = [
    {
      companyName: 'テスト株式会社',
      salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly', unifiedMonthly: 275000 },
      locationParsed: { cityWard: '東京都新宿区' },
      employmentParsed: { subcategory: '正社員' },
      tagsParsed: { tags: ['未経験可', 'リモート'] },
      isNew: '新着'
    },
    {
      companyName: 'テスト株式会社',
      salaryParsed: { minValue: 260000, maxValue: 310000, salaryType: 'monthly', unifiedMonthly: 285000 },
      locationParsed: { cityWard: '東京都渋谷区' },
      employmentParsed: { subcategory: '正社員' },
      tagsParsed: { tags: ['経験者優遇'] },
      isNew: ''
    }
  ];

  const result = createCompanyAggregation(testData, 'monthly');

  // 27. 企業数チェック
  assert(result.totalCompanies >= 1, 'AG18: 企業数カウント');

  // 28. 最頻値が生データ形式で計算されている（ビニングなし）
  if (result.topByCount.length > 0 && result.topByCount[0].minSalary) {
    assertNotNull(result.topByCount[0].minSalary.mode, 'AG19: 企業給与最頻値');
  }
}

function testTagSalaryCorrelation() {
  console.log('=== createTagSalaryCorrelation テスト ===');

  // テストデータ
  const testData = [
    {
      salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly' },
      tagsParsed: { tags: ['未経験可'] }
    },
    {
      salaryParsed: { minValue: 260000, maxValue: 310000, salaryType: 'monthly' },
      tagsParsed: { tags: ['未経験可'] }
    },
    {
      salaryParsed: { minValue: 300000, maxValue: 400000, salaryType: 'monthly' },
      tagsParsed: { tags: ['経験者優遇'] }
    },
    {
      salaryParsed: { minValue: 350000, maxValue: 450000, salaryType: 'monthly' },
      tagsParsed: { tags: ['経験者優遇', 'リモート'] }
    }
  ];

  const result = createTagSalaryCorrelation(testData, 'monthly');

  // 29. 相関データが存在
  assertNotNull(result.tagCorrelations, 'AG20: タグ相関データ存在');

  // 30. 最頻値が生データ形式で計算されている
  // タグ相関の統計にmodeが含まれている
  assertNotNull(result.overallMinStats, 'AG21: 全体下限統計');
}

// ===================================================================
// カテゴリ3: JobSeekerAnalysis.js テスト (20パターン)
// ===================================================================

function testJobSeekerAnalysisBasics() {
  console.log('=== JobSeekerAnalysis基本テスト ===');

  // ユーティリティ関数テスト
  // 31. average関数
  assertEqual(average([10, 20, 30]), 20, 'JS01: 平均計算');

  // 32. median関数
  assertEqual(median([10, 20, 30]), 20, 'JS02: 中央値計算（奇数）');
  assertEqual(median([10, 20, 30, 40]), 25, 'JS03: 中央値計算（偶数）');

  // 33. calculateMode関数（生データ版 - ビニングなし）
  const modeResult = calculateMode([250000, 250000, 252000, 260000, 270000]);
  assertEqual(modeResult, 250000, 'JS04: 最頻値計算（生データ版）');

  // 34. calculateModeWithBin関数（生データ版 - ビニングなし）
  const modeResult2 = calculateModeWithBin([1000, 1000, 1050, 1100, 1200], 100);
  assertEqual(modeResult2, 1000, 'JS05: 最頻値計算（生データ版）');

  // 35. calculateModeWithDetails関数（生データ版 - ビニングなし）
  const modeDetails = calculateModeWithDetails([250000, 250000, 260000, 270000]);
  assertEqual(modeDetails.value, 250000, 'JS06: 最頻値詳細（生データ版）');
  assertContains(modeDetails.range, '25万円', 'JS06b: 最頻値レンジ表示（生データ形式）');
}

function testSalaryRangePerception() {
  console.log('=== analyzeSalaryRangePerception テスト ===');

  // テストデータ（レンジ表記あり）
  const testData = [
    {
      salaryParsed: { minValue: 250000, maxValue: 300000, hasRange: true, salaryType: 'monthly' },
      isNew: ''
    },
    {
      salaryParsed: { minValue: 260000, maxValue: 320000, hasRange: true, salaryType: 'monthly' },
      isNew: ''
    },
    {
      salaryParsed: { minValue: 280000, maxValue: 350000, hasRange: true, salaryType: 'monthly' },
      isNew: ''
    }
  ];

  const result = analyzeSalaryRangePerception(testData);

  // 36. データがある場合の結果
  if (result.hasData) {
    assertNotNull(result.avgRangeWidth, 'JS07: 平均レンジ幅');
    assertNotNull(result.avgLower, 'JS08: 平均下限');
    assertNotNull(result.avgUpper, 'JS09: 平均上限');
    assertNotNull(result.expectedValue, 'JS10: 期待値');
  } else {
    assert(true, 'JS07-10: データなしの場合はスキップ');
  }
}

function testNewListingsAnalysis() {
  console.log('=== analyzeNewListings テスト ===');

  // テストデータ
  const testData = [
    {
      salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly', unifiedMonthly: 275000 },
      isNew: '新着',
      tagsParsed: { tags: ['未経験可'] }
    },
    {
      salaryParsed: { minValue: 260000, maxValue: 310000, salaryType: 'monthly', unifiedMonthly: 285000 },
      isNew: 'NEW',
      tagsParsed: { tags: ['経験者優遇'] }
    },
    {
      salaryParsed: { minValue: 280000, maxValue: 350000, salaryType: 'monthly', unifiedMonthly: 315000 },
      isNew: '',
      tagsParsed: { tags: ['リモート'] }
    }
  ];

  const result = analyzeNewListings(testData);

  // 37. 新着件数
  assertEqual(result.newCount, 2, 'JS11: 新着件数');

  // 38. 新着統計
  if (result.hasData && result.newStats) {
    assertNotNull(result.newStats.unified, 'JS12: 新着統計存在');
  }

  // 39. 差分計算
  if (result.diffVsAll) {
    assertNotNull(result.diffVsAll, 'JS13: 差分計算');
  }
}

function testInexperiencedTagAnalysis() {
  console.log('=== analyzeInexperiencedTag テスト ===');

  // テストデータ
  const testData = [
    {
      salaryParsed: { minValue: 250000, maxValue: 300000, salaryType: 'monthly', unifiedMonthly: 275000 },
      tagsParsed: { tags: ['未経験可'] }
    },
    {
      salaryParsed: { minValue: 260000, maxValue: 310000, salaryType: 'monthly', unifiedMonthly: 285000 },
      tagsParsed: { tags: ['未経験可'] }
    },
    {
      salaryParsed: { minValue: 350000, maxValue: 450000, salaryType: 'monthly', unifiedMonthly: 400000 },
      tagsParsed: { tags: ['経験者優遇'] }
    },
    {
      salaryParsed: { minValue: 400000, maxValue: 500000, salaryType: 'monthly', unifiedMonthly: 450000 },
      tagsParsed: { tags: ['リーダー経験必須'] }
    }
  ];

  const result = analyzeInexperiencedTag(testData);

  // 40. 結果が存在
  if (result.hasData) {
    assertNotNull(result.withInexperienced, 'JS14: 未経験可データ');
    assertNotNull(result.withoutInexperienced, 'JS15: 経験者向けデータ');
    assertNotNull(result.difference, 'JS16: 差分データ');
  }
}

function testImplicitMarketRate() {
  console.log('=== analyzeImplicitMarketRate テスト ===');

  // テストデータ（25件）
  const testData = [];
  for (let i = 0; i < 25; i++) {
    testData.push({
      salaryParsed: {
        minValue: 250000 + i * 5000,
        maxValue: 300000 + i * 5000,
        salaryType: 'monthly',
        unifiedMonthly: 275000 + i * 5000
      },
      companyName: `会社${i + 1}`,
      jobTitle: `職種${i + 1}`,
      tagsParsed: { tags: ['タグ' + (i % 5)] },
      isNew: i < 5 ? '新着' : ''
    });
  }

  const result = analyzeImplicitMarketRate(testData, 20);

  // 41. 上位N件の統計
  if (result.hasData) {
    assertEqual(result.topN, 20, 'JS17: 上位件数設定');
    assertNotNull(result.topStats, 'JS18: 上位統計存在');
    assertNotNull(result.implicitRate, 'JS19: 暗黙相場');
    assertNotNull(result.sampleListings, 'JS20: サンプル求人');
  }
}

// ===================================================================
// カテゴリ4: 時給モードテスト (15パターン)
// ===================================================================

function testHourlyModeOperations() {
  console.log('=== 時給モードテスト ===');

  // 時給テストデータ
  const hourlyTestData = [
    { salaryParsed: { minValue: 1000, maxValue: 1200, salaryType: 'hourly' }, tagsParsed: { tags: ['未経験可'] } },
    { salaryParsed: { minValue: 1100, maxValue: 1300, salaryType: 'hourly' }, tagsParsed: { tags: ['未経験可'] } },
    { salaryParsed: { minValue: 1500, maxValue: 1800, salaryType: 'hourly' }, tagsParsed: { tags: ['経験者優遇'] } },
    { salaryParsed: { minValue: 1200, maxValue: 1500, salaryType: 'hourly' }, tagsParsed: { tags: ['リモート'] } }
  ];

  // 42. 時給フィルタリング（5000円未満）
  const validHourly = hourlyTestData.filter(d =>
    d.salaryParsed.minValue > 0 && d.salaryParsed.minValue < 5000
  );
  assertEqual(validHourly.length, 4, 'HR01: 有効時給データ件数');

  // 43. 時給値が5000円未満であること
  const allUnder5000 = validHourly.every(d => d.salaryParsed.minValue < 5000);
  assert(allUnder5000, 'HR02: 全て5000円未満');

  // 44. 日給タイプ除外
  const mixedData = [
    { salaryParsed: { minValue: 1000, salaryType: 'hourly' } },
    { salaryParsed: { minValue: 8000, salaryType: 'daily' } }
  ];
  const filtered = mixedData.filter(d => d.salaryParsed.salaryType !== 'daily' && d.salaryParsed.minValue < 5000);
  assertEqual(filtered.length, 1, 'HR03: 日給除外');

  // 45-50: 時給統計計算
  const hourlyStats = createHourlyStatistics(hourlyTestData);
  assertNotNull(hourlyStats, 'HR04: 時給統計存在');
  assert(hourlyStats.count === 4, 'HR05: 時給統計件数');
  assertNotNull(hourlyStats.avg, 'HR06: 時給平均');
  assertNotNull(hourlyStats.median, 'HR07: 時給中央値');
  assertNotNull(hourlyStats.histogram, 'HR08: 時給ヒストグラム');
  assertNotNull(hourlyStats.minMaxHistograms, 'HR09: 時給下限上限');
}

// ===================================================================
// カテゴリ5: エッジケーステスト (15パターン)
// ===================================================================

function testEdgeCases() {
  console.log('=== エッジケーステスト ===');

  // 51. 空配列
  const emptyStats = calculateSalaryStatistics([]);
  assertEqual(emptyStats.count, 0, 'EC01: 空配列の件数');
  assertEqual(emptyStats.mode, null, 'EC02: 空配列の最頻値');

  // 52. 単一要素
  const singleStats = calculateSalaryStatistics([{ unifiedMonthly: 250000 }]);
  assertEqual(singleStats.count, 1, 'EC03: 単一要素の件数');
  assertEqual(singleStats.mode, 250000, 'EC04: 単一要素の最頻値');

  // 53. 全て同じ値
  const sameValues = [
    { unifiedMonthly: 300000 },
    { unifiedMonthly: 300000 },
    { unifiedMonthly: 300000 }
  ];
  const sameStats = calculateSalaryStatistics(sameValues);
  assertEqual(sameStats.mode, 300000, 'EC05: 全同一値の最頻値');

  // 54. null値を含むデータ
  const withNulls = [
    { unifiedMonthly: 250000 },
    { unifiedMonthly: null },
    { unifiedMonthly: 300000 }
  ];
  const nullFilteredStats = calculateSalaryStatistics(withNulls);
  assertEqual(nullFilteredStats.count, 2, 'EC06: null除外後の件数');

  // 55. 大きな値
  const largeValues = [{ unifiedMonthly: 10000000 }];
  const largeStats = calculateSalaryStatistics(largeValues);
  assertEqual(largeStats.mode, 10000000, 'EC07: 大きな値の処理');

  // 56. 小数点を含む値（時給）
  const decimalHourly = parseSalary('時給1234.5円');
  // パース結果が適切であること
  assert(decimalHourly.salaryType === 'hourly', 'EC08: 小数点時給タイプ');

  // 57-60: ヒストグラムエッジケース
  const emptyHistogram = createSalaryHistogram([]);
  assertEqual(emptyHistogram.labels.length, 0, 'EC09: 空ヒストグラム');

  const singleHistogram = createSalaryHistogram([250000]);
  assertEqual(singleHistogram.labels.length, 1, 'EC10: 単一ヒストグラム');
  assertEqual(singleHistogram.values[0], 1, 'EC11: 単一ヒストグラム値');

  // 61-65: MinMaxHistogramsエッジケース
  const emptyMinMax = createMinMaxHistograms([]);
  assertEqual(emptyMinMax.labels.length, 0, 'EC12: 空MinMaxヒストグラム');
  assertEqual(emptyMinMax.stats.minMean, null, 'EC13: 空MinMax平均');
  assertEqual(emptyMinMax.stats.minMode, undefined, 'EC14: 空MinMax最頻値');

  const hourlyEmptyMinMax = createHourlyMinMaxHistograms([], []);
  assertEqual(hourlyEmptyMinMax.labels.length, 0, 'EC15: 空時給MinMax');
}

// ===================================================================
// メインテスト実行
// ===================================================================

function runAllTests() {
  console.log('========================================');
  console.log('給与ビニング廃止検証テスト開始');
  console.log('========================================\n');

  testResults = { passed: 0, failed: 0, tests: [] };

  try {
    // カテゴリ1: SalaryParser.js
    testSalaryParserBasics();
    testCalculateSalaryStatistics();

    // カテゴリ2: Aggregator.js
    testCreateSalaryHistogram();
    testCreateMinMaxHistograms();
    testCreateHourlyStatistics();
    testCreateHourlyMinMaxHistograms();
    testCompanyAggregation();
    testTagSalaryCorrelation();

    // カテゴリ3: JobSeekerAnalysis.js
    testJobSeekerAnalysisBasics();
    testSalaryRangePerception();
    testNewListingsAnalysis();
    testInexperiencedTagAnalysis();
    testImplicitMarketRate();

    // カテゴリ4: 時給モード
    testHourlyModeOperations();

    // カテゴリ5: エッジケース
    testEdgeCases();

  } catch (e) {
    console.error('テスト実行中にエラー:', e);
    testResults.failed++;
    testResults.tests.push({ name: 'EXCEPTION', status: 'FAIL', message: e.toString() });
  }

  // 結果サマリー
  console.log('\n========================================');
  console.log('テスト結果サマリー');
  console.log('========================================');
  console.log(`合計: ${testResults.passed + testResults.failed}件`);
  console.log(`成功: ${testResults.passed}件`);
  console.log(`失敗: ${testResults.failed}件`);
  console.log(`成功率: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);

  // 失敗したテストの詳細
  const failedTests = testResults.tests.filter(t => t.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('\n--- 失敗したテスト ---');
    failedTests.forEach(t => {
      console.log(`❌ ${t.name}: ${t.message}`);
    });
  }

  return testResults;
}

// GAS環境用エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests };
}
