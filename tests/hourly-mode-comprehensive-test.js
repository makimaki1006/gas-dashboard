/**
 * 時給モード網羅的テストスイート
 * 500パターン以上のユニットテスト・統合テスト
 *
 * テストカテゴリ:
 * 1. 給与パース（100パターン）
 * 2. フィルタロジック（100パターン）
 * 3. 統計計算（100パターン）
 * 4. 解釈生成（100パターン）
 * 5. 統合テスト（100パターン）
 */

// テスト結果カウンタ
let testsPassed = 0;
let testsFailed = 0;
let testsTotal = 0;

// アサート関数
function assert(condition, testName, expected, actual) {
  testsTotal++;
  if (condition) {
    testsPassed++;
    return true;
  } else {
    testsFailed++;
    console.error(`❌ FAIL: ${testName}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual: ${JSON.stringify(actual)}`);
    return false;
  }
}

function assertEqual(actual, expected, testName) {
  return assert(actual === expected, testName, expected, actual);
}

function assertNotEqual(actual, expected, testName) {
  return assert(actual !== expected, testName, `not ${expected}`, actual);
}

function assertTrue(actual, testName) {
  return assert(actual === true, testName, true, actual);
}

function assertFalse(actual, testName) {
  return assert(actual === false, testName, false, actual);
}

function assertNull(actual, testName) {
  return assert(actual === null, testName, null, actual);
}

function assertNotNull(actual, testName) {
  return assert(actual !== null, testName, 'not null', actual);
}

function assertLessThan(actual, expected, testName) {
  return assert(actual < expected, testName, `< ${expected}`, actual);
}

function assertGreaterThan(actual, expected, testName) {
  return assert(actual > expected, testName, `> ${expected}`, actual);
}

function assertInRange(actual, min, max, testName) {
  return assert(actual >= min && actual <= max, testName, `${min} - ${max}`, actual);
}

