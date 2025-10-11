const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const { watchlistModel } = require('../database');

// 辅助函数：修复中文字符乱码
function fixChineseCharacters(text) {
    if (!text || typeof text !== 'string') return text;

    console.log('原始文本:', text);

    // 如果文本已经是正确的中文，直接返回
    if (/[\u4e00-\u9fa5]/.test(text) && !text.includes('�') && !text.includes('\ufffd')) {
        console.log('文本已经是正确的中文，无需处理');
        return text;
    }

    // 尝试多种编码转换
    const encodings = ['gbk', 'gb2312', 'gb18030', 'big5', 'utf8'];

    for (const encoding of encodings) {
        try {
            // 方法1：直接使用iconv进行编码转换
            const decodedText1 = iconv.decode(Buffer.from(text, 'binary'), encoding);
            console.log(`方法1 - 编码 ${encoding}: ${decodedText1}`);

            // 方法2：尝试将文本视为latin1编码，然后转换
            const decodedText2 = iconv.decode(Buffer.from(text, 'latin1'), encoding);
            console.log(`方法2 - 编码 ${encoding}: ${decodedText2}`);

            // 方法3：尝试将文本视为utf8编码，然后转换（针对双重编码情况）
            let decodedText3 = text;
            try {
                // 先尝试将乱码文本解码为Buffer，再重新编码
                const tempBuffer = iconv.encode(text, 'utf8');
                decodedText3 = iconv.decode(tempBuffer, encoding);
            } catch (e) {
                decodedText3 = text;
            }
            console.log(`方法3 - 编码 ${encoding}: ${decodedText3}`);

            // 检查哪个转换结果最可能是正确的中文
            const candidates = [decodedText1, decodedText2, decodedText3];
            for (const candidate of candidates) {
                // 检查转换结果是否包含中文字符且没有乱码
                if (/[\u4e00-\u9fa5]/.test(candidate) &&
                    !candidate.includes('�') &&
                    !candidate.includes('\ufffd') &&
                    candidate.length > 0 &&
                    candidate !== text) {
                    console.log(`✅ 使用编码 ${encoding} 成功转换: ${candidate}`);
                    return candidate;
                }
            }
        } catch (error) {
            console.log(`编码 ${encoding} 转换失败:`, error.message);
        }
    }

    // 如果所有编码转换都失败，尝试简单的字符清理
    console.log('所有编码转换失败，尝试字符清理');
    const cleanedText = text.replace(/[�\ufffd]/g, '').trim();
    if (cleanedText && cleanedText !== text) {
        console.log('清理后文本:', cleanedText);
        return cleanedText;
    }

    console.log('无法修复乱码，返回原始文本');
    return text;
}

