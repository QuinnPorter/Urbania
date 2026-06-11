# Generates PWA icons procedurally (blocky city skyline on brand green).
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force $outDir | Out-Null

function New-Icon([int]$size, [string]$path, [bool]$maskable) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.SmoothingMode = "AntiAlias"

    $green = [System.Drawing.Color]::FromArgb(143, 209, 110)
    $gfx.Clear($green)

    # Maskable icons need content inside the inner 80% safe zone.
    $pad = if ($maskable) { $size * 0.18 } else { $size * 0.10 }
    $w = $size - 2 * $pad

    # Road strip along the bottom.
    $roadBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(154, 160, 171))
    $roadY = $size - $pad - $w * 0.16
    $gfx.FillRectangle($roadBrush, $pad, $roadY, $w, $w * 0.16)
    $dashBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 240, 230))
    $dashY = $roadY + $w * 0.065
    for ($i = 0; $i -lt 4; $i++) {
        $gfx.FillRectangle($dashBrush, $pad + $w * (0.06 + $i * 0.26), $dashY, $w * 0.12, $w * 0.03)
    }

    # Three blocky buildings.
    $colors = @(
        [System.Drawing.Color]::FromArgb(95, 184, 232),  # blue
        [System.Drawing.Color]::FromArgb(255, 210, 77),  # yellow
        [System.Drawing.Color]::FromArgb(224, 122, 95)   # coral
    )
    $heights = @(0.52, 0.70, 0.40)
    $bw = $w * 0.26
    $gap = $w * 0.07
    $x = $pad + ($w - (3 * $bw + 2 * $gap)) / 2
    for ($i = 0; $i -lt 3; $i++) {
        $h = $w * $heights[$i]
        $by = $roadY - $h
        $brush = New-Object System.Drawing.SolidBrush($colors[$i])
        $gfx.FillRectangle($brush, $x, $by, $bw, $h)
        # Windows: little white squares.
        $win = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 255, 255, 255))
        $ws = $bw * 0.22
        for ($r = 0; $r -lt [Math]::Floor($heights[$i] / 0.18); $r++) {
            $gfx.FillRectangle($win, $x + $bw * 0.16, $by + $h * 0.12 + $r * $ws * 1.7, $ws, $ws)
            $gfx.FillRectangle($win, $x + $bw * 0.62, $by + $h * 0.12 + $r * $ws * 1.7, $ws, $ws)
        }
        $x += $bw + $gap
    }

    $gfx.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "wrote $path"
}

New-Icon 192 (Join-Path $outDir "icon-192.png") $false
New-Icon 512 (Join-Path $outDir "icon-512.png") $false
New-Icon 512 (Join-Path $outDir "icon-512-maskable.png") $true
New-Icon 64 (Join-Path $outDir "favicon.png") $false
