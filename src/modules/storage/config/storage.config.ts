import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  bucket: process.env.S3_BUCKET,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '52428800', 10),
}));
