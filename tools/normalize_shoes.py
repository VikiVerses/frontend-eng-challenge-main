from pathlib import Path
from PIL import Image
import shutil

# ---------- PATHS ----------
PROJECT_ROOT = Path(__file__).resolve().parents[1]

ASSETS_SRC = PROJECT_ROOT / "assets"
ASSETS_DST = PROJECT_ROOT / "assets_processed"

SHOES_SRC = ASSETS_SRC / "shoes"
UI_SRC = ASSETS_SRC / "UI"

# ---------- SETTINGS ----------
ALPHA_THRESHOLD = 15 # try 5 / 10 / 20 if needed


def trim_transparency(img: Image.Image) -> Image.Image:
    """Trim transparent padding using alpha threshold."""
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")

    mask = alpha.point(lambda a: 255 if a >= ALPHA_THRESHOLD else 0)
    bbox = mask.getbbox()

    if not bbox:
        return rgba

    return rgba.crop(bbox)


def process_shoes():
    for img_path in sorted(SHOES_SRC.glob("*.png")):
        img = Image.open(img_path)
        trimmed = trim_transparency(img)

        out_path = ASSETS_DST / img_path.name
        trimmed.save(out_path)

        print(f"👟 Trimmed shoe → {out_path.name}")


def copy_ui():
    for img_path in sorted(UI_SRC.glob("*")):
        if img_path.is_file():
            out_path = ASSETS_DST / img_path.name
            shutil.copy2(img_path, out_path)
            print(f"🎨 Copied UI → {out_path.name}")


def main():
    if not SHOES_SRC.exists():
        raise SystemExit(f"Missing shoes folder: {SHOES_SRC}")
    if not UI_SRC.exists():
        raise SystemExit(f"Missing UI folder: {UI_SRC}")

    ASSETS_DST.mkdir(parents=True, exist_ok=True)

    process_shoes()
    copy_ui()

    print("\n✅ assets_new build complete (flat structure)")


if __name__ == "__main__":
    main()
