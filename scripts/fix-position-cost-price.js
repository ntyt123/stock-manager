// 修复持仓成本价脚本
// 从 manual_positions 表重新同步成本价到 user_positions 表

const { db, manualPositionModel, positionModel, userModel } = require('../database');

async function fixPositionCostPrice() {
    console.log('🔧 开始修复持仓成本价...\n');

    try {
        // 获取所有用户
        const users = await userModel.findAll();
        console.log(`📊 找到 ${users.length} 个用户\n`);

        for (const user of users) {
            console.log(`\n👤 处理用户: ${user.username} (ID: ${user.id})`);

            // 获取该用户的所有手动持仓
            const manualPositions = await manualPositionModel.findByUserId(user.id);

            if (manualPositions.length === 0) {
                console.log(`   ℹ️ 无手动持仓数据`);
                continue;
            }

            console.log(`   📋 找到 ${manualPositions.length} 个手动持仓\n`);

            let fixedCount = 0;
            let errorCount = 0;

            for (const manualPos of manualPositions) {
                const stockCode = manualPos.stock_code;
                const stockName = manualPos.stock_name;
                const quantity = manualPos.quantity;
                const costPrice = manualPos.cost_price;
                const currentPrice = manualPos.current_price || costPrice;

                console.log(`   🔍 检查: ${stockName} (${stockCode})`);
                console.log(`      手动持仓: 成本价=¥${costPrice}, 数量=${quantity}, 现价=¥${currentPrice}`);

                // 查找 user_positions 表中对应的记录
                const existingPosition = await positionModel.findByStockCode(user.id, stockCode);

                if (!existingPosition) {
                    console.log(`      ⚠️ user_positions 表中不存在，跳过`);
                    continue;
                }

                console.log(`      user_positions 表: 成本价=¥${existingPosition.costPrice}`);

                // 检查成本价是否为0或不一致
                if (existingPosition.costPrice === 0 || existingPosition.costPrice !== costPrice) {
                    console.log(`      ⚠️ 成本价不一致或为0，开始修复...`);

                    // 重新计算所有字段
                    const marketValue = currentPrice * quantity;
                    const profitLoss = (currentPrice - costPrice) * quantity;
                    const profitLossRate = costPrice > 0 ? ((currentPrice - costPrice) / costPrice * 100) : 0;

                    const syncPositionData = {
                        stockName: stockName,
                        quantity: quantity,
                        costPrice: costPrice,
                        currentPrice: currentPrice,
                        marketValue: marketValue,
                        profitLoss: profitLoss,
                        profitLossRate: profitLossRate
                    };

                    try {
                        await positionModel.updatePosition(user.id, stockCode, syncPositionData);
                        console.log(`      ✅ 修复成功: 成本价 ¥${existingPosition.costPrice} → ¥${costPrice}`);
                        console.log(`         盈亏: ¥${profitLoss.toFixed(2)} (${profitLossRate.toFixed(2)}%)`);
                        fixedCount++;
                    } catch (error) {
                        console.error(`      ❌ 修复失败: ${error.message}`);
                        errorCount++;
                    }
                } else {
                    console.log(`      ✅ 成本价正确，无需修复`);
                }
            }

            console.log(`\n   📊 用户 ${user.username} 统计:`);
            console.log(`      ✅ 修复成功: ${fixedCount} 个`);
            console.log(`      ❌ 修复失败: ${errorCount} 个`);
        }

        console.log('\n\n✅ 所有用户处理完成！');

    } catch (error) {
        console.error('❌ 修复脚本执行失败:', error);
        process.exit(1);
    }

    process.exit(0);
}

// 执行修复
fixPositionCostPrice();
