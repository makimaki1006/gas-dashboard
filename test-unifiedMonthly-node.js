// unifiedMonthly廃止テスト - Node.js版
// 実行: node test-unifiedMonthly-node.js

// ========================================
// 実装コードのコピー（Aggregator.jsから）
// ========================================
function filterAndGetSalaryByMode(parsedData, isHourly) {
  if (isHourly) {
    const filteredData = parsedData.filter(d =>
      d.salaryParsed &&
      d.salaryParsed.salaryType === 'hourly' &&
      d.salaryParsed.minValue !== null &&
      d.salaryParsed.minValue > 0
    );
    return {
      filteredData,
      getSalary: (d) => d.salaryParsed.minValue
    };
  } else {
    // 月給モード: monthly または annual のみ（daily等は除外）
    const filteredData = parsedData.filter(d =>
      d.salaryParsed &&
      (d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual') &&
      d.salaryParsed.minValue !== null &&
      d.salaryParsed.minValue > 0
    );
    return {
      filteredData,
      getSalary: (d) => {
        if (d.salaryParsed.salaryType === 'annual') {
          return Math.round(d.salaryParsed.minValue / 12);
        }
        return d.salaryParsed.minValue;
      }
    };
  }
}

function calcTrimmedAvg(values) {
  if (values.length === 0) return 0;
  if (values.length < 10) {
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  if (trimmed.length === 0) return 0;
  return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
}

// ========================================
// テストデータ生成
// ========================================
function generateMixedData() {
  return [
    { id: 'h1', salaryParsed: { salaryType: 'hourly', minValue: 1200, maxValue: 1500 } },
    { id: 'h2', salaryParsed: { salaryType: 'hourly', minValue: 1500, maxValue: 1800 } },
    { id: 'h3', salaryParsed: { salaryType: 'hourly', minValue: 1000, maxValue: 1200 } },
    { id: 'h4', salaryParsed: { salaryType: 'hourly', minValue: 1800, maxValue: 2200 } },
    { id: 'h5', salaryParsed: { salaryType: 'hourly', minValue: 2000, maxValue: 2500 } },
    { id: 'm1', salaryParsed: { salaryType: 'monthly', minValue: 250000, maxValue: 300000 } },
    { id: 'm2', salaryParsed: { salaryType: 'monthly', minValue: 300000, maxValue: 400000 } },
    { id: 'm3', salaryParsed: { salaryType: 'monthly', minValue: 200000, maxValue: 250000 } },
    { id: 'm4', salaryParsed: { salaryType: 'monthly', minValue: 350000, maxValue: 450000 } },
    { id: 'm5', salaryParsed: { salaryType: 'monthly', minValue: 280000, maxValue: 350000 } },
    { id: 'a1', salaryParsed: { salaryType: 'annual', minValue: 4800000, maxValue: 6000000 } },
    { id: 'a2', salaryParsed: { salaryType: 'annual', minValue: 6000000, maxValue: 7200000 } },
    { id: 'a3', salaryParsed: { salaryType: 'annual', minValue: 3600000, maxValue: 4800000 } },
    { id: 'invalid1', salaryParsed: { salaryType: 'hourly', minValue: null } },
    { id: 'invalid2', salaryParsed: { salaryType: 'monthly', minValue: 0 } },
    { id: 'invalid3', salaryParsed: null },
    { id: 'invalid4', salaryParsed: { salaryType: 'daily', minValue: 10000 } },
  ];
}

// ========================================
// テスト実行
// ========================================
console.log('='.repeat(60));
console.log('unifiedMonthly廃止テスト - filterAndGetSalaryByMode検証');
console.log('='.repeat(60));

const testResults = [];
const mixedData = generateMixedData();

// Test 1: 時給モードフィルタリング
console.log('\n--- Test 1: 時給モードフィルタリング ---');
const hourlyResult = filterAndGetSalaryByMode(mixedData, true);
const hourlyIds = hourlyResult.filteredData.map(d => d.id);
const expectedHourlyIds = ['h1', 'h2', 'h3', 'h4', 'h5'];
const test1Pass = JSON.stringify(hourlyIds.sort()) === JSON.stringify(expectedHourlyIds.sort());
console.log('入力: 17件（時給5件、月給5件、年収3件、無効4件）');
console.log('期待: 時給データのみ', expectedHourlyIds.length, '件');
console.log('実際:', hourlyIds.length, '件 [' + hourlyIds.join(', ') + ']');
console.log('結果:', test1Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '時給モードフィルタ', pass: test1Pass });

// Test 2: 時給モードでの給与値
console.log('\n--- Test 2: 時給モードでの給与値（円） ---');
const hourlySalaries = hourlyResult.filteredData.map(d => hourlyResult.getSalary(d));
const expectedHourlySalaries = [1200, 1500, 1000, 1800, 2000];
const test2Pass = JSON.stringify(hourlySalaries.sort((a,b)=>a-b)) === JSON.stringify(expectedHourlySalaries.sort((a,b)=>a-b));
console.log('期待値: [' + expectedHourlySalaries.join(', ') + ']円');
console.log('実際値: [' + hourlySalaries.join(', ') + ']円');
console.log('平均時給:', calcTrimmedAvg(hourlySalaries), '円');
console.log('結果:', test2Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '時給モード給与値', pass: test2Pass });