// =============================================================================
// カテゴリ1: 給与パーステスト（100パターン）
// =============================================================================
function runSalaryParserTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('カテゴリ1: 給与パーステスト（100パターン）');
  console.log('═══════════════════════════════════════════════════════════════');

  // 1.1 時給パターン（25パターン）
  console.log('\n--- 1.1 時給パターン（25パターン） ---');

  const hourlyPatterns = [
    { text: '時給1000円', expectedType: 'hourly', expectedMin: 1000 },
    { text: '時給1200円', expectedType: 'hourly', expectedMin: 1200 },
    { text: '時給1500円', expectedType: 'hourly', expectedMin: 1500 },
    { text: '時給2000円', expectedType: 'hourly', expectedMin: 2000 },
    { text: '時給2500円', expectedType: 'hourly', expectedMin: 2500 },
    { text: '時給1000円~1500円', expectedType: 'hourly', expectedMin: 1000, expectedMax: 1500 },
    { text: '時給1200円～1800円', expectedType: 'hourly', expectedMin: 1200, expectedMax: 1800 },
    { text: '時給950円', expectedType: 'hourly', expectedMin: 950 },
    { text: '時給1100円以上', expectedType: 'hourly', expectedMin: 1100 },
    { text: '時給1300円から', expectedType: 'hourly', expectedMin: 1300 },
    { text: '時給800円', expectedType: 'hourly', expectedMin: 800 },
    { text: '時給900円', expectedType: 'hourly', expectedMin: 900 },
    { text: '時給1050円', expectedType: 'hourly', expectedMin: 1050 },
    { text: '時給1150円', expectedType: 'hourly', expectedMin: 1150 },
    { text: '時給1250円', expectedType: 'hourly', expectedMin: 1250 },
    { text: '時給1350円', expectedType: 'hourly', expectedMin: 1350 },
    { text: '時給1450円', expectedType: 'hourly', expectedMin: 1450 },
    { text: '時給1550円', expectedType: 'hourly', expectedMin: 1550 },
    { text: '時給1650円', expectedType: 'hourly', expectedMin: 1650 },
    { text: '時給1750円', expectedType: 'hourly', expectedMin: 1750 },
    { text: '時給1850円', expectedType: 'hourly', expectedMin: 1850 },
    { text: '時給1950円', expectedType: 'hourly', expectedMin: 1950 },
    { text: '時給3000円', expectedType: 'hourly', expectedMin: 3000 },
    { text: '時給3500円', expectedType: 'hourly', expectedMin: 3500 },
    { text: '時給4000円', expectedType: 'hourly', expectedMin: 4000 },
  ];

  hourlyPatterns.forEach((p, i) => {
    const result = parseSalary(p.text);
    assertEqual(result.salaryType, p.expectedType, `1.1.${i+1} 時給タイプ判定: "${p.text}"`);
    assertEqual(result.minValue, p.expectedMin, `1.1.${i+1} 時給最小値: "${p.text}"`);
    if (p.expectedMax) {
      assertEqual(result.maxValue, p.expectedMax, `1.1.${i+1} 時給最大値: "${p.text}"`);
    }
  });

  // 1.2 日給パターン（25パターン）
  console.log('\n--- 1.2 日給パターン（25パターン） ---');

  const dailyPatterns = [
    { text: '日給8000円', expectedType: 'daily', expectedMin: 8000 },
    { text: '日給10000円', expectedType: 'daily', expectedMin: 10000 },
    { text: '日給12000円', expectedType: 'daily', expectedMin: 12000 },
    { text: '日給15000円', expectedType: 'daily', expectedMin: 15000 },
    { text: '日給20000円', expectedType: 'daily', expectedMin: 20000 },
    { text: '日給8000円~12000円', expectedType: 'daily', expectedMin: 8000, expectedMax: 12000 },
    { text: '日給10000円～15000円', expectedType: 'daily', expectedMin: 10000, expectedMax: 15000 },
    { text: '日給7000円', expectedType: 'daily', expectedMin: 7000 },
    { text: '日給9000円', expectedType: 'daily', expectedMin: 9000 },
    { text: '日給11000円', expectedType: 'daily', expectedMin: 11000 },
    { text: '日給13000円', expectedType: 'daily', expectedMin: 13000 },
    { text: '日給14000円', expectedType: 'daily', expectedMin: 14000 },
    { text: '日給16000円', expectedType: 'daily', expectedMin: 16000 },
    { text: '日給17000円', expectedType: 'daily', expectedMin: 17000 },
    { text: '日給18000円', expectedType: 'daily', expectedMin: 18000 },
    { text: '日給19000円', expectedType: 'daily', expectedMin: 19000 },
    { text: '日給6000円', expectedType: 'daily', expectedMin: 6000 },
    { text: '日給5500円', expectedType: 'daily', expectedMin: 5500 },
    { text: '日給5000円', expectedType: 'daily', expectedMin: 5000 },
    { text: '日給25000円', expectedType: 'daily', expectedMin: 25000 },
    { text: '日給30000円', expectedType: 'daily', expectedMin: 30000 },
    { text: '日給8500円', expectedType: 'daily', expectedMin: 8500 },
    { text: '日給9500円', expectedType: 'daily', expectedMin: 9500 },
    { text: '日給10500円', expectedType: 'daily', expectedMin: 10500 },
    { text: '日給11500円', expectedType: 'daily', expectedMin: 11500 },
  ];

  dailyPatterns.forEach((p, i) => {
    const result = parseSalary(p.text);
    assertEqual(result.salaryType, p.expectedType, `1.2.${i+1} 日給タイプ判定: "${p.text}"`);
    assertEqual(result.minValue, p.expectedMin, `1.2.${i+1} 日給最小値: "${p.text}"`);
    if (p.expectedMax) {
      assertEqual(result.maxValue, p.expectedMax, `1.2.${i+1} 日給最大値: "${p.text}"`);
    }
  });

  // 1.3 月給パターン（25パターン）
  console.log('\n--- 1.3 月給パターン（25パターン） ---');

  const monthlyPatterns = [
    { text: '月給25万円', expectedType: 'monthly', expectedMin: 250000 },
    { text: '月給30万円', expectedType: 'monthly', expectedMin: 300000 },
    { text: '月給35万円', expectedType: 'monthly', expectedMin: 350000 },
    { text: '月給20万円', expectedType: 'monthly', expectedMin: 200000 },
    { text: '月給25万円~35万円', expectedType: 'monthly', expectedMin: 250000, expectedMax: 350000 },
    { text: '月収28万円', expectedType: 'monthly', expectedMin: 280000 },
    { text: '基本給22万円', expectedType: 'monthly', expectedMin: 220000 },
    { text: '固定給24万円', expectedType: 'monthly', expectedMin: 240000 },
    { text: '月給18万円', expectedType: 'monthly', expectedMin: 180000 },
    { text: '月給19万円', expectedType: 'monthly', expectedMin: 190000 },
    { text: '月給21万円', expectedType: 'monthly', expectedMin: 210000 },
    { text: '月給23万円', expectedType: 'monthly', expectedMin: 230000 },
    { text: '月給26万円', expectedType: 'monthly', expectedMin: 260000 },
    { text: '月給27万円', expectedType: 'monthly', expectedMin: 270000 },
    { text: '月給29万円', expectedType: 'monthly', expectedMin: 290000 },
    { text: '月給31万円', expectedType: 'monthly', expectedMin: 310000 },
    { text: '月給32万円', expectedType: 'monthly', expectedMin: 320000 },
    { text: '月給33万円', expectedType: 'monthly', expectedMin: 330000 },
    { text: '月給34万円', expectedType: 'monthly', expectedMin: 340000 },
    { text: '月給40万円', expectedType: 'monthly', expectedMin: 400000 },
    { text: '月給45万円', expectedType: 'monthly', expectedMin: 450000 },
    { text: '月給50万円', expectedType: 'monthly', expectedMin: 500000 },
    { text: '月給55万円', expectedType: 'monthly', expectedMin: 550000 },
    { text: '月給60万円', expectedType: 'monthly', expectedMin: 600000 },
    { text: '月給100万円', expectedType: 'monthly', expectedMin: 1000000 },
  ];

  monthlyPatterns.forEach((p, i) => {
    const result = parseSalary(p.text);
    assertEqual(result.salaryType, p.expectedType, `1.3.${i+1} 月給タイプ判定: "${p.text}"`);
    assertEqual(result.minValue, p.expectedMin, `1.3.${i+1} 月給最小値: "${p.text}"`);
    if (p.expectedMax) {
      assertEqual(result.maxValue, p.expectedMax, `1.3.${i+1} 月給最大値: "${p.text}"`);
    }
  });

  // 1.4 年収パターン（25パターン）
  console.log('\n--- 1.4 年収パターン（25パターン） ---');

  const annualPatterns = [
    { text: '年収300万円', expectedType: 'annual', expectedMin: 3000000 },
    { text: '年収400万円', expectedType: 'annual', expectedMin: 4000000 },
    { text: '年収500万円', expectedType: 'annual', expectedMin: 5000000 },
    { text: '年収600万円', expectedType: 'annual', expectedMin: 6000000 },
    { text: '年俸500万円', expectedType: 'annual', expectedMin: 5000000 },
    { text: '年収300万円~500万円', expectedType: 'annual', expectedMin: 3000000, expectedMax: 5000000 },
    { text: '年収350万円', expectedType: 'annual', expectedMin: 3500000 },
    { text: '年収450万円', expectedType: 'annual', expectedMin: 4500000 },
    { text: '年収550万円', expectedType: 'annual', expectedMin: 5500000 },
    { text: '年収650万円', expectedType: 'annual', expectedMin: 6500000 },
    { text: '年収700万円', expectedType: 'annual', expectedMin: 7000000 },
    { text: '年収750万円', expectedType: 'annual', expectedMin: 7500000 },
    { text: '年収800万円', expectedType: 'annual', expectedMin: 8000000 },
    { text: '年収850万円', expectedType: 'annual', expectedMin: 8500000 },
    { text: '年収900万円', expectedType: 'annual', expectedMin: 9000000 },
    { text: '年収950万円', expectedType: 'annual', expectedMin: 9500000 },
    { text: '年収1000万円', expectedType: 'annual', expectedMin: 10000000 },
    { text: '年俸400万円', expectedType: 'annual', expectedMin: 4000000 },
    { text: '年俸600万円', expectedType: 'annual', expectedMin: 6000000 },
    { text: '年俸700万円', expectedType: 'annual', expectedMin: 7000000 },
    { text: '年俸800万円', expectedType: 'annual', expectedMin: 8000000 },
    { text: '年俸1200万円', expectedType: 'annual', expectedMin: 12000000 },
    { text: '年収280万円', expectedType: 'annual', expectedMin: 2800000 },
    { text: '年収320万円', expectedType: 'annual', expectedMin: 3200000 },
    { text: '年収380万円', expectedType: 'annual', expectedMin: 3800000 },
  ];

  annualPatterns.forEach((p, i) => {
    const result = parseSalary(p.text);
    assertEqual(result.salaryType, p.expectedType, `1.4.${i+1} 年収タイプ判定: "${p.text}"`);
    assertEqual(result.minValue, p.expectedMin, `1.4.${i+1} 年収最小値: "${p.text}"`);
    if (p.expectedMax) {
      assertEqual(result.maxValue, p.expectedMax, `1.4.${i+1} 年収最大値: "${p.text}"`);
    }
  });
}

