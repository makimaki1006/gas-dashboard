/**
 * JobSeekerAnalysis.js - 求職者視点分析モジュール
 * 求職者が求人一覧を見たときの認知・心理パターンを分析
 */

/**
 * 求職者視点の包括的分析を実行
 * @param {Array} parsedData - 解析済みデータ
 * @returns {Object} 求職者視点分析結果
 */
function analyzeJobSeekerPerspective(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return createEmptyJobSeekerAnalysis();
  }

  return {
    // 1. 給与レンジの心理的解釈
    salaryRangePerception: analyzeSalaryRangePerception(parsedData),

    // 2. 新着求人の特徴分析
    newListingsAnalysis: analyzeNewListings(parsedData),

    // 3. 未経験可タグの給与差
    inexperiencedTagAnalysis: analyzeInexperiencedTag(parsedData),

    // 4. 暗黙の相場観（上位N件）
    implicitMarketRate: analyzeImplicitMarketRate(parsedData),

    // メタ情報
    analyzedAt: new Date().toISOString(),
    totalRecords: parsedData.length
  };
}

/**
 * 空の分析結果を作成
 */
function createEmptyJobSeekerAnalysis() {
  return {
    salaryRangePerception: null,
    newListingsAnalysis: null,
    inexperiencedTagAnalysis: null,
    implicitMarketRate: null,
    analyzedAt: new Date().toISOString(),
    totalRecords: 0
  };
}

// ============================================================
// 1. 給与レンジの心理的解釈
// ============================================================

/**
 * 給与レンジを求職者がどう解釈するかを分析
 * - 「25万〜35万」→ 求職者は下限〜中間を期待する傾向
 * @param {Array} parsedData - 解析済みデータ
 */
function analyzeSalaryRangePerception(parsedData) {
  // 有効な給与データを抽出
  var validData = parsedData.filter(function(d) {
    return d.salaryParsed &&
           d.salaryParsed.minValue !== null &&
           d.salaryParsed.maxValue !== null &&
           d.salaryParsed.hasRange === true;
  });

  if (validData.length === 0) {
    return {
      hasData: false,
      message: 'レンジ表記の求人データがありません'
    };
  }

  // レンジ幅の分析
  var rangeWidths = [];
  var lowerValues = [];
  var upperValues = [];
  var midValues = [];

  validData.forEach(function(d) {
    var min = d.salaryParsed.minValue;
    var max = d.salaryParsed.maxValue;
    var mid = (min + max) / 2;
    var width = max - min;

    // 月給換算（年収の場合）
    if (d.salaryParsed.salaryType === 'annual') {
      min = Math.round(min / 12);
      max = Math.round(max / 12);
      mid = Math.round(mid / 12);
      width = Math.round(width / 12);
    }

    if (width > 0 && width < 500000) { // 異常値除外（月給で50万以上の幅は除外）
      rangeWidths.push(width);
      lowerValues.push(min);
      upperValues.push(max);
      midValues.push(mid);
    }
  });

  if (rangeWidths.length === 0) {
    return {
      hasData: false,
      message: '有効なレンジデータがありません'
    };
  }

  // 統計計算
  var avgRangeWidth = Math.round(average(rangeWidths));
  var avgLower = Math.round(average(lowerValues));
  var avgUpper = Math.round(average(upperValues));
  var avgMid = Math.round(average(midValues));

  // 求職者の期待値推定（下限寄り: 下限から1/3地点）
  var expectedValue = Math.round(avgLower + (avgUpper - avgLower) * 0.33);

  // レンジ幅の分布
  var widthDistribution = {
    narrow: 0,   // 5万円未満
    medium: 0,   // 5〜10万円
    wide: 0      // 10万円以上
  };

  rangeWidths.forEach(function(w) {
    if (w < 50000) widthDistribution.narrow++;
    else if (w < 100000) widthDistribution.medium++;
    else widthDistribution.wide++;
  });

  // レンジ幅分布のパーセント計算
  var totalWidthCount = rangeWidths.length;
  var narrowPercent = Math.round((widthDistribution.narrow / totalWidthCount) * 100);
  var mediumPercent = Math.round((widthDistribution.medium / totalWidthCount) * 100);
  var widePercent = Math.round((widthDistribution.wide / totalWidthCount) * 100);

  return {
    hasData: true,
    totalRangeListings: rangeWidths.length,

    // 平均値
    avgRangeWidth: avgRangeWidth,
    avgRangeWidthMan: Math.round(avgRangeWidth / 10000),
    avgLower: avgLower,
    avgLowerMan: Math.round(avgLower / 10000),
    avgUpper: avgUpper,
    avgUpperMan: Math.round(avgUpper / 10000),
    avgMid: avgMid,
    avgMidMan: Math.round(avgMid / 10000),

    // 求職者の期待値推定
    expectedValue: expectedValue,
    expectedValueMan: Math.round(expectedValue / 10000),

    // HTMLテンプレート用エイリアス
    conservativeEstimate: avgLower,
    conservativeEstimateMan: Math.round(avgLower / 10000),
    optimisticEstimate: avgUpper,
    optimisticEstimateMan: Math.round(avgUpper / 10000),
    psychologicalMidpoint: expectedValue,
    psychologicalMidpointMan: Math.round(expectedValue / 10000),

    // レンジ幅分布
    widthDistribution: widthDistribution,

    // レンジスプレッド分析（HTMLテンプレート用）
    rangeSpreadAnalysis: {
      '狭い（5万円未満）': { count: widthDistribution.narrow, percent: narrowPercent },
      '標準（5〜10万円）': { count: widthDistribution.medium, percent: mediumPercent },
      '広い（10万円以上）': { count: widthDistribution.wide, percent: widePercent }
    },

    // 解釈テキスト
    interpretation: generateRangeInterpretation(avgLower, avgUpper, expectedValue, avgRangeWidth)
  };
}

