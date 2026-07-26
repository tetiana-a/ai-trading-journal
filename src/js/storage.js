/**
 * storage.js — Abstraction layer over localStorage with fallback.
 * Provides async get/set interface for future IndexedDB migration.
 */

const STORAGE_KEYS = Object.freeze({
  TRADES: 'tk_journal_trades_v2',
  API_KEY: 'tk_ai_api_key',
  API_URL: 'tk_ai_api_url',
  API_MODEL: 'tk_ai_model',
  LANG: 'tk_lang',
});

const db = {
  /**
   * Read a value by key.
   * @param {string} k
   * @returns {Promise<string|null>}
   */
  get(k) {
    try {
      return Promise.resolve(localStorage.getItem(k));
    } catch (e) {
      console.warn('[storage] localStorage.get failed:', e);
      return Promise.resolve(null);
    }
  },

  /**
   * Write a value by key.
   * @param {string} k
   * @param {string} v
   * @returns {Promise<void>}
   */
  set(k, v) {
    try {
      localStorage.setItem(k, v);
      return Promise.resolve();
    } catch (e) {
      console.error('[storage] localStorage.set failed:', e);
      return Promise.reject(e);
    }
  },

  /**
   * Remove a key.
   * @param {string} k
   */
  remove(k) {
    try { localStorage.removeItem(k); } catch (_) { /* noop */ }
  },
};