// 辅助函数：解析Excel文件
async function parseExcelFile(fileBuffer) {
    try {
        console.log('开始解析Excel文件...');

        // 使用xlsx库解析Excel文件，针对.xls格式优化
        const workbook = XLSX.read(fileBuffer, {
            type: 'buffer',
            codepage: 936, // GBK编码，适用于中文.xls文件
            cellText: true,
            cellDates: true,
            raw: false, // 获取格式化后的文本
            WTF: true // 启用WTF模式，更好地处理中文编码
        });

        console.log('Excel文件读取成功，工作表数量:', workbook.SheetNames.length);

        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        console.log('工作表名称:', firstSheetName);

        // 将工作表转换为JSON格式
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false, // 获取格式化后的文本值
            defval: '' // 默认值为空字符串
        });

        console.log('Excel数据行数:', jsonData.length);
        console.log('前3行数据预览:', jsonData.slice(0, 3));

        // 查找数据开始行（跳过表头）
        let dataStartRow = 0;
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (Array.isArray(row) && row.some(cell =>
                typeof cell === 'string' && (cell.includes('证券代码') || cell.includes('股票代码')))) {
                dataStartRow = i + 1; // 数据从下一行开始
                console.log('找到表头行:', i, '数据从第', dataStartRow, '行开始');
                break;
            }
        }

        // 如果没有找到表头，假设数据从第2行开始（跳过标题行）
        if (dataStartRow === 0) {
            dataStartRow = 1;
            console.log('未找到表头，数据从第1行开始');
        }

        const positions = [];
        let validCount = 0;

        // 解析持仓数据行
        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!Array.isArray(row) || row.length < 11) {
                console.log('跳过行', i, ': 不是数组或长度不足');
                continue;
            }

            console.log('解析第', i, '行:', row);

            // 根据实际Excel格式解析字段
            let stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate;

            // 第2列：证券代码（需要去除公式符号）
            if (row[1] !== undefined && row[1] !== null && row[1] !== '') {
                stockCode = row[1].toString().replace(/[="\s]/g, '').trim();
                console.log('证券代码:', stockCode);
            }

            // 第3列：证券名称
            if (row[2] !== undefined && row[2] !== null && row[2] !== '') {
                stockName = fixChineseCharacters(row[2].toString().trim());
                console.log('证券名称:', stockName);
            }

            // 第4列：持仓数量
            quantity = parseFloat(row[3]) || 0;

            // 第6列：成本价
            costPrice = parseFloat(row[5]) || 0;

            // 第11列：当前价
            currentPrice = parseFloat(row[10]) || 0;

            // 第10列：参考市值
            marketValue = parseFloat(row[9]) || 0;

            // 第7列：实现盈亏
            profitLoss = parseFloat(row[6]) || 0;

            // 第8列：盈亏率
            profitLossRate = parseFloat(row[7]) || 0;

            console.log('解析结果:', { stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate });

            // 如果缺少当前价，使用成本价加盈亏计算
            let finalCurrentPrice = currentPrice;
            if (currentPrice === 0 && costPrice > 0 && quantity > 0) {
                finalCurrentPrice = costPrice + (profitLoss / quantity);
            }

            // 如果缺少市值，使用当前价和数量计算
            let finalMarketValue = marketValue;
            if (marketValue === 0 && finalCurrentPrice > 0 && quantity > 0) {
                finalMarketValue = finalCurrentPrice * quantity;
            }

            // 验证数据有效性
            if (stockCode && stockName && quantity > 0) {
                positions.push({
                    stockCode: stockCode,
                    stockName: stockName,
                    quantity: quantity,
                    costPrice: costPrice,
                    currentPrice: finalCurrentPrice > 0 ? finalCurrentPrice : costPrice,
                    marketValue: finalMarketValue > 0 ? finalMarketValue : (finalCurrentPrice * quantity),
                    profitLoss: profitLoss,
                    profitLossRate: profitLossRate
                });
                validCount++;
                console.log('成功解析第', validCount, '条数据');
            } else {
                console.log('数据验证失败，跳过该行');
            }
        }

        console.log('总共解析到', validCount, '条有效数据');

        // 如果没有解析到数据，返回空数组而不是模拟数据
        if (validCount === 0) {
            console.log('Excel文件解析成功但未找到有效数据，返回空数组');
            return [];
        }

        return positions;

    } catch (error) {
        console.error('Excel文件解析错误:', error);

        // 解析失败时返回空数组而不是模拟数据
        console.log('Excel文件解析失败，返回空数组');
        return [];
    }
}

// 辅助函数 - 根据股票代码获取股票名称
function getStockName(symbol) {
    const stockMap = {
        '600036': '招商银行',
        '000858': '五粮液',
        '601318': '中国平安',
        '600519': '贵州茅台',
        '000333': '美的集团',
        '000001': '平安银行',
        '600000': '浦发银行',
        '601398': '工商银行'
    };
    return stockMap[symbol] || '未知股票';
}

// 辅助函数 - 自动将持仓股票添加到自选股
async function autoAddPositionsToWatchlist(userId, positions) {
    if (!positions || positions.length === 0) {
        return { successCount: 0, skipCount: 0, errorCount: 0 };
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    console.log(`📝 开始自动将 ${positions.length} 个持仓股票添加到自选股...`);

    for (const position of positions) {
        try {
            const stockCode = position.stockCode;
            const stockName = position.stockName || '未知股票';

            // 检查是否已在自选股中
            const exists = await watchlistModel.exists(userId, stockCode);

            if (exists) {
                skipCount++;
                console.log(`  ⏭️ 跳过已存在的股票: ${stockCode} ${stockName}`);
                continue;
            }

            // 添加到自选股
            await watchlistModel.add(userId, stockCode, stockName);
            successCount++;
            console.log(`  ✅ 成功添加: ${stockCode} ${stockName}`);

        } catch (error) {
            errorCount++;
            console.error(`  ❌ 添加失败: ${position.stockCode}`, error.message);
        }
    }

    console.log(`📊 自动添加完成: 成功 ${successCount} 个，跳过 ${skipCount} 个，失败 ${errorCount} 个`);

    return { successCount, skipCount, errorCount };
}

module.exports = {
    fixChineseCharacters,
    parseExcelFile,
    getStockName,
    autoAddPositionsToWatchlist
};
