/**
 * JobSeekerAnalysis.js - 求職者視点分析モジュール
 * 求職者が求人一覧を見たときの認知・心理パターンを分析
 */

/**
 * 給与表示タイプを取得
 * @returns {string} 'monthly' or 'hourly'
 */
function getSalaryDisplayType() {
  try {
    return PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
  } catch (e) {
    return 'monthly';
  }
}

/**
 * 給与値を適切な単位で取得
 * - monthly: unifiedMonthly（月給換算）を使用
 * - hourly: 元の時給値を使用
 * @param {Object} salaryParsed - 解析済み給与データ
 * @param {string} displayType - 表示タイプ
 * @returns {Object} { min, max, unified }
 */
function getSalaryValuesForDisplay(salaryParsed, displayType) {
  if (!salaryParsed) return { min: null, max: null, unified: null };

  if (displayType === 'hourly') {
    // 時給モード: 元の値をそのまま使用
    return {
      min: salaryParsed.minValue,
      max: salaryParsed.maxValue,
      unified: salaryParsed.minValue  // 下限を基準に
    };
  } else {
    // 月給モード: unifiedMonthlyを使用
    return {
      min: salaryParsed.minValue,  // 元の月給下限
      max: salaryParsed.maxValue,  // 元の月給上限
      unified: salaryParsed.unifiedMonthly
    };
  }
}

/**
 * 求職者視点の包括的分析を実行
 * @param {Array} parsedData - 解析済みデータ
 * @returns {Object} 求職者視点分析結果
 */
function analyzeJobSeekerPerspective(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return createEmptyJobSeekerAnalysis();
  }

  // 給与表示タイプを取得
  var salaryDisplayType = getSalaryDisplayType();

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
    totalRecords: parsedData.length,
    salaryDisplayType: salaryDisplayType  // 表示タイプをUIに伝達
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
  // 給与表示タイプを取得
  var displayType = getSalaryDisplayType();
  var isHourly = (displayType === 'hourly');

  // 有効な給与データを抽出（時給モードでは時給として妥当な範囲のみ）
  var validData = parsedData.filter(function(d) {
    if (!d.salaryParsed) return false;
    if (d.salaryParsed.minValue === null || d.salaryParsed.maxValue === null) return false;
    if (!d.salaryParsed.hasRange) return false;

    if (isHourly) {
      // 時給モード: 5000円未満かつ日給タイプを除外
      var minVal = d.salaryParsed.minValue;
      var maxVal = d.salaryParsed.maxValue;
      return minVal > 0 && minVal < 5000 && maxVal < 5000 && d.salaryParsed.salaryType !== 'daily';
    } else {
      // 月給モード: 月給/年収データのみを対象
      return d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual';
    }
  });

  if (validData.length === 0) {
    return {
      hasData: false,
      message: 'レンジ表記の求人データがありません',
      isHourly: isHourly
    };
  }

  // レンジ幅の分析
  var rangeWidths = [];
  var lowerValues = [];
  var upperValues = [];
  var midValues = [];

  // 異常値除外の閾値（時給: 5000円、月給: 50万円）
  var maxWidth = isHourly ? 5000 : 500000;

  validData.forEach(function(d) {
    var min = d.salaryParsed.minValue;
    var max = d.salaryParsed.maxValue;
    var mid = (min + max) / 2;
    var width = max - min;

    // 月給モードで年収の場合のみ月給換算
    if (!isHourly && d.salaryParsed.salaryType === 'annual') {
      min = Math.round(min / 12);
      max = Math.round(max / 12);
      mid = Math.round(mid / 12);
      width = Math.round(width / 12);
    }

    if (width > 0 && width < maxWidth) {
      rangeWidths.push(width);
      lowerValues.push(min);
      upperValues.push(max);
      midValues.push(mid);
    }
  });

  if (rangeWidths.length === 0) {
    return {
      hasData: false,
      message: '有効なレンジデータがありません',
      isHourly: isHourly
    };
  }

  // 統計計算
  var avgRangeWidth = Math.round(average(rangeWidths));
  var avgLower = Math.round(average(lowerValues));
  var avgUpper = Math.round(average(upperValues));
  var avgMid = Math.round(average(midValues));

  // 求職者の期待値推定（下限寄り: 下限から1/3地点）
  var expectedValue = Math.round(avgLower + (avgUpper - avgLower) * 0.33);

  // レンジ幅の分布（時給: 100円/300円/500円以上、月給: 5万円/10万円以上）
  var widthDistribution = {
    narrow: 0,
    medium: 0,
    wide: 0
  };

  var narrowThreshold = isHourly ? 100 : 50000;
  var wideThreshold = isHourly ? 300 : 100000;

  rangeWidths.forEach(function(w) {
    if (w < narrowThreshold) widthDistribution.narrow++;
    else if (w < wideThreshold) widthDistribution.medium++;
    else widthDistribution.wide++;
  });

  // レンジ幅分布のパーセント計算
  var totalWidthCount = rangeWidths.length;
  var narrowPercent = Math.round((widthDistribution.narrow / totalWidthCount) * 100 * 10) / 10;
  var mediumPercent = Math.round((widthDistribution.medium / totalWidthCount) * 100 * 10) / 10;
  var widePercent = Math.round((widthDistribution.wide / totalWidthCount) * 100 * 10) / 10;

  // 表示用変換（時給: 円そのまま、月給: 万円換算）
  // 生データ版: 小数第1位まで表示（26.1万円など）
  var toDisplay = function(val) {
    return isHourly ? val : Math.round(val / 1000) / 10;
  };

  // レンジスプレッド分析のラベル
  var narrowLabel = isHourly ? '狭い（100円未満）' : '狭い（5万円未満）';
  var mediumLabel = isHourly ? '標準（100〜300円）' : '標準（5〜10万円）';
  var wideLabel = isHourly ? '広い（300円以上）' : '広い（10万円以上）';

  return {
    hasData: true,
    isHourly: isHourly,
    totalRangeListings: rangeWidths.length,

    // 平均値
    avgRangeWidth: avgRangeWidth,
    avgRangeWidthMan: toDisplay(avgRangeWidth),
    avgLower: avgLower,
    avgLowerMan: toDisplay(avgLower),
    avgUpper: avgUpper,
    avgUpperMan: toDisplay(avgUpper),
    avgMid: avgMid,
    avgMidMan: toDisplay(avgMid),

    // 求職者の期待値推定
    expectedValue: expectedValue,
    expectedValueMan: toDisplay(expectedValue),

    // HTMLテンプレート用エイリアス
    conservativeEstimate: avgLower,
    conservativeEstimateMan: toDisplay(avgLower),
    optimisticEstimate: avgUpper,
    optimisticEstimateMan: toDisplay(avgUpper),
    psychologicalMidpoint: expectedValue,
    psychologicalMidpointMan: toDisplay(expectedValue),

    // レンジ幅分布
    widthDistribution: widthDistribution,

    // レンジスプレッド分析（HTMLテンプレート用）
    rangeSpreadAnalysis: {
      [narrowLabel]: { count: widthDistribution.narrow, percent: narrowPercent },
      [mediumLabel]: { count: widthDistribution.medium, percent: mediumPercent },
      [wideLabel]: { count: widthDistribution.wide, percent: widePercent }
    },

    // 解釈テキスト
    interpretation: generateRangeInterpretation(avgLower, avgUpper, expectedValue, avgRangeWidth, isHourly)
  };
}

