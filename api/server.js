require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const pool = require('./config/db');
const { connectRedis } = require('./config/redis');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const alertRoutes = require('./routes/alert.routes');
const budgetRoutes = require('./routes/budget.routes');
const calendarRoutes = require('./routes/calendar.routes');
const categoryRoutes = require('./routes/category.routes');
const expenseRoutes = require('./routes/expense.routes');
const obligationRoutes = require('./routes/obligation.routes');
const incomeRoutes = require('./routes/income.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const assistantRoutes = require('./routes/assistant.routes');
const app = express(); 

// Only enable hops that belong to the configured reverse proxies.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 2) {
  throw new Error('TRUST_PROXY_HOPS debe ser 0, 1 o 2.');
}
app.set('trust proxy', proxyHops);
if (process.env.NODE_ENV === 'production') {
  for (const key of ['DATABASE_URL', 'REDIS_URL', 'CLIENT_URL', 'JWT_ACCESS_SECRET', 'AI_SERVICE_URL', 'AI_SERVICE_TOKEN']) {
    if (!process.env[key]) throw new Error(`Falta configurar ${key}.`);
  }
  if (process.env.JWT_ACCESS_SECRET.length < 32 || process.env.AI_SERVICE_TOKEN.length < 32) {
    throw new Error('JWT_ACCESS_SECRET y AI_SERVICE_TOKEN requieren al menos 32 caracteres.');
  }
}

const PORT =
  process.env.PORT || 4000;

app.use(helmet());


app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      'http://localhost:4200',

    credentials: true,
  })
);


app.use(express.json());


app.use(
  morgan(
    process.env.NODE_ENV === 'production'
      ? 'combined'
      : 'dev'
  )
);

app.get('/health', async (req, res) => {

  try {

    await pool.query('SELECT 1');
    await require('./config/redis').redisClient.ping();
    res.status(200).json({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });

  } catch (error) {
    console.error(
      'Error comprobando PostgreSQL:',
      error
    );


    res.status(500).json({
      status: 'error',
      db: 'down',
    });

  }
});

app.use(
  '/api/auth',
  authRoutes
);
app.use(
  '/api/dashboard',
  dashboardRoutes
);
app.use(
  '/api/budgets',
  budgetRoutes
);
app.use(
  '/api/alerts',
   alertRoutes
);
app.use(
  '/api/calendar',
   calendarRoutes
);
app.use(
  '/api/categories',
   categoryRoutes
);
app.use(
  '/api/expenses',
   expenseRoutes
);
app.use(
  '/api/obligations',
   obligationRoutes
);
app.use(
  '/api/incomes',
   incomeRoutes
);
app.use(
  '/api/subscription',
   subscriptionRoutes
);
app.use(
  '/api/newsletter',
   newsletterRoutes
);
app.use('/api/assistant', assistantRoutes);
app.use('/api/admin', require('./routes/admin.routes'));

app.use((req, res) => {

  res.status(404).json({
    message: 'Ruta no encontrada',
  });

});
app.use(
  (err, req, res, next) => {

    console.error(
      'Error en la API:',
      err
    );


    res.status(
      err.status || 500
    ).json({

      message:
        (process.env.NODE_ENV === 'production' && (!err.status || err.status >= 500) ? null : err.message) ||
        'Error interno del servidor',

    });

  }
);
// ============================================================
// START SERVER
// ============================================================

async function start() {
  try {
    // PostgreSQL
    await pool.query('SELECT 1');
    console.log(
      'PostgreSQL conectado correctamente'
    );

    // Redis
    await connectRedis();

    app.listen(
      PORT,
      () => {
        console.log(
          `API escuchando en http://localhost:${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      'No se pudo iniciar el servidor:',
      error
    );
    process.exit(1);
  }
}
start();
