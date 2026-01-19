/**
 * 実データ分析テスト - 企業ランキング・地域×給与クロス分析
 */
const fs = require('fs');
const path = require('path');

// test-functions.jsを読み込み
eval(fs.readFileSync(path.join(__dirname, 'test-functions.js'), 'utf-8'));

// CSVパーサー
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

// Indeedデータ用パーサー
function parseIndeedData(csvData, headers) {
  const hasJcsJobTitle = headers.includes('jcs-JobTitle');
  const hasCssBxyec3 = headers.includes('css-bxyec3');
  const hasCssLx9x6g = headers.includes('css-lx9x6g');

  return csvData.map((row, idx) => {
    let title, company, location, salary, employmentType;

    if (hasJcsJobTitle) {
      title = row['jcs-JobTitle'] || '';
      company = row['css-19eicqx'] || '';
      location = row['css-1f06pz4'] || '';
      salary = row['mosaic-provider-jobcards-1f1q1js'] || '';
      employmentType = row['mosaic-provider-jobcards-1f1q1js (2)'] || '';
    } else if (hasCssBxyec3 && hasCssLx9x6g) {
      title = row['css-bxyec3'] || '';
      company = row['css-14qk2ra'] || '';
      location = row['css-18rxko3'] || '';
      salary = row['css-lx9x6g'] || '';
      employmentType = row['css-1hwmqh1'] || '';
    } else if (hasCssBxyec3) {
      title = row['css-bxyec3'] || '';
      company = row['css-14qk2ra'] || '';
      location = row['css-18rxko3'] || '';
      salary = row['css-1qns26f'] || '';
      employmentType = row['css-1hwmqh1'] || '';
    }

    const tags = [];
    for (let i = 1; i <= 20; i++) {
      const tagKey = i === 1 ? 'jobsearch-JobCard-tag' : 'jobsearch-JobCard-tag (' + i + ')';
      if (row[tagKey] && row[tagKey].trim()) tags.push(row[tagKey].trim());
    }

    return {
      id: idx,
      title: title,
      company: company,
      salaryParsed: parseSalary(salary),
      locationParsed: parseLocation(location),
      employmentParsed: parseEmployment(employmentType),
      tagsParsed: { tags: tags }
    };
  });
}

// 求人ボックスデータ用パーサー
function parseKyujinBoxData(csvData, headers) {
  // カラム名を探す
  const salaryCol = headers.find(h => h.includes('給与') || h.includes('月給') || h.includes('年収'));
  const locationCol = headers.find(h => h.includes('勤務地') || h.includes('所在地'));
  const companyCol = headers.find(h => h.includes('企業名') || h.includes('会社名') || h.includes('掲載企業'));
  const employmentCol = headers.find(h => h.includes('雇用形態'));
  const tagsCol = headers.find(h => h.includes('特徴') || h.includes('こだわり'));

  console.log('  検出カラム: 給与=' + (salaryCol || 'なし') + ', 勤務地=' + (locationCol || 'なし') + ', 企業=' + (companyCol || 'なし'));

  return csvData.map((row, idx) => {
    const salary = salaryCol ? row[salaryCol] : '';
    const location = locationCol ? row[locationCol] : '';
    const company = companyCol ? row[companyCol] : '';
    const employmentType = employmentCol ? row[employmentCol] : '';
    const tagsStr = tagsCol ? row[tagsCol] : '';
    const tags = tagsStr ? tagsStr.split(/[,、／]/).map(t => t.trim()).filter(t => t) : [];

    return {
      id: idx,
      company: company,
      salaryParsed: parseSalary(salary),
      locationParsed: parseLocation(location),
      employmentParsed: parseEmployment(employmentType),
      tagsParsed: { tags: tags }
    };
  });
}

