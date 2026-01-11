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
    METADATA: 'inc_metadata'
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
     */
    clearAll: function() {
      const props = PropertiesService.getScriptProperties();
      const allProps = props.getProperties();
      let deletedCount = 0;

      // inc_ で始まる全てのプロパティを削除（孤立したチャンクも含む）
      Object.keys(allProps).forEach(key => {
        if (key.startsWith('inc_')) {
          props.deleteProperty(key);
          deletedCount++;
        }
      });

      console.log('DataPersistence: 全データをクリア（' + deletedCount + 'プロパティ削除）');

      // 削除確認
      const remaining = Object.keys(props.getProperties()).filter(k => k.startsWith('inc_'));
      if (remaining.length > 0) {
        console.warn('DataPersistence: 警告 - 残留プロパティ: ' + remaining.join(', '));
      }
    },

    /**
     * クリアが成功したか検証
     * @returns {boolean} クリア成功
     */
    verifyClearAll: function() {
      const props = PropertiesService.getScriptProperties();
      const allProps = props.getProperties();
      const incProps = Object.keys(allProps).filter(k => k.startsWith('inc_'));
      return incProps.length === 0;
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
