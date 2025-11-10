# 批量修复模态框显示控制方式
$files = @(
    'recommendation-manager.js',
    'portfolio-optimization-manager.js',
    'stock-pool-manager.js',
    'history-manager.js'
)

foreach ($file in $files) {
    $path = "f:\Git\stock-manager\public\js\modules\$file"

    if (Test-Path $path) {
        Write-Host "🔧 处理: $file"
        $content = Get-Content $path -Raw -Encoding UTF8
        $changed = $false

        # 替换 style.display = 'block'
        if ($content -match "\.style\.display\s*=\s*['\`"]block['\`"]") {
            $content = $content -replace "\.style\.display\s*=\s*['\`"]block['\`"]", ".classList.add('show')"
            $changed = $true
        }

        # 替换 style.display = 'flex'
        if ($content -match "\.style\.display\s*=\s*['\`"]flex['\`"]") {
            $content = $content -replace "\.style\.display\s*=\s*['\`"]flex['\`"]", ".classList.add('show')"
            $changed = $true
        }

        # 替换 style.display = 'none'
        if ($content -match "\.style\.display\s*=\s*['\`"]none['\`"]") {
            $content = $content -replace "\.style\.display\s*=\s*['\`"]none['\`"]", ".classList.remove('show')"
            $changed = $true
        }

        if ($changed) {
            Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8
            Write-Host "✅ 已修复: $file"
        } else {
            Write-Host "⏭️  跳过: $file (无需修改)"
        }
    } else {
        Write-Host "❌ 文件不存在: $file"
    }
}

Write-Host "`n✅ 批量修复完成！"
