const app = require('./app');
const logger = require('./utils/logger');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info('Ticketing system started', { port, nodeEnv: process.env.NODE_ENV || 'development' });
});
