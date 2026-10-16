import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { AdminCoachNoteListResponseDto, AdminCoachSessionListResponseDto } from './admin-coach.dto';
import { COACH_EVENTS } from './coach.events';
import { CoachService } from './coach.service';
import { CoachSessionDetailResponseDto } from './dto/coach-response.dto';
import { CoachWorkoutNoteResponseDto } from './dto/coach-workout-note-response.dto';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';
import { CoachWorkoutNote } from './workout-notes/workout-note.entity';
import { CoachWorkoutNotesService } from './workout-notes/workout-notes.service';

const NOTES_LIST_LIMIT = 100;
/** Roles a person reads in the chat; tool calls are internal. */
const CONVERSATION_ROLES = ['user', 'assistant'];

/** AI coach data of any user for the admin panel. */
@Injectable()
export class AdminCoachService {
  constructor(
    @InjectModel(CoachSession)
    private readonly sessionModel: typeof CoachSession,
    @InjectModel(CoachMessage)
    private readonly messageModel: typeof CoachMessage,
    @InjectModel(CoachWorkoutNote)
    private readonly noteModel: typeof CoachWorkoutNote,
    private readonly coachService: CoachService,
    private readonly notesService: CoachWorkoutNotesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listSessions(userId: string): Promise<AdminCoachSessionListResponseDto> {
    const sessions = await this.sessionModel.findAll({
      where: { userId },
      order: [
        ['lastMessageAt', 'DESC NULLS LAST'],
        ['createdAt', 'DESC'],
      ],
    });
    const counts = new Map<string, number>();
    if (sessions.length > 0) {
      const rows = (await this.messageModel.count({
        where: { sessionId: sessions.map((session) => session.id), role: { [Op.in]: CONVERSATION_ROLES } },
        group: ['sessionId'],
      })) as unknown as Array<{ sessionId: string; count: number }>;
      rows.forEach((row) => counts.set(row.sessionId, Number(row.count)));
    }
    return {
      items: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastMessageAt: session.lastMessageAt,
        messagesCount: counts.get(session.id) ?? 0,
      })),
    };
  }

  getSession(userId: string, sessionId: string): Promise<CoachSessionDetailResponseDto> {
    return this.coachService.getSession(userId, sessionId);
  }

  clearHistory(userId: string): Promise<void> {
    return this.coachService.clearHistory(userId);
  }

  async listNotes(userId: string): Promise<AdminCoachNoteListResponseDto> {
    const notes = await this.noteModel.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']],
      limit: NOTES_LIST_LIMIT,
    });
    return {
      items: notes.map((note) => ({ workoutId: note.workoutId, language: note.language, generatedAt: note.updatedAt })),
    };
  }

  getNote(userId: string, workoutId: string): Promise<CoachWorkoutNoteResponseDto> {
    return this.notesService.getNote(userId, workoutId);
  }

  /** Drops the stored note so the coach writes it again; answers `pending` while it does. */
  async regenerateNote(userId: string, workoutId: string): Promise<CoachWorkoutNoteResponseDto> {
    await this.notesService.getNote(userId, workoutId);
    await this.noteModel.destroy({ where: { userId, workoutId } });
    return this.notesService.getNote(userId, workoutId);
  }

  /** Removes the note in every language; opening the workout in the app writes it again. */
  async deleteNote(userId: string, workoutId: string): Promise<void> {
    await this.notesService.getNote(userId, workoutId);
    const removed = await this.noteModel.destroy({ where: { userId, workoutId } });
    if (removed > 0) {
      this.eventEmitter.emit(COACH_EVENTS.WORKOUT_NOTE_DELETED, { userId, workoutId });
    }
  }
}
