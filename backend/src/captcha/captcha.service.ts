import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class CaptchaService {
  /** Verifies a Cloudflare Turnstile token on the server. Throws if it fails. */
  async verify(token: string, ip?: string): Promise<void> {
    const secret = process.env.CAPTCHA_SECRET_KEY;
    if (!secret) {
      throw new InternalServerErrorException('CAPTCHA is not configured');
    }

    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.append('remoteip', ip);

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
    );
    const data = (await res.json()) as { success: boolean };

    if (!data.success) {
      throw new BadRequestException('CAPTCHA verification failed');
    }
  }
}
