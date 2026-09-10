import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import * as handlebars from 'handlebars';
import * as path from 'path';

import { MailerTemplateNotFoundException } from '../exceptions/mailer-template-not-found.exception';
import { MailerTemplateRenderException } from '../exceptions/mailer-template-render.exception';
import { MAILER_TEMPLATE_DEFAULT_EXTENSION, MAILER_TEMPLATE_TEXT_SUFFIX } from '../mailer.constants';

interface RenderedTemplate {
  readonly html: string;
  readonly text: string;
}

@Injectable()
export class MailerTemplateService {
  private readonly logger = new Logger(MailerTemplateService.name);
  private readonly templateCache = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  async render(templateName: string, data: Record<string, unknown>): Promise<RenderedTemplate> {
    const htmlTemplate = await this.loadTemplate(templateName, 'html');
    const html = this.compile(htmlTemplate, templateName, data);
    const textTemplatePath = this.resolveTemplatePath(templateName, 'text');
    const text = textTemplatePath
      ? this.compile(await this.readTemplate(textTemplatePath), templateName, data)
      : this.stripHtml(html);

    return { html, text };
  }

  private compile(templateSource: string, templateName: string, data: Record<string, unknown>): string {
    try {
      const template = handlebars.compile(templateSource, { noEscape: false });
      return template(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MailerTemplateRenderException(templateName, message);
    }
  }

  private async loadTemplate(templateName: string, variant: 'html' | 'text'): Promise<string> {
    const templatePath = this.resolveTemplatePath(templateName, variant);

    if (!templatePath) {
      throw new MailerTemplateNotFoundException(templateName);
    }

    return this.readTemplate(templatePath);
  }

  private resolveTemplatePath(templateName: string, variant: 'html' | 'text'): string | null {
    const templateRoot = this.configService.get<string>('mailer.templateRoot');
    const sanitizedTemplate = templateName.replace(/^\.+[\\/]/, '').replace(/^\//, '');
    const relativeTemplate = sanitizedTemplate.split('/').join(path.sep);
    const candidates =
      variant === 'html'
        ? [`${relativeTemplate}${MAILER_TEMPLATE_DEFAULT_EXTENSION}`]
        : [
            `${relativeTemplate}${MAILER_TEMPLATE_TEXT_SUFFIX}${MAILER_TEMPLATE_DEFAULT_EXTENSION}`,
            `${relativeTemplate}.txt${MAILER_TEMPLATE_DEFAULT_EXTENSION}`,
          ];
    const templateRoots = [
      templateRoot ? path.resolve(templateRoot) : null,
      path.join(process.cwd(), 'dist/modules/mailer/templates'),
    ].filter((root): root is string => Boolean(root));

    for (const root of templateRoots) {
      for (const candidate of candidates) {
        const normalizedCandidate = path.resolve(root, candidate);
        const isWithinRoot = path.relative(root, normalizedCandidate);
        if (isWithinRoot.startsWith('..')) {
          continue;
        }

        if (existsSync(normalizedCandidate)) {
          return normalizedCandidate;
        }
      }
    }

    if (variant === 'html') {
      this.logger.debug(`Mail template is missing: ${templateName}`);
    }

    return null;
  }

  private async readTemplate(templatePath: string): Promise<string> {
    const cached = this.templateCache.get(templatePath);
    if (cached) {
      return cached;
    }

    try {
      const templateSource = await readFile(templatePath, 'utf8');
      this.templateCache.set(templatePath, templateSource);
      return templateSource;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MailerTemplateRenderException(path.basename(templatePath), message);
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|header|footer)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }
}
