/**
 * DataPersistence.js - データ永続化モジュール
 * PropertiesServiceを使用した解析済みデータの永続化
 * 100KBチャンク分割対応
 * Phase 4: 増分更新最適化
 */

/**
 * データ永続化シングルトン
 */
const DataPersistence = (function() {
  // チャンクサイズ（90KB - 安全マージン込み）
  const CHUNK_SIZE = 90000;

  // キー定数
  const KEYS = {
    PARSED_DATA: 'inc_parsed_data',
    HASH_MAP: 'inc_hash_map',
    METADATA: 'inc_metadata',
    // 事前計算データ（CSVインポート時に計算）
    PRECOMPUTED_DASHBOARD: 'precomputed_dashboard',
    PRECOMPUTED_MAP: 'precomputed_map',
    PRECOMPUTED_ANALYSIS: 'precomputed_analysis'  // 分析タブ用
  };

  /**
   * データをチャンク分割して保存
   * @param {string} key - 保存キー
   * @param {*} data - 保存データ
   * @returns {boolean} 成功/失敗
   */
  function saveData(key, data) {
    try {
      const props = PropertiesService.getScriptProperties();
      const jsonStr = JSON.stringify(data);

      // 既存チャンクを削除
      deleteExistingChunks(key, props);

      // チャンク数を計算
      const chunkCount = Math.ceil(jsonStr.length / CHUNK_SIZE);

      // チャンクを保存
      for (let i = 0; i < chunkCount; i++) {
        const chunk = jsonStr.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        props.setProperty(key + '_c' + i, chunk);
      }

      // メタデータを保存
      props.setProperty(key + '_m', JSON.stringify({
        chunkCount: chunkCount,
        totalLength: jsonStr.length,
        savedAt: new Date().toISOString()
      }));

      console.log('DataPersistence: ' + key + ' を ' + chunkCount + ' チャンクで保存 (' + Math.round(jsonStr.length / 1024) + 'KB)');
      return true;

    } catch (error) {
      console.error('DataPersistence save error:', error);
      return false;
    }
  }

  /**
   * 既存のチャンクを削除
   */
  function deleteExistingChunks(key, props) {
    const metaStr = props.getProperty(key + '_m');
    if (metaStr) {
      try {
        const meta = JSON.parse(metaStr);
        for (let i = 0; i < meta.chunkCount; i++) {
          props.deleteProperty(key + '_c' + i);
        }
      } catch (e) {
        // メタデータが壊れている場合は無視
      }
      props.deleteProperty(key + '_m');
    }
  }

  /**
   * チャンクを結合してデータを読み込み
   * @param {string} key - 読み込みキー
   * @returns {*} 読み込みデータ（存在しない場合はnull）
   */
  function loadData(key) {
    try {
      const props = PropertiesService.getScriptProperties();
      const metaStr = props.getProperty(key + '_m');

      if (!metaStr) {
        return null;
      }

      const meta = JSON.parse(metaStr);
      let jsonStr = '';

      for (let i = 0; i < meta.chunkCount; i++) {
        const chunk = props.getProperty(key + '_c' + i);
        if (!chunk) {
          console.warn('DataPersistence: チャンク ' + i + ' が見つかりません');
          return null;
        }
        jsonStr += chunk;
      }

      console.log('DataPersistence: ' + key + ' を読み込み (' + meta.chunkCount + ' チャンク)');
      return JSON.parse(jsonStr);

    } catch (error) {
      console.error('DataPersistence load error:', error);
      return null;
    }
  }

  /**
   * データを削除
   * @param {string} key - 削除キー
   */
  function deleteData(key) {
    const props = PropertiesService.getScriptProperties();
    deleteExistingChunks(key, props);
  }

  /**
   * チャンク数を取得
   * @param {string} key - キー
   * @returns {number} チャンク数（存在しない場合は0）
   */
  function getChunkCount(key) {
    const props = PropertiesService.getScriptProperties();
    const metaStr = props.getProperty(key + '_m');
    if (!metaStr) return 0;

    try {
      const meta = JSON.parse(metaStr);
      return meta.chunkCount;
    } catch (e) {
      return 0;
    }
  }

  /**
   * データサイズを取得
   * @param {string} key - キー
   * @returns {number} バイト数（存在しない場合は0）
   */
  function getDataSize(key) {
    const props = PropertiesService.getScriptProperties();
    const metaStr = props.getProperty(key + '_m');
    if (!metaStr) return 0;

    try {
      const meta = JSON.parse(metaStr);
      return meta.totalLength;
    } catch (e) {
      return 0;
    }
  }

  // パブリックAPI
  return {
    /**
     * 解析済みデータを保存
     * @param {Array} data - 解析済みデータ配列
     * @returns {boolean} 成功/失敗
     */
    saveParsedData: function(data) {
      return saveData(KEYS.PARSED_DATA, data);
    },

    /**
     * 解析済みデータを読み込み
     * @returns {Array|null} 解析済みデータ配列
     */
    loadParsedData: function() {
      return loadData(KEYS.PARSED_DATA);
    },

    /**
     * ハッシュマップを保存
     * @param {Object} hashMap - ハッシュマップ
     * @returns {boolean} 成功/失敗
     */
    saveHashMap: function(hashMap) {
      return saveData(KEYS.HASH_MAP, hashMap);
    },

    /**
     * ハッシュマップを読み込み
     * @returns {Object|null} ハッシュマップ
     */
    loadHashMap: function() {
      return loadData(KEYS.HASH_MAP);
    },

    /**
     * メタデータを保存
     * @param {Object} metadata - メタデータ
     */
    saveMetadata: function(metadata) {
      const props = PropertiesService.getScriptProperties();
      props.setProperty(KEYS.METADATA, JSON.stringify(metadata));
    },

    /**
     * メタデータを読み込み
     * @returns {Object|null} メタデータ
     */
    loadMetadata: function() {
      const props = PropertiesService.getScriptProperties();
      const str = props.getProperty(KEYS.METADATA);
      return str ? JSON.parse(str) : null;
    },

    /**
     * 全データをクリア（強化版）
     * 関連する全てのプロパティを確実に削除
     * 事前計算データも含む
     * @param {boolean} throwOnFailure - 失敗時に例外を投げるか
     * @returns {Object} クリア結果
     */
    clearAll: function(throwOnFailure) {
      console.log('DataPersistence.clearAll: 開始');
      const props = PropertiesService.getScriptProperties();
      let totalDeleted = 0;
      let retryCount = 0;
      const maxRetries = 3;

      // 複数回試行（GASのPropertiesServiceは時々遅延がある）
      while (retryCount < maxRetries) {
        const allProps = props.getProperties();
        const keysToDelete = Object.keys(allProps).filter(k =>
          k.startsWith('inc_') || k.startsWith('precomputed_')
        );

        if (keysToDelete.length === 0) {
          console.log('DataPersistence.clearAll: 削除対象なし（完了）');
          break;
        }

        console.log('DataPersistence.clearAll: 試行' + (retryCount + 1) + ' - ' + keysToDelete.length + 'キー削除');

        // 一つずつ削除（確実性のため）
        keysToDelete.forEach(key => {
          try {
            props.deleteProperty(key);
            totalDeleted++;
          } catch (e) {
            console.error('DataPersistence.clearAll: 削除失敗 - ' + key + ': ' + e);
          }
        });

        retryCount++;

        // 削除確認
        const remainingKeys = Object.keys(props.getProperties()).filter(k =>
          k.startsWith('inc_') || k.startsWith('precomputed_')
        );

        if (remainingKeys.length === 0) {
          console.log('DataPersistence.clearAll: 完了（' + totalDeleted + 'プロパティ削除）');
          return { success: true, deleted: totalDeleted, remaining: 0 };
        }

        console.warn('DataPersistence.clearAll: 残留あり - ' + remainingKeys.length + 'キー');
        Utilities.sleep(100);
      }

      // 最終確認
      const finalRemaining = Object.keys(props.getProperties()).filter(k =>
        k.startsWith('inc_') || k.startsWith('precomputed_')
      );

      if (finalRemaining.length > 0) {
        const errorMsg = 'DataPersistence.clearAll: 警告 - ' + finalRemaining.length + '個残留: ' + finalRemaining.slice(0, 5).join(', ');
        console.error(errorMsg);
        if (throwOnFailure) {
          throw new Error(errorMsg);
        }
        return { success: false, deleted: totalDeleted, remaining: finalRemaining.length, remainingKeys: finalRemaining };
      }

      return { success: true, deleted: totalDeleted, remaining: 0 };
    },

    /**
     * クリアが成功したか検証
     * @returns {boolean} クリア成功
     */
    verifyClearAll: function() {
      const props = PropertiesService.getScriptProperties();
      const allProps = props.getProperties();
      const remaining = Object.keys(allProps).filter(k =>
        k.startsWith('inc_') || k.startsWith('precomputed_')
      );
      return remaining.length === 0;
    },

    /**
     * ストレージ情報を取得
     * @returns {Object} ストレージ情報
     */
    getStorageInfo: function() {
      const parsedSize = getDataSize(KEYS.PARSED_DATA);
      const hashMapSize = getDataSize(KEYS.HASH_MAP);
      const metadata = this.loadMetadata();

      return {
        parsedData: {
          chunks: getChunkCount(KEYS.PARSED_DATA),
          sizeKB: Math.round(parsedSize / 1024)
        },
        hashMap: {
          chunks: getChunkCount(KEYS.HASH_MAP),
          sizeKB: Math.round(hashMapSize / 1024)
        },
        totalSizeKB: Math.round((parsedSize + hashMapSize) / 1024),
        metadata: metadata
      };
    },

    /**
     * 永続化データが存在するかチェック
     * @returns {boolean} 存在有無
     */
    hasPersistentData: function() {
      const props = PropertiesService.getScriptProperties();
      return props.getProperty(KEYS.PARSED_DATA + '_m') !== null;
    },

    // ===== 事前計算データ（Phase 5）=====

    /**
     * 事前計算済みダッシュボードデータを保存
     * @param {Object} data - ダッシュボードデータ
     * @returns {boolean} 成功/失敗
     */
    savePrecomputedDashboard: function(data) {
      return saveData(KEYS.PRECOMPUTED_DASHBOARD, data);
    },

    /**
     * 事前計算済みダッシュボードデータを読み込み
     * @returns {Object|null} ダッシュボードデータ
     */
    loadPrecomputedDashboard: function() {
      return loadData(KEYS.PRECOMPUTED_DASHBOARD);
    },

    /**
     * 事前計算済み地図データを保存
     * @param {Object} data - 地図データ
     * @returns {boolean} 成功/失敗
     */
    savePrecomputedMap: function(data) {
      return saveData(KEYS.PRECOMPUTED_MAP, data);
    },

    /**
     * 事前計算済み地図データを読み込み
     * @returns {Object|null} 地図データ
     */
    loadPrecomputedMap: function() {
      return loadData(KEYS.PRECOMPUTED_MAP);
    },

    /**
     * 事前計算データが存在するかチェック
     * @returns {boolean} 存在有無
     */
    hasPrecomputedData: function() {
      const props = PropertiesService.getScriptProperties();
      return props.getProperty(KEYS.PRECOMPUTED_DASHBOARD + '_m') !== null &&
             props.getProperty(KEYS.PRECOMPUTED_MAP + '_m') !== null;
    },

    /**
     * 事前計算データのみクリア
     */
    clearPrecomputedData: function() {
      const props = PropertiesService.getScriptProperties();
      deleteExistingChunks(KEYS.PRECOMPUTED_DASHBOARD, props);
      deleteExistingChunks(KEYS.PRECOMPUTED_MAP, props);
      deleteExistingChunks(KEYS.PRECOMPUTED_ANALYSIS, props);
      console.log('DataPersistence: 事前計算データをクリア');
    },

    // ===== 分析データ（Phase 6）=====

    /**
     * 事前計算済み分析データを保存
     * @param {Object} data - 分析データ（企業分析、タグ×給与相関）
     * @returns {boolean} 成功/失敗
     */
    savePrecomputedAnalysis: function(data) {
      return saveData(KEYS.PRECOMPUTED_ANALYSIS, data);
    },

    /**
     * 事前計算済み分析データを読み込み
     * @returns {Object|null} 分析データ
     */
    loadPrecomputedAnalysis: function() {
      return loadData(KEYS.PRECOMPUTED_ANALYSIS);
    }
  };
})();

/**
 * テスト関数
 */
function testDataPersistence() {
  console.log('=== DataPersistence テスト ===');

  // テストデータ
  const testData = [];
  for (let i = 0; i < 100; i++) {
    testData.push({
      id: i,
      name: 'テストデータ' + i,
      value: Math.random() * 1000
    });
  }

  // 保存テスト
  console.log('\n1. 保存テスト:');
  const saved = DataPersistence.saveParsedData(testData);
  console.log('保存結果:', saved);

  // 読み込みテスト
  console.log('\n2. 読み込みテスト:');
  const loaded = DataPersistence.loadParsedData();
  console.log('読み込み件数:', loaded ? loaded.length : 0);

  // ストレージ情報
  console.log('\n3. ストレージ情報:');
  console.log(JSON.stringify(DataPersistence.getStorageInfo(), null, 2));

  // クリアテスト
  console.log('\n4. クリアテスト:');
  DataPersistence.clearAll();
  console.log('クリア後の存在チェック:', DataPersistence.hasPersistentData());
}