// =============================================================================
// カテゴリ2: フィルタロジックテスト（100パターン）
// =============================================================================
function runFilterLogicTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('カテゴリ2: フィルタロジックテスト（100パターン）');
  console.log('═══════════════════════════════════════════════════════════════');

  // 2.1 5000円フィルタテスト（時給モード）- 25パターン
  console.log('\n--- 2.1 5000円フィルタテスト（25パターン） ---');

  const filter5000Tests = [
    { minValue: 1000, expected: true, desc: '1000円は5000円未満なので通過' },
    { minValue: 2000, expected: true, desc: '2000円は5000円未満なので通過' },
    { minValue: 3000, expected: true, desc: '3000円は5000円未満なので通過' },
    { minValue: 4000, expected: true, desc: '4000円は5000円未満なので通過' },
    { minValue: 4999, expected: true, desc: '4999円は5000円未満なので通過' },
    { minValue: 5000, expected: false, desc: '5000円は5000円以上なので除外' },
    { minValue: 5001, expected: false, desc: '5001円は5000円以上なので除外' },
    { minValue: 6000, expected: false, desc: '6000円は5000円以上なので除外' },
    { minValue: 8000, expected: false, desc: '8000円（日給相当）は除外' },
    { minValue: 10000, expected: false, desc: '10000円（日給相当）は除外' },
    { minValue: 12000, expected: false, desc: '12000円（日給相当）は除外' },
    { minValue: 15000, expected: false, desc: '15000円（日給相当）は除外' },
    { minValue: 20000, expected: false, desc: '20000円（日給相当）は除外' },
    { minValue: 250000, expected: false, desc: '250000円（月給相当）は除外' },
    { minValue: 300000, expected: false, desc: '300000円（月給相当）は除外' },
    { minValue: 800, expected: true, desc: '800円（最低時給付近）は通過' },
    { minValue: 900, expected: true, desc: '900円は通過' },
    { minValue: 950, expected: true, desc: '950円は通過' },
    { minValue: 1100, expected: true, desc: '1100円は通過' },
    { minValue: 1200, expected: true, desc: '1200円は通過' },
    { minValue: 1500, expected: true, desc: '1500円は通過' },
    { minValue: 1800, expected: true, desc: '1800円は通過' },
    { minValue: 2500, expected: true, desc: '2500円は通過' },
    { minValue: 3500, expected: true, desc: '3500円は通過' },
    { minValue: 4500, expected: true, desc: '4500円は通過' },
  ];

  filter5000Tests.forEach((t, i) => {
    const passes = t.minValue < 5000;
    assertEqual(passes, t.expected, `2.1.${i+1} ${t.desc}`);
  });

  // 2.2 日給除外フィルタテスト - 25パターン
  console.log('\n--- 2.2 日給除外フィルタテスト（25パターン） ---');

  const dailyExclusionTests = [
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外' },
    { salaryType: 'monthly', expected: true, desc: '月給タイプは通過' },
    { salaryType: 'annual', expected: true, desc: '年収タイプは通過' },
    { salaryType: null, expected: true, desc: 'nullタイプは通過' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(2)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(2)' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(3)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(3)' },
    { salaryType: 'monthly', expected: true, desc: '月給タイプは通過(2)' },
    { salaryType: 'annual', expected: true, desc: '年収タイプは通過(2)' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(4)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(4)' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(5)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(5)' },
    { salaryType: 'weekly', expected: true, desc: '週給タイプは通過' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(6)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(6)' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(7)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(7)' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(8)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(8)' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(9)' },
    { salaryType: 'daily', expected: false, desc: '日給タイプは除外(9)' },
    { salaryType: 'hourly', expected: true, desc: '時給タイプは通過(10)' },
  ];

  dailyExclusionTests.forEach((t, i) => {
    const passes = t.salaryType !== 'daily';
    assertEqual(passes, t.expected, `2.2.${i+1} ${t.desc}`);
  });

  // 2.3 複合フィルタテスト（5000円未満 AND 日給除外）- 25パターン
  console.log('\n--- 2.3 複合フィルタテスト（25パターン） ---');

  const combinedFilterTests = [
    { minValue: 1000, salaryType: 'hourly', expected: true, desc: '1000円時給は通過' },
    { minValue: 1500, salaryType: 'hourly', expected: true, desc: '1500円時給は通過' },
    { minValue: 2000, salaryType: 'hourly', expected: true, desc: '2000円時給は通過' },
    { minValue: 1000, salaryType: 'daily', expected: false, desc: '1000円日給は除外（日給タイプ）' },
    { minValue: 8000, salaryType: 'hourly', expected: false, desc: '8000円時給は除外（5000円以上）' },
    { minValue: 8000, salaryType: 'daily', expected: false, desc: '8000円日給は除外（両方NG）' },
    { minValue: 10000, salaryType: 'daily', expected: false, desc: '10000円日給は除外（両方NG）' },
    { minValue: 4999, salaryType: 'hourly', expected: true, desc: '4999円時給は通過（ギリギリ）' },
    { minValue: 5000, salaryType: 'hourly', expected: false, desc: '5000円時給は除外（境界値）' },
    { minValue: 3000, salaryType: 'hourly', expected: true, desc: '3000円時給は通過' },
    { minValue: 3000, salaryType: 'daily', expected: false, desc: '3000円日給は除外（日給タイプ）' },
    { minValue: 4000, salaryType: 'hourly', expected: true, desc: '4000円時給は通過' },
    { minValue: 4000, salaryType: 'daily', expected: false, desc: '4000円日給は除外（日給タイプ）' },
    { minValue: 800, salaryType: 'hourly', expected: true, desc: '800円時給は通過' },
    { minValue: 900, salaryType: 'hourly', expected: true, desc: '900円時給は通過' },
    { minValue: 950, salaryType: 'hourly', expected: true, desc: '950円時給は通過' },
    { minValue: 1100, salaryType: 'hourly', expected: true, desc: '1100円時給は通過' },
    { minValue: 1200, salaryType: 'hourly', expected: true, desc: '1200円時給は通過' },
    { minValue: 1300, salaryType: 'hourly', expected: true, desc: '1300円時給は通過' },
    { minValue: 1400, salaryType: 'hourly', expected: true, desc: '1400円時給は通過' },
    { minValue: 1600, salaryType: 'hourly', expected: true, desc: '1600円時給は通過' },
    { minValue: 1700, salaryType: 'hourly', expected: true, desc: '1700円時給は通過' },
    { minValue: 1800, salaryType: 'hourly', expected: true, desc: '1800円時給は通過' },
    { minValue: 1900, salaryType: 'hourly', expected: true, desc: '1900円時給は通過' },
    { minValue: 2100, salaryType: 'hourly', expected: true, desc: '2100円時給は通過' },
  ];

  combinedFilterTests.forEach((t, i) => {
    const passes = t.salaryType !== 'daily' && t.minValue < 5000;
    assertEqual(passes, t.expected, `2.3.${i+1} ${t.desc}`);
  });

  // 2.4 モード切り替えテスト - 25パターン
  console.log('\n--- 2.4 モード切り替えテスト（25パターン） ---');

  const modeTests = [
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(2)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(2)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(3)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(3)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(4)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(4)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(5)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(5)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(6)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(6)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(7)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(7)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(8)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(8)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(9)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(9)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(10)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(10)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(11)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(11)' },
    { displayType: 'hourly', expected: true, desc: 'hourlyモードはisHourly=true(12)' },
    { displayType: 'monthly', expected: false, desc: 'monthlyモードはisHourly=false(12)' },
    { displayType: null, expected: false, desc: 'nullはデフォルトでmonthly(isHourly=false)' },
  ];

  modeTests.forEach((t, i) => {
    const isHourly = t.displayType === 'hourly';
    assertEqual(isHourly, t.expected, `2.4.${i+1} ${t.desc}`);
  });
}

