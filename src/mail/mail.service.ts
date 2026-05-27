import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
    this.logger.log(
      `[DEV] Password reset for ${email} — token: ${token} — url: ${resetUrl}`,
    );
  }
}
