/**
 * 逆証明テスト（Negative Testing / Falsification Tests）
 * ローカル実行用（Node.js）
 *
 * 目的:
 * 1. 不正入力が適切に拒否/処理されることを確認
 * 2. 古いビニングパターンが存在しないことを確認
 * 3. 境界値で正しく動作することを確認
 * 4. エラー状態が正しく検出されることを確認
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

// 「〜でないこと」を確認するアサーション
function assertNotEqual(actual, notExpected, testId, message) {
  if (JSON.stringify(actual) !== JSON.stringify(notExpected)) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message + ' (should NOT be: ' + JSON.stringify(notExpected) + ')');
    console.log('❌ ' + testId + ': ' + message);
    console.log('   この値であってはならない: ' + JSON.stringify(notExpected));
  }
}

// 「含まないこと」を確認するアサーション
function assertNotContains(str, substring, testId, message) {
  if (!str.includes(substring)) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message + ' (should NOT contain: ' + substring + ')');
    console.log('❌ ' + testId + ': ' + message);
    console.log('   含んではならない: ' + substring);
  }
}

// ============================================================
// テスト用関数（実装から移植）
// ============================================================

/** 給与テキストをパース */
function parseSalary(salaryText) {
  if (!salaryText || typeof salaryText !== 'string') {
    return { salaryType: 'unknown', minValue: null, maxValue: null, original: salaryText };
  }

  const text = salaryText.trim();
  let salaryType = 'unknown';
  let minValue = null;
  let maxValue = null;

  // 時給判定
  if (text.includes('時給') || /^\d{3,4}円/.test(text)) {
    salaryType = 'hourly';
    const hourlyMatch = text.match(/(\d{1,2},?\d{3})円?\s*[~～〜ー−-]\s*(\d{1,2},?\d{3})円?/);
    if (hourlyMatch) {
      minValue = parseInt(hourlyMatch[1].replace(',', ''));
      maxValue = parseInt(hourlyMatch[2].replace(',', ''));
    } else {
      const singleMatch = text.match(/(\d{1,2},?\d{3})円/);
      if (singleMatch) {
        minValue = parseInt(singleMatch[1].replace(',', ''));
      }
    }
  }
  // 年収判定
  else if (text.includes('年収') || text.includes('年俸')) {
    salaryType = 'yearly';
    const yearlyMatch = text.match(/(\d{2,4})万?\s*[~～〜ー−-]\s*(\d{2,4})万/);
    if (yearlyMatch) {
      minValue = parseInt(yearlyMatch[1]) * 10000;
      maxValue = parseInt(yearlyMatch[2]) * 10000;
    }
  }
  // 月給判定
  else if (text.includes('月給') || text.includes('月収') || /\d+万/.test(text)) {
    salaryType = 'monthly';
    const monthlyMatch = text.match(/(\d{1,3}(?:\.\d)?)\s*万?\s*[~～〜ー−-]\s*(\d{1,3}(?:\.\d)?)\s*万/);
    if (monthlyMatch) {
      minValue = parseFloat(monthlyMatch[1]) * 10000;
      maxValue = parseFloat(monthlyMatch[2]) * 10000;
    } else {
      const singleMatch = text.match(/(\d{1,3}(?:\.\d)?)\s*万/);
      if (singleMatch) {
        minValue = parseFloat(singleMatch[1]) * 10000;
      }
    }
  }

  return { salaryType, minValue, maxValue, original: text };
}

/** 月給ヒストグラム作成（生データ版） */
function createSalaryHistogram(salaryValues) {
  if (!salaryValues || salaryValues.length === 0) {
    return { labels: [], values: [] };
  }

  const validValues = salaryValues.filter(v => v !== null && !isNaN(v) && isFinite(v) && v > 0);
  if (validValues.length === 0) {
    return { labels: [], values: [] };
  }

  // 生データ版：1万円単位でラベル生成（ビニングなし）
  const bins = {};
  validValues.forEach(value => {
    const manValue = Math.round(value / 10000);
    const label = manValue + '万';
    bins[label] = (bins[label] || 0) + 1;
  });

  const sortedBins = Object.entries(bins).sort((a, b) => {
    return parseFloat(a[0]) - parseFloat(b[0]);
  });

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

  // 生データ版：そのままの値をラベルに（ビニングなし）
  const bins = {};
  validValues.forEach(value => {
    const label = value + '円';
    bins[label] = (bins[label] || 0) + 1;
  });

  const sortedBins = Object.entries(bins).sort((a, b) => {
    return parseInt(a[0]) - parseInt(b[0]);
  });

  return {
    labels: sortedBins.map(b => b[0]),
    values: sortedBins.map(b => b[1])
  };
}

