/**
 * 実データCSVテスト
 * 実際のIndeed CSVデータを使用してパーサーの動作を検証
 */

const fs = require('fs');
const path = require('path');

// ===== パーサー関数（GASコードから移植）=====

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

function normalizeText(text) {
  if (!text) return '';
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

  const normalPattern = /(\d+(?:,\d+)*)\s*円/;
  const normalMatch = text.match(normalPattern);
  if (normalMatch) {
    return parseFloat(normalMatch[1].replace(/,/g, ''));
  }

  return null;
}

function parseSalary(salaryText) {
  if (!salaryText || salaryText === '') {
    return { salaryType: null, minValue: null, maxValue: null, unifiedMonthly: null };
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
        minValue = leftValue;
      }
    }
  }

  if (!hasRange && minValue === null) {
    const singleValue = extractSingleValue(cleanText);
    minValue = singleValue;
    maxValue = singleValue;
  }

  let monthly = null;
  if (minValue !== null) {
    const baseValue = maxValue !== null ? (minValue + maxValue) / 2 : minValue;
    switch (salaryType) {
      case SALARY_TYPES.HOURLY:
        monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.hourly_to_monthly);
        break;
      case SALARY_TYPES.ANNUAL:
        monthly = Math.round(baseValue * SALARY_CONVERSION_RATES.annual_to_monthly);
        break;
      default:
        monthly = Math.round(baseValue);
    }
  }

  return { salaryType, minValue, maxValue, unifiedMonthly: monthly };
}

