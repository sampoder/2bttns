import { GameObject, PlayerScore } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { OPENAPI_TAGS } from "../../openapi/openApiTags";
import { anyAuthProtectedProcedure } from "../../trpc";

const output = z.object({
  playerScores: z.array(
    z.object({
      createdAt: z.string(),
      updatedAt: z.string(),
      score: z.number(),
      playerId: z.string(),
      gameObjectId: z.string(),
      gameObject: z
        .object({
          id: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          name: z.string(),
          description: z.string().nullable(),
        })
        .optional(),
    })
  ),
});

export const getPlayerScores = anyAuthProtectedProcedure
  .meta({
    openapi: {
      summary: "Get Player Scores",
      description: "Get a player's score data for a specific game",
      tags: [OPENAPI_TAGS.GAMES],
      method: "GET",
      path: "/games/getPlayerScores",
      protect: true,
    },
  })
  .input(
    z.object({
      game_id: z.string().describe("The game id to get scores for"),
      player_id: z.string().describe("The player id to get scores for"),
      include_game_objects: z
        // For some reason, z.boolean() doesn't work here when setting this via the swagger docs UI; everything registered as true
        // Hence, we use z.string() and then preprocess it to a boolean
        .preprocess((value) => {
          return value === "true";
        }, z.boolean())
        .default(false)
        .describe("Whether to include game objects in the response"),
    })
  )
  .output(output)
  .query(async ({ ctx, input }) => {
    if (ctx.authData.type === "player_token") {
      if (ctx.authData.userId !== input.player_id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Player ${ctx.authData.userId} is only authorized to get their own scores`,
        });
      }
    }

    const gameTags = await ctx.prisma.tag.findMany({
      where: {
        inputToGames: {
          some: {
            id: input.game_id,
          },
        },
      },
    });

    const gameObjects = await ctx.prisma.gameObject.findMany({
      where: {
        tags: {
          some: {
            id: {
              in: gameTags.map((tag) => tag.id),
            },
          },
        },
      },
    });

    let playerScores: (PlayerScore & {
      gameObject?: GameObject;
    })[] = await ctx.prisma.playerScore.findMany({
      where: {
        gameObjectId: {
          in: gameObjects.map((gameObject) => gameObject.id),
        },
        playerId: input.player_id,
      },
      include: {
        gameObject: input.include_game_objects,
      },
      orderBy: {
        score: "desc",
      },
    });

    const outputData: typeof output._type["playerScores"] = playerScores.map(
      (playerScore) => {
        return {
          ...playerScore,
          score: playerScore.score.toNumber(),
          createdAt: playerScore.createdAt.toISOString(),
          updatedAt: playerScore.updatedAt.toISOString(),
          gameObject: playerScore.gameObject
            ? {
                ...playerScore.gameObject,
                createdAt: playerScore.gameObject.createdAt.toISOString(),
                updatedAt: playerScore.gameObject.updatedAt.toISOString(),
              }
            : undefined,
        };
      }
    );

    return {
      playerScores: outputData,
    };
  });
