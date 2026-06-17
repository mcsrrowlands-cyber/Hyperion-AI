# Hyperion AI — PowerShell Backend Server
# No Python or Node required. Uses .NET HttpListener built into Windows.
#
# Usage:
#   1. Add your key to .env:  ANTHROPIC_API_KEY=sk-ant-api03-...
#   2. Run:  powershell -ExecutionPolicy Bypass -File server.ps1
#   3. Open: http://localhost:8000

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Load API key from .env
# ---------------------------------------------------------------------------

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found. Create it with: ANTHROPIC_API_KEY=your-key-here"
    exit 1
}

$API_KEY = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^ANTHROPIC_API_KEY=(.+)$") {
        $API_KEY = $Matches[1].Trim()
    }
}

if (-not $API_KEY -or $API_KEY -eq "your-key-here") {
    Write-Error "Set a real ANTHROPIC_API_KEY value in .env before starting the server."
    exit 1
}

# ---------------------------------------------------------------------------
# MIME types
# ---------------------------------------------------------------------------

$MIME = @{
    ".html"  = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".txt"   = "text/plain; charset=utf-8"
    ".ico"   = "image/x-icon"
    ".png"   = "image/png"
    ".svg"   = "image/svg+xml"
}

$BASE = $PSScriptRoot

# ---------------------------------------------------------------------------
# Start listener
# ---------------------------------------------------------------------------

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:8000/")
$listener.Start()

Write-Host ""
Write-Host "  Hyperion AI server running." -ForegroundColor Cyan
Write-Host "  Open: http://localhost:8000" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

function Send-Response($context, $statusCode, $contentType, $body) {
    $context.Response.StatusCode  = $statusCode
    $context.Response.ContentType = $contentType
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Flush()
    $context.Response.Close()
}

function Add-CorsHeaders($response) {
    $response.Headers.Set("Access-Control-Allow-Origin",  "*")
    $response.Headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Set("Access-Control-Allow-Headers", "Content-Type")
}

try {
    while ($listener.IsListening) {

        $context = $listener.GetContext()
        $req     = $context.Request
        $res     = $context.Response
        Add-CorsHeaders $res

        $method = $req.HttpMethod
        $path   = $req.Url.LocalPath

        Write-Host "  $method $path" -ForegroundColor DarkGray

        # ----------------------------------------------------------------
        # CORS preflight
        # ----------------------------------------------------------------
        if ($method -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        # ----------------------------------------------------------------
        # GET /health  — server liveness check
        # ----------------------------------------------------------------
        if ($method -eq "GET" -and ($path -eq "/health" -or $path -eq "/api/health")) {
            Send-Response $context 200 "application/json" '{"status":"ok"}'
            continue
        }

        # ----------------------------------------------------------------
        # POST /chat  — proxy to Anthropic
        # ----------------------------------------------------------------
        if ($method -eq "POST" -and ($path -eq "/chat" -or $path -eq "/api/chat")) {
            $reader  = [System.IO.StreamReader]::new($req.InputStream)
            $rawBody = $reader.ReadToEnd()
            $reader.Close()

            try {
                $parsed = $rawBody | ConvertFrom-Json

                $anthropicBody = @{
                    model      = "claude-sonnet-4-6"
                    max_tokens = 2048
                    system     = $parsed.system
                    messages   = $parsed.messages
                } | ConvertTo-Json -Depth 20

                $apiResponse = Invoke-RestMethod `
                    -Uri    "https://api.anthropic.com/v1/messages" `
                    -Method POST `
                    -ContentType "application/json" `
                    -Headers @{
                        "x-api-key"          = $API_KEY
                        "anthropic-version"  = "2023-06-01"
                    } `
                    -Body $anthropicBody

                $text    = $apiResponse.content[0].text
                $respJson = @{ content = $text } | ConvertTo-Json
                Send-Response $context 200 "application/json" $respJson

            } catch {
                $errMsg  = $_.Exception.Message
                Write-Host "  [ERROR] $errMsg" -ForegroundColor Red
                $errJson = @{ detail = $errMsg } | ConvertTo-Json
                Send-Response $context 500 "application/json" $errJson
            }
            continue
        }

        # ----------------------------------------------------------------
        # GET — serve static files
        # ----------------------------------------------------------------
        if ($method -eq "GET") {
            $filePath = $path.TrimStart("/")
            if ($filePath -eq "") { $filePath = "index.html" }

            $fullPath = Join-Path $BASE $filePath

            # Prevent directory traversal
            if (-not $fullPath.StartsWith($BASE)) {
                Send-Response $context 403 "text/plain" "Forbidden"
                continue
            }

            if (Test-Path $fullPath -PathType Leaf) {
                $ext      = [System.IO.Path]::GetExtension($fullPath)
                $mime     = if ($MIME[$ext]) { $MIME[$ext] } else { "application/octet-stream" }
                $bytes    = [System.IO.File]::ReadAllBytes($fullPath)
                $res.StatusCode          = 200
                $res.ContentType         = $mime
                $res.ContentLength64     = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                $res.OutputStream.Flush()
                $res.Close()
            } else {
                # SPA fallback
                $index = Join-Path $BASE "index.html"
                $bytes = [System.IO.File]::ReadAllBytes($index)
                $res.StatusCode          = 200
                $res.ContentType         = "text/html; charset=utf-8"
                $res.ContentLength64     = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                $res.OutputStream.Flush()
                $res.Close()
            }
            continue
        }

        # ----------------------------------------------------------------
        # Anything else
        # ----------------------------------------------------------------
        Send-Response $context 405 "text/plain" "Method Not Allowed"
    }
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Gray
}