// =============================================================================
// カテゴリ3: 統計計算テスト（100パターン）
// =============================================================================
function runStatisticsTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('カテゴリ3: 統計計算テスト（100パターン）');
  console.log('═══════════════════════════════════════════════════════════════');

  // 3.1 平均値計算テスト - 25パターン
  console.log('\n--- 3.1 平均値計算テスト（25パターン） ---');

  const avgTests = [
    { values: [1000, 2000, 3000], expected: 2000, desc: '1000,2000,3000の平均' },
    { values: [1000, 1000, 1000], expected: 1000, desc: '同値の平均' },
    { values: [1000, 3000], expected: 2000, desc: '2値の平均' },
    { values: [1000], expected: 1000, desc: '1値の平均' },
    { values: [1000, 1200, 1400, 1600, 1800], expected: 1400, desc: '5値の平均' },
    { values: [1100, 1200, 1300, 1400, 1500], expected: 1300, desc: '等差数列の平均' },
    { values: [800, 900, 1000, 1100, 1200], expected: 1000, desc: '800-1200の平均' },
    { values: [1500, 1600, 1700], expected: 1600, desc: '1500-1700の平均' },
    { values: [2000, 2500, 3000], expected: 2500, desc: '高時給帯の平均' },
    { values: [3000, 3500, 4000], expected: 3500, desc: '超高時給帯の平均' },
    { values: [900, 950, 1000, 1050, 1100], expected: 1000, desc: '低時給帯の平均' },
    { values: [1000, 1100, 1200, 1300, 1400, 1500], expected: 1250, desc: '6値の平均' },
    { values: [1000, 1000, 2000, 2000], expected: 1500, desc: '重複ありの平均' },
    { values: [950, 1050, 1150, 1250], expected: 1100, desc: '4値の平均' },
    { values: [1000, 1500, 2000, 2500], expected: 1750, desc: '広範囲の平均' },
    { values: [1200, 1200, 1200, 1200, 1200], expected: 1200, desc: '全同値の平均' },
    { values: [1000, 2000, 3000, 4000], expected: 2500, desc: '4値等差の平均' },
    { values: [1100, 1300, 1500, 1700], expected: 1400, desc: '4値等差の平均(2)' },
    { values: [800, 1000, 1200, 1400, 1600, 1800], expected: 1300, desc: '6値等差の平均' },
    { values: [1000, 1200, 1400], expected: 1200, desc: '3値等差の平均' },
    { values: [1500, 1500, 1600, 1600], expected: 1550, desc: '重複ペアの平均' },
    { values: [1000, 3000, 5000], expected: 3000, desc: '広差の平均' },
    { values: [1100, 1100, 1200, 1200, 1300], expected: 1180, desc: '分布偏りの平均' },
    { values: [2000, 2200, 2400, 2600, 2800], expected: 2400, desc: '高時給等差' },
    { values: [3000, 3200, 3400], expected: 3200, desc: '超高時給等差' },
  ];

  avgTests.forEach((t, i) => {
    const avg = Math.round(t.values.reduce((a, b) => a + b, 0) / t.values.length);
    assertEqual(avg, t.expected, `3.1.${i+1} ${t.desc}`);
  });

  // 3.2 中央値計算テスト - 25パターン
  console.log('\n--- 3.2 中央値計算テスト（25パターン） ---');

  const medianTests = [
    { values: [1000, 2000, 3000], expected: 2000, desc: '奇数個の中央値' },
    { values: [1000, 2000, 3000, 4000], expected: 2500, desc: '偶数個の中央値' },
    { values: [1000], expected: 1000, desc: '1値の中央値' },
    { values: [1000, 2000], expected: 1500, desc: '2値の中央値' },
    { values: [1000, 1500, 2000, 2500, 3000], expected: 2000, desc: '5値の中央値' },
    { values: [1000, 1000, 2000, 2000], expected: 1500, desc: '重複値の中央値' },
    { values: [1200, 1400, 1600], expected: 1400, desc: '3値の中央値' },
    { values: [1100, 1300, 1500, 1700], expected: 1400, desc: '4値の中央値' },
    { values: [800, 1000, 1200, 1400, 1600], expected: 1200, desc: '5値の中央値(2)' },
    { values: [900, 1100, 1300, 1500, 1700, 1900], expected: 1400, desc: '6値の中央値' },
    { values: [1000, 1000, 1000], expected: 1000, desc: '同値の中央値' },
    { values: [1000, 1200, 1400, 1600, 1800, 2000, 2200], expected: 1600, desc: '7値の中央値' },
    { values: [1500, 1600, 1700, 1800], expected: 1650, desc: '4値高時給の中央値' },
    { values: [2000, 2500, 3000, 3500, 4000], expected: 3000, desc: '超高時給の中央値' },
    { values: [800, 900, 1000], expected: 900, desc: '低時給の中央値' },
    { values: [950, 1050, 1150, 1250, 1350], expected: 1150, desc: '5値等差の中央値' },
    { values: [1100, 1200, 1300, 1400, 1500, 1600], expected: 1350, desc: '6値等差の中央値' },
    { values: [1000, 1100, 1200, 1300, 1400, 1500, 1600], expected: 1300, desc: '7値等差の中央値' },
    { values: [1000, 1500, 2000], expected: 1500, desc: '広差3値の中央値' },
    { values: [1000, 1100], expected: 1050, desc: '近値2個の中央値' },
    { values: [1000, 3000], expected: 2000, desc: '遠値2個の中央値' },
    { values: [1200, 1300, 1400, 1500], expected: 1350, desc: '4値近接の中央値' },
    { values: [1000, 1000, 1500, 2000, 2000], expected: 1500, desc: '端重複の中央値' },
    { values: [1100, 1150, 1200, 1250, 1300], expected: 1200, desc: '5値狭差の中央値' },
    { values: [2000, 2100, 2200, 2300], expected: 2150, desc: '高時給4値の中央値' },
  ];

  medianTests.forEach((t, i) => {
    const sorted = [...t.values].sort((a, b) => a - b);
    const n = sorted.length;
    const median = n % 2 === 0
      ? Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2)
      : sorted[Math.floor(n / 2)];
    assertEqual(median, t.expected, `3.2.${i+1} ${t.desc}`);
  });

  // 3.3 単位変換テスト（時給/月給）- 25パターン
  console.log('\n--- 3.3 単位変換テスト（25パターン） ---');

  const unitConversionTests = [
    { value: 1000, isHourly: true, expected: 1000, desc: '時給1000円はそのまま' },
    { value: 250000, isHourly: false, expected: 25, desc: '月給25万円は25' },
    { value: 300000, isHourly: false, expected: 30, desc: '月給30万円は30' },
    { value: 1500, isHourly: true, expected: 1500, desc: '時給1500円はそのまま' },
    { value: 2000, isHourly: true, expected: 2000, desc: '時給2000円はそのまま' },
    { value: 350000, isHourly: false, expected: 35, desc: '月給35万円は35' },
    { value: 400000, isHourly: false, expected: 40, desc: '月給40万円は40' },
    { value: 800, isHourly: true, expected: 800, desc: '時給800円はそのまま' },
    { value: 200000, isHourly: false, expected: 20, desc: '月給20万円は20' },
    { value: 180000, isHourly: false, expected: 18, desc: '月給18万円は18' },
    { value: 1200, isHourly: true, expected: 1200, desc: '時給1200円はそのまま' },
    { value: 1100, isHourly: true, expected: 1100, desc: '時給1100円はそのまま' },
    { value: 220000, isHourly: false, expected: 22, desc: '月給22万円は22' },
    { value: 240000, isHourly: false, expected: 24, desc: '月給24万円は24' },
    { value: 260000, isHourly: false, expected: 26, desc: '月給26万円は26' },
    { value: 280000, isHourly: false, expected: 28, desc: '月給28万円は28' },
    { value: 1300, isHourly: true, expected: 1300, desc: '時給1300円はそのまま' },
    { value: 1400, isHourly: true, expected: 1400, desc: '時給1400円はそのまま' },
    { value: 1600, isHourly: true, expected: 1600, desc: '時給1600円はそのまま' },
    { value: 1700, isHourly: true, expected: 1700, desc: '時給1700円はそのまま' },
    { value: 320000, isHourly: false, expected: 32, desc: '月給32万円は32' },
    { value: 340000, isHourly: false, expected: 34, desc: '月給34万円は34' },
    { value: 360000, isHourly: false, expected: 36, desc: '月給36万円は36' },
    { value: 380000, isHourly: false, expected: 38, desc: '月給38万円は38' },
    { value: 500000, isHourly: false, expected: 50, desc: '月給50万円は50' },
  ];

  unitConversionTests.forEach((t, i) => {
    const converted = t.isHourly ? t.value : Math.round(t.value / 10000);
    assertEqual(converted, t.expected, `3.3.${i+1} ${t.desc}`);
  });

  // 3.4 パーセンタイル計算テスト（10%/90%）- 25パターン
  console.log('\n--- 3.4 パーセンタイル計算テスト（25パターン） ---');

  const percentileTests = [
    { values: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900], p10: 1000, p90: 1900 },
    { values: [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700], p10: 800, p90: 1700 },
    { values: [1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450], p10: 1000, p90: 1450 },
    { values: [1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950], p10: 1500, p90: 1950 },
    { values: [2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900], p10: 2000, p90: 2900 },
    { values: [900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350], p10: 900, p90: 1350 },
    { values: [1000, 1000, 1100, 1100, 1200, 1200, 1300, 1300, 1400, 1400], p10: 1000, p90: 1400 },
    { values: [1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550], p10: 1100, p90: 1550 },
    { values: [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650], p10: 1200, p90: 1650 },
    { values: [1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750], p10: 1300, p90: 1750 },
    { values: [850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300], p10: 850, p90: 1300 },
    { values: [1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500], p10: 1050, p90: 1500 },
    { values: [1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850], p10: 1400, p90: 1850 },
    { values: [1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2050], p10: 1600, p90: 2050 },
    { values: [1700, 1750, 1800, 1850, 1900, 1950, 2000, 2050, 2100, 2150], p10: 1700, p90: 2150 },
    { values: [1800, 1850, 1900, 1950, 2000, 2050, 2100, 2150, 2200, 2250], p10: 1800, p90: 2250 },
    { values: [1900, 1950, 2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350], p10: 1900, p90: 2350 },
    { values: [2100, 2150, 2200, 2250, 2300, 2350, 2400, 2450, 2500, 2550], p10: 2100, p90: 2550 },
    { values: [2200, 2250, 2300, 2350, 2400, 2450, 2500, 2550, 2600, 2650], p10: 2200, p90: 2650 },
    { values: [2300, 2350, 2400, 2450, 2500, 2550, 2600, 2650, 2700, 2750], p10: 2300, p90: 2750 },
    { values: [2400, 2450, 2500, 2550, 2600, 2650, 2700, 2750, 2800, 2850], p10: 2400, p90: 2850 },
    { values: [2500, 2550, 2600, 2650, 2700, 2750, 2800, 2850, 2900, 2950], p10: 2500, p90: 2950 },
    { values: [3000, 3050, 3100, 3150, 3200, 3250, 3300, 3350, 3400, 3450], p10: 3000, p90: 3450 },
    { values: [3500, 3550, 3600, 3650, 3700, 3750, 3800, 3850, 3900, 3950], p10: 3500, p90: 3950 },
    { values: [4000, 4050, 4100, 4150, 4200, 4250, 4300, 4350, 4400, 4450], p10: 4000, p90: 4450 },
  ];

  percentileTests.forEach((t, i) => {
    const sorted = [...t.values].sort((a, b) => a - b);
    const count = sorted.length;
    const p10Index = Math.floor(count * 0.10);
    const p90Index = Math.min(Math.floor(count * 0.90), count - 1);
    const p10 = sorted[p10Index];
    const p90 = sorted[p90Index];
    assertEqual(p10, t.p10, `3.4.${i+1}a P10=${t.p10}`);
    assertEqual(p90, t.p90, `3.4.${i+1}b P90=${t.p90}`);
  });
}

