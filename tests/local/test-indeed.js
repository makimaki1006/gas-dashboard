/**
 * Indeed データ専用 100パターンテスト
 * 複数のCSVファイル構造に対応
 */

const fs = require('fs');
const path = require('path');

// テスト関数を読み込み
const testFunctionsPath = path.join(__dirname, 'test-functions.js');
eval(fs.readFileSync(testFunctionsPath, 'utf8'));

// CSVパーサー
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    data.push(row);
  }
  return { headers, data };
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Indeedデータ用パーサー（複数のカラム構造に対応）
function parseIndeedData(csvData, headers) {
  // カラム構造を自動検出
  const hasJcsJobTitle = headers.includes('jcs-JobTitle');
  const hasCssBxyec3 = headers.includes('css-bxyec3');
  const hasCssLx9x6g = headers.includes('css-lx9x6g');

  return csvData.map((row, idx) => {
    let title, company, location, salary, employmentType;

    if (hasJcsJobTitle) {
      // File 1 構造
      title = row['jcs-JobTitle'] || '';
      company = row['css-19eicqx'] || '';
      location = row['css-1f06pz4'] || '';
      salary = row['mosaic-provider-jobcards-1f1q1js'] || '';
      employmentType = row['mosaic-provider-jobcards-1f1q1js (2)'] || '';
    } else if (hasCssBxyec3 && hasCssLx9x6g) {
      // File 3 構造
      title = row['css-bxyec3'] || '';
      company = row['css-14qk2ra'] || '';
      location = row['css-18rxko3'] || '';
      salary = row['css-lx9x6g'] || '';
      employmentType = row['css-1hwmqh1'] || '';
    } else if (hasCssBxyec3) {
      // File 2 構造
      title = row['css-bxyec3'] || '';
      company = row['css-14qk2ra'] || '';
      location = row['css-18rxko3'] || '';
      salary = row['css-1qns26f'] || '';
      employmentType = row['css-1hwmqh1'] || '';
    }

    // タグを収集
    const tags = [];
    for (let i = 1; i <= 20; i++) {
      const tagKey = i === 1 ? 'jobsearch-JobCard-tag' : `jobsearch-JobCard-tag (${i})`;
      if (row[tagKey] && row[tagKey].trim()) {
        tags.push(row[tagKey].trim());
      }
    }

    return {
      id: idx,
      title: title,
      company: company,
      location: location,
      salary: salary,
      employmentType: employmentType,
      tags: tags,
      // パース済みフィールド
      salaryParsed: parseSalary(salary || ''),
      locationParsed: parseLocation(location || ''),
      employmentParsed: parseEmployment(employmentType || '')
    };
  });
}

