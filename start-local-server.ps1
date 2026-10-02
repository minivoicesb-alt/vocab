$ErrorActionPreference = 'Stop'
$root = (Resolve-Path $PSScriptRoot).Path
$rootPrefix = $root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$port = 8765
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try {
    $listener.Start()
} catch {
    Write-Error "Не удалось запустить локальный сервер на порту $port. Закройте другое приложение на этом порту и повторите запуск."
    exit 1
}
$url = "http://127.0.0.1:$port/"
Write-Host "Приложение доступно по адресу $url"
Write-Host 'Чтобы остановить сервер, нажмите Ctrl+C.'
Start-Process $url
$mime = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.svg'='image/svg+xml' }
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            $candidate = [IO.Path]::GetFullPath((Join-Path $root $relative))
            if (-not $candidate.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
                $context.Response.StatusCode = 404
                $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
            } else {
                $ext = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
                $context.Response.ContentType = $mime[$ext]
                $bytes = [IO.File]::ReadAllBytes($candidate)
            }
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