/**
 * レンジ解釈のテキストを生成
 */
function generateRangeInterpretation(avgLower, avgUpper, expected, width) {
  var lowerMan = Math.round(avgLower / 10000);
  var upperMan = Math.round(avgUpper / 10000);
  var expectedMan = Math.round(expected / 10000);
  var widthMan = Math.round(width / 10000);

  var text = '求人票に「' + lowerMan + '万〜' + upperMan + '万円」と表記されている場合、';
  text += '求職者の期待値は約' + expectedMan + '万円（下限寄り）です。';
  text += '平均レンジ幅は' + widthMan + '万円で、';

  if (widthMan < 5) {
    text += '比較的狭い幅のため求職者の期待は明確です。';
  } else if (widthMan < 10) {
    text += '標準的な幅ですが「上限は条件次第」と認識されます。';
  } else {
    text += '幅が広いため求職者は下限付近を想定する傾向があります。';
  }

  return text;
}

// ============================================================
// 2. 新着求人の特徴分析
// ============================================================

/**
 * 新着バッジ付き求人の特徴を分析
 * - 新着求人のみの給与分布
 * - 新着求人のタグ傾向
 * @param {Array} parsedData - 解析済みデータ
 */
function analyzeNewListings(parsedData) {
  // 新着求人を抽出
  var newListings = parsedData.filter(function(d) {
    return d.isNew === '新着' || d.isNew === 'NEW';
  });

  var totalCount = parsedData.length;
  var newCount = newListings.length;

  if (newCount === 0) {
    return {
      hasData: false,
      message: '新着求人がありません',
      newCount: 0,
      newRate: 0
    };
  }

  // 新着求人の給与データ
  var newSalaries = newListings
    .filter(function(d) { return d.salaryParsed && d.salaryParsed.unifiedMonthly !== null; })
    .map(function(d) { return d.salaryParsed.unifiedMonthly; });

  // 全体の給与データ
  var allSalaries = parsedData
    .filter(function(d) { return d.salaryParsed && d.salaryParsed.unifiedMonthly !== null; })
    .map(function(d) { return d.salaryParsed.unifiedMonthly; });

  // 新着のタグ集計
  var newTagCounts = {};
  newListings.forEach(function(d) {
    if (d.tagsParsed && d.tagsParsed.tags) {
      d.tagsParsed.tags.forEach(function(tag) {
        newTagCounts[tag] = (newTagCounts[tag] || 0) + 1;
      });
    }
  });

  // 上位タグ
  var topNewTags = Object.keys(newTagCounts)
    .sort(function(a, b) { return newTagCounts[b] - newTagCounts[a]; })
    .slice(0, 10)
    .map(function(tag) { return { tag: tag, count: newTagCounts[tag] }; });

  // 給与統計
  var newSalaryStats = newSalaries.length > 0 ? {
    mean: Math.round(average(newSalaries)),
    median: Math.round(median(newSalaries)),
    mode: calculateMode(newSalaries),
    count: newSalaries.length
  } : null;

  var allSalaryStats = allSalaries.length > 0 ? {
    mean: Math.round(average(allSalaries)),
    median: Math.round(median(allSalaries)),
    mode: calculateMode(allSalaries),
    count: allSalaries.length
  } : null;

  // 差分計算
  var salaryDiff = null;
  if (newSalaryStats && allSalaryStats) {
    salaryDiff = {
      meanDiff: newSalaryStats.mean - allSalaryStats.mean,
      meanDiffMan: Math.round((newSalaryStats.mean - allSalaryStats.mean) / 10000),
      medianDiff: newSalaryStats.median - allSalaryStats.median,
      medianDiffMan: Math.round((newSalaryStats.median - allSalaryStats.median) / 10000)
    };
  }

  return {
    hasData: true,
    newCount: newCount,
    totalCount: totalCount,
    newRate: Math.round((newCount / totalCount) * 100 * 10) / 10,

    // 新着の給与統計
    newSalaryStats: newSalaryStats ? {
      mean: newSalaryStats.mean,
      meanMan: Math.round(newSalaryStats.mean / 10000),
      median: newSalaryStats.median,
      medianMan: Math.round(newSalaryStats.median / 10000),
      mode: newSalaryStats.mode,
      modeMan: newSalaryStats.mode ? Math.round(newSalaryStats.mode / 10000) : null,
      count: newSalaryStats.count
    } : null,

    // 全体との差
    salaryDiff: salaryDiff,

    // 新着のタグ傾向
    topNewTags: topNewTags,

    // 解釈テキスト
    interpretation: generateNewListingsInterpretation(newCount, totalCount, salaryDiff)
  };
}

