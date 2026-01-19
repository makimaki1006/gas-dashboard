/**
 * DataLayer.js - 統一データレイヤー
 * 全データアクセスを一元管理し、重複読み込みを排除
 * Phase 1: パフォーマンス最適化
 * Phase 4: 増分更新統合
 */

/**
 * データレイヤーシングルトン
 * セッション内でデータをキャッシュし、重複読み込みを防止
 * 増分更新による永続化データを活用
 */
const DataLayer = (function() {
  // プライベート変数（セッション内キャッシュ）
  let _rawDataCache = null;
  let _parsedDataCache = null;
  let _aggregationCache = null;
  let _masterDataCache = null;
  let _cacheTimestamp = null;
  let _lastIncrementalResult = null;
  let _spreadsheetId = null;

  // キャッシュ有効期限（ミリ秒）- セッション内は5分
  const SESSION_CACHE_TTL = 300000;

  /**
   * スプレッドシート固有のキャッシュキーを生成
   * 別のスプレッドシートのデータが混入しないようにする
   */
  function getCacheKey(baseName) {
    if (!_spreadsheetId) {
      _spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    }
    return baseName + '_' + _spreadsheetId;
  }

  /**
   * キャッシュが有効かチェック
   */
  function isCacheValid() {
    if (!_cacheTimestamp) return false;
    return (Date.now() - _cacheTimestamp) < SESSION_CACHE_TTL;
  }

  /**
   * セッションキャッシュをクリア
   */
  function clearSessionCache() {
    _rawDataCache = null;
    _parsedDataCache = null;
    _aggregationCache = null;
    _cacheTimestamp = null;
    _lastIncrementalResult = null;
    console.log('DataLayer: セッションキャッシュをクリア');
  }

  /**
   * 全キャッシュをクリア（永続化データ含む）
   * @param {boolean} includePersistent - 永続化データもクリアするか
   */
  function clearAllCache(includePersistent = false) {
    clearSessionCache();

    // スクリプトキャッシュをクリア（スプレッドシート固有）
    const cache = CacheService.getScriptCache();
    cache.remove(getCacheKey('dashboard_aggregation'));

    if (includePersistent) {
      DataPersistence.clearAll();
      console.log('DataLayer: 永続化データもクリア');
    }
  }

  /**
   * スプレッドシートから生データを取得（キャッシュ対応）
   * @param {boolean} forceRefresh - 強制リフレッシュフラグ
   * @returns {Array} 生データ配列
   */
  function getRawData(forceRefresh = false) {
    // キャッシュチェック
    if (!forceRefresh && _rawDataCache && isCacheValid()) {
      console.log('DataLayer: 生データキャッシュヒット');
      return _rawDataCache;
    }

    console.log('DataLayer: スプレッドシートから生データを読み込み');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('データ');

    if (!dataSheet) {
      throw new Error('「データ」シートが見つかりません');
    }

    const lastRow = dataSheet.getLastRow();
    if (lastRow <= 1) {
      _rawDataCache = [];
      _cacheTimestamp = Date.now();
      return _rawDataCache;
    }

    // データソースタイプに応じて列数を決定
    // 求人ボックス: 10列（年間休日・詳細テキスト含む）
    // Indeed: 8列（基本カラムのみ）
    const dataSourceType = PropertiesService.getScriptProperties().getProperty('dataSourceType') || 'unknown';
    const isKyujinBox = dataSourceType === 'kyujin_box';
    const columnCount = isKyujinBox ? 10 : 8;

    console.log('DataLayer: dataSource=' + dataSourceType + ', columns=' + columnCount);

    // D列から取得（A-Cは管理用カラムの可能性）
    const range = dataSheet.getRange(2, 4, lastRow - 1, columnCount);
    const values = range.getValues();

    const records = [];
    values.forEach((row, index) => {
      if (!row[0] && !row[3]) return;

      records.push({
        rowIndex: index + 2,
        jobTitle: row[0] || '',
        jobUrl: row[1] || '',
        isNew: row[2] || '',
        companyName: row[3] || '',
        location: row[4] || '',
        tags: row[5] || '',
        salary: row[6] || '',
        employmentType: row[7] || '',
        // 年間休日・詳細テキスト（求人ボックスのみ）
        annualHolidays: isKyujinBox ? (row[8] || '') : '',
        description: isKyujinBox ? (row[9] || '') : ''
      });
    });

    _rawDataCache = records;
    _cacheTimestamp = Date.now();
    console.log('DataLayer: ' + records.length + '件の生データを読み込み');

    return _rawDataCache;
  }

  /**
   * 解析済みデータを取得（増分更新対応）
   * @param {boolean} forceRefresh - 強制リフレッシュフラグ
   * @returns {Array} 解析済みデータ配列
   */
  function getParsedData(forceRefresh = false) {
    // セッションキャッシュチェック
    if (!forceRefresh && _parsedDataCache && isCacheValid()) {
      console.log('DataLayer: 解析済みデータキャッシュヒット');
      return _parsedDataCache;
    }

    // Phase 4: 増分更新を使用（軽量モード：inc_parsed_dataを保存しない）
    // ★ストレージクォータ対策: skipParsedDataSave=true
    try {
      console.log('DataLayer: 増分更新を実行（軽量モード）');
      const result = executeIncrementalUpdate(forceRefresh, true);
      _lastIncrementalResult = result;

      if (result.success && result.parsedData) {
        _parsedDataCache = result.parsedData;
        _cacheTimestamp = Date.now();
        console.log('DataLayer: 増分更新完了 - モード:' + result.mode +
          ', 追加:' + result.stats.added + ', 変更なし:' + result.stats.unchanged);
        return _parsedDataCache;
      }
    } catch (e) {
      console.warn('DataLayer: 増分更新に失敗、レガシーモードにフォールバック:', e);
    }

    // フォールバック: 従来の全件解析
    return getParsedDataLegacy(forceRefresh);
  }

  /**
   * 従来の全件解析（フォールバック用）
   * @param {boolean} forceRefresh - 強制リフレッシュフラグ
   * @returns {Array} 解析済みデータ配列
   */
  function getParsedDataLegacy(forceRefresh = false) {
    console.log('DataLayer: レガシーモードでデータを解析中');
    const rawData = getRawData(forceRefresh);

    // コンテキスト都道府県を取得（検索対象シートから推測）
    const contextPref = getContextPrefectureFromTarget();
    if (contextPref) {
      console.log('DataLayer: コンテキスト都道府県 = ' + contextPref);
    }

    _parsedDataCache = rawData.map(record => {
      const salaryParsed = parseSalary(record.salary);
      const locationParsed = parseLocationWithMaster(record.location, contextPref);
      const employmentParsed = parseEmploymentType(record.employmentType);
      const tagsParsed = parseTags(record.tags);

      return {
        ...record,
        salaryParsed,
        locationParsed,
        employmentParsed,
        tagsParsed
      };
    });

    _cacheTimestamp = Date.now();
    console.log('DataLayer: ' + _parsedDataCache.length + '件のデータを解析完了（レガシー）');
    return _parsedDataCache;
  }

  /**
   * 集計データを取得（キャッシュ対応）
   * @param {boolean} forceRefresh - 強制リフレッシュフラグ
   * @returns {Object} 集計済みデータ
   */
  function getAggregation(forceRefresh = false) {
    // セッションキャッシュチェック
    if (!forceRefresh && _aggregationCache && isCacheValid()) {
      console.log('DataLayer: 集計データセッションキャッシュヒット');
      return _aggregationCache;
    }

    // スクリプトキャッシュチェック（スプレッドシート固有キー）
    if (!forceRefresh) {
      const cache = CacheService.getScriptCache();
      const cacheKey = getCacheKey('dashboard_aggregation');
      const cached = cache.get(cacheKey);
      if (cached) {
        try {
          _aggregationCache = JSON.parse(cached);
          _cacheTimestamp = Date.now();
          console.log('DataLayer: 集計データスクリプトキャッシュヒット (key=' + cacheKey + ')');
          return _aggregationCache;
        } catch (e) {
          // キャッシュが壊れている場合は再計算
        }
      }
    }

    console.log('DataLayer: 集計を実行');
    const parsedData = getParsedData(forceRefresh);

    if (parsedData.length === 0) {
      _aggregationCache = createEmptyAggregation();
    } else {
      _aggregationCache = {
        summary: createSummary(parsedData),
        salaryData: createSalaryAggregation(parsedData),
        locationData: createLocationAggregation(parsedData),
        employmentData: createEmploymentAggregation(parsedData),
        tagData: createTagAggregation(parsedData),
        annualHolidaysData: createAnnualHolidaysAggregation(parsedData),  // 年間休日統計（求人ボックス対応）
        salaryBinning: createSalaryBinningData(parsedData),  // 給与ビニング（5000円/50円刻み）
        categorySalary: createCategorySalaryAggregation(parsedData),  // カテゴリ別平均給与
        regionSalaryAnalysis: createRegionSalaryAnalysis(parsedData),  // 地域別×給与クロス分析
        rawRecords: []  // ダッシュボードで未使用のため空配列
      };
    }

    // スクリプトキャッシュに保存（スプレッドシート固有キー）
    try {
      const cache = CacheService.getScriptCache();
      const cacheKey = getCacheKey('dashboard_aggregation');
      cache.put(cacheKey, JSON.stringify(_aggregationCache), CACHE_TTL.summary);
      console.log('DataLayer: 集計データをスクリプトキャッシュに保存 (key=' + cacheKey + ')');
    } catch (e) {
      console.warn('DataLayer: キャッシュ保存に失敗:', e);
    }

    return _aggregationCache;
  }

  /**
   * 有効な給与データを取得
   * @param {boolean} forceRefresh - 強制リフレッシュフラグ
   * @returns {Array} 有効な給与を持つレコード
   */
  function getValidSalaryData(forceRefresh = false) {
    const parsedData = getParsedData(forceRefresh);
    return parsedData.filter(d => d.salaryParsed.unifiedMonthly !== null);
  }

  /**
   * 給与統計を取得
   * @param {boolean} forceRefresh - 強制リフレッシュフラグ
   * @param {string} salaryDisplayType - 給与表示タイプ ('monthly' or 'hourly')
   * @returns {Object} 給与統計
   */
  function getSalaryStats(forceRefresh = false, salaryDisplayType = null) {
    const parsedData = getParsedData(forceRefresh);

    // salaryDisplayTypeが指定されていない場合はScriptPropertiesから取得
    if (!salaryDisplayType) {
      salaryDisplayType = PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
    }

    const isHourly = salaryDisplayType === 'hourly';

    const getPercentile = (arr, p) => {
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    if (isHourly) {
      // 🔴 FIX: 時給モード: salaryType === 'hourly' でフィルタ
      const hourlyData = parsedData.filter(d => {
        if (d.salaryParsed.minValue === null || d.salaryParsed.minValue <= 0) return false;
        // salaryTypeで正確にフィルタ
        if (d.salaryParsed.salaryType !== 'hourly') return false;
        return true;
      });

      if (hourlyData.length === 0) return null;

      const salaries = hourlyData
        .map(r => {
          const min = r.salaryParsed.minValue;
          const max = r.salaryParsed.maxValue;
          return max ? (min + max) / 2 : min;
        })
        .filter(v => v !== null && !isNaN(v))
        .sort((a, b) => a - b);

      if (salaries.length === 0) return null;

      // 時給は円単位でそのまま返す
      return {
        count: salaries.length,
        min: Math.round(Math.min(...salaries)),
        max: Math.round(Math.max(...salaries)),
        avg: Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length),
        median: Math.round(salaries[Math.floor(salaries.length / 2)]),
        p10: Math.round(getPercentile(salaries, 10)),
        p25: Math.round(getPercentile(salaries, 25)),
        p75: Math.round(getPercentile(salaries, 75)),
        p90: Math.round(getPercentile(salaries, 90)),
        isHourly: true
      };
    } else {
      // 月給モード: 月給・年収データのunifiedMonthlyで統計
      const validData = parsedData.filter(d =>
        d.salaryParsed.unifiedMonthly !== null &&
        (d.salaryParsed.salaryType === 'monthly' || d.salaryParsed.salaryType === 'annual')
      );

      const salaries = validData
        .map(r => r.salaryParsed.unifiedMonthly)
        .sort((a, b) => a - b);

      if (salaries.length === 0) return null;

      // 万円単位で返す
      return {
        count: salaries.length,
        min: Math.round(Math.min(...salaries) / 10000),
        max: Math.round(Math.max(...salaries) / 10000),
        avg: Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length / 10000),
        median: Math.round(salaries[Math.floor(salaries.length / 2)] / 10000),
        p10: Math.round(getPercentile(salaries, 10) / 10000 * 10) / 10,
        p25: Math.round(getPercentile(salaries, 25) / 10000 * 10) / 10,
        p75: Math.round(getPercentile(salaries, 75) / 10000 * 10) / 10,
        p90: Math.round(getPercentile(salaries, 90) / 10000 * 10) / 10,
        isHourly: false
      };
    }
  }

  /**
   * 都市別集計データを取得（マップ用）
   * @param {boolean} forceRefresh - 強制リフレッシュフラグ
   * @param {string} salaryDisplayType - 給与表示タイプ ('monthly' or 'hourly')
   * @returns {Array} 都市別データ
   */
  function getCityAggregation(forceRefresh = false, salaryDisplayType = null) {
    const parsedData = getParsedData(forceRefresh);

    // salaryDisplayTypeが指定されていない場合はScriptPropertiesから取得
    if (!salaryDisplayType) {
      salaryDisplayType = PropertiesService.getScriptProperties().getProperty('salaryDisplayType') || 'monthly';
    }

    const isHourly = salaryDisplayType === 'hourly';

    const cityGroups = {};
    parsedData.forEach(record => {
      const cityWard = record.locationParsed.cityWard || '不明';
      if (!cityGroups[cityWard]) {
        cityGroups[cityWard] = {
          name: cityWard,
          prefecture: record.locationParsed.prefecture,
          records: []
        };
      }
      cityGroups[cityWard].records.push(record);
    });

    const cityData = [];
    Object.values(cityGroups).forEach(group => {
      if (group.name === '不明') return;

      const coords = getCityCoordinates(group.name, group.prefecture);
      if (!coords) {
        console.warn('座標なしでスキップ: ' + group.name + ' (' + group.prefecture + ')');
        return;
      }

      const records = group.records;

      // 給与データの取得（モードに応じてフィルタと値を変更）
      let validSalaries;
      if (isHourly) {
        // 🔴 FIX: 時給モード: salaryType === 'hourly' でフィルタ
        validSalaries = records
          .filter(r => {
            if (r.salaryParsed.minValue === null || r.salaryParsed.minValue <= 0) return false;
            // salaryTypeで正確にフィルタ
            if (r.salaryParsed.salaryType !== 'hourly') return false;
            return true;
          })
          .map(r => {
            const min = r.salaryParsed.minValue;
            const max = r.salaryParsed.maxValue;
            return max ? (min + max) / 2 : min;
          })
          .filter(v => v !== null && !isNaN(v));
      } else {
        // 月給モード: 月給・年収データのunifiedMonthly
        validSalaries = records
          .filter(r => r.salaryParsed.unifiedMonthly !== null &&
            (r.salaryParsed.salaryType === 'monthly' || r.salaryParsed.salaryType === 'annual'))
          .map(r => r.salaryParsed.unifiedMonthly);
      }

      const employmentBreakdown = {};
      records.forEach(r => {
        const type = r.employmentParsed.subcategory || '不明';
        employmentBreakdown[type] = (employmentBreakdown[type] || 0) + 1;
      });

      const tagCounts = {};
      records.forEach(r => {
        r.tagsParsed.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag);

      const newCount = records.filter(r => r.isNew === '新着' || r.isNew === 'NEW').length;

      cityData.push({
        name: group.name,
        prefecture: group.prefecture,
        lat: coords[0],
        lng: coords[1],
        jobCount: records.length,
        avgSalary: validSalaries.length > 0
          ? Math.round(validSalaries.reduce((a, b) => a + b, 0) / validSalaries.length)
          : null,
        minSalary: validSalaries.length > 0 ? Math.min(...validSalaries) : null,
        maxSalary: validSalaries.length > 0 ? Math.max(...validSalaries) : null,
        newCount: newCount,
        newRate: records.length > 0 ? Math.round((newCount / records.length) * 100 * 10) / 10 : 0,
        employmentBreakdown: employmentBreakdown,
        topTags: topTags,
        isHourly: isHourly
      });
    });

    cityData.sort((a, b) => b.jobCount - a.jobCount);
    return cityData;
  }

  /**
   * 給与分布位置を計算
   * @param {number} salaryMin - 最低給与（万円）
   * @param {number} salaryMax - 最高給与（万円）
   * @param {string} cityName - 都市名（nullで全国）
   * @returns {Object} 分布位置情報
   */
  function calculatePosition(salaryMin, salaryMax, cityName) {
    let parsedData = getParsedData();

    // 都市でフィルタ
    if (cityName) {
      parsedData = parsedData.filter(r => {
        const loc = r.locationParsed.cityWard || '';
        return loc.includes(cityName) || cityName.includes(loc);
      });
    }

    const validSalaries = parsedData
      .filter(r => r.salaryParsed.unifiedMonthly !== null)
      .map(r => r.salaryParsed.unifiedMonthly)
      .sort((a, b) => b - a);

    if (validSalaries.length === 0) {
      return { error: '比較対象のデータがありません', totalCount: 0 };
    }

    const targetSalary = salaryMax && salaryMin
      ? (salaryMin + salaryMax) / 2
      : (salaryMax || salaryMin);

    if (!targetSalary) {
      return { error: '給与が入力されていません', totalCount: validSalaries.length };
    }

    const targetSalaryYen = targetSalary * 10000;
    const higherCount = validSalaries.filter(s => s > targetSalaryYen).length;
    const percentile = Math.round((higherCount / validSalaries.length) * 100 * 10) / 10;

    const stats = {
      min: Math.round(Math.min(...validSalaries) / 10000 * 10) / 10,
      max: Math.round(Math.max(...validSalaries) / 10000 * 10) / 10,
      avg: Math.round(validSalaries.reduce((a, b) => a + b, 0) / validSalaries.length / 10000 * 10) / 10,
      median: Math.round(validSalaries[Math.floor(validSalaries.length / 2)] / 10000 * 10) / 10
    };

    let grade, gradeLabel;
    if (percentile <= 10) { grade = 'S'; gradeLabel = '上位10%以内'; }
    else if (percentile <= 25) { grade = 'A'; gradeLabel = '上位25%以内'; }
    else if (percentile <= 50) { grade = 'B'; gradeLabel = '上位50%以内'; }
    else if (percentile <= 75) { grade = 'C'; gradeLabel = '上位75%以内'; }
    else { grade = 'D'; gradeLabel = '下位25%'; }

    const rangeMin = (salaryMin || 0) * 10000;
    const rangeMax = (salaryMax || Infinity) * 10000;
    const matchingJobs = validSalaries.filter(s => s >= rangeMin && s <= rangeMax).length;

    return {
      targetSalary: targetSalary,
      percentile: percentile,
      grade: grade,
      gradeLabel: gradeLabel,
      position: higherCount + 1,
      totalCount: validSalaries.length,
      matchingJobs: matchingJobs,
      matchingRate: Math.round((matchingJobs / validSalaries.length) * 100 * 10) / 10,
      stats: stats,
      cityName: cityName || '全国'
    };
  }

  /**
   * 流入率を計算
   * @param {Array} targetCityNames - 検索対象都市名配列
   * @returns {Object} 流入率分析結果
   */
  function calculateInflow(targetCityNames, forceRefresh = false) {
    const parsedData = getParsedData(forceRefresh);
    const totalCount = parsedData.length;

    if (targetCityNames.length === 0) {
      return { error: '検索対象が設定されていません' };
    }

    let targetAreaCount = 0;
    let inflowCount = 0;
    let unknownCount = 0;
    const inflowByPrefecture = {};
    const inflowByCity = {};

    parsedData.forEach(r => {
      const cityWard = r.locationParsed.cityWard || '';
      const prefecture = r.locationParsed.prefecture || '';

      if (!cityWard && !prefecture) {
        unknownCount++;
        return;
      }

      const isTargetArea = targetCityNames.some(name =>
        cityWard.includes(name) || name.includes(cityWard));

      if (isTargetArea) {
        targetAreaCount++;
      } else {
        inflowCount++;
        inflowByPrefecture[prefecture] = (inflowByPrefecture[prefecture] || 0) + 1;
        inflowByCity[cityWard] = (inflowByCity[cityWard] || 0) + 1;
      }
    });

    const topInflowPrefectures = Object.entries(inflowByPrefecture)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
        rate: Math.round((count / totalCount) * 100)
      }));

    const topInflowCities = Object.entries(inflowByCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({
        name,
        count,
        rate: Math.round((count / totalCount) * 100)
      }));

    return {
      totalCount: totalCount,
      targetAreaCount: targetAreaCount,
      inflowCount: inflowCount,
      unknownCount: unknownCount,
      inflowRate: totalCount > 0 ? Math.round((inflowCount / totalCount) * 100 * 10) / 10 : 0,
      targetRate: totalCount > 0 ? Math.round((targetAreaCount / totalCount) * 100 * 10) / 10 : 0,
      targetCities: targetCityNames,
      topInflowPrefectures: topInflowPrefectures,
      topInflowCities: topInflowCities
    };
  }

  // パブリックAPI
  return {
    getRawData: getRawData,
    getParsedData: getParsedData,
    getAggregation: getAggregation,
    getValidSalaryData: getValidSalaryData,
    getSalaryStats: getSalaryStats,
    getCityAggregation: getCityAggregation,
    calculatePosition: calculatePosition,
    calculateInflow: calculateInflow,
    clearCache: clearSessionCache,
    clearAllCache: clearAllCache,
    getCacheKey: getCacheKey,  // スプレッドシート固有キャッシュキー生成

    /**
     * 増分更新を強制実行
     * @param {boolean} forceFullRefresh - 強制全更新フラグ
     * @param {boolean} skipParsedDataSave - trueの場合、inc_parsed_dataを保存しない（クォータ節約）
     * @returns {Object} 増分更新結果
     */
    forceIncrementalUpdate: function(forceFullRefresh = false, skipParsedDataSave = false) {
      clearSessionCache();
      const result = executeIncrementalUpdate(forceFullRefresh, skipParsedDataSave);
      _lastIncrementalResult = result;
      if (result.success && result.parsedData) {
        _parsedDataCache = result.parsedData;
        _cacheTimestamp = Date.now();
      }
      return result;
    },

    /**
     * 最後の増分更新結果を取得
     * @returns {Object|null} 増分更新結果
     */
    getLastIncrementalResult: function() {
      return _lastIncrementalResult;
    },

    // キャッシュ状態確認用（永続化情報含む）
    getCacheStatus: function() {
      const persistentInfo = DataPersistence.getStorageInfo();
      return {
        session: {
          hasRawData: _rawDataCache !== null,
          hasParsedData: _parsedDataCache !== null,
          hasAggregation: _aggregationCache !== null,
          cacheAge: _cacheTimestamp ? Date.now() - _cacheTimestamp : null,
          isValid: isCacheValid()
        },
        persistent: persistentInfo,
        lastIncremental: _lastIncrementalResult ? {
          mode: _lastIncrementalResult.mode,
          stats: _lastIncrementalResult.stats,
          duration: _lastIncrementalResult.duration
        } : null
      };
    }
  };
})();
