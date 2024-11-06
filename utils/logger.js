import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

const createLogger = (peripheral) => {
  const transports = [
    // Rotate log files daily, but all logs go to the same file
    new winston.transports.DailyRotateFile({
      filename: process.env.COMBINE_LOGS==='true'?path.join('logs', `combined-%DATE%.log`):path.join('logs', `${peripheral}-%DATE%.log`), // Log to a single file
      datePattern: 'YYYY-MM-DD',
      maxFiles: '1d',
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
export const printPLogger = createLogger('printProcess');
export const aggCamLogger = createLogger('aggCam');
export const initLogger = createLogger('init')
export const weighingScaleLogger = createLogger('weighingScale') 
export const rejectorLogger = createLogger('rejector')
export const mongoDBLogger = createLogger('mongoDB')
export const beWsLogger = createLogger('backEndWebSocket')

