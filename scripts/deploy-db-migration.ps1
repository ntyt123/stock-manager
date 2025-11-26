# 远程数据库迁移 PowerShell 脚本
# 用于在远程服务器上运行 V2 版本的数据库迁移

param(
    [string]$RemoteUser = "root",
    [string]$RemoteHost = "42.192.40.196",
    [string]$RemotePath = "/root/stock-manager"
)

Write-Host "🚀 远程数据库迁移部署脚本" -ForegroundColor Cyan
Write-Host ""
Write-Host "目标服务器: $RemoteUser@$RemoteHost" -ForegroundColor Yellow
Write-Host "远程路径: $RemotePath" -ForegroundColor Yellow
Write-Host ""

# 步骤1: 上传检查脚本
Write-Host "📋 步骤1: 上传检查脚本到远程服务器..." -ForegroundColor Green
$uploadCmd = "scp scripts/check-remote-db.js ${RemoteUser}@${RemoteHost}:${RemotePath}/scripts/"
Write-Host "执行: $uploadCmd" -ForegroundColor Gray
Invoke-Expression $uploadCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 上传失败！请检查 SSH 连接" -ForegroundColor Red
    exit 1
}

# 步骤2: 检查远程数据库
Write-Host ""
Write-Host "📋 步骤2: 检查远程服务器数据库结构..." -ForegroundColor Green
$checkCmd = "ssh ${RemoteUser}@${RemoteHost} `"cd ${RemotePath} && node scripts/check-remote-db.js`""
Write-Host "执行: $checkCmd" -ForegroundColor Gray
Invoke-Expression $checkCmd

# 询问是否继续
Write-Host ""
$continue = Read-Host "是否继续运行迁移脚本？(y/n)"
if ($continue -ne "y" -and $continue -ne "Y") {
    Write-Host "❌ 取消迁移" -ForegroundColor Yellow
    exit 0
}

# 步骤3: 运行迁移
Write-Host ""
Write-Host "📤 步骤3: 运行远程迁移脚本..." -ForegroundColor Green

# 运行V2基础迁移
$migrateCmd1 = "ssh ${RemoteUser}@${RemoteHost} `"cd ${RemotePath} && node database/migrations/010_extend_daily_recap_for_v2.js`""
Write-Host "执行: $migrateCmd1" -ForegroundColor Gray
Invoke-Expression $migrateCmd1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ V2迁移可能已执行，继续..." -ForegroundColor Yellow
}

# 运行炸板数迁移
$migrateCmd2 = "ssh ${RemoteUser}@${RemoteHost} `"cd ${RemotePath} && node database/migrations/012_add_blown_board_count.js`""
Write-Host "执行: $migrateCmd2" -ForegroundColor Gray
Invoke-Expression $migrateCmd2
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 炸板数迁移失败！" -ForegroundColor Red
    exit 1
}

# 步骤4: 再次检查
Write-Host ""
Write-Host "📋 步骤4: 验证迁移结果..." -ForegroundColor Green
Invoke-Expression $checkCmd

# 步骤5: 重启服务
Write-Host ""
Write-Host "🔄 步骤5: 重启远程服务..." -ForegroundColor Green
$restartCmd = "ssh ${RemoteUser}@${RemoteHost} `"cd ${RemotePath} && pm2 restart stock-manager`""
Write-Host "执行: $restartCmd" -ForegroundColor Gray
Invoke-Expression $restartCmd

Write-Host ""
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host ""