// Test 3: 月給モードフィルタリング
console.log('\n--- Test 3: 月給モードフィルタリング ---');
const monthlyResult = filterAndGetSalaryByMode(mixedData, false);
const monthlyIds = monthlyResult.filteredData.map(d => d.id);
const expectedMonthlyIds = ['m1', 'm2', 'm3', 'm4', 'm5', 'a1', 'a2', 'a3'];
const test3Pass = JSON.stringify(monthlyIds.sort()) === JSON.stringify(expectedMonthlyIds.sort());
console.log('入力: 17件（時給5件、月給5件、年収3件、無効4件）');
console.log('期待: 月給+年収データ', expectedMonthlyIds.length, '件');
console.log('実際:', monthlyIds.length, '件 [' + monthlyIds.join(', ') + ']');
console.log('結果:', test3Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '月給モードフィルタ', pass: test3Pass });

// Test 4: 年収→月給変換
console.log('\n--- Test 4: 年収→月給変換（÷12） ---');
const annualData = monthlyResult.filteredData.filter(d => d.salaryParsed.salaryType === 'annual');
let test4Pass = true;
annualData.forEach(d => {
  const original = d.salaryParsed.minValue;
  const converted = monthlyResult.getSalary(d);
  const expected = Math.round(original / 12);
  const match = converted === expected;
  if (!match) test4Pass = false;
  console.log(d.id + ': ' + original.toLocaleString() + '円 → ' + converted.toLocaleString() + '円 (期待: ' + expected.toLocaleString() + '円) ' + (match ? 'OK' : 'NG'));
});
console.log('結果:', test4Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '年収→月給変換', pass: test4Pass });

// Test 5: 月給データはそのまま
console.log('\n--- Test 5: 月給データはそのまま ---');
const pureMonthlyData = monthlyResult.filteredData.filter(d => d.salaryParsed.salaryType === 'monthly');
let test5Pass = true;
pureMonthlyData.forEach(d => {
  const original = d.salaryParsed.minValue;
  const result = monthlyResult.getSalary(d);
  const match = original === result;
  if (!match) test5Pass = false;
  console.log(d.id + ': ' + original.toLocaleString() + '円 → ' + result.toLocaleString() + '円 ' + (match ? 'OK' : 'NG'));
});
console.log('結果:', test5Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '月給データそのまま', pass: test5Pass });

// Test 6: 日給データの除外
console.log('\n--- Test 6: 日給データ(daily)の除外確認 ---');
const dailyInHourly = hourlyResult.filteredData.filter(d => d.salaryParsed.salaryType === 'daily');
const dailyInMonthly = monthlyResult.filteredData.filter(d => d.salaryParsed.salaryType === 'daily');
const test6Pass = dailyInHourly.length === 0 && dailyInMonthly.length === 0;
console.log('時給モードに含まれる日給データ:', dailyInHourly.length, '件');
console.log('月給モードに含まれる日給データ:', dailyInMonthly.length, '件');
console.log('結果:', test6Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '日給データ除外', pass: test6Pass });

// Test 7: 無効データの除外
console.log('\n--- Test 7: 無効データの除外確認 ---');
const invalidIds = ['invalid1', 'invalid2', 'invalid3', 'invalid4'];
const invalidInHourly = hourlyResult.filteredData.filter(d => invalidIds.includes(d.id));
const invalidInMonthly = monthlyResult.filteredData.filter(d => invalidIds.includes(d.id));
const test7Pass = invalidInHourly.length === 0 && invalidInMonthly.length === 0;
console.log('時給モードに含まれる無効データ:', invalidInHourly.length, '件');
console.log('月給モードに含まれる無効データ:', invalidInMonthly.length, '件');
console.log('結果:', test7Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '無効データ除外', pass: test7Pass });

