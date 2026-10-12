/**
 * Compile-time checks of the handwritten schemas against the generated
 * contract. Nothing here runs; `tsc` fails when they drift apart.
 *
 * - Requests: what the apps send must be accepted by the backend DTO.
 * - Responses that keep client-side normalization: everything the backend may
 *   send must be accepted by the handwritten schema.
 */
import type { z } from "zod";

import type * as dto from "./generated/types.gen";
import type * as api from "./index";

type Assignable<From, To> = [From] extends [To] ? true : false;
type Expect<T extends true> = T;

export type RequestChecks = [
  Expect<Assignable<api.AuthLoginInput, dto.LoginDto>>,
  Expect<Assignable<api.AuthForgotPasswordInput, dto.PasswordResetRequestDto>>,
  Expect<Assignable<api.AuthResetPasswordInput, dto.PasswordResetConfirmDto>>,
  Expect<Assignable<api.AuthActivateInviteInput, dto.ActivateInviteDto>>,
  Expect<
    Assignable<api.AuthRequestEmailVerificationInput, dto.ResendVerificationDto>
  >,
  Expect<Assignable<api.AuthVerifyEmailInput, dto.VerifyEmailDto>>,
  Expect<Assignable<api.UpdateUserInput, dto.UpdateUserDto>>,
  Expect<Assignable<api.ChangePasswordInput, dto.ChangePasswordDto>>,
  Expect<Assignable<api.MobileAuthEmailRequestInput, dto.EmailOtpRequestDto>>,
  Expect<Assignable<api.MobileAuthEmailVerifyInput, dto.EmailOtpVerifyDto>>,
  Expect<Assignable<api.MobileAuthSocialExchangeInput, dto.SocialExchangeDto>>,
  Expect<Assignable<api.AppleNativeExchangeInput, dto.AppleNativeExchangeDto>>,
  Expect<
    Assignable<api.GoogleNativeExchangeInput, dto.GoogleNativeExchangeDto>
  >,
  Expect<Assignable<api.GearInput, dto.CreateGearDto>>,
  Expect<Assignable<Partial<api.GearInput>, dto.UpdateGearDto>>,
  Expect<
    Assignable<
      z.infer<typeof api.userPreferencesUpdateSchema>,
      dto.UpdateUserPreferencesDto
    >
  >,
  Expect<Assignable<api.CreateWorkoutInput, dto.CreateWorkoutDto>>,
  Expect<Assignable<api.CompleteWorkoutInput, dto.CompleteWorkoutDto>>,
  Expect<Assignable<api.PreviewManualPlanInput, dto.PreviewManualPlanDto>>,
  Expect<Assignable<api.CreateManualPlanInput, dto.CreateManualPlanDto>>,
  Expect<Assignable<api.UpdatePlanMetaInput, dto.UpdatePlanMetaDto>>,
  Expect<Assignable<api.UpdatePlanStructureInput, dto.UpdatePlanStructureDto>>,
  Expect<Assignable<api.PlanChangeRequest, dto.PlanChangesDto>>,
  Expect<Assignable<api.RebuildPreviewInput, dto.RebuildPreviewRequestDto>>,
  Expect<Assignable<api.RebuildInput, dto.RebuildRequestDto>>,
  Expect<Assignable<api.StartPlanInput, dto.StartPlanDto>>,
  Expect<Assignable<api.CreateCoachSessionInput, dto.CreateCoachSessionDto>>,
  Expect<Assignable<api.SendCoachMessageInput, dto.SendCoachMessageDto>>,
  Expect<Assignable<api.RaceResultInput, dto.CreateResultDto>>,
  Expect<Assignable<api.DeviceConnectionRequest, dto.DeviceConnectionDto>>,
  Expect<Assignable<api.DeviceSyncBatchRequest, dto.DeviceSyncBatchDto>>,
  Expect<
    Assignable<api.DeviceProfileMetricsRequest, dto.DeviceProfileMetricsDto>
  >,
  Expect<Assignable<api.AdminCreateUserInput, dto.AdminCreateUserDto>>,
  Expect<Assignable<api.AdminUpdateUserInput, dto.AdminUpdateUserDto>>,
  Expect<Assignable<api.UpdateSettingsInput, dto.UpdateSettingsDto>>,
  Expect<Assignable<api.AdminCreateWorkoutInput, dto.AdminWorkoutCreateDto>>,
  Expect<Assignable<api.AdminUpdateWorkoutInput, dto.AdminWorkoutUpdateDto>>,
];

export type ResponseChecks = [
  Expect<
    Assignable<dto.AuthUserResponseDto, z.input<typeof api.authUserSchema>>
  >,
  Expect<
    Assignable<
      dto.CoachMessageResponseDto,
      z.input<typeof api.coachMessageSchema>
    >
  >,
];
