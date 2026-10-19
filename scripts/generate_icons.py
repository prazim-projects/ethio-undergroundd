"""Generate the app's record-mark PNG icons for installable PWA manifests."""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parents[1] / "apps/web/public/icons"
destination.mkdir(parents=True, exist_ok=True)
for size in (192, 512):
    image = Image.new("RGB", (size, size), "#171d19")
    draw = ImageDraw.Draw(image)
    def box(a, b):
        return (int(size*a), int(size*a), int(size*b), int(size*b))
    draw.ellipse(box(.2, .8), fill="#f7faf7")
    draw.ellipse(box(.32, .68), fill="#156b43")
    draw.ellipse(box(.41, .59), fill="#efc64c")
    draw.ellipse(box(.47, .53), fill="#171d19")
    for i, color in enumerate(("#398159", "#efc64c", "#b64342")):
        left = int(size * (.3 + i * .14))
        draw.rectangle((left, int(size*.83), left+int(size*.12), int(size*.85)), fill=color)
    image.save(destination / f"icon-{size}.png", optimize=True)
