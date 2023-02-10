import { Box, ButtonGroup } from "@chakra-ui/react";
import { Tag } from "@prisma/client";
import {
  ColumnDef,
  createColumnHelper,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { tagFilter } from "../../../server/api/routers/gameobjects/getAll";
import { api, RouterInputs, RouterOutputs } from "../../../utils/api";
import CustomEditable from "../../shared/components/CustomEditable";
import PaginatedTable from "../../shared/components/CustomEditable/Table/PaginatedTable";
import SearchAndCreateBar from "../../shared/components/CustomEditable/Table/SearchAndCreateBar";
import TagMultiSelect, { TagOption } from "./TagMultiSelect";

export type GameObjectData =
  RouterOutputs["gameObjects"]["getAll"]["gameObjects"][0];

const columnHelper = createColumnHelper<GameObjectData>();

export type GameObjectsTableProps = {
  tag?: typeof tagFilter._type;
  onGameObjectCreated?: (gameObjectId: string) => Promise<void>;
  additionalActions?: (gameObjectData: GameObjectData) => React.ReactNode;
};

export default function GameObjectsTable(props: GameObjectsTableProps) {
  const { tag, onGameObjectCreated, additionalActions } = props;

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const { pageIndex, pageSize } = pagination;
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const getSort = (id: keyof GameObjectData) => {
    const result = sorting.find((s) => s.id === id);
    if (result === undefined) {
      return undefined;
    }

    return result.desc ? "desc" : "asc";
  };

  const gameObjectsQuery = api.gameObjects.getAll.useQuery(
    {
      includeTags: true,
      skip: pageIndex * pageSize,
      take: pageSize,
      filter: globalFilter
        ? {
            mode: "OR",
            id: { contains: globalFilter },
            name: { contains: globalFilter },
            tag,
          }
        : {
            tag,
          },
      sort: {
        id: getSort("id"),
        name: getSort("name"),
        description: getSort("description"),
        tags: getSort("tags"),
        updatedAt: getSort("updatedAt"),
      },
    },
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const utils = api.useContext();

  const gameObjectsCountQuery = api.gameObjects.getCount.useQuery(
    {
      filter: globalFilter
        ? {
            mode: "OR",
            id: { contains: globalFilter },
            name: { contains: globalFilter },
            tag,
          }
        : {
            tag,
          },
    },
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const updateGameObjectMutation = api.gameObjects.updateById.useMutation();

  const handleUpdateGameObject = async (
    id: string,
    data: RouterInputs["gameObjects"]["updateById"]["data"]
  ) => {
    try {
      await updateGameObjectMutation.mutateAsync({ id, data });
      await utils.gameObjects.invalidate();
    } catch (error) {
      console.error(error);
      window.alert("Error updating tag\n See console for details");
    }
  };

  const createGameObjectMutation = api.gameObjects.create.useMutation();
  const handleCreateGameObject = async (name: string) => {
    try {
      const result = await createGameObjectMutation.mutateAsync({ name });
      if (onGameObjectCreated) {
        await onGameObjectCreated(result.createdGameObject.id);
      }
      await utils.gameObjects.invalidate();
    } catch (error) {
      window.alert("Error creating game object\n See console for details");
      console.error(error);
    }
  };

  const columns = useMemo<ColumnDef<GameObjectData, any>[]>(() => {
    const items: ColumnDef<GameObjectData, any>[] = [
      columnHelper.accessor("id", {
        cell: (info) => (
          <CustomEditable
            value={info.getValue()}
            placeholder="No ID"
            handleSave={async (nextValue) =>
              handleUpdateGameObject(info.row.original.id, {
                id: nextValue,
              })
            }
          />
        ),
        enableSorting: true,
      }),
      columnHelper.accessor("name", {
        cell: (info) => (
          <CustomEditable
            value={info.getValue()}
            placeholder="No name"
            handleSave={async (nextValue) =>
              handleUpdateGameObject(info.row.original.id, {
                name: nextValue,
              })
            }
          />
        ),
        enableSorting: true,
      }),
      columnHelper.accessor("description", {
        cell: (info) => (
          <CustomEditable
            value={info.getValue() ?? ""}
            placeholder="No description"
            handleSave={async (nextValue) =>
              handleUpdateGameObject(info.row.original.id, {
                description: nextValue,
              })
            }
          />
        ),
        enableSorting: true,
      }),
      columnHelper.accessor("tags", {
        cell: (info) => {
          const tags = (info.getValue() as Tag[]) || undefined;
          const selected: TagOption[] =
            tags?.map((tag: Tag) => ({
              label: tag.name || "Untitled Tag",
              value: tag.id,
            })) || [];

          return (
            <Box width="256px">
              <TagMultiSelect
                selected={selected}
                onChange={(nextTags) => {
                  handleUpdateGameObject(info.row.original.id, {
                    tags: nextTags,
                  });
                }}
              />
            </Box>
          );
        },
        enableSorting: true,
      }),
      columnHelper.accessor("updatedAt", {
        header: "Last Updated",
        cell: (info) => info.getValue().toLocaleString(),
        enableSorting: true,
      }),
    ];

    if (additionalActions) {
      items.push({
        id: "actions",
        header: "",
        cell: (info) => {
          return (
            <ButtonGroup width="100%" justifyContent="end">
              {additionalActions(info.row.original)}
            </ButtonGroup>
          );
        },
      });
    }

    return items;
  }, []);

  const pageCount = useMemo(() => {
    if (!gameObjectsCountQuery.data) return 0;
    return Math.ceil(gameObjectsCountQuery.data.count / pageSize);
  }, [gameObjectsCountQuery.data, pagination.pageSize]);

  useEffect(() => {
    // If the page index is out of bounds, reset it to the last page
    if (pageIndex >= pageCount) {
      setPagination((prev) => ({ ...prev, pageIndex: pageCount - 1 }));
      return;
    }

    // Otherwise, if the page index is less than 0, reset it to 0
    // Only do this if the page count is greater than 0; or else, we'll get stuck in an infinite loop from the queries
    if (pageCount === 0) return;
    if (pageIndex < 0) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      return;
    }
  }, [pageCount, pageIndex]);

  return (
    <Box height="100%">
      <SearchAndCreateBar
        value={globalFilter}
        onChange={setGlobalFilter}
        onCreate={handleCreateGameObject}
      />
      <PaginatedTable
        columns={columns}
        data={gameObjectsQuery.data?.gameObjects ?? []}
        onPaginationChange={setPagination}
        pagination={pagination}
        pageCount={pageCount}
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </Box>
  );
}
