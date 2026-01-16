/**
 * E2Eテスト（Playwright使用）
 * ローカルHTMLでダッシュボード機能を検証
 *
 * 実行方法:
 * node tests/e2e/e2e_test.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// テスト結果
let testResults = { passed: 0, failed: 0, errors: [] };

function logTest(condition, testId, message) {
  if (condition) {
    testResults.passed++;
    console.log('✅ ' + testId + ': ' + message);
    return true;
  } else {
    testResults.failed++;
    testResults.errors.push(testId + ': ' + message);
    console.log('❌ ' + testId + ': ' + message);
    return false;
  }
}

async function runE2ETests() {
  console.log('========================================');
  console.log('E2Eテスト（Playwright）');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // HTMLファイルのパスを取得
  const htmlPath = path.join(__dirname, 'test_dashboard.html');

  if (!fs.existsSync(htmlPath)) {
    console.error('テストHTMLが見つかりません: ' + htmlPath);
    await browser.close();
    process.exit(1);
  }

  try {
    // ============================================================
    // Category A: 月給モードテスト
    // ============================================================
    console.log('=== Category A: 月給モードテスト ===');

    await page.goto('file://' + htmlPath);
    await page.waitForSelector('#salary-histogram');
    await page.waitForTimeout(1000); // Chart.js描画待ち

    // A01: ページタイトル
    const title = await page.title();
    logTest(title.includes('E2Eテスト'), 'A01', 'ページタイトル確認');

    // A02: サマリーカード表示
    const totalCount = await page.$eval('#total-count', el => el.textContent);
    logTest(parseInt(totalCount) > 0, 'A02', '総求人数表示: ' + totalCount);

    // A03: 平均給与表示
    const avgSalary = await page.$eval('#avg-salary', el => el.textContent);
    logTest(avgSalary.includes('万円'), 'A03', '平均月給表示: ' + avgSalary);

    // A04: 中央値表示
    const medianSalary = await page.$eval('#median-salary', el => el.textContent);
    logTest(medianSalary.includes('万円'), 'A04', '中央値表示: ' + medianSalary);

    // A05: 最頻値表示
    const modeSalary = await page.$eval('#mode-salary', el => el.textContent);
    logTest(modeSalary.includes('万円'), 'A05', '最頻値表示: ' + modeSalary);

    // A06: ヒストグラムラベル確認（生データ版）
    const labelsText = await page.$eval('#histogram-labels', el => el.textContent);
    logTest(labelsText.includes('25万'), 'A06', '25万ラベル存在');
    logTest(labelsText.includes('30万'), 'A07', '30万ラベル存在');

    // A08: 5万円刻みビニングがないことを確認
    // 生データ版では23万、27万など5の倍数でない値も存在可能
    logTest(labelsText.includes('23万') || labelsText.includes('27万') || labelsText.includes('26万'),
      'A08', '生データラベル存在（非5万刻み）');

    // A09: Chart.jsキャンバス存在
    const canvasExists = await page.$('#salary-histogram');
    logTest(canvasExists !== null, 'A09', 'ヒストグラムキャンバス存在');

    // A10: 内部テスト結果取得
    const monthlyTestResults = await page.evaluate(() => window.e2eTestResults);
    logTest(monthlyTestResults && monthlyTestResults.passed > 0, 'A10', '内部テスト成功: ' + (monthlyTestResults?.passed || 0) + '件');

    // ============================================================
    // Category B: 時給モード切替テスト
    // ============================================================
    console.log('\n=== Category B: 時給モード切替テスト ===');

    // B01: 時給モードに切替
    await page.click('#btn-hourly');
    await page.waitForTimeout(500);

    // B02: ボタンのactiveクラス確認
    const hourlyButtonActive = await page.$eval('#btn-hourly', el => el.classList.contains('active'));
    logTest(hourlyButtonActive, 'B01', '時給ボタンがactive');

    const monthlyButtonInactive = await page.$eval('#btn-monthly', el => !el.classList.contains('active'));
    logTest(monthlyButtonInactive, 'B02', '月給ボタンが非active');

    // B03: 平均時給表示
    const avgHourly = await page.$eval('#avg-salary', el => el.textContent);
    logTest(avgHourly.includes('円'), 'B03', '平均時給表示: ' + avgHourly);

    // B04: ラベルが円表示に変更
    const hourlyLabelsText = await page.$eval('#histogram-labels', el => el.textContent);
    logTest(hourlyLabelsText.includes('円'), 'B04', '時給ラベル（円）表示');

    // B05: 985円ラベル存在（生データ版 - ビニングなし）
    logTest(hourlyLabelsText.includes('985円'), 'B05', '985円ラベル存在（生データ）');

    // B06: 1005円ラベル存在（生データ版）
    logTest(hourlyLabelsText.includes('1005円'), 'B06', '1005円ラベル存在（生データ）');

    // B07: 900円ラベルがないこと（100円ビニング廃止）
    logTest(!hourlyLabelsText.includes('900円'), 'B07', '900円ラベルなし（ビニング廃止）');

    // B08: 内部テスト結果取得
    const hourlyTestResults = await page.evaluate(() => window.e2eTestResults);
    logTest(hourlyTestResults && hourlyTestResults.passed > 0, 'B08', '内部テスト成功: ' + (hourlyTestResults?.passed || 0) + '件');

    // ============================================================
    // Category C: モード再切替テスト
    // ============================================================
    console.log('\n=== Category C: モード再切替テスト ===');

    // C01: 月給モードに戻す
    await page.click('#btn-monthly');
    await page.waitForTimeout(500);

    // C02: 月給ボタンがactiveに戻る
    const monthlyButtonActiveAgain = await page.$eval('#btn-monthly', el => el.classList.contains('active'));
    logTest(monthlyButtonActiveAgain, 'C01', '月給ボタンがactive（再切替）');

    // C03: 平均月給表示に戻る
    const avgMonthlyAgain = await page.$eval('#avg-salary', el => el.textContent);
    logTest(avgMonthlyAgain.includes('万円'), 'C02', '平均月給表示に戻る');

    // C03: ラベルが万円に戻る
    const monthlyLabelsAgain = await page.$eval('#histogram-labels', el => el.textContent);
    logTest(monthlyLabelsAgain.includes('万'), 'C03', '月給ラベルに戻る');

    // ============================================================
    // Category D: チャート描画テスト
    // ============================================================
    console.log('\n=== Category D: チャート描画テスト ===');

    // D01: メインヒストグラムキャンバス
    const mainCanvas = await page.$('#salary-histogram');
    logTest(mainCanvas !== null, 'D01', 'メインヒストグラム存在');

    // D02: 下限ヒストグラムキャンバス
    const minCanvas = await page.$('#min-histogram');
    logTest(minCanvas !== null, 'D02', '下限ヒストグラム存在');

    // D03: 上限ヒストグラムキャンバス
    const maxCanvas = await page.$('#max-histogram');
    logTest(maxCanvas !== null, 'D03', '上限ヒストグラム存在');

    // D04: テスト結果セクション存在
    const testResultsSection = await page.$('.test-results');
    logTest(testResultsSection !== null, 'D04', 'テスト結果セクション存在');

    // D05: 成功テストが緑色で表示
    const passedTests = await page.$$('.test-pass');
    logTest(passedTests.length > 0, 'D05', '成功テスト表示: ' + passedTests.length + '件');

    // ============================================================
    // Category E: レスポンシブテスト
    // ============================================================
    console.log('\n=== Category E: レスポンシブテスト ===');

    // E01: ビューポートサイズ変更（モバイル）
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    const mobileTitle = await page.$('h1');
    logTest(mobileTitle !== null, 'E01', 'モバイルサイズでタイトル表示');

    // E02: ビューポートサイズ変更（タブレット）
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    const tabletCards = await page.$$('.stat-box');
    logTest(tabletCards.length === 4, 'E02', 'タブレットサイズでカード4つ表示');

    // E03: ビューポートサイズ変更（デスクトップ）
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);

    const desktopContainer = await page.$('.container');
    logTest(desktopContainer !== null, 'E03', 'デスクトップサイズでコンテナ表示');

    // ============================================================
    // Category F: エラーハンドリングテスト
    // ============================================================
    console.log('\n=== Category F: エラーハンドリングテスト ===');

    // F01: コンソールエラーがないことを確認
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ページを再読み込みしてエラーチェック
    await page.reload();
    await page.waitForTimeout(1000);

    logTest(consoleErrors.length === 0, 'F01', 'コンソールエラーなし');

    // F02: JavaScriptエラーがないことを確認
    let jsError = false;
    page.on('pageerror', error => {
      jsError = true;
      console.log('  JS Error:', error.message);
    });

    await page.click('#btn-hourly');
    await page.click('#btn-monthly');
    await page.waitForTimeout(500);

    logTest(!jsError, 'F02', 'JavaScriptエラーなし');

  } catch (error) {
    console.error('テスト実行エラー:', error);
    testResults.failed++;
    testResults.errors.push('実行エラー: ' + error.message);
  } finally {
    await browser.close();
  }

  // ============================================================
  // 結果サマリー
  // ============================================================
  console.log('\n========================================');
  console.log('E2Eテスト結果サマリー');
  console.log('========================================');
  console.log('成功: ' + testResults.passed);
  console.log('失敗: ' + testResults.failed);
  console.log('合計: ' + (testResults.passed + testResults.failed));
  console.log('成功率: ' + Math.round(testResults.passed / (testResults.passed + testResults.failed) * 100) + '%');

  if (testResults.errors.length > 0) {
    console.log('\n失敗したテスト:');
    testResults.errors.forEach(err => {
      console.log('  - ' + err);
    });
  }

  console.log('\n========================================');
  console.log('E2E検証ポイント');
  console.log('========================================');
  console.log('✓ 月給モード: 万円表示、生データラベル');
  console.log('✓ 時給モード: 円表示、985円/1005円ラベル');
  console.log('✓ モード切替: UI状態の正しい更新');
  console.log('✓ チャート描画: 3つのヒストグラム');
  console.log('✓ レスポンシブ: 各サイズで正常表示');
  console.log('✓ エラーなし: JSエラー、コンソールエラー');

  // 終了コード
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 実行
runE2ETests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