/**
 * レンジ解釈のテキストを生成
 */
function generateRangeInterpretation(avgLower, avgUpper, expected, width, isHourly) {
  var unit, lowerDisplay, upperDisplay, expectedDisplay, widthDisplay;
  var narrowThreshold, wideThreshold;

  if (isHourly) {
    unit = '円';
    lowerDisplay = Math.round(avgLower);
    upperDisplay = Math.round(avgUpper);
    expectedDisplay = Math.round(expected);
    widthDisplay = Math.round(width);
    narrowThreshold = 100;
    wideThreshold = 300;
  } else {
    unit = '万円';
    // 生データ版: 小数第1位まで表示（26.1万円など）
    lowerDisplay = Math.round(avgLower / 1000) / 10;
    upperDisplay = Math.round(avgUpper / 1000) / 10;
    expectedDisplay = Math.round(expected / 1000) / 10;
    widthDisplay = Math.round(width / 1000) / 10;
    narrowThreshold = 5;
    wideThreshold = 10;
  }

  var text = '求人票に「' + lowerDisplay + (isHourly ? '' : '万') + '〜' + upperDisplay + unit + '」と表記されている場合、';
  text += '求職者の期待値は約' + expectedDisplay + unit + '（下限寄り）です。';
  text += '平均レンジ幅は' + widthDisplay + unit + 'で、';

  if (widthDisplay < narrowThreshold) {
    text += '比較的狭い幅のため求職者の期待は明確です。';
  } else if (widthDisplay < wideThreshold) {
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
 * - 新着求人のみの給与分布（下限・上限・統一）
 * - 新着求人のタグ傾向
 * @param {Array} parsedData - 解析済みデータ
 */
function analyzeNewListings(parsedData) {
  // 給与表示タイプを取得
  var displayType = getSalaryDisplayType();
  var isHourly = (displayType === 'hourly');

  // 新着求人を抽出
  var newListings = parsedData.filter(function(d) {
    return d.isNew === '新着' || d.isNew === 'NEW';
  });
  // 新着以外
  var oldListings = parsedData.filter(function(d) {
    return d.isNew !== '新着' && d.isNew !== 'NEW';
  });

  var totalCount = parsedData.length;
  var newCount = newListings.length;

  if (newCount === 0) {
    return {
      hasData: false,
      message: '新着求人がありません',
      newCount: 0,
      newRate: 0,
      isHourly: isHourly
    };
  }

  // 給与データ収集ヘルパー（モード対応）
  function collectSalaries(listings) {
    var minSalaries = [];
    var maxSalaries = [];
    var unifiedSalaries = [];

    listings.forEach(function(d) {
      if (!d.salaryParsed) return;
      var minVal = d.salaryParsed.minValue;
      var maxVal = d.salaryParsed.maxValue;
      var salaryType = d.salaryParsed.salaryType;

      if (isHourly) {
        // 時給モード: 5000円未満かつ日給タイプを除外
        if (salaryType !== 'daily') {
          if (minVal !== null && minVal > 0 && minVal < 5000) {
            minSalaries.push(minVal);
            unifiedSalaries.push(minVal);
          }
          if (maxVal !== null && maxVal > 0 && maxVal < 5000) {
            maxSalaries.push(maxVal);
          }
        }
      } else {
        // 月給モード: 年収は月給換算
        var isAnnual = salaryType === 'annual';
        if (minVal !== null) {
          minSalaries.push(isAnnual ? Math.round(minVal / 12) : minVal);
        }
        if (maxVal !== null) {
          maxSalaries.push(isAnnual ? Math.round(maxVal / 12) : maxVal);
        }
        if (d.salaryParsed.unifiedMonthly !== null) {
          unifiedSalaries.push(d.salaryParsed.unifiedMonthly);
        }
      }
    });

    return { min: minSalaries, max: maxSalaries, unified: unifiedSalaries };
  }

  // 統計計算ヘルパー（モード対応）
  function calcDetailedStats(arr) {
    if (!arr || arr.length === 0) return null;
    var meanVal = Math.round(average(arr));
    var medianVal = Math.round(median(arr));
    // 生データ版 - ビニングなし（関数は後方互換のため残すが、ビニングは行わない）
    var modeVal = isHourly ? calculateModeWithBin(arr, 100) : calculateMode(arr);
    return {
      mean: meanVal,
      meanMan: isHourly ? meanVal : Math.round(meanVal / 1000) / 10,  // 生データ版: 小数第1位まで
      median: medianVal,
      medianMan: isHourly ? medianVal : Math.round(medianVal / 1000) / 10,
      mode: modeVal,
      modeMan: modeVal ? (isHourly ? modeVal : Math.round(modeVal / 1000) / 10) : null,
      count: arr.length
    };
  }

  // 新着求人の給与データ
  var newSalaryData = collectSalaries(newListings);
  var newMinStats = calcDetailedStats(newSalaryData.min);
  var newMaxStats = calcDetailedStats(newSalaryData.max);
  var newUnifiedStats = calcDetailedStats(newSalaryData.unified);

  // 全体の給与データ
  var allSalaryData = collectSalaries(parsedData);
  var allMinStats = calcDetailedStats(allSalaryData.min);
  var allMaxStats = calcDetailedStats(allSalaryData.max);
  var allUnifiedStats = calcDetailedStats(allSalaryData.unified);

  // 新着以外の給与データ
  var oldSalaryData = collectSalaries(oldListings);
  var oldMinStats = calcDetailedStats(oldSalaryData.min);
  var oldMaxStats = calcDetailedStats(oldSalaryData.max);
  var oldUnifiedStats = calcDetailedStats(oldSalaryData.unified);

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

  // 差分計算（新着 vs 全体）- 丸め誤差防止
  var diffVsAll = {
    min: newMinStats && allMinStats ? {
      mean: newMinStats.meanMan - allMinStats.meanMan,
      median: newMinStats.medianMan - allMinStats.medianMan
    } : null,
    max: newMaxStats && allMaxStats ? {
      mean: newMaxStats.meanMan - allMaxStats.meanMan,
      median: newMaxStats.medianMan - allMaxStats.medianMan
    } : null,
    unified: newUnifiedStats && allUnifiedStats ? {
      mean: newUnifiedStats.meanMan - allUnifiedStats.meanMan,
      median: newUnifiedStats.medianMan - allUnifiedStats.medianMan
    } : null
  };

  // 差分計算（新着 vs 新着以外）- 丸め誤差防止
  var diffVsOld = oldUnifiedStats && oldUnifiedStats.count > 0 ? {
    min: newMinStats && oldMinStats ? {
      mean: newMinStats.meanMan - oldMinStats.meanMan,
      median: newMinStats.medianMan - oldMinStats.medianMan
    } : null,
    max: newMaxStats && oldMaxStats ? {
      mean: newMaxStats.meanMan - oldMaxStats.meanMan,
      median: newMaxStats.medianMan - oldMaxStats.medianMan
    } : null,
    unified: {
      mean: newUnifiedStats.meanMan - oldUnifiedStats.meanMan,
      median: newUnifiedStats.medianMan - oldUnifiedStats.medianMan
    }
  } : null;

  // 従来互換用
  var salaryDiff = diffVsAll.unified ? {
    meanDiff: (newUnifiedStats?.mean || 0) - (allUnifiedStats?.mean || 0),
    meanDiffMan: diffVsAll.unified.mean,
    medianDiff: (newUnifiedStats?.median || 0) - (allUnifiedStats?.median || 0),
    medianDiffMan: diffVsAll.unified.median
  } : null;

  return {
    hasData: true,
    newCount: newCount,
    oldCount: oldListings.length,
    totalCount: totalCount,
    newRate: Math.round((newCount / totalCount) * 100 * 10) / 10,

    // 新着の給与統計（詳細版：下限・上限・統一）
    newStats: {
      min: newMinStats,
      max: newMaxStats,
      unified: newUnifiedStats
    },

    // 全体の給与統計（詳細版）
    allStats: {
      min: allMinStats,
      max: allMaxStats,
      unified: allUnifiedStats
    },

    // 新着以外の給与統計（詳細版）
    oldStats: {
      min: oldMinStats,
      max: oldMaxStats,
      unified: oldUnifiedStats
    },

    // 差分（新着 vs 全体）
    diffVsAll: diffVsAll,

    // 差分（新着 vs 新着以外）
    diffVsOld: diffVsOld,

    // 従来互換
    newSalaryStats: newUnifiedStats,
    salaryDiff: salaryDiff,

    // 新着のタグ傾向
    topNewTags: topNewTags,

    // 解釈テキスト
    interpretation: generateNewListingsInterpretationV2(newCount, totalCount, newMinStats, newMaxStats, oldMinStats, oldMaxStats, diffVsOld, isHourly),

    // 表示モード
    isHourly: isHourly
  };
}

/**
 * 新着分析の解釈テキストを生成（V2: 下限・上限分離版）
 */
function generateNewListingsInterpretationV2(newCount, totalCount, newMin, newMax, oldMin, oldMax, diffVsOld, isHourly) {
  var newRate = Math.round((newCount / totalCount) * 100 * 10) / 10;
  var text = '現在' + totalCount + '件中' + newCount + '件（' + newRate + '%）が新着です。';
  var unit = isHourly ? '円' : '万円';

  if (diffVsOld && diffVsOld.min) {
    var minDiff = diffVsOld.min.mean;
    var maxDiff = diffVsOld.max ? diffVsOld.max.mean : 0;

    if (minDiff > 0 || maxDiff > 0) {
      text += '新着求人は新着以外と比較して';
      if (minDiff > 0) text += '下限が+' + minDiff + unit;
      if (minDiff > 0 && maxDiff > 0) text += '、';
      if (maxDiff > 0) text += '上限が+' + maxDiff + unit;
      text += '高い傾向です。';
    } else if (minDiff < 0 || maxDiff < 0) {
      text += '新着求人は新着以外と比較して';
      if (minDiff < 0) text += '下限が' + minDiff + unit;
      if (minDiff < 0 && maxDiff < 0) text += '、';
      if (maxDiff < 0) text += '上限が' + maxDiff + unit;
      text += '低い傾向です。';
    } else {
      text += '新着求人の給与水準は新着以外とほぼ同等です。';
    }
  }

  if (newRate > 30) {
    text += ' 市場は活発で、求職者は「選択肢が多い」と感じます。';
  } else if (newRate < 10) {
    text += ' 新着が少なく、求職者は「売れ残り感」を感じる可能性があります。';
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
  // 給与表示タイプを取得
  var displayType = getSalaryDisplayType();
  var isHourly = (displayType === 'hourly');

  // 未経験関連タグのパターン（MECE対応版）
  var inexperiencedPatterns = [
    '未経験', '未経験可', '未経験OK', '未経験歓迎', '経験不問',
    'ブランクOK', '第二新卒', '初心者'
  ];

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
    var salaryType = d.salaryParsed.salaryType;

    if (isHourly) {
      // 時給モード: 時給として妥当な範囲（5000円未満）かつ日給タイプを除外
      var minVal = d.salaryParsed.minValue;
      var maxVal = d.salaryParsed.maxValue;
      if (minVal !== null && minVal > 0 && minVal < 5000 && salaryType !== 'daily') {
        target.min.push(minVal);
        target.unified.push(minVal);
      }
      if (maxVal !== null && maxVal > 0 && maxVal < 5000) {
        target.max.push(maxVal);
      }
    } else {
      // 月給モード: 年収は月給換算
      if (d.salaryParsed.minValue !== null) {
        var minVal = d.salaryParsed.minValue;
        if (salaryType === 'annual') minVal = Math.round(minVal / 12);
        if (minVal > 0 && minVal < 2000000) target.min.push(minVal);
      }

      if (d.salaryParsed.maxValue !== null) {
        var maxVal = d.salaryParsed.maxValue;
        if (salaryType === 'annual') maxVal = Math.round(maxVal / 12);
        if (maxVal > 0 && maxVal < 2000000) target.max.push(maxVal);
      }

      if (d.salaryParsed.unifiedMonthly !== null) {
        target.unified.push(d.salaryParsed.unifiedMonthly);
      }
    }
  });

  if (withInexp.unified.length === 0 || withoutInexp.unified.length === 0) {
    return {
      hasData: false,
      message: '比較に必要なデータが不足しています',
      withInexperiencedCount: withInexp.unified.length,
      withoutInexperiencedCount: withoutInexp.unified.length,
      isHourly: isHourly
    };
  }

  // 統計計算ヘルパー（モード対応）
  function calcStats(arr) {
    if (!arr || arr.length === 0) return null;
    // 生データ版 - ビニングなし（関数は後方互換のため残すが、ビニングは行わない）
    var modeVal = isHourly ? calculateModeWithBin(arr, 100) : calculateMode(arr);
    return {
      mean: Math.round(average(arr)),
      median: Math.round(median(arr)),
      mode: modeVal,
      count: arr.length
    };
  }

  // 表示値変換ヘルパー（時給:円、月給:万円）
  // 生データ版: 小数第1位まで表示（26.1万円など）
  function toDisplayValue(val) {
    if (val === null) return null;
    return isHourly ? val : Math.round(val / 1000) / 10;
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
    isHourly: isHourly,

    // 未経験可あり（下限・上限分離）
    withInexperienced: {
      count: withUnifiedStats.count,
      // 下限給与（平均・中央・最頻）
      minSalary: withMinStats ? {
        mean: withMinStats.mean,
        meanMan: toDisplayValue(withMinStats.mean),
        median: withMinStats.median,
        medianMan: toDisplayValue(withMinStats.median),
        mode: withMinStats.mode,
        modeMan: toDisplayValue(withMinStats.mode)
      } : null,
      // 上限給与（平均・中央・最頻）
      maxSalary: withMaxStats ? {
        mean: withMaxStats.mean,
        meanMan: toDisplayValue(withMaxStats.mean),
        median: withMaxStats.median,
        medianMan: toDisplayValue(withMaxStats.median),
        mode: withMaxStats.mode,
        modeMan: toDisplayValue(withMaxStats.mode)
      } : null,
      // 統一値（従来互換）
      mean: withUnifiedStats.mean,
      meanMan: toDisplayValue(withUnifiedStats.mean),
      median: withUnifiedStats.median,
      medianMan: toDisplayValue(withUnifiedStats.median),
      mode: withUnifiedStats.mode,
      modeMan: toDisplayValue(withUnifiedStats.mode)
    },

    // 未経験可なし（下限・上限分離）
    withoutInexperienced: {
      count: withoutUnifiedStats.count,
      // 下限給与（平均・中央・最頻）
      minSalary: withoutMinStats ? {
        mean: withoutMinStats.mean,
        meanMan: toDisplayValue(withoutMinStats.mean),
        median: withoutMinStats.median,
        medianMan: toDisplayValue(withoutMinStats.median),
        mode: withoutMinStats.mode,
        modeMan: toDisplayValue(withoutMinStats.mode)
      } : null,
      // 上限給与（平均・中央・最頻）
      maxSalary: withoutMaxStats ? {
        mean: withoutMaxStats.mean,
        meanMan: toDisplayValue(withoutMaxStats.mean),
        median: withoutMaxStats.median,
        medianMan: toDisplayValue(withoutMaxStats.median),
        mode: withoutMaxStats.mode,
        modeMan: toDisplayValue(withoutMaxStats.mode)
      } : null,
      // 統一値（従来互換）
      mean: withoutUnifiedStats.mean,
      meanMan: toDisplayValue(withoutUnifiedStats.mean),
      median: withoutUnifiedStats.median,
      medianMan: toDisplayValue(withoutUnifiedStats.median),
      mode: withoutUnifiedStats.mode,
      modeMan: toDisplayValue(withoutUnifiedStats.mode)
    },

    // 差分（下限・上限・統一）- 表示値ベースで計算（丸め誤差防止）
    difference: {
      min: minDiff,
      minMan: withMinStats && withoutMinStats
        ? toDisplayValue(withMinStats.mean) - toDisplayValue(withoutMinStats.mean)
        : 0,
      max: maxDiff,
      maxMan: withMaxStats && withoutMaxStats
        ? toDisplayValue(withMaxStats.mean) - toDisplayValue(withoutMaxStats.mean)
        : 0,
      mean: unifiedDiff,
      meanMan: toDisplayValue(withUnifiedStats.mean) - toDisplayValue(withoutUnifiedStats.mean),
      median: withUnifiedStats.median - withoutUnifiedStats.median,
      medianMan: toDisplayValue(withUnifiedStats.median) - toDisplayValue(withoutUnifiedStats.median),
      percentDiff: Math.round((unifiedDiff / withoutUnifiedStats.mean) * 100 * 10) / 10
    },

    // 解釈テキスト
    interpretation: generateInexperiencedInterpretationV2(
      withMinStats, withMaxStats, withoutMinStats, withoutMaxStats, minDiff, maxDiff, isHourly
    )
  };
}

/**
 * 未経験可分析の解釈テキストを生成（下限・上限分離版）
 */
function generateInexperiencedInterpretationV2(withMin, withMax, withoutMin, withoutMax, minDiff, maxDiff, isHourly) {
  var text = '';
  var unit = isHourly ? '円' : '万円';
  var divisor = isHourly ? 1 : 10000;

  if (withMin && withoutMin) {
    var withMinDisplay = Math.round(withMin.mean / divisor);
    var withoutMinDisplay = Math.round(withoutMin.mean / divisor);
    text += '【下限給与】未経験可: ' + withMinDisplay + unit + '、経験者向け: ' + withoutMinDisplay + unit;
    var minDiffDisplay = Math.round(Math.abs(minDiff) / divisor);
    // 四捨五入後の差が0の場合は「ほぼ同等」と表示（矛盾防止）
    if (minDiffDisplay === 0 || minDiff === 0) {
      text += '（ほぼ同等）。';
    } else if (minDiff < 0) {
      text += '（' + minDiffDisplay + unit + '低い）。';
    } else {
      text += '（' + minDiffDisplay + unit + '高い）。';
    }
  }

  if (withMax && withoutMax) {
    var withMaxDisplay = Math.round(withMax.mean / divisor);
    var withoutMaxDisplay = Math.round(withoutMax.mean / divisor);
    text += ' 【上限給与】未経験可: ' + withMaxDisplay + unit + '、経験者向け: ' + withoutMaxDisplay + unit;
    var maxDiffDisplay = Math.round(Math.abs(maxDiff) / divisor);
    // 四捨五入後の差が0の場合は「ほぼ同等」と表示（矛盾防止）
    if (maxDiffDisplay === 0 || maxDiff === 0) {
      text += '（ほぼ同等）。';
    } else if (maxDiff < 0) {
      text += '（' + maxDiffDisplay + unit + '低い）。';
    } else {
      text += '（' + maxDiffDisplay + unit + '高い）。';
    }
  }

  return text;
}

/**
 * 未経験可分析の解釈テキストを生成
 */
function generateInexperiencedInterpretation(withStats, withoutStats, meanDiff) {
  // 生データ版: 小数第1位まで表示（26.1万円など）
  var diffMan = Math.round(Math.abs(meanDiff) / 1000) / 10;
  var withMeanMan = Math.round(withStats.mean / 1000) / 10;
  var withoutMeanMan = Math.round(withoutStats.mean / 1000) / 10;

  var text = '「未経験可」タグあり: 平均' + withMeanMan + '万円（' + withStats.count + '件）、';
  text += 'タグなし: 平均' + withoutMeanMan + '万円（' + withoutStats.count + '件）。';

  // 四捨五入後の差が0の場合は「ほぼ同等」と表示（矛盾防止）
  if (diffMan === 0 || meanDiff === 0) {
    text += '未経験可の有無で給与に大きな差はありません。';
  } else if (meanDiff < 0) {
    text += '未経験可の求人は約' + diffMan + '万円低い傾向があります。';
    text += '求職者は「未経験可＝給与は低め」と認識しています。';
  } else {
    text += '意外にも未経験可の求人が約' + diffMan + '万円高くなっています。';
    text += '人手不足で好条件を提示している可能性があります。';
  }

  return text;
}

// ============================================================
// 4. 暗黙の相場観（上位N件）
// ============================================================

/**
 * 表示順上位N件から「暗黙の相場観」を分析
 * - 求職者が最初に見る求人が相場感を形成する
 * - 求人サイトの検索結果は通常「おすすめ順」「新着順」等でソートされている
 * - 最初に目に入る求人が求職者の「この市場の相場はこれくらい」という認識を作る
 * @param {Array} parsedData - 解析済みデータ（表示順）
 * @param {number} topN - 上位何件を分析するか（デフォルト: 20件）
 */
function analyzeImplicitMarketRate(parsedData, topN) {
  topN = topN || 20;

  // 給与表示タイプを取得
  var displayType = getSalaryDisplayType();
  var isHourly = (displayType === 'hourly');

  // 対象データのフィルタリング（時給モードでは時給として妥当な範囲のみ）
  var filteredData = parsedData.filter(function(d) {
    if (!d.salaryParsed) return false;
    if (isHourly) {
      // 時給モード: 5000円未満かつ日給タイプを除外
      var minVal = d.salaryParsed.minValue;
      return minVal !== null && minVal > 0 && minVal < 5000 && d.salaryParsed.salaryType !== 'daily';
    } else {
      return d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual';
    }
  });

  // 上位N件を取得
  var topListings = filteredData.slice(0, Math.min(topN, filteredData.length));
  // それ以外（21件目以降）
  var restListings = filteredData.slice(topN);

  // 給与データ抽出ヘルパー
  function extractSalaries(listings) {
    var minSalaries = [];
    var maxSalaries = [];
    var unifiedSalaries = [];

    listings.forEach(function(d) {
      if (!d.salaryParsed) return;
      var minVal = d.salaryParsed.minValue;
      var maxVal = d.salaryParsed.maxValue;

      if (isHourly) {
        // 時給モード: 5000円未満の妥当な時給値のみを使用
        if (minVal !== null && minVal > 0 && minVal < 5000) {
          minSalaries.push(minVal);
          unifiedSalaries.push(minVal);
        }
        if (maxVal !== null && maxVal > 0 && maxVal < 5000) {
          maxSalaries.push(maxVal);
        }
      } else {
        // 月給モード: 年収は月給換算、unifiedMonthlyを使用
        var isAnnual = d.salaryParsed.salaryType === 'annual';
        if (minVal !== null) {
          minSalaries.push(isAnnual ? Math.round(minVal / 12) : minVal);
        }
        if (maxVal !== null) {
          maxSalaries.push(isAnnual ? Math.round(maxVal / 12) : maxVal);
        }
        if (d.salaryParsed.unifiedMonthly !== null) {
          unifiedSalaries.push(d.salaryParsed.unifiedMonthly);
        }
      }
    });

    return { min: minSalaries, max: maxSalaries, unified: unifiedSalaries };
  }

  var topData = extractSalaries(topListings);
  var allData = extractSalaries(filteredData);
  var restData = extractSalaries(restListings);

  if (topData.unified.length === 0) {
    return {
      hasData: false,
      message: '上位求人の給与データがありません',
      topN: topN,
      isHourly: isHourly
    };
  }

  // 表示用変換（時給: 円そのまま、月給: 万円換算）
  // 生データ版: 小数第1位まで表示（26.1万円など）
  var toDisplay = function(val) {
    return isHourly ? val : Math.round(val / 1000) / 10;
  };

  // 統計計算ヘルパー
  function calcStats(arr) {
    if (!arr || arr.length === 0) return null;
    var modeVal = isHourly ? calculateModeWithBin(arr, 100) : calculateMode(arr);
    var modeDetails = calculateModeWithDetails(arr);
    return {
      mean: Math.round(average(arr)),
      meanMan: toDisplay(Math.round(average(arr))),
      median: Math.round(median(arr)),
      medianMan: toDisplay(Math.round(median(arr))),
      mode: modeVal,
      modeMan: modeVal ? toDisplay(modeVal) : null,
      modeDetails: modeDetails,
      count: arr.length
    };
  }

  // 上位N件の統計（下限・上限・統一）
  var topMinStats = calcStats(topData.min);
  var topMaxStats = calcStats(topData.max);
  var topUnifiedStats = calcStats(topData.unified);

  // 全体の統計
  var allMinStats = calcStats(allData.min);
  var allMaxStats = calcStats(allData.max);
  var allUnifiedStats = calcStats(allData.unified);

  // 21件目以降の統計
  var restMinStats = calcStats(restData.min);
  var restMaxStats = calcStats(restData.max);
  var restUnifiedStats = calcStats(restData.unified);

  // 差分計算（上位 vs 全体）
  var diffVsAll = allUnifiedStats ? {
    min: topMinStats && allMinStats ? {
      mean: topMinStats.mean - allMinStats.mean,
      meanMan: topMinStats.meanMan - allMinStats.meanMan
    } : null,
    max: topMaxStats && allMaxStats ? {
      mean: topMaxStats.mean - allMaxStats.mean,
      meanMan: topMaxStats.meanMan - allMaxStats.meanMan
    } : null,
    unified: {
      mean: topUnifiedStats.mean - allUnifiedStats.mean,
      meanMan: topUnifiedStats.meanMan - allUnifiedStats.meanMan,
      median: topUnifiedStats.median - allUnifiedStats.median,
      medianMan: topUnifiedStats.medianMan - allUnifiedStats.medianMan
    }
  } : null;

  // 差分計算（上位 vs それ以外）
  var diffVsRest = restUnifiedStats && restUnifiedStats.count > 0 ? {
    min: topMinStats && restMinStats ? {
      mean: topMinStats.mean - restMinStats.mean,
      meanMan: topMinStats.meanMan - restMinStats.meanMan
    } : null,
    max: topMaxStats && restMaxStats ? {
      mean: topMaxStats.mean - restMaxStats.mean,
      meanMan: topMaxStats.meanMan - restMaxStats.meanMan
    } : null,
    unified: {
      mean: topUnifiedStats.mean - restUnifiedStats.mean,
      meanMan: topUnifiedStats.meanMan - restUnifiedStats.meanMan
    }
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

  // 上位N件のサンプル（企業名・職種）
  var sampleListings = topListings.slice(0, 5).map(function(d, idx) {
    var minVal = d.salaryParsed ? d.salaryParsed.minValue : null;
    var maxVal = d.salaryParsed ? d.salaryParsed.maxValue : null;
    var salaryType = d.salaryParsed ? d.salaryParsed.salaryType : null;
    var isAnnual = salaryType === 'annual';

    // 表示値を計算（時給モードは円、月給モードは万円）
    var displayMin = null;
    var displayMax = null;
    if (minVal !== null) {
      var adjustedMin = isAnnual ? Math.round(minVal / 12) : minVal;
      displayMin = toDisplay(adjustedMin);
    }
    if (maxVal !== null) {
      var adjustedMax = isAnnual ? Math.round(maxVal / 12) : maxVal;
      displayMax = toDisplay(adjustedMax);
    }

    return {
      rank: idx + 1,
      company: d.companyName || '企業名不明',
      title: (d.jobTitle || '職種不明').substring(0, 30),
      minSalary: displayMin,
      maxSalary: displayMax,
      // 後方互換性のため万円表示も保持
      minSalaryMan: displayMin,
      maxSalaryMan: displayMax,
      isNew: d.isNew === '新着' || d.isNew === 'NEW'
    };
  });

  // 給与帯分布（上位N件）
  var salaryRangeDistribution = { low: 0, mid: 0, high: 0 };
  // 時給モード: 1000円未満/1000-1500円/1500円以上、月給モード: 20万未満/20-30万/30万以上
  var lowThreshold = isHourly ? 1000 : 200000;
  var highThreshold = isHourly ? 1500 : 300000;
  topData.unified.forEach(function(s) {
    if (s < lowThreshold) salaryRangeDistribution.low++;
    else if (s < highThreshold) salaryRangeDistribution.mid++;
    else salaryRangeDistribution.high++;
  });

  return {
    hasData: true,
    topN: topN,
    analyzedCount: topListings.length,
    totalCount: parsedData.length,
    filteredCount: filteredData.length,
    restCount: restListings.length,
    isHourly: isHourly,
    unit: isHourly ? '円' : '万円',

    // 上位N件の統計（詳細版）
    topStats: {
      min: topMinStats,
      max: topMaxStats,
      unified: topUnifiedStats
    },

    // 暗黙の相場（上位N件の統計）- 従来互換
    implicitRate: {
      mean: topUnifiedStats.mean,
      meanMan: topUnifiedStats.meanMan,
      median: topUnifiedStats.median,
      medianMan: topUnifiedStats.medianMan,
      mode: topUnifiedStats.mode,
      modeMan: topUnifiedStats.modeMan
    },

    // 全体統計
    allStats: {
      min: allMinStats,
      max: allMaxStats,
      unified: allUnifiedStats
    },

    // 従来互換
    overallRate: allUnifiedStats ? {
      mean: allUnifiedStats.mean,
      meanMan: allUnifiedStats.meanMan,
      median: allUnifiedStats.median,
      medianMan: allUnifiedStats.medianMan
    } : null,

    // それ以外（21件目以降）の統計
    restStats: {
      min: restMinStats,
      max: restMaxStats,
      unified: restUnifiedStats
    },

    // 差分（上位 vs 全体）- 従来互換
    difference: diffVsAll ? diffVsAll.unified : null,

    // 差分詳細
    diffVsAll: diffVsAll,
    diffVsRest: diffVsRest,

    // 上位N件のタグ傾向
    topTags: topTags,

    // サンプル求人（上位5件）
    sampleListings: sampleListings,

    // 給与帯分布
    salaryRangeDistribution: salaryRangeDistribution,

    // HTMLテンプレート用：mode詳細
    mode: topUnifiedStats.modeDetails,

    // HTMLテンプレート用：median
    median: topUnifiedStats.median,
    medianMan: topUnifiedStats.medianMan,

    // 解釈テキスト
    interpretation: generateImplicitRateInterpretationV2(topN, topUnifiedStats, allUnifiedStats, restUnifiedStats, diffVsAll, diffVsRest, isHourly)
  };
}

/**
 * 暗黙相場観の解釈テキストを生成（V2: 詳細版）
 */
function generateImplicitRateInterpretationV2(topN, topStats, allStats, restStats, diffVsAll, diffVsRest, isHourly) {
  if (!topStats) return '';

  var unit = isHourly ? '円' : '万円';
  // 有意な差のしきい値（時給: 50円、月給: 2万円）
  var significantDiff = isHourly ? 50 : 2;

  var text = '';

  // 基本説明
  text += '【相場観とは】求職者は検索結果を上から順に見ていくため、最初に目に入る求人（上位' + topN + '件）が「この業界・職種の相場」という認識を形成します。';

  // 上位の統計
  text += ' 上位' + topN + '件の平均は' + topStats.meanMan + unit + '、中央値は' + topStats.medianMan + unit + 'です。';

  // 全体との比較
  if (diffVsAll && diffVsAll.unified) {
    var diff = diffVsAll.unified.meanMan;
    if (diff > significantDiff) {
      text += ' 全体平均（' + allStats.meanMan + unit + '）より' + diff + unit + '高いため、求職者は実際より「市場は好条件」と感じている可能性があります。';
    } else if (diff < -significantDiff) {
      text += ' 全体平均（' + allStats.meanMan + unit + '）より' + Math.abs(diff) + unit + '低いため、求職者は実際より「市場は厳しい」と感じている可能性があります。';
    } else {
      text += ' 全体平均（' + allStats.meanMan + unit + '）とほぼ一致しており、認識のズレは少ないです。';
    }
  }

  // 21件目以降との比較
  if (diffVsRest && diffVsRest.unified && restStats && restStats.count > 10) {
    var restDiff = diffVsRest.unified.meanMan;
    if (Math.abs(restDiff) >= significantDiff) {
      text += ' 【注意】上位' + topN + '件と' + (topN + 1) + '件目以降で平均' + Math.abs(restDiff) + unit + 'の差があります。';
      if (restDiff > 0) {
        text += '上位に高給与求人が集中しています。';
      } else {
        text += '上位に低給与求人が集中しています。';
      }
    }
  }

  return text;
}

/**
 * 暗黙相場観の解釈テキストを生成（従来版・互換用）
 */
function generateImplicitRateInterpretation(topN, topStats, allStats, diff) {
  // 生データ版: 小数第1位まで表示（26.1万円など）
  var topMeanMan = Math.round(topStats.mean / 1000) / 10;
  var topModeMan = topStats.mode ? Math.round(topStats.mode / 1000) / 10 : null;

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
 * 配列の最頻値を計算（生データ版 - ビニングなし）
 */
function calculateMode(arr) {
  if (arr.length === 0) return null;

  // 生データ版 - ビニングなし
  var bins = {};

  arr.forEach(function(val) {
    bins[val] = (bins[val] || 0) + 1;
  });

  var modeKey = null;
  var modeCount = 0;

  Object.keys(bins).forEach(function(key) {
    if (bins[key] > modeCount) {
      modeCount = bins[key];
      modeKey = parseFloat(key);
    }
  });

  return modeKey;
}

/**
 * 配列の最頻値を計算（生データ版 - ビニングなし）
 * @param {Array} arr - 数値配列
 * @param {number} binSize - 後方互換のため引数として残すが、使用しない
 * @returns {number|null} 最頻値（実際の値）
 */
function calculateModeWithBin(arr, binSize) {
  // binSizeは後方互換のため引数として残すが、生データ版では使用しない
  if (arr.length === 0) return null;

  // 生データ版 - ビニングなし
  var bins = {};

  arr.forEach(function(val) {
    bins[val] = (bins[val] || 0) + 1;
  });

  var modeKey = null;
  var modeCount = 0;

  Object.keys(bins).forEach(function(key) {
    if (bins[key] > modeCount) {
      modeCount = bins[key];
      modeKey = parseFloat(key);
    }
  });

  return modeKey;
}

/**
 * 最頻値の詳細を計算（生データ版 - ビニングなし）
 * @param {Array} arr - 給与値の配列
 * @param {boolean} isHourly - 時給モードかどうか（オプション、指定しない場合はプロパティから取得）
 * @returns {Object} 最頻値の詳細
 */
function calculateModeWithDetails(arr, isHourly) {
  if (arr.length === 0) return null;

  // isHourlyが未指定の場合はプロパティから取得
  if (isHourly === undefined) {
    var displayType = getSalaryDisplayType();
    isHourly = (displayType === 'hourly');
  }

  // 生データ版 - ビニングなし
  var bins = {};

  arr.forEach(function(val) {
    bins[val] = (bins[val] || 0) + 1;
  });

  var modeKey = null;
  var modeCount = 0;

  Object.keys(bins).forEach(function(key) {
    if (bins[key] > modeCount) {
      modeCount = bins[key];
      modeKey = parseFloat(key);
    }
  });

  if (modeKey === null) return null;

  if (isHourly) {
    // 時給モード: 生データ形式（1000円）
    return {
      value: modeKey,
      valueMan: modeKey,  // 時給モードでは円のまま
      range: modeKey + '円',
      count: modeCount,
      isHourly: true
    };
  } else {
    // 月給モード: 生データ形式（25万円）
    var valueMan = modeKey / 10000;
    return {
      value: modeKey,
      valueMan: valueMan,
      range: valueMan + '万円',
      count: modeCount,
      isHourly: false
    };
  }
}

