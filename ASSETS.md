# Asset provenance

`assets-manifest.json` is the complete per-file inventory for everything copied
from `client/public/` into a release. CI fails when a public file is missing from
that inventory or an inventory entry points to a missing file.

## Third-party sources

| Source | Files | License |
|---|---|---|
| [KayKit Character Pack: Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) | `player1.glb`, `player2.glb` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [Quaternius Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) | `monster.glb`, `monster_BlueDemon.gltf`, `monster_Demon.gltf`, `monster_Orc.gltf` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [Quaternius Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) | the four `figure_*.glb` files | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [KayKit Furniture Bits](https://kaylousberg.itch.io/furniture-bits) | Furniture `.gltf` files, their `.bin` buffers, and `furniturebits_texture.png` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [KayKit Dungeon Remastered](https://kaylousberg.itch.io/kaykit-dungeon-remastered) | Doors, barrels, boxes, and crates | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [ambientCG](https://ambientcg.com/) | Carpet009, OfficeCeiling005, Wallpaper001A, Concrete, Tiles107, and Tiles132A derivatives | [CC0 1.0](https://docs.ambientcg.com/license/) |
| [Freesound](https://freesound.org/) | sounds 777053, 444445, 262884, 574208, and 861351 | CC0 1.0 (as marked on each source download) |

The repository preserves transformed/exported versions rather than upstream
archives. File names and exact source IDs are recorded in `assets-manifest.json`.

## Project-created and generated assets

`favicon.svg` was created for Liminal. `liminal-key-art.webp`,
`mall-terrazzo.webp`, and `mall-shutter.webp` were generated for this project
with OpenAI image generation and then selected/edited by the contributors. The
contributors release those four files under the repository MIT License.

## Adding or replacing an asset

1. Confirm that redistribution and commercial use are allowed.
2. Add one explicit entry to `assets-manifest.json` for every emitted file,
   including sidecar buffers.
3. Preserve the author/source URL, asset or sound ID, and license URL.
4. Run `pnpm check:assets` before opening a pull request.

Do not commit an asset when its origin or permission is uncertain.