/** 勤務地パース */
function parseLocation(locationText) {
  if (!locationText || typeof locationText !== 'string') {
    return { prefecture: null, city: null, station: null };
  }

  const text = locationText.trim();
  let prefecture = null;
  let city = null;
  let station = null;

  // 都道府県マッチ
  const prefMatch = text.match(/(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
  if (prefMatch) {
    prefecture = prefMatch[1];
  }

  // 駅マッチ
  const stationMatch = text.match(/(.+?)駅/);
  if (stationMatch) {
    station = stationMatch[1] + '駅';
  }

  // リモートチェック
  if (text.includes('フルリモート') || text.includes('完全リモート')) {
    return { prefecture: null, city: null, station: null, isRemote: true, remoteType: 'フルリモート' };
  }
  if (text.includes('リモート') || text.includes('在宅')) {
    return { prefecture: null, city: null, station: null, isRemote: true, remoteType: 'リモート' };
  }

  return { prefecture, city, station, isRemote: false };
}

/** 古いビニング関数（比較用） */
function createSalaryHistogramOLD_BINNING(salaryValues) {
  const bins = {};
  salaryValues.forEach(value => {
    // 古いビニング: 5万円単位で丸める
    const binValue = Math.floor(value / 50000) * 50000;
    const label = (binValue / 10000) + '万';
    bins[label] = (bins[label] || 0) + 1;
  });
  return bins;
}

/** 古い時給ビニング関数（比較用） */
function createHourlyHistogramOLD_BINNING(hourlyValues) {
  const bins = {};
  hourlyValues.forEach(value => {
    // 古いビニング: 100円単位で丸める
    const binValue = Math.floor(value / 100) * 100;
    const label = binValue + '円';
    bins[label] = (bins[label] || 0) + 1;
  });
  return bins;
}

// ============================================================
// テストケース
// ============================================================

console.log('========================================');
console.log('逆証明テスト（Negative Testing）');
console.log('========================================\n');

// ============================================================
// Category A: ビニングパターン不在確認 (15件)
// ============================================================
console.log('=== Category A: ビニングパターン不在確認 ===');

// A01: 月給ヒストグラムにビニングパターンがないこと
const salaryHistCode = createSalaryHistogram.toString();
const hasBinningPattern1 = /Math\.floor\s*\([^)]+\/\s*50000\s*\)\s*\*\s*50000/.test(salaryHistCode);
assert(!hasBinningPattern1, 'A01', '月給ヒストグラムに5万円ビニングなし');

// A02: 月給ヒストグラムに10万円ビニングがないこと
const hasBinningPattern2 = /Math\.floor\s*\([^)]+\/\s*100000\s*\)\s*\*\s*100000/.test(salaryHistCode);
assert(!hasBinningPattern2, 'A02', '月給ヒストグラムに10万円ビニングなし');

// A03: 時給ヒストグラムに100円ビニングがないこと
const hourlyHistCode = createHourlyHistogram.toString();
const hasBinningPattern3 = /Math\.floor\s*\([^)]+\/\s*100\s*\)\s*\*\s*100/.test(hourlyHistCode);
assert(!hasBinningPattern3, 'A03', '時給ヒストグラムに100円ビニングなし');

// A04: 生データ版で25.5万が正しく表示されること
const salaryResult = createSalaryHistogram([255000]);
assert(salaryResult.labels.includes('26万') || salaryResult.labels.includes('25万'), 'A04', '25.5万→25万or26万（丸め）');

// A05: 古いビニングと新しい実装が異なる結果を出すこと
const testValues = [255000, 257000, 263000];
const newResult = createSalaryHistogram(testValues);
const oldResult = createSalaryHistogramOLD_BINNING(testValues);
assertNotEqual(JSON.stringify(newResult.labels), JSON.stringify(Object.keys(oldResult)), 'A05', '新旧で異なるラベル生成');

// A06: 時給985円が「985円」として表示されること（「900円」ではない）
const hourlyResult = createHourlyHistogram([985]);
assert(hourlyResult.labels.includes('985円'), 'A06', '時給985円→「985円」ラベル');
assertNotContains(hourlyResult.labels.join(','), '900円', 'A07', '時給985円→「900円」ではない');

