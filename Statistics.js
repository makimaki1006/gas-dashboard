/**
 * Statistics.js - 高度な統計関数モジュール
 * ブートストラップ法、刈り込み平均、信頼区間の算出
 * 少数データでも統計的に妥当な分析を提供
 */

/**
 * ブートストラップ法を用いて平均値の95%信頼区間を算出する
 * 母集団の分布を仮定せず、復元抽出により信頼区間を推定
 * @param {Array<number>} data - 数値データの配列
 * @param {number} iterations - 試行回数 (デフォルト: 2000回)
 * @returns {Object|null} - {lower, upper, bootstrapMean, sampleMean}
 */
function getBootstrapConfidenceInterval(data, iterations) {
  iterations = iterations || 2000;

  // 有効なデータのみ抽出
  const validData = data.filter(function(v) {
    return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
  });

  const n = validData.length;
  if (n === 0) return null;
  if (n === 1) {
    // 1件のみの場合は信頼区間を計算できない
    return {
      lower: validData[0],
      upper: validData[0],
      bootstrapMean: validData[0],
      sampleMean: validData[0],
      sampleSize: 1,
      confidenceLevel: 0.95,
      warning: 'サンプル数が1件のため信頼区間は計算できません'
    };
  }

  var means = [];

  // リサンプリングループ
  for (var i = 0; i < iterations; i++) {
    var sum = 0;
    for (var j = 0; j < n; j++) {
      // ランダムにインデックスを選んで値を加算（復元抽出）
      var randomIndex = Math.floor(Math.random() * n);
      sum += validData[randomIndex];
    }
    means.push(sum / n);
  }

  // 平均値の分布を昇順にソート
  means.sort(function(a, b) { return a - b; });

  // 2.5%点と97.5%点を取得（95%信頼区間）
  var lowerIndex = Math.floor(iterations * 0.025);
  var upperIndex = Math.floor(iterations * 0.975);

  // 元データの平均
  var sampleSum = 0;
  for (var k = 0; k < n; k++) {
    sampleSum += validData[k];
  }
  var sampleMean = sampleSum / n;

  // ブートストラップ平均
  var bootstrapSum = 0;
  for (var m = 0; m < means.length; m++) {
    bootstrapSum += means[m];
  }

  return {
    lower: Math.round(means[lowerIndex]),
    upper: Math.round(means[upperIndex]),
    bootstrapMean: Math.round(bootstrapSum / means.length),
    sampleMean: Math.round(sampleMean),
    sampleSize: n,
    confidenceLevel: 0.95,
    iterations: iterations
  };
}

/**
 * 上下指定%をカットした刈り込み平均を算出する
 * 外れ値の影響を排除した頑健な平均値
 * @param {Array<number>} data - 数値データ
 * @param {number} trimPercent - カットする割合 (例: 0.1 で上下10%ずつカット)
 * @returns {Object|null} - {trimmedMean, originalMean, trimmedCount, removedCount}
 */
function getTrimmedMean(data, trimPercent) {
  trimPercent = trimPercent !== undefined ? trimPercent : 0.1;

  // 有効なデータのみ抽出
  var validData = data.filter(function(v) {
    return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
  });

  if (validData.length === 0) return null;

  // 昇順ソート
  var sorted = validData.slice().sort(function(a, b) { return a - b; });
  var n = sorted.length;

  // カットする個数を計算
  var trimCount = Math.floor(n * trimPercent);

  // 元の平均値
  var originalSum = 0;
  for (var i = 0; i < n; i++) {
    originalSum += sorted[i];
  }
  var originalMean = originalSum / n;

  // データ数が少なすぎてカットすると残らない場合
  if (n - (trimCount * 2) <= 0) {
    return {
      trimmedMean: Math.round(originalMean),
      originalMean: Math.round(originalMean),
      trimmedCount: n,
      removedCount: 0,
      trimPercent: trimPercent,
      warning: 'データ数が少ないため刈り込みなしの平均を使用'
    };
  }

  // スライスして平均算出
  var trimmedData = sorted.slice(trimCount, n - trimCount);
  var trimmedSum = 0;
  for (var j = 0; j < trimmedData.length; j++) {
    trimmedSum += trimmedData[j];
  }
  var trimmedMean = trimmedSum / trimmedData.length;

  // 除外されたデータ
  var removedLow = sorted.slice(0, trimCount);
  var removedHigh = sorted.slice(n - trimCount);

  return {
    trimmedMean: Math.round(trimmedMean),
    originalMean: Math.round(originalMean),
    trimmedCount: trimmedData.length,
    removedCount: trimCount * 2,
    trimPercent: trimPercent,
    removedLow: removedLow,
    removedHigh: removedHigh
  };
}

/**
 * 四分位範囲（IQR）を計算
 * 外れ値の検出に使用
 * @param {Array<number>} data - 数値データ
 * @returns {Object|null} - {q1, q2, q3, iqr, lowerBound, upperBound, outliers}
 */
function getQuartileStats(data) {
  // 有効なデータのみ抽出
  var validData = data.filter(function(v) {
    return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
  });

  if (validData.length < 4) return null;

  // 昇順ソート
  var sorted = validData.slice().sort(function(a, b) { return a - b; });
  var n = sorted.length;

  // 四分位数を計算
  var q1Index = Math.floor(n * 0.25);
  var q2Index = Math.floor(n * 0.5);
  var q3Index = Math.floor(n * 0.75);

  var q1 = sorted[q1Index];
  var q2 = sorted[q2Index]; // 中央値
  var q3 = sorted[q3Index];
  var iqr = q3 - q1;

  // 外れ値の境界（1.5 × IQR法）
  var lowerBound = q1 - (1.5 * iqr);
  var upperBound = q3 + (1.5 * iqr);

  // 外れ値を検出
  var outliers = [];
  var inliers = [];
  for (var i = 0; i < n; i++) {
    if (sorted[i] < lowerBound || sorted[i] > upperBound) {
      outliers.push(sorted[i]);
    } else {
      inliers.push(sorted[i]);
    }
  }

  return {
    q1: Math.round(q1),
    q2: Math.round(q2),
    q3: Math.round(q3),
    iqr: Math.round(iqr),
    lowerBound: Math.round(lowerBound),
    upperBound: Math.round(upperBound),
    outlierCount: outliers.length,
    outliers: outliers.map(Math.round),
    inlierCount: inliers.length
  };
}

