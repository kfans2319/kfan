"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude } from "@/lib/types";
import { createPostSchema } from "@/lib/validation";

export async function submitPost(input: {
  content: string;
  mediaIds: string[];
  isPublic: boolean;
}) {
  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  // Check if the user is verified
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isVerified: true },
  });

  if (!userData?.isVerified) {
    throw new Error("You must be verified to post content. Please complete the verification process.");
  }

  const { content, mediaIds, isPublic } = createPostSchema.parse(input);

  const newPost = await prisma.post.create({
    data: {
      content,
      userId: user.id,
      isPublic,
      attachments: {
        connect: mediaIds.map((id) => ({ id })),
      },
    },
    include: getPostDataInclude(user.id),
  });

  return newPost;
}