/**
 * 新着分析の解釈テキストを生成
 */
function generateNewListingsInterpretation(newCount, totalCount, salaryDiff) {
  var newRate = Math.round((newCount / totalCount) * 100);
  var text = '現在' + totalCount + '件中' + newCount + '件（' + newRate + '%）が新着です。';

  if (salaryDiff) {
    if (salaryDiff.meanDiffMan > 0) {
      text += '新着求人は全体平均より約' + salaryDiff.meanDiffMan + '万円高い傾向があります。';
    } else if (salaryDiff.meanDiffMan < 0) {
      text += '新着求人は全体平均より約' + Math.abs(salaryDiff.meanDiffMan) + '万円低い傾向があります。';
    } else {
      text += '新着求人の給与水準は全体とほぼ同等です。';
    }
  }

  if (newRate > 30) {
    text += '市場は活発で、求職者は「選択肢が多い」と感じます。';
  } else if (newRate < 10) {
    text += '新着が少なく、求職者は「売れ残り感」を感じる可能性があります。';
  }

  return text;
}

// ============================================================
// 3. 未経験可タグの給与差分析
// ============================================================

/**
 * 「未経験可」タグの有無による給与差を分析
 * 下限と上限を分離して詳細に分析
 * @param {Array} parsedData - 解析済みデータ
 */
