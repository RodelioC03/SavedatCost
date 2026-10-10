param(
  [Parameter(Mandatory = $true)][string]$Executable,
  [Parameter(Mandatory = $true)][string]$IconFile
)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class SavedatCostResourceWriter {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr BeginUpdateResource(string fileName, bool deleteExistingResources);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool UpdateResource(IntPtr update, IntPtr type, IntPtr name, ushort language, byte[] data, uint size);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool EndUpdateResource(IntPtr update, bool discard);
}
"@

$ico = [System.IO.File]::ReadAllBytes((Resolve-Path $IconFile))
$count = [BitConverter]::ToUInt16($ico, 4)
$entries = @()
$update = [SavedatCostResourceWriter]::BeginUpdateResource((Resolve-Path $Executable), $true)
if ($update -eq [IntPtr]::Zero) { throw "Could not open executable for icon update: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }

try {
  for ($i = 0; $i -lt $count; $i++) {
    $offset = 6 + ($i * 16)
    $width = if ($ico[$offset] -eq 0) { 256 } else { [int]$ico[$offset] }
    $height = if ($ico[$offset + 1] -eq 0) { 256 } else { [int]$ico[$offset + 1] }
    $colorCount = $ico[$offset + 2]
    $planes = [BitConverter]::ToUInt16($ico, $offset + 4)
    $bits = [BitConverter]::ToUInt16($ico, $offset + 6)
    $bytesInRes = [BitConverter]::ToUInt32($ico, $offset + 8)
    $imageOffset = [BitConverter]::ToUInt32($ico, $offset + 12)
    $payload = New-Object byte[] $bytesInRes
    [Array]::Copy($ico, [int]$imageOffset, $payload, 0, [int]$bytesInRes)
    $resourceId = 1 + $i
    $ok = [SavedatCostResourceWriter]::UpdateResource($update, [IntPtr]3, [IntPtr]$resourceId, 0x0409, $payload, [uint32]$payload.Length)
    if (-not $ok) { throw "Could not write icon image resource $resourceId" }
    $entries += [pscustomobject]@{Width=$width;Height=$height;ColorCount=$colorCount;Planes=$planes;Bits=$bits;Bytes=$bytesInRes;Id=$resourceId}
  }

  $groupStream = [System.IO.MemoryStream]::new()
  $groupWriter = [System.IO.BinaryWriter]::new($groupStream)
  $groupWriter.Write([uint16]0)
  $groupWriter.Write([uint16]1)
  $groupWriter.Write([uint16]$entries.Count)
  foreach ($entry in $entries) {
    $groupWriter.Write([byte]$(if ($entry.Width -ge 256) { 0 } else { $entry.Width }))
    $groupWriter.Write([byte]$(if ($entry.Height -ge 256) { 0 } else { $entry.Height }))
    $groupWriter.Write([byte]$entry.ColorCount)
    $groupWriter.Write([byte]0)
    $groupWriter.Write([uint16]$entry.Planes)
    $groupWriter.Write([uint16]$entry.Bits)
    $groupWriter.Write([uint32]$entry.Bytes)
    $groupWriter.Write([uint16]$entry.Id)
  }
  $groupWriter.Flush()
  $groupPayload = $groupStream.ToArray()
  $groupWriter.Dispose()
  $groupStream.Dispose()
  $ok = [SavedatCostResourceWriter]::UpdateResource($update, [IntPtr]14, [IntPtr]1, 0x0409, $groupPayload, [uint32]$groupPayload.Length)
  if (-not $ok) { throw 'Could not write the grouped icon resource' }
  if (-not [SavedatCostResourceWriter]::EndUpdateResource($update, $false)) { throw 'Could not finalize the executable icon update' }
  Write-Output "Embedded $IconFile into $Executable"
} catch {
  [SavedatCostResourceWriter]::EndUpdateResource($update, $true) | Out-Null
  throw
}
