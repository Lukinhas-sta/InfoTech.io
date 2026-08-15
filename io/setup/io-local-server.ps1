$ErrorActionPreference = 'Stop'

$Port = 8765
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HtmlPath = Join-Path $AppDir 'local.html'

if (-not (Test-Path $HtmlPath)) {
    throw "Arquivo local.html nao encontrado em $AppDir"
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()

            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line -or $line -eq '') { break }
            }

            $path = '/'
            if ($requestLine -match '^GET\s+([^\s]+)\s+HTTP/') {
                $path = $Matches[1].Split('?')[0]
            }

            if ($path -eq '/' -or $path -eq '/local.html') {
                $body = [System.IO.File]::ReadAllBytes($HtmlPath)
                $status = '200 OK'
                $contentType = 'text/html; charset=utf-8'
            }
            elseif ($path -eq '/health') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('ok')
                $status = '200 OK'
                $contentType = 'text/plain; charset=utf-8'
            }
            elseif ($path -eq '/favicon.ico') {
                $body = [byte[]]::new(0)
                $status = '204 No Content'
                $contentType = 'image/x-icon'
            }
            else {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Nao encontrado')
                $status = '404 Not Found'
                $contentType = 'text/plain; charset=utf-8'
            }

            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($body.Length -gt 0) {
                $stream.Write($body, 0, $body.Length)
            }
            $stream.Flush()
        }
        catch {
            # Ignora requisicoes interrompidas pelo navegador.
        }
        finally {
            if ($client) { $client.Close() }
        }
    }
}
finally {
    $listener.Stop()
}
