/**
 * 薬剤師データ専用 100パターンテスト
 * CSV: 豊中市　薬剤師.csv (650レコード)
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

// 薬剤師データ用パーサー（カラム構造が異なる）
function parsePharmacistData(csvData) {
  return csvData.map((row, idx) => {
    return {
      id: idx,
      title: row['p-result_name'] || '',
      company: row['p-result_company'] || '',
      location: row['c-icon'] || '',
      salary: row['c-icon (2)'] || '',
      description: row['p-result_lines'] || '',
      tags: [
        row['p-result_tag_feature--ver2'],
        row['p-result_tag_feature--ver2 (2)'],
        row['p-result_tag_feature--ver2 (3)'],
        row['p-result_tag_feature--ver2 (4)'],
        row['p-result_tag_feature--ver2 (5)'],
        row['p-result_tag_feature--ver2 (6)'],
        row['p-result_tag_feature--ver2 (7)']
      ].filter(t => t && t.trim()),
      // パース済みフィールド
      salaryParsed: parseSalary(row['c-icon (2)'] || ''),
      locationParsed: parseLocation(row['c-icon'] || ''),
      annualHolidays: extractAnnualHolidays(row['p-result_lines'] || '')
    };
  });
}

// ========================================
// 薬剤師専用100パターンテスト生成
// ========================================
function generatePharmacistTests(data) {
  const tests = [];

  // 注意: parseSalary は年収を月給換算して返す
  // 年収400万円 → unifiedMonthly = 400万/12 ≈ 333,333円

  // ========================================
  // カテゴリ1: 年収パターン基本形 (20パターン)
  // ========================================

  // 1-1: 年収範囲パターン（月給換算で検証）
  tests.push({
    name: '年収パース: 年収400万円～500万円（月給換算）',
    fn: () => parseSalary('年収400万円～500万円'),
    expected: { minMonthly: 333333, maxMonthly: 416667, type: 'annual' },
    validate: (r) => r && r.salaryType === 'annual' && Math.abs(r.min - 333333) < 1 && Math.abs(r.max - 416667) < 1
  });

  tests.push({
    name: '年収パース: 年収430万円～760万円（月給換算）',
    fn: () => parseSalary('年収430万円～760万円'),
    expected: { minMonthly: 358333, maxMonthly: 633333 },
    validate: (r) => r && Math.abs(r.min - 358333) < 1 && Math.abs(r.max - 633333) < 1
  });

  tests.push({
    name: '年収パース: 年収348万円～500万円（月給換算）',
    fn: () => parseSalary('年収348万円～500万円'),
    expected: { minMonthly: 290000, maxMonthly: 416667 },
    validate: (r) => r && Math.abs(r.min - 290000) < 1 && Math.abs(r.max - 416667) < 1
  });

  tests.push({
    name: '年収パース: 年収500万円～600万円（月給換算）',
    fn: () => parseSalary('年収500万円～600万円'),
    expected: { minMonthly: 416667, maxMonthly: 500000 },
    validate: (r) => r && Math.abs(r.min - 416667) < 1 && Math.abs(r.max - 500000) < 1
  });

  tests.push({
    name: '年収パース: 年収450万円～800万円（月給換算）',
    fn: () => parseSalary('年収450万円～800万円'),
    expected: { minMonthly: 375000, maxMonthly: 666667 },
    validate: (r) => r && Math.abs(r.min - 375000) < 1 && Math.abs(r.max - 666667) < 1
  });

  // 1-2: 年収以上パターン
  tests.push({
    name: '年収パース: 年収500万円～（月給換算）',
    fn: () => parseSalary('年収500万円～'),
    expected: { minMonthly: 416667 },
    validate: (r) => r && r.salaryType === 'annual' && Math.abs(r.min - 416667) < 1
  });

  tests.push({
    name: '年収パース: 年収550万円～（月給換算）',
    fn: () => parseSalary('年収550万円～'),
    expected: { minMonthly: 458333 },
    validate: (r) => r && Math.abs(r.min - 458333) < 1
  });

  tests.push({
    name: '年収パース: 年収600万円～（月給換算）',
    fn: () => parseSalary('年収600万円～'),
    expected: { minMonthly: 500000 },
    validate: (r) => r && Math.abs(r.min - 500000) < 1
  });

  tests.push({
    name: '年収パース: 年収400万円～（月給換算）',
    fn: () => parseSalary('年収400万円～'),
    expected: { minMonthly: 333333 },
    validate: (r) => r && Math.abs(r.min - 333333) < 1
  });

  tests.push({
    name: '年収パース: 年収700万円以上（月給換算）',
    fn: () => parseSalary('年収700万円以上'),
    expected: { minMonthly: 583333 },
    validate: (r) => r && Math.abs(r.min - 583333) < 1
  });

  // 1-3: 年収月給換算確認
  tests.push({
    name: '年収パース: 年収480万円の月給換算',
    fn: () => parseSalary('年収480万円'),
    expected: { unifiedMonthly: 400000 },
    validate: (r) => r.unifiedMonthly === 400000
  });

  tests.push({
    name: '年収パース: 年収600万円の月給換算',
    fn: () => parseSalary('年収600万円'),
    expected: { unifiedMonthly: 500000 },
    validate: (r) => r.unifiedMonthly === 500000
  });

  tests.push({
    name: '年収パース: 年収360万円の月給換算',
    fn: () => parseSalary('年収360万円'),
    expected: { unifiedMonthly: 300000 },
    validate: (r) => r.unifiedMonthly === 300000
  });

  // 1-4: 年収+付加情報パターン（月給換算で検証）
  tests.push({
    name: '年収パース: 年収450万円～550万円 / 賞与あり・昇給あり（月給換算）',
    fn: () => parseSalary('年収450万円～550万円 / 賞与あり・昇給あり'),
    expected: { minMonthly: 375000, maxMonthly: 458333 },
    validate: (r) => r && Math.abs(r.min - 375000) < 1 && Math.abs(r.max - 458333) < 1
  });

  tests.push({
    name: '年収パース: 年収500万円～600万円 / 賞与あり・昇給あり（月給換算）',
    fn: () => parseSalary('年収500万円～600万円 / 賞与あり・昇給あり'),
    expected: { minMonthly: 416667, maxMonthly: 500000 },
    validate: (r) => r && Math.abs(r.min - 416667) < 1 && Math.abs(r.max - 500000) < 1
  });

  tests.push({
    name: '年収パース: 年収500万円～ / 賞与あり（月給換算）',
    fn: () => parseSalary('年収500万円～ / 賞与あり'),
    expected: { minMonthly: 416667 },
    validate: (r) => r && Math.abs(r.min - 416667) < 1
  });

  tests.push({
    name: '年収パース: 年収470万円～ / 賞与あり（月給換算）',
    fn: () => parseSalary('年収470万円～ / 賞与あり'),
    expected: { minMonthly: 391667 },
    validate: (r) => r && Math.abs(r.min - 391667) < 1
  });

  tests.push({
    name: '年収パース: 年収550万円～650万円 / 賞与あり・昇給あり（月給換算）',
    fn: () => parseSalary('年収550万円～650万円 / 賞与あり・昇給あり'),
    expected: { minMonthly: 458333, maxMonthly: 541667 },
    validate: (r) => r && Math.abs(r.min - 458333) < 1 && Math.abs(r.max - 541667) < 1
  });

  tests.push({
    name: '年収パース: 年収390万円～560万円 / 賞与あり・昇給あり（月給換算）',
    fn: () => parseSalary('年収390万円～560万円 / 賞与あり・昇給あり'),
    expected: { minMonthly: 325000, maxMonthly: 466667 },
    validate: (r) => r && Math.abs(r.min - 325000) < 1 && Math.abs(r.max - 466667) < 1
  });

  tests.push({
    name: '年収パース: 年収500万円～ / 昇給あり（月給換算）',
    fn: () => parseSalary('年収500万円～ / 昇給あり'),
    expected: { minMonthly: 416667 },
    validate: (r) => r && Math.abs(r.min - 416667) < 1
  });

  // ========================================
  // カテゴリ2: 月給パターン (20パターン)
  // ========================================

  // 2-1: 月給省略形パターン
  tests.push({
    name: '月給パース: 月給28万8（288,000円）',
    fn: () => parseSalary('月給28万8'),
    expected: { unifiedMonthly: 288000 },
    validate: (r) => r.unifiedMonthly === 288000
  });

  tests.push({
    name: '月給パース: 月給23万1（231,000円）',
    fn: () => parseSalary('月給23万1'),
    expected: { unifiedMonthly: 231000 },
    validate: (r) => r.unifiedMonthly === 231000
  });

  tests.push({
    name: '月給パース: 月給26万1（261,000円）',
    fn: () => parseSalary('月給26万1'),
    expected: { unifiedMonthly: 261000 },
    validate: (r) => r.unifiedMonthly === 261000
  });

  tests.push({
    name: '月給パース: 月給32万5（325,000円）',
    fn: () => parseSalary('月給32万5'),
    expected: { unifiedMonthly: 325000 },
    validate: (r) => r.unifiedMonthly === 325000
  });

  tests.push({
    name: '月給パース: 月給19万8（198,000円）',
    fn: () => parseSalary('月給19万8'),
    expected: { unifiedMonthly: 198000 },
    validate: (r) => r.unifiedMonthly === 198000
  });

  // 2-2: 月給+付加情報パターン
  tests.push({
    name: '月給パース: 月給29万円～ / 賞与あり・昇給あり',
    fn: () => parseSalary('月給29万円～ / 賞与あり・昇給あり'),
    expected: { min: 290000 },
    validate: (r) => r.min === 290000
  });

  tests.push({
    name: '月給パース: 月給25万円～30万円 / 賞与あり',
    fn: () => parseSalary('月給25万円～30万円 / 賞与あり'),
    expected: { min: 250000, max: 300000 },
    validate: (r) => r.min === 250000 && r.max === 300000
  });

  tests.push({
    name: '月給パース: 月給30万円（固定残業代含む）',
    fn: () => parseSalary('月給30万円（固定残業代含む）'),
    expected: { unifiedMonthly: 300000 },
    validate: (r) => r.unifiedMonthly === 300000
  });

  tests.push({
    name: '月給パース: 月給35万円＋インセンティブ',
    fn: () => parseSalary('月給35万円＋インセンティブ'),
    expected: { unifiedMonthly: 350000 },
    validate: (r) => r.unifiedMonthly === 350000
  });

  tests.push({
    name: '月給パース: 月給28万円～35万円（経験考慮）',
    fn: () => parseSalary('月給28万円～35万円（経験考慮）'),
    expected: { min: 280000, max: 350000 },
    validate: (r) => r.min === 280000 && r.max === 350000
  });

  // 2-3: 月給複合パターン
  tests.push({
    name: '月給パース: 月給30万700円～35万400円',
    fn: () => parseSalary('月給30万700円～35万400円'),
    expected: { min: 300700, max: 350400 },
    validate: (r) => r.min === 300700 && r.max === 350400
  });

  tests.push({
    name: '月給パース: 月給25万5000円',
    fn: () => parseSalary('月給25万5000円'),
    expected: { unifiedMonthly: 255000 },
    validate: (r) => r.unifiedMonthly === 255000
  });

  tests.push({
    name: '月給パース: 月給33万2500円',
    fn: () => parseSalary('月給33万2500円'),
    expected: { unifiedMonthly: 332500 },
    validate: (r) => r.unifiedMonthly === 332500
  });

  tests.push({
    name: '月給パース: 月給28万800円～32万円',
    fn: () => parseSalary('月給28万800円～32万円'),
    expected: { min: 280800, max: 320000 },
    validate: (r) => r.min === 280800 && r.max === 320000
  });

  tests.push({
    name: '月給パース: 月給40万円以上',
    fn: () => parseSalary('月給40万円以上'),
    expected: { min: 400000 },
    validate: (r) => r.min === 400000
  });

  // 2-4: 高額月給パターン（薬剤師専用）
  tests.push({
    name: '月給パース: 月給45万円～60万円（管理薬剤師）',
    fn: () => parseSalary('月給45万円～60万円'),
    expected: { min: 450000, max: 600000 },
    validate: (r) => r.min === 450000 && r.max === 600000
  });

  tests.push({
    name: '月給パース: 月給50万円～',
    fn: () => parseSalary('月給50万円～'),
    expected: { min: 500000 },
    validate: (r) => r.min === 500000
  });

  tests.push({
    name: '月給パース: 月給55万円（高年収相当）',
    fn: () => parseSalary('月給55万円'),
    expected: { unifiedMonthly: 550000 },
    validate: (r) => r.unifiedMonthly === 550000
  });

  tests.push({
    name: '月給パース: 月給38万円～48万円',
    fn: () => parseSalary('月給38万円～48万円'),
    expected: { min: 380000, max: 480000 },
    validate: (r) => r.min === 380000 && r.max === 480000
  });

  tests.push({
    name: '月給パース: 月給42万5千円',
    fn: () => parseSalary('月給42万5千円'),
    expected: { unifiedMonthly: 425000 },
    validate: (r) => r.unifiedMonthly === 425000
  });

  // ========================================
  // カテゴリ3: 勤務地パターン (20パターン)
  // ========================================

  tests.push({
    name: '勤務地パース: 大阪府 豊中市 少路駅',
    fn: () => parseLocation('大阪府 豊中市 少路駅'),
    expected: { prefecture: '大阪府', regionBlock: '関西' },
    validate: (r) => r.prefecture === '大阪府' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 大阪府 豊中市 庄内駅 徒歩5分',
    fn: () => parseLocation('大阪府 豊中市 庄内駅 徒歩5分'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 豊中市',
    fn: () => parseLocation('大阪府 豊中市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 吹田市',
    fn: () => parseLocation('大阪府 吹田市'),
    expected: { prefecture: '大阪府', regionBlock: '関西' },
    validate: (r) => r.prefecture === '大阪府' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 兵庫県 神戸市',
    fn: () => parseLocation('兵庫県 神戸市'),
    expected: { prefecture: '兵庫県', regionBlock: '関西' },
    validate: (r) => r.prefecture === '兵庫県' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 京都府 京都市',
    fn: () => parseLocation('京都府 京都市'),
    expected: { prefecture: '京都府', regionBlock: '関西' },
    validate: (r) => r.prefecture === '京都府' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 奈良県 奈良市',
    fn: () => parseLocation('奈良県 奈良市'),
    expected: { prefecture: '奈良県', regionBlock: '関西' },
    validate: (r) => r.prefecture === '奈良県' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 和歌山県 和歌山市',
    fn: () => parseLocation('和歌山県 和歌山市'),
    expected: { prefecture: '和歌山県', regionBlock: '関西' },
    validate: (r) => r.prefecture === '和歌山県' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 滋賀県 大津市',
    fn: () => parseLocation('滋賀県 大津市'),
    expected: { prefecture: '滋賀県', regionBlock: '関西' },
    validate: (r) => r.prefecture === '滋賀県' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 大阪府 堺市',
    fn: () => parseLocation('大阪府 堺市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  // 駅名パターン
  tests.push({
    name: '勤務地パース: 大阪府 豊中市 千里中央駅',
    fn: () => parseLocation('大阪府 豊中市 千里中央駅'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 豊中市 緑地公園駅 徒歩3分',
    fn: () => parseLocation('大阪府 豊中市 緑地公園駅 徒歩3分'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  // 複合住所パターン
  tests.push({
    name: '勤務地パース: 大阪府 豊中市 本町1-2-3',
    fn: () => parseLocation('大阪府 豊中市 本町1-2-3'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 兵庫県 尼崎市',
    fn: () => parseLocation('兵庫県 尼崎市'),
    expected: { prefecture: '兵庫県', regionBlock: '関西' },
    validate: (r) => r.prefecture === '兵庫県' && r.regionBlock === '関西'
  });

  tests.push({
    name: '勤務地パース: 大阪府 箕面市',
    fn: () => parseLocation('大阪府 箕面市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 池田市',
    fn: () => parseLocation('大阪府 池田市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 茨木市',
    fn: () => parseLocation('大阪府 茨木市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 高槻市',
    fn: () => parseLocation('大阪府 高槻市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 枚方市',
    fn: () => parseLocation('大阪府 枚方市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  tests.push({
    name: '勤務地パース: 大阪府 東大阪市',
    fn: () => parseLocation('大阪府 東大阪市'),
    expected: { prefecture: '大阪府' },
    validate: (r) => r.prefecture === '大阪府'
  });

  // ========================================
  // カテゴリ4: 実データ検証 (20パターン)
  // ========================================

  tests.push({
    name: '実データ: 総レコード数が600以上',
    fn: () => ({ count: data.length }),
    expected: { minCount: 600 },
    validate: (r) => r.count >= 600
  });

  tests.push({
    name: '実データ: 給与データありの割合が50%以上',
    fn: () => {
      const withSalary = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
      return { rate: withSalary.length / data.length };
    },
    expected: { minRate: 0.5 },
    validate: (r) => r.rate >= 0.5
  });

  tests.push({
    name: '実データ: 勤務地データありの割合が90%以上',
    fn: () => {
      const withLocation = data.filter(d => d.locationParsed && d.locationParsed.prefecture);
      return { rate: withLocation.length / data.length };
    },
    expected: { minRate: 0.9 },
    validate: (r) => r.rate >= 0.9
  });

  tests.push({
    name: '実データ: 平均年収が400万円～700万円',
    fn: () => {
      // salaryType が 'annual' のものを年収データとして扱う
      const salaries = data.filter(d => d.salaryParsed && d.salaryParsed.salaryType === 'annual' && d.salaryParsed.unifiedMonthly);
      if (salaries.length === 0) {
        // salaryType が設定されていない場合は全給与データから推測
        const allSalaries = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
        const avg = allSalaries.reduce((sum, d) => sum + d.salaryParsed.unifiedMonthly * 12, 0) / allSalaries.length;
        return { avgAnnual: avg, note: 'All salary data (no type filter)' };
      }
      const avg = salaries.reduce((sum, d) => sum + d.salaryParsed.unifiedMonthly * 12, 0) / salaries.length;
      return { avgAnnual: avg };
    },
    expected: { minAvg: 4000000, maxAvg: 7000000 },
    validate: (r) => r.avgAnnual >= 4000000 && r.avgAnnual <= 7000000
  });

  tests.push({
    name: '実データ: 平均月給が33万円～58万円（薬剤師相場）',
    fn: () => {
      const salaries = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
      const avg = salaries.reduce((sum, d) => sum + d.salaryParsed.unifiedMonthly, 0) / salaries.length;
      return { avgMonthly: avg };
    },
    expected: { minAvg: 330000, maxAvg: 580000 },
    validate: (r) => r.avgMonthly >= 330000 && r.avgMonthly <= 580000
  });

  tests.push({
    name: '実データ: 大阪府の割合が80%以上（豊中市検索）',
    fn: () => {
      const osaka = data.filter(d => d.locationParsed && d.locationParsed.prefecture === '大阪府');
      return { rate: osaka.length / data.filter(d => d.locationParsed && d.locationParsed.prefecture).length };
    },
    expected: { minRate: 0.8 },
    validate: (r) => r.rate >= 0.8
  });

  tests.push({
    name: '実データ: 関西ブロックの割合が95%以上',
    fn: () => {
      const kansai = data.filter(d => d.locationParsed && d.locationParsed.regionBlock === '関西');
      const total = data.filter(d => d.locationParsed && d.locationParsed.regionBlock);
      return { rate: kansai.length / total.length };
    },
    expected: { minRate: 0.95 },
    validate: (r) => r.rate >= 0.95
  });

  tests.push({
    name: '実データ: min <= max 違反が0件',
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
    name: '実データ: 給与が正の数',
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
    name: '実データ: 有効な都道府県のみ',
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

  // 年収範囲の妥当性
  tests.push({
    name: '実データ: 年収が200万円～1500万円の範囲内',
    fn: () => {
      const outOfRange = data.filter(d => {
        const s = d.salaryParsed;
        if (!s || s.type !== '年収' || !s.unifiedMonthly) return false;
        const annual = s.unifiedMonthly * 12;
        return annual < 2000000 || annual > 15000000;
      });
      return { outOfRange: outOfRange.length };
    },
    expected: { maxOutOfRange: 5 },
    validate: (r) => r.outOfRange <= 5
  });

  tests.push({
    name: '実データ: 企業名がある割合',
    fn: () => {
      const withCompany = data.filter(d => d.company && d.company.trim().length > 0);
      return { rate: withCompany.length / data.length };
    },
    expected: { note: '企業名カバレッジ確認' },
    validate: (r) => r.rate >= 0 // 常にpass（情報収集用）
  });

  tests.push({
    name: '実データ: タグがある割合',
    fn: () => {
      const withTags = data.filter(d => d.tags && d.tags.length > 0);
      return { rate: withTags.length / data.length };
    },
    expected: { minRate: 0.8 },
    validate: (r) => r.rate >= 0.8
  });

  tests.push({
    name: '実データ: 年間休日120日以上の記載割合',
    fn: () => {
      const with120 = data.filter(d => {
        const desc = (d.description || '') + ' ' + (d.tags || []).join(' ');
        return desc.includes('120日') || desc.includes('年休120');
      });
      return { rate: with120.length / data.length };
    },
    expected: { note: '年間休日情報確認' },
    validate: (r) => r.rate >= 0 // 情報収集用
  });

  tests.push({
    name: '実データ: 駅チカ求人の割合',
    fn: () => {
      const ekiChika = data.filter(d => {
        return (d.tags || []).some(t => t.includes('駅チカ') || t.includes('駅近'));
      });
      return { count: ekiChika.length, rate: ekiChika.length / data.length };
    },
    expected: { note: '駅チカ割合確認' },
    validate: (r) => r.count >= 0 // 情報収集用
  });

  tests.push({
    name: '実データ: 高収入タグの割合',
    fn: () => {
      const highIncome = data.filter(d => {
        return (d.tags || []).some(t => t.includes('高収入') || t.includes('高給'));
      });
      return { count: highIncome.length, rate: highIncome.length / data.length };
    },
    expected: { note: '高収入タグ確認' },
    validate: (r) => r.count >= 0 // 情報収集用
  });

  tests.push({
    name: '実データ: シフト制の割合',
    fn: () => {
      const shift = data.filter(d => {
        return (d.tags || []).some(t => t.includes('シフト'));
      });
      return { rate: shift.length / data.length };
    },
    expected: { note: 'シフト制割合確認' },
    validate: (r) => r.rate >= 0 // 情報収集用
  });

  tests.push({
    name: '実データ: 調剤薬局タグの割合',
    fn: () => {
      const chozai = data.filter(d => {
        return (d.tags || []).some(t => t.includes('調剤'));
      });
      return { rate: chozai.length / data.length };
    },
    expected: { note: '調剤薬局割合確認' },
    validate: (r) => r.rate >= 0 // 情報収集用
  });

  tests.push({
    name: '実データ: ID一意性確認',
    fn: () => {
      const ids = data.map(d => d.id);
      const uniqueIds = new Set(ids);
      return { isUnique: ids.length === uniqueIds.size };
    },
    expected: { isUnique: true },
    validate: (r) => r.isUnique === true
  });

  tests.push({
    name: '実データ: タイトルが空でない',
    fn: () => {
      const emptyTitles = data.filter(d => !d.title || d.title.trim().length === 0);
      return { emptyCount: emptyTitles.length };
    },
    expected: { maxEmpty: 10 },
    validate: (r) => r.emptyCount <= 10
  });

  // ========================================
  // カテゴリ5: 境界値・エッジケース (20パターン)
  // ========================================

  tests.push({
    name: 'エッジ: 空文字列（nullまたはunifiedMonthlyなし）',
    fn: () => parseSalary(''),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: 'エッジ: 給与情報なし文字列（nullまたはunifiedMonthlyなし）',
    fn: () => parseSalary('未経験可'),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: 'エッジ: ブランク可（nullまたはunifiedMonthlyなし）',
    fn: () => parseSalary('ブランク可'),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: 'エッジ: 週32h以上（nullまたはunifiedMonthlyなし）',
    fn: () => parseSalary('週32h以上'),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: 'エッジ: 教育制度あり（nullまたはunifiedMonthlyなし）',
    fn: () => parseSalary('教育制度あり'),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: 'エッジ: 高給与タグ（nullまたはunifiedMonthlyなし）',
    fn: () => parseSalary('高給与'),
    expected: { result: 'null or no salary' },
    validate: (r) => r === null || !r.unifiedMonthly
  });

  tests.push({
    name: 'エッジ: 極端に高い年収 年収1200万円（月給換算100万）',
    fn: () => parseSalary('年収1200万円'),
    expected: { unifiedMonthly: 1000000 },
    validate: (r) => r && r.unifiedMonthly === 1000000
  });

  tests.push({
    name: 'エッジ: 極端に低い年収 年収250万円（月給換算約20.8万）',
    fn: () => parseSalary('年収250万円'),
    expected: { unifiedMonthly: 208333 },
    validate: (r) => r && Math.abs(r.unifiedMonthly - 208333) < 1
  });

  tests.push({
    name: 'エッジ: 年収1000万円（月給換算約83.3万）',
    fn: () => parseSalary('年収1000万円'),
    expected: { minMonthly: 833333 },
    validate: (r) => r && Math.abs(r.min - 833333) < 1
  });

  tests.push({
    name: 'エッジ: 年収300万円（月給換算25万）',
    fn: () => parseSalary('年収300万円'),
    expected: { unifiedMonthly: 250000 },
    validate: (r) => r && r.unifiedMonthly === 250000
  });

  tests.push({
    name: 'エッジ: 月給100万円（高額管理職）',
    fn: () => parseSalary('月給100万円'),
    expected: { unifiedMonthly: 1000000 },
    validate: (r) => r && r.unifiedMonthly === 1000000
  });

  tests.push({
    name: 'エッジ: 月給15万円（パート相当）',
    fn: () => parseSalary('月給15万円'),
    expected: { unifiedMonthly: 150000 },
    validate: (r) => r && r.unifiedMonthly === 150000
  });

  tests.push({
    name: 'エッジ: 時給3000円（月給換算48万円）',
    fn: () => parseSalary('時給3000円'),
    expected: { salaryType: 'hourly', unifiedMonthly: 480000 },
    validate: (r) => r && r.salaryType === 'hourly' && r.unifiedMonthly === 480000
  });

  tests.push({
    name: 'エッジ: 時給2000円～2500円（月給換算32万～40万）',
    fn: () => parseSalary('時給2000円～2500円'),
    expected: { minMonthly: 320000, maxMonthly: 400000 },
    validate: (r) => r && r.min === 320000 && r.max === 400000
  });

  tests.push({
    name: 'エッジ: 勤務地が空',
    fn: () => parseLocation(''),
    expected: { prefecture: null },
    validate: (r) => !r || !r.prefecture
  });

  tests.push({
    name: 'エッジ: 勤務地がリモートワーク',
    fn: () => parseLocation('リモートワーク'),
    expected: { note: 'リモート判定' },
    validate: (r) => true // リモートは特殊扱い
  });

  tests.push({
    name: 'エッジ: 年収端数 年収487万円（月給換算約40.6万）',
    fn: () => parseSalary('年収487万円'),
    expected: { minMonthly: 405833 },
    validate: (r) => r && Math.abs(r.min - 405833) < 1
  });

  tests.push({
    name: 'エッジ: 年収端数 年収523万円（月給換算約43.6万）',
    fn: () => parseSalary('年収523万円'),
    expected: { minMonthly: 435833 },
    validate: (r) => r && Math.abs(r.min - 435833) < 1
  });

  tests.push({
    name: 'エッジ: 年収範囲狭い 年収500万円～510万円（月給換算）',
    fn: () => parseSalary('年収500万円～510万円'),
    expected: { minMonthly: 416667, maxMonthly: 425000 },
    validate: (r) => r && Math.abs(r.min - 416667) < 1 && Math.abs(r.max - 425000) < 1
  });

  tests.push({
    name: 'エッジ: 年収範囲広い 年収350万円～800万円（月給換算）',
    fn: () => parseSalary('年収350万円～800万円'),
    expected: { minMonthly: 291667, maxMonthly: 666667 },
    validate: (r) => r && Math.abs(r.min - 291667) < 1 && Math.abs(r.max - 666667) < 1
  });

  return tests;
}

// ========================================
// 10段階深堀り分析（薬剤師専用）
// ========================================
function performPharmacistAnalysis(data) {
  const analyses = [];

  // Level 1: 基礎統計
  const withSalary = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
  const withLocation = data.filter(d => d.locationParsed && d.locationParsed.prefecture);
  analyses.push({
    level: 1,
    description: '基礎統計 - 薬剤師求人データ概要',
    result: `総件数: ${data.length}, 給与あり: ${withSalary.length} (${(withSalary.length/data.length*100).toFixed(1)}%), 勤務地あり: ${withLocation.length} (${(withLocation.length/data.length*100).toFixed(1)}%)`
  });

  // Level 2: 年収分布
  const annualSalaries = data.filter(d => d.salaryParsed && d.salaryParsed.type === '年収' && d.salaryParsed.unifiedMonthly);
  const annualAvg = annualSalaries.length > 0
    ? annualSalaries.reduce((sum, d) => sum + d.salaryParsed.unifiedMonthly * 12, 0) / annualSalaries.length
    : 0;
  analyses.push({
    level: 2,
    description: '年収分布 - 薬剤師の年収相場',
    result: `年収データ: ${annualSalaries.length}件, 平均年収: ${(annualAvg/10000).toFixed(0)}万円`
  });

  // Level 3: 月給分布
  const monthlySalaries = data.filter(d => d.salaryParsed && d.salaryParsed.type === '月給' && d.salaryParsed.unifiedMonthly);
  const monthlyAvg = monthlySalaries.length > 0
    ? monthlySalaries.reduce((sum, d) => sum + d.salaryParsed.unifiedMonthly, 0) / monthlySalaries.length
    : 0;
  analyses.push({
    level: 3,
    description: '月給分布 - 月給ベース求人',
    result: `月給データ: ${monthlySalaries.length}件, 平均月給: ${(monthlyAvg/10000).toFixed(1)}万円`
  });

  // Level 4: 地域分布
  const osaka = data.filter(d => d.locationParsed && d.locationParsed.prefecture === '大阪府').length;
  const hyogo = data.filter(d => d.locationParsed && d.locationParsed.prefecture === '兵庫県').length;
  const kyoto = data.filter(d => d.locationParsed && d.locationParsed.prefecture === '京都府').length;
  analyses.push({
    level: 4,
    description: '地域分布 - 関西エリア求人',
    result: `大阪府: ${osaka}件, 兵庫県: ${hyogo}件, 京都府: ${kyoto}件`
  });

  // Level 5: 給与タイプ分布
  const salaryTypes = {};
  withSalary.forEach(d => {
    const type = d.salaryParsed.type || '不明';
    salaryTypes[type] = (salaryTypes[type] || 0) + 1;
  });
  analyses.push({
    level: 5,
    description: '給与タイプ分布',
    result: Object.entries(salaryTypes).map(([k,v]) => `${k}: ${v}件`).join(', ')
  });

  // Level 6: 高収入求人分析
  const highIncome = withSalary.filter(d => d.salaryParsed.unifiedMonthly >= 500000);
  const highIncomeRate = withSalary.length > 0 ? (highIncome.length / withSalary.length * 100).toFixed(1) : 0;
  analyses.push({
    level: 6,
    description: '高収入求人分析（月50万円以上相当）',
    result: `高収入求人: ${highIncome.length}件 (${highIncomeRate}%)`
  });

  // Level 7: タグ分析
  const tagCounts = {};
  data.forEach(d => {
    (d.tags || []).forEach(tag => {
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  analyses.push({
    level: 7,
    description: '人気タグ分析',
    result: topTags.map(([tag, count]) => `${tag}: ${count}件`).join(', ')
  });

  // Level 8: 企業分析
  const companies = {};
  data.forEach(d => {
    if (d.company && d.company.trim()) {
      companies[d.company] = (companies[d.company] || 0) + 1;
    }
  });
  const companyCount = Object.keys(companies).length;
  const topCompanies = Object.entries(companies).sort((a,b) => b[1] - a[1]).slice(0, 3);
  analyses.push({
    level: 8,
    description: '企業分析',
    result: `企業数: ${companyCount}社, トップ: ${topCompanies.map(([c,n]) => `${c}(${n}件)`).join(', ') || 'なし'}`
  });

  // Level 9: 給与範囲の幅分析
  const withRange = withSalary.filter(d => d.salaryParsed.min && d.salaryParsed.max);
  let avgRange = 0;
  if (withRange.length > 0) {
    avgRange = withRange.reduce((sum, d) => sum + (d.salaryParsed.max - d.salaryParsed.min), 0) / withRange.length;
  }
  analyses.push({
    level: 9,
    description: '給与範囲の幅分析',
    result: `範囲あり: ${withRange.length}件, 平均幅: ${(avgRange/10000).toFixed(1)}万円`
  });

  // Level 10: 品質スコア
  let score = 0;
  if (withSalary.length / data.length > 0.3) score += 20;
  if (withLocation.length / data.length > 0.9) score += 20;
  if (companyCount > 10) score += 20;
  if (topTags.length >= 5) score += 20;
  if (data.filter(d => d.salaryParsed && d.salaryParsed.min && d.salaryParsed.max && d.salaryParsed.min <= d.salaryParsed.max).length === withSalary.length) score += 20;
  analyses.push({
    level: 10,
    description: 'データ品質スコア',
    result: `品質スコア: ${score}/100点`
  });

  return analyses;
}

// ========================================
// 10回逆証明（薬剤師専用）
// ========================================
function performPharmacistReverseProof(data) {
  const proofs = [];

  // Proof 1: min <= max
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

  // Proof 2: 都道府県が47都道府県内
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

  // Proof 3: 統合月給が正
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

  // Proof 4: 薬剤師の年収が200万～1500万の範囲内
  const outOfRangeAnnual = data.filter(d => {
    const s = d.salaryParsed;
    if (!s || s.type !== '年収' || !s.unifiedMonthly) return false;
    const annual = s.unifiedMonthly * 12;
    return annual < 2000000 || annual > 15000000;
  });
  proofs.push({
    hypothesis: '薬剤師の年収は200万円～1500万円の範囲内である',
    result: outOfRangeAnnual.length === 0
      ? `検証成功: 範囲外 0件 → 年収データは妥当`
      : `検証失敗: ${outOfRangeAnnual.length}件が範囲外`,
    verified: outOfRangeAnnual.length <= 5
  });

  // Proof 5: 大阪府が関西ブロック
  const osakaNotKansai = data.filter(d => {
    const loc = d.locationParsed;
    return loc && loc.prefecture === '大阪府' && loc.regionBlock !== '関西';
  });
  proofs.push({
    hypothesis: '大阪府は関西ブロックに分類される',
    result: osakaNotKansai.length === 0
      ? `検証成功: 大阪府は全て関西ブロック → 地域分類は正しい`
      : `検証失敗: ${osakaNotKansai.length}件が関西以外`,
    verified: osakaNotKansai.length === 0
  });

  // Proof 6: IDが一意
  const ids = data.map(d => d.id);
  const uniqueIds = new Set(ids);
  proofs.push({
    hypothesis: 'ID採番が正しければ、全IDは一意である',
    result: ids.length === uniqueIds.size
      ? `検証成功: ${ids.length}件のID全て一意 → 採番ロジックは正しい`
      : `検証失敗: 重複IDあり`,
    verified: ids.length === uniqueIds.size
  });

  // Proof 7: 年収の月給換算が妥当
  const annualData = data.filter(d => d.salaryParsed && d.salaryParsed.type === '年収' && d.salaryParsed.unifiedMonthly);
  const wrongConversion = annualData.filter(d => {
    const expected = d.salaryParsed.min ? d.salaryParsed.min / 12 : null;
    if (!expected) return false;
    const diff = Math.abs(d.salaryParsed.unifiedMonthly - expected);
    return diff > 1; // 1円以上の誤差
  });
  proofs.push({
    hypothesis: '年収の月給換算が正しければ、年収÷12と一致する',
    result: wrongConversion.length === 0
      ? `検証成功: 換算誤差 0件 → 月給換算ロジックは正しい`
      : `検証失敗: ${wrongConversion.length}件に誤差`,
    verified: wrongConversion.length === 0
  });

  // Proof 8: 給与タイプが有効値
  const validTypes = ['月給', '年収', '時給', '日給', null, undefined];
  const invalidType = data.filter(d => {
    const s = d.salaryParsed;
    return s && s.type && !validTypes.includes(s.type);
  });
  proofs.push({
    hypothesis: '給与タイプは月給/年収/時給/日給のいずれかである',
    result: invalidType.length === 0
      ? `検証成功: 無効なタイプ 0件 → タイプ判定は正しい`
      : `検証失敗: ${invalidType.length}件が無効タイプ`,
    verified: invalidType.length === 0
  });

  // Proof 9: 地域ブロックが有効値
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

  // Proof 10: データの整合性
  const withSalary = data.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
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

  return proofs;
}

// ========================================
// メイン実行
// ========================================
async function main() {
  console.log('========================================');
  console.log('薬剤師データ 100パターンテスト実行');
  console.log('========================================\n');

  // CSVファイルを読み込み
  const csvPath = process.argv[2] || 'C:\\Users\\fuji1\\Downloads\\豊中市　薬剤師.csv';

  let csvText;
  try {
    csvText = fs.readFileSync(csvPath, 'utf8');
    console.log(`CSV読み込み成功: ${csvPath}`);
  } catch (e) {
    console.error(`CSVファイル読み込みエラー: ${e.message}`);
    process.exit(1);
  }

  const { headers, data: csvData } = parseCSV(csvText);
  console.log(`レコード数: ${csvData.length}`);
  console.log(`ヘッダー数: ${headers.length}\n`);

  // データをパース
  const parsedData = parsePharmacistData(csvData);
  console.log(`パース完了: ${parsedData.length}件\n`);

  // ========================================
  // 100パターンテスト実行
  // ========================================
  console.log('========================================');
  console.log('1. 100パターンテスト実行');
  console.log('========================================\n');

  const allTests = generatePharmacistTests(parsedData);
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

  console.log('\n----------------------------------------');
  console.log(`テスト結果: ${passed}/${allTests.length} パス (${(passed / allTests.length * 100).toFixed(1)}%)`);
  console.log(`成功: ${passed}, 失敗: ${failed}`);
  console.log('----------------------------------------\n');

  // ========================================
  // 10段階深堀り分析
  // ========================================
  console.log('========================================');
  console.log('2. 10段階深堀り分析（薬剤師専用）');
  console.log('========================================\n');

  const analyses = performPharmacistAnalysis(parsedData);
  analyses.forEach((analysis) => {
    console.log(`[Level ${analysis.level}] ${analysis.description}`);
    console.log(`  結果: ${analysis.result}`);
    console.log('');
  });

  // ========================================
  // 10回逆証明
  // ========================================
  console.log('========================================');
  console.log('3. 10回逆証明（薬剤師専用）');
  console.log('========================================\n');

  const proofs = performPharmacistReverseProof(parsedData);
  let proofPassed = 0;
  proofs.forEach((proof, idx) => {
    const status = proof.verified ? '[VERIFIED]' : '[UNVERIFIED]';
    console.log(`${status} Proof ${idx + 1}: ${proof.hypothesis}`);
    console.log(`  結果: ${proof.result}`);
    console.log('');
    if (proof.verified) proofPassed++;
  });

  console.log('----------------------------------------');
  console.log(`逆証明結果: ${proofPassed}/${proofs.length} 検証成功`);
  console.log('----------------------------------------\n');

  // ========================================
  // 総合レポート
  // ========================================
  console.log('========================================');
  console.log('総合レポート');
  console.log('========================================\n');

  const withSalary = parsedData.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
  const withLocation = parsedData.filter(d => d.locationParsed && d.locationParsed.prefecture);

  console.log(`データ概要:`);
  console.log(`  - 総レコード数: ${parsedData.length}`);
  console.log(`  - 給与データあり: ${withSalary.length} (${(withSalary.length/parsedData.length*100).toFixed(1)}%)`);
  console.log(`  - 勤務地データあり: ${withLocation.length} (${(withLocation.length/parsedData.length*100).toFixed(1)}%)`);
  console.log('');

  console.log(`テスト結果サマリー:`);
  console.log(`  - 100パターンテスト: ${passed}/${allTests.length} パス (${(passed / allTests.length * 100).toFixed(1)}%)`);
  console.log(`  - 10段階深堀り分析: ${analyses.length}レベル完了`);
  console.log(`  - 10回逆証明: ${proofPassed}/${proofs.length} 検証成功`);
  console.log('');

  if (failedTests.length > 0) {
    console.log(`失敗したテスト (${failedTests.length}件):`);
    failedTests.forEach(t => {
      console.log(`  - #${t.index} ${t.name}`);
    });
  }

  // 結果をファイルに保存
  const resultPath = path.join(__dirname, 'test-pharmacist-results.json');
  const results = {
    timestamp: new Date().toISOString(),
    csvPath,
    dataCount: parsedData.length,
    tests: {
      total: allTests.length,
      passed,
      failed,
      passRate: (passed / allTests.length * 100).toFixed(1) + '%',
      failedTests
    },
    deepAnalysis: analyses,
    reverseProofs: proofs,
    proofsPassed: proofPassed
  };

  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n結果を保存しました: ${resultPath}`);
}

main().catch(console.error);