function parseLocation(locationText) {
  if (!locationText || locationText === '') {
    return { prefecture: null, city: null, isComplete: false };
  }

  const text = locationText.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();

  for (const pref of PREFECTURES) {
    if (text.includes(pref)) {
      const cityMatch = text.match(/([^\s]+[市区町村])/);
      return {
        prefecture: pref,
        city: cityMatch ? cityMatch[1] : null,
        isComplete: true
      };
    }
  }

  return { prefecture: null, city: null, isComplete: false };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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

// ===== テスト実行 =====

class RealDataTestRunner {
  constructor() {
    this.results = {
      totalRecords: 0,
      salaryParsed: 0,
      salaryFailed: 0,
      locationParsed: 0,
      locationFailed: 0,
      samples: {
        salarySuccess: [],
        salaryFail: [],
        locationSuccess: [],
        locationFail: []
      }
    };
  }

  loadCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const record = {};
      headers.forEach((h, idx) => {
        record[h.trim()] = values[idx] || '';
      });
      records.push(record);
    }

    return { headers, records };
  }

  findColumn(headers, patterns) {
    for (const pattern of patterns) {
      const found = headers.find(h => h.includes(pattern));
      if (found) return found;
    }
    return null;
  }

  detectFormat(headers) {
    // Indeed形式
    if (headers.some(h => h.includes('jcs-JobTitle'))) {
      return 'indeed';
    }
    // 求人ボックス形式
    if (headers.some(h => h.includes('p-result_name'))) {
      return 'kyujinbox';
    }
    return 'unknown';
  }

  testIndeedData(filePath) {
    console.log(`\n===== 実データテスト: ${path.basename(filePath)} =====\n`);

    const { headers, records } = this.loadCSV(filePath);
    console.log(`ヘッダー数: ${headers.length}`);
    console.log(`レコード数: ${records.length}`);

    const format = this.detectFormat(headers);
    console.log(`フォーマット: ${format}`);

    let titleCol, companyCol, locationCol, salaryCol, empTypeCol;

    if (format === 'indeed') {
      // Indeed形式のカラムマッピング
      titleCol = this.findColumn(headers, ['jcs-JobTitle']);
      companyCol = this.findColumn(headers, ['css-19eicqx']);
      locationCol = this.findColumn(headers, ['css-1f06pz4']);
      salaryCol = this.findColumn(headers, ['mosaic-provider-jobcards-1f1q1js']);
      empTypeCol = this.findColumn(headers, ['mosaic-provider-jobcards-1f1q1js (2)']);
    } else if (format === 'kyujinbox') {
      // 求人ボックス形式のカラムマッピング（インデックスベース）
      titleCol = 'p-result_name';
      locationCol = headers[2]; // 3番目のカラム（勤務地）
      salaryCol = headers[3];   // 4番目のカラム（給与）
      companyCol = this.findColumn(headers, ['p-result_company']);
    } else {
      console.log('⚠️ 未知のCSVフォーマット');
    }

    console.log(`\nカラムマッピング:`);
    console.log(`  職種: ${titleCol || '不明'}`);
    console.log(`  会社名: ${companyCol || '不明'}`);
    console.log(`  勤務地: ${locationCol || '不明'}`);
    console.log(`  給与: ${salaryCol || '不明'}`);
    console.log(`  雇用形態: ${empTypeCol || '不明'}`);

    // 各レコードをテスト
    records.forEach((record, idx) => {
      this.results.totalRecords++;

      // 給与テスト
      const salaryText = record[salaryCol] || '';
      const salaryResult = parseSalary(salaryText);

      if (salaryResult.unifiedMonthly !== null) {
        this.results.salaryParsed++;
        if (this.results.samples.salarySuccess.length < 5) {
          this.results.samples.salarySuccess.push({
            input: salaryText,
            result: salaryResult
          });
        }
      } else if (salaryText) {
        this.results.salaryFailed++;
        if (this.results.samples.salaryFail.length < 10) {
          this.results.samples.salaryFail.push({
            input: salaryText,
            result: salaryResult
          });
        }
      }

      // 勤務地テスト
      const locationText = record[locationCol] || '';
      const locationResult = parseLocation(locationText);

      if (locationResult.isComplete) {
        this.results.locationParsed++;
        if (this.results.samples.locationSuccess.length < 5) {
          this.results.samples.locationSuccess.push({
            input: locationText,
            result: locationResult
          });
        }
      } else if (locationText) {
        this.results.locationFailed++;
        if (this.results.samples.locationFail.length < 10) {
          this.results.samples.locationFail.push({
            input: locationText,
            result: locationResult
          });
        }
      }
    });

    this.printResults();
  }

  printResults() {
    console.log(`\n===== テスト結果 =====\n`);
    console.log(`総レコード数: ${this.results.totalRecords}`);

    const salaryTotal = this.results.salaryParsed + this.results.salaryFailed;
    const salaryRate = salaryTotal > 0 ? (this.results.salaryParsed / salaryTotal * 100).toFixed(2) : 0;
    console.log(`\n給与パース:`);
    console.log(`  成功: ${this.results.salaryParsed}`);
    console.log(`  失敗: ${this.results.salaryFailed}`);
    console.log(`  成功率: ${salaryRate}%`);

    const locTotal = this.results.locationParsed + this.results.locationFailed;
    const locRate = locTotal > 0 ? (this.results.locationParsed / locTotal * 100).toFixed(2) : 0;
    console.log(`\n勤務地パース:`);
    console.log(`  成功: ${this.results.locationParsed}`);
    console.log(`  失敗: ${this.results.locationFailed}`);
    console.log(`  成功率: ${locRate}%`);

    if (this.results.samples.salarySuccess.length > 0) {
      console.log(`\n===== 給与パース成功例 =====`);
      this.results.samples.salarySuccess.forEach((s, i) => {
        console.log(`${i + 1}. "${s.input}" → ${s.result.unifiedMonthly ? s.result.unifiedMonthly.toLocaleString() + '円/月' : 'null'}`);
      });
    }

    if (this.results.samples.salaryFail.length > 0) {
      console.log(`\n===== 給与パース失敗例 =====`);
      this.results.samples.salaryFail.forEach((s, i) => {
        console.log(`${i + 1}. "${s.input}"`);
      });
    }

    if (this.results.samples.locationSuccess.length > 0) {
      console.log(`\n===== 勤務地パース成功例 =====`);
      this.results.samples.locationSuccess.forEach((s, i) => {
        console.log(`${i + 1}. "${s.input}" → ${s.result.prefecture} ${s.result.city || ''}`);
      });
    }

    if (this.results.samples.locationFail.length > 0) {
      console.log(`\n===== 勤務地パース失敗例 =====`);
      this.results.samples.locationFail.forEach((s, i) => {
        console.log(`${i + 1}. "${s.input}"`);
      });
    }

    // 判定
    console.log(`\n===== 最終判定 =====`);
    const overallSalaryRate = parseFloat(salaryRate);
    const overallLocRate = parseFloat(locRate);

    if (overallSalaryRate >= 80 && overallLocRate >= 80) {
      console.log(`✅ 合格: 実データでの動作確認OK`);
    } else {
      console.log(`⚠️ 要改善:`);
      if (overallSalaryRate < 80) console.log(`  - 給与パース率が低い: ${salaryRate}%`);
      if (overallLocRate < 80) console.log(`  - 勤務地パース率が低い: ${locRate}%`);
    }

    return {
      salaryRate: overallSalaryRate,
      locationRate: overallLocRate,
      passed: overallSalaryRate >= 80 && overallLocRate >= 80
    };
  }
}