function analyzeInexperiencedTag(parsedData) {
  // 未経験関連タグのパターン
  var inexperiencedPatterns = ['未経験', '未経験可', '未経験OK', '未経験歓迎', '経験不問'];

  // 未経験可の求人を判定
  function hasInexperiencedTag(record) {
    if (!record.tagsParsed || !record.tagsParsed.tags) return false;
    return record.tagsParsed.tags.some(function(tag) {
      return inexperiencedPatterns.some(function(pattern) {
        return tag.indexOf(pattern) !== -1;
      });
    });
  }

  // グループ分け（下限・上限を別々に収集）
  var withInexp = { min: [], max: [], unified: [] };
  var withoutInexp = { min: [], max: [], unified: [] };

  parsedData.forEach(function(d) {
    if (!d.salaryParsed) return;

    var isInexp = hasInexperiencedTag(d);
    var target = isInexp ? withInexp : withoutInexp;

    // 月給換算の下限
    if (d.salaryParsed.minValue !== null) {
      var minVal = d.salaryParsed.minValue;
      if (d.salaryParsed.salaryType === 'annual') minVal = Math.round(minVal / 12);
      if (minVal > 0 && minVal < 2000000) target.min.push(minVal);
    }

    // 月給換算の上限
    if (d.salaryParsed.maxValue !== null) {
      var maxVal = d.salaryParsed.maxValue;
      if (d.salaryParsed.salaryType === 'annual') maxVal = Math.round(maxVal / 12);
      if (maxVal > 0 && maxVal < 2000000) target.max.push(maxVal);
    }

    // 統一月給（従来の値）
    if (d.salaryParsed.unifiedMonthly !== null) {
      target.unified.push(d.salaryParsed.unifiedMonthly);
    }
  });

  if (withInexp.unified.length === 0 || withoutInexp.unified.length === 0) {
    return {
      hasData: false,
      message: '比較に必要なデータが不足しています',
      withInexperiencedCount: withInexp.unified.length,
      withoutInexperiencedCount: withoutInexp.unified.length
    };
  }

  // 統計計算ヘルパー
  function calcStats(arr) {
    if (!arr || arr.length === 0) return null;
    return {
      mean: Math.round(average(arr)),
      median: Math.round(median(arr)),
      mode: calculateMode(arr),
      count: arr.length
    };
  }

  // 未経験可の統計（下限・上限・統一）
  var withMinStats = calcStats(withInexp.min);
  var withMaxStats = calcStats(withInexp.max);
  var withUnifiedStats = calcStats(withInexp.unified);

  // 経験者向けの統計（下限・上限・統一）
  var withoutMinStats = calcStats(withoutInexp.min);
  var withoutMaxStats = calcStats(withoutInexp.max);
  var withoutUnifiedStats = calcStats(withoutInexp.unified);

  // 差分計算
  var minDiff = withMinStats && withoutMinStats ? withMinStats.mean - withoutMinStats.mean : 0;
  var maxDiff = withMaxStats && withoutMaxStats ? withMaxStats.mean - withoutMaxStats.mean : 0;
  var unifiedDiff = withUnifiedStats.mean - withoutUnifiedStats.mean;

  return {
    hasData: true,

    // 未経験可あり（下限・上限分離）
    withInexperienced: {
      count: withUnifiedStats.count,
      // 下限給与
      minSalary: withMinStats ? {
        mean: withMinStats.mean,
        meanMan: Math.round(withMinStats.mean / 10000),
        median: withMinStats.median,
        medianMan: Math.round(withMinStats.median / 10000)
      } : null,
      // 上限給与
      maxSalary: withMaxStats ? {
        mean: withMaxStats.mean,
        meanMan: Math.round(withMaxStats.mean / 10000),
        median: withMaxStats.median,
        medianMan: Math.round(withMaxStats.median / 10000)
      } : null,
      // 統一月給（従来互換）
      mean: withUnifiedStats.mean,
      meanMan: Math.round(withUnifiedStats.mean / 10000),
      median: withUnifiedStats.median,
      medianMan: Math.round(withUnifiedStats.median / 10000),
      mode: withUnifiedStats.mode,
      modeMan: withUnifiedStats.mode ? Math.round(withUnifiedStats.mode / 10000) : null
    },

    // 未経験可なし（下限・上限分離）
    withoutInexperienced: {
      count: withoutUnifiedStats.count,
      // 下限給与
      minSalary: withoutMinStats ? {
        mean: withoutMinStats.mean,
        meanMan: Math.round(withoutMinStats.mean / 10000),
        median: withoutMinStats.median,
        medianMan: Math.round(withoutMinStats.median / 10000)
      } : null,
      // 上限給与
      maxSalary: withoutMaxStats ? {
        mean: withoutMaxStats.mean,
        meanMan: Math.round(withoutMaxStats.mean / 10000),
        median: withoutMaxStats.median,
        medianMan: Math.round(withoutMaxStats.median / 10000)
      } : null,
      // 統一月給（従来互換）
      mean: withoutUnifiedStats.mean,
      meanMan: Math.round(withoutUnifiedStats.mean / 10000),
      median: withoutUnifiedStats.median,
      medianMan: Math.round(withoutUnifiedStats.median / 10000),
      mode: withoutUnifiedStats.mode,
      modeMan: withoutUnifiedStats.mode ? Math.round(withoutUnifiedStats.mode / 10000) : null
    },

    // 差分（下限・上限・統一）
    difference: {
      min: minDiff,
      minMan: Math.round(minDiff / 10000),
      max: maxDiff,
      maxMan: Math.round(maxDiff / 10000),
      mean: unifiedDiff,
      meanMan: Math.round(unifiedDiff / 10000),
      median: withUnifiedStats.median - withoutUnifiedStats.median,
      medianMan: Math.round((withUnifiedStats.median - withoutUnifiedStats.median) / 10000),
      percentDiff: Math.round((unifiedDiff / withoutUnifiedStats.mean) * 100)
    },

    // 解釈テキスト
    interpretation: generateInexperiencedInterpretationV2(
      withMinStats, withMaxStats, withoutMinStats, withoutMaxStats, minDiff, maxDiff
    )
  };
}

