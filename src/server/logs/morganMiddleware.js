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

function skipAuth(req) {
  return req.url.startsWith('/api/auth/') || req.url.startsWith('/auth/');
}

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip: skipAuth }
);

module.exports = morganMiddleware;
