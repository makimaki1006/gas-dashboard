/**
 * Node.js Test Runner for GAS Dashboard
 * 100パターンテスト + 10段階深堀り分析 + 10回逆証明
 */

const fs = require('fs');
const path = require('path');

// テスト関数を読み込み
const testFunctionsPath = path.join(__dirname, 'test-functions.js');
const testCasesPath = path.join(__dirname, 'test-cases.js');

// test-functions.js と test-cases.js を評価
eval(fs.readFileSync(testFunctionsPath, 'utf8'));
eval(fs.readFileSync(testCasesPath, 'utf8'));

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

// データをパースして構造化
function parseAllData(csvData) {
  return csvData.map((row, idx) => {
    return {
      id: idx,
      title: row['p-result_name'] || '',
      company: row['p-result_company'] || '',
      isNew: row['p-result_new'] || '',
      location: row['c-icon'] || '',
      salary: row['c-icon (2)'] || '',
      employmentType: row['c-icon (3)'] || '',
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
      employmentParsed: parseEmployment(row['c-icon (3)'] || ''),
      tagsParsed: { tags: [
        row['p-result_tag_feature--ver2'],
        row['p-result_tag_feature--ver2 (2)'],
        row['p-result_tag_feature--ver2 (3)'],
        row['p-result_tag_feature--ver2 (4)'],
        row['p-result_tag_feature--ver2 (5)'],
        row['p-result_tag_feature--ver2 (6)'],
        row['p-result_tag_feature--ver2 (7)']
      ].filter(t => t && t.trim()) },
      annualHolidays: extractAnnualHolidays(row['p-result_lines'] || '')
    };
  });
}

// メイン実行
async function main() {
  console.log('========================================');
  console.log('GAS Dashboard ローカルテスト実行');
  console.log('========================================\n');

  // CSVファイルを読み込み
  const csvPath = process.argv[2] || 'C:\\Users\\fuji1\\Downloads\\xn--pckua2a7gp15o89zb-2026-01-16.csv';

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
  const parsedData = parseAllData(csvData);
  console.log(`パース完了: ${parsedData.length}件\n`);

  // ========================================
  // 100パターンテスト実行
  // ========================================
  console.log('========================================');
  console.log('1. 100パターンテスト実行');
  console.log('========================================\n');

  const allTests = generate100PatternTests(parsedData);
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
  console.log('2. 10段階深堀り分析');
  console.log('========================================\n');

  const analyses = performDeepAnalysis(parsedData);
  analyses.forEach((analysis) => {
    console.log(`[Level ${analysis.level}] ${analysis.description}`);
    console.log(`  結果: ${analysis.result}`);
    console.log('');
  });

  // ========================================
  // 10回逆証明
  // ========================================
  console.log('========================================');
  console.log('3. 10回逆証明');
  console.log('========================================\n');

  const proofs = performReverseProof(parsedData);
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

  console.log(`データ概要:`);
  console.log(`  - 総レコード数: ${parsedData.length}`);
  console.log(`  - 給与データあり: ${parsedData.filter(d => d.salaryParsed && d.salaryParsed.unifiedMonthly).length}`);
  console.log(`  - 勤務地データあり: ${parsedData.filter(d => d.locationParsed && d.locationParsed.prefecture).length}`);
  console.log(`  - 雇用形態データあり: ${parsedData.filter(d => d.employmentParsed && d.employmentParsed.type).length}`);
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
  const resultPath = path.join(__dirname, 'test-results.json');
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