/**
 * 包括的な給与統計を計算（拡張版）
 * 基本統計 + ブートストラップ信頼区間 + 刈り込み平均 + 四分位統計
 * @param {Array<number>} salaryValues - 給与データの配列（月給換算済み）
 * @returns {Object} 包括的な統計データ
 */
function calculateEnhancedSalaryStatistics(salaryValues) {
  // 有効なデータのみ抽出
  var validData = salaryValues.filter(function(v) {
    return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
  });

  if (validData.length === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      confidence95: null,
      trimmedMean: null,
      quartiles: null,
      reliability: 'insufficient_data'
    };
  }

  // 基本統計
  var sorted = validData.slice().sort(function(a, b) { return a - b; });
  var n = sorted.length;
  var sum = 0;
  for (var i = 0; i < n; i++) {
    sum += sorted[i];
  }
  var mean = sum / n;

  // 中央値
  var median;
  if (n % 2 === 0) {
    median = (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  } else {
    median = sorted[Math.floor(n / 2)];
  }

  // 標準偏差
  var squaredDiffSum = 0;
  for (var j = 0; j < n; j++) {
    squaredDiffSum += Math.pow(sorted[j] - mean, 2);
  }
  var stdDev = Math.sqrt(squaredDiffSum / n);

  // ブートストラップ信頼区間（5件以上で計算）
  var confidence95 = null;
  if (n >= 5) {
    confidence95 = getBootstrapConfidenceInterval(validData, 2000);
  }

  // 刈り込み平均（10件以上で計算）
  var trimmedMean = null;
  if (n >= 10) {
    trimmedMean = getTrimmedMean(validData, 0.1);
  }

  // 四分位統計（4件以上で計算）
  var quartiles = getQuartileStats(validData);

  // 信頼性評価
  var reliability;
  if (n >= 30) {
    reliability = 'high';
  } else if (n >= 10) {
    reliability = 'medium';
  } else if (n >= 5) {
    reliability = 'low';
  } else {
    reliability = 'very_low';
  }

  return {
    count: n,
    mean: Math.round(mean),
    meanMan: Math.round(mean / 10000),
    median: Math.round(median),
    medianMan: Math.round(median / 10000),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[n - 1]),
    stdDev: Math.round(stdDev),
    confidence95: confidence95,
    trimmedMean: trimmedMean,
    quartiles: quartiles,
    reliability: reliability,
    reliabilityLabel: getReliabilityLabel(reliability)
  };
}

/**
 * 信頼性ラベルを取得
 */
function getReliabilityLabel(reliability) {
  var labels = {
    'high': '高信頼性 (n≥30)',
    'medium': '中信頼性 (n≥10)',
    'low': '低信頼性 (n≥5)',
    'very_low': '参考値 (n<5)',
    'insufficient_data': 'データ不足'
  };
  return labels[reliability] || '不明';
}

/**
 * 統計情報を人間が読みやすいフォーマットで出力
 * @param {Object} stats - calculateEnhancedSalaryStatistics の結果
 * @returns {Object} フォーマット済み統計
 */
function formatStatisticsForDisplay(stats) {
  if (!stats || stats.count === 0) {
    return {
      summary: 'データがありません',
      details: null
    };
  }

  var summary = '';
  var n = stats.count;

  // 信頼区間がある場合
  if (stats.confidence95 && !stats.confidence95.warning) {
    summary = '平均月給は95%の確率で ' +
      Math.round(stats.confidence95.lower / 10000) + '万円 〜 ' +
      Math.round(stats.confidence95.upper / 10000) + '万円 の範囲';
  } else {
    summary = '平均月給: ' + stats.meanMan + '万円';
  }

  // 刈り込み平均との差が大きい場合は外れ値の影響を示唆
  var outlierWarning = null;
  if (stats.trimmedMean && stats.mean) {
    var diff = Math.abs(stats.mean - stats.trimmedMean.trimmedMean);
    var diffPercent = (diff / stats.mean) * 100;
    if (diffPercent > 10) {
      outlierWarning = '外れ値の影響: 約' + Math.round(diffPercent) + '%';
    }
  }

  return {
    summary: summary,
    reliabilityLabel: stats.reliabilityLabel,
    confidence95: stats.confidence95 ? {
      lower: Math.round(stats.confidence95.lower / 10000),
      upper: Math.round(stats.confidence95.upper / 10000),
      text: Math.round(stats.confidence95.lower / 10000) + '万円 〜 ' +
            Math.round(stats.confidence95.upper / 10000) + '万円'
    } : null,
    trimmedMean: stats.trimmedMean ? {
      value: Math.round(stats.trimmedMean.trimmedMean / 10000),
      text: Math.round(stats.trimmedMean.trimmedMean / 10000) + '万円（外れ値除外）'
    } : null,
    outlierWarning: outlierWarning,
    quartiles: stats.quartiles ? {
      q1: Math.round(stats.quartiles.q1 / 10000),
      q2: Math.round(stats.quartiles.q2 / 10000),
      q3: Math.round(stats.quartiles.q3 / 10000),
      outlierCount: stats.quartiles.outlierCount
    } : null
  };
}
