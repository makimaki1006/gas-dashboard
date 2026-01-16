/**
 * Indeed給与形式のテスト
 * 修正後のSalaryParserがIndeed形式でも正しく動作するか確認
 */

// 給与タイプ定数
const SALARY_TYPES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  MONTHLY: 'monthly',
  ANNUAL: 'annual'
};

// 換算レート
const SALARY_CONVERSION_RATES = {
  hourly_to_monthly: 160,
  daily_to_monthly: 20,
  monthly_to_annual: 12,
  annual_to_monthly: 1/12
};

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
  if (senMatch) {
    return parseFloat(senMatch[1]) * 1000;
  }

  const normalPattern = /(\d+(?:\.\d+)?)\s*円/;
  const normalMatch = text.match(normalPattern);
  if (normalMatch) {
    return parseFloat(normalMatch[1]);
  }

  return null;
}

// 修正後のextractSalaryValues（～で分割するバージョン）
function extractSalaryValues(text) {
  let minValue = null;
  let maxValue = null;
  let hasRange = false;

  const cleanText = text.replace(/,/g, '');

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

  return { minValue, maxValue, hasRange };
}

function calculateUnifiedSalary(minValue, maxValue, salaryType) {
  if (minValue === null) {
    return { monthly: null, annual: null };
  }

  const baseValue = maxValue !== null ? (minValue + maxValue) / 2 : minValue;
  let monthly, annual;

  switch (salaryType) {
    case SALARY_TYPES.HOURLY:
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.hourly_to_monthly);
      annual = Math.round(monthly * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
    case SALARY_TYPES.ANNUAL:
      annual = Math.round(baseValue);
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.annual_to_monthly);
      break;
    case SALARY_TYPES.MONTHLY:
    default:
      monthly = Math.round(baseValue);
      annual = Math.round(baseValue * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
  }

  return { monthly, annual };
}

function parseSalary(salaryText) {
  if (!salaryText || salaryText === '') {
    return { salaryType: null, minValue: null, unifiedMonthly: null };
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
    unifiedMonthly: unified.monthly
  };
}

// ========================================
// Indeed形式の給与テストケース
// ========================================
const indeedTestCases = [
  // 月給パターン（Indeed正社員）
  { input: '月給 250,000円', expected: { type: 'monthly', monthly: 250000 } },
  { input: '月給25万円', expected: { type: 'monthly', monthly: 250000 } },
  { input: '月給 20万円 ～ 30万円', expected: { type: 'monthly', monthly: 250000 } },
  { input: '月給20万円～25万円', expected: { type: 'monthly', monthly: 225000 } },
  { input: '月給 180,000円 〜 220,000円', expected: { type: 'monthly', monthly: 200000 } },
  { input: '月給22万円以上', expected: { type: 'monthly', monthly: 220000 } },

  // 時給パターン（Indeedパート）
  { input: '時給 1,200円', expected: { type: 'hourly', monthly: 192000 } },
  { input: '時給1200円', expected: { type: 'hourly', monthly: 192000 } },
  { input: '時給 1,000円 ～ 1,500円', expected: { type: 'hourly', monthly: 200000 } },
  { input: '時給1100円～1300円', expected: { type: 'hourly', monthly: 192000 } },

  // 年収パターン
  { input: '年収 400万円', expected: { type: 'annual', monthly: 333333 } },
  { input: '年収400万円～500万円', expected: { type: 'annual', monthly: 375000 } },
  { input: '年俸 600万円', expected: { type: 'annual', monthly: 500000 } },

  // エッジケース
  { input: '月給 23万5000円', expected: { type: 'monthly', monthly: 235000 } },
  { input: '月給23万5千円', expected: { type: 'monthly', monthly: 235000 } },
  { input: '', expected: { type: null, monthly: null } },
];

console.log('='.repeat(60));
console.log('Indeed給与形式 互換性テスト');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

indeedTestCases.forEach((tc, i) => {
  const result = parseSalary(tc.input);

  const typeMatch = result.salaryType === tc.expected.type;
  const monthlyMatch = tc.expected.monthly === null
    ? result.unifiedMonthly === null
    : Math.abs(result.unifiedMonthly - tc.expected.monthly) < 5000; // 5000円の誤差許容

  const status = typeMatch && monthlyMatch ? '✅' : '❌';

  if (typeMatch && monthlyMatch) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status} Test ${i + 1}: "${tc.input}"`);
  console.log(`   期待: type=${tc.expected.type}, monthly=${tc.expected.monthly}`);
  console.log(`   結果: type=${result.salaryType}, monthly=${result.unifiedMonthly}`);

  if (!typeMatch || !monthlyMatch) {
    console.log(`   ⚠️ 不一致検出!`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`テスト結果: ${passed}/${passed + failed} パス`);
if (failed > 0) {
  console.log(`❌ ${failed}件の失敗あり - Indeed互換性に問題あり!`);
} else {
  console.log('✅ Indeed形式との互換性OK');
}
console.log('='.repeat(60));
