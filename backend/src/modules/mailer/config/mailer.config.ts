import { registerAs } from '@nestjs/config';
import * as path from 'path';

import { MAILER_DEFAULT_FROM_NAME } from '../mailer.constants';

export default registerAs('mailer', () => ({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  user: process.env.MAIL_USER,
  password: process.env.MAIL_PASSWORD,
  from: process.env.MAIL_FROM,
  fromName: process.env.MAIL_FROM_NAME || MAILER_DEFAULT_FROM_NAME,
  secure: process.env.MAIL_SECURE === 'true',
  allowFromOverride: process.env.MAIL_ALLOW_FROM_OVERRIDE === 'true',
  useQueue: process.env.MAIL_USE_QUEUE === 'true',
  templateRoot: path.join(process.cwd(), 'src/modules/mailer/templates'),
}));
