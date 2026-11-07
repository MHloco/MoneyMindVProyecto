const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

test('welcome email embeds the existing promotional PNG in its MIME message', async () => {
  // Build the real message in memory without sending email or using SMTP credentials.
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const createTransport = mock.method(nodemailer, 'createTransport', () => transport);
  const servicePath = require.resolve('./email.services');
  delete require.cache[servicePath];
  try {
    const { sendWelcomeEmail } = require(servicePath);
    const result = await sendWelcomeEmail('preview@example.invalid');
    const message = result.message.toString();
    assert.match(message, /Content-Type: multipart\/related/);
    assert.match(message, /Content-Type: image\/png/);
    assert.match(message, /Content-ID: <moneymindvPromoImg>/);
    assert.match(message, /Content-Disposition: inline/);
    // Quoted-printable can wrap the HTML; attachment bytes must match the source image.
    assert.match(message.replace(/=\r\n/g, ''), /cid:moneymindvPromoImg/);
    const encoded = message.split('Content-Transfer-Encoding: base64')[1]
      .split('\r\n\r\n')[1].split('\r\n--')[0];
    const attachment = Buffer.from(encoded, 'base64');
    assert.deepEqual(attachment.subarray(0, 8), Buffer.from('89504e470d0a1a0a', 'hex'));
    assert.deepEqual(attachment, fs.readFileSync(path.join(__dirname, '../images/imagen publicitaria.png')));
  } finally {
    createTransport.mock.restore();
    delete require.cache[servicePath];
    transport.close();
  }
});