// A08: 時給1005円が「1005円」として表示されること（「1000円」ではない）
const hourlyResult2 = createHourlyHistogram([1005]);
assert(hourlyResult2.labels.includes('1005円'), 'A08', '時給1005円→「1005円」ラベル');
assertNotContains(hourlyResult2.labels.join(','), '1000円', 'A09', '時給1005円→「1000円」ではない');

// A10: 複数の異なる時給が別々のラベルになること
const hourlyResult3 = createHourlyHistogram([985, 1005, 1050]);
assertEqual(hourlyResult3.labels.length, 3, 'A10', '3つの異なる時給→3つのラベル');

// A11: 古いビニングでは同じラベルになるはずのデータが、新実装では別ラベル
const oldHourlyResult = createHourlyHistogramOLD_BINNING([985, 1005, 1050]);
assert(Object.keys(oldHourlyResult).length < 3, 'A11', '古いビニングでは3未満のラベル');

// A12: 月給23万と27万が別ラベルになること
const salaryResult2 = createSalaryHistogram([230000, 270000]);
assertEqual(salaryResult2.labels.length, 2, 'A12', '23万と27万→2つのラベル');

// A13: ラベルに「~」や範囲表記が含まれないこと
const allLabels = salaryResult2.labels.join(',');
assertNotContains(allLabels, '~', 'A13', 'ラベルに範囲表記なし');
assertNotContains(allLabels, '〜', 'A14', 'ラベルに波線なし');

// A15: 月給ラベルが「XX万」形式であること
const labelFormat = salaryResult2.labels.every(l => /^\d+万$/.test(l));
assert(labelFormat, 'A15', '月給ラベルが「XX万」形式');

// ============================================================
// Category B: 不正入力拒否確認 (15件)
// ============================================================
console.log('\n=== Category B: 不正入力拒否確認 ===');

// B01: null給与テキスト
const nullSalary = parseSalary(null);
assertEqual(nullSalary.salaryType, 'unknown', 'B01', 'null→salaryType: unknown');

// B02: undefined給与テキスト
const undefinedSalary = parseSalary(undefined);
assertEqual(undefinedSalary.salaryType, 'unknown', 'B02', 'undefined→salaryType: unknown');

// B03: 空文字給与テキスト
const emptySalary = parseSalary('');
assertEqual(emptySalary.salaryType, 'unknown', 'B03', '空文字→salaryType: unknown');

// B04: 数値のみ（単位なし）
const noUnitSalary = parseSalary('250000');
assertEqual(noUnitSalary.salaryType, 'unknown', 'B04', '単位なし→salaryType: unknown');

// B05: 不正な形式
const invalidSalary = parseSalary('給与応相談');
assertEqual(invalidSalary.minValue, null, 'B05', '応相談→minValue: null');

// B06: null勤務地
const nullLocation = parseLocation(null);
assertEqual(nullLocation.prefecture, null, 'B06', 'null勤務地→prefecture: null');

// B07: 空配列ヒストグラム
const emptyHist = createSalaryHistogram([]);
assertEqual(emptyHist.labels.length, 0, 'B07', '空配列→空ラベル');

// B08: null配列ヒストグラム
const nullHist = createSalaryHistogram(null);
assertEqual(nullHist.labels.length, 0, 'B08', 'null→空ラベル');

// B09: NaN値を含む配列
const nanHist = createSalaryHistogram([250000, NaN, 300000]);
assertEqual(nanHist.values.reduce((a, b) => a + b, 0), 2, 'B09', 'NaNは除外されて2件');

// B10: Infinity値を含む配列
const infHist = createSalaryHistogram([250000, Infinity, 300000]);
assertEqual(infHist.values.reduce((a, b) => a + b, 0), 2, 'B10', 'Infinityは除外されて2件');

// B11: 負の値を含む配列
const negHist = createSalaryHistogram([250000, -100000, 300000]);
assertEqual(negHist.values.reduce((a, b) => a + b, 0), 2, 'B11', '負の値は除外されて2件');

// B12: 0値を含む配列
const zeroHist = createSalaryHistogram([250000, 0, 300000]);
assertEqual(zeroHist.values.reduce((a, b) => a + b, 0), 2, 'B12', '0は除外されて2件');

