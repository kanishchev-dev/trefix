import { once } from 'events';
import * as net from 'net';
import * as tls from 'tls';

import { InvariantViolationException } from '@/common/exceptions/invariant-violation.exception';

import { SmtpResponse } from '../interfaces/smtp-response.interface';

interface PendingResponse {
  readonly resolve: (response: SmtpResponse) => void;
  readonly reject: (error: Error) => void;
  code: number | null;
  lines: string[];
}

export class SmtpSession {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = '';
  private pending: PendingResponse | null = null;
  private currentResponse: { code: number | null; lines: string[] } | null = null;
  private queuedResponses: SmtpResponse[] = [];

  constructor(
    socket: net.Socket | tls.TLSSocket,
    private readonly host: string,
    private readonly rejectUnauthorized: boolean,
  ) {
    this.socket = socket;
    this.bindSocket(socket);
  }

  async readResponse(): Promise<SmtpResponse> {
    if (this.queuedResponses.length > 0) {
      return this.queuedResponses.shift() as SmtpResponse;
    }

    if (this.pending) {
      throw new InvariantViolationException('SMTP response is already pending');
    }

    return new Promise<SmtpResponse>((resolve, reject) => {
      this.pending = { resolve, reject, code: null, lines: [] };
    });
  }

  async expectGreeting(): Promise<SmtpResponse> {
    return this.readResponse();
  }

  async sendCommand(command: string): Promise<SmtpResponse> {
    const responsePromise = this.readResponse();
    this.socket.write(`${command}\r\n`);
    return responsePromise;
  }

  async sendData(data: string): Promise<SmtpResponse> {
    const responsePromise = this.readResponse();
    this.socket.write(`${data}\r\n.\r\n`);
    return responsePromise;
  }

  async upgradeToTls(): Promise<void> {
    const upgradedSocket = tls.connect({
      socket: this.socket as net.Socket,
      servername: this.host,
      rejectUnauthorized: this.rejectUnauthorized,
    });

    await once(upgradedSocket, 'secureConnect');
    this.bindSocket(upgradedSocket);
    this.socket = upgradedSocket;
  }

  async quit(): Promise<void> {
    try {
      await this.sendCommand('QUIT');
    } finally {
      this.socket.end();
    }
  }

  destroy(): void {
    this.socket.destroy();
  }

  private bindSocket(socket: net.Socket | tls.TLSSocket): void {
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => this.handleData(chunk));
    socket.on('error', (error) => this.handleError(error));
    socket.on('close', () => this.handleClose());
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;

    while (this.buffer.includes('\n')) {
      const newlineIndex = this.buffer.indexOf('\n');
      const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newlineIndex + 1);
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    const match = line.match(/^(\d{3})([- ])(.*)$/);
    if (!match) {
      return;
    }

    const code = Number(match[1]);
    const text = match[3] ?? '';

    if (!this.currentResponse) {
      this.currentResponse = { code: null, lines: [] };
    }

    if (this.currentResponse.code === null) {
      this.currentResponse.code = code;
    }

    this.currentResponse.lines.push(text);

    if (match[2] === ' ') {
      const response = {
        code: this.currentResponse.code ?? code,
        lines: this.currentResponse.lines,
        message: this.currentResponse.lines.join('\n'),
      };

      this.currentResponse = null;

      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending.resolve(response);
        return;
      }

      this.queuedResponses.push(response);
    }
  }

  private handleError(error: Error): void {
    if (this.pending) {
      const pending = this.pending;
      this.pending = null;
      pending.reject(error);
      return;
    }
  }

  private handleClose(): void {
    if (!this.pending) {
      return;
    }

    const pending = this.pending;
    this.pending = null;
    pending.reject(new Error('SMTP connection closed unexpectedly'));
  }
}
