/**
 * 年間休日機能テストスイート
 * 求人ボックス対応の年間休日抽出・集計機能を検証
 *
 * テストカテゴリ:
 * - A: 年間休日抽出関数 (extractAnnualHolidays)
 * - B: カテゴリ分類 (getAnnualHolidaysCategory)
 * - C: データソース判定 (detectDataSource)
 * - D: 年間休日集計 (createAnnualHolidaysAggregation)
 * - E: 統合テスト・エッジケース
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

function assertNull(value, testId, message) {
  assert(value === null, testId, message);
}

function assertInRange(value, min, max, testId, message) {
  assert(value >= min && value <= max, testId, message + ' (' + value + ' in [' + min + ', ' + max + '])');
}

// ============================================================
// Constants.js から移植した定数・関数
// ============================================================

const DATA_SOURCE_TYPES = {
  INDEED: 'indeed',
  KYUJIN_BOX: 'kyujin_box',
  UNKNOWN: 'unknown'
};

const DATA_SOURCE_COLUMNS = {
  [DATA_SOURCE_TYPES.INDEED]: {
    identifierColumns: ['勤務地', '給与', '求人URL'],
    columns: {
      url: '求人URL',
      title: '求人タイトル',
      company: '会社名',
      location: '勤務地',
      salary: '給与',
      employmentType: '雇用形態',
      description: '仕事内容'
    },
    annualHolidaysSource: null
  },
  [DATA_SOURCE_TYPES.KYUJIN_BOX]: {
    identifierColumns: ['p-result_name', 'p-result_company', 'c-icon'],
    columns: {
      url: 'p-result_title_link href',
      title: 'p-result_name',
      company: 'p-result_company',
      location: 'c-icon',
      salary: 'c-icon (2)',
      employmentType: 'c-icon (3)',
      description: 'p-result_lines'
    },
    annualHolidaysSource: 'description'
  }
};

const ANNUAL_HOLIDAYS_PATTERNS = [
  /年間休日[:\s:：・]*(\d{2,3})\s*日/,
  /<年間休日>(\d{2,3})日?/,
  /年間休日>(\d{2,3})日?/,
  /年間休日数[:\s:：・]*(\d{2,3})\s*日?/,
  /年間休日[はが](\d{2,3})日?/,
  /年間休日(\d{2,3})日?[!！。、]/,
  /年間休日[:\s:：・]*(\d{2,3})(?!\d)/,
  /(\d{2,3})\s*日[（(]?\s*年間休日\s*[）)]?/,
  /(\d{2,3})\s*日[（(]?\s*年間\s*[）)]?/,
  /年休(\d{2,3})日[～〜]?/,
  /年休[:\s:：・]*(\d{2,3})\s*日/,
  /(?<!年間)休日[:\s:：・]*(\d{2,3})\s*日/,
  /休日数[:\s:：・]*(\d{2,3})\s*日?/,
  /年[間]?休[日暇][:\s:：・]*(\d{2,3})\s*日?/,
  /(\d{2,3})\s*日\s*[\/\／]\s*年/,
  /年間休日\](\d{2,3})日?/,
  /休日.*?(\d{2,3})\s*日/
];

const ANNUAL_HOLIDAYS_RANGES = [
  { min: 0, max: 89, label: '～89日', code: 'H0' },
  { min: 90, max: 104, label: '90～104日', code: 'H1' },
  { min: 105, max: 114, label: '105～114日', code: 'H2' },
  { min: 115, max: 119, label: '115～119日', code: 'H3' },
  { min: 120, max: 124, label: '120～124日', code: 'H4' },
  { min: 125, max: 129, label: '125～129日', code: 'H5' },
  { min: 130, max: 999, label: '130日～', code: 'H6' }
];

/**
 * データソースを自動判定
 */
function detectDataSource(headers) {
  if (!headers || !Array.isArray(headers)) {
    return DATA_SOURCE_TYPES.UNKNOWN;
  }

  const headerSet = new Set(headers.map(h => h.trim()));

  for (const [sourceType, config] of Object.entries(DATA_SOURCE_COLUMNS)) {
    const identifiers = config.identifierColumns;
    const matchCount = identifiers.filter(col => headerSet.has(col)).length;

    if (matchCount >= Math.ceil(identifiers.length / 2)) {
      return sourceType;
    }
  }

  return DATA_SOURCE_TYPES.UNKNOWN;
}

