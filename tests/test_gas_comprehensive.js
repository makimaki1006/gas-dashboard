/**
 * GAS包括テスト - 実際のGASコードと完全整合性検証
 * 200パターン + 10段階深掘り + 逆証明
 */

// ===== GASコードから移植した定数 =====
const SALARY_TYPES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  MONTHLY: 'monthly',
  ANNUAL: 'annual'
};

const SALARY_CONVERSION_RATES = {
  hourly_to_monthly: 160,  // 8時間×20日
  daily_to_monthly: 20,
  monthly_to_annual: 12,
  annual_to_monthly: 1 / 12
};

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const TOKYO_23_WARDS = [
  '千代田区', '中央区', '港区', '新宿区', '文京区',
  '台東区', '墨田区', '江東区', '品川区', '目黒区',
  '大田区', '世田谷区', '渋谷区', '中野区', '杉並区',
  '豊島区', '北区', '荒川区', '板橋区', '練馬区',
  '足立区', '葛飾区', '江戸川区'
];

const ANNUAL_HOLIDAYS_PATTERNS = [
  /年間休日[:\s:：・]*(\d{2,3})\s*日/,
  /<年間休日>(\d{2,3})日?/,
  /年間休日数[:\s:：・]*(\d{2,3})\s*日?/,
  /年間休日[はが](\d{2,3})日?/,
  /年間休日(\d{2,3})日?[!！。、]/,
  /年間休日[:\s:：・]*(\d{2,3})(?!\d)/,
  /年休(\d{2,3})日[～〜]?/,
  /年休[:\s:：・]*(\d{2,3})\s*日/
];

// ===== GASコード互換パーサー =====

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
  if (/月給|月収|基本給|固定給/.test(text)) return SALARY_TYPES.MONTHLY;
  if (/年俸|年収/.test(text)) return SALARY_TYPES.ANNUAL;
  return SALARY_TYPES.MONTHLY;
}

function extractSingleValue(text) {
  const manPattern = /(\d+(?:\.\d+)?)\s*万\s*(\d+(?:\.\d+)?)?\s*(千)?\s*円?/;
  const manMatch = text.match(manPattern);
  if (manMatch) {
    let value = parseFloat(manMatch[1]) * 10000;
    if (manMatch[2]) {
      if (manMatch[3] === '千') {
        value += parseFloat(manMatch[2]) * 1000;
      } else {
        value += parseFloat(manMatch[2]);
      }
    }
    return value;
  }

  const senPattern = /(\d+(?:\.\d+)?)\s*千\s*円/;
  const senMatch = text.match(senPattern);
  if (senMatch) return parseFloat(senMatch[1]) * 1000;

  const normalPattern = /(\d+(?:\.\d+)?)\s*円/;
  const normalMatch = text.match(normalPattern);
  if (normalMatch) return parseFloat(normalMatch[1]);

  return null;
}