// Test 8: 大量データテスト
console.log('\n--- Test 8: 大量データテスト（1000件） ---');
const largeData = [];
for (let i = 0; i < 1000; i++) {
  if (i % 3 === 0) {
    largeData.push({ id: 'l' + i, salaryParsed: { salaryType: 'hourly', minValue: 1000 + (i % 500) } });
  } else if (i % 3 === 1) {
    largeData.push({ id: 'l' + i, salaryParsed: { salaryType: 'monthly', minValue: 200000 + (i * 100) } });
  } else {
    largeData.push({ id: 'l' + i, salaryParsed: { salaryType: 'annual', minValue: 3000000 + (i * 1000) } });
  }
}

const startTime = Date.now();
const largeHourlyResult = filterAndGetSalaryByMode(largeData, true);
const largeMonthlyResult = filterAndGetSalaryByMode(largeData, false);
const endTime = Date.now();

const expectedHourlyCount = Math.ceil(1000 / 3);
const expectedMonthlyCount = 1000 - expectedHourlyCount;
const test8Pass = largeHourlyResult.filteredData.length === expectedHourlyCount && largeMonthlyResult.filteredData.length === expectedMonthlyCount;
console.log('入力: 1000件（時給334件、月給333件、年収333件）');
console.log('時給モード結果:', largeHourlyResult.filteredData.length, '件（期待:', expectedHourlyCount, '件）');
console.log('月給モード結果:', largeMonthlyResult.filteredData.length, '件（期待:', expectedMonthlyCount, '件）');
console.log('処理時間:', (endTime - startTime), 'ms');
console.log('結果:', test8Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '大量データ処理', pass: test8Pass });

// Test 9: 境界値テスト
console.log('\n--- Test 9: 境界値テスト ---');
const boundaryData = [
  { id: 'b1', salaryParsed: { salaryType: 'hourly', minValue: 1 } },
  { id: 'b2', salaryParsed: { salaryType: 'monthly', minValue: 1 } },
  { id: 'b3', salaryParsed: { salaryType: 'annual', minValue: 12 } },
  { id: 'b4', salaryParsed: { salaryType: 'hourly', minValue: -1 } },
  { id: 'b5', salaryParsed: { salaryType: 'monthly', minValue: 0 } },
];

const boundaryHourly = filterAndGetSalaryByMode(boundaryData, true);
const boundaryMonthly = filterAndGetSalaryByMode(boundaryData, false);

const test9Pass = boundaryHourly.filteredData.length === 1 &&
                  boundaryMonthly.filteredData.length === 2 &&
                  boundaryHourly.getSalary(boundaryHourly.filteredData[0]) === 1 &&
                  boundaryMonthly.getSalary(boundaryMonthly.filteredData.find(d => d.id === 'b3')) === 1;

console.log('時給 minValue=1 → 含まれる、値=1');
console.log('月給 minValue=1 → 含まれる、値=1');
console.log('年収 minValue=12 → 含まれる、値=1（12÷12）');
console.log('時給 minValue=-1 → 除外');
console.log('月給 minValue=0 → 除外');
console.log('時給モード結果:', boundaryHourly.filteredData.length, '件 [' + boundaryHourly.filteredData.map(d => d.id).join(', ') + ']');
console.log('月給モード結果:', boundaryMonthly.filteredData.length, '件 [' + boundaryMonthly.filteredData.map(d => d.id).join(', ') + ']');
console.log('結果:', test9Pass ? 'PASS' : 'FAIL');
testResults.push({ name: '境界値テスト', pass: test9Pass });

// 総合結果
console.log('\n' + '='.repeat(60));
console.log('総合結果');
console.log('='.repeat(60));

const passCount = testResults.filter(t => t.pass).length;
const totalCount = testResults.length;
const allPass = passCount === totalCount;

testResults.forEach(t => {
  console.log((t.pass ? '[PASS]' : '[FAIL]') + ' ' + t.name);
});

console.log('\n' + passCount + '/' + totalCount + ' テスト合格');
console.log(allPass ? 'すべてのテストが合格しました。unifiedMonthly廃止の実装は正常です。' : '一部のテストが失敗しています。実装を確認してください。');

process.exit(allPass ? 0 : 1);