/**
 * 年間休日をテキストから抽出
 */
function extractAnnualHolidays(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  for (const pattern of ANNUAL_HOLIDAYS_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      // 見切れデータ対策: 2桁は70以上のみ許可
      const isValid = (days >= 70 && days <= 99) || (days >= 100 && days <= 180);
      if (isValid) {
        return days;
      }
    }
  }

  return null;
}

/**
 * 年間休日のカテゴリを取得
 */
function getAnnualHolidaysCategory(days) {
  if (days === null || days === undefined) {
    return null;
  }

  for (const range of ANNUAL_HOLIDAYS_RANGES) {
    if (days >= range.min && days <= range.max) {
      return range;
    }
  }

  return null;
}

/**
 * 年間休日集計関数（簡易版）
 */
function createAnnualHolidaysAggregation(parsedData) {
  const validData = parsedData.filter(d => {
    const holidays = parseInt(d.annualHolidays);
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

  const holidayValues = validData.map(d => parseInt(d.annualHolidays));
  const sorted = [...holidayValues].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const count = sorted.length;

  const stats = {
    mean: Math.round(sum / count * 10) / 10,
    median: sorted[Math.floor(count / 2)],
    min: sorted[0],
    max: sorted[count - 1],
    stdDev: Math.round(Math.sqrt(sorted.reduce((acc, v) => acc + Math.pow(v - sum / count, 2), 0) / count) * 10) / 10
  };

  const distribution = {};
  holidayValues.forEach(v => {
    const bin = Math.floor(v / 5) * 5;
    const label = bin + '日';
    distribution[label] = (distribution[label] || 0) + 1;
  });

  const categoryDistribution = {};
  ANNUAL_HOLIDAYS_RANGES.forEach(range => {
    categoryDistribution[range.label] = 0;
  });

  holidayValues.forEach(v => {
    const category = getAnnualHolidaysCategory(v);
    if (category) {
      categoryDistribution[category.label] = (categoryDistribution[category.label] || 0) + 1;
    }
  });

  return {
    hasData: true,
    validCount: count,
    totalCount: parsedData.length,
    stats: stats,
    distribution: distribution,
    categoryDistribution: categoryDistribution,
    salaryCorrelation: null  // 簡易版では省略
  };
}

// ============================================================
// Category A: 年間休日抽出テスト
// ============================================================
console.log('\n=== Category A: 年間休日抽出テスト ===');

// A01: 標準パターン「年間休日120日」
assertEqual(extractAnnualHolidays('年間休日120日'), 120, 'A01', '標準パターン年間休日120日');

// A02: コロン付き「年間休日:125日」
assertEqual(extractAnnualHolidays('年間休日:125日'), 125, 'A02', 'コロン付き年間休日:125日');

// A03: 全角コロン「年間休日：118日」
assertEqual(extractAnnualHolidays('年間休日：118日'), 118, 'A03', '全角コロン年間休日：118日');

// A04: スペース区切り「年間休日 105日」
assertEqual(extractAnnualHolidays('年間休日 105日'), 105, 'A04', 'スペース区切り年間休日 105日');

// A05: 数字のみ「年間休日110」
assertEqual(extractAnnualHolidays('年間休日110'), 110, 'A05', '数字のみ年間休日110');

// A06: 括弧パターン「125日（年間休日）」
assertEqual(extractAnnualHolidays('125日（年間休日）'), 125, 'A06', '括弧パターン125日（年間休日）');

// A07: 年間パターン「120日（年間）」
assertEqual(extractAnnualHolidays('120日（年間）'), 120, 'A07', '年間パターン120日（年間）');

// A08: 休日パターン「休日:115日」
assertEqual(extractAnnualHolidays('休日:115日'), 115, 'A08', '休日パターン休日:115日');

// A09: /年パターン「125日/年」
assertEqual(extractAnnualHolidays('125日/年'), 125, 'A09', '/年パターン125日/年');

// A10: 文中からの抽出
assertEqual(extractAnnualHolidays('完全週休2日制、年間休日120日、賞与年2回'), 120, 'A10', '文中からの抽出');

// A11: 複数の数字がある場合（年間休日が優先）
assertEqual(extractAnnualHolidays('週40時間、年間休日125日、月給25万'), 125, 'A11', '複数数字からの正しい抽出');

// A12: 下限境界値（70日 - 見切れデータ対策で2桁は70以上のみ）
assertEqual(extractAnnualHolidays('年間休日70日'), 70, 'A12', '下限境界値70日');

// A13: 上限境界値（180日）
assertEqual(extractAnnualHolidays('年間休日180日'), 180, 'A13', '上限境界値180日');

// A14: 範囲外（69日 - 2桁で70未満は見切れ対策で除外）
assertNull(extractAnnualHolidays('年間休日69日'), 'A14', '範囲外69日はnull');

// A15: 範囲外（181日 - 上限超過）
assertNull(extractAnnualHolidays('年間休日181日'), 'A15', '範囲外181日はnull');

// A16: 空文字列
assertNull(extractAnnualHolidays(''), 'A16', '空文字列はnull');

// A17: null入力
assertNull(extractAnnualHolidays(null), 'A17', 'null入力はnull');

// A18: 年間休日キーワードなし
assertNull(extractAnnualHolidays('勤務時間9時から18時'), 'A18', 'キーワードなしはnull');

// A19: 年間休日数パターン
assertEqual(extractAnnualHolidays('年間休日数125日'), 125, 'A19', '年間休日数パターン');

// A20: 中点区切り「年間休日・120日」
assertEqual(extractAnnualHolidays('年間休日・120日'), 120, 'A20', '中点区切り年間休日・120日');

// ============================================================
// Category B: カテゴリ分類テスト
// ============================================================
console.log('\n=== Category B: カテゴリ分類テスト ===');

// B01: 89日以下カテゴリ
const cat89 = getAnnualHolidaysCategory(85);
assertEqual(cat89?.label, '～89日', 'B01', '85日は～89日カテゴリ');

// B02: 90-104日カテゴリ
const cat95 = getAnnualHolidaysCategory(95);
assertEqual(cat95?.label, '90～104日', 'B02', '95日は90～104日カテゴリ');

// B03: 105-114日カテゴリ
const cat110 = getAnnualHolidaysCategory(110);
assertEqual(cat110?.label, '105～114日', 'B03', '110日は105～114日カテゴリ');

// B04: 115-119日カテゴリ
const cat117 = getAnnualHolidaysCategory(117);
assertEqual(cat117?.label, '115～119日', 'B04', '117日は115～119日カテゴリ');

// B05: 120-124日カテゴリ（一般的）
const cat120 = getAnnualHolidaysCategory(120);
assertEqual(cat120?.label, '120～124日', 'B05', '120日は120～124日カテゴリ');

// B06: 125-129日カテゴリ
const cat127 = getAnnualHolidaysCategory(127);
assertEqual(cat127?.label, '125～129日', 'B06', '127日は125～129日カテゴリ');

// B07: 130日以上カテゴリ
const cat135 = getAnnualHolidaysCategory(135);
assertEqual(cat135?.label, '130日～', 'B07', '135日は130日～カテゴリ');

// B08: 境界値テスト（90日）
const cat90 = getAnnualHolidaysCategory(90);
assertEqual(cat90?.label, '90～104日', 'B08', '境界値90日は90～104日');

// B09: 境界値テスト（104日）
const cat104 = getAnnualHolidaysCategory(104);
assertEqual(cat104?.label, '90～104日', 'B09', '境界値104日は90～104日');

// B10: null入力
assertNull(getAnnualHolidaysCategory(null), 'B10', 'null入力はnull');

// B11: undefined入力
assertNull(getAnnualHolidaysCategory(undefined), 'B11', 'undefined入力はnull');

// ============================================================
// Category C: データソース判定テスト
// ============================================================
console.log('\n=== Category C: データソース判定テスト ===');

// C01: Indeedヘッダー（完全一致）
const indeedHeaders = ['求人URL', '求人タイトル', '会社名', '勤務地', '給与', '雇用形態'];
assertEqual(detectDataSource(indeedHeaders), DATA_SOURCE_TYPES.INDEED, 'C01', 'Indeedヘッダー判定');

// C02: 求人ボックスヘッダー（完全一致）
const kyujinBoxHeaders = ['p-result_title_link href', 'p-result_name', 'p-result_company', 'c-icon'];
assertEqual(detectDataSource(kyujinBoxHeaders), DATA_SOURCE_TYPES.KYUJIN_BOX, 'C02', '求人ボックスヘッダー判定');

// C03: 部分一致（Indeedの識別カラム2つ以上）
const partialIndeed = ['勤務地', '給与', '他のカラム1', '他のカラム2'];
assertEqual(detectDataSource(partialIndeed), DATA_SOURCE_TYPES.INDEED, 'C03', 'Indeed部分一致判定');

// C04: 部分一致（求人ボックスの識別カラム2つ以上）
const partialKyujinBox = ['p-result_name', 'p-result_company', '他のカラム'];
assertEqual(detectDataSource(partialKyujinBox), DATA_SOURCE_TYPES.KYUJIN_BOX, 'C04', '求人ボックス部分一致判定');

// C05: 不明なヘッダー
const unknownHeaders = ['カラムA', 'カラムB', 'カラムC'];
assertEqual(detectDataSource(unknownHeaders), DATA_SOURCE_TYPES.UNKNOWN, 'C05', '不明ヘッダーはUNKNOWN');

// C06: 空配列
assertEqual(detectDataSource([]), DATA_SOURCE_TYPES.UNKNOWN, 'C06', '空配列はUNKNOWN');

// C07: null入力
assertEqual(detectDataSource(null), DATA_SOURCE_TYPES.UNKNOWN, 'C07', 'null入力はUNKNOWN');

// C08: スペーストリム処理
const headerWithSpaces = [' 勤務地 ', '給与 ', ' 求人URL'];
assertEqual(detectDataSource(headerWithSpaces), DATA_SOURCE_TYPES.INDEED, 'C08', 'スペース付きヘッダーでも判定可能');

// ============================================================
// Category D: 年間休日集計テスト
// ============================================================
console.log('\n=== Category D: 年間休日集計テスト ===');

// テストデータ
const testParsedData = [
  { annualHolidays: '120', salaryParsed: { unifiedMonthly: 250000 } },
  { annualHolidays: '125', salaryParsed: { unifiedMonthly: 280000 } },
  { annualHolidays: '115', salaryParsed: { unifiedMonthly: 230000 } },
  { annualHolidays: '130', salaryParsed: { unifiedMonthly: 350000 } },
  { annualHolidays: '105', salaryParsed: { unifiedMonthly: 220000 } },
  { annualHolidays: '', salaryParsed: { unifiedMonthly: 200000 } },  // 無効データ
  { annualHolidays: '90', salaryParsed: { unifiedMonthly: 190000 } },
  { annualHolidays: '110', salaryParsed: { unifiedMonthly: 240000 } },
  { annualHolidays: 'abc', salaryParsed: { unifiedMonthly: 200000 } },  // 無効データ
  { annualHolidays: '122', salaryParsed: { unifiedMonthly: 260000 } }
];

const aggregation = createAnnualHolidaysAggregation(testParsedData);

// D01: hasDataがtrue
assert(aggregation.hasData === true, 'D01', 'データありでhasData=true');

// D02: validCountが正しい
assertEqual(aggregation.validCount, 8, 'D02', '有効データ数は8');

// D03: totalCountが正しい
assertEqual(aggregation.totalCount, 10, 'D03', '全データ数は10');

// D04: 平均値が正しい範囲
assertInRange(aggregation.stats.mean, 110, 120, 'D04', '平均値が適切な範囲');

// D05: 中央値が存在
assertNotNull(aggregation.stats.median, 'D05', '中央値が存在');

// D06: 最小値
assertEqual(aggregation.stats.min, 90, 'D06', '最小値は90');

// D07: 最大値
assertEqual(aggregation.stats.max, 130, 'D07', '最大値は130');

// D08: カテゴリ分布が存在
assert(Object.keys(aggregation.categoryDistribution).length > 0, 'D08', 'カテゴリ分布が存在');

// D09: 空データの場合
const emptyAggregation = createAnnualHolidaysAggregation([]);
assert(emptyAggregation.hasData === false, 'D09', '空データでhasData=false');

// D10: 無効データのみの場合
const invalidOnlyData = [
  { annualHolidays: '', salaryParsed: {} },
  { annualHolidays: 'invalid', salaryParsed: {} }
];
const invalidAggregation = createAnnualHolidaysAggregation(invalidOnlyData);
assert(invalidAggregation.hasData === false, 'D10', '無効データのみでhasData=false');

// D11: 範囲外データ（40日 - 50未満）
const outOfRangeData = [
  { annualHolidays: '40', salaryParsed: {} },
  { annualHolidays: '250', salaryParsed: {} }
];
const outOfRangeAggregation = createAnnualHolidaysAggregation(outOfRangeData);
assert(outOfRangeAggregation.hasData === false, 'D11', '範囲外データでhasData=false');

// ============================================================
// Category E: 統合テスト・エッジケース
// ============================================================
console.log('\n=== Category E: 統合テスト・エッジケース ===');

// E01: 求人ボックス風のテキストから年間休日を抽出
const kyujinBoxDescription = '【仕事内容】システム開発・運用保守　【給与】月給25万円～35万円　【休日・休暇】完全週休2日制（土日）、祝日、年末年始、年間休日125日、有給休暇、慶弔休暇';
assertEqual(extractAnnualHolidays(kyujinBoxDescription), 125, 'E01', '求人ボックス風テキストからの抽出');

// E02: Indeed風のテキスト（年間休日なし）
const indeedDescription = '未経験歓迎！正社員採用。週休2日制、各種社会保険完備';
assertNull(extractAnnualHolidays(indeedDescription), 'E02', 'Indeed風テキスト（キーワードなし）');

// E03: 複合パターン（最初にマッチしたものを返す）
const multiplePatterns = '年間休日120日、休日：130日/年';
assertEqual(extractAnnualHolidays(multiplePatterns), 120, 'E03', '複合パターンで最初のマッチ');

// E04: 「年末年始」を誤検出しないか
const yearEndText = '年末年始休暇あり、休日は週2日';
assertNull(extractAnnualHolidays(yearEndText), 'E04', '年末年始を誤検出しない');

// E05: 数字が近接している場合の正しい抽出
const closeNumbers = '勤務時間8時間、年間休日125日';
assertEqual(extractAnnualHolidays(closeNumbers), 125, 'E05', '近接数字からの正しい抽出');

// E06: 全角数字は対象外（現状の仕様）
const zenkakuNumbers = '年間休日１２０日';
// 全角は現状パターンでマッチしないためnull
assertNull(extractAnnualHolidays(zenkakuNumbers), 'E06', '全角数字は対象外');

// E07: 長い文章からの抽出
const longText = `
  当社は創業30年の老舗企業です。
  福利厚生も充実しており、年間休日は120日以上を確保。
  社員の働きやすさを重視しています。
  詳細については面接時にご説明いたします。
`;
assertEqual(extractAnnualHolidays(longText), 120, 'E07', '長文からの抽出');

// E08: 休日数パターン
const holidayCountText = '休日数105日、社会保険完備';
assertEqual(extractAnnualHolidays(holidayCountText), 105, 'E08', '休日数パターンからの抽出');

// E09: 年休パターン
const nenkyuText = '年休118日、交通費支給';
assertEqual(extractAnnualHolidays(nenkyuText), 118, 'E09', '年休パターンからの抽出');

// E10: カテゴリコードの確認
const cat125 = getAnnualHolidaysCategory(125);
assertEqual(cat125?.code, 'H5', 'E10', '125日のカテゴリコードはH5');

// ============================================================
// テスト結果サマリー
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('年間休日機能テスト結果サマリー');
console.log('='.repeat(60));
console.log('合格: ' + testResults.passed + '件');
console.log('不合格: ' + testResults.failed + '件');
console.log('合格率: ' + Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100) + '%');

if (testResults.errors.length > 0) {
  console.log('\n【失敗したテスト】');
  testResults.errors.forEach(e => console.log('  - ' + e));
}

console.log('\n✅ 年間休日機能テスト完了');
