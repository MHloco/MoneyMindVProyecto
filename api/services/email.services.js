const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendWelcomeEmail(toEmail) {

  const imagePath = path.resolve(
    __dirname,
    '../images/imagen publicitaria.png'
  );

  // Verificar que la imagen existe
  if (!fs.existsSync(imagePath)) {
    throw new Error(`No se encontró la imagen: ${imagePath}`);
  }

  const mailOptions = {
    from: `"MoneyMindV" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Te damos la bienvenida a MoneyMindV',

    html: `
      <div style="
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #0a0a0a;
        color: #ffffff;
        padding: 35px 20px;
        text-align: center;
        border-radius: 12px;
        max-width: 600px;
        margin: 0 auto;
        border: 1px solid rgba(197, 160, 89, 0.2);
      ">

        <h1 style="
          color: #c5a059;
          margin-bottom: 5px;
          font-size: 28px;
          letter-spacing: 1px;
        ">
          MoneyMind<em style="font-style: italic; color: #e5c158;">V</em>
        </h1>

        <p style="
          color: #888888;
          font-size: 13px;
          margin-top: 0;
          text-transform: uppercase;
          letter-spacing: 2px;
        ">
          Tu dinero · Tu mente · Tu futuro
        </p>

        <hr style="
          border: 0;
          border-top: 1px solid rgba(197, 160, 89, 0.2);
          margin: 20px 0;
        " />

        <h2 style="
          color: #f5f5f5;
          font-size: 20px;
          font-weight: 500;
        ">
          ¡Gracias por unirte a nuestra comunidad!
        </h2>

        <p style="
          color: #a0a0a0;
          font-size: 14px;
          line-height: 1.6;
          max-width: 480px;
          margin: 0 auto 25px auto;
        ">
          Tu camino hacia la organización, el control y la libertad financiera
          comienza hoy. Te mantendremos al tanto de las últimas actualizaciones
          y herramientas exclusivas.
        </p>

        <!-- IMAGEN CID -->
        <div style="margin: 25px 0;">
          <img
            src="cid:moneymindvPromoImg"
            alt="MoneyMindV Promoción"
            style="
              max-width: 100%;
              height: auto;
              border-radius: 10px;
              border: 1px solid rgba(197, 160, 89, 0.4);
            "
          />
        </div>

        <div style="
          background-color: #141414;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 20px;
          border-radius: 8px;
          text-align: left;
          margin: 25px auto;
        ">

          <h3 style="
            color: #c5a059;
            margin-top: 0;
            font-size: 16px;
          ">
            ✦ Lo que podrás gestionar en MoneyMindV:
          </h3>

          <ul style="
            color: #cccccc;
            font-size: 13px;
            line-height: 1.8;
            padding-left: 20px;
            margin-bottom: 0;
          ">
            <li>Presupuestos mensuales y control de ingresos / egresos.</li>
            <li>Alertas inteligentes de vencimiento de obligaciones.</li>
            <li>Calendario consolidado de compromisos financieros.</li>
            <li>Análisis de metas de ahorro y reportes visuales.</li>
          </ul>

        </div>

        <p style="
          color: #555555;
          font-size: 11px;
          margin-top: 30px;
        ">
          © 2026 MoneyMindV. Todos los derechos reservados.
        </p>

      </div>
    `,

    attachments: [
      {
        filename: 'moneymindv-promo.png',
        path: imagePath,
        cid: 'moneymindvPromoImg',
        contentType: 'image/png',
        contentDisposition: 'inline'
      }
    ]
  };

  return await transporter.sendMail(mailOptions);
}

module.exports = {
  sendWelcomeEmail
};
