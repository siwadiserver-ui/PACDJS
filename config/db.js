const firebird = require('node-firebird');
const path = require('path');

const dbOptions = {
  host: '127.0.0.1',
  port: 3050,
  database: path.join(__dirname, '../PACD_WATER.FDB'),
  user: 'SYSDBA',
  password: 'masterkey',
  role: null,
  pageSize: 4096,
  lowercase_keys: false,
  blobAsString: true
};

// 15 connections pool para sa smooth local intranet concurrency
let pool = firebird.pool(15, dbOptions);

function reconnect() {
  try {
    if (pool && typeof pool.destroy === 'function') {
      pool.destroy();
    }
  } catch (e) {}
  pool = firebird.pool(15, dbOptions);
  return pool;
}

function cleanRowBuffers(row) {
  if (!row || typeof row !== 'object') return row;
  const cleaned = {};
  for (const [key, val] of Object.entries(row)) {
    if (Buffer.isBuffer(val)) {
      cleaned[key] = val.toString('utf8').trim();
    } else if (typeof val === 'string') {
      cleaned[key] = val.trim();
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/**
 * Enterprise Query Runner:
 * - Awtomatikong nag-re-retry kapag naputol ang connection
 * - Safe release ng pool connection
 * - Mabilis at non-blocking
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!pool || pool._destroyed) {
      reconnect();
    }

    pool.get((err, db) => {
      if (err) {
        if (err.message && err.message.toLowerCase().includes('destroyed')) {
          reconnect();
          return pool.get((retryErr, retryDb) => {
            if (retryErr) return reject(retryErr);
            runQuery(retryDb);
          });
        }
        return reject(err);
      }

      runQuery(db);
    });

    function runQuery(dbInstance) {
      dbInstance.query(sql, params, (queryErr, result) => {
        // Ibalik sa pool nang maayos
        try {
          dbInstance.detach();
        } catch (e) {}

        if (queryErr) {
          return reject(queryErr);
        }

        if (Array.isArray(result)) {
          resolve(result.map(cleanRowBuffers));
        } else {
          resolve(result || []);
        }
      });
    }
  });
}

module.exports = {
  query,
  pool,
  reconnect,
  options: dbOptions
};