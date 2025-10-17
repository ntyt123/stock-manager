// ==================== 市场情绪API测试脚本 ====================
// 使用方法: node test-market-sentiment.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

// 登录获取Token
async function login() {
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            account: 'admin',
            password: 'admin'
        });

        if (response.data.success) {
            authToken = response.data.token;
            console.log('✅ 登录成功\n');
            return true;
        }
    } catch (error) {
        console.error('❌ 登录失败:', error.message);
        return false;
    }
}

// 测试资金流向API
async function testFundsFlow() {
    console.log('📊 测试资金流向API...');
    try {
        const response = await axios.get(`${BASE_URL}/api/market-sentiment/funds-flow`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ 资金流向数据获取成功');
            console.log('数据条数:', response.data.data.length);
            console.log('示例数据:', JSON.stringify(response.data.data[0], null, 2));
        }
    } catch (error) {
        console.error('❌ 资金流向获取失败:', error.response?.data || error.message);
    }
    console.log('');
}

// 测试行业资金流向API
async function testIndustryFlow() {
    console.log('🏢 测试行业资金流向API...');
    try {
        const response = await axios.get(`${BASE_URL}/api/market-sentiment/industry-flow`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ 行业资金流向数据获取成功');
            console.log('数据条数:', response.data.data.length);
            console.log('TOP3行业:', response.data.data.slice(0, 3).map(item =>
                `${item.industry}: ${item.net.toFixed(2)}亿`
            ).join(', '));
        }
    } catch (error) {
        console.error('❌ 行业资金流向获取失败:', error.response?.data || error.message);
    }
    console.log('');
}

// 测试龙虎榜API
async function testDragonTiger() {
    console.log('🐉 测试龙虎榜API...');
    try {
        const response = await axios.get(`${BASE_URL}/api/market-sentiment/dragon-tiger`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ 龙虎榜数据获取成功');
            console.log('数据条数:', response.data.data.length);
            if (response.data.data.length > 0) {
                console.log('示例:', response.data.data[0].name, response.data.data[0].change + '%');
            }
        }
    } catch (error) {
        console.error('⚠️ 龙虎榜获取失败 (可能是非交易日):', error.response?.data?.message || error.message);
    }
    console.log('');
}

// 测试大单追踪API
async function testBigOrders() {
    console.log('💰 测试大单追踪API...');
    try {
        const response = await axios.get(`${BASE_URL}/api/market-sentiment/big-orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ 大单追踪数据获取成功');
            console.log('数据条数:', response.data.data.length);
            console.log('示例:', response.data.data[0].name, response.data.data[0].type, response.data.data[0].amount + '亿');
        }
    } catch (error) {
        console.error('❌ 大单追踪获取失败:', error.response?.data || error.message);
    }
    console.log('');
}

// 测试北上资金API
async function testNorthboundFunds() {
    console.log('🌏 测试北上资金API...');
    try {
        const response = await axios.get(`${BASE_URL}/api/market-sentiment/northbound-funds`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ 北上资金数据获取成功');
            console.log('总计:', response.data.data.total + '亿');
            console.log('沪股通:', response.data.data.hgt + '亿');
            console.log('深股通:', response.data.data.sgt + '亿');
        }
    } catch (error) {
        console.error('❌ 北上资金获取失败:', error.response?.data || error.message);
    }
    console.log('');
}

// 主测试函数
async function runTests() {
    console.log('==================== 市场情绪API测试 ====================\n');

    // 登录
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('❌ 无法继续测试，登录失败');
        return;
    }

    // 运行所有测试
    await testFundsFlow();
    await testIndustryFlow();
    await testDragonTiger();
    await testBigOrders();
    await testNorthboundFunds();

    console.log('==================== 测试完成 ====================');
}

// 执行测试
runTests();