/**
 * 未経験可分析の解釈テキストを生成（下限・上限分離版）
 */
function generateInexperiencedInterpretationV2(withMin, withMax, withoutMin, withoutMax, minDiff, maxDiff) {
  var text = '';

  if (withMin && withoutMin) {
    var withMinMan = Math.round(withMin.mean / 10000);
    var withoutMinMan = Math.round(withoutMin.mean / 10000);
    text += '【下限給与】未経験可: ' + withMinMan + '万円、経験者向け: ' + withoutMinMan + '万円';
    if (minDiff < 0) {
      text += '（' + Math.round(Math.abs(minDiff) / 10000) + '万円低い）。';
    } else if (minDiff > 0) {
      text += '（' + Math.round(minDiff / 10000) + '万円高い）。';
    } else {
      text += '（同等）。';
    }
  }

  if (withMax && withoutMax) {
    var withMaxMan = Math.round(withMax.mean / 10000);
    var withoutMaxMan = Math.round(withoutMax.mean / 10000);
    text += ' 【上限給与】未経験可: ' + withMaxMan + '万円、経験者向け: ' + withoutMaxMan + '万円';
    if (maxDiff < 0) {
      text += '（' + Math.round(Math.abs(maxDiff) / 10000) + '万円低い）。';
    } else if (maxDiff > 0) {
      text += '（' + Math.round(maxDiff / 10000) + '万円高い）。';
    } else {
      text += '（同等）。';
    }
  }

  return text;
}

/**
 * 未経験可分析の解釈テキストを生成
 */
