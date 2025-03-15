import { Prisma } from '@prisma/client';

declare global {
  namespace Prisma {
    interface PostInclude {
      user?: true,
      attachments?: true,
      likes?: true,
      bookmarks?: true,
      comments?: true,
      linkedNotifications?: true
    }
  }
}

export {};
