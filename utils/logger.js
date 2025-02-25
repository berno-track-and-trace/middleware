import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';
import { create } from 'domain';

const createLogger = (peripheral) => {
  const transports = [
    new winston.transports.DailyRotateFile({
      filename: process.env.COMBINE_LOGS === 'true' ? path.join('logs', `%DATE%-combined.log`) : path.join('logs', `%DATE%-${peripheral}.log`),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      level: process.env.FILE_LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
          // Check if message is an object, and stringify it if so
          const logMessage = typeof message === 'object' ? JSON.stringify(message) : message;
          return JSON.stringify({
            peripheral,
            timestamp,
            level,
            message: logMessage,
          });
        })
      ),
    }),
  ];

  if (process.env.LOG_TO_CONSOLE === 'true') {
    transports.push(new winston.transports.Console({
      level: process.env.CONSOLE_LOG_LEVEL || 'error',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => {
          const logMessage = typeof message === 'object' ? JSON.stringify(message) : message;
          return `[${timestamp}] ${level}: [${peripheral}] ${logMessage}`;
        })
      ),
    }));
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    // silent:true,
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
// export const rejectorLogger = createLogger('rejector')
export const mongoDBLogger = createLogger('mongoDB')
export const beWsLogger = createLogger('backEndWebSocket')
export const apiCallLogger = createLogger('APICall')
export const apiServerLogger = createLogger('apiServer')
export const middlewareLogger = createLogger('middleware')
