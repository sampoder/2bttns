import { useQuery } from "@tanstack/react-query";
import Head from "next/head";
import {
  TwoBttnsPlayer,
  TwoBttnsRankedOutput,
  TwoBttnsTag,
  twobttns,
} from "../utils/2bttns";

import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useEffect, useState } from "react";
import Select from "react-select";
import { Get2bttnsRankedResponse } from "./api/get2bttnsRanked";

type ServerSideProps = {
  players: TwoBttnsPlayer[];
  tags: TwoBttnsTag[];
};

export const getServerSideProps: GetServerSideProps<
  ServerSideProps
> = async () => {
  const {
    data: { players },
  } = await twobttns.callApi("/players", "get");

  const {
    data: { tags },
  } = await twobttns.callApi("/tags", "get");

  return { props: { players, tags } };
};

export default function Home(
  props: InferGetServerSidePropsType<typeof getServerSideProps>
) {
  const { players, tags } = props;
  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <PlayGameButton />
        <hr />
        <ViewResults players={players} tags={tags} />
      </main>
    </>
  );
}

function PlayGameButton() {
  const redirectToGame = () => {
    if (typeof window === "undefined") {
      return;
    }
    const gameId = window.prompt("Enter game id");
    if (!gameId) return;
    const playerId = window.prompt(
      "Enter player id (random strings are fine for now)"
    );
    if (!playerId) return;
    let numItems: any = window.prompt(
      "Enter #items (ALL for all items; or leave blank to use the configured default)"
    );

    const queryParams = new URLSearchParams();
    queryParams.append("gameId", gameId);
    queryParams.append("playerId", playerId);
    if (numItems) {
      if (numItems.toUpperCase() === "ALL") {
        numItems = "ALL";
      } else if (!isNaN(parseInt(numItems))) {
        numItems = parseInt(numItems);

        if (numItems < 1) {
          window.alert(`Invalid value: numItems=${numItems}`);
          return;
        }
      } else {
        window.alert(`Invalid value: numItems=${numItems}`);
        return;
      }

      if (numItems) {
        queryParams.append("numItems", numItems);
      }
    }
    queryParams.append("callbackUrl", `${window.location.href}/`);

    window.location.href = `/api/play2bttns?${queryParams.toString()}`;
  };
  return <button onClick={redirectToGame}>To Game</button>;
}

type ViewResultsProps = {
  players: TwoBttnsPlayer[];
  tags: TwoBttnsTag[];
};

function ViewResults(props: ViewResultsProps) {
  const { players, tags } = props;
  const [selectedPlayer, setSelectedPlayer] = useState<TwoBttnsPlayer["id"]>();
  const [selectedInputTags, setSelectedInputTags] = useState<
    TwoBttnsTag["id"][]
  >([]);
  const [selectedOutputTag, setSelectedOutputTag] =
    useState<TwoBttnsTag["id"]>();
  const [rankedOutput, setRankedOutput] = useState<TwoBttnsRankedOutput>();

  const hasRequiredInputs =
    !!selectedPlayer && selectedInputTags.length > 0 && !!selectedOutputTag;

  const twobttnsGetRankedQuery = useQuery({
    queryKey: ["getRanked"],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append("inputTags", selectedInputTags.join(","));
      queryParams.append("outputTag", selectedOutputTag!);
      queryParams.append("playerId", selectedPlayer!);
      const url = `/api/get2bttnsRanked/?${queryParams.toString()}`;

      const response = await fetch(url);
      const responseData = (await response.json()) as Get2bttnsRankedResponse;
      if (response.status !== 200) throw responseData;
      return responseData;
    },
    enabled: hasRequiredInputs,
    onSuccess: (data) => {
      setRankedOutput(data as any);
    },
  });

  useEffect(() => {
    if (!hasRequiredInputs) return;
    twobttnsGetRankedQuery.refetch();
  }, [selectedPlayer, JSON.stringify(selectedInputTags), selectedOutputTag]);

  return (
    <div>
      <h1>View Results</h1>
      <div style={{ border: "1px solid black", padding: "1rem" }}>
        <p style={{ fontWeight: "bold" }}>Player</p>
        <Select
          options={players.map((tag) => ({
            value: tag.id,
            label: tag.name ?? tag.id,
          }))}
          onChange={(selected) => {
            setSelectedPlayer(selected?.value as TwoBttnsPlayer["id"]);
          }}
          isSearchable
        />

        <p style={{ fontWeight: "bold" }}>
          Input Tags{" "}
          <span style={{ fontWeight: "normal", fontStyle: "italic" }}>
            (multi-select allowed)
          </span>
        </p>
        <Select
          options={tags.map((tag) => ({
            value: tag.id,
            label: tag.name ?? tag.id,
          }))}
          onChange={(selected) => {
            setSelectedInputTags(
              selected.map((s) => s.value as TwoBttnsTag["id"])
            );
          }}
          isMulti
          isSearchable
        />

        <p style={{ fontWeight: "bold" }}>Output Tag</p>
        <Select
          options={tags.map((tag) => ({
            value: tag.id,
            label: tag.name ?? tag.id,
          }))}
          onChange={(selected) => {
            setSelectedOutputTag(selected?.value as TwoBttnsTag["id"]);
          }}
          isSearchable
        />
        <hr />
        <p style={{ fontWeight: "bold" }}>Ranked Output</p>
        {!rankedOutput && <p>Waiting for inputs...</p>}
        {rankedOutput && <pre>{JSON.stringify(rankedOutput, null, 2)}</pre>}
      </div>
    </div>
  );
}
