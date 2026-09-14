import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';

type User = typeof users.$inferSelect;
export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'createdAt'>;

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string): Promise<PublicUser> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }
}
