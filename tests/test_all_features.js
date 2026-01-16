/**
 * 網羅的機能テストスイート
 * GASダッシュボード全機能の検証（ローカル実行用）
 *
 * テストカテゴリ:
 * - A: SalaryParser（給与解析）
 * - B: LocationParser（勤務地解析）
 * - C: 雇用形態解析
 * - D: タグ解析
 * - E: 統計計算
 * - F: 定数・マスタデータ
 * - G: データ変換・月給換算
 * - H: エッジケース
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
// Constants.js から移植
// ============================================================

const SALARY_TYPES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  MONTHLY: 'monthly',
  ANNUAL: 'annual'
};

const SALARY_CONVERSION_PARAMS = {
  hoursPerDay: 8,
  daysPerWeek: 5,
  weeksPerMonth: 4,
  daysPerMonth: 20,
  monthsPerYear: 12,
  partTimeHoursPerDay: 5,
  partTimeDaysPerWeek: 3,
};

const SALARY_CONVERSION_RATES = {
  hourly_to_monthly: 160,  // 8時間×20日
  daily_to_monthly: 20,
  monthly_to_annual: 12,
  annual_to_monthly: 1 / 12,
};

const TOKYO_23_WARDS = [
  '千代田区', '中央区', '港区', '新宿区', '文京区',
  '台東区', '墨田区', '江東区', '品川区', '目黒区',
  '大田区', '世田谷区', '渋谷区', '中野区', '杉並区',
  '豊島区', '北区', '荒川区', '板橋区', '練馬区',
  '足立区', '葛飾区', '江戸川区'
];

const PREFECTURE_REGIONS = {
  '北海道': '北海道・東北', '青森県': '北海道・東北', '岩手県': '北海道・東北',
  '宮城県': '北海道・東北', '秋田県': '北海道・東北', '山形県': '北海道・東北', '福島県': '北海道・東北',
  '茨城県': '関東', '栃木県': '関東', '群馬県': '関東', '埼玉県': '関東',
  '千葉県': '関東', '東京都': '関東', '神奈川県': '関東',
  '新潟県': '中部', '富山県': '中部', '石川県': '中部', '福井県': '中部',
  '山梨県': '中部', '長野県': '中部', '岐阜県': '中部', '静岡県': '中部', '愛知県': '中部',
  '三重県': '近畿', '滋賀県': '近畿', '京都府': '近畿', '大阪府': '近畿',
  '兵庫県': '近畿', '奈良県': '近畿', '和歌山県': '近畿',
  '鳥取県': '中国', '島根県': '中国', '岡山県': '中国', '広島県': '中国', '山口県': '中国',
  '徳島県': '四国', '香川県': '四国', '愛媛県': '四国', '高知県': '四国',
  '福岡県': '九州・沖縄', '佐賀県': '九州・沖縄', '長崎県': '九州・沖縄', '熊本県': '九州・沖縄',
  '大分県': '九州・沖縄', '宮崎県': '九州・沖縄', '鹿児島県': '九州・沖縄', '沖縄県': '九州・沖縄'
};

const EMPLOYMENT_TYPE_MAP = {
  '正社員': { category: '正規雇用', subcategory: '正社員', code: 'FT' },
  '正職員': { category: '正規雇用', subcategory: '正社員', code: 'FT' },
  '契約社員': { category: '非正規雇用', subcategory: '契約社員', code: 'CT' },
  '派遣社員': { category: '非正規雇用', subcategory: '派遣社員', code: 'DP' },
  '派遣': { category: '非正規雇用', subcategory: '派遣社員', code: 'DP' },
  'パート': { category: '非正規雇用', subcategory: 'パート・アルバイト', code: 'PT' },
  'アルバイト': { category: '非正規雇用', subcategory: 'パート・アルバイト', code: 'PT' },
  '業務委託': { category: 'その他', subcategory: '業務委託', code: 'FC' },
  'フリーランス': { category: 'その他', subcategory: '業務委託', code: 'FC' }
};

const EMPLOYMENT_TYPE_KEYWORDS = [
  '正社員', '正職員', '契約社員', '派遣社員', '派遣',
  'パート', 'アルバイト', '業務委託', 'フリーランス'
];

const TAG_CATEGORIES = {
  '待遇': ['交通費支給', '賞与あり', '昇給あり', '社会保険完備', '退職金あり', '住宅手当'],
  '勤務形態': ['週休2日', '土日祝休み', 'シフト制', '残業なし', 'フレックス', 'リモートワーク可'],
  'スキル': ['未経験OK', '経験者優遇', '資格不問', '学歴不問'],
  '職場環境': ['駅近', '転勤なし', '服装自由', '車通勤OK']
};

// ============================================================
// SalaryParser.js から移植
// ============================================================

function normalizeText(text) {
  return text
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/[～〜ー―－]/g, '~')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSalaryType(text) {
  if (/時給/.test(text)) return SALARY_TYPES.HOURLY;
  if (/日給/.test(text)) return SALARY_TYPES.DAILY;
  if (/週給/.test(text)) return 'weekly';
  if (/月給|月収|基本給|固定給/.test(text)) return SALARY_TYPES.MONTHLY;
  if (/年俸|年収/.test(text)) return SALARY_TYPES.ANNUAL;
  return SALARY_TYPES.MONTHLY;
}

function parseJapaneseAmount(numStr, isMan) {
  const value = parseFloat(numStr);
  return isMan ? value * 10000 : value;
}

function extractSingleValue(text) {
  const manPattern = /(\d+(?:\.\d+)?)\s*万\s*円?/;
  const manMatch = text.match(manPattern);
  if (manMatch) {
    return parseFloat(manMatch[1]) * 10000;
  }
  const yenPattern = /(\d+(?:\.\d+)?)\s*円/;
  const yenMatch = text.match(yenPattern);
  if (yenMatch) {
    return parseFloat(yenMatch[1]);
  }
  return null;
}

function extractSalaryValues(text) {
  let minValue = null;
  let maxValue = null;
  let hasRange = false;

  const cleanText = text.replace(/,/g, '');
  const rangeMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(万)?\s*円?\s*~\s*(\d+(?:\.\d+)?)\s*(万)?\s*円?/);

  if (rangeMatch) {
    hasRange = true;
    minValue = parseJapaneseAmount(rangeMatch[1], rangeMatch[2] === '万');
    maxValue = parseJapaneseAmount(rangeMatch[3], rangeMatch[4] === '万');
  } else {
    const minOnlyMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(万)?\s*円?\s*(?:以上|から|~)/);
    const maxOnlyMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(万)?\s*円?\s*(?:以下|未満|まで)/);

    if (minOnlyMatch && !maxOnlyMatch) {
      hasRange = true;
      minValue = parseJapaneseAmount(minOnlyMatch[1], minOnlyMatch[2] === '万');
      maxValue = null;
    } else if (maxOnlyMatch && !minOnlyMatch) {
      hasRange = true;
      minValue = null;
      maxValue = parseJapaneseAmount(maxOnlyMatch[1], maxOnlyMatch[2] === '万');
    } else {
      const singleValue = extractSingleValue(cleanText);
      minValue = singleValue;
      maxValue = singleValue;
    }
  }

  return { minValue, maxValue, hasRange };
}

function calculateUnifiedSalary(minValue, maxValue, salaryType) {
  if (minValue === null && maxValue === null) {
    return { monthly: null, annual: null };
  }

  const baseValue = minValue !== null ? minValue : maxValue;
  let monthly = null;
  let annual = null;

  switch (salaryType) {
    case SALARY_TYPES.HOURLY:
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.hourly_to_monthly);
      break;
    case SALARY_TYPES.DAILY:
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.daily_to_monthly);
      break;
    case SALARY_TYPES.MONTHLY:
      monthly = Math.round(baseValue);
      break;
    case SALARY_TYPES.ANNUAL:
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.annual_to_monthly);
      break;
    default:
      monthly = Math.round(baseValue);
  }

  annual = monthly ? monthly * SALARY_CONVERSION_RATES.monthly_to_annual : null;

  return { monthly, annual };
}

function parseSalary(salaryText) {
  if (!salaryText || salaryText === '') {
    return {
      originalText: '',
      salaryType: null,
      minValue: null,
      maxValue: null,
      hasRange: false,
      unifiedMonthly: null,
      unifiedAnnual: null
    };
  }

  const text = normalizeText(salaryText);
  const salaryType = detectSalaryType(text);
  const { minValue, maxValue, hasRange } = extractSalaryValues(text);
  const unified = calculateUnifiedSalary(minValue, maxValue, salaryType);

  return {
    originalText: salaryText,
    salaryType: salaryType,
    minValue: minValue,
    maxValue: maxValue,
    hasRange: hasRange,
    unifiedMonthly: unified.monthly,
    unifiedAnnual: unified.annual
  };
}

// ============================================================
// LocationParser.js から移植（簡易版）
// ============================================================

const STATION_TO_CITY = {
  '東京駅': { city: '千代田区', prefecture: '東京都' },
  '新宿駅': { city: '新宿区', prefecture: '東京都' },
  '渋谷駅': { city: '渋谷区', prefecture: '東京都' },
  '横浜駅': { city: '横浜市西区', prefecture: '神奈川県' },
  '大阪駅': { city: '大阪市北区', prefecture: '大阪府' },
  '名古屋駅': { city: '名古屋市中村区', prefecture: '愛知県' },
  '札幌駅': { city: '札幌市中央区', prefecture: '北海道' },
  '仙台駅': { city: '仙台市青葉区', prefecture: '宮城県' },
  '福岡駅': { city: '福岡市博多区', prefecture: '福岡県' },
  '広島駅': { city: '広島市南区', prefecture: '広島県' }
};

// 検索順序が重要：長いパターンを先に（フルリモート→リモートの順）
const AMBIGUOUS_LOCATION_MAP = {
  '都内': { prefecture: '東京都', regionBlock: '関東', cityType: '東京都内' },
  '23区内': { prefecture: '東京都', regionBlock: '関東', cityType: '東京23区' },
  '首都圏': { prefecture: null, regionBlock: '関東', cityType: '首都圏' },
  '関西圏': { prefecture: null, regionBlock: '近畿', cityType: '関西圏' },
  'フルリモート': { prefecture: null, regionBlock: 'リモート', cityType: 'フルリモート' },
  '完全リモート': { prefecture: null, regionBlock: 'リモート', cityType: 'フルリモート' },
  '在宅': { prefecture: null, regionBlock: 'リモート', cityType: 'リモート' },
  'リモート': { prefecture: null, regionBlock: 'リモート', cityType: 'リモート' },
  '全国': { prefecture: null, regionBlock: '全国', cityType: '全国' }
};

const DESIGNATED_CITY_WARDS = {
  '大阪市': ['北区', '中央区', '天王寺区', '淀川区'],
  '名古屋市': ['中区', '中村区', '千種区'],
  '横浜市': ['西区', '中区', '港北区'],
  '札幌市': ['中央区', '北区', '東区'],
  '福岡市': ['博多区', '中央区', '東区']
};

function parseLocation(locationText, contextPrefecture = null) {
  if (!locationText || locationText === '') {
    return {
      originalText: '',
      prefecture: null,
      city: null,
      regionBlock: null,
      cityType: null
    };
  }

  const text = locationText.trim();

  // 曖昧な表現のチェック
  for (const [pattern, result] of Object.entries(AMBIGUOUS_LOCATION_MAP)) {
    if (text.includes(pattern)) {
      return {
        originalText: locationText,
        prefecture: result.prefecture,
        city: null,
        regionBlock: result.regionBlock,
        cityType: result.cityType
      };
    }
  }

  // 駅名からの解析
  for (const [station, info] of Object.entries(STATION_TO_CITY)) {
    if (text.includes(station)) {
      return {
        originalText: locationText,
        prefecture: info.prefecture,
        city: info.city,
        regionBlock: PREFECTURE_REGIONS[info.prefecture] || null,
        cityType: '駅周辺'
      };
    }
  }

  // 都道府県の検出
  for (const pref of Object.keys(PREFECTURE_REGIONS)) {
    if (text.includes(pref)) {
      return {
        originalText: locationText,
        prefecture: pref,
        city: null,
        regionBlock: PREFECTURE_REGIONS[pref],
        cityType: pref
      };
    }
  }

  // 東京23区の検出
  for (const ward of TOKYO_23_WARDS) {
    if (text.includes(ward)) {
      return {
        originalText: locationText,
        prefecture: '東京都',
        city: ward,
        regionBlock: '関東',
        cityType: '東京23区'
      };
    }
  }

  return {
    originalText: locationText,
    prefecture: contextPrefecture,
    city: null,
    regionBlock: contextPrefecture ? PREFECTURE_REGIONS[contextPrefecture] : null,
    cityType: null
  };
}

// ============================================================
// Aggregator.js から移植（雇用形態・タグ解析）
// ============================================================

function parseEmploymentType(employmentText) {
  if (!employmentText) return { category: '不明', subcategory: '不明', code: 'UN' };
  for (const keyword of EMPLOYMENT_TYPE_KEYWORDS) {
    if (employmentText.includes(keyword)) return EMPLOYMENT_TYPE_MAP[keyword];
  }
  return { category: '不明', subcategory: '不明', code: 'UN' };
}

function parseTags(tagsText) {
  if (!tagsText) return { tags: [], categories: {} };
  const tagList = tagsText.split(/[,、]/).map(t => t.trim()).filter(t => t && !t.endsWith('+'));
  const categories = {};
  Object.keys(TAG_CATEGORIES).forEach(cat => { categories[cat] = []; });
  categories['その他'] = [];
  tagList.forEach(tag => {
    let found = false;
    for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
      if (tags.includes(tag)) { categories[category].push(tag); found = true; break; }
    }
    if (!found) categories['その他'].push(tag);
  });
  return { tags: tagList, categories };
}

// ============================================================
// Statistics.js から移植
// ============================================================

function getBootstrapConfidenceInterval(data, iterations = 1000) {
  const validData = data.filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
  const n = validData.length;
  if (n === 0) return null;
  if (n === 1) {
    return {
      lower: validData[0],
      upper: validData[0],
      sampleMean: validData[0],
      sampleSize: 1
    };
  }

  const means = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const randomIndex = Math.floor(Math.random() * n);
      sum += validData[randomIndex];
    }
    means.push(sum / n);
  }

  means.sort((a, b) => a - b);
  const lowerIndex = Math.floor(iterations * 0.025);
  const upperIndex = Math.floor(iterations * 0.975);
  const sampleMean = validData.reduce((a, b) => a + b, 0) / n;

  return {
    lower: Math.round(means[lowerIndex]),
    upper: Math.round(means[upperIndex]),
    sampleMean: Math.round(sampleMean),
    sampleSize: n
  };
}

function getTrimmedMean(data, trimPercent = 0.1) {
  const validData = data.filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
  if (validData.length === 0) return null;

  const sorted = [...validData].sort((a, b) => a - b);
  const n = sorted.length;
  const trimCount = Math.floor(n * trimPercent);
  const trimmedData = sorted.slice(trimCount, n - trimCount);

  if (trimmedData.length === 0) return null;

  const trimmedMean = trimmedData.reduce((a, b) => a + b, 0) / trimmedData.length;
  const originalMean = validData.reduce((a, b) => a + b, 0) / n;

  return {
    trimmedMean: Math.round(trimmedMean),
    originalMean: Math.round(originalMean),
    trimmedCount: trimmedData.length,
    removedCount: trimCount * 2
  };
}

function calculatePercentiles(data, percentiles = [10, 25, 50, 75, 90]) {
  const validData = data.filter(v => v !== null && !isNaN(v) && isFinite(v));
  if (validData.length === 0) return null;

  const sorted = [...validData].sort((a, b) => a - b);
  const result = {};

  for (const p of percentiles) {
    const index = Math.floor((p / 100) * (sorted.length - 1));
    result['p' + p] = sorted[index];
  }

  return result;
}

// ============================================================
// カテゴリA: SalaryParser（給与解析）テスト
// ============================================================

function testCategoryA_SalaryParser() {
  console.log('\n=== カテゴリA: SalaryParser（給与解析）テスト ===');

  // A01-A05: テキスト正規化
  assertEqual(normalizeText('２５万円'), '25万円', 'A01', '全角数字→半角');
  assertEqual(normalizeText('25～30万円'), '25~30万円', 'A02', '全角チルダ→半角');
  assertEqual(normalizeText('  月給 25万円  '), '月給 25万円', 'A03', 'スペース正規化');

  // A04-A08: 給与タイプ判定
  assertEqual(detectSalaryType('時給1200円'), 'hourly', 'A04', '時給タイプ判定');
  assertEqual(detectSalaryType('日給10000円'), 'daily', 'A05', '日給タイプ判定');
  assertEqual(detectSalaryType('月給25万円'), 'monthly', 'A06', '月給タイプ判定');
  assertEqual(detectSalaryType('年収400万円'), 'annual', 'A07', '年収タイプ判定');
  assertEqual(detectSalaryType('基本給20万円'), 'monthly', 'A08', '基本給→月給');

  // A09-A15: 給与解析（様々なパターン）
  let result = parseSalary('月給25万円');
  assertEqual(result.minValue, 250000, 'A09', '月給25万円の値');
  assertEqual(result.salaryType, 'monthly', 'A10', '月給タイプ');

  result = parseSalary('月給25万円~30万円');
  assertEqual(result.minValue, 250000, 'A11', '範囲の下限値');
  assertEqual(result.maxValue, 300000, 'A12', '範囲の上限値');
  assert(result.hasRange, 'A13', '範囲フラグ');

  result = parseSalary('時給1200円');
  assertEqual(result.minValue, 1200, 'A14', '時給1200円の値');
  assertEqual(result.unifiedMonthly, 192000, 'A15', '時給→月給換算(1200×160)');

  result = parseSalary('年収400万円');
  assertEqual(result.minValue, 4000000, 'A16', '年収400万円の値');
  assertEqual(result.unifiedMonthly, Math.round(4000000 / 12), 'A17', '年収→月給換算');

  result = parseSalary('日給10000円');
  assertEqual(result.minValue, 10000, 'A18', '日給10000円の値');
  assertEqual(result.unifiedMonthly, 200000, 'A19', '日給→月給換算(10000×20)');

  // A20-A25: 特殊パターン
  result = parseSalary('25万円以上');
  assert(result.hasRange, 'A20', '以上表記の範囲フラグ');
  assertEqual(result.minValue, 250000, 'A21', '以上表記の下限値');

  result = parseSalary('');
  assertEqual(result.minValue, null, 'A22', '空文字列はnull');

  result = parseSalary('月給２５万円');
  assertEqual(result.minValue, 250000, 'A23', '全角数字対応');

  result = parseSalary('250,000円');
  assertEqual(result.minValue, 250000, 'A24', 'カンマ付き金額');

  result = parseSalary('25.5万円');
  assertEqual(result.minValue, 255000, 'A25', '小数点付き万円');
}

// ============================================================
// カテゴリB: LocationParser（勤務地解析）テスト
// ============================================================

function testCategoryB_LocationParser() {
  console.log('\n=== カテゴリB: LocationParser（勤務地解析）テスト ===');

  // B01-B05: 都道府県解析
  let result = parseLocation('東京都渋谷区');
  assertEqual(result.prefecture, '東京都', 'B01', '東京都の検出');
  assertEqual(result.regionBlock, '関東', 'B02', '関東地方ブロック');

  result = parseLocation('大阪府大阪市');
  assertEqual(result.prefecture, '大阪府', 'B03', '大阪府の検出');
  assertEqual(result.regionBlock, '近畿', 'B04', '近畿地方ブロック');

  result = parseLocation('北海道札幌市');
  assertEqual(result.prefecture, '北海道', 'B05', '北海道の検出');

  // B06-B10: 駅名解析
  result = parseLocation('東京駅徒歩5分');
  assertEqual(result.prefecture, '東京都', 'B06', '東京駅→東京都');
  assertEqual(result.city, '千代田区', 'B07', '東京駅→千代田区');

  result = parseLocation('渋谷駅周辺');
  assertEqual(result.prefecture, '東京都', 'B08', '渋谷駅→東京都');
  assertEqual(result.city, '渋谷区', 'B09', '渋谷駅→渋谷区');

  result = parseLocation('横浜駅');
  assertEqual(result.prefecture, '神奈川県', 'B10', '横浜駅→神奈川県');

  // B11-B15: 曖昧表現
  result = parseLocation('都内');
  assertEqual(result.prefecture, '東京都', 'B11', '都内→東京都');
  assertEqual(result.cityType, '東京都内', 'B12', '都内のcityType');

  result = parseLocation('23区内');
  assertEqual(result.cityType, '東京23区', 'B13', '23区内のcityType');

  result = parseLocation('リモート');
  assertEqual(result.regionBlock, 'リモート', 'B14', 'リモートの検出');

  result = parseLocation('フルリモート');
  assertEqual(result.cityType, 'フルリモート', 'B15', 'フルリモートのcityType');

  // B16-B20: 東京23区
  result = parseLocation('新宿区西新宿');
  assertEqual(result.prefecture, '東京都', 'B16', '新宿区→東京都');
  assertEqual(result.city, '新宿区', 'B17', '新宿区の検出');
  assertEqual(result.cityType, '東京23区', 'B18', '23区のcityType');

  result = parseLocation('港区六本木');
  assertEqual(result.city, '港区', 'B19', '港区の検出');

  result = parseLocation('');
  assertEqual(result.prefecture, null, 'B20', '空文字列はnull');
}

// ============================================================
// カテゴリC: 雇用形態解析テスト
// ============================================================

function testCategoryC_EmploymentType() {
  console.log('\n=== カテゴリC: 雇用形態解析テスト ===');

  // C01-C05: 正規雇用
  let result = parseEmploymentType('正社員');
  assertEqual(result.category, '正規雇用', 'C01', '正社員→正規雇用');
  assertEqual(result.subcategory, '正社員', 'C02', '正社員サブカテゴリ');
  assertEqual(result.code, 'FT', 'C03', '正社員コード');

  result = parseEmploymentType('正職員募集');
  assertEqual(result.category, '正規雇用', 'C04', '正職員→正規雇用');

  // C05-C08: 非正規雇用
  result = parseEmploymentType('契約社員');
  assertEqual(result.category, '非正規雇用', 'C05', '契約社員→非正規雇用');
  assertEqual(result.subcategory, '契約社員', 'C06', '契約社員サブカテゴリ');

  result = parseEmploymentType('派遣社員');
  assertEqual(result.subcategory, '派遣社員', 'C07', '派遣社員サブカテゴリ');
  assertEqual(result.code, 'DP', 'C08', '派遣社員コード');

  // C09-C12: パート・アルバイト
  result = parseEmploymentType('パート');
  assertEqual(result.subcategory, 'パート・アルバイト', 'C09', 'パート→パート・アルバイト');

  result = parseEmploymentType('アルバイト募集中');
  assertEqual(result.subcategory, 'パート・アルバイト', 'C10', 'アルバイト→パート・アルバイト');

  // C11-C14: その他
  result = parseEmploymentType('業務委託');
  assertEqual(result.category, 'その他', 'C11', '業務委託→その他');
  assertEqual(result.subcategory, '業務委託', 'C12', '業務委託サブカテゴリ');

  result = parseEmploymentType('フリーランス');
  assertEqual(result.subcategory, '業務委託', 'C13', 'フリーランス→業務委託');

  // C14-C15: 不明・空
  result = parseEmploymentType('');
  assertEqual(result.category, '不明', 'C14', '空文字列→不明');

  result = parseEmploymentType('不明な雇用形態');
  assertEqual(result.category, '不明', 'C15', '不明な雇用形態→不明');
}

// ============================================================
// カテゴリD: タグ解析テスト
// ============================================================

function testCategoryD_TagParsing() {
  console.log('\n=== カテゴリD: タグ解析テスト ===');

  // D01-D05: 基本タグ解析
  let result = parseTags('交通費支給, 賞与あり, 昇給あり');
  assertEqual(result.tags.length, 3, 'D01', 'タグ数=3');
  assert(result.tags.includes('交通費支給'), 'D02', '交通費支給タグ');
  assertEqual(result.categories['待遇'].length, 3, 'D03', '待遇カテゴリに3件');

  result = parseTags('週休2日, 土日祝休み');
  assertEqual(result.categories['勤務形態'].length, 2, 'D04', '勤務形態カテゴリに2件');

  result = parseTags('未経験OK, 経験者優遇');
  assertEqual(result.categories['スキル'].length, 2, 'D05', 'スキルカテゴリに2件');

  // D06-D10: 混合タグ
  result = parseTags('交通費支給, 週休2日, 未経験OK, 駅近');
  assertEqual(result.categories['待遇'].length, 1, 'D06', '待遇カテゴリに1件');
  assertEqual(result.categories['勤務形態'].length, 1, 'D07', '勤務形態カテゴリに1件');
  assertEqual(result.categories['スキル'].length, 1, 'D08', 'スキルカテゴリに1件');
  assertEqual(result.categories['職場環境'].length, 1, 'D09', '職場環境カテゴリに1件');

  // D10-D12: その他タグ
  result = parseTags('独自タグ, カスタムタグ');
  assertEqual(result.categories['その他'].length, 2, 'D10', 'その他カテゴリに2件');

  // D11-D12: 空・特殊
  result = parseTags('');
  assertEqual(result.tags.length, 0, 'D11', '空文字列→空配列');

  result = parseTags('13+');
  assertEqual(result.tags.length, 0, 'D12', '省略表記は除外');
}

// ============================================================
// カテゴリE: 統計計算テスト
// ============================================================

function testCategoryE_Statistics() {
  console.log('\n=== カテゴリE: 統計計算テスト ===');

  // E01-E05: ブートストラップ信頼区間
  const data1 = [250000, 260000, 270000, 280000, 290000, 300000, 310000, 320000, 330000, 340000];
  let result = getBootstrapConfidenceInterval(data1, 500);
  assertNotNull(result, 'E01', 'ブートストラップ結果存在');
  assertNotNull(result.lower, 'E02', '下限存在');
  assertNotNull(result.upper, 'E03', '上限存在');
  assert(result.lower <= result.sampleMean, 'E04', '下限≤平均');
  assert(result.upper >= result.sampleMean, 'E05', '上限≥平均');

  // E06-E08: 刈り込み平均
  const data2 = [100000, 250000, 260000, 270000, 280000, 290000, 1000000];  // 外れ値あり
  result = getTrimmedMean(data2, 0.15);
  assertNotNull(result, 'E06', '刈り込み平均結果存在');
  assert(result.trimmedMean > 200000, 'E07', '刈り込み平均>200000');
  assert(result.trimmedMean < result.originalMean, 'E08', '刈り込み平均<元平均（外れ値影響）');

  // E09-E12: パーセンタイル
  const data3 = Array.from({ length: 100 }, (_, i) => 200000 + i * 2000);  // 200000~398000
  result = calculatePercentiles(data3);
  assertNotNull(result, 'E09', 'パーセンタイル結果存在');
  assertNotNull(result.p50, 'E10', '50パーセンタイル存在');
  assert(result.p10 < result.p50, 'E11', 'p10<p50');
  assert(result.p50 < result.p90, 'E12', 'p50<p90');

  // E13-E15: 空・単一値
  result = getBootstrapConfidenceInterval([]);
  assertEqual(result, null, 'E13', '空配列→null');

  result = getBootstrapConfidenceInterval([250000]);
  assertEqual(result.sampleSize, 1, 'E14', '単一値のサンプルサイズ');
  assertEqual(result.lower, 250000, 'E15', '単一値の下限=値');
}

// ============================================================
// カテゴリF: 定数・マスタデータテスト
// ============================================================

function testCategoryF_Constants() {
  console.log('\n=== カテゴリF: 定数・マスタデータテスト ===');

  // F01-F05: 東京23区
  assertEqual(TOKYO_23_WARDS.length, 23, 'F01', '東京23区=23件');
  assert(TOKYO_23_WARDS.includes('千代田区'), 'F02', '千代田区含む');
  assert(TOKYO_23_WARDS.includes('渋谷区'), 'F03', '渋谷区含む');
  assert(TOKYO_23_WARDS.includes('港区'), 'F04', '港区含む');
  assert(!TOKYO_23_WARDS.includes('八王子市'), 'F05', '八王子市は含まない');

  // F06-F10: 都道府県
  assertEqual(Object.keys(PREFECTURE_REGIONS).length, 47, 'F06', '47都道府県');
  assertEqual(PREFECTURE_REGIONS['東京都'], '関東', 'F07', '東京都→関東');
  assertEqual(PREFECTURE_REGIONS['大阪府'], '近畿', 'F08', '大阪府→近畿');
  assertEqual(PREFECTURE_REGIONS['北海道'], '北海道・東北', 'F09', '北海道→北海道・東北');
  assertEqual(PREFECTURE_REGIONS['沖縄県'], '九州・沖縄', 'F10', '沖縄県→九州・沖縄');

  // F11-F15: 給与換算係数
  assertEqual(SALARY_CONVERSION_RATES.hourly_to_monthly, 160, 'F11', '時給→月給=160');
  assertEqual(SALARY_CONVERSION_RATES.daily_to_monthly, 20, 'F12', '日給→月給=20');
  assertEqual(SALARY_CONVERSION_RATES.monthly_to_annual, 12, 'F13', '月給→年収=12');

  // F14-F15: 雇用形態
  assertEqual(EMPLOYMENT_TYPE_MAP['正社員'].category, '正規雇用', 'F14', '正社員→正規雇用');
  assertEqual(EMPLOYMENT_TYPE_MAP['派遣社員'].code, 'DP', 'F15', '派遣社員コード=DP');
}

// ============================================================
// カテゴリG: データ変換・月給換算テスト
// ============================================================

function testCategoryG_DataConversion() {
  console.log('\n=== カテゴリG: データ変換・月給換算テスト ===');

  // G01-G05: 時給換算
  let unified = calculateUnifiedSalary(1000, null, 'hourly');
  assertEqual(unified.monthly, 160000, 'G01', '時給1000円→月給160000円');

  unified = calculateUnifiedSalary(1500, null, 'hourly');
  assertEqual(unified.monthly, 240000, 'G02', '時給1500円→月給240000円');

  // G03-G05: 日給換算
  unified = calculateUnifiedSalary(10000, null, 'daily');
  assertEqual(unified.monthly, 200000, 'G03', '日給10000円→月給200000円');

  unified = calculateUnifiedSalary(15000, null, 'daily');
  assertEqual(unified.monthly, 300000, 'G04', '日給15000円→月給300000円');

  // G05-G08: 年収換算
  unified = calculateUnifiedSalary(3000000, null, 'annual');
  assertEqual(unified.monthly, 250000, 'G05', '年収300万円→月給25万円');

  unified = calculateUnifiedSalary(6000000, null, 'annual');
  assertEqual(unified.monthly, 500000, 'G06', '年収600万円→月給50万円');

  // G07-G08: 月給→年収
  unified = calculateUnifiedSalary(300000, null, 'monthly');
  assertEqual(unified.annual, 3600000, 'G07', '月給30万円→年収360万円');

  // G08-G10: 境界値
  unified = calculateUnifiedSalary(null, null, 'monthly');
  assertEqual(unified.monthly, null, 'G08', 'null入力→null');

  unified = calculateUnifiedSalary(0, null, 'hourly');
  assertEqual(unified.monthly, 0, 'G09', '0入力→0');

  unified = calculateUnifiedSalary(100000000, null, 'annual');
  assertEqual(unified.monthly, Math.round(100000000 / 12), 'G10', '1億円年収の月給換算');
}

// ============================================================
// カテゴリH: エッジケーステスト
// ============================================================

function testCategoryH_EdgeCases() {
  console.log('\n=== カテゴリH: エッジケーステスト ===');

  // H01-H05: 給与解析エッジケース
  let result = parseSalary('給与応相談');
  assertEqual(result.minValue, null, 'H01', '応相談はnull');

  result = parseSalary('月給25万円～');
  assert(result.hasRange, 'H02', '範囲のみ表記');

  result = parseSalary('1,000,000円');
  assertEqual(result.minValue, 1000000, 'H03', '100万円（カンマ付き）');

  // H04-H06: 勤務地エッジケース
  result = parseLocation('首都圏・関西圏');
  assertEqual(result.regionBlock, '関東', 'H04', '複数地域→最初のマッチ');

  result = parseLocation('在宅勤務可能');
  assertEqual(result.regionBlock, 'リモート', 'H05', '在宅を含む→リモート');

  result = parseLocation('全国各地');
  assertEqual(result.regionBlock, '全国', 'H06', '全国の検出');

  // H07-H10: 統計エッジケース
  result = getTrimmedMean([100, 100, 100, 100, 100], 0.1);
  assertEqual(result.trimmedMean, 100, 'H07', '同一値の刈り込み平均');

  const negativeData = [-100, 200, 300];
  result = calculatePercentiles(negativeData);
  assertNotNull(result, 'H08', '負の値を含むパーセンタイル');

  // H09-H10: 大量データ
  const largeData = Array.from({ length: 10000 }, () => Math.floor(Math.random() * 500000) + 200000);
  result = calculatePercentiles(largeData);
  assertNotNull(result, 'H09', '10000件データ処理');

  result = getBootstrapConfidenceInterval(largeData, 100);
  assertNotNull(result, 'H10', '大量データのブートストラップ');
}

// ============================================================
// メイン実行
// ============================================================

console.log('========================================');
console.log('網羅的機能テストスイート');
console.log('GASダッシュボード全機能の検証');
console.log('========================================');

testResults = { passed: 0, failed: 0, errors: [] };

try {
  testCategoryA_SalaryParser();
  testCategoryB_LocationParser();
  testCategoryC_EmploymentType();
  testCategoryD_TagParsing();
  testCategoryE_Statistics();
  testCategoryF_Constants();
  testCategoryG_DataConversion();
  testCategoryH_EdgeCases();
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
console.log('テストカバレッジ');
console.log('========================================');
console.log('A: SalaryParser（給与解析）      - 25件');
console.log('B: LocationParser（勤務地解析） - 20件');
console.log('C: 雇用形態解析                  - 15件');
console.log('D: タグ解析                      - 12件');
console.log('E: 統計計算                      - 15件');
console.log('F: 定数・マスタデータ            - 15件');
console.log('G: データ変換・月給換算          - 10件');
console.log('H: エッジケース                  - 10件');

process.exit(testResults.failed > 0 ? 1 : 0);
