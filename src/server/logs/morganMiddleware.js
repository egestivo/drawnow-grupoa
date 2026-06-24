const morgan = require('morgan');
const logger = require('./logger');

const stream = {
  write: (message) => {
    const trimmed = message.trim();
    if (trimmed) {
      logger.info(trimmed, { category: 'sistema' });
    }
  }
};

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream }
);

module.exports = morganMiddleware;
