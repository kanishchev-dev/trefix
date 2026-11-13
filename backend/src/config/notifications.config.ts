import { registerAs } from '@nestjs/config';

export default registerAs('notifications', () => ({
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || null,
  /** Off in environments that must never reach real phones; deliveries are then marked as skipped. */
  pushEnabled: process.env.NOTIFICATIONS_PUSH_ENABLED !== 'false',
}));
