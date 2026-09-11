import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import openaiConfig from './config/openai.config';
import { OpenAiService } from './openai.service';

@Module({
  imports: [ConfigModule.forFeature(openaiConfig)],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class OpenAiModule {}
