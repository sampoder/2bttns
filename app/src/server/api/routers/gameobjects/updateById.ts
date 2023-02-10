import { z } from "zod";
import { publicProcedure } from "../../trpc";

export const updateById = publicProcedure
  .input(
    z.object({
      id: z.string(),
      data: z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const updatedGameObject = await ctx.prisma.gameObject.update({
      where: {
        id: input.id,
      },
      data: {
        id: input.data.id,
        name: input.data.name,
        description: input.data.description,
        tags: {
          connect: input.data.tags?.map((tag) => ({
            id: tag,
          })),
        },
      },
    });

    return {
      updatedGameObject,
    };
  });
