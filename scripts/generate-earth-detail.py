#!/usr/bin/env python3
"""Build the bundled Earth base and the offline equirectangular detail tiles.

Day source (public domain, NASA Earth Observatory / Reto Stöckli):
https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x21600x10800.jpg

Night source (public domain, NASA/GSFC, Black Marble 2016):
https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg

Each detail tile stores the high-resolution day color in RGB and the matching
night-lights luminance in alpha. This avoids a second GPU texture per tile.

Usage:
    python scripts/generate-earth-detail.py path/to/day.jpg path/to/night.jpg

Requires Pillow. This is an asset-generation helper; it is not a runtime dependency.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parents[1]
BASE_OUTPUT = ROOT / "src" / "assets" / "textures" / "earth.webp"
NIGHT_BASE_OUTPUT = ROOT / "src" / "assets" / "textures" / "night-lights.webp"
DETAIL_ROOT = ROOT / "public" / "earth-detail" / "v1"
LEVELS = (3, 4, 5)
CONTENT_SIZE = 512
PADDING = 8
TILE_SIZE = CONTENT_SIZE + PADDING * 2
TILE_QUALITY = 86
TILE_ALPHA_QUALITY = 40
BASE_QUALITY = 88
NIGHT_BASE_QUALITY = 90


def tile_with_bleed(image: Image.Image, x0: int, y0: int) -> Image.Image:
    """Crop one content tile plus a copied border to prevent texture seams."""
    tile = Image.new(image.mode, (TILE_SIZE, TILE_SIZE))
    left = x0 - PADDING
    top = y0 - PADDING
    right = x0 + CONTENT_SIZE + PADDING
    bottom = y0 + CONTENT_SIZE + PADDING

    source_box = (
        max(0, left),
        max(0, top),
        min(image.width, right),
        min(image.height, bottom),
    )
    source = image.crop(source_box)
    dx = source_box[0] - left
    dy = source_box[1] - top
    tile.paste(source, (dx, dy))

    edge = Image.Resampling.NEAREST
    source_right = dx + source.width
    source_bottom = dy + source.height

    if dx > 0:
        strip = tile.crop((dx, dy, dx + 1, source_bottom)).resize(
            (dx, source.height), edge
        )
        tile.paste(strip, (0, dy))
    if dy > 0:
        strip = tile.crop((dx, dy, source_right, dy + 1)).resize(
            (source.width, dy), edge
        )
        tile.paste(strip, (dx, 0))
    if source_right < TILE_SIZE:
        strip = tile.crop(
            (source_right - 1, dy, source_right, source_bottom)
        ).resize((TILE_SIZE - source_right, source.height), edge)
        tile.paste(strip, (source_right, dy))
    if source_bottom < TILE_SIZE:
        strip = tile.crop(
            (dx, source_bottom - 1, source_right, source_bottom)
        ).resize((source.width, TILE_SIZE - source_bottom), edge)
        tile.paste(strip, (dx, source_bottom))

    if dy > 0:
        if dx > 0:
            tile.paste(
                tile.crop((dx, dy, dx + 1, dy + 1)).resize((dx, dy), edge),
                (0, 0),
            )
        if source_right < TILE_SIZE:
            tile.paste(
                tile.crop(
                    (source_right - 1, dy, source_right, dy + 1)
                ).resize((TILE_SIZE - source_right, dy), edge),
                (source_right, 0),
            )
    if source_bottom < TILE_SIZE:
        if dx > 0:
            tile.paste(
                tile.crop(
                    (dx, source_bottom - 1, dx + 1, source_bottom)
                ).resize((dx, TILE_SIZE - source_bottom), edge),
                (0, source_bottom),
            )
        if source_right < TILE_SIZE:
            tile.paste(
                tile.crop(
                    (
                        source_right - 1,
                        source_bottom - 1,
                        source_right,
                        source_bottom,
                    )
                ).resize(
                    (TILE_SIZE - source_right, TILE_SIZE - source_bottom),
                    edge,
                ),
                (source_right, source_bottom),
            )
    return tile


def generate(day_path: Path, night_path: Path) -> None:
    day_source = Image.open(day_path)
    if day_source.size != (21600, 10800):
        raise SystemExit(
            f"Expected the 21600x10800 day source, received {day_source.width}x{day_source.height}."
        )
    if day_source.mode != "RGB":
        day_source = day_source.convert("RGB")
    night_source = Image.open(night_path).convert("L")
    if night_source.size != (13500, 6750):
        raise SystemExit(
            f"Expected the 13500x6750 night source, received {night_source.width}x{night_source.height}."
        )

    BASE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    day_source.resize((2048, 1024), Image.Resampling.LANCZOS).save(
        BASE_OUTPUT, "WEBP", quality=BASE_QUALITY, method=6
    )
    night_source.resize((1024, 512), Image.Resampling.LANCZOS).save(
        NIGHT_BASE_OUTPUT, "WEBP", quality=NIGHT_BASE_QUALITY, method=6
    )
    print(f"base: {BASE_OUTPUT} ({BASE_OUTPUT.stat().st_size} bytes)")
    print(f"night base: {NIGHT_BASE_OUTPUT} ({NIGHT_BASE_OUTPUT.stat().st_size} bytes)")

    if DETAIL_ROOT.exists():
        shutil.rmtree(DETAIL_ROOT)
    total_bytes = 0
    for level in LEVELS:
        width = CONTENT_SIZE * 2**level
        height = width // 2
        day_resized = day_source.resize((width, height), Image.Resampling.LANCZOS)
        night_resized = night_source.resize((width, height), Image.Resampling.LANCZOS)
        for x in range(2**level):
            column = DETAIL_ROOT / str(level) / str(x)
            column.mkdir(parents=True, exist_ok=True)
            for y in range(2 ** (level - 1)):
                day_tile = tile_with_bleed(
                    day_resized, x * CONTENT_SIZE, y * CONTENT_SIZE
                )
                night_tile = tile_with_bleed(
                    night_resized, x * CONTENT_SIZE, y * CONTENT_SIZE
                )
                tile = day_tile.convert("RGBA")
                tile.putalpha(night_tile)
                output = column / f"{y}.webp"
                tile.save(
                    output,
                    "WEBP",
                    quality=TILE_QUALITY,
                    alpha_quality=TILE_ALPHA_QUALITY,
                    method=5,
                )
                total_bytes += output.stat().st_size
                day_tile.close()
                night_tile.close()
                tile.close()
        del day_resized, night_resized
        print(f"level {level}: {width}x{height}, {2**level}x{2**(level-1)} tiles")
    print(f"detail total: {total_bytes / 1048576:.2f} MiB, {sum(2**level * 2**(level-1) for level in LEVELS)} files")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("day_source", type=Path, help="Path to the 21600x10800 day JPEG")
    parser.add_argument("night_source", type=Path, help="Path to the 13500x6750 night JPEG")
    args = parser.parse_args()
    generate(args.day_source, args.night_source)


if __name__ == "__main__":
    main()
