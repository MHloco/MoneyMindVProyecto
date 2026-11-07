const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const ENV_FILE = path.resolve(__dirname, '../.env');

// Local development accepts key/model edits on the next request without a restart.
// Production continues to use the environment supplied when the server starts.
function getGeminiConfig(env = process.env, envFile = ENV_FILE) {
  let file = {};
  if (env.NODE_ENV !== 'production') {
    try {
      file = dotenv.parse(fs.readFileSync(envFile));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return {
    apiKey: (file.GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '').trim(),
    model: (file.GEMINI_MODEL ?? env.GEMINI_MODEL ?? '').trim() || 'gemini-3.5-flash-lite',
  };
}

module.exports = { getGeminiConfig };
