/**
 * 実データテスト - 企業ランキング・地域×給与クロス分析
 */
const fs = require('fs');
const path = require('path');

// test-functions.jsを読み込み
const code = fs.readFileSync('test-functions.js', 'utf-8');
eval(code);

// CSV読み込み
function loadCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/("([^"]|"")*"|[^,]*)/g) || [];
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = (values[idx] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    });
    records.push(record);
  }
  return records;
}

// データ解析（Indeed用）
function parseIndeedData(records) {
  return records.map((r, idx) => {
    const salaryText = r['給与'] || r['salary'] || '';
    const locationText = r['勤務地'] || r['location'] || '';
    const company = r['企業名'] || r['company'] || r['会社名'] || '';
    const employmentText = r['雇用形態'] || r['employment_type'] || '';
    const tags = r['特徴'] || r['tags'] || '';
    
    return {
      id: idx + 1,
      company: company,
      salaryParsed: parseSalary(salaryText),
      locationParsed: parseLocation(locationText),
      employmentParsed: parseEmployment(employmentText),
      tagsParsed: { tags: tags ? tags.split(/[,、]/).map(t => t.trim()).filter(t => t) : [] }
    };
  });
}

// テスト実行
function runTest(filePath, dataType) {
  console.log('\n' + '='.repeat(60));
  console.log('テスト: ' + path.basename(filePath));
  console.log('データタイプ: ' + dataType);
  console.log('='.repeat(60));
  
  const records = loadCSV(filePath);
  console.log('レコード数: ' + records.length);
  
  const parsedData = parseIndeedData(records);
  
  // 給与データがある件数
  const withSalary = parsedData.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
  console.log('給与データあり: ' + withSalary.length + '件 (' + Math.round(withSalary.length / parsedData.length * 100) + '%)');
  
  // 地域データがある件数
  const withLocation = parsedData.filter(d => d.locationParsed && d.locationParsed.prefecture);
  console.log('地域データあり: ' + withLocation.length + '件 (' + Math.round(withLocation.length / parsedData.length * 100) + '%)');
  
  // 企業名がある件数
  const withCompany = parsedData.filter(d => d.company && d.company !== '不明' && d.company !== '');
  console.log('企業名あり: ' + withCompany.length + '件 (' + Math.round(withCompany.length / parsedData.length * 100) + '%)');
  
  console.log('\n--- 企業ランキング分析 ---');
  const companyResult = createCompanyAggregation(parsedData);
  console.log('総企業数: ' + companyResult.totalCompanies);
  
  if (companyResult.topByCount.length > 0) {
    console.log('\n求人数TOP5:');
    companyResult.topByCount.slice(0, 5).forEach((c, i) => {
      console.log('  ' + (i+1) + '. ' + c.name + ': ' + c.jobCount + '件, 平均=' + (c.avgSalaryMan || '-') + '万, 下限中央=' + (c.minMedianMan || '-') + '万, 上限中央=' + (c.maxMedianMan || '-') + '万');
    });
    
    // 上限中央値でソート
    const sortedByMaxMedian = companyResult.topBySalary.filter(c => c.maxMedianMan).sort((a, b) => (b.maxMedianMan || 0) - (a.maxMedianMan || 0));
    if (sortedByMaxMedian.length > 0) {
      console.log('\n上限中央値TOP5:');
      sortedByMaxMedian.slice(0, 5).forEach((c, i) => {
        console.log('  ' + (i+1) + '. ' + c.name + ': 下限=' + (c.minMedianMan || '-') + '万, 上限=' + (c.maxMedianMan || '-') + '万, ' + c.jobCount + '件');
      });
    }
  }
  
  console.log('\n--- 地域×給与クロス分析 ---');
  const regionResult = createRegionSalaryAnalysis(parsedData);
  console.log('有効データ: ' + (regionResult.totalWithData || 0) + '件');
  
  if (regionResult.hasData) {
    console.log('\n都道府県別TOP5:');
    (regionResult.prefectureSalaryList || []).slice(0, 5).forEach((p, i) => {
      console.log('  ' + (i+1) + '. ' + p.name + ': ' + p.count + '件, 平均=' + p.avgSalaryMan + '万, 中央=' + p.medianSalaryMan + '万');
    });
    
    console.log('\n地域ブロック別:');
    (regionResult.regionBlockSalaryList || []).forEach(r => {
      console.log('  ' + r.name + ': ' + r.count + '件, 平均=' + r.avgSalaryMan + '万, 中央=' + r.medianSalaryMan + '万');
    });
  } else {
    console.log('  (有効なデータなし)');
  }
  
  // サンプルデータ確認
  console.log('\n--- サンプルデータ確認（給与パース結果）---');
  const samples = withSalary.slice(0, 3);
  samples.forEach((d, i) => {
    console.log('  #' + (i+1) + ': min=' + d.salaryParsed.minValue + ', max=' + d.salaryParsed.maxValue + ', unified=' + d.salaryParsed.unifiedMonthly);
  });
  
  return { companyResult, regionResult, stats: { total: parsedData.length, withSalary: withSalary.length, withLocation: withLocation.length, withCompany: withCompany.length } };
}

// メイン
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-real-data.js <csv-file> [data-type]');
  process.exit(1);
}

const result = runTest(args[0], args[1] || 'unknown');
console.log('\n' + '='.repeat(60));
console.log('テスト完了');
console.log('='.repeat(60));
