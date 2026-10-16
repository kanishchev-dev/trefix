import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Logger, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { QueuedResponseDto, SuccessResponseDto } from '@/common/dto/status-response.dto';
import { escapeHtml } from '@/common/utils/html.util';
import { secureCompare } from '@/common/utils/secure-compare.util';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { StravaActivitySyncService } from '@/modules/integrations/strava/strava-activity-sync.service';
import { StravaConnectionService } from '@/modules/integrations/strava/strava-connection.service';
import { StravaProfileSyncService } from '@/modules/integrations/strava/strava-profile-sync.service';
import { GearImportResultDto } from '@/modules/training/gear/dto/gear.dto';

import { AuthUserContext } from '../auth/interfaces/auth-user-context.interface';
import {
  IntegrationItemResponseDto,
  IntegrationsListResponseDto,
  StravaProfileAccessResponseDto,
} from './dto/integration-response.dto';
import { StravaConnectResponseDto } from './dto/strava-connect-response.dto';
import { StravaWebhookEventDto, StravaWebhookVerificationQueryDto } from './dto/strava-webhook.dto';
import { IntegrationSyncStatusResponseDto } from './dto/sync-status-response.dto';

interface CallbackPage {
  title: string;
  heading: string;
  body: string;
}

const STRAVA_CALLBACK_SUCCESS_PAGE: CallbackPage = {
  title: 'Strava Connected',
  heading: 'Strava Connected Successfully!',
  body: 'Your running history is now syncing in background. You can return to the Trefix app.',
};

const STRAVA_CALLBACK_FAILED_PAGE: CallbackPage = {
  title: 'Strava Connection Failed',
  heading: 'Failed to connect Strava',
  body: 'Please return to the Trefix app and try again.',
};

/** Browser-facing page shown at the end of the OAuth redirect. */
function renderCallbackPage(page: CallbackPage): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>${escapeHtml(page.title)}</title></head>
  <body style="font-family: sans-serif; text-align: center; padding: 40px;">
    <h2>${escapeHtml(page.heading)}</h2>
    <p>${escapeHtml(page.body)}</p>
  </body>