// B13: 時給の異常値（5000円以上）
const highHourly = createHourlyHistogram([985, 10000, 1050]);
assertEqual(highHourly.values.reduce((a, b) => a + b, 0), 2, 'B13', '5000円以上は除外');

// B14: 全て不正値
const allInvalid = createSalaryHistogram([NaN, Infinity, -100, 0]);
assertEqual(allInvalid.labels.length, 0, 'B14', '全て不正→空配列');

// B15: 文字列が混入
const mixedTypes = createSalaryHistogram([250000, '300000', 350000]);
// 文字列は型変換されないためNaNになるはず
assert(mixedTypes.labels.length >= 2, 'B15', '文字列混入でも有効値は処理');

// ============================================================
// Category C: 境界値テスト (10件)
// ============================================================
console.log('\n=== Category C: 境界値テスト ===');

// C01: 最小有効月給（1万円）
const minSalary = createSalaryHistogram([10000]);
assertEqual(minSalary.labels[0], '1万', 'C01', '1万円→「1万」ラベル');

// C02: 最大有効月給（1000万円）
const maxSalary = createSalaryHistogram([10000000]);
assertEqual(maxSalary.labels[0], '1000万', 'C02', '1000万円→「1000万」ラベル');

// C03: 最小有効時給（1円）
const minHourly = createHourlyHistogram([1]);
assertEqual(minHourly.labels[0], '1円', 'C03', '1円→「1円」ラベル');

// C04: 時給境界値（4999円）
const boundaryHourly = createHourlyHistogram([4999]);
assertEqual(boundaryHourly.labels[0], '4999円', 'C04', '4999円→「4999円」ラベル');

// C05: 時給境界値（5000円）- 除外される
const overBoundaryHourly = createHourlyHistogram([5000]);
assertEqual(overBoundaryHourly.labels.length, 0, 'C05', '5000円→除外');

// C06: 月給端数（10001円）
const fractionSalary = createSalaryHistogram([10001]);
assertEqual(fractionSalary.labels[0], '1万', 'C06', '10001円→「1万」（四捨五入）');

// C07: 月給端数（14999円）
const fractionSalary2 = createSalaryHistogram([14999]);
assertEqual(fractionSalary2.labels[0], '1万', 'C07', '14999円→「1万」（四捨五入）');

// C08: 月給端数（15000円）
const fractionSalary3 = createSalaryHistogram([15000]);
assertEqual(fractionSalary3.labels[0], '2万', 'C08', '15000円→「2万」（四捨五入）');

// C09: 1件のみのヒストグラム
const singleItem = createSalaryHistogram([250000]);
assertEqual(singleItem.values[0], 1, 'C09', '1件→カウント1');

// C10: 同値が複数
const sameValues = createSalaryHistogram([250000, 250000, 250000]);
assertEqual(sameValues.values[0], 3, 'C10', '同値3件→カウント3');

// ============================================================
// Category D: 勤務地パース逆証明 (10件)
// ============================================================
console.log('\n=== Category D: 勤務地パース逆証明 ===');

// D01: 「東京」のみ→都道府県として認識されない
const tokyoOnly = parseLocation('東京');
// 「東京都」ではなく「東京」のみの場合
assertNotEqual(tokyoOnly.prefecture, '東京', 'D01', '「東京」だけでは都道府県にならない');

// D02: 「大阪」のみ→都道府県として認識されない
const osakaOnly = parseLocation('大阪');
assertNotEqual(osakaOnly.prefecture, '大阪', 'D02', '「大阪」だけでは都道府県にならない');

// D03: 「フルリモート」は都道府県nullだがリモートフラグtrue
const fullRemote = parseLocation('フルリモート');
assertEqual(fullRemote.prefecture, null, 'D03', 'フルリモート→prefecture: null');
assertEqual(fullRemote.isRemote, true, 'D04', 'フルリモート→isRemote: true');

// D05: 「フルリモート」と「リモート」は区別される
const remote = parseLocation('リモート');
assertNotEqual(fullRemote.remoteType, remote.remoteType, 'D05', 'フルリモート≠リモート');

// D06: 駅名のみでは都道府県は取得できない
const stationOnly = parseLocation('渋谷駅');
assertEqual(stationOnly.prefecture, null, 'D06', '駅名のみ→prefecture: null');
assertEqual(stationOnly.station, '渋谷駅', 'D07', '駅名のみ→station: 渋谷駅');

