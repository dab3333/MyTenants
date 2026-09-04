import type { createScopedClient } from "@mytenants/db";

export type AvailableRoom = {
  roomId: string;
  roomName: string;
  floorLabel: string;
  buildingId: string;
  buildingName: string;
  capacity: number;
  occupied: number;
  monthlyRate: string;
};

export async function getAvailableRooms(
  scoped: ReturnType<typeof createScopedClient>
): Promise<AvailableRoom[]> {
  const rooms = await scoped.room.findMany({
    include: { floor: { include: { building: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (rooms.length === 0) return [];

  const occupancyCounts = await scoped.tenancy.groupBy({
    by: ["roomId"],
    where: { roomId: { in: rooms.map((room) => room.id) }, status: "ACTIVE" },
    _count: { _all: true },
  });
  const occupiedByRoomId = new Map(occupancyCounts.map((row) => [row.roomId, row._count._all]));

  return rooms
    .map((room) => ({
      roomId: room.id,
      roomName: room.name,
      floorLabel: room.floor.label,
      buildingId: room.floor.building.id,
      buildingName: room.floor.building.name,
      capacity: room.capacity,
      occupied: occupiedByRoomId.get(room.id) ?? 0,
      monthlyRate: room.monthlyRate.toString(),
    }))
    .filter((room) => Math.max(0, room.capacity - room.occupied) > 0);
}
