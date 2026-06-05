"""Generate og-image.png for Facebook thumbnail (1200x630)."""
import struct, zlib, os

try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

def write_png_chunk(chunk_type, data):
    c = chunk_type + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def save_png(filename, pixels, width, height):
    """Save RGB pixel array as PNG."""
    def filter_row(row):
        return b'\x00' + bytes(row)
    raw = b''.join(filter_row(row) for row in pixels)
    compressed = zlib.compress(raw, 9)
    with open(filename, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
        f.write(write_png_chunk(b'IHDR', ihdr))
        f.write(write_png_chunk(b'IDAT', compressed))
        f.write(write_png_chunk(b'IEND', b''))

if HAS_PILLOW:
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), '#FFF9F0')
    draw = ImageDraw.Draw(img)

    # Red top bar
    draw.rectangle([0, 0, W, 18], fill='#E53935')
    # Red bottom bar
    draw.rectangle([0, H-18, W, H], fill='#E53935')

    # Large 漢 character (decorative, light)
    try:
        font_deco = ImageFont.truetype('C:/Windows/Fonts/msgothic.ttc', 420)
        draw.text((W//2, H//2 - 30), '漢', font=font_deco, fill='#F0E0D0', anchor='mm')
    except Exception:
        pass

    # Title
    try:
        font_title = ImageFont.truetype('C:/Windows/Fonts/msgothic.ttc', 96)
        draw.text((W//2, 160), '漢字書き順', font=font_title, fill='#1C1C1C', anchor='mm')
    except Exception:
        draw.text((W//2, 160), '漢字書き順', fill='#1C1C1C', anchor='mm')

    # Subtitle
    try:
        font_sub = ImageFont.truetype('C:/Windows/Fonts/msgothic.ttc', 44)
        draw.text((W//2, 280), '書き順をなぞって覚えよう！', font=font_sub, fill='#555555', anchor='mm')
    except Exception:
        pass

    # Grade info
    try:
        font_info = ImageFont.truetype('C:/Windows/Fonts/msgothic.ttc', 36)
        draw.text((W//2, 430), '小学1〜6年生　全1,006字', font=font_info, fill='#888888', anchor='mm')
    except Exception:
        pass

    # URL
    try:
        font_url = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 28)
        draw.text((W//2, 560), 'zatune-gif.github.io/kanji-stroke-order', font=font_url, fill='#E53935', anchor='mm')
    except Exception:
        pass

    out = os.path.join(os.path.dirname(__file__), '..', 'og-image.png')
    img.save(out, 'PNG')
    print('Saved:', os.path.abspath(out))
else:
    print('Pillow not found. Install with: pip install pillow')
