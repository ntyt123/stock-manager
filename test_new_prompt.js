const axios = require('axios');

// 测试新的AI prompt是否生成正确格式的报告
async function testNewPrompt() {
    try {
        console.log('🔑 正在登录测试账号...');

        // 登录获取token
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            account: 'admin',
            password: 'admin'
        });

        if (!loginResponse.data.success) {
            console.error('❌ 登录失败');
            return;
        }

        const token = loginResponse.data.token;
        console.log('✅ 登录成功，Token已获取');

        console.log('\n📊 开始触发持仓分析...');

        // 触发持仓分析
        const analysisResponse = await axios.post(
            'http://localhost:3001/api/analysis/portfolio',
            {},
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 180000 // 3分钟超时
            }
        );

        if (!analysisResponse.data.success) {
            console.error('❌ 分析失败:', analysisResponse.data.error);
            return;
        }

        console.log('✅ 持仓分析完成');
        console.log('📄 报告ID:', analysisResponse.data.data.reportId);

        // 检查分析内容是否包含新格式
        const analysisContent = analysisResponse.data.data.analysis;
        const hasNewFormat = analysisContent.includes('## 【风险预警】');
        const hasOldFormat = analysisContent.includes('<!-- RISK_WARNING_START -->');

        console.log('\n========== 格式检查 ==========');
        console.log('包含新格式 (## 【风险预警】):', hasNewFormat ? '✅ 是' : '❌ 否');
        console.log('包含旧格式 (HTML注释):', hasOldFormat ? '⚠️ 是' : '✅ 否');

        if (hasNewFormat) {
            console.log('\n🎉 成功！新格式已生效');

            // 提取风险预警内容预览
            const match = analysisContent.match(/##\s*【风险预警】([\s\S]*?)(?=\n##\s+|$)/);
            if (match) {
                console.log('\n========== 风险预警内容预览 ==========');
                console.log(match[0].substring(0, 500));
            }
        } else {
            console.log('\n❌ 失败！AI未生成新格式的风险预警标题');
            console.log('\n内容预览（前1000字符）:');
            console.log(analysisContent.substring(0, 1000));
        }

    } catch (error) {
        console.error('❌ 测试过程出错:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
    }
}

testNewPrompt();
