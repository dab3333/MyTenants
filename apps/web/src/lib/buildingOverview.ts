import type { createScopedClient } from "@mytenants/db";

export type RoomTenant = {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
};

export type RoomOccupancy = {
  id: string;
  name: string;
  capacity: number;
  monthlyRate: string;
  occupied: number;
  tenants: RoomTenant[];
};

export type FloorOverview = {
  id: string;
  label: string;
  rooms: RoomOccupancy[];
};

export type BuildingOverview = {
  id: string;
  name: string;
  address: string | null;
  floors: FloorOverview[];
};

export async function getBuildingOverview(
  scoped: ReturnType<typeof createScopedClient>,
  buildingId: string
): Promise<BuildingOverview | null> {
  const building = await scoped.building.findFirst({
    where: { id: buildingId },
    include: {
      floors: {
        orderBy: { createdAt: "asc" },
        include: { rooms: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!building) return null;

  const roomIds = building.floors.flatMap((floor) => floor.rooms.map((room) => room.id));

  const activeTenancies = roomIds.length
    ? await scoped.tenancy.findMany({
        where: { roomId: { in: roomIds }, status: "ACTIVE" },
        include: { tenant: true },
      })
    : [];
  const tenantsByRoomId = new Map<string, RoomTenant[]>();
  for (const tenancy of activeTenancies) {
    const list = tenantsByRoomId.get(tenancy.roomId) ?? [];
    list.push({
      id: tenancy.tenant.id,
      firstName: tenancy.tenant.firstName,
      lastName: tenancy.tenant.lastName,
      photoUrl: tenancy.tenant.photoUrl,
    });
    tenantsByRoomId.set(tenancy.roomId, list);
  }

  return {
    id: building.id,
    name: building.name,
    address: building.address,
    floors: building.floors.map((floor) => ({
      id: floor.id,
      label: floor.label,
      rooms: floor.rooms.map((room) => {
        const tenants = tenantsByRoomId.get(room.id) ?? [];
        return {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          monthlyRate: room.monthlyRate.toString(),
          occupied: tenants.length,
          tenants,
        };
      }),
    })),
  };
}
