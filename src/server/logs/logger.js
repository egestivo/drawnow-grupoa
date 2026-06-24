const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '..', '..', '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const customLevels = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4 };

const customColors = {
  fatal: 'red',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'gray'
};

const consoleFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.colorize({ colors: customColors, all: true }),
  format.printf(({ timestamp, level, message, category }) => {
    const cat = category ? ` [${category}]` : '';
    return `${timestamp} ${level}${cat}: ${message}`;
  })
);

const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, category }) => {
    const cat = category ? ` [${category}]` : '';
    return `${timestamp} [${level.toUpperCase()}]${cat}: ${message}`;
  })
);

const authFilter = format((info) => info.category === 'auth' ? info : false);
const sistemaFilter = format((info) => info.category === 'sistema' ? info : false);

const logger = createLogger({
  levels: customLevels,
  level: 'debug',
  transports: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({
      filename: path.join(logDir, 'auth.log'),
      format: format.combine(authFilter(), fileFormat),
      level: 'debug'
    }),
    new transports.File({
      filename: path.join(logDir, 'sistema.log'),
      format: format.combine(sistemaFilter(), fileFormat),
      level: 'debug'
    }),
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      format: fileFormat,
      level: 'error'
    })
  ]
});

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

const originalLog = logger.log.bind(logger);
logger.log = function (level, message, ...meta) {
  originalLog(level, message, ...meta);
  if (ioInstance) {
    ioInstance.to('admins').emit('admin-log', {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: new Date().toISOString()
    });
  }
};

logger.setIo = setIo;

module.exports = logger;
