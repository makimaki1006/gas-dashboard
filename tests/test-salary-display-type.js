/**
 * salaryDisplayType対応テスト
 */

const SALARY_TYPES = { HOURLY: 'hourly', DAILY: 'daily', MONTHLY: 'monthly', ANNUAL: 'annual' };
const SALARY_CONVERSION_RATES = { hourly_to_monthly: 160, daily_to_monthly: 22, monthly_to_annual: 12, annual_to_monthly: 1/12 };

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ',').replace(/．/g, '.').replace(/[～〜ー―－]/g, '~').replace(/\s+/g, ' ').trim();
}

function detectSalaryType(text, defaultSalaryType) {
  if (/時給/.test(text)) return SALARY_TYPES.HOURLY;
  if (/日給/.test(text)) return SALARY_TYPES.DAILY;
  if (/週給/.test(text)) return 'weekly';
  if (/月給|月収|基本給|固定給/.test(text)) return SALARY_TYPES.MONTHLY;
  if (/年俸|年収/.test(text)) return SALARY_TYPES.ANNUAL;
  // 修正: デフォルトを引数で受け取る
  if (defaultSalaryType === 'hourly') return SALARY_TYPES.HOURLY;
  return SALARY_TYPES.MONTHLY;
}

function extractSingleValue(text) {
  if (!text) return null;
  const cleanedText = String(text).replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  const manMatch = cleanedText.match(/(\d+)\s*万\s*(\d+)?\s*(千)?\s*円?/);
  if (manMatch) {
    let value = parseInt(manMatch[1], 10) * 10000;
    if (manMatch[2]) value += manMatch[3] === '千' ? parseInt(manMatch[2], 10) * 1000 : parseInt(manMatch[2], 10);
    return value;
  }
  const noCommaText = cleanedText.replace(/,/g, '');
  const normalMatch = noCommaText.match(/(\d+)\s*円/);
  if (normalMatch) return parseInt(normalMatch[1], 10);
  return null;
}

function extractSalaryValues(text) {
  let minValue = null, maxValue = null, hasRange = false;
  const cleanText = String(text || '').replace(/,/g, '');
  if (/~/.test(cleanText)) {
    const parts = cleanText.split(/~/);
    if (parts.length >= 2) {
      const left = extractSingleValue(parts[0]);
      const right = extractSingleValue(parts[1]);
      if (left !== null && right !== null) { hasRange = true; minValue = left; maxValue = right; }
      else if (left !== null) { hasRange = true; minValue = left; }
      else if (right !== null) { hasRange = true; maxValue = right; }
    }
  }
  if (!hasRange) minValue = extractSingleValue(cleanText);
  return { minValue, maxValue, hasRange };
}

function calculateUnifiedSalary(minValue, maxValue, salaryType) {
  if (minValue === null) return { monthly: null, annual: null };
  const baseValue = maxValue !== null ? (minValue + maxValue) / 2 : minValue;
  let monthly, annual;
  switch (salaryType) {
    case SALARY_TYPES.HOURLY:
      monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.hourly_to_monthly);
      annual = Math.round(monthly * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
    case SALARY_TYPES.MONTHLY:
      monthly = Math.round(baseValue);
      annual = Math.round(baseValue * SALARY_CONVERSION_RATES.monthly_to_annual);
      break;
    default:
      monthly = Math.round(baseValue);
      annual = Math.round(baseValue * SALARY_CONVERSION_RATES.monthly_to_annual);
  }
  return { monthly, annual };
}

function parseSalary(salaryText, defaultSalaryType) {
  if (!salaryText || salaryText === '') return { salaryType: null, minValue: null, maxValue: null, unifiedMonthly: null };
  const text = normalizeText(salaryText);
  const salaryType = detectSalaryType(text, defaultSalaryType);
  const { minValue, maxValue, hasRange } = extractSalaryValues(text);
  const unified = calculateUnifiedSalary(minValue, maxValue, salaryType);
  return { salaryType, minValue, maxValue, unifiedMonthly: unified.monthly };
}

// テスト実行
console.log('═'.repeat(60));
console.log('【salaryDisplayType対応テスト】');
console.log('═'.repeat(60));

let passed = 0;
let failed = 0;

function test(name, input, defaultType, expectedType, description) {
  const result = parseSalary(input, defaultType);
  const ok = result.salaryType === expectedType;
  if (ok) passed++; else failed++;
  console.log(`\n${ok ? '✅' : '❌'} ${name}`);
  console.log(`   入力: "${input}" (default=${defaultType})`);
  console.log(`   結果: type=${result.salaryType}, min=${result.minValue}, max=${result.maxValue}`);
  console.log(`   期待: type=${expectedType}`);
  if (result.salaryType === 'hourly') {
    console.log(`   月給換算: ${result.unifiedMonthly}円`);
  }
}

// テスト1: 「時給」キーワードあり → hourly
test('時給キーワードあり', '時給 1,140円 ~ 2,000円', undefined, 'hourly');

// テスト2: 「時給」キーワードなし、default=monthly → monthly
test('時給キーワードなし、default=monthly', '1,140円 ~ 2,000円', 'monthly', 'monthly');

// テスト3: 「時給」キーワードなし、default=hourly → hourly（★修正後の動作）
test('時給キーワードなし、default=hourly【修正後】', '1,140円 ~ 2,000円', 'hourly', 'hourly');

// テスト4: 「月給」キーワードあり、default=hourly → monthly（キーワード優先）
test('月給キーワードあり、default=hourly', '月給 25万円', 'hourly', 'monthly');

// テスト5: 「年収」キーワードあり、default=hourly → annual（キーワード優先）
test('年収キーワードあり、default=hourly', '年収 400万円', 'hourly', 'annual');

// テスト6: 数値のみ、default=hourly → hourly
test('数値のみ、default=hourly', '1200円', 'hourly', 'hourly');

// テスト7: 数値のみ、default=undefined → monthly（従来動作）
test('数値のみ、default未指定', '1200円', undefined, 'monthly');

console.log('\n' + '═'.repeat(60));
console.log(`【結果】成功: ${passed}件, 失敗: ${failed}件`);
console.log('═'.repeat(60));

if (failed > 0) process.exit(1);