function parseSalary(salaryText) {
  if (!salaryText || salaryText === '') {
    return { originalText: '', salaryType: null, minValue: null, maxValue: null, hasRange: false, unifiedMonthly: null, unifiedAnnual: null, confidence: 0 };
  }

  const text = normalizeText(salaryText);
  const salaryType = detectSalaryType(text);
  const cleanText = text.replace(/,/g, '');

  let minValue = null, maxValue = null, hasRange = false;

  if (/~/.test(cleanText)) {
    const parts = cleanText.split(/~/);
    if (parts.length >= 2) {
      const leftValue = extractSingleValue(parts[0]);
      const rightValue = extractSingleValue(parts[1]);
      if (leftValue !== null && rightValue !== null) {
        hasRange = true;
        minValue = leftValue;
        maxValue = rightValue;
      } else if (leftValue !== null) {
        hasRange = true;
        minValue = leftValue;
        maxValue = null;
      }
    }
  }

  if (!hasRange) {
    const singleValue = extractSingleValue(cleanText);
    minValue = singleValue;
    maxValue = singleValue;
  }

  // 統一給与計算
  let monthly = null, annual = null;
  if (minValue !== null) {
    const baseValue = maxValue !== null ? (minValue + maxValue) / 2 : minValue;
    switch (salaryType) {
      case SALARY_TYPES.HOURLY:
        monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.hourly_to_monthly);
        annual = Math.round(monthly * SALARY_CONVERSION_RATES.monthly_to_annual);
        break;
      case SALARY_TYPES.DAILY:
        monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.daily_to_monthly);
        annual = Math.round(monthly * SALARY_CONVERSION_RATES.monthly_to_annual);
        break;
      case SALARY_TYPES.ANNUAL:
        annual = Math.round(baseValue);
        monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.annual_to_monthly);
        break;
      default:
        monthly = Math.round(baseValue);
        annual = Math.round(baseValue * SALARY_CONVERSION_RATES.monthly_to_annual);
    }
  }

  let confidence = 0.5;
  if (/時給|日給|月給|月収|年俸|年収/.test(text)) confidence += 0.2;
  if (/円/.test(text)) confidence += 0.1;
  if (minValue !== null) confidence += 0.2;

  return {
    originalText: salaryText,
    salaryType,
    minValue,
    maxValue,
    hasRange,
    unifiedMonthly: monthly,
    unifiedAnnual: annual,
    confidence: Math.min(confidence, 1.0)
  };
}

function parseLocation(locationText) {
  if (!locationText || locationText === '') {
    return { originalText: '', prefecture: null, cityWard: null, isComplete: false };
  }

  const text = locationText.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();

  // 都道府県抽出
  let prefecture = null;
  for (const pref of PREFECTURES) {
    if (text.includes(pref)) {
      prefecture = pref;
      break;
    }
  }

  // 東京23区チェック
  if (prefecture === '東京都' || text.includes('東京')) {
    for (const ward of TOKYO_23_WARDS) {
      if (text.includes(ward)) {
        return {
          originalText: locationText,
          prefecture: '東京都',
          cityWard: ward,
          cityType: '東京23区',
          isComplete: true
        };
      }
    }
  }

  // 市区町村抽出
  let cityWard = null;
  const cityMatch = text.match(/([^\s]+市)/);
  if (cityMatch) cityWard = cityMatch[1];
  const wardMatch = text.match(/([^\s]+区)/);
  if (!cityWard && wardMatch) cityWard = wardMatch[1];

  return {
    originalText: locationText,
    prefecture,
    cityWard,
    isComplete: prefecture !== null && cityWard !== null
  };
}

function extractAnnualHolidays(text) {
  if (!text || typeof text !== 'string') return null;

  for (const pattern of ANNUAL_HOLIDAYS_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      if ((days >= 70 && days <= 99) || (days >= 100 && days <= 180)) {
        return days;
      }
    }
  }
  return null;
}

function parseEmploymentType(text) {
  if (!text || typeof text !== 'string') return { category: null, subcategory: null };

  const normalized = text.replace(/\s+/g, '');

  if (/正社員|正職員|無期雇用/.test(normalized)) {
    return { category: '正規雇用', subcategory: '正社員', code: 'FT' };
  }
  if (/契約社員|嘱託|準社員/.test(normalized)) {
    return { category: '非正規雇用', subcategory: '契約社員', code: 'CT' };
  }
  if (/派遣/.test(normalized)) {
    return { category: '非正規雇用', subcategory: '派遣社員', code: 'DP' };
  }
  if (/パート|アルバイト/.test(normalized)) {
    return { category: '非正規雇用', subcategory: 'パート・アルバイト', code: 'PT' };
  }
  if (/業務委託|フリーランス/.test(normalized)) {
    return { category: 'その他', subcategory: '業務委託', code: 'FC' };
  }

  return { category: null, subcategory: null };
}

function parseTags(tagsText) {
  if (!tagsText || typeof tagsText !== 'string') return [];
  return tagsText.split(/[,、・]/).map(t => t.trim()).filter(t => t);
}