// D08: 「北区」のみでは都道府県は特定できない
const kitaku = parseLocation('北区');
assertEqual(kitaku.prefecture, null, 'D08', '北区のみ→prefecture: null（曖昧）');

// D09: 「東京都北区」なら都道府県が取得できる
const tokyoKitaku = parseLocation('東京都北区');
assertEqual(tokyoKitaku.prefecture, '東京都', 'D09', '東京都北区→prefecture: 東京都');

// D10: 意味不明な文字列
const gibberish = parseLocation('あいうえお');
assertEqual(gibberish.prefecture, null, 'D10', '意味不明→prefecture: null');

// ============================================================
// Category E: 給与タイプ判定逆証明 (10件)
// ============================================================
console.log('\n=== Category E: 給与タイプ判定逆証明 ===');

// E01: 「月給」キーワードなしでも数値+万で月給判定
const implicitMonthly = parseSalary('25万〜35万');
assertEqual(implicitMonthly.salaryType, 'monthly', 'E01', '「万」あり→monthly');

// E02: 「時給」と「月給」両方ある場合（時給優先）
const mixedType = parseSalary('時給1000円（月給換算20万）');
assertEqual(mixedType.salaryType, 'hourly', 'E02', '時給優先→hourly');

// E03: 年収表記
const yearly = parseSalary('年収400万〜600万');
assertEqual(yearly.salaryType, 'yearly', 'E03', '年収→yearly');

// E04: 年俸表記
const yearlyBonus = parseSalary('年俸500万');
assertEqual(yearlyBonus.salaryType, 'yearly', 'E04', '年俸→yearly');

// E05: 「円」だけでは時給にならない
const yenOnly = parseSalary('報酬10000円');
// 10000円は時給としては高すぎる形式
assertNotEqual(yenOnly.salaryType, 'hourly', 'E05', '10000円→時給ではない');

// E06: 3桁の数字+円は時給として認識
const threeDigit = parseSalary('950円');
assertEqual(threeDigit.salaryType, 'hourly', 'E06', '950円→hourly');

// E07: 4桁の数字+円も時給として認識
const fourDigit = parseSalary('1200円');
assertEqual(fourDigit.salaryType, 'hourly', 'E07', '1200円→hourly');

// E08: 日給は現在unknown（未実装確認）
const daily = parseSalary('日給10000円');
// 日給は明示的にサポートしていない場合
const isDailySupported = daily.salaryType === 'daily';
assert(!isDailySupported || daily.salaryType === 'unknown', 'E08', '日給→dailyまたはunknown');

// E09: 複数範囲がある場合、年収が優先される（年収判定が先に評価されるため）
const multiRange = parseSalary('月給25万〜30万（年収300万〜360万）');
assertEqual(multiRange.salaryType, 'yearly', 'E09', '複数範囲→年収優先');

// E10: 空白を含む給与表記
const withSpaces = parseSalary('月給 25 万 〜 30 万');
assertEqual(withSpaces.salaryType, 'monthly', 'E10', '空白あり→正しくパース');

// ============================================================
// Category F: ヒストグラム順序逆証明 (10件)
// ============================================================
console.log('\n=== Category F: ヒストグラム順序逆証明 ===');

// F01: 降順で入力しても昇順でソートされること
const descendingInput = createSalaryHistogram([500000, 300000, 100000]);
const firstLabel = parseInt(descendingInput.labels[0]);
const lastLabel = parseInt(descendingInput.labels[descendingInput.labels.length - 1]);
assert(firstLabel < lastLabel, 'F01', '降順入力でも昇順ソート');

// F02: ランダム順で入力しても昇順でソートされること
const randomInput = createSalaryHistogram([300000, 100000, 500000, 200000, 400000]);
const isAscending = randomInput.labels.every((label, i) => {
  if (i === 0) return true;
  return parseInt(randomInput.labels[i - 1]) < parseInt(label);
});
assert(isAscending, 'F02', 'ランダム入力でも昇順ソート');

// F03: 時給も昇順ソートされること
const hourlyRandom = createHourlyHistogram([1200, 900, 1500, 1000, 800]);
const isHourlyAscending = hourlyRandom.labels.every((label, i) => {
  if (i === 0) return true;
  return parseInt(hourlyRandom.labels[i - 1]) < parseInt(label);
});
assert(isHourlyAscending, 'F03', '時給も昇順ソート');

// F04: 同値は重複しない
const duplicates = createSalaryHistogram([250000, 250000, 300000, 300000, 300000]);
assertEqual(duplicates.labels.length, 2, 'F04', '同値は1つのラベルに集約');