// テスト実行
function runTest(filePath, dataType) {
  console.log('\n' + '='.repeat(70));
  console.log('【' + dataType + '】 ' + path.basename(filePath));
  console.log('='.repeat(70));

  const content = fs.readFileSync(filePath, 'utf-8');
  const { headers, data } = parseCSV(content);
  console.log('レコード数: ' + data.length);
  console.log('カラム数: ' + headers.length);
  console.log('主要カラム: ' + headers.slice(0, 5).join(', ') + '...');

  let parsedData;
  if (dataType === 'Indeed') {
    parsedData = parseIndeedData(data, headers);
  } else {
    parsedData = parseKyujinBoxData(data, headers);
  }

  // 統計
  const withSalary = parsedData.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly);
  const withLocation = parsedData.filter(d => d.locationParsed && d.locationParsed.prefecture);
  const withCompany = parsedData.filter(d => d.company && d.company !== '不明' && d.company !== '');

  console.log('\n【データ品質】');
  console.log('  給与データあり: ' + withSalary.length + '件 (' + Math.round(withSalary.length / parsedData.length * 100) + '%)');
  console.log('  地域データあり: ' + withLocation.length + '件 (' + Math.round(withLocation.length / parsedData.length * 100) + '%)');
  console.log('  企業名あり: ' + withCompany.length + '件 (' + Math.round(withCompany.length / parsedData.length * 100) + '%)');

  // 企業ランキング
  console.log('\n【企業ランキング分析】');
  const companyResult = createCompanyAggregation(parsedData);
  console.log('  総企業数: ' + companyResult.totalCompanies);

  const validCompanies = companyResult.topByCount.filter(c => c.name !== '不明');
  if (validCompanies.length > 0) {
    console.log('\n  ▼ 求人数TOP5:');
    validCompanies.slice(0, 5).forEach((c, i) => {
      const name = c.name.length > 25 ? c.name.substring(0, 25) + '...' : c.name;
      console.log('    ' + (i+1) + '. ' + name + ': ' + c.jobCount + '件, 平均=' + (c.avgSalaryMan || '-') + '万');
    });

    const sortedByMaxMedian = companyResult.topBySalary
      .filter(c => c.maxMedianMan && c.name !== '不明')
      .sort((a, b) => (b.maxMedianMan || 0) - (a.maxMedianMan || 0));

    if (sortedByMaxMedian.length > 0) {
      console.log('\n  ▼ 上限中央値TOP5:');
      sortedByMaxMedian.slice(0, 5).forEach((c, i) => {
        const name = c.name.length > 25 ? c.name.substring(0, 25) + '...' : c.name;
        console.log('    ' + (i+1) + '. ' + name + ': 下限=' + (c.minMedianMan || '-') + '万, 上限=' + c.maxMedianMan + '万');
      });
    } else {
      console.log('\n  ※ 上限中央値データなし（給与レンジデータが不足）');
    }
  }

  // 地域×給与クロス分析
  console.log('\n【地域×給与クロス分析】');
  const regionResult = createRegionSalaryAnalysis(parsedData);
  console.log('  有効データ: ' + (regionResult.totalWithData || 0) + '件');

  if (regionResult.hasData) {
    console.log('\n  ▼ 都道府県別TOP5:');
    (regionResult.prefectureSalaryList || []).slice(0, 5).forEach((p, i) => {
      console.log('    ' + (i+1) + '. ' + p.name + ': ' + p.count + '件, 平均=' + p.avgSalaryMan + '万, 中央=' + p.medianSalaryMan + '万');
    });

    console.log('\n  ▼ 地域ブロック別:');
    (regionResult.regionBlockSalaryList || []).forEach(r => {
      console.log('    ' + r.name + ': ' + r.count + '件, 平均=' + r.avgSalaryMan + '万, 中央=' + r.medianSalaryMan + '万');
    });
  } else {
    console.log('  ※ 有効なデータなし（給与+地域の両方が必要）');
  }

  // サンプル
  if (withSalary.length > 0) {
    console.log('\n【給与パースサンプル（最初3件）】');
    withSalary.slice(0, 3).forEach((d, i) => {
      console.log('  #' + (i+1) + ': min=' + d.salaryParsed.minValue + ', max=' + d.salaryParsed.maxValue +
                  ', unified=' + d.salaryParsed.unifiedMonthly + ', type=' + d.salaryParsed.salaryType);
    });
  }

  return { companyResult, regionResult };
}

// メイン
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-real-analysis.js <csv-file> <Indeed|KyujinBox>');
  process.exit(1);
}

runTest(args[0], args[1] || 'Indeed');
console.log('\n' + '='.repeat(70));
console.log('テスト完了');
console.log('='.repeat(70));
