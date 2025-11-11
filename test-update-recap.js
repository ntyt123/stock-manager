/**
 * 测试更新复盘数据
 */

const axios = require('axios');

async function testUpdate() {
    try {
        // 先登录获取 token
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ 登录成功，获取 token');

        // 调用生成复盘数据的 API
        const today = new Date().toISOString().split('T')[0];
        const response = await axios.post('http://localhost:3000/api/recap/generate',
            { date: today },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ 复盘数据更新结果:');
        console.log(`   消息: ${response.data.message}`);
        console.log(`   持仓数量: ${response.data.data.position_count}`);
        console.log(`   今日盈亏: ¥${response.data.data.today_profit}`);
        console.log(`   总盈亏: ¥${response.data.data.total_profit}`);

    } catch (error) {
        console.error('❌ 测试失败:', error.response?.data || error.message);
    }
}

testUpdate();
