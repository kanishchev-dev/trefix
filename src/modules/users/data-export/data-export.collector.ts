import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';

/**
 * What goes into the archive. The export is about the person, so it reads the
 * tables of every domain directly instead of going through each module; secrets
 * (password hash, OAuth tokens) are never selected.
 */
const SECTIONS: ReadonlyArray<{ name: string; sql: string }> = [
  {
    name: 'account',
    sql: `SELECT id, email, first_name, last_name, bio, avatar_url, email_verified, created_at, updated_at
            FROM users WHERE id = :userId`,
  },
  { name: 'preferences', sql: `SELECT * FROM user_preferences WHERE user_id = :userId` },
  { name: 'consents', sql: `SELECT * FROM user_consents WHERE user_id = :userId` },
  {
    name: 'sign_in_methods',
    sql: `SELECT provider, email, created_at FROM user_identities WHERE user_id = :userId`,
  },
  { name: 'athlete_profile', sql: `SELECT * FROM athletes WHERE user_id = :userId` },
  { name: 'goals', sql: `SELECT * FROM athlete_goals WHERE athlete_id IN (:athleteIds)` },
  { name: 'training_plans', sql: `SELECT * FROM training_plans WHERE athlete_id IN (:athleteIds)` },
  {
    name: 'workouts',
    sql: `SELECT * FROM workouts WHERE athlete_id IN (:athleteIds) AND deleted_at IS NULL ORDER BY scheduled_at`,
  },
  { name: 'race_results', sql: `SELECT * FROM race_results WHERE athlete_id IN (:athleteIds)` },
  { name: 'gear', sql: `SELECT * FROM gear WHERE athlete_id IN (:athleteIds) AND deleted_at IS NULL` },
  {
    name: 'connected_services',
    sql: `SELECT provider, status, scopes, connected_at, disconnected_at, last_successful_sync_at
            FROM integrations WHERE athlete_id IN (:athleteIds)`,
  },
  {
    name: 'coach_messages',
    sql: `SELECT s.id AS session_id, s.title, m.role, m.content, m.created_at
            FROM coach_sessions s JOIN coach_messages m ON m.session_id = s.id
           WHERE s.user_id = :userId AND m.role IN ('user', 'assistant')
           ORDER BY m.created_at`,
  },
];

@Injectable()
export class DataExportCollector {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  /** Files of runs recorded with the Trefix tracker, added to the archive as they were uploaded. */
  async trackFileIds(userId: string): Promise<string[]> {
    const rows = await this.sequelize.query<{ track_file_id: string }>(
      `SELECT r.track_file_id
         FROM recorded_activities r JOIN athletes a ON a.id = r.athlete_id
        WHERE a.user_id = :userId AND r.track_file_id IS NOT NULL`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );
    return rows.map((row) => row.track_file_id);
  }

  /** Section name → rows. */
  async collect(userId: string): Promise<Record<string, unknown[]>> {
    const athletes = await this.sequelize.query<{ id: string }>('SELECT id FROM athletes WHERE user_id = :userId', {
      replacements: { userId },
      type: QueryTypes.SELECT,
    });
    // `IN ()` is invalid SQL; a nil UUID matches nothing.
    const athleteIds =
      athletes.length > 0 ? athletes.map((athlete) => athlete.id) : ['00000000-0000-0000-0000-000000000000'];
    const result: Record<string, unknown[]> = {};
    for (const section of SECTIONS) {
      result[section.name] = await this.sequelize.query(section.sql, {
        replacements: { userId, athleteIds },
        type: QueryTypes.SELECT,
      });
    }
    return result;
  }
}