function generateInexperiencedInterpretation(withStats, withoutStats, meanDiff) {
  var diffMan = Math.round(Math.abs(meanDiff) / 10000);
  var withMeanMan = Math.round(withStats.mean / 10000);
  var withoutMeanMan = Math.round(withoutStats.mean / 10000);

  var text = '「未経験可」タグあり: 平均' + withMeanMan + '万円（' + withStats.count + '件）、';
  text += 'タグなし: 平均' + withoutMeanMan + '万円（' + withoutStats.count + '件）。';

  if (meanDiff < 0) {
    text += '未経験可の求人は約' + diffMan + '万円低い傾向があります。';
    text += '求職者は「未経験可＝給与は低め」と認識しています。';
  } else if (meanDiff > 0) {
    text += '意外にも未経験可の求人が約' + diffMan + '万円高くなっています。';
    text += '人手不足で好条件を提示している可能性があります。';
  } else {
    text += '未経験可の有無で給与に大きな差はありません。';
  }

  return text;
}

// ============================================================
// 4. 暗黙の相場観（上位N件）
// ============================================================

/**
 * 表示順上位N件から「暗黙の相場観」を分析
 * - 求職者が最初に見る求人が相場感を形成する
 * @param {Array} parsedData - 解析済みデータ（表示順）
 * @param {number} topN - 上位何件を分析するか（デフォルト: 20件）
 */
function analyzeImplicitMarketRate(parsedData, topN) {
  topN = topN || 20;

  // 上位N件を取得
  var topListings = parsedData.slice(0, Math.min(topN, parsedData.length));

  // 上位N件の給与データ
  var topSalaries = topListings
    .filter(function(d) { return d.salaryParsed && d.salaryParsed.unifiedMonthly !== null; })
    .map(function(d) { return d.salaryParsed.unifiedMonthly; });

  // 全体の給与データ
  var allSalaries = parsedData
    .filter(function(d) { return d.salaryParsed && d.salaryParsed.unifiedMonthly !== null; })
    .map(function(d) { return d.salaryParsed.unifiedMonthly; });

  if (topSalaries.length === 0) {
    return {
      hasData: false,
      message: '上位求人の給与データがありません',
      topN: topN
    };
  }

  // 上位N件の統計
  var topModeDetails = calculateModeWithDetails(topSalaries);
  var topStats = {
    mean: Math.round(average(topSalaries)),
    median: Math.round(median(topSalaries)),
    mode: calculateMode(topSalaries),
    modeDetails: topModeDetails,
    count: topSalaries.length
  };

  // 全体の統計
  var allModeDetails = calculateModeWithDetails(allSalaries);
  var allStats = allSalaries.length > 0 ? {
    mean: Math.round(average(allSalaries)),
    median: Math.round(median(allSalaries)),
    mode: calculateMode(allSalaries),
    modeDetails: allModeDetails,
    count: allSalaries.length
  } : null;

  // 差分
  var diff = allStats ? {
    mean: topStats.mean - allStats.mean,
    meanMan: Math.round((topStats.mean - allStats.mean) / 10000),
    median: topStats.median - allStats.median,
    medianMan: Math.round((topStats.median - allStats.median) / 10000)
  } : null;

  // 上位N件のタグ傾向
  var topTagCounts = {};
  topListings.forEach(function(d) {
    if (d.tagsParsed && d.tagsParsed.tags) {
      d.tagsParsed.tags.forEach(function(tag) {
        topTagCounts[tag] = (topTagCounts[tag] || 0) + 1;
      });
    }
  });

  var topTags = Object.keys(topTagCounts)
    .sort(function(a, b) { return topTagCounts[b] - topTagCounts[a]; })
    .slice(0, 5)
    .map(function(tag) { return { tag: tag, count: topTagCounts[tag] }; });

  return {
    hasData: true,
    topN: topN,
    analyzedCount: topListings.length,

    // 暗黙の相場（上位N件の統計）
    implicitRate: {
      mean: topStats.mean,
      meanMan: Math.round(topStats.mean / 10000),
      median: topStats.median,
      medianMan: Math.round(topStats.median / 10000),
      mode: topStats.mode,
      modeMan: topStats.mode ? Math.round(topStats.mode / 10000) : null
    },

    // HTMLテンプレート用：mode詳細（{range, count}形式）
    mode: topStats.modeDetails,

    // HTMLテンプレート用：median（トップレベル）
    median: topStats.median,
    medianMan: Math.round(topStats.median / 10000),

    // 全体統計
    overallRate: allStats ? {
      mean: allStats.mean,
      meanMan: Math.round(allStats.mean / 10000),
      median: allStats.median,
      medianMan: Math.round(allStats.median / 10000)
    } : null,

    // 差分（上位 - 全体）
    difference: diff,

    // 上位N件のタグ傾向
    topTags: topTags,

    // 解釈テキスト
    interpretation: generateImplicitRateInterpretation(topN, topStats, allStats, diff)
  };
}

