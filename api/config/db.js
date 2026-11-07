const { Pool } = require('pg');
const { databaseOptions } = require('./database-options');

const pool = new Pool(databaseOptions());

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

module.exports = pool;
