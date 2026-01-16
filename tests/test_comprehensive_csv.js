/**
 * 包括的CSVテスト
 * 求人ボックス + Indeed 3ファイルの完全検証
 */
const fs = require('fs');

// ========================================
// Constants.js から必要な定数をコピー
// ========================================
const DATA_SOURCE_TYPES = {
  INDEED: 'indeed',
  KYUJIN_BOX: 'kyujin_box',
  UNKNOWN: 'unknown'
};

const DATA_SOURCE_COLUMNS = {
  [DATA_SOURCE_TYPES.INDEED]: {
    // 修正版：CSSクラス名ベースのヘッダーに対応
    identifierColumns: ['jobsearch-JobCard-tag', 'jcs-JobTitle', 'css-bxyec3'],
    columns: {
      url: 'jcs-JobTitle href',
      title: 'jcs-JobTitle',
      company: '会社名',
      location: '勤務地',
      salary: '給与',
      employmentType: '雇用形態',
    }
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
      description: 'p-result_lines',
    }
  }
};

// ========================================
// データソース判定関数（改良版：部分一致対応）
// ========================================
function detectDataSource(headers) {
  if (!headers || !Array.isArray(headers)) {
    return DATA_SOURCE_TYPES.UNKNOWN;
  }

  const headerList = headers.map(h => h.trim());

  for (const [sourceType, config] of Object.entries(DATA_SOURCE_COLUMNS)) {
    const identifiers = config.identifierColumns;

    // 部分一致でチェック（ヘッダーの先頭部分が識別カラム名と一致するか）
    const matchCount = identifiers.filter(col => {
      return headerList.some(header => header === col || header.startsWith(col + ' ') || header.startsWith(col + '('));
    }).length;

    if (matchCount >= Math.ceil(identifiers.length / 2)) {
      return sourceType;
    }
  }

  return DATA_SOURCE_TYPES.UNKNOWN;
}

// ========================================
// 給与解析関数（修正版）
// ========================================
const SALARY_TYPES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  MONTHLY: 'monthly',
  ANNUAL: 'annual'
};

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
// 年間休日抽出（求人ボックス用）
// ========================================
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

function extractAnnualHolidays(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  for (const pattern of ANNUAL_HOLIDAYS_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      const isValid = (days >= 70 && days <= 99) || (days >= 100 && days <= 180);
      if (isValid) {
        return days;
      }
    }
  }

  return null;
}

// ========================================
// CSVパーサー
// ========================================
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// ========================================
// テスト実行
// ========================================
const testFiles = [
  {
    name: '求人ボックス',
    path: 'C:/Users/fuji1/Downloads/xn--pckua2a7gp15o89zb-2026-01-15 (2).csv',
    expectedSource: 'kyujin_box',
    hasAnnualHolidays: true
  },
  {
    name: 'Indeed (1)',
    path: 'C:/Users/fuji1/Downloads/indeed-2026-01-13.csv',
    expectedSource: 'indeed',
    hasAnnualHolidays: false
  },
  {
    name: 'Indeed (2)',
    path: 'C:/Users/fuji1/Downloads/indeed-2026-01-13 (1).csv',
    expectedSource: 'indeed',
    hasAnnualHolidays: false
  },
  {
    name: 'Indeed (3)',
    path: 'C:/Users/fuji1/Downloads/indeed-2026-01-13 (2).csv',
    expectedSource: 'indeed',
    hasAnnualHolidays: false
  }
];

console.log('='.repeat(80));
console.log('包括的CSVテスト - 求人ボックス + Indeed 全ファイル検証');
console.log('='.repeat(80));

const allResults = [];

testFiles.forEach((file, fileIndex) => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`【${fileIndex + 1}】${file.name}`);
  console.log(`ファイル: ${file.path}`);
  console.log('─'.repeat(80));

  // ファイル存在確認
  if (!fs.existsSync(file.path)) {
    console.log('❌ ファイルが見つかりません');
    return;
  }

  const csvContent = fs.readFileSync(file.path, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = parseCSVLine(lines[0]);

  console.log(`\n📋 ヘッダー数: ${headers.length}`);
  console.log(`最初の10カラム: ${headers.slice(0, 10).join(', ')}`);

  // データソース判定
  const detectedSource = detectDataSource(headers);
  const sourceMatch = detectedSource === file.expectedSource;
  console.log(`\n🔍 データソース判定:`);
  console.log(`   期待: ${file.expectedSource}`);
  console.log(`   検出: ${detectedSource}`);
  console.log(`   結果: ${sourceMatch ? '✅ 一致' : '❌ 不一致'}`);

  // カラムマッピング解析
  console.log(`\n📊 カラム位置分析:`);

  let salaryColIndex = -1;
  let locationColIndex = -1;
  let titleColIndex = -1;
  let descriptionColIndex = -1;

  if (detectedSource === 'kyujin_box') {
    // 求人ボックス形式
    headers.forEach((h, i) => {
      const header = h.trim();
      if (header === 'p-result_name') titleColIndex = i;
      if (header === 'c-icon' && locationColIndex === -1) locationColIndex = i;
      if (header === 'c-icon (2)') salaryColIndex = i;
      if (header === 'p-result_lines') descriptionColIndex = i;
    });
  } else {
    // Indeed形式 - ヘッダーから推測
    headers.forEach((h, i) => {
      const header = h.trim().toLowerCase();
      // Indeedのcss-xxxクラス名から推測
      if (header.includes('jobtitle') || header === 'jcs-jobtitle') titleColIndex = i;
      // 給与カラムを探す（通常は特定のcssクラス）
    });
  }

  console.log(`   タイトル列: ${titleColIndex >= 0 ? titleColIndex : '未検出'}`);
  console.log(`   勤務地列: ${locationColIndex >= 0 ? locationColIndex : '未検出'}`);
  console.log(`   給与列: ${salaryColIndex >= 0 ? salaryColIndex : '未検出'}`);
  console.log(`   詳細テキスト列: ${descriptionColIndex >= 0 ? descriptionColIndex : '未検出'}`);

  // データ行のサンプル解析
  console.log(`\n📈 データ解析（${lines.length - 1}行）:`);

  let totalRows = 0;
  let salaryExtracted = 0;
  let holidaysExtracted = 0;
  const salaryTypes = { hourly: 0, monthly: 0, annual: 0, daily: 0, null: 0 };
  const monthlyRanges = {
    '0-10万': 0, '10-15万': 0, '15-20万': 0, '20-25万': 0,
    '25-30万': 0, '30-40万': 0, '40-50万': 0, '50万以上': 0
  };
  const salarySamples = [];
  const holidaySamples = [];
  const problematicSalaries = [];

  for (let i = 1; i < Math.min(lines.length, 500); i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    totalRows++;

    const row = parseCSVLine(line);

    // 給与解析
    let salaryText = '';
    if (salaryColIndex >= 0 && row[salaryColIndex]) {
      salaryText = row[salaryColIndex];
    } else {
      // フォールバック: 各カラムから給与っぽいものを探す
      for (const cell of row) {
        if (cell && (cell.includes('月給') || cell.includes('時給') || cell.includes('年収') || cell.includes('万円'))) {
          salaryText = cell;
          break;
        }
      }
    }

    if (salaryText) {
      const salaryResult = parseSalary(salaryText);
      if (salaryResult.unifiedMonthly !== null) {
        salaryExtracted++;
        salaryTypes[salaryResult.salaryType || 'null']++;

        const m = salaryResult.unifiedMonthly;
        if (m < 100000) monthlyRanges['0-10万']++;
        else if (m < 150000) monthlyRanges['10-15万']++;
        else if (m < 200000) monthlyRanges['15-20万']++;
        else if (m < 250000) monthlyRanges['20-25万']++;
        else if (m < 300000) monthlyRanges['25-30万']++;
        else if (m < 400000) monthlyRanges['30-40万']++;
        else if (m < 500000) monthlyRanges['40-50万']++;
        else monthlyRanges['50万以上']++;

        if (salarySamples.length < 5) {
          salarySamples.push({
            text: salaryText.substring(0, 60),
            type: salaryResult.salaryType,
            monthly: salaryResult.unifiedMonthly
          });
        }

        // 問題のある値（0-15万で月給タイプ）
        if (m < 150000 && salaryResult.salaryType === 'monthly') {
          if (problematicSalaries.length < 10) {
            problematicSalaries.push({
              text: salaryText.substring(0, 80),
              type: salaryResult.salaryType,
              monthly: salaryResult.unifiedMonthly
            });
          }
        }
      }
    }

    // 年間休日（求人ボックスのみ）
    if (file.hasAnnualHolidays && descriptionColIndex >= 0) {
      const description = row[descriptionColIndex] || '';
      const holidays = extractAnnualHolidays(description);
      if (holidays !== null) {
        holidaysExtracted++;
        if (holidaySamples.length < 5) {
          holidaySamples.push({ days: holidays, source: 'description' });
        }
      } else {
        // タイトルからのフォールバック
        const title = row[titleColIndex] || '';
        const holidaysFromTitle = extractAnnualHolidays(title);
        if (holidaysFromTitle !== null) {
          holidaysExtracted++;
          if (holidaySamples.length < 5) {
            holidaySamples.push({ days: holidaysFromTitle, source: 'title' });
          }
        }
      }
    }
  }

  console.log(`   処理行数: ${totalRows}`);
  console.log(`   給与抽出成功: ${salaryExtracted} (${Math.round(salaryExtracted/totalRows*100)}%)`);

  if (file.hasAnnualHolidays) {
    console.log(`   年間休日抽出: ${holidaysExtracted} (${Math.round(holidaysExtracted/totalRows*100)}%)`);
  }

  console.log(`\n💰 給与タイプ分布:`);
  Object.entries(salaryTypes).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`   ${type}: ${count}件`);
    }
  });

  console.log(`\n💵 月給換算後の分布:`);
  Object.entries(monthlyRanges).forEach(([range, count]) => {
    if (count > 0) {
      const bar = '█'.repeat(Math.min(30, Math.round(count / 5)));
      console.log(`   ${range.padEnd(10)} ${String(count).padStart(4)}件 ${bar}`);
    }
  });

  if (salarySamples.length > 0) {
    console.log(`\n📝 給与サンプル:`);
    salarySamples.forEach((s, i) => {
      console.log(`   ${i+1}. "${s.text}" → ${s.type} → ${Math.round(s.monthly/10000)}万円`);
    });
  }

  if (problematicSalaries.length > 0) {
    console.log(`\n⚠️ 問題の可能性（月給15万未満でmonthlyタイプ）:`);
    problematicSalaries.forEach((s, i) => {
      console.log(`   ${i+1}. "${s.text}" → ${Math.round(s.monthly/10000)}万円`);
    });
  }

  if (holidaySamples.length > 0) {
    console.log(`\n🏖️ 年間休日サンプル:`);
    holidaySamples.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.days}日 (${s.source}から抽出)`);
    });
  }

  // 結果を保存
  allResults.push({
    name: file.name,
    sourceMatch,
    detectedSource,
    totalRows,
    salaryExtracted,
    salaryRate: Math.round(salaryExtracted/totalRows*100),
    holidaysExtracted,
    holidaysRate: file.hasAnnualHolidays ? Math.round(holidaysExtracted/totalRows*100) : null,
    problematicCount: problematicSalaries.length,
    salaryTypes
  });
});

// サマリー
console.log(`\n${'='.repeat(80)}`);
console.log('📊 全体サマリー');
console.log('='.repeat(80));

console.log('\n| ファイル | データソース | 給与抽出率 | 年間休日 | 問題データ |');
console.log('|----------|-------------|-----------|----------|-----------|');
allResults.forEach(r => {
  const sourceStatus = r.sourceMatch ? '✅' : '❌';
  const holidays = r.holidaysRate !== null ? `${r.holidaysRate}%` : 'N/A';
  const problems = r.problematicCount > 0 ? `⚠️${r.problematicCount}件` : '✅';
  console.log(`| ${r.name.padEnd(12)} | ${sourceStatus} ${r.detectedSource.padEnd(10)} | ${String(r.salaryRate).padStart(3)}% | ${holidays.padStart(8)} | ${problems.padStart(9)} |`);
});

// 最終判定
console.log(`\n${'─'.repeat(80)}`);
const allSourcesOK = allResults.every(r => r.sourceMatch);
const allSalaryOK = allResults.every(r => r.salaryRate > 50);
const noProblems = allResults.every(r => r.problematicCount === 0);

console.log('🎯 最終判定:');
console.log(`   データソース判定: ${allSourcesOK ? '✅ 全て正常' : '❌ 問題あり'}`);
console.log(`   給与抽出: ${allSalaryOK ? '✅ 良好 (50%以上)' : '⚠️ 低抽出率あり'}`);
console.log(`   異常値検出: ${noProblems ? '✅ なし' : '⚠️ 要確認'}`);
console.log('='.repeat(80));
