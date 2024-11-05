import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

const createLogger = (peripheral) => {
  const transports = [
    // Rotate log files daily, but all logs go to the same file
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', `combined-%DATE%.log`), // Log to a single file
      datePattern: 'YYYY-MM-DD',
      maxFiles= '1d',
      level: process.env.FILE_LOG_LEVEL || 'info', // Set log level for file
      format: winston.format.combine(
        winston.format.timestamp(),
        // Custom format to place peripheral at the front
        winston.format.printf(({ level, message, timestamp }) => {
          return JSON.stringify({
            peripheral,
            timestamp,
            level,
            message
          });
        })
      ),
    }),
  ];

  // Optionally log to console with a different log level
  if (process.env.LOG_TO_CONSOLE === 'true') {
    transports.push(new winston.transports.Console({
      level: process.env.CONSOLE_LOG_LEVEL || 'error', // Set log level for console
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => {
          return `[${timestamp}] ${level}: [${peripheral}] ${message}`;
        })
      ),
    }));
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Set default log level
    transports,
  });
};

//loggers for different peripherals
export const printerLogger = createLogger('printer');
export const serCamLogger = createLogger('serCam');
export const printP = createLogger('printProcess');
export const aggCam = createLogger('aggCam');
export const init = createLogger('init')
export const weighingScale = createLogger('weighingScale') 
export const rejector = createLogger('rejector')
