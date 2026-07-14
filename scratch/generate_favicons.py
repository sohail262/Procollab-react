import os
import sys

# Ensure PIL is installed
try:
    from PIL import Image
except ImportError:
    print("Pillow not found. Installing Pillow...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image
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

    # Crop to square
    width, height = img.size
    min_dim = min(width, height)
    left = (width - min_dim) / 2
    top = (height - min_dim) / 2
    right = (width + min_dim) / 2
    bottom = (height + min_dim) / 2
    square_img = img.crop((left, top, right, bottom))

    # Save favicon-48x48.png (standard Google Search requirement)
    favicon_48 = square_img.resize((48, 48), Image.Resampling.LANCZOS)
    favicon_48_path = os.path.join(public_dir, "favicon-48x48.png")
    favicon_48.save(favicon_48_path, "PNG")
    print(f"Saved {favicon_48_path}")

    # Save favicon.ico (multi-size: 16x16, 32x32, 48x48)
    ico_path = os.path.join(public_dir, "favicon.ico")
    square_img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Saved {ico_path}")

    print("Favicons generated successfully!")

except Exception as e:
    print(f"An error occurred during favicon generation: {e}")
    sys.exit(1)