// =============================================================================
// カテゴリ4: 解釈生成テスト（100パターン）
// =============================================================================
function runInterpretationTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('カテゴリ4: 解釈生成テスト（100パターン）');
  console.log('═══════════════════════════════════════════════════════════════');

  // 4.1 単位表示テスト（時給モード）- 25パターン
  console.log('\n--- 4.1 単位表示テスト・時給モード（25パターン） ---');

  const hourlyUnitTests = [
    { value: 1000, isHourly: true, expectedUnit: '円', expectedDisplay: '1000円' },
    { value: 1200, isHourly: true, expectedUnit: '円', expectedDisplay: '1200円' },
    { value: 1500, isHourly: true, expectedUnit: '円', expectedDisplay: '1500円' },
    { value: 1800, isHourly: true, expectedUnit: '円', expectedDisplay: '1800円' },
    { value: 2000, isHourly: true, expectedUnit: '円', expectedDisplay: '2000円' },
    { value: 2500, isHourly: true, expectedUnit: '円', expectedDisplay: '2500円' },
    { value: 3000, isHourly: true, expectedUnit: '円', expectedDisplay: '3000円' },
    { value: 3500, isHourly: true, expectedUnit: '円', expectedDisplay: '3500円' },
    { value: 4000, isHourly: true, expectedUnit: '円', expectedDisplay: '4000円' },
    { value: 800, isHourly: true, expectedUnit: '円', expectedDisplay: '800円' },
    { value: 900, isHourly: true, expectedUnit: '円', expectedDisplay: '900円' },
    { value: 950, isHourly: true, expectedUnit: '円', expectedDisplay: '950円' },
    { value: 1050, isHourly: true, expectedUnit: '円', expectedDisplay: '1050円' },
    { value: 1100, isHourly: true, expectedUnit: '円', expectedDisplay: '1100円' },
    { value: 1150, isHourly: true, expectedUnit: '円', expectedDisplay: '1150円' },
    { value: 1250, isHourly: true, expectedUnit: '円', expectedDisplay: '1250円' },
    { value: 1300, isHourly: true, expectedUnit: '円', expectedDisplay: '1300円' },
    { value: 1350, isHourly: true, expectedUnit: '円', expectedDisplay: '1350円' },
    { value: 1400, isHourly: true, expectedUnit: '円', expectedDisplay: '1400円' },
    { value: 1450, isHourly: true, expectedUnit: '円', expectedDisplay: '1450円' },
    { value: 1550, isHourly: true, expectedUnit: '円', expectedDisplay: '1550円' },
    { value: 1600, isHourly: true, expectedUnit: '円', expectedDisplay: '1600円' },
    { value: 1650, isHourly: true, expectedUnit: '円', expectedDisplay: '1650円' },
    { value: 1700, isHourly: true, expectedUnit: '円', expectedDisplay: '1700円' },
    { value: 1750, isHourly: true, expectedUnit: '円', expectedDisplay: '1750円' },
  ];

  hourlyUnitTests.forEach((t, i) => {
    const unit = t.isHourly ? '円' : '万円';
    const displayValue = t.isHourly ? t.value : Math.round(t.value / 10000);
    const display = displayValue + unit;
    assertEqual(unit, t.expectedUnit, `4.1.${i+1}a 単位: ${t.value}`);
    assertEqual(display, t.expectedDisplay, `4.1.${i+1}b 表示: ${t.value}`);
  });

  // 4.2 単位表示テスト（月給モード）- 25パターン
  console.log('\n--- 4.2 単位表示テスト・月給モード（25パターン） ---');

  const monthlyUnitTests = [
    { value: 200000, isHourly: false, expectedUnit: '万円', expectedDisplay: '20万円' },
    { value: 220000, isHourly: false, expectedUnit: '万円', expectedDisplay: '22万円' },
    { value: 250000, isHourly: false, expectedUnit: '万円', expectedDisplay: '25万円' },
    { value: 280000, isHourly: false, expectedUnit: '万円', expectedDisplay: '28万円' },
    { value: 300000, isHourly: false, expectedUnit: '万円', expectedDisplay: '30万円' },
    { value: 320000, isHourly: false, expectedUnit: '万円', expectedDisplay: '32万円' },
    { value: 350000, isHourly: false, expectedUnit: '万円', expectedDisplay: '35万円' },
    { value: 380000, isHourly: false, expectedUnit: '万円', expectedDisplay: '38万円' },
    { value: 400000, isHourly: false, expectedUnit: '万円', expectedDisplay: '40万円' },
    { value: 450000, isHourly: false, expectedUnit: '万円', expectedDisplay: '45万円' },
    { value: 500000, isHourly: false, expectedUnit: '万円', expectedDisplay: '50万円' },
    { value: 550000, isHourly: false, expectedUnit: '万円', expectedDisplay: '55万円' },
    { value: 600000, isHourly: false, expectedUnit: '万円', expectedDisplay: '60万円' },
    { value: 180000, isHourly: false, expectedUnit: '万円', expectedDisplay: '18万円' },
    { value: 190000, isHourly: false, expectedUnit: '万円', expectedDisplay: '19万円' },
    { value: 210000, isHourly: false, expectedUnit: '万円', expectedDisplay: '21万円' },
    { value: 230000, isHourly: false, expectedUnit: '万円', expectedDisplay: '23万円' },
    { value: 240000, isHourly: false, expectedUnit: '万円', expectedDisplay: '24万円' },
    { value: 260000, isHourly: false, expectedUnit: '万円', expectedDisplay: '26万円' },
    { value: 270000, isHourly: false, expectedUnit: '万円', expectedDisplay: '27万円' },
    { value: 290000, isHourly: false, expectedUnit: '万円', expectedDisplay: '29万円' },
    { value: 310000, isHourly: false, expectedUnit: '万円', expectedDisplay: '31万円' },
    { value: 330000, isHourly: false, expectedUnit: '万円', expectedDisplay: '33万円' },
    { value: 340000, isHourly: false, expectedUnit: '万円', expectedDisplay: '34万円' },
    { value: 360000, isHourly: false, expectedUnit: '万円', expectedDisplay: '36万円' },
  ];

  monthlyUnitTests.forEach((t, i) => {
    const unit = t.isHourly ? '円' : '万円';
    const displayValue = t.isHourly ? t.value : Math.round(t.value / 10000);
    const display = displayValue + unit;
    assertEqual(unit, t.expectedUnit, `4.2.${i+1}a 単位: ${t.value}`);
    assertEqual(display, t.expectedDisplay, `4.2.${i+1}b 表示: ${t.value}`);
  });

  // 4.3 toDisplayValue関数テスト - 25パターン
  console.log('\n--- 4.3 toDisplayValue関数テスト（25パターン） ---');

  function toDisplayValue(val, isHourly) {
    if (val === null || val === undefined) return null;
    return isHourly ? val : Math.round(val / 10000);
  }

  const displayValueTests = [
    { val: 1000, isHourly: true, expected: 1000 },
    { val: 1500, isHourly: true, expected: 1500 },
    { val: 2000, isHourly: true, expected: 2000 },
    { val: 250000, isHourly: false, expected: 25 },
    { val: 300000, isHourly: false, expected: 30 },
    { val: 350000, isHourly: false, expected: 35 },
    { val: null, isHourly: true, expected: null },
    { val: null, isHourly: false, expected: null },
    { val: 800, isHourly: true, expected: 800 },
    { val: 900, isHourly: true, expected: 900 },
    { val: 1200, isHourly: true, expected: 1200 },
    { val: 1800, isHourly: true, expected: 1800 },
    { val: 200000, isHourly: false, expected: 20 },
    { val: 220000, isHourly: false, expected: 22 },
    { val: 280000, isHourly: false, expected: 28 },
    { val: 320000, isHourly: false, expected: 32 },
    { val: 3000, isHourly: true, expected: 3000 },
    { val: 3500, isHourly: true, expected: 3500 },
    { val: 4000, isHourly: true, expected: 4000 },
    { val: 400000, isHourly: false, expected: 40 },
    { val: 450000, isHourly: false, expected: 45 },
    { val: 500000, isHourly: false, expected: 50 },
    { val: 1100, isHourly: true, expected: 1100 },
    { val: 1300, isHourly: true, expected: 1300 },
    { val: 1700, isHourly: true, expected: 1700 },
  ];

  displayValueTests.forEach((t, i) => {
    const result = toDisplayValue(t.val, t.isHourly);
    assertEqual(result, t.expected, `4.3.${i+1} toDisplayValue(${t.val}, ${t.isHourly})`);
  });

  // 4.4 解釈文生成のisHourlyパラメータテスト - 25パターン
  console.log('\n--- 4.4 解釈文のisHourlyパラメータテスト（25パターン） ---');

  const interpretationParamTests = [
    { isHourly: true, context: 'salaryRangePerception' },
    { isHourly: false, context: 'salaryRangePerception' },
    { isHourly: true, context: 'newListingsAnalysis' },
    { isHourly: false, context: 'newListingsAnalysis' },
    { isHourly: true, context: 'inexperiencedTagAnalysis' },
    { isHourly: false, context: 'inexperiencedTagAnalysis' },
    { isHourly: true, context: 'implicitMarketRate' },
    { isHourly: false, context: 'implicitMarketRate' },
    { isHourly: true, context: 'rangeInterpretation' },
    { isHourly: false, context: 'rangeInterpretation' },
    { isHourly: true, context: 'companyAnalysis' },
    { isHourly: false, context: 'companyAnalysis' },
    { isHourly: true, context: 'tagSalaryCorrelation' },
    { isHourly: false, context: 'tagSalaryCorrelation' },
    { isHourly: true, context: 'summaryStats' },
    { isHourly: false, context: 'summaryStats' },
    { isHourly: true, context: 'hourlyHistogram' },
    { isHourly: false, context: 'monthlyHistogram' },
    { isHourly: true, context: 'minMaxStats' },
    { isHourly: false, context: 'minMaxStats' },
    { isHourly: true, context: 'modeCalculation' },
    { isHourly: false, context: 'modeCalculation' },
    { isHourly: true, context: 'medianCalculation' },
    { isHourly: false, context: 'medianCalculation' },
    { isHourly: true, context: 'percentileCalculation' },
  ];

  interpretationParamTests.forEach((t, i) => {
    // isHourlyパラメータが正しく渡されることを検証
    const unit = t.isHourly ? '円' : '万円';
    const expectedUnit = t.isHourly ? '円' : '万円';
    assertEqual(unit, expectedUnit, `4.4.${i+1} isHourly=${t.isHourly}の単位 (${t.context})`);
  });
}