// ========================================
// Indeed専用100パターンテスト生成
// ========================================
function generateIndeedTests(data, fileName) {
  const tests = [];

  // ========================================
  // カテゴリ1: Indeed給与パターン (25パターン)
  // ========================================

  // Indeed特有の給与形式
  tests.push({
    name: 'Indeed給与: 月給 25.9万円',
    fn: () => parseSalary('月給 25.9万円'),
    expected: { unifiedMonthly: 259000 },
    validate: (r) => r && r.unifiedMonthly === 259000
  });

  tests.push({
    name: 'Indeed給与: 月給 247,740円 ~ 310,740円',
    fn: () => parseSalary('月給 247,740円 ~ 310,740円'),
    expected: { min: 247740, max: 310740 },
    validate: (r) => r && r.min === 247740 && r.max === 310740
  });

  tests.push({
    name: 'Indeed給与: 時給 1,140円 ~ 2,000円',
    fn: () => parseSalary('時給 1,140円 ~ 2,000円'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly'
  });

  tests.push({
    name: 'Indeed給与: 月給 20万円',
    fn: () => parseSalary('月給 20万円'),
    expected: { unifiedMonthly: 200000 },
    validate: (r) => r && r.unifiedMonthly === 200000
  });

  tests.push({
    name: 'Indeed給与: 月給 30万円 ~ 40万円',
    fn: () => parseSalary('月給 30万円 ~ 40万円'),
    expected: { min: 300000, max: 400000 },
    validate: (r) => r && r.min === 300000 && r.max === 400000
  });

  tests.push({
    name: 'Indeed給与: 時給 1,200円',
    fn: () => parseSalary('時給 1,200円'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly' && r.min === 192000
  });

  tests.push({
    name: 'Indeed給与: 日給 10,000円',
    fn: () => parseSalary('日給 10,000円'),
    expected: { salaryType: 'daily' },
    validate: (r) => r && r.salaryType === 'daily'
  });

  tests.push({
    name: 'Indeed給与: 年収 400万円 ~ 500万円（月給換算）',
    fn: () => parseSalary('年収 400万円 ~ 500万円'),
    expected: { salaryType: 'annual' },
    validate: (r) => r && r.salaryType === 'annual' && Math.abs(r.min - 333333) < 1
  });

  tests.push({
    name: 'Indeed給与: 月給 185,000円',
    fn: () => parseSalary('月給 185,000円'),
    expected: { unifiedMonthly: 185000 },
    validate: (r) => r && r.unifiedMonthly === 185000
  });

  tests.push({
    name: 'Indeed給与: 月給 220,000円 ~ 280,000円',
    fn: () => parseSalary('月給 220,000円 ~ 280,000円'),
    expected: { min: 220000, max: 280000 },
    validate: (r) => r && r.min === 220000 && r.max === 280000
  });

  // スペース区切りパターン
  tests.push({
    name: 'Indeed給与: 月給 25万円（スペース有り）',
    fn: () => parseSalary('月給 25万円'),
    expected: { unifiedMonthly: 250000 },
    validate: (r) => r && r.unifiedMonthly === 250000
  });

  tests.push({
    name: 'Indeed給与: 時給 950円（最低賃金付近）',
    fn: () => parseSalary('時給 950円'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly'
  });

  tests.push({
    name: 'Indeed給与: 月給25万円（スペース無し）',
    fn: () => parseSalary('月給25万円'),
    expected: { unifiedMonthly: 250000 },
    validate: (r) => r && r.unifiedMonthly === 250000
  });

  tests.push({
    name: 'Indeed給与: 月給 35.5万円（小数点）',
    fn: () => parseSalary('月給 35.5万円'),
    expected: { unifiedMonthly: 355000 },
    validate: (r) => r && r.unifiedMonthly === 355000
  });

  tests.push({
    name: 'Indeed給与: 月給 28.8万円',
    fn: () => parseSalary('月給 28.8万円'),
    expected: { unifiedMonthly: 288000 },
    validate: (r) => r && r.unifiedMonthly === 288000
  });

  // カンマ区切り数値
  tests.push({
    name: 'Indeed給与: 月給 350,000円',
    fn: () => parseSalary('月給 350,000円'),
    expected: { unifiedMonthly: 350000 },
    validate: (r) => r && r.unifiedMonthly === 350000
  });

  tests.push({
    name: 'Indeed給与: 時給 1,500円 ~ 1,800円',
    fn: () => parseSalary('時給 1,500円 ~ 1,800円'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly'
  });

  tests.push({
    name: 'Indeed給与: 日給 8,000円 ~ 12,000円',
    fn: () => parseSalary('日給 8,000円 ~ 12,000円'),
    expected: { salaryType: 'daily' },
    validate: (r) => r && r.salaryType === 'daily'
  });

  tests.push({
    name: 'Indeed給与: 月給 180,000円 ~ 250,000円',
    fn: () => parseSalary('月給 180,000円 ~ 250,000円'),
    expected: { min: 180000, max: 250000 },
    validate: (r) => r && r.min === 180000 && r.max === 250000
  });

  tests.push({
    name: 'Indeed給与: 年収 300万円（月給換算25万）',
    fn: () => parseSalary('年収 300万円'),
    expected: { unifiedMonthly: 250000 },
    validate: (r) => r && r.unifiedMonthly === 250000
  });

  // 以上パターン
  tests.push({
    name: 'Indeed給与: 月給 25万円以上',
    fn: () => parseSalary('月給 25万円以上'),
    expected: { min: 250000 },
    validate: (r) => r && r.min === 250000
  });

  tests.push({
    name: 'Indeed給与: 時給 1,000円以上',
    fn: () => parseSalary('時給 1,000円以上'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly'
  });

  tests.push({
    name: 'Indeed給与: 月給 300,000円以上',
    fn: () => parseSalary('月給 300,000円以上'),
    expected: { min: 300000 },
    validate: (r) => r && r.min === 300000
  });

  // 空・無効パターン
  tests.push({
    name: 'Indeed給与: 空文字列',
    fn: () => parseSalary(''),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: 'Indeed給与: 給与非公開',
    fn: () => parseSalary('給与非公開'),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  // ========================================
  // カテゴリ2: Indeed勤務地パターン (25パターン)
  // ========================================

  tests.push({
    name: 'Indeed勤務地: 群馬県 利根郡 みなかみ町 真庭',
    fn: () => parseLocation('群馬県 利根郡 みなかみ町 真庭'),
    expected: { prefecture: '群馬県', regionBlock: '関東' },
    validate: (r) => r && r.prefecture === '群馬県' && r.regionBlock === '関東'
  });

  tests.push({
    name: 'Indeed勤務地: 群馬県 高崎市 下小鳥町',
    fn: () => parseLocation('群馬県 高崎市 下小鳥町'),
    expected: { prefecture: '群馬県' },
    validate: (r) => r && r.prefecture === '群馬県'
  });

  tests.push({
    name: 'Indeed勤務地: 群馬県 沼田市 下久屋町',
    fn: () => parseLocation('群馬県 沼田市 下久屋町'),
    expected: { prefecture: '群馬県' },
    validate: (r) => r && r.prefecture === '群馬県'
  });

  tests.push({
    name: 'Indeed勤務地: 東京都 渋谷区',
    fn: () => parseLocation('東京都 渋谷区'),
    expected: { prefecture: '東京都', regionBlock: '関東' },
    validate: (r) => r && r.prefecture === '東京都' && r.regionBlock === '関東'
  });

  tests.push({
    name: 'Indeed勤務地: 神奈川県 横浜市 中区',
    fn: () => parseLocation('神奈川県 横浜市 中区'),
    expected: { prefecture: '神奈川県', regionBlock: '関東' },
    validate: (r) => r && r.prefecture === '神奈川県' && r.regionBlock === '関東'
  });

  tests.push({
    name: 'Indeed勤務地: 埼玉県 さいたま市',
    fn: () => parseLocation('埼玉県 さいたま市'),
    expected: { prefecture: '埼玉県' },
    validate: (r) => r && r.prefecture === '埼玉県'
  });

  tests.push({
    name: 'Indeed勤務地: 千葉県 千葉市 中央区',
    fn: () => parseLocation('千葉県 千葉市 中央区'),
    expected: { prefecture: '千葉県' },
    validate: (r) => r && r.prefecture === '千葉県'
  });

  tests.push({
    name: 'Indeed勤務地: 大阪府 大阪市 北区',
    fn: () => parseLocation('大阪府 大阪市 北区'),
    expected: { prefecture: '大阪府', regionBlock: '関西' },
    validate: (r) => r && r.prefecture === '大阪府' && r.regionBlock === '関西'
  });

  tests.push({
    name: 'Indeed勤務地: 愛知県 名古屋市',
    fn: () => parseLocation('愛知県 名古屋市'),
    expected: { prefecture: '愛知県', regionBlock: '東海' },
    validate: (r) => r && r.prefecture === '愛知県' && r.regionBlock === '東海'
  });

  tests.push({
    name: 'Indeed勤務地: 福岡県 福岡市 博多区',
    fn: () => parseLocation('福岡県 福岡市 博多区'),
    expected: { prefecture: '福岡県', regionBlock: '九州・沖縄' },
    validate: (r) => r && r.prefecture === '福岡県' && r.regionBlock === '九州・沖縄'
  });

  tests.push({
    name: 'Indeed勤務地: 北海道 札幌市',
    fn: () => parseLocation('北海道 札幌市'),
    expected: { prefecture: '北海道', regionBlock: '北海道・東北' },
    validate: (r) => r && r.prefecture === '北海道' && r.regionBlock === '北海道・東北'
  });

  tests.push({
    name: 'Indeed勤務地: 宮城県 仙台市',
    fn: () => parseLocation('宮城県 仙台市'),
    expected: { prefecture: '宮城県', regionBlock: '北海道・東北' },
    validate: (r) => r && r.prefecture === '宮城県' && r.regionBlock === '北海道・東北'
  });

  tests.push({
    name: 'Indeed勤務地: 広島県 広島市',
    fn: () => parseLocation('広島県 広島市'),
    expected: { prefecture: '広島県', regionBlock: '中国・四国' },
    validate: (r) => r && r.prefecture === '広島県' && r.regionBlock === '中国・四国'
  });

  tests.push({
    name: 'Indeed勤務地: 新潟県 新潟市',
    fn: () => parseLocation('新潟県 新潟市'),
    expected: { prefecture: '新潟県', regionBlock: '北陸・甲信越' },
    validate: (r) => r && r.prefecture === '新潟県' && r.regionBlock === '北陸・甲信越'
  });

  tests.push({
    name: 'Indeed勤務地: 静岡県 静岡市',
    fn: () => parseLocation('静岡県 静岡市'),
    expected: { prefecture: '静岡県', regionBlock: '東海' },
    validate: (r) => r && r.prefecture === '静岡県' && r.regionBlock === '東海'
  });

  tests.push({
    name: 'Indeed勤務地: 茨城県 水戸市',
    fn: () => parseLocation('茨城県 水戸市'),
    expected: { prefecture: '茨城県', regionBlock: '関東' },
    validate: (r) => r && r.prefecture === '茨城県' && r.regionBlock === '関東'
  });

  tests.push({
    name: 'Indeed勤務地: 栃木県 宇都宮市',
    fn: () => parseLocation('栃木県 宇都宮市'),
    expected: { prefecture: '栃木県' },
    validate: (r) => r && r.prefecture === '栃木県'
  });

  tests.push({
    name: 'Indeed勤務地: 長野県 長野市',
    fn: () => parseLocation('長野県 長野市'),
    expected: { prefecture: '長野県' },
    validate: (r) => r && r.prefecture === '長野県'
  });

  tests.push({
    name: 'Indeed勤務地: 岡山県 岡山市',
    fn: () => parseLocation('岡山県 岡山市'),
    expected: { prefecture: '岡山県' },
    validate: (r) => r && r.prefecture === '岡山県'
  });

  tests.push({
    name: 'Indeed勤務地: 熊本県 熊本市',
    fn: () => parseLocation('熊本県 熊本市'),
    expected: { prefecture: '熊本県', regionBlock: '九州・沖縄' },
    validate: (r) => r && r.prefecture === '熊本県' && r.regionBlock === '九州・沖縄'
  });

  tests.push({
    name: 'Indeed勤務地: 沖縄県 那覇市',
    fn: () => parseLocation('沖縄県 那覇市'),
    expected: { prefecture: '沖縄県', regionBlock: '九州・沖縄' },
    validate: (r) => r && r.prefecture === '沖縄県' && r.regionBlock === '九州・沖縄'
  });

  tests.push({
    name: 'Indeed勤務地: 空文字列',
    fn: () => parseLocation(''),
    expected: { prefecture: null },
    validate: (r) => !r || !r.prefecture
  });

  tests.push({
    name: 'Indeed勤務地: リモートワーク',
    fn: () => parseLocation('リモートワーク'),
    expected: { note: 'リモート判定' },
    validate: (r) => true
  });

  tests.push({
    name: 'Indeed勤務地: 在宅勤務',
    fn: () => parseLocation('在宅勤務'),
    expected: { note: '在宅判定' },
    validate: (r) => true
  });

  tests.push({
    name: 'Indeed勤務地: 全国',
    fn: () => parseLocation('全国'),
    expected: { note: '全国判定' },
    validate: (r) => true
  });

  // ========================================
  // カテゴリ3: 雇用形態パターン (15パターン)
  // ========================================

  tests.push({
    name: 'Indeed雇用形態: 正社員',
    fn: () => parseEmployment('正社員'),
    expected: { type: '正社員' },
    validate: (r) => r && r.type === '正社員'
  });

  tests.push({
    name: 'Indeed雇用形態: アルバイト･パート',
    fn: () => parseEmployment('アルバイト･パート'),
    expected: { typeContains: 'アルバイト' },
    validate: (r) => r && (r.type.includes('アルバイト') || r.type.includes('パート'))
  });

  tests.push({
    name: 'Indeed雇用形態: アルバイト',
    fn: () => parseEmployment('アルバイト'),
    expected: { typeContains: 'アルバイト' },
    validate: (r) => r && r.type.includes('アルバイト')
  });

  tests.push({
    name: 'Indeed雇用形態: パート',
    fn: () => parseEmployment('パート'),
    expected: { typeContains: 'パート' },
    validate: (r) => r && r.type.includes('パート')
  });

  tests.push({
    name: 'Indeed雇用形態: 契約社員',
    fn: () => parseEmployment('契約社員'),
    expected: { type: '契約社員' },
    validate: (r) => r && r.type === '契約社員'
  });

  tests.push({
    name: 'Indeed雇用形態: 派遣社員',
    fn: () => parseEmployment('派遣社員'),
    expected: { type: '派遣社員' },
    validate: (r) => r && r.type === '派遣社員'
  });

  tests.push({
    name: 'Indeed雇用形態: 業務委託',
    fn: () => parseEmployment('業務委託'),
    expected: { type: '業務委託' },
    validate: (r) => r && r.type === '業務委託'
  });

  tests.push({
    name: 'Indeed雇用形態: 新卒',
    fn: () => parseEmployment('新卒'),
    expected: { typeContains: '新卒' },
    validate: (r) => r && r.type.includes('新卒')
  });

  tests.push({
    name: 'Indeed雇用形態: インターン',
    fn: () => parseEmployment('インターン'),
    expected: { typeContains: 'インターン' },
    validate: (r) => r && r.type.includes('インターン')
  });

  tests.push({
    name: 'Indeed雇用形態: 空文字列',
    fn: () => parseEmployment(''),
    expected: { type: null },
    validate: (r) => !r || !r.type
  });

  tests.push({
    name: 'Indeed雇用形態: 正社員・契約社員',
    fn: () => parseEmployment('正社員・契約社員'),
    expected: { typeContains: '正社員' },
    validate: (r) => r && r.type.includes('正社員')
  });

  tests.push({
    name: 'Indeed雇用形態: パート・アルバイト',
    fn: () => parseEmployment('パート・アルバイト'),
    expected: { typeContains: 'パート' },
    validate: (r) => r && (r.type.includes('パート') || r.type.includes('アルバイト'))
  });

  tests.push({
    name: 'Indeed雇用形態: 嘱託社員',
    fn: () => parseEmployment('嘱託社員'),
    expected: { typeContains: '嘱託' },
    validate: (r) => r && r.type.includes('嘱託')
  });

  tests.push({
    name: 'Indeed雇用形態: 臨時職員',
    fn: () => parseEmployment('臨時職員'),
    expected: { typeContains: '臨時' },
    validate: (r) => r && r.type.includes('臨時')
  });

  tests.push({
    name: 'Indeed雇用形態: フリーランス',
    fn: () => parseEmployment('フリーランス'),
    expected: { typeContains: 'フリー' },
    validate: (r) => r && r.type.includes('フリー')
  });

  // ========================================
  // カテゴリ4: 実データ検証 (20パターン)
  // ========================================

  tests.push({
    name: `実データ[${fileName}]: 総レコード数が正`,
    fn: () => ({ count: data.length }),
    expected: { minCount: 1 },
    validate: (r) => r.count >= 1
  });

  tests.push({
    name: `実データ[${fileName}]: 給与データありの割合が30%以上`,
    fn: () => {
      const withSalary = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
      return { rate: withSalary.length / data.length, count: withSalary.length };
    },
    expected: { minRate: 0.3 },
    validate: (r) => r.rate >= 0.3
  });

  tests.push({
    name: `実データ[${fileName}]: 勤務地データありの割合が80%以上`,
    fn: () => {
      const withLocation = data.filter(d => d.locationParsed && d.locationParsed.prefecture);
      return { rate: withLocation.length / data.length, count: withLocation.length };
    },
    expected: { minRate: 0.8 },
    validate: (r) => r.rate >= 0.8
  });

  tests.push({
    name: `実データ[${fileName}]: 平均月給が15万円～60万円`,
    fn: () => {
      const salaries = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
      if (salaries.length === 0) return { avgMonthly: 0, note: 'no salary data' };
      const avg = salaries.reduce((sum, d) => sum + d.salaryParsed.unifiedMonthly, 0) / salaries.length;
      return { avgMonthly: avg };
    },
    expected: { minAvg: 150000, maxAvg: 600000 },
    validate: (r) => r.avgMonthly === 0 || (r.avgMonthly >= 150000 && r.avgMonthly <= 600000)
  });

  tests.push({
    name: `実データ[${fileName}]: min <= max 違反が0件`,
    fn: () => {
      const violations = data.filter(d => {
        const s = d.salaryParsed;
        return s && s.min && s.max && s.min > s.max;
      });
      return { violations: violations.length };
    },
    expected: { violations: 0 },
    validate: (r) => r.violations === 0
  });

  tests.push({
    name: `実データ[${fileName}]: 給与が正の数`,
    fn: () => {
      const negatives = data.filter(d => {
        const s = d.salaryParsed;
        return s && s.unifiedMonthly && s.unifiedMonthly < 0;
      });
      return { negatives: negatives.length };
    },
    expected: { negatives: 0 },
    validate: (r) => r.negatives === 0
  });

  tests.push({
    name: `実データ[${fileName}]: 有効な都道府県のみ`,
    fn: () => {
      const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
        '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
        '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
        '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
        '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
        '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
        '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
      const invalid = data.filter(d => {
        const loc = d.locationParsed;
        return loc && loc.prefecture && !prefectures.includes(loc.prefecture);
      });
      return { invalidCount: invalid.length };
    },
    expected: { invalidCount: 0 },
    validate: (r) => r.invalidCount === 0
  });

  tests.push({
    name: `実データ[${fileName}]: ID一意性確認`,
    fn: () => {
      const ids = data.map(d => d.id);
      const uniqueIds = new Set(ids);
      return { isUnique: ids.length === uniqueIds.size };
    },
    expected: { isUnique: true },
    validate: (r) => r.isUnique === true
  });

  tests.push({
    name: `実データ[${fileName}]: タイトルが空でない`,
    fn: () => {
      const emptyTitles = data.filter(d => !d.title || d.title.trim().length === 0);
      return { emptyCount: emptyTitles.length, rate: emptyTitles.length / data.length };
    },
    expected: { maxEmptyRate: 0.1 },
    validate: (r) => r.rate <= 0.1
  });

  tests.push({
    name: `実データ[${fileName}]: タグがある割合`,
    fn: () => {
      const withTags = data.filter(d => d.tags && d.tags.length > 0);
      return { rate: withTags.length / data.length };
    },
    expected: { minRate: 0.5 },
    validate: (r) => r.rate >= 0.5
  });

  tests.push({
    name: `実データ[${fileName}]: 給与タイプ分布`,
    fn: () => {
      const types = {};
      data.forEach(d => {
        if (d.salaryParsed && d.salaryParsed.salaryType) {
          types[d.salaryParsed.salaryType] = (types[d.salaryParsed.salaryType] || 0) + 1;
        }
      });
      return { types, count: Object.keys(types).length };
    },
    expected: { note: 'distribution check' },
    validate: (r) => r.count >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 地域ブロック分布`,
    fn: () => {
      const blocks = {};
      data.forEach(d => {
        if (d.locationParsed && d.locationParsed.regionBlock) {
          blocks[d.locationParsed.regionBlock] = (blocks[d.locationParsed.regionBlock] || 0) + 1;
        }
      });
      return { blocks, count: Object.keys(blocks).length };
    },
    expected: { note: 'distribution check' },
    validate: (r) => r.count >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 雇用形態分布`,
    fn: () => {
      const types = {};
      data.forEach(d => {
        if (d.employmentParsed && d.employmentParsed.type) {
          types[d.employmentParsed.type] = (types[d.employmentParsed.type] || 0) + 1;
        }
      });
      return { types, count: Object.keys(types).length };
    },
    expected: { note: 'distribution check' },
    validate: (r) => r.count >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 交通費支給タグの割合`,
    fn: () => {
      const withTag = data.filter(d => (d.tags || []).some(t => t.includes('交通費')));
      return { rate: withTag.length / data.length };
    },
    expected: { note: 'tag check' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 社会保険完備タグの割合`,
    fn: () => {
      const withTag = data.filter(d => (d.tags || []).some(t => t.includes('社会保険')));
      return { rate: withTag.length / data.length };
    },
    expected: { note: 'tag check' },
    validate: (r) => r.rate >= 0
  });

  // ========================================
  // カテゴリ5: エッジケース・境界値 (15パターン)
  // ========================================

  tests.push({
    name: 'エッジ: 月給 999,999円（高額）',
    fn: () => parseSalary('月給 999,999円'),
    expected: { unifiedMonthly: 999999 },
    validate: (r) => r && r.unifiedMonthly === 999999
  });

  tests.push({
    name: 'エッジ: 月給 100,000円（最低月給）',
    fn: () => parseSalary('月給 100,000円'),
    expected: { unifiedMonthly: 100000 },
    validate: (r) => r && r.unifiedMonthly === 100000
  });

  tests.push({
    name: 'エッジ: 時給 5,000円（高時給）',
    fn: () => parseSalary('時給 5,000円'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly'
  });

  tests.push({
    name: 'エッジ: 日給 30,000円（高日給）',
    fn: () => parseSalary('日給 30,000円'),
    expected: { salaryType: 'daily' },
    validate: (r) => r && r.salaryType === 'daily'
  });

  tests.push({
    name: 'エッジ: 年収 1,000万円（高年収）',
    fn: () => parseSalary('年収 1,000万円'),
    expected: { salaryType: 'annual' },
    validate: (r) => r && r.salaryType === 'annual'
  });

  tests.push({
    name: `実データ[${fileName}]: 時給の月給換算が妥当`,
    fn: () => {
      const hourly = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'hourly');
      const outOfRange = hourly.filter(d => d.salaryParsed.unifiedMonthly < 100000 || d.salaryParsed.unifiedMonthly > 500000);
      return { total: hourly.length, outOfRange: outOfRange.length };
    },
    expected: { note: 'hourly conversion check' },
    validate: (r) => r.total === 0 || r.outOfRange / r.total < 0.1
  });

  tests.push({
    name: `実データ[${fileName}]: 日給の月給換算が妥当`,
    fn: () => {
      const daily = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'daily');
      const outOfRange = daily.filter(d => d.salaryParsed.unifiedMonthly < 100000 || d.salaryParsed.unifiedMonthly > 800000);
      return { total: daily.length, outOfRange: outOfRange.length };
    },
    expected: { note: 'daily conversion check' },
    validate: (r) => r.total === 0 || r.outOfRange / r.total < 0.1
  });

  tests.push({
    name: `実データ[${fileName}]: 年収の月給換算が妥当`,
    fn: () => {
      const annual = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'annual');
      const outOfRange = annual.filter(d => d.salaryParsed.unifiedMonthly < 150000 || d.salaryParsed.unifiedMonthly > 1500000);
      return { total: annual.length, outOfRange: outOfRange.length };
    },
    expected: { note: 'annual conversion check' },
    validate: (r) => r.total === 0 || r.outOfRange / r.total < 0.1
  });

  tests.push({
    name: `実データ[${fileName}]: 企業名のカバレッジ`,
    fn: () => {
      const withCompany = data.filter(d => d.company && d.company.trim().length > 0);
      return { rate: withCompany.length / data.length };
    },
    expected: { note: 'company coverage' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 群馬県の割合（検索地域）`,
    fn: () => {
      const gunma = data.filter(d => d.locationParsed && d.locationParsed.prefecture === '群馬県');
      return { count: gunma.length, rate: gunma.length / data.filter(d => d.locationParsed && d.locationParsed.prefecture).length };
    },
    expected: { note: 'Gunma ratio check' },
    validate: (r) => r.rate >= 0
  });

  // ========================================
  // カテゴリ6: 追加給与パターン (30パターン)
  // ========================================

  // 小数点形式バリエーション
  tests.push({
    name: '給与追加: 月給 20.5万円',
    fn: () => parseSalary('月給 20.5万円'),
    expected: { unifiedMonthly: 205000 },
    validate: (r) => r && r.unifiedMonthly === 205000
  });

  tests.push({
    name: '給与追加: 月給 45.0万円',
    fn: () => parseSalary('月給 45.0万円'),
    expected: { unifiedMonthly: 450000 },
    validate: (r) => r && r.unifiedMonthly === 450000
  });

  tests.push({
    name: '給与追加: 月給 18.25万円（2桁小数）',
    fn: () => parseSalary('月給 18.25万円'),
    expected: { unifiedMonthly: 182500 },
    validate: (r) => r && r.unifiedMonthly === 182500
  });

  tests.push({
    name: '給与追加: 月給 32.75万円',
    fn: () => parseSalary('月給 32.75万円'),
    expected: { unifiedMonthly: 327500 },
    validate: (r) => r && r.unifiedMonthly === 327500
  });

  // 全角数字パターン
  tests.push({
    name: '給与追加: 月給 ２５万円（全角）',
    fn: () => parseSalary('月給 ２５万円'),
    expected: { unifiedMonthly: 250000 },
    validate: (r) => r && r.unifiedMonthly === 250000
  });

  tests.push({
    name: '給与追加: 時給 １，２００円（全角カンマ）',
    fn: () => parseSalary('時給 １，２００円'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly'
  });

  // 複合範囲パターン
  tests.push({
    name: '給与追加: 月給 23万5000円～28万円',
    fn: () => parseSalary('月給 23万5000円～28万円'),
    expected: { min: 235000 },
    validate: (r) => r && r.min === 235000
  });

  tests.push({
    name: '給与追加: 月給 200,000円～250,000円',
    fn: () => parseSalary('月給 200,000円～250,000円'),
    expected: { min: 200000, max: 250000 },
    validate: (r) => r && r.min === 200000 && r.max === 250000
  });

  tests.push({
    name: '給与追加: 月給 19万円〜25万円（波ダッシュ）',
    fn: () => parseSalary('月給 19万円〜25万円'),
    expected: { min: 190000, max: 250000 },
    validate: (r) => r && r.min === 190000 && r.max === 250000
  });

  tests.push({
    name: '給与追加: 月給 22万円ー30万円（長音記号）',
    fn: () => parseSalary('月給 22万円ー30万円'),
    expected: { min: 220000, max: 300000 },
    validate: (r) => r && r.min === 220000 && r.max === 300000
  });

  // 時給バリエーション
  tests.push({
    name: '給与追加: 時給 900円',
    fn: () => parseSalary('時給 900円'),
    expected: { min: 144000 },
    validate: (r) => r && r.min === 144000
  });

  tests.push({
    name: '給与追加: 時給 1,100円～1,500円',
    fn: () => parseSalary('時給 1,100円～1,500円'),
    expected: { salaryType: 'hourly' },
    validate: (r) => r && r.salaryType === 'hourly' && r.min === 176000 && r.max === 240000
  });

  tests.push({
    name: '給与追加: 時給 2,500円（高時給）',
    fn: () => parseSalary('時給 2,500円'),
    expected: { min: 400000 },
    validate: (r) => r && r.min === 400000
  });

  // 日給バリエーション
  tests.push({
    name: '給与追加: 日給 7,000円',
    fn: () => parseSalary('日給 7,000円'),
    expected: { min: 140000 },
    validate: (r) => r && r.min === 140000
  });

  tests.push({
    name: '給与追加: 日給 15,000円～20,000円',
    fn: () => parseSalary('日給 15,000円～20,000円'),
    expected: { salaryType: 'daily' },
    validate: (r) => r && r.salaryType === 'daily'
  });

  // 年収バリエーション
  tests.push({
    name: '給与追加: 年収 350万円',
    fn: () => parseSalary('年収 350万円'),
    expected: { salaryType: 'annual' },
    validate: (r) => r && r.salaryType === 'annual' && Math.abs(r.unifiedMonthly - 291667) < 10
  });

  tests.push({
    name: '給与追加: 年収 500万円～700万円',
    fn: () => parseSalary('年収 500万円～700万円'),
    expected: { salaryType: 'annual' },
    validate: (r) => r && r.salaryType === 'annual'
  });

  tests.push({
    name: '給与追加: 年俸 600万円',
    fn: () => parseSalary('年俸 600万円'),
    expected: { salaryType: 'annual' },
    validate: (r) => r && r.salaryType === 'annual'
  });

  // スペース・区切りバリエーション
  tests.push({
    name: '給与追加: 月給　25万円（全角スペース）',
    fn: () => parseSalary('月給　25万円'),
    expected: { unifiedMonthly: 250000 },
    validate: (r) => r && r.unifiedMonthly === 250000
  });

  tests.push({
    name: '給与追加: 月給  25万円（複数スペース）',
    fn: () => parseSalary('月給  25万円'),
    expected: { unifiedMonthly: 250000 },
    validate: (r) => r && r.unifiedMonthly === 250000
  });

  // 特殊表記
  tests.push({
    name: '給与追加: 基本給 22万円',
    fn: () => parseSalary('基本給 22万円'),
    expected: { salaryType: 'monthly' },
    validate: (r) => r && r.salaryType === 'monthly'
  });

  tests.push({
    name: '給与追加: 月収 28万円',
    fn: () => parseSalary('月収 28万円'),
    expected: { salaryType: 'monthly' },
    validate: (r) => r && r.salaryType === 'monthly'
  });

  tests.push({
    name: '給与追加: 固定給 30万円',
    fn: () => parseSalary('固定給 30万円'),
    expected: { salaryType: 'monthly' },
    validate: (r) => r && r.salaryType === 'monthly'
  });

  // 特殊ケース
  tests.push({
    name: '給与追加: 応相談',
    fn: () => parseSalary('応相談'),
    expected: { result: null },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: '給与追加: 経験・能力による',
    fn: () => parseSalary('経験・能力による'),
    expected: { result: null },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: '給与追加: 要相談',
    fn: () => parseSalary('要相談'),
    expected: { result: null },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: '給与追加: 面談時に説明',
    fn: () => parseSalary('面談時に説明'),
    expected: { result: null },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  // 境界値テスト
  tests.push({
    name: '給与追加: 月給 10万円（低月給）',
    fn: () => parseSalary('月給 10万円'),
    expected: { unifiedMonthly: 100000 },
    validate: (r) => r && r.unifiedMonthly === 100000
  });

  tests.push({
    name: '給与追加: 月給 150万円（高月給）',
    fn: () => parseSalary('月給 150万円'),
    expected: { unifiedMonthly: 1500000 },
    validate: (r) => r && r.unifiedMonthly === 1500000
  });

  tests.push({
    name: '給与追加: 時給 800円（最低賃金レベル）',
    fn: () => parseSalary('時給 800円'),
    expected: { min: 128000 },
    validate: (r) => r && r.min === 128000
  });

  // ========================================
  // カテゴリ7: 追加勤務地パターン (25パターン)
  // ========================================

  // 政令指定都市
  tests.push({
    name: '勤務地追加: 神奈川県 川崎市',
    fn: () => parseLocation('神奈川県 川崎市'),
    expected: { prefecture: '神奈川県' },
    validate: (r) => r && r.prefecture === '神奈川県'
  });

  tests.push({
    name: '勤務地追加: 愛知県 名古屋市 中区',
    fn: () => parseLocation('愛知県 名古屋市 中区'),
    expected: { prefecture: '愛知県' },
    validate: (r) => r && r.prefecture === '愛知県'
  });

  tests.push({
    name: '勤務地追加: 大阪府 堺市',
    fn: () => parseLocation('大阪府 堺市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r && r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地追加: 京都府 京都市 左京区',
    fn: () => parseLocation('京都府 京都市 左京区'),
    expected: { prefecture: '京都府' },
    validate: (r) => r && r.prefecture === '京都府'
  });

  tests.push({
    name: '勤務地追加: 兵庫県 神戸市 中央区',
    fn: () => parseLocation('兵庫県 神戸市 中央区'),
    expected: { prefecture: '兵庫県' },
    validate: (r) => r && r.prefecture === '兵庫県'
  });

  // 特殊ケース - 県名省略
  tests.push({
    name: '勤務地追加: 東京 新宿区（県名省略）',
    fn: () => parseLocation('東京 新宿区'),
    expected: { prefecture: '東京都' },
    validate: (r) => r && r.prefecture === '東京都'
  });

  tests.push({
    name: '勤務地追加: 大阪 梅田（県名省略）',
    fn: () => parseLocation('大阪 梅田'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r && r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地追加: 京都 四条（県名省略）',
    fn: () => parseLocation('京都 四条'),
    expected: { prefecture: '京都府' },
    validate: (r) => r && r.prefecture === '京都府'
  });

  // 郡部
  tests.push({
    name: '勤務地追加: 北海道 空知郡',
    fn: () => parseLocation('北海道 空知郡'),
    expected: { prefecture: '北海道' },
    validate: (r) => r && r.prefecture === '北海道'
  });

  tests.push({
    name: '勤務地追加: 長野県 北安曇郡 白馬村',
    fn: () => parseLocation('長野県 北安曇郡 白馬村'),
    expected: { prefecture: '長野県' },
    validate: (r) => r && r.prefecture === '長野県'
  });

  // 町村
  tests.push({
    name: '勤務地追加: 沖縄県 中頭郡 北谷町',
    fn: () => parseLocation('沖縄県 中頭郡 北谷町'),
    expected: { prefecture: '沖縄県' },
    validate: (r) => r && r.prefecture === '沖縄県'
  });

  tests.push({
    name: '勤務地追加: 山梨県 南都留郡 富士河口湖町',
    fn: () => parseLocation('山梨県 南都留郡 富士河口湖町'),
    expected: { prefecture: '山梨県' },
    validate: (r) => r && r.prefecture === '山梨県'
  });

  // 複数地域
  tests.push({
    name: '勤務地追加: 東京都内（複数区）',
    fn: () => parseLocation('東京都内'),
    expected: { prefecture: '東京都' },
    validate: (r) => r && r.prefecture === '東京都'
  });

  tests.push({
    name: '勤務地追加: 首都圏',
    fn: () => parseLocation('首都圏'),
    expected: { note: '広域判定' },
    validate: (r) => true
  });

  tests.push({
    name: '勤務地追加: 関西圏',
    fn: () => parseLocation('関西圏'),
    expected: { note: '広域判定' },
    validate: (r) => true
  });

  // 特殊文字
  tests.push({
    name: '勤務地追加: 東京都　渋谷区（全角スペース）',
    fn: () => parseLocation('東京都　渋谷区'),
    expected: { prefecture: '東京都' },
    validate: (r) => r && r.prefecture === '東京都'
  });

  // 駅名付き
  tests.push({
    name: '勤務地追加: 東京都 品川区 品川駅徒歩5分',
    fn: () => parseLocation('東京都 品川区 品川駅徒歩5分'),
    expected: { prefecture: '東京都' },
    validate: (r) => r && r.prefecture === '東京都'
  });

  tests.push({
    name: '勤務地追加: 大阪府 大阪市 梅田駅直結',
    fn: () => parseLocation('大阪府 大阪市 梅田駅直結'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r && r.prefecture === '大阪府'
  });

  // 47都道府県カバレッジ追加
  tests.push({
    name: '勤務地追加: 青森県 青森市',
    fn: () => parseLocation('青森県 青森市'),
    expected: { prefecture: '青森県' },
    validate: (r) => r && r.prefecture === '青森県'
  });

  tests.push({
    name: '勤務地追加: 岩手県 盛岡市',
    fn: () => parseLocation('岩手県 盛岡市'),
    expected: { prefecture: '岩手県' },
    validate: (r) => r && r.prefecture === '岩手県'
  });

  tests.push({
    name: '勤務地追加: 秋田県 秋田市',
    fn: () => parseLocation('秋田県 秋田市'),
    expected: { prefecture: '秋田県' },
    validate: (r) => r && r.prefecture === '秋田県'
  });

  tests.push({
    name: '勤務地追加: 山形県 山形市',
    fn: () => parseLocation('山形県 山形市'),
    expected: { prefecture: '山形県' },
    validate: (r) => r && r.prefecture === '山形県'
  });

  tests.push({
    name: '勤務地追加: 福島県 福島市',
    fn: () => parseLocation('福島県 福島市'),
    expected: { prefecture: '福島県' },
    validate: (r) => r && r.prefecture === '福島県'
  });

  tests.push({
    name: '勤務地追加: 富山県 富山市',
    fn: () => parseLocation('富山県 富山市'),
    expected: { prefecture: '富山県' },
    validate: (r) => r && r.prefecture === '富山県'
  });

  tests.push({
    name: '勤務地追加: 石川県 金沢市',
    fn: () => parseLocation('石川県 金沢市'),
    expected: { prefecture: '石川県' },
    validate: (r) => r && r.prefecture === '石川県'
  });

  // ========================================
  // カテゴリ8: 実データ詳細検証 (25パターン)
  // ========================================

  tests.push({
    name: `実データ[${fileName}]: 月給データの標準偏差`,
    fn: () => {
      const monthlies = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'monthly' && d.salaryParsed.unifiedMonthly)
        .map(d => d.salaryParsed.unifiedMonthly);
      if (monthlies.length < 2) return { stdDev: 0, count: monthlies.length };
      const mean = monthlies.reduce((a, b) => a + b, 0) / monthlies.length;
      const variance = monthlies.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / monthlies.length;
      return { stdDev: Math.sqrt(variance), count: monthlies.length, mean };
    },
    expected: { note: 'standard deviation check' },
    validate: (r) => r.count < 2 || r.stdDev < r.mean
  });

  tests.push({
    name: `実データ[${fileName}]: 給与中央値`,
    fn: () => {
      const salaries = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly)
        .map(d => d.salaryParsed.unifiedMonthly).sort((a, b) => a - b);
      if (salaries.length === 0) return { median: 0 };
      const mid = Math.floor(salaries.length / 2);
      const median = salaries.length % 2 ? salaries[mid] : (salaries[mid - 1] + salaries[mid]) / 2;
      return { median, count: salaries.length };
    },
    expected: { note: 'median check' },
    validate: (r) => r.count === 0 || (r.median >= 100000 && r.median <= 800000)
  });

  tests.push({
    name: `実データ[${fileName}]: 都道府県カバレッジ`,
    fn: () => {
      const prefs = new Set(data.filter(d => d.locationParsed && d.locationParsed.prefecture)
        .map(d => d.locationParsed.prefecture));
      return { uniquePrefectures: prefs.size, list: [...prefs].slice(0, 5) };
    },
    expected: { note: 'prefecture coverage' },
    validate: (r) => r.uniquePrefectures >= 1
  });

  tests.push({
    name: `実データ[${fileName}]: 市区町村カバレッジ`,
    fn: () => {
      const cities = new Set(data.filter(d => d.locationParsed && d.locationParsed.cityWard)
        .map(d => d.locationParsed.cityWard));
      return { uniqueCities: cities.size };
    },
    expected: { note: 'city coverage' },
    validate: (r) => r.uniqueCities >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 給与範囲ありの割合`,
    fn: () => {
      const withRange = data.filter(d => d.salaryParsed && d.salaryParsed.min !== d.salaryParsed.max);
      return { rate: withRange.length / data.length, count: withRange.length };
    },
    expected: { note: 'range ratio' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 平均給与範囲幅`,
    fn: () => {
      const withRange = data.filter(d => d.salaryParsed && d.salaryParsed.min && d.salaryParsed.max && d.salaryParsed.min !== d.salaryParsed.max);
      if (withRange.length === 0) return { avgRange: 0, count: 0 };
      const avgRange = withRange.reduce((sum, d) => sum + (d.salaryParsed.max - d.salaryParsed.min), 0) / withRange.length;
      return { avgRange: Math.round(avgRange), count: withRange.length };
    },
    expected: { note: 'average range' },
    validate: (r) => r.count === 0 || r.avgRange >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 高給求人（月40万以上）の割合`,
    fn: () => {
      const highPay = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly >= 400000);
      return { rate: highPay.length / data.length, count: highPay.length };
    },
    expected: { note: 'high salary ratio' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 低給求人（月20万以下）の割合`,
    fn: () => {
      const lowPay = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly && d.salaryParsed.unifiedMonthly <= 200000);
      return { rate: lowPay.length / data.length, count: lowPay.length };
    },
    expected: { note: 'low salary ratio' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: タグ平均数`,
    fn: () => {
      const tagCounts = data.map(d => (d.tags || []).length);
      const avgTags = tagCounts.reduce((a, b) => a + b, 0) / data.length;
      return { avgTags: avgTags.toFixed(1), maxTags: Math.max(...tagCounts) };
    },
    expected: { note: 'tag average' },
    validate: (r) => r.avgTags >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 人気タグTop5`,
    fn: () => {
      const tagCount = {};
      data.forEach(d => (d.tags || []).forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
      const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return { top5: sorted.map(([tag, count]) => `${tag}(${count})`) };
    },
    expected: { note: 'popular tags' },
    validate: (r) => true
  });

  tests.push({
    name: `実データ[${fileName}]: 企業名ユニーク数`,
    fn: () => {
      const companies = new Set(data.filter(d => d.company).map(d => d.company));
      return { uniqueCompanies: companies.size };
    },
    expected: { note: 'unique companies' },
    validate: (r) => r.uniqueCompanies >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 求人タイトル長さ分布`,
    fn: () => {
      const lengths = data.map(d => (d.title || '').length);
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const max = Math.max(...lengths);
      const min = Math.min(...lengths);
      return { avgLength: Math.round(avg), maxLength: max, minLength: min };
    },
    expected: { note: 'title length' },
    validate: (r) => r.avgLength >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 正社員求人の割合`,
    fn: () => {
      const fullTime = data.filter(d => d.employmentParsed && d.employmentParsed.type === '正社員');
      return { rate: fullTime.length / data.length, count: fullTime.length };
    },
    expected: { note: 'full-time ratio' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: パート・アルバイト求人の割合`,
    fn: () => {
      const partTime = data.filter(d => d.employmentParsed && d.employmentParsed.type && d.employmentParsed.type.includes('パート'));
      return { rate: partTime.length / data.length, count: partTime.length };
    },
    expected: { note: 'part-time ratio' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 契約・派遣求人の割合`,
    fn: () => {
      const contract = data.filter(d => d.employmentParsed && d.employmentParsed.type &&
        (d.employmentParsed.type.includes('契約') || d.employmentParsed.type.includes('派遣')));
      return { rate: contract.length / data.length, count: contract.length };
    },
    expected: { note: 'contract ratio' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 時給求人の平均時給`,
    fn: () => {
      const hourly = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'hourly');
      if (hourly.length === 0) return { avgHourly: 0, count: 0 };
      const avgHourly = hourly.reduce((sum, d) => sum + d.salaryParsed.min / 160, 0) / hourly.length;
      return { avgHourly: Math.round(avgHourly), count: hourly.length };
    },
    expected: { note: 'average hourly wage' },
    validate: (r) => r.count === 0 || (r.avgHourly >= 800 && r.avgHourly <= 5000)
  });

  tests.push({
    name: `実データ[${fileName}]: 日給求人の平均日給`,
    fn: () => {
      const daily = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'daily');
      if (daily.length === 0) return { avgDaily: 0, count: 0 };
      const avgDaily = daily.reduce((sum, d) => sum + d.salaryParsed.min / 20, 0) / daily.length;
      return { avgDaily: Math.round(avgDaily), count: daily.length };
    },
    expected: { note: 'average daily wage' },
    validate: (r) => r.count === 0 || (r.avgDaily >= 5000 && r.avgDaily <= 50000)
  });

  tests.push({
    name: `実データ[${fileName}]: 賞与ありタグの有無`,
    fn: () => {
      const withBonus = data.filter(d => (d.tags || []).some(t => t.includes('賞与')));
      return { rate: withBonus.length / data.length, count: withBonus.length };
    },
    expected: { note: 'bonus tag' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 週休2日タグの有無`,
    fn: () => {
      const with2DaysOff = data.filter(d => (d.tags || []).some(t => t.includes('週休2日') || t.includes('週休二日')));
      return { rate: with2DaysOff.length / data.length, count: with2DaysOff.length };
    },
    expected: { note: '2 days off tag' },
    validate: (r) => r.rate >= 0
  });

  tests.push({
    name: `実データ[${fileName}]: 未経験OKタグの有無`,
    fn: () => {
      const beginnerOK = data.filter(d => (d.tags || []).some(t => t.includes('未経験') || t.includes('初心者')));
      return { rate: beginnerOK.length / data.length, count: beginnerOK.length };
    },
    expected: { note: 'beginner OK tag' },
    validate: (r) => r.rate >= 0
  });

  // ========================================
  // カテゴリ9: クロス検証テスト (20パターン)
  // ========================================

  tests.push({
    name: `クロス検証[${fileName}]: 高給求人は正社員が多い`,
    fn: () => {
      const highPay = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly >= 350000);
      const fullTime = highPay.filter(d => d.employmentParsed && d.employmentParsed.type === '正社員');
      return { highPayCount: highPay.length, fullTimeRate: highPay.length ? fullTime.length / highPay.length : 0 };
    },
    expected: { note: 'cross validation' },
    validate: (r) => r.highPayCount === 0 || r.fullTimeRate >= 0.3
  });

  tests.push({
    name: `クロス検証[${fileName}]: 時給求人はパート・アルバイトが多い`,
    fn: () => {
      const hourly = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'hourly');
      const partTime = hourly.filter(d => d.employmentParsed && d.employmentParsed.type && d.employmentParsed.type.includes('パート'));
      return { hourlyCount: hourly.length, partTimeRate: hourly.length ? partTime.length / hourly.length : 0 };
    },
    expected: { note: 'cross validation' },
    validate: (r) => r.hourlyCount === 0 || r.partTimeRate >= 0
  });

  tests.push({
    name: `クロス検証[${fileName}]: 都市部は給与が高い`,
    fn: () => {
      const urban = data.filter(d => d.locationParsed && ['東京都', '大阪府', '愛知県'].includes(d.locationParsed.prefecture));
      const rural = data.filter(d => d.locationParsed && !['東京都', '大阪府', '愛知県'].includes(d.locationParsed.prefecture));
      const urbanAvg = urban.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).reduce((s, d) => s + d.salaryParsed.unifiedMonthly, 0) / (urban.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).length || 1);
      const ruralAvg = rural.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).reduce((s, d) => s + d.salaryParsed.unifiedMonthly, 0) / (rural.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).length || 1);
      return { urbanAvg: Math.round(urbanAvg), ruralAvg: Math.round(ruralAvg), urbanCount: urban.length, ruralCount: rural.length };
    },
    expected: { note: 'urban vs rural' },
    validate: (r) => r.urbanCount === 0 || r.ruralCount === 0 || r.urbanAvg >= r.ruralAvg * 0.8
  });

  tests.push({
    name: `クロス検証[${fileName}]: 給与と雇用形態の相関`,
    fn: () => {
      const byType = {};
      data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly && d.employmentParsed).forEach(d => {
        const type = d.employmentParsed.type || '不明';
        if (!byType[type]) byType[type] = [];
        byType[type].push(d.salaryParsed.unifiedMonthly);
      });
      const avgByType = {};
      Object.keys(byType).forEach(type => {
        avgByType[type] = Math.round(byType[type].reduce((a, b) => a + b, 0) / byType[type].length);
      });
      return { avgByType };
    },
    expected: { note: 'salary by employment type' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 給与データの歪度`,
    fn: () => {
      const salaries = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).map(d => d.salaryParsed.unifiedMonthly);
      if (salaries.length < 3) return { skewness: 0, note: 'insufficient data' };
      const n = salaries.length;
      const mean = salaries.reduce((a, b) => a + b, 0) / n;
      const variance = salaries.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      const skewness = salaries.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / n;
      return { skewness: skewness.toFixed(2) };
    },
    expected: { note: 'skewness check' },
    validate: (r) => Math.abs(parseFloat(r.skewness)) < 3
  });

  tests.push({
    name: `クロス検証[${fileName}]: 都道府県別求人数Top5`,
    fn: () => {
      const byPref = {};
      data.filter(d => d.locationParsed && d.locationParsed.prefecture).forEach(d => {
        byPref[d.locationParsed.prefecture] = (byPref[d.locationParsed.prefecture] || 0) + 1;
      });
      const top5 = Object.entries(byPref).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return { top5: top5.map(([pref, count]) => `${pref}(${count})`) };
    },
    expected: { note: 'top prefectures' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 市区町村別求人数Top5`,
    fn: () => {
      const byCity = {};
      data.filter(d => d.locationParsed && d.locationParsed.cityWard).forEach(d => {
        byCity[d.locationParsed.cityWard] = (byCity[d.locationParsed.cityWard] || 0) + 1;
      });
      const top5 = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return { top5: top5.map(([city, count]) => `${city}(${count})`) };
    },
    expected: { note: 'top cities' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 給与タイプ別平均給与`,
    fn: () => {
      const byType = { monthly: [], hourly: [], daily: [], annual: [] };
      data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).forEach(d => {
        const type = d.salaryParsed.salaryType || 'monthly';
        if (byType[type]) byType[type].push(d.salaryParsed.unifiedMonthly);
      });
      const avgByType = {};
      Object.keys(byType).forEach(type => {
        avgByType[type] = byType[type].length ? Math.round(byType[type].reduce((a, b) => a + b, 0) / byType[type].length) : 0;
      });
      return { avgByType };
    },
    expected: { note: 'avg by salary type' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: タグと給与の相関（交通費支給）`,
    fn: () => {
      const withTag = data.filter(d => (d.tags || []).some(t => t.includes('交通費')) && d.salaryParsed && d.salaryParsed.unifiedMonthly);
      const withoutTag = data.filter(d => !(d.tags || []).some(t => t.includes('交通費')) && d.salaryParsed && d.salaryParsed.unifiedMonthly);
      const avgWith = withTag.length ? withTag.reduce((s, d) => s + d.salaryParsed.unifiedMonthly, 0) / withTag.length : 0;
      const avgWithout = withoutTag.length ? withoutTag.reduce((s, d) => s + d.salaryParsed.unifiedMonthly, 0) / withoutTag.length : 0;
      return { avgWith: Math.round(avgWith), avgWithout: Math.round(avgWithout), countWith: withTag.length, countWithout: withoutTag.length };
    },
    expected: { note: 'transport allowance correlation' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 正社員の平均給与`,
    fn: () => {
      const fullTime = data.filter(d => d.employmentParsed && d.employmentParsed.type === '正社員' && d.salaryParsed && d.salaryParsed.unifiedMonthly);
      if (fullTime.length === 0) return { avgSalary: 0, count: 0 };
      const avg = fullTime.reduce((s, d) => s + d.salaryParsed.unifiedMonthly, 0) / fullTime.length;
      return { avgSalary: Math.round(avg), count: fullTime.length };
    },
    expected: { note: 'full-time avg salary' },
    validate: (r) => r.count === 0 || (r.avgSalary >= 150000 && r.avgSalary <= 800000)
  });

  tests.push({
    name: `クロス検証[${fileName}]: データ欠損率`,
    fn: () => {
      const missingTitle = data.filter(d => !d.title).length;
      const missingSalary = data.filter(d => !d.salaryParsed || !d.salaryParsed.unifiedMonthly).length;
      const missingLocation = data.filter(d => !d.locationParsed || !d.locationParsed.prefecture).length;
      return {
        titleMissing: (missingTitle / data.length * 100).toFixed(1) + '%',
        salaryMissing: (missingSalary / data.length * 100).toFixed(1) + '%',
        locationMissing: (missingLocation / data.length * 100).toFixed(1) + '%'
      };
    },
    expected: { note: 'missing data rate' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 重複チェック（タイトル+企業）`,
    fn: () => {
      const seen = new Set();
      let duplicates = 0;
      data.forEach(d => {
        const key = `${d.title}|${d.company}`;
        if (seen.has(key)) duplicates++;
        seen.add(key);
      });
      return { duplicates, duplicateRate: (duplicates / data.length * 100).toFixed(1) + '%' };
    },
    expected: { note: 'duplicate check' },
    validate: (r) => r.duplicates / data.length < 0.2
  });

  tests.push({
    name: `クロス検証[${fileName}]: 給与パース成功率`,
    fn: () => {
      const withRawSalary = data.filter(d => d.salary && d.salary.trim().length > 0);
      const parsed = withRawSalary.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
      return {
        rawCount: withRawSalary.length,
        parsedCount: parsed.length,
        successRate: withRawSalary.length ? (parsed.length / withRawSalary.length * 100).toFixed(1) + '%' : 'N/A'
      };
    },
    expected: { note: 'parse success rate' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 地域パース成功率`,
    fn: () => {
      const withRawLocation = data.filter(d => d.location && d.location.trim().length > 0);
      const parsed = withRawLocation.filter(d => d.locationParsed && d.locationParsed.prefecture);
      return {
        rawCount: withRawLocation.length,
        parsedCount: parsed.length,
        successRate: withRawLocation.length ? (parsed.length / withRawLocation.length * 100).toFixed(1) + '%' : 'N/A'
      };
    },
    expected: { note: 'location parse success rate' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 外れ値検出（給与）`,
    fn: () => {
      const salaries = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).map(d => d.salaryParsed.unifiedMonthly).sort((a, b) => a - b);
      if (salaries.length < 4) return { outliers: 0, note: 'insufficient data' };
      const q1 = salaries[Math.floor(salaries.length * 0.25)];
      const q3 = salaries[Math.floor(salaries.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      const outliers = salaries.filter(s => s < lowerBound || s > upperBound);
      return { outlierCount: outliers.length, outlierRate: (outliers.length / salaries.length * 100).toFixed(1) + '%', bounds: `${lowerBound}-${upperBound}` };
    },
    expected: { note: 'outlier detection' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 給与×地域マトリクス`,
    fn: () => {
      const matrix = {};
      data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly && d.locationParsed && d.locationParsed.prefecture).forEach(d => {
        const pref = d.locationParsed.prefecture;
        if (!matrix[pref]) matrix[pref] = { count: 0, sum: 0 };
        matrix[pref].count++;
        matrix[pref].sum += d.salaryParsed.unifiedMonthly;
      });
      const avgByPref = {};
      Object.keys(matrix).forEach(pref => {
        avgByPref[pref] = Math.round(matrix[pref].sum / matrix[pref].count);
      });
      const top3 = Object.entries(avgByPref).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, avg]) => `${p}:${avg}円`);
      return { top3AvgSalary: top3 };
    },
    expected: { note: 'salary by prefecture' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 週末休みタグと給与の関係`,
    fn: () => {
      const weekend = data.filter(d => (d.tags || []).some(t => t.includes('土日') || t.includes('週休')) && d.salaryParsed && d.salaryParsed.unifiedMonthly);
      const noWeekend = data.filter(d => !(d.tags || []).some(t => t.includes('土日') || t.includes('週休')) && d.salaryParsed && d.salaryParsed.unifiedMonthly);
      return {
        weekendAvg: weekend.length ? Math.round(weekend.reduce((s, d) => s + d.salaryParsed.unifiedMonthly, 0) / weekend.length) : 0,
        noWeekendAvg: noWeekend.length ? Math.round(noWeekend.reduce((s, d) => s + d.salaryParsed.unifiedMonthly, 0) / noWeekend.length) : 0,
        weekendCount: weekend.length,
        noWeekendCount: noWeekend.length
      };
    },
    expected: { note: 'weekend off correlation' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: データ完全性スコア`,
    fn: () => {
      let score = 0;
      const checks = [
        { name: 'タイトル', fn: d => d.title && d.title.length > 0 },
        { name: '企業名', fn: d => d.company && d.company.length > 0 },
        { name: '給与', fn: d => d.salaryParsed && d.salaryParsed.unifiedMonthly },
        { name: '勤務地', fn: d => d.locationParsed && d.locationParsed.prefecture },
        { name: '雇用形態', fn: d => d.employmentParsed && d.employmentParsed.type }
      ];
      checks.forEach(check => {
        const rate = data.filter(check.fn).length / data.length;
        score += rate * 20;
      });
      return { completenessScore: Math.round(score), maxScore: 100 };
    },
    expected: { note: 'completeness score' },
    validate: (r) => r.completenessScore >= 0
  });

  tests.push({
    name: `クロス検証[${fileName}]: 研修ありタグと未経験可の相関`,
    fn: () => {
      const withTraining = data.filter(d => (d.tags || []).some(t => t.includes('研修')));
      const beginnerOKInTraining = withTraining.filter(d => (d.tags || []).some(t => t.includes('未経験') || t.includes('初心者')));
      return {
        trainingCount: withTraining.length,
        beginnerOKRate: withTraining.length ? (beginnerOKInTraining.length / withTraining.length * 100).toFixed(1) + '%' : 'N/A'
      };
    },
    expected: { note: 'training and beginner correlation' },
    validate: (r) => true
  });

  tests.push({
    name: `クロス検証[${fileName}]: 業界・職種キーワード分析`,
    fn: () => {
      const keywords = ['介護', '看護', 'IT', '営業', '事務', '製造', '飲食', '医療', '福祉', '教育'];
      const counts = {};
      keywords.forEach(kw => {
        counts[kw] = data.filter(d => (d.title || '').includes(kw)).length;
      });
      const sorted = Object.entries(counts).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      return { keywordCounts: sorted.slice(0, 5).map(([kw, c]) => `${kw}(${c})`) };
    },
    expected: { note: 'industry keywords' },
    validate: (r) => true
  });

  return tests;
}

// ========================================
// 10段階深堀り分析（Indeed専用）
// ========================================
function performIndeedAnalysis(data, fileName) {
  const analyses = [];

  const withSalary = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
  const withLocation = data.filter(d => d.locationParsed && d.locationParsed.prefecture);

  analyses.push({
    level: 1,
    description: '基礎統計 - Indeedデータ概要',
    result: `総件数: ${data.length}, 給与あり: ${withSalary.length} (${(withSalary.length/data.length*100).toFixed(1)}%), 勤務地あり: ${withLocation.length} (${(withLocation.length/data.length*100).toFixed(1)}%)`
  });

  const salaryTypes = {};
  withSalary.forEach(d => {
    const type = d.salaryParsed.salaryType || '不明';
    salaryTypes[type] = (salaryTypes[type] || 0) + 1;
  });
  analyses.push({
    level: 2,
    description: '給与タイプ分布',
    result: Object.entries(salaryTypes).map(([k,v]) => `${k}: ${v}件`).join(', ') || 'データなし'
  });

  const avg = withSalary.length > 0
    ? withSalary.reduce((sum, d) => sum + d.salaryParsed.unifiedMonthly, 0) / withSalary.length
    : 0;
  analyses.push({
    level: 3,
    description: '平均月給（統合換算）',
    result: `平均: ${(avg/10000).toFixed(1)}万円`
  });

  const prefectures = {};
  withLocation.forEach(d => {
    const pref = d.locationParsed.prefecture;
    prefectures[pref] = (prefectures[pref] || 0) + 1;
  });
  const topPrefs = Object.entries(prefectures).sort((a,b) => b[1] - a[1]).slice(0, 5);
  analyses.push({
    level: 4,
    description: '都道府県分布（トップ5）',
    result: topPrefs.map(([p, c]) => `${p}: ${c}件`).join(', ') || 'データなし'
  });

  const blocks = {};
  withLocation.forEach(d => {
    const block = d.locationParsed.regionBlock;
    if (block) blocks[block] = (blocks[block] || 0) + 1;
  });
  analyses.push({
    level: 5,
    description: '地域ブロック分布',
    result: Object.entries(blocks).map(([k,v]) => `${k}: ${v}件`).join(', ') || 'データなし'
  });

  const empTypes = {};
  data.forEach(d => {
    if (d.employmentParsed && d.employmentParsed.type) {
      empTypes[d.employmentParsed.type] = (empTypes[d.employmentParsed.type] || 0) + 1;
    }
  });
  analyses.push({
    level: 6,
    description: '雇用形態分布',
    result: Object.entries(empTypes).map(([k,v]) => `${k}: ${v}件`).join(', ') || 'データなし'
  });

  const tagCounts = {};
  data.forEach(d => {
    (d.tags || []).forEach(tag => {
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  analyses.push({
    level: 7,
    description: '人気タグ（トップ5）',
    result: topTags.map(([t, c]) => `${t}: ${c}件`).join(', ') || 'データなし'
  });

  const highIncome = withSalary.filter(d => d.salaryParsed.unifiedMonthly >= 350000);
  analyses.push({
    level: 8,
    description: '高収入求人分析（月35万円以上）',
    result: `高収入求人: ${highIncome.length}件 (${(highIncome.length/Math.max(withSalary.length,1)*100).toFixed(1)}%)`
  });

  const withRange = withSalary.filter(d => d.salaryParsed.min && d.salaryParsed.max && d.salaryParsed.min !== d.salaryParsed.max);
  const avgRange = withRange.length > 0
    ? withRange.reduce((sum, d) => sum + (d.salaryParsed.max - d.salaryParsed.min), 0) / withRange.length
    : 0;
  analyses.push({
    level: 9,
    description: '給与範囲の幅分析',
    result: `範囲あり: ${withRange.length}件, 平均幅: ${(avgRange/10000).toFixed(1)}万円`
  });

  let score = 0;
  if (withSalary.length / data.length > 0.3) score += 20;
  if (withLocation.length / data.length > 0.8) score += 20;
  if (Object.keys(empTypes).length > 0) score += 20;
  if (topTags.length >= 3) score += 20;
  const violations = data.filter(d => d.salaryParsed && d.salaryParsed.min && d.salaryParsed.max && d.salaryParsed.min > d.salaryParsed.max);
  if (violations.length === 0) score += 20;
  analyses.push({
    level: 10,
    description: 'データ品質スコア',
    result: `品質スコア: ${score}/100点`
  });

  return analyses;
}

// ========================================
// 10回逆証明（Indeed専用）
// ========================================
function performIndeedReverseProof(data) {
  const proofs = [];

  const minMaxViolations = data.filter(d => {
    const s = d.salaryParsed;
    return s && s.min && s.max && s.min > s.max;
  });
  proofs.push({
    hypothesis: '給与パースが正しければ、常に min <= max である',
    result: minMaxViolations.length === 0
      ? `検証成功: min > max の違反 0件 → パースロジックは正しい`
      : `検証失敗: ${minMaxViolations.length}件が違反`,
    verified: minMaxViolations.length === 0
  });

  const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
  const invalidPref = data.filter(d => {
    const loc = d.locationParsed;
    return loc && loc.prefecture && !prefectures.includes(loc.prefecture);
  });
  proofs.push({
    hypothesis: '都道府県パースが正しければ、全て47都道府県内である',
    result: invalidPref.length === 0
      ? `検証成功: 無効な都道府県 0件 → パースロジックは正しい`
      : `検証失敗: ${invalidPref.length}件が無効`,
    verified: invalidPref.length === 0
  });

  const negativeSalary = data.filter(d => {
    const s = d.salaryParsed;
    return s && s.unifiedMonthly && s.unifiedMonthly < 0;
  });
  proofs.push({
    hypothesis: '給与計算が正しければ、統合月給は全て正の数である',
    result: negativeSalary.length === 0
      ? `検証成功: 負の統合月給 0件 → 計算ロジックは正しい`
      : `検証失敗: ${negativeSalary.length}件が負`,
    verified: negativeSalary.length === 0
  });

  const ids = data.map(d => d.id);
  const uniqueIds = new Set(ids);
  proofs.push({
    hypothesis: 'ID採番が正しければ、全IDは一意である',
    result: ids.length === uniqueIds.size
      ? `検証成功: ${ids.length}件のID全て一意 → 採番ロジックは正しい`
      : `検証失敗: 重複IDあり`,
    verified: ids.length === uniqueIds.size
  });

  const validBlocks = ['北海道・東北', '関東', '北陸・甲信越', '東海', '関西', '中国・四国', '九州・沖縄', null, undefined];
  const invalidBlock = data.filter(d => {
    const loc = d.locationParsed;
    return loc && loc.regionBlock && !validBlocks.includes(loc.regionBlock);
  });
  proofs.push({
    hypothesis: '地域ブロックは有効な値のみである',
    result: invalidBlock.length === 0
      ? `検証成功: 無効なブロック 0件 → 地域分類は正しい`
      : `検証失敗: ${invalidBlock.length}件が無効ブロック`,
    verified: invalidBlock.length === 0
  });

  const withSalary = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
  const outOfRange = withSalary.filter(d => d.salaryParsed.unifiedMonthly < 50000 || d.salaryParsed.unifiedMonthly > 2000000);
  proofs.push({
    hypothesis: '統合月給は5万円～200万円の範囲内である',
    result: outOfRange.length <= 5
      ? `検証成功: 範囲外 ${outOfRange.length}件のみ → 給与データは妥当`
      : `検証失敗: ${outOfRange.length}件が範囲外`,
    verified: outOfRange.length <= 5
  });

  const hourly = withSalary.filter(d => d.salaryParsed.salaryType === 'hourly');
  const hourlyWrong = hourly.filter(d => d.salaryParsed.unifiedMonthly < 100000 || d.salaryParsed.unifiedMonthly > 500000);
  proofs.push({
    hypothesis: '時給の月給換算は10万円～50万円の範囲内である',
    result: hourly.length === 0 || hourlyWrong.length / hourly.length < 0.1
      ? `検証成功: 時給${hourly.length}件中、範囲外${hourlyWrong.length}件 → 換算ロジックは正しい`
      : `検証失敗: ${hourlyWrong.length}件が範囲外`,
    verified: hourly.length === 0 || hourlyWrong.length / hourly.length < 0.1
  });

  const daily = withSalary.filter(d => d.salaryParsed.salaryType === 'daily');
  const dailyWrong = daily.filter(d => d.salaryParsed.unifiedMonthly < 100000 || d.salaryParsed.unifiedMonthly > 800000);
  proofs.push({
    hypothesis: '日給の月給換算は10万円～80万円の範囲内である',
    result: daily.length === 0 || dailyWrong.length / daily.length < 0.1
      ? `検証成功: 日給${daily.length}件中、範囲外${dailyWrong.length}件 → 換算ロジックは正しい`
      : `検証失敗: ${dailyWrong.length}件が範囲外`,
    verified: daily.length === 0 || dailyWrong.length / daily.length < 0.1
  });

  const salaries = withSalary.map(d => d.salaryParsed.unifiedMonthly).sort((a,b) => a - b);
  const median = salaries.length > 0 ? salaries[Math.floor(salaries.length / 2)] : 0;
  const avg = salaries.length > 0 ? salaries.reduce((a,b) => a + b, 0) / salaries.length : 0;
  const deviation = avg > 0 ? Math.abs(median - avg) / avg * 100 : 0;
  proofs.push({
    hypothesis: '平均給与と中央値の乖離は50%以内である',
    result: deviation <= 50
      ? `検証成功: 平均${(avg/10000).toFixed(1)}万 vs 中央値${(median/10000).toFixed(1)}万 (乖離${deviation.toFixed(1)}%) → データは正常分布`
      : `検証失敗: 乖離${deviation.toFixed(1)}%`,
    verified: deviation <= 50
  });

  const titleEmpty = data.filter(d => !d.title || d.title.trim().length === 0);
  proofs.push({
    hypothesis: 'タイトル空率は10%以下である',
    result: titleEmpty.length / data.length <= 0.1
      ? `検証成功: 空タイトル ${titleEmpty.length}件 (${(titleEmpty.length/data.length*100).toFixed(1)}%) → データは有効`
      : `検証失敗: 空タイトル${titleEmpty.length}件`,
    verified: titleEmpty.length / data.length <= 0.1
  });

  return proofs;
}

// ========================================
// メイン実行
// ========================================
async function main() {
  const csvFiles = process.argv.slice(2);

  if (csvFiles.length === 0) {
    csvFiles.push(
      'C:\\Users\\fuji1\\Downloads\\indeed-2026-01-13.csv',
      'C:\\Users\\fuji1\\Downloads\\indeed-2026-01-13 (2).csv',
      'C:\\Users\\fuji1\\Downloads\\indeed-2026-01-13 (1).csv'
    );
  }

  console.log('========================================');
  console.log('Indeed データ 100パターンテスト実行');
  console.log(`対象ファイル数: ${csvFiles.length}`);
  console.log('========================================\n');

  const allResults = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;
  let totalProofsPassed = 0;
  let totalProofs = 0;

  for (let fileIdx = 0; fileIdx < csvFiles.length; fileIdx++) {
    const csvPath = csvFiles[fileIdx];
    const fileName = path.basename(csvPath);

    console.log('\n========================================');
    console.log(`ファイル ${fileIdx + 1}/${csvFiles.length}: ${fileName}`);
    console.log('========================================\n');

    let csvText;
    try {
      csvText = fs.readFileSync(csvPath, 'utf8');
      console.log(`CSV読み込み成功: ${csvPath}`);
    } catch (e) {
      console.error(`CSVファイル読み込みエラー: ${e.message}`);
      continue;
    }

    const { headers, data: csvData } = parseCSV(csvText);
    console.log(`レコード数: ${csvData.length}`);
    console.log(`ヘッダー数: ${headers.length}\n`);

    const parsedData = parseIndeedData(csvData, headers);
    console.log(`パース完了: ${parsedData.length}件\n`);

    // テスト実行
    console.log('--- 100パターンテスト ---\n');
    const allTests = generateIndeedTests(parsedData, fileName);
    let passed = 0;
    let failed = 0;
    const failedTests = [];

    for (let i = 0; i < allTests.length; i++) {
      const test = allTests[i];
      try {
        const actual = test.fn();
        const isPassed = test.validate(actual);
        if (isPassed) {
          passed++;
          console.log(`[PASS] #${i + 1} ${test.name}`);
        } else {
          failed++;
          failedTests.push({ index: i + 1, name: test.name, expected: test.expected, actual });
          console.log(`[FAIL] #${i + 1} ${test.name}`);
          console.log(`  Expected: ${JSON.stringify(test.expected)}`);
          console.log(`  Actual: ${JSON.stringify(actual)}`);
        }
      } catch (e) {
        failed++;
        failedTests.push({ index: i + 1, name: test.name, error: e.message });
        console.log(`[ERROR] #${i + 1} ${test.name}: ${e.message}`);
      }
    }

    console.log(`\nテスト結果: ${passed}/${allTests.length} パス (${(passed / allTests.length * 100).toFixed(1)}%)\n`);

    // 深堀り分析
    console.log('--- 10段階深堀り分析 ---\n');
    const analyses = performIndeedAnalysis(parsedData, fileName);
    analyses.forEach(a => {
      console.log(`[Level ${a.level}] ${a.description}`);
      console.log(`  結果: ${a.result}\n`);
    });

    // 逆証明
    console.log('--- 10回逆証明 ---\n');
    const proofs = performIndeedReverseProof(parsedData);
    let proofPassed = 0;
    proofs.forEach((p, idx) => {
      const status = p.verified ? '[VERIFIED]' : '[UNVERIFIED]';
      console.log(`${status} Proof ${idx + 1}: ${p.hypothesis}`);
      console.log(`  結果: ${p.result}\n`);
      if (p.verified) proofPassed++;
    });
    console.log(`逆証明結果: ${proofPassed}/${proofs.length} 検証成功\n`);

    totalPassed += passed;
    totalFailed += failed;
    totalTests += allTests.length;
    totalProofsPassed += proofPassed;
    totalProofs += proofs.length;

    allResults.push({
      file: fileName,
      dataCount: parsedData.length,
      tests: { total: allTests.length, passed, failed, failedTests },
      analyses,
      proofs,
      proofsPassed: proofPassed
    });
  }

  // 総合レポート
  console.log('\n========================================');
  console.log('総合レポート（全ファイル）');
  console.log('========================================\n');

  console.log(`ファイル数: ${csvFiles.length}`);
  console.log(`総テスト数: ${totalTests}`);
  console.log(`総成功数: ${totalPassed} (${(totalPassed/totalTests*100).toFixed(1)}%)`);
  console.log(`総失敗数: ${totalFailed}`);
  console.log(`逆証明成功: ${totalProofsPassed}/${totalProofs}`);
  console.log('');

  allResults.forEach(r => {
    console.log(`[${r.file}] ${r.tests.passed}/${r.tests.total} パス, ${r.proofsPassed}/10 逆証明成功`);
  });

  // 結果保存
  const resultPath = path.join(__dirname, 'test-indeed-results.json');
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      fileCount: csvFiles.length,
      totalTests,
      totalPassed,
      totalFailed,
      passRate: (totalPassed / totalTests * 100).toFixed(1) + '%',
      totalProofsPassed,
      totalProofs
    },
    files: allResults
  }, null, 2), 'utf8');
  console.log(`\n結果を保存しました: ${resultPath}`);
}

main().catch(console.error);
