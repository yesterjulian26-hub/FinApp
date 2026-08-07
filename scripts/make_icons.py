from PIL import Image, ImageDraw
import os

def make_icon(size, path):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    grad = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grad)
    top = (108, 92, 231)     # #6C5CE7
    bottom = (162, 155, 254)  # #a29bfe
    for y in range(size):
        t = y / size
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        gdraw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    radius = int(size * 0.22)
    mask = Image.new('L', (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    img = Image.composite(grad, img, mask)
    draw = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2
    d = size * 0.30
    diamond = [(cx, cy - d), (cx + d, cy), (cx, cy + d), (cx - d, cy)]
    draw.polygon(diamond, fill=(255, 255, 255, 235))

    lw = max(1, int(size * 0.012))
    draw.line([(cx, cy - d), (cx, cy + d)], fill=(108, 92, 231, 180), width=lw)
    draw.line([(cx - d, cy), (cx + d, cy)], fill=(108, 92, 231, 180), width=lw)

    img.save(path, 'PNG')

out_dir = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(out_dir, exist_ok=True)
for s in (180, 192, 512):
    make_icon(s, os.path.join(out_dir, f'icon-{s}.png'))
print('done')
