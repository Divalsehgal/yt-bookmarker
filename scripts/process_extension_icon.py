from collections import deque
from pathlib import Path
import sys

from PIL import Image


SIZES = (16, 32, 48, 128)


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 0 and red >= 242 and green >= 242 and blue >= 242


def remove_connected_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or x >= width or y < 0 or y >= height or (x, y) in visited:
            continue

        visited.add((x, y))
        pixel = pixels[x, y]
        if not is_background(pixel):
            continue

        pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    return rgba


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: process_extension_icon.py SOURCE OUTPUT_DIR")

    source = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    image = remove_connected_background(Image.open(source))
    alpha_box = image.getchannel("A").getbbox()
    if not alpha_box:
        raise SystemExit("icon processing removed the entire image")

    cropped = image.crop(alpha_box)
    for size in SIZES:
        resized = cropped.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(output_dir / f"icon-{size}.png")


if __name__ == "__main__":
    main()
