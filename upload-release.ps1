$file = "dist-electron/TMPOS Setup 2.11.1.exe"
$url = "https://uploads.github.com/repos/tmpos/tmpos-desktop/releases/351580731/assets?name=TMPOS-Setup-2.11.1.exe"
$token = $env:GITHUB_TOKEN

if (-not $token) {
  throw "Define la variable de entorno GITHUB_TOKEN antes de ejecutar este script."
}

$headers = @{ Authorization = "token $token" }

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

Write-Host "Subiendo $file a GitHub Release..."

$response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -InFile $file -ContentType "application/octet-stream" -UseBasicParsing

Write-Host "Status: $($response.StatusCode)"
Write-Host "Respuesta: $($response.Content)"
