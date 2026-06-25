from pathlib import Path
from typing import Tuple

from PIL import Image


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


def rename_images_by_resolution(
    directory: str | Path,
    suffix_format: str = "{width}x{height}",
    extensions: Tuple[str, ...] = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"),
) -> None:
    """
    Renames images in a directory based on their resolution.

    Example:
        image.png -> 1920x1080.png
        image2.png -> 1920x1080_1.png

    Args:
        directory (str): Path to the directory containing images
        suffix_format (str): Format for resolution naming
        extensions (tuple): Image extensions to process
    """
    directory = Path(directory)

    if not directory.is_dir():
        raise ValueError(f"{directory} is not a valid directory")

    for image_path in directory.iterdir():
        if image_path.suffix.lower() not in extensions:
            continue

        try:
            with Image.open(image_path) as img:
                width, height = img.size
        except Exception as e:
            print(f"Skipping {image_path.name}: {e}")
            continue

        base_name = (
            f"{image_path.stem}_{suffix_format.format(width=width, height=height)}"
        )
        new_path = directory / f"{base_name}{image_path.suffix.lower()}"

        counter = 1
        while new_path.exists():
            new_path = directory / f"{base_name}_{counter}{image_path.suffix.lower()}"
            counter += 1

        image_path.rename(new_path)
        print(f"{image_path.name} → {new_path.name}")


if __name__ == "__main__":
    create_responsive_ico(
        Path("./public/Bluz.png"),
        Path("./public/favicon.ico"),
        sizes=(16, 32, 48, 64, 128, 256),
    )
    # rename_images_by_resolution("./public")