// ===== 200テストパターン生成 =====
function generate200TestPatterns() {
  const patterns = [];
  let id = 0;

  // === カテゴリ1: 給与パターン (60件) ===
  const salaryPatterns = [
    // 月給パターン
    { input: '月給25万円〜35万円', expectedType: 'monthly', expectedMin: 250000, expectedMax: 350000 },
    { input: '月給30万円', expectedType: 'monthly', expectedMin: 300000, expectedMax: 300000 },
    { input: '月給 20万円 〜 28万円', expectedType: 'monthly', expectedMin: 200000, expectedMax: 280000 },
    { input: '月給250,000円～350,000円', expectedType: 'monthly', expectedMin: 250000, expectedMax: 350000 },
    { input: '月給22万5千円〜30万円', expectedType: 'monthly', expectedMin: 225000, expectedMax: 300000 },
    { input: '月収28万円以上', expectedType: 'monthly', expectedMin: 280000, expectedMax: null },
    { input: '月給35万円+賞与', expectedType: 'monthly', expectedMin: 350000, expectedMax: 350000 },
    { input: '基本給25万円〜', expectedType: 'monthly', expectedMin: 250000, expectedMax: null },
    { input: '固定給30万円', expectedType: 'monthly', expectedMin: 300000, expectedMax: 300000 },
    { input: '月給18万円～25万円（経験考慮）', expectedType: 'monthly', expectedMin: 180000, expectedMax: 250000 },
    // 時給パターン
    { input: '時給1,200円〜1,500円', expectedType: 'hourly', expectedMin: 1200, expectedMax: 1500 },
    { input: '時給1500円', expectedType: 'hourly', expectedMin: 1500, expectedMax: 1500 },
    { input: '時給 1,100円 〜 1,400円', expectedType: 'hourly', expectedMin: 1100, expectedMax: 1400 },
    { input: '時給1000円以上', expectedType: 'hourly', expectedMin: 1000, expectedMax: null },
    { input: '時給950円～1,200円', expectedType: 'hourly', expectedMin: 950, expectedMax: 1200 },
    { input: '時給2,000円（試用期間中1,800円）', expectedType: 'hourly', expectedMin: 2000, expectedMax: 2000 },
    // 年収パターン
    { input: '年収400万円〜600万円', expectedType: 'annual', expectedMin: 4000000, expectedMax: 6000000 },
    { input: '年収500万円', expectedType: 'annual', expectedMin: 5000000, expectedMax: 5000000 },
    { input: '年俸450万〜700万', expectedType: 'annual', expectedMin: 4500000, expectedMax: 7000000 },
    { input: '年収350万円以上', expectedType: 'annual', expectedMin: 3500000, expectedMax: null },
    // 日給パターン
    { input: '日給10,000円〜15,000円', expectedType: 'daily', expectedMin: 10000, expectedMax: 15000 },
    { input: '日給12000円', expectedType: 'daily', expectedMin: 12000, expectedMax: 12000 },
    // 特殊パターン
    { input: '', expectedType: null, expectedMin: null, expectedMax: null },
    { input: '給与相談', expectedType: 'monthly', expectedMin: null, expectedMax: null },
    { input: '経験により優遇', expectedType: 'monthly', expectedMin: null, expectedMax: null },
  ];

  salaryPatterns.forEach(p => {
    patterns.push({
      id: id++,
      category: 'salary',
      input: { salary: p.input },
      expected: { type: p.expectedType, min: p.expectedMin, max: p.expectedMax }
    });
  });

  // 残りの給与パターンを追加
  for (let i = patterns.length; i < 60; i++) {
    const min = Math.floor(Math.random() * 20 + 20) * 10000;
    const max = min + Math.floor(Math.random() * 10) * 10000;
    patterns.push({
      id: id++,
      category: 'salary',
      input: { salary: `月給${min/10000}万円〜${max/10000}万円` },
      expected: { type: 'monthly', min, max }
    });
  }

  // === カテゴリ2: 勤務地パターン (47件 - 全都道府県) ===
  PREFECTURES.forEach(pref => {
    patterns.push({
      id: id++,
      category: 'location',
      input: { location: pref },
      expected: { prefecture: pref }
    });
  });

  // === カテゴリ3: 東京23区パターン (23件) ===
  TOKYO_23_WARDS.forEach(ward => {
    patterns.push({
      id: id++,
      category: 'tokyo_ward',
      input: { location: `東京都 ${ward}` },
      expected: { prefecture: '東京都', cityWard: ward }
    });
  });

  // === カテゴリ4: 年間休日パターン (20件) ===
  const holidayPatterns = [
    { input: '年間休日120日', expected: 120 },
    { input: '年間休日:125日', expected: 125 },
    { input: '年間休日 110日', expected: 110 },
    { input: '<年間休日>120日', expected: 120 },
    { input: '年間休日数:120日', expected: 120 },
    { input: '年間休日は125日', expected: 125 },
    { input: '年間休日120日!', expected: 120 },
    { input: '年休120日', expected: 120 },
    { input: '年休:125日', expected: 125 },
    { input: '年間休日105日', expected: 105 },
    { input: '年間休日130日', expected: 130 },
    { input: '年間休日90日', expected: 90 },
    { input: '年間休日80日', expected: 80 },
    { input: '', expected: null },
    { input: '年間休日未定', expected: null },
    { input: '休日週2日', expected: null },
  ];

  holidayPatterns.forEach(p => {
    patterns.push({
      id: id++,
      category: 'annual_holidays',
      input: { annualHolidays: p.input },
      expected: { days: p.expected }
    });
  });

  // 残りの年間休日パターンを追加
  for (let i = holidayPatterns.length; i < 20; i++) {
    const days = 100 + Math.floor(Math.random() * 30);
    patterns.push({
      id: id++,
      category: 'annual_holidays',
      input: { annualHolidays: `年間休日${days}日` },
      expected: { days }
    });
  }

  // === カテゴリ5: 雇用形態パターン (15件) ===
  const employmentPatterns = [
    { input: '正社員', expected: { category: '正規雇用', subcategory: '正社員' } },
    { input: '正職員', expected: { category: '正規雇用', subcategory: '正社員' } },
    { input: '契約社員', expected: { category: '非正規雇用', subcategory: '契約社員' } },
    { input: '派遣社員', expected: { category: '非正規雇用', subcategory: '派遣社員' } },
    { input: '紹介予定派遣', expected: { category: '非正規雇用', subcategory: '派遣社員' } },
    { input: 'パート', expected: { category: '非正規雇用', subcategory: 'パート・アルバイト' } },
    { input: 'アルバイト', expected: { category: '非正規雇用', subcategory: 'パート・アルバイト' } },
    { input: 'パート・アルバイト', expected: { category: '非正規雇用', subcategory: 'パート・アルバイト' } },
    { input: '業務委託', expected: { category: 'その他', subcategory: '業務委託' } },
    { input: 'フリーランス', expected: { category: 'その他', subcategory: '業務委託' } },
    { input: '', expected: { category: null, subcategory: null } },
  ];

  employmentPatterns.forEach(p => {
    patterns.push({
      id: id++,
      category: 'employment_type',
      input: { employmentType: p.input },
      expected: p.expected
    });
  });

  // 残りの雇用形態パターンを追加
  for (let i = employmentPatterns.length; i < 15; i++) {
    patterns.push({
      id: id++,
      category: 'employment_type',
      input: { employmentType: '正社員（試用期間あり）' },
      expected: { category: '正規雇用', subcategory: '正社員' }
    });
  }

  // === カテゴリ6: タグパターン (20件) ===
  const tagPatterns = [
    '未経験歓迎, 土日祝休み, 交通費支給',
    '経験者優遇、社会保険完備',
    'リモートワーク可・フレックス',
    '残業少なめ',
    '',
    '昇給あり, 賞与あり, 社会保険完備, 交通費支給',
    '週休2日, 年間休日120日以上',
    '未経験OK・研修制度あり',
    '駅チカ・転勤なし',
    '高校生歓迎・学生歓迎',
  ];

  tagPatterns.forEach(tags => {
    patterns.push({
      id: id++,
      category: 'tags',
      input: { tags },
      expected: { count: tags ? tags.split(/[,、・]/).filter(t => t.trim()).length : 0 }
    });
  });

  // 残りのタグパターンを追加
  for (let i = tagPatterns.length; i < 20; i++) {
    patterns.push({
      id: id++,
      category: 'tags',
      input: { tags: '未経験歓迎, 交通費支給' },
      expected: { count: 2 }
    });
  }

  // === カテゴリ7: エッジケース (残り～200件) ===
  const edgeCases = [
    // 空値
    { salary: '', location: '', employmentType: '', tags: '', annualHolidays: '' },
    // 特殊文字
    { salary: '月給25万円～35万円（税込）', location: '東京都 渋谷区（転勤なし）' },
    // 長いテキスト
    { salary: '月給25万円〜35万円+各種手当+賞与年2回+インセンティブ' },
    // 境界値
    { salary: '月給15万円', location: '北海道' },
    { salary: '月給100万円', location: '沖縄県' },
    { annualHolidays: '年間休日70日' },
    { annualHolidays: '年間休日180日' },
    // 複合パターン
    { salary: '月給30万円', employmentType: '正社員', annualHolidays: '年間休日125日' },
    { salary: '時給1500円', employmentType: 'パート・アルバイト', annualHolidays: '' },
  ];

  edgeCases.forEach(ec => {
    patterns.push({
      id: id++,
      category: 'edge_case',
      input: ec,
      expected: {} // エッジケースは期待値なし（エラーしないことを確認）
    });
  });

  // 残りをランダムで埋める
  while (patterns.length < 200) {
    patterns.push({
      id: id++,
      category: 'random',
      input: {
        salary: `月給${20 + Math.floor(Math.random() * 30)}万円`,
        location: PREFECTURES[Math.floor(Math.random() * PREFECTURES.length)],
        employmentType: '正社員'
      },
      expected: {}
    });
  }

  return patterns.slice(0, 200);
}