/**
 * 暗黙相場観の解釈テキストを生成
 */
function generateImplicitRateInterpretation(topN, topStats, allStats, diff) {
  var topMeanMan = Math.round(topStats.mean / 10000);
  var topModeMan = topStats.mode ? Math.round(topStats.mode / 10000) : null;

  var text = '求職者が最初に見る上位' + topN + '件の分析: ';
  text += '平均' + topMeanMan + '万円';
  if (topModeMan) {
    text += '、最頻値' + topModeMan + '万円。';
  } else {
    text += '。';
  }

  text += 'これが求職者の「体感相場」になります。';

  if (diff) {
    if (diff.meanMan > 2) {
      text += '全体平均より' + diff.meanMan + '万円高く、求職者は市場を「高め」と認識します。';
    } else if (diff.meanMan < -2) {
      text += '全体平均より' + Math.abs(diff.meanMan) + '万円低く、求職者は市場を「低め」と認識します。';
    } else {
      text += '全体平均と概ね一致しており、認識のズレは少ないです。';
    }
  }

  return text;
}

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 配列の平均値を計算
 */
function average(arr) {
  if (arr.length === 0) return 0;
  var sum = 0;
  for (var i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * 配列の中央値を計算
 */
function median(arr) {
  if (arr.length === 0) return 0;
  var sorted = arr.slice().sort(function(a, b) { return a - b; });
  var mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * 配列の最頻値を計算（1万円刻みでビニング）
 */
function calculateMode(arr) {
  if (arr.length === 0) return null;

  var binSize = 10000;
  var bins = {};

  arr.forEach(function(val) {
    var binKey = Math.floor(val / binSize) * binSize;
    bins[binKey] = (bins[binKey] || 0) + 1;
  });

  var modeKey = null;
  var modeCount = 0;

  Object.keys(bins).forEach(function(key) {
    if (bins[key] > modeCount) {
      modeCount = bins[key];
      modeKey = parseInt(key);
    }
  });

  return modeKey !== null ? modeKey + binSize / 2 : null;
}

/**
 * 配列の最頻値を詳細形式で計算（HTMLテンプレート用）
 * @returns {Object} { value, range, count } または null
 */
function calculateModeWithDetails(arr) {
  if (arr.length === 0) return null;

  var binSize = 10000;
  var bins = {};

  arr.forEach(function(val) {
    var binKey = Math.floor(val / binSize) * binSize;
    bins[binKey] = (bins[binKey] || 0) + 1;
  });

  var modeKey = null;
  var modeCount = 0;

  Object.keys(bins).forEach(function(key) {
    if (bins[key] > modeCount) {
      modeCount = bins[key];
      modeKey = parseInt(key);
    }
  });

  if (modeKey === null) return null;

  var lowerMan = Math.round(modeKey / 10000);
  var upperMan = Math.round((modeKey + binSize) / 10000);

  return {
    value: modeKey + binSize / 2,
    valueMan: Math.round((modeKey + binSize / 2) / 10000),
    range: lowerMan + '万〜' + upperMan + '万円',
    count: modeCount
  };
}

