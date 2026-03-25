# Extension Icons

This directory contains the icons for the Grok X Reply Generator extension.

## Icon Sizes Needed

Chrome extensions require icons in the following sizes:
- **16x16** - Favicon and browser toolbar
- **48x48** - Extension management page
- **128x128** - Chrome Web Store

## Current Status

The `icon.svg` file is a master SVG icon that can be converted to PNG format in the required sizes.

## How to Generate PNG Icons

You can use any of these methods to convert the SVG to PNG:

### Method 1: Online Converter
1. Go to [CloudConvert](https://cloudconvert.com/svg-to-png) or similar
2. Upload `icon.svg`
3. Set width to 16, 48, and 128 pixels (generate separately)
4. Download and save as `icon16.png`, `icon48.png`, `icon128.png`

### Method 2: Using ImageMagick (Command Line)
```bash
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Method 3: Using Inkscape
```bash
inkscape icon.svg --export-png=icon16.png --export-width=16
inkscape icon.svg --export-png=icon48.png --export-width=48
inkscape icon.svg --export-png=icon128.png --export-width=128
```

### Method 4: Using a Design Tool
Open `icon.svg` in Figma, Sketch, or Adobe Illustrator and export at the required sizes.

## Quick Setup

If you want to load the extension immediately without proper icons, you can use placeholder icons:
1. Create simple colored PNG files at 16x16, 48x48, and 128x128
2. Or temporarily use any other PNG images (the extension will still work)

The icons are purely visual and don't affect functionality.

