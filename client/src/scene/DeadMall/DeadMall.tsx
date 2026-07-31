import type { Maze } from "@liminal/shared";
import { MallAtrium } from "./MallAtrium.js";
import { MallDressing } from "./MallDressing.js";
import { useMallMaterials } from "./MallMaterials.js";
import { MallStorefronts } from "./MallStorefronts.js";

export function DeadMall({ maze }: { maze: Maze }) {
  const { shutter } = useMallMaterials();
  return (
    <group>
      <MallAtrium />
      <MallStorefronts maze={maze} shutterMap={shutter} />
      <MallDressing maze={maze} />
    </group>
  );
}
