Add-Type -AssemblyName System.Drawing

$assetDirectory = Join-Path $PSScriptRoot '..\desktop\assets'
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null
$icoPath = Join-Path $assetDirectory 'savedatcost.ico'
$pngImages = @()
$sizes = @(256, 64, 32, 16)

foreach ($size in $sizes) {
  $bitmap = [System.Drawing.Bitmap]::new([int]$size, [int]$size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::FromArgb(25, 25, 25))

  $margin = [Math]::Max(1, [int]($size * 0.08))
  $rect = [System.Drawing.Rectangle]::new([int]$margin, [int]$margin, [int]($size - (2 * $margin)), [int]($size - (2 * $margin)))
  $tileBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(231, 168, 91))
  $graphics.FillEllipse($tileBrush, $rect)

  $fontSize = [Math]::Max(10, [int]($size * 0.58))
  $font = [System.Drawing.Font]::new('Segoe UI Symbol', [float]$fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 25, 25))
  $glyph = [string][char]0x20B1
  $measure = $graphics.MeasureString($glyph, $font)
  $point = [System.Drawing.PointF]::new([float](($size - $measure.Width) / 2), [float](($size - $measure.Height) / 2))
  $graphics.DrawString($glyph, $font, $textBrush, $point)

  if ($size -eq 256) {
    $rgba = New-Object byte[] ($size * $size * 4)
    $index = 0
    for ($y = 0; $y -lt $size; $y++) {
      for ($x = 0; $x -lt $size; $x++) {
        $pixel = $bitmap.GetPixel($x, $y)
        $rgba[$index++] = $pixel.R
        $rgba[$index++] = $pixel.G
        $rgba[$index++] = $pixel.B
        $rgba[$index++] = $pixel.A
      }
    }
    [System.IO.File]::WriteAllBytes((Join-Path $assetDirectory 'savedatcost.rgba'), $rgba)
  }

  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngImages += ,@($size, $stream.ToArray())

  $textBrush.Dispose()
  $font.Dispose()
  $tileBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $stream.Dispose()
}

$output = [System.IO.FileStream]::new($icoPath, [System.IO.FileMode]::Create)
$writer = [System.IO.BinaryWriter]::new($output)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$sizes.Count)
$offset = 6 + (16 * $sizes.Count)
foreach ($image in $pngImages) {
  $size = $image[0]
  $bytes = $image[1]
  $writer.Write([byte]($(if ($size -ge 256) { 0 } else { $size })))
  $writer.Write([byte]$(if ($size -ge 256) { 0 } else { $size }))
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]32)
  $writer.Write([uint32]$bytes.Length)
  $writer.Write([uint32]$offset)
  $offset += $bytes.Length
}
foreach ($image in $pngImages) { $writer.Write([byte[]]$image[1]) }
$writer.Flush()
$writer.Dispose()
$output.Dispose()
Write-Output "Created $icoPath"
