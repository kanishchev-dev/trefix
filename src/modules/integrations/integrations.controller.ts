import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import { AuthUserContext } from '../auth/interfaces/auth-user-context.interface';
import {
  IntegrationItemResponseDto,
  IntegrationsListResponseDto,
  StravaProfileAccessResponseDto,
} from './dto/integration-response.dto';
import { StravaConnectResponseDto } from './dto/strava-connect-response.dto';
import { StravaWebhookEventDto, StravaWebhookVerificationQueryDto } from './dto/strava-webhook.dto';
import { IntegrationSyncStatusResponseDto } from './dto/sync-status-response.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
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

  @Get('strava/connect')
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'Initiate Strava OAuth connection flow' })
  @ApiResponse({ status: 200, type: StravaConnectResponseDto })
  async connectStrava(@CurrentUser() user: AuthUserContext): Promise<StravaConnectResponseDto> {
    return this.integrationsService.initiateStravaConnect(user.id);
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
      res
        .status(400)
        .send(`<html><body><h2>Strava authorization denied or failed: ${error || 'Missing code'}</h2></body></html>`);
      return;
    }

    try {
      await this.integrationsService.handleStravaCallback(code, state, scope);
      res.status(200).send(`
        <html>
          <head><title>Strava Connected</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h2>Strava Connected Successfully!</h2>
            <p>Your running history is now syncing in background. You can return to the Trefix app.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.status(400).send(`<html><body><h2>Failed to connect Strava: ${err.message}</h2></body></html>`);
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
    return this.integrationsService.requestStravaProfileAccess(user.id);
  }

  @Post('strava/profile-sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('integrations.sync')
  @ApiOperation({
    summary: 'Sync weight, sex and shoes from Strava now',
    description: 'Errors: STRAVA_NOT_CONNECTED, STRAVA_PROFILE_ACCESS_REQUIRED',
  })
  @ApiResponse({ status: 202, schema: { example: { status: 'queued' } } })
  triggerStravaProfileSync(@CurrentUser() user: AuthUserContext): Promise<{ status: 'queued' }> {
    return this.integrationsService.triggerStravaProfileSync(user.id);
  }

  @Delete('strava')
  @RequirePermissions('integrations.delete')
  @ApiOperation({ summary: 'Disconnect Strava integration' })
  @ApiResponse({ status: 200, schema: { example: { success: true } } })
  async disconnectStrava(@CurrentUser() user: AuthUserContext): Promise<{ success: boolean }> {
    return this.integrationsService.disconnectStrava(user.id);
  }

  @Get('strava/sync')
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'Get Strava sync status' })
  @ApiResponse({ status: 200, type: IntegrationSyncStatusResponseDto })
  async getStravaSyncStatus(@CurrentUser() user: AuthUserContext): Promise<IntegrationSyncStatusResponseDto> {
    return this.integrationsService.getStravaSyncStatus(user.id);
  }

  @Get('strava/sync/trigger')
  @RequirePermissions('integrations.sync')
  @ApiOperation({ summary: 'Trigger manual Strava sync' })
  @ApiResponse({ status: 200, type: IntegrationSyncStatusResponseDto })
  async triggerStravaSync(@CurrentUser() user: AuthUserContext): Promise<IntegrationSyncStatusResponseDto> {
    return this.integrationsService.triggerStravaSync(user.id);
  }

  @Public()
  @Get('strava/webhook')
  @ApiOperation({ summary: 'Strava Webhook Subscription Verification Callback' })
  verifyWebhook(@Query() query: StravaWebhookVerificationQueryDto, @Res() res: Response): void {
    const expectedVerifyToken =
      this.configService.get<string>('integrations.strava.webhookVerifyToken') || 'trefix_strava_webhook_secret';

    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === expectedVerifyToken) {
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
    return this.integrationsService.handleWebhookIngestion(payload);
  }
}