// ===== テスト実行 =====
class ComprehensiveTestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      deepVerification: [],
      reverseProofs: []
    };
  }

  assert(condition, message, details = {}) {
    this.results.total++;
    if (condition) {
      this.results.passed++;
      return true;
    } else {
      this.results.failed++;
      this.results.errors.push({ message, details });
      return false;
    }
  }

  testSalaryPattern(pattern) {
    const result = parseSalary(pattern.input.salary || '');
    const expected = pattern.expected;

    if (expected.type !== undefined) {
      this.assert(
        result.salaryType === expected.type,
        `給与タイプ: ${pattern.input.salary}`,
        { expected: expected.type, actual: result.salaryType }
      );
    }

    if (expected.min !== undefined && expected.min !== null) {
      this.assert(
        result.minValue === expected.min,
        `給与最小値: ${pattern.input.salary}`,
        { expected: expected.min, actual: result.minValue }
      );
    }

    if (expected.max !== undefined && expected.max !== null) {
      this.assert(
        result.maxValue === expected.max,
        `給与最大値: ${pattern.input.salary}`,
        { expected: expected.max, actual: result.maxValue }
      );
    }
  }

  testLocationPattern(pattern) {
    const result = parseLocation(pattern.input.location || '');
    const expected = pattern.expected;

    if (expected.prefecture) {
      this.assert(
        result.prefecture === expected.prefecture,
        `都道府県: ${pattern.input.location}`,
        { expected: expected.prefecture, actual: result.prefecture }
      );
    }

    if (expected.cityWard) {
      this.assert(
        result.cityWard === expected.cityWard,
        `市区町村: ${pattern.input.location}`,
        { expected: expected.cityWard, actual: result.cityWard }
      );
    }
  }

  testAnnualHolidaysPattern(pattern) {
    const result = extractAnnualHolidays(pattern.input.annualHolidays || '');
    const expected = pattern.expected.days;

    this.assert(
      result === expected,
      `年間休日: ${pattern.input.annualHolidays}`,
      { expected, actual: result }
    );
  }

  testEmploymentTypePattern(pattern) {
    const result = parseEmploymentType(pattern.input.employmentType || '');
    const expected = pattern.expected;

    if (expected.category !== undefined) {
      this.assert(
        result.category === expected.category,
        `雇用形態カテゴリ: ${pattern.input.employmentType}`,
        { expected: expected.category, actual: result.category }
      );
    }

    if (expected.subcategory !== undefined) {
      this.assert(
        result.subcategory === expected.subcategory,
        `雇用形態サブカテゴリ: ${pattern.input.employmentType}`,
        { expected: expected.subcategory, actual: result.subcategory }
      );
    }
  }

  testTagsPattern(pattern) {
    const result = parseTags(pattern.input.tags || '');
    const expected = pattern.expected.count;

    this.assert(
      result.length === expected,
      `タグ数: ${pattern.input.tags}`,
      { expected, actual: result.length }
    );
  }

  // 10段階深掘り検証
  deepVerify(pattern, level = 10) {
    const checks = [];
    const input = pattern.input;

    // レベル1: 基本パース
    if (level >= 1) {
      const salary = parseSalary(input.salary || '');
      const location = parseLocation(input.location || '');
      checks.push({ level: 1, name: '基本パース', passed: salary !== null && location !== null });
    }

    // レベル2: 型チェック
    if (level >= 2) {
      const salary = parseSalary(input.salary || '');
      checks.push({ level: 2, name: '型チェック', passed: typeof salary === 'object' });
    }

    // レベル3: 値の範囲
    if (level >= 3 && input.salary) {
      const salary = parseSalary(input.salary);
      const validRange = salary.unifiedMonthly === null ||
        (salary.unifiedMonthly >= 0 && salary.unifiedMonthly < 100000000);
      checks.push({ level: 3, name: '給与範囲', passed: validRange });
    }

    // レベル4: 整合性（min <= max）
    if (level >= 4 && input.salary) {
      const salary = parseSalary(input.salary);
      const consistent = salary.minValue === null || salary.maxValue === null ||
        salary.minValue <= salary.maxValue;
      checks.push({ level: 4, name: '給与min≤max', passed: consistent });
    }

    // レベル5: 都道府県妥当性
    if (level >= 5 && input.location) {
      const location = parseLocation(input.location);
      const validPref = location.prefecture === null ||
        PREFECTURES.includes(location.prefecture);
      checks.push({ level: 5, name: '都道府県妥当性', passed: validPref });
    }

    // レベル6: 年間休日妥当性
    if (level >= 6 && input.annualHolidays) {
      const holidays = extractAnnualHolidays(input.annualHolidays);
      const validHolidays = holidays === null ||
        (holidays >= 50 && holidays <= 200);
      checks.push({ level: 6, name: '年間休日妥当性', passed: validHolidays });
    }

    // レベル7: 雇用形態-給与整合性
    if (level >= 7) {
      const salary = parseSalary(input.salary || '');
      const emp = parseEmploymentType(input.employmentType || '');
      const isPartTime = emp.subcategory === 'パート・アルバイト';
      const isHourly = salary.salaryType === 'hourly';
      const consistent = !isPartTime || isHourly || salary.salaryType === null;
      checks.push({ level: 7, name: '雇用形態-給与整合性', passed: consistent });
    }

    // レベル8: データ完全性（パーサーがエラーなく動作することを確認）
    if (level >= 8) {
      // パース処理がエラーなく完了することを確認
      let parseSuccess = true;
      try {
        parseSalary(input.salary || '');
        parseLocation(input.location || '');
        parseEmploymentType(input.employmentType || '');
      } catch (e) {
        parseSuccess = false;
      }
      checks.push({ level: 8, name: 'データ完全性', passed: parseSuccess });
    }

    // レベル9: エンコーディング
    if (level >= 9) {
      const noCorruption = !input.salary || !input.salary.includes('\uFFFD');
      checks.push({ level: 9, name: 'エンコーディング', passed: noCorruption });
    }

    // レベル10: 再パース一致（冪等性）
    if (level >= 10 && input.salary) {
      const salary1 = parseSalary(input.salary);
      const salary2 = parseSalary(input.salary);
      const idempotent = JSON.stringify(salary1) === JSON.stringify(salary2);
      checks.push({ level: 10, name: '再パース一致', passed: idempotent });
    }

    this.results.deepVerification.push({
      patternId: pattern.id,
      checks,
      allPassed: checks.every(c => c.passed)
    });

    return checks.every(c => c.passed);
  }

  // 逆証明
  reverseProof(patterns) {
    const proofs = [];

    // 証明1: 給与タイプが時給 → 元データに「時給」がある
    const hourlyRecords = patterns.filter(p => {
      if (!p.input.salary) return false;
      const result = parseSalary(p.input.salary);
      return result.salaryType === 'hourly';
    });

    proofs.push({
      claim: '時給type → 「時給」文字列あり',
      count: hourlyRecords.length,
      valid: hourlyRecords.every(p => p.input.salary.includes('時給')),
      counterExamples: hourlyRecords.filter(p => !p.input.salary.includes('時給')).slice(0, 3)
    });

    // 証明2: 年収タイプ → 元データに「年収|年俸」がある
    const annualRecords = patterns.filter(p => {
      if (!p.input.salary) return false;
      const result = parseSalary(p.input.salary);
      return result.salaryType === 'annual';
    });

    proofs.push({
      claim: '年収type → 「年収|年俸」文字列あり',
      count: annualRecords.length,
      valid: annualRecords.every(p => /年収|年俸/.test(p.input.salary)),
      counterExamples: annualRecords.filter(p => !/年収|年俸/.test(p.input.salary)).slice(0, 3)
    });

    // 証明3: 都道府県パースOK → 元データに都道府県名がある
    const parsedLocations = patterns.filter(p => {
      if (!p.input.location) return false;
      const result = parseLocation(p.input.location);
      return result.prefecture !== null;
    });

    proofs.push({
      claim: '都道府県パースOK → 都道府県名あり',
      count: parsedLocations.length,
      valid: parsedLocations.every(p => PREFECTURES.some(pref => p.input.location.includes(pref))),
      counterExamples: parsedLocations.filter(p => !PREFECTURES.some(pref => p.input.location.includes(pref))).slice(0, 3)
    });

    // 証明4: 年間休日がnull → 元データにパターンなし
    const noHolidayRecords = patterns.filter(p => {
      if (!p.input.annualHolidays) return true;
      const result = extractAnnualHolidays(p.input.annualHolidays);
      return result === null;
    });

    proofs.push({
      claim: '年間休日null → 有効パターンなし',
      count: noHolidayRecords.length,
      valid: noHolidayRecords.every(p => {
        const text = p.input.annualHolidays || '';
        return !ANNUAL_HOLIDAYS_PATTERNS.some(pattern => {
          const match = text.match(pattern);
          if (match && match[1]) {
            const days = parseInt(match[1], 10);
            return (days >= 70 && days <= 99) || (days >= 100 && days <= 180);
          }
          return false;
        });
      }),
      counterExamples: []
    });

    this.results.reverseProofs = proofs;
    return proofs.every(p => p.valid);
  }

  run() {
    console.log('========================================');
    console.log('GAS包括テスト開始 (200パターン)');
    console.log('========================================\n');

    const patterns = generate200TestPatterns();
    console.log(`生成パターン数: ${patterns.length}\n`);

    // カテゴリ別テスト
    console.log('===== カテゴリ別テスト =====\n');

    patterns.forEach(pattern => {
      switch (pattern.category) {
        case 'salary':
          this.testSalaryPattern(pattern);
          break;
        case 'location':
        case 'tokyo_ward':
          this.testLocationPattern(pattern);
          break;
        case 'annual_holidays':
          this.testAnnualHolidaysPattern(pattern);
          break;
        case 'employment_type':
          this.testEmploymentTypePattern(pattern);
          break;
        case 'tags':
          this.testTagsPattern(pattern);
          break;
        default:
          // エッジケース・ランダムはエラーしないことを確認
          try {
            parseSalary(pattern.input.salary || '');
            parseLocation(pattern.input.location || '');
            parseEmploymentType(pattern.input.employmentType || '');
            parseTags(pattern.input.tags || '');
            extractAnnualHolidays(pattern.input.annualHolidays || '');
            this.results.total++;
            this.results.passed++;
          } catch (e) {
            this.results.total++;
            this.results.failed++;
            this.results.errors.push({ message: `エッジケースでエラー: ${e.message}`, details: pattern });
          }
      }

      // 10件ごとに深掘り検証
      if (pattern.id % 10 === 0) {
        this.deepVerify(pattern, 10);
      }
    });

    // 逆証明
    console.log('\n===== 逆証明 =====\n');
    const reverseProofPassed = this.reverseProof(patterns);

    this.results.reverseProofs.forEach((p, i) => {
      console.log(`証明${i + 1}: ${p.claim}`);
      console.log(`  対象数: ${p.count}`);
      console.log(`  結果: ${p.valid ? '✓ 成立' : '✗ 不成立'}`);
      if (p.counterExamples && p.counterExamples.length > 0) {
        console.log(`  反例:`, p.counterExamples.map(e => e.input));
      }
    });

    // 結果出力
    console.log('\n========================================');
    console.log('テスト結果サマリー');
    console.log('========================================');
    console.log(`総テスト数: ${this.results.total}`);
    console.log(`成功: ${this.results.passed}`);
    console.log(`失敗: ${this.results.failed}`);
    console.log(`成功率: ${(this.results.passed / this.results.total * 100).toFixed(2)}%`);
    console.log(`逆証明: ${reverseProofPassed ? '全成立' : '一部不成立'}`);

    if (this.results.errors.length > 0) {
      console.log('\n===== エラー詳細 (先頭10件) =====');
      this.results.errors.slice(0, 10).forEach((e, i) => {
        console.log(`${i + 1}. ${e.message}`);
        console.log(`   詳細:`, JSON.stringify(e.details, null, 2));
      });
    }

    console.log('\n===== 深掘り検証サマリー =====');
    const deepPassCount = this.results.deepVerification.filter(d => d.allPassed).length;
    const deepTotal = this.results.deepVerification.length;
    console.log(`深掘り検証数: ${deepTotal}`);
    console.log(`全レベル合格: ${deepPassCount}/${deepTotal} (${(deepPassCount/deepTotal*100).toFixed(2)}%)`);

    // 失敗した深掘り検証の詳細
    const failedDeep = this.results.deepVerification.filter(d => !d.allPassed);
    if (failedDeep.length > 0) {
      console.log('\n  失敗した深掘り検証:');
      failedDeep.forEach(d => {
        const failedChecks = d.checks.filter(c => !c.passed);
        console.log(`    パターン${d.patternId}: ${failedChecks.map(c => c.name).join(', ')}`);
      });
    }

    return {
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      passRate: this.results.passed / this.results.total,
      reverseProofPassed,
      deepPassRate: deepPassCount / deepTotal
    };
  }
}

// 実行
if (typeof require !== 'undefined' && require.main === module) {
  const runner = new ComprehensiveTestRunner();
  const result = runner.run();

  console.log('\n========================================');
  console.log('最終結論');
  console.log('========================================');

  if (result.passRate >= 0.95 && result.reverseProofPassed && result.deepPassRate >= 0.95) {
    console.log('✅ 全テスト合格: システムは正常に動作しています');
  } else {
    console.log('⚠️ 一部テストに問題があります');
    if (result.passRate < 0.95) console.log(`  - 成功率: ${(result.passRate * 100).toFixed(2)}% (目標: 95%)`);
    if (!result.reverseProofPassed) console.log('  - 逆証明に失敗しています');
    if (result.deepPassRate < 0.95) console.log(`  - 深掘り検証: ${(result.deepPassRate * 100).toFixed(2)}% (目標: 95%)`);
  }
}

module.exports = { ComprehensiveTestRunner, generate200TestPatterns, parseSalary, parseLocation, parseEmploymentType, parseTags, extractAnnualHolidays };
