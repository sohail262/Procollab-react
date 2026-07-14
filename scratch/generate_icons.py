import os
import sys

# Ensure PIL is installed
try:
    from PIL import Image, ImageOps
except ImportError:
    print("Pillow not found. Installing Pillow...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageOps
    except Exception as e:
        print(f"Failed to install Pillow: {e}")
        sys.exit(1)

logo_path = r"c:\Users\itssp\Desktop\Procollab-git\Procollab-react\public\images\logo_pc.png"
public_dir = r"c:\Users\itssp\Desktop\Procollab-git\Procollab-react\public"

if not os.path.exists(logo_path):
    print(f"Error: Logo file not found at {logo_path}")
    sys.exit(1)

print(f"Loading logo from {logo_path}...")
try:
    img = Image.open(logo_path)

    # Make sure it's RGBA
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # 1. Standard Icons: Crop to square (if not already square)
    width, height = img.size
    min_dim = min(width, height)
    left = (width - min_dim) / 2
    top = (height - min_dim) / 2
    right = (width + min_dim) / 2
    bottom = (height + min_dim) / 2
    square_img = img.crop((left, top, right, bottom))

    # Save 192x192
    pwa_192 = square_img.resize((192, 192), Image.Resampling.LANCZOS)
    pwa_192_path = os.path.join(public_dir, "pwa-192x192.png")
    pwa_192.save(pwa_192_path, "PNG")
    print(f"Saved {pwa_192_path}")

    # Save 512x512
    pwa_512 = square_img.resize((512, 512), Image.Resampling.LANCZOS)
    pwa_512_path = os.path.join(public_dir, "pwa-512x512.png")
    pwa_512.save(pwa_512_path, "PNG")
    print(f"Saved {pwa_512_path}")

    # 2. Maskable Icon: 512x512 with safe area padding
    # Background color: #09090b (RGB: 9, 9, 11) matching the dark theme of ProCollab
    maskable_bg = Image.new("RGBA", (512, 512), (9, 9, 11, 255))

    # Resize the square logo to fit inside the safe zone (60% of 512 = ~307px)
    safe_size = 307
    logo_resized = square_img.resize((safe_size, safe_size), Image.Resampling.LANCZOS)

    # Paste centered
    offset = (512 - safe_size) // 2
    maskable_bg.paste(logo_resized, (offset, offset), logo_resized)

    maskable_path = os.path.join(public_dir, "maskable-icon.png")
    maskable_bg.save(maskable_path, "PNG")
    print(f"Saved {maskable_path}")

    print("PWA Icons generated successfully!")

except Exception as e:
    print(f"An error occurred during icon generation: {e}")
    sys.exit(1)
