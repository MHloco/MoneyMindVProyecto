// Run from any working directory. Does not print credentials or overwrite existing values.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const apiPath = path.resolve(__dirname, '../.env');
const aiPath = path.resolve(__dirname, '../../ai-service/.env');
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
let apiText = read(apiPath), aiText = read(aiPath);
const api = dotenv.parse(apiText), ai = dotenv.parse(aiText);
if (api.AI_SERVICE_TOKEN && ai.AI_SERVICE_TOKEN && api.AI_SERVICE_TOKEN !== ai.AI_SERVICE_TOKEN) {
  throw new Error('Los tokens de servicio existentes no coinciden. Revísalos sin compartirlos.');
}
const token = api.AI_SERVICE_TOKEN || ai.AI_SERVICE_TOKEN || crypto.randomBytes(32).toString('hex');
function setMissing(text, values, name, value) {
  if (values[name]) return text;
  const withoutEmpty = text.replace(new RegExp(`^${name}=.*$`, 'gm'), '');
  return withoutEmpty.trimEnd() + `\n${name}=${value}\n`;
}
apiText = setMissing(apiText, api, 'AI_SERVICE_TOKEN', token);
apiText = setMissing(apiText, api, 'AI_SERVICE_URL', 'http://127.0.0.1:8000');
aiText = setMissing(aiText, ai, 'AI_SERVICE_TOKEN', token);
aiText = setMissing(aiText, ai, 'GEMINI_API_KEY', api.GEMINI_API_KEY || '');
aiText = setMissing(aiText, ai, 'GEMINI_MODEL', api.GEMINI_MODEL || 'gemini-3.5-flash-lite');
fs.writeFileSync(apiPath, apiText);
fs.writeFileSync(aiPath, aiText);
console.log('Configuración privada de Node y FastAPI preparada. No se mostraron claves.');
