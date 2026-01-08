from PIL import Image
from pathlib import Path
from typing import Tuple


def create_responsive_ico(
    png_path: Path,
    output_path: Path,
    sizes: Tuple[int, ...] = (16, 24, 32, 48, 64, 128, 256),
):
    """
    Creates a responsive .ico file from a given PNG image with various embedded sizes.

    Args:
        png_path (str): The path to the input PNG image.
        output_path (str): The path where the output .ico file will be saved.
        sizes (tuple): A tuple of integers representing the desired square sizes
                       (e.g., (16, 32, 48) for 16x16, 32x32, and 48x48 pixels).
    """
    try:
        img = Image.open(png_path)

        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # ICO must start from a large base image
        max_size = max(sizes)

        # Resize base image while preserving aspect ratio
        img.thumbnail((max_size, max_size), Image.LANCZOS)

        img.save(
            output_path,
            format="ICO",
            sizes=[(s, s) for s in sizes],
        )

        print(f"ICO created successfully: {output_path}")

    except Exception as e:
        raise RuntimeError(f"Failed to create ICO: {e}")


if __name__ == "__main__":
    create_responsive_ico(
        Path("./public/Bluez@3x.png"),
        Path("./public/favicon.ico"),
        sizes=(16, 32, 48, 64, 128, 256),
    )