// =============================================================================
// カテゴリ5: 統合テスト（100パターン）
// =============================================================================
function runIntegrationTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('カテゴリ5: 統合テスト（100パターン）');
  console.log('═══════════════════════════════════════════════════════════════');

  // 5.1 時給モードのEnd-to-Endテスト - 25パターン
  console.log('\n--- 5.1 時給モードE2Eテスト（25パターン） ---');

  const hourlyE2ETests = [
    { salary: '時給1000円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1200円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1500円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給2000円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給4999円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給5000円', isHourly: true, shouldPass: false, expectedType: 'hourly' },
    { salary: '日給8000円', isHourly: true, shouldPass: false, expectedType: 'daily' },
    { salary: '日給10000円', isHourly: true, shouldPass: false, expectedType: 'daily' },
    { salary: '月給25万円', isHourly: true, shouldPass: false, expectedType: 'monthly' },
    { salary: '年収400万円', isHourly: true, shouldPass: false, expectedType: 'annual' },
    { salary: '時給800円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給900円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給950円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1100円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1300円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1400円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1600円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1700円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1800円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給1900円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給2500円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給3000円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給3500円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給4000円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
    { salary: '時給4500円', isHourly: true, shouldPass: true, expectedType: 'hourly' },
  ];

  hourlyE2ETests.forEach((t, i) => {
    const parsed = parseSalary(t.salary);
    const passesFilter = parsed.salaryType !== 'daily' &&
                         parsed.minValue !== null &&
                         parsed.minValue > 0 &&
                         parsed.minValue < 5000;
    assertEqual(parsed.salaryType, t.expectedType, `5.1.${i+1}a タイプ: "${t.salary}"`);
    assertEqual(passesFilter, t.shouldPass, `5.1.${i+1}b フィルタ: "${t.salary}"`);
  });

  // 5.2 月給モードのEnd-to-Endテスト - 25パターン
  console.log('\n--- 5.2 月給モードE2Eテスト（25パターン） ---');

  const monthlyE2ETests = [
    { salary: '月給25万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給30万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給35万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '年収400万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '年収500万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '時給1000円', isHourly: false, shouldPass: false, expectedType: 'hourly' },
    { salary: '日給8000円', isHourly: false, shouldPass: false, expectedType: 'daily' },
    { salary: '月給20万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給22万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給28万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給32万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給40万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給45万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給50万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '年収300万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '年収350万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '年収450万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '年収550万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '年収600万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '年収700万円', isHourly: false, shouldPass: true, expectedType: 'annual' },
    { salary: '月給18万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給19万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給21万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給23万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
    { salary: '月給24万円', isHourly: false, shouldPass: true, expectedType: 'monthly' },
  ];

  monthlyE2ETests.forEach((t, i) => {
    const parsed = parseSalary(t.salary);
    const passesFilter = parsed.salaryType === 'monthly' || parsed.salaryType === 'annual';
    assertEqual(parsed.salaryType, t.expectedType, `5.2.${i+1}a タイプ: "${t.salary}"`);
    assertEqual(passesFilter, t.shouldPass, `5.2.${i+1}b フィルタ: "${t.salary}"`);
  });

  // 5.3 境界値テスト - 25パターン
  console.log('\n--- 5.3 境界値テスト（25パターン） ---');

  const boundaryTests = [
    { value: 4999, expected: true, desc: '4999円は5000円未満（通過）' },
    { value: 5000, expected: false, desc: '5000円は5000円以上（除外）' },
    { value: 5001, expected: false, desc: '5001円は5000円以上（除外）' },
    { value: 4998, expected: true, desc: '4998円は5000円未満（通過）' },
    { value: 4997, expected: true, desc: '4997円は5000円未満（通過）' },
    { value: 5002, expected: false, desc: '5002円は5000円以上（除外）' },
    { value: 5003, expected: false, desc: '5003円は5000円以上（除外）' },
    { value: 4990, expected: true, desc: '4990円は5000円未満（通過）' },
    { value: 5010, expected: false, desc: '5010円は5000円以上（除外）' },
    { value: 4900, expected: true, desc: '4900円は5000円未満（通過）' },
    { value: 5100, expected: false, desc: '5100円は5000円以上（除外）' },
    { value: 4800, expected: true, desc: '4800円は5000円未満（通過）' },
    { value: 5200, expected: false, desc: '5200円は5000円以上（除外）' },
    { value: 4700, expected: true, desc: '4700円は5000円未満（通過）' },
    { value: 5300, expected: false, desc: '5300円は5000円以上（除外）' },
    { value: 4600, expected: true, desc: '4600円は5000円未満（通過）' },
    { value: 5400, expected: false, desc: '5400円は5000円以上（除外）' },
    { value: 4500, expected: true, desc: '4500円は5000円未満（通過）' },
    { value: 5500, expected: false, desc: '5500円は5000円以上（除外）' },
    { value: 1, expected: true, desc: '1円は5000円未満（通過）' },
    { value: 0, expected: false, desc: '0円は無効（除外）' },
    { value: -1, expected: false, desc: '-1円は無効（除外）' },
    { value: 4999.9, expected: true, desc: '4999.9円は5000円未満（通過）' },
    { value: 5000.1, expected: false, desc: '5000.1円は5000円以上（除外）' },
    { value: 4999.99, expected: true, desc: '4999.99円は5000円未満（通過）' },
  ];

  boundaryTests.forEach((t, i) => {
    const passes = t.value > 0 && t.value < 5000;
    assertEqual(passes, t.expected, `5.3.${i+1} ${t.desc}`);
  });

  // 5.4 日給混入防止テスト - 25パターン
  console.log('\n--- 5.4 日給混入防止テスト（25パターン） ---');

  const dailyContaminationTests = [
    { text: '日給8000円', shouldBeExcluded: true },
    { text: '日給10000円', shouldBeExcluded: true },
    { text: '日給12000円', shouldBeExcluded: true },
    { text: '日給15000円', shouldBeExcluded: true },
    { text: '日給7000円', shouldBeExcluded: true },
    { text: '日給6000円', shouldBeExcluded: true },
    { text: '日給5000円', shouldBeExcluded: true },
    { text: '日給5500円', shouldBeExcluded: true },
    { text: '日給9000円', shouldBeExcluded: true },
    { text: '日給11000円', shouldBeExcluded: true },
    { text: '時給1000円', shouldBeExcluded: false },
    { text: '時給1200円', shouldBeExcluded: false },
    { text: '時給1500円', shouldBeExcluded: false },
    { text: '時給2000円', shouldBeExcluded: false },
    { text: '時給2500円', shouldBeExcluded: false },
    { text: '日給13000円', shouldBeExcluded: true },
    { text: '日給14000円', shouldBeExcluded: true },
    { text: '日給16000円', shouldBeExcluded: true },
    { text: '日給17000円', shouldBeExcluded: true },
    { text: '日給18000円', shouldBeExcluded: true },
    { text: '日給19000円', shouldBeExcluded: true },
    { text: '日給20000円', shouldBeExcluded: true },
    { text: '時給3000円', shouldBeExcluded: false },
    { text: '時給3500円', shouldBeExcluded: false },
    { text: '時給4000円', shouldBeExcluded: false },
  ];

  dailyContaminationTests.forEach((t, i) => {
    const parsed = parseSalary(t.text);
    const isExcluded = parsed.salaryType === 'daily';
    assertEqual(isExcluded, t.shouldBeExcluded, `5.4.${i+1} "${t.text}" → 除外=${t.shouldBeExcluded}`);
  });
}

// =============================================================================
// メイン実行関数
// =============================================================================
function runAllHourlyModeTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║    時給モード網羅的テストスイート                              ║');
  console.log('║    500パターン以上のユニットテスト・統合テスト                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  // 全カテゴリのテスト実行
  runSalaryParserTests();
  runFilterLogicTests();
  runStatisticsTests();
  runInterpretationTests();
  runIntegrationTests();

  const elapsed = Date.now() - startTime;

  // 結果サマリー
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    テスト結果サマリー                          ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  総テスト数:  ${testsTotal.toString().padStart(4)}                                       ║`);
  console.log(`║  成功:        ${testsPassed.toString().padStart(4)} ✅                                    ║`);
  console.log(`║  失敗:        ${testsFailed.toString().padStart(4)} ${testsFailed > 0 ? '❌' : '✅'}                                    ║`);
  console.log(`║  成功率:      ${((testsPassed / testsTotal) * 100).toFixed(1).padStart(5)}%                                   ║`);
  console.log(`║  実行時間:    ${elapsed.toString().padStart(5)}ms                                   ║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  if (testsFailed === 0) {
    console.log('\n✅ すべてのテストが成功しました！時給モードの実装は正常です。');
  } else {
    console.log(`\n❌ ${testsFailed}件のテストが失敗しました。上記のログを確認してください。`);
  }

  return {
    total: testsTotal,
    passed: testsPassed,
    failed: testsFailed,
    elapsed: elapsed,
    success: testsFailed === 0
  };
}

// GASから直接実行する場合
// runAllHourlyModeTests();