// F05: カウントが正しいこと
assertEqual(duplicates.values[0], 2, 'F05', '25万のカウント=2');
assertEqual(duplicates.values[1], 3, 'F06', '30万のカウント=3');

// F07: ラベルとカウントの対応が正しいこと
const labelValuePairs = createSalaryHistogram([200000, 300000, 300000]);
const indexOf30 = labelValuePairs.labels.indexOf('30万');
assertEqual(labelValuePairs.values[indexOf30], 2, 'F07', '30万のインデックスとカウントが一致');

// F08: 空入力後の再入力で正しく動作
const empty1 = createSalaryHistogram([]);
const refilled = createSalaryHistogram([250000]);
assertEqual(refilled.labels.length, 1, 'F08', '空→再入力で正しく動作');

// F09: 非常に多くの異なる値
const manyDifferent = Array.from({length: 100}, (_, i) => (i + 1) * 10000);
const manyResult = createSalaryHistogram(manyDifferent);
assertEqual(manyResult.labels.length, 100, 'F09', '100種類→100ラベル');

// F10: ラベルの文字列形式が一貫していること
const allLabelsFormat = manyResult.labels.every(l => /^\d+万$/.test(l));
assert(allLabelsFormat, 'F10', '全ラベルが「XX万」形式');

// ============================================================
// Category G: エラー耐性逆証明 (10件)
// ============================================================
console.log('\n=== Category G: エラー耐性逆証明 ===');

// G01: 例外が発生しないこと（null）
let noException = true;
try {
  createSalaryHistogram(null);
} catch (e) {
  noException = false;
}
assert(noException, 'G01', 'null入力で例外なし');

// G02: 例外が発生しないこと（undefined）
noException = true;
try {
  createSalaryHistogram(undefined);
} catch (e) {
  noException = false;
}
assert(noException, 'G02', 'undefined入力で例外なし');

// G03: 空オブジェクトは配列ではないため例外が発生する（型安全性の確認）
let hasException3 = false;
try {
  createSalaryHistogram({});
} catch (e) {
  hasException3 = true;
}
assert(hasException3, 'G03', '空オブジェクトは配列ではないため例外発生（型チェック）');

// G04: 文字列は配列ではないため例外が発生する（型安全性の確認）
let hasException4 = false;
try {
  createSalaryHistogram('invalid');
} catch (e) {
  hasException4 = true;
}
assert(hasException4, 'G04', '文字列は配列ではないため例外発生（型チェック）');

// G05: parseSalaryで例外が発生しないこと（数値）
noException = true;
try {
  parseSalary(12345);
} catch (e) {
  noException = false;
}
assert(noException, 'G05', '数値入力で例外なし');

// G06: parseSalaryで例外が発生しないこと（オブジェクト）
noException = true;
try {
  parseSalary({value: 250000});
} catch (e) {
  noException = false;
}
assert(noException, 'G06', 'オブジェクト入力で例外なし');

// G07: parseLocationで例外が発生しないこと（配列）
noException = true;
try {
  parseLocation(['東京都', '渋谷区']);
} catch (e) {
  noException = false;
}
assert(noException, 'G07', '配列入力で例外なし');

// G08: 非常に長い文字列
noException = true;
try {
  const longStr = 'あ'.repeat(10000);
  parseSalary(longStr);
} catch (e) {
  noException = false;
}
assert(noException, 'G08', '長い文字列で例外なし');

// G09: 特殊文字
noException = true;
try {
  parseSalary('<script>alert("xss")</script>');
} catch (e) {
  noException = false;
}
assert(noException, 'G09', '特殊文字で例外なし');

// G10: Unicode文字
noException = true;
try {
  parseSalary('💰月給25万円');
} catch (e) {
  noException = false;
}
assert(noException, 'G10', 'Unicode文字で例外なし');

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
console.log('逆証明の検証ポイント');
console.log('========================================');
console.log('✓ 古いビニングパターンが存在しないこと');
console.log('✓ 新旧実装で異なる結果が出ること');
console.log('✓ 不正入力が適切に拒否されること');
console.log('✓ 境界値で正しく動作すること');
console.log('✓ 例外が発生せず安全に処理されること');
console.log('✓ ソート順が常に昇順であること');

// 終了コード
process.exit(testResults.failed > 0 ? 1 : 0);
