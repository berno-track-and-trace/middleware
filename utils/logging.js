import { createLogger, format, transports } from 'winston';

const { combine, timestamp, label, printf } = format;
import path from 'path';
import fs from 'fs';

const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

const createCustomLogger = (loggerLabel) => {
  const logDirectory = `./logs/${loggerLabel}`;

  ensureDirectoryExistence(logDirectory);

  return createLogger({
    format: combine(
      label({ label: loggerLabel }),
      timestamp(),
      customFormat
    ),
    transports: [
      new transports.File({ filename: `${logDirectory}/info.log`, level: 'info' }),
      new transports.File({ filename: `${logDirectory}/warn.log`, level: 'warn' }),
      new transports.File({ filename: `${logDirectory}/error.log`, level: 'error' }),
    //   new transports.File({ filename: `${logDirectory}/combined.log` }),
    ],
  });
};

export default createCustomLogger;
