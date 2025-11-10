/**
 * 测试远程服务器是否能访问新浪财经API
 *
 * 使用方法：
 * node test-api-connection.js
 */

const axios = require('axios');
const iconv = require('iconv-lite');

async function testSinaAPI() {
    console.log('🔍 测试新浪财经API连接...\n');

    const testStocks = ['sh000001', 'sz399001'];  // 上证指数、深证成指
    const sinaUrl = `https://hq.sinajs.cn/list=${testStocks.join(',')}`;

    console.log(`📡 请求URL: ${sinaUrl}`);
    console.log(`⏱️  超时设置: 10秒\n`);

    try {
        const startTime = Date.now();

        const response = await axios.get(sinaUrl, {
            headers: { 'Referer': 'https://finance.sina.com.cn' },
            timeout: 10000,
            responseType: 'arraybuffer'
        });

        const duration = Date.now() - startTime;
        console.log(`✅ API连接成功！`);
        console.log(`⏱️  响应时间: ${duration}ms`);
        console.log(`📊 HTTP状态码: ${response.status}`);

        // 解析返回数据
        const data = iconv.decode(Buffer.from(response.data), 'gbk');
        const lines = data.split('\n').filter(line => line.trim());

        console.log(`\n📈 返回数据示例:`);
        lines.slice(0, 2).forEach(line => {
            console.log(`  ${line.substring(0, 100)}...`);
        });

        console.log(`\n✅ 测试通过！远程服务器可以正常访问新浪财经API`);
        return true;

    } catch (error) {
        console.error(`\n❌ API连接失败！`);
        console.error(`错误类型: ${error.name}`);
        console.error(`错误信息: ${error.message}`);

        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            console.error(`\n⚠️  超时问题：`);
            console.error(`  1. 检查服务器网络连接`);
            console.error(`  2. 检查防火墙设置`);
            console.error(`  3. 尝试使用代理访问`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            console.error(`\n⚠️  DNS解析问题：`);
            console.error(`  1. 检查DNS服务器设置`);
            console.error(`  2. 尝试使用公共DNS（8.8.8.8）`);
        } else if (error.response) {
            console.error(`\n⚠️  HTTP错误: ${error.response.status}`);
        }

        return false;
    }
}

// 运行测试
testSinaAPI()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试过程出错:', error);
        process.exit(1);
    });
