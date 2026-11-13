export type MailAttachmentContent =
  | Buffer
  | string
  | {
      readonly type: 'Buffer';
      readonly data: number[];
    };

export interface MailAttachment {
  readonly filename: string;
  readonly content?: MailAttachmentContent;
  readonly path?: string;
  readonly contentType?: string;
  readonly cid?: string;
  readonly encoding?: BufferEncoding;
}