</html>`;
}

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly stravaActivitySync: StravaActivitySyncService,
    private readonly stravaConnection: StravaConnectionService,
    private readonly stravaProfileSync: StravaProfileSyncService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'List all integrations and their connection statuses' })
  @ApiResponse({ status: 200, type: IntegrationsListResponseDto })
  async listIntegrations(@CurrentUser() user: AuthUserContext): Promise<IntegrationsListResponseDto> {
    return this.integrationsService.listIntegrations(user.id);
  }

  @Get('strava')
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'Get Strava integration status' })
  @ApiResponse({ status: 200, type: IntegrationItemResponseDto })
  async getStravaIntegration(@CurrentUser() user: AuthUserContext): Promise<IntegrationItemResponseDto> {
    return this.integrationsService.getStravaIntegration(user.id);
  }

  @Post('strava/connect')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'Initiate Strava OAuth connection flow' })
  @ApiResponse({ status: 200, type: StravaConnectResponseDto })
  async connectStrava(@CurrentUser() user: AuthUserContext): Promise<StravaConnectResponseDto> {
    return this.stravaConnection.initiateStravaConnect(user.id);
  }

  /** Kept while clients move to `POST strava/connect`: starting the flow stores OAuth state. */
  @Get('strava/connect')
  @Header('Deprecation', 'true')
  @Header('Link', '</v1/integrations/strava/connect>; rel="successor-version"; method="POST"')
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'Initiate Strava OAuth connection flow', deprecated: true })
  @ApiResponse({ status: 200, type: StravaConnectResponseDto })
  async connectStravaLegacy(@CurrentUser() user: AuthUserContext): Promise<StravaConnectResponseDto> {
    return this.stravaConnection.initiateStravaConnect(user.id);
  }

  @Public()
  @Get('strava/callback')
  @ApiOperation({ summary: 'Strava OAuth callback URL' })
  async handleStravaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('scope') scope: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error || !code) {
      this.logger.warn(`Strava authorization was not granted: ${error || 'missing code'}`);
      res.status(HttpStatus.BAD_REQUEST).send(renderCallbackPage(STRAVA_CALLBACK_FAILED_PAGE));
      return;
    }

    try {
      await this.stravaConnection.handleStravaCallback(code, state, scope);
      res.status(HttpStatus.OK).send(renderCallbackPage(STRAVA_CALLBACK_SUCCESS_PAGE));
    } catch (callbackError) {
      // The page is public: provider and internal details stay in the log only.
      this.logger.warn(
        `Strava callback failed: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}`,
      );
      res.status(HttpStatus.BAD_REQUEST).send(renderCallbackPage(STRAVA_CALLBACK_FAILED_PAGE));
    }
  }

  @Post('strava/profile-access')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('integrations.sync')
  @ApiOperation({
    summary: 'Authorization URL that adds profile access (weight, sex, shoes) to the Strava connection',
    description: 'Errors: STRAVA_NOT_CONNECTED',
  })
  @ApiResponse({ status: 200, type: StravaProfileAccessResponseDto })
  requestStravaProfileAccess(@CurrentUser() user: AuthUserContext): Promise<StravaProfileAccessResponseDto> {
    return this.stravaConnection.requestStravaProfileAccess(user.id);
  }

  @Post('strava/profile-sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('integrations.sync')
  @ApiOperation({
    summary: 'Sync weight, sex and shoes from Strava now',
    description: 'Errors: STRAVA_NOT_CONNECTED, STRAVA_PROFILE_ACCESS_REQUIRED',
  })
  @ApiResponse({ status: 202, type: QueuedResponseDto })
  triggerStravaProfileSync(@CurrentUser() user: AuthUserContext): Promise<{ status: 'queued' }> {
    return this.stravaProfileSync.triggerStravaProfileSync(user.id);
  }

  @Post('strava/gear-import')
  @RequirePermissions('integrations.sync')
  @ApiOperation({
    summary: 'Import shoes from Strava now and report what changed',
    description: 'Errors: STRAVA_NOT_CONNECTED, STRAVA_PROFILE_ACCESS_REQUIRED',
  })
  @ApiResponse({ status: 201, type: GearImportResultDto })
  importStravaShoes(@CurrentUser() user: AuthUserContext): Promise<GearImportResultDto> {
    return this.stravaProfileSync.importStravaShoes(user.id);
  }

  @Delete('strava')
  @RequirePermissions('integrations.delete')
  @ApiOperation({ summary: 'Disconnect Strava integration' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async disconnectStrava(@CurrentUser() user: AuthUserContext): Promise<{ success: boolean }> {
    return this.stravaConnection.disconnectStrava(user.id);
  }

  @Get('strava/sync')
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'Get Strava sync status' })
  @ApiResponse({ status: 200, type: IntegrationSyncStatusResponseDto })
  async getStravaSyncStatus(@CurrentUser() user: AuthUserContext): Promise<IntegrationSyncStatusResponseDto> {
    return this.stravaActivitySync.getStravaSyncStatus(user.id);
  }

  @Post('strava/sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('integrations.sync')
  @ApiOperation({ summary: 'Trigger manual Strava sync' })
  @ApiResponse({ status: 200, type: IntegrationSyncStatusResponseDto })
  async triggerStravaSync(@CurrentUser() user: AuthUserContext): Promise<IntegrationSyncStatusResponseDto> {
    return this.stravaActivitySync.triggerStravaSync(user.id);
  }

  /** Kept while clients move to `POST strava/sync`. */
  @Get('strava/sync/trigger')
  @Header('Deprecation', 'true')
  @Header('Link', '</v1/integrations/strava/sync>; rel="successor-version"; method="POST"')
  @RequirePermissions('integrations.sync')
  @ApiOperation({ summary: 'Trigger manual Strava sync', deprecated: true })
  @ApiResponse({ status: 200, type: IntegrationSyncStatusResponseDto })
  async triggerStravaSyncLegacy(@CurrentUser() user: AuthUserContext): Promise<IntegrationSyncStatusResponseDto> {
    return this.stravaActivitySync.triggerStravaSync(user.id);
  }

  @Public()
  @Get('strava/webhook')
  @ApiOperation({ summary: 'Strava Webhook Subscription Verification Callback' })
  verifyWebhook(@Query() query: StravaWebhookVerificationQueryDto, @Res() res: Response): void {
    const expectedVerifyToken = this.configService.getOrThrow<string>('integrations.strava.webhookVerifyToken');

    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && typeof token === 'string' && secureCompare(token, expectedVerifyToken)) {
      res.status(HttpStatus.OK).json({ 'hub.challenge': challenge });
    } else {
      res.status(HttpStatus.FORBIDDEN).send('Verification failed');
    }
  }

  @Public()
  @Post('strava/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Strava Webhook Event' })
  async handleWebhookEvent(@Body() payload: StravaWebhookEventDto): Promise<{ status: string }> {
    return this.stravaActivitySync.handleWebhookIngestion(payload);
  }
}
