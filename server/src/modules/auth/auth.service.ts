import { Injectable, UnauthorizedException } from '@nestjs/common';

// TODO: hash/verify passwords (argon2/bcrypt) and issue real JWTs.
@Injectable()
export class AuthService {
  async login(_email: string, _password: string): Promise<{ accessToken: string }> {
    throw new UnauthorizedException('Not implemented yet');
  }

  async me(_token: string) {
    throw new UnauthorizedException('Not implemented yet');
  }
}