// 実行
if (require.main === module) {
  // 利用可能なCSVファイルをテスト（全ファイル）
  const csvFiles = [
    // 求人ボックス
    'C:\\Users\\fuji1\\Downloads\\豊中市　薬剤師.csv',
    // Indeed
    'C:\\Users\\fuji1\\Downloads\\indeed-2026-01-13.csv',
    'C:\\Users\\fuji1\\Downloads\\indeed-2026-01-10 (1).csv',
    'C:\\Users\\fuji1\\Downloads\\indeed-2026-01-09.csv',
    'C:\\Users\\fuji1\\Downloads\\indeed-2025-12-23.csv'
  ];

  const allResults = {
    totalRecords: 0,
    salaryParsed: 0,
    salaryFailed: 0,
    locationParsed: 0,
    locationFailed: 0,
    filesTested: 0
  };

  for (const file of csvFiles) {
    try {
      if (fs.existsSync(file)) {
        const runner = new RealDataTestRunner();
        runner.testIndeedData(file);

        allResults.totalRecords += runner.results.totalRecords;
        allResults.salaryParsed += runner.results.salaryParsed;
        allResults.salaryFailed += runner.results.salaryFailed;
        allResults.locationParsed += runner.results.locationParsed;
        allResults.locationFailed += runner.results.locationFailed;
        allResults.filesTested++;
      }
    } catch (e) {
      console.log(`エラー: ${file} - ${e.message}`);
    }
  }

  // 全体集計
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 全CSVファイル総合結果');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`テスト済みファイル数: ${allResults.filesTested}`);
  console.log(`総レコード数: ${allResults.totalRecords}`);

  const salaryTotal = allResults.salaryParsed + allResults.salaryFailed;
  const salaryRate = salaryTotal > 0 ? (allResults.salaryParsed / salaryTotal * 100).toFixed(2) : 0;
  console.log(`\n給与パース総合: ${allResults.salaryParsed}/${salaryTotal} (${salaryRate}%)`);

  const locTotal = allResults.locationParsed + allResults.locationFailed;
  const locRate = locTotal > 0 ? (allResults.locationParsed / locTotal * 100).toFixed(2) : 0;
  console.log(`勤務地パース総合: ${allResults.locationParsed}/${locTotal} (${locRate}%)`);

  if (parseFloat(salaryRate) >= 80 && parseFloat(locRate) >= 80) {
    console.log('\n✅ 全体判定: 合格（実データ検証成功）');
  } else {
    console.log('\n⚠️ 全体判定: 要改善');
  }
}

module.exports = { RealDataTestRunner, parseSalary, parseLocation };
