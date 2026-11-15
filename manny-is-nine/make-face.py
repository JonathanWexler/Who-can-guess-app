# Makes face.png: a round cut-out of Manny's face used all over the game.
# Usage: python3 make-face.py SOURCE_IMAGE CENTER_X CENTER_Y RADIUS
import sys
from PIL import Image, ImageDraw, ImageFilter
src, cx, cy, r = sys.argv[1], *map(int, sys.argv[2:5])
im = Image.open(src).convert('RGB').crop((cx - r, cy - r, cx + r, cy + r)).resize((256, 256), Image.LANCZOS)
mask = Image.new('L', (256 * 4, 256 * 4), 0)
ImageDraw.Draw(mask).ellipse((8, 8, 256 * 4 - 8, 256 * 4 - 8), fill=255)
mask = mask.resize((256, 256), Image.LANCZOS)
out = Image.new('RGBA', (256, 256))
out.paste(im, (0, 0), mask)
out.save('face.png', optimize=True)
print('face.png written')
