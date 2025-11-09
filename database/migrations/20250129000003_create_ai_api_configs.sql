-- Migration: 创建AI API配置表
-- Created at: 2025-01-29
-- 用于管理多个AI API接口配置

-- 创建AI API配置表
CREATE TABLE IF NOT EXISTS ai_api_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                   -- 配置名称 (如: DeepSeek, OpenAI GPT-4)
    provider TEXT NOT NULL,                      -- 提供商 (deepseek, openai, anthropic, custom)
    api_url TEXT NOT NULL,                       -- API地址
    api_key TEXT,                                -- API密钥 (可为空，有些本地模型不需要)
    model TEXT NOT NULL,                         -- 模型名称 (如: deepseek-chat, gpt-4)
    temperature REAL DEFAULT 0.7,                -- 温度参数 (0-2)
    max_tokens INTEGER DEFAULT 2000,             -- 最大令牌数
    timeout INTEGER DEFAULT 30000,               -- 超时时间(毫秒)
    is_active INTEGER DEFAULT 0,                 -- 是否为当前激活的配置 (0/1)
    is_default INTEGER DEFAULT 0,                -- 是否为默认配置 (0/1)
    custom_headers TEXT,                         -- 自定义请求头 (JSON格式)
    custom_request_transform TEXT,               -- 自定义请求转换代码 (JavaScript函数代码)
    custom_response_transform TEXT,              -- 自定义响应转换代码 (JavaScript函数代码)
    description TEXT,                            -- 配置描述
    extra_config TEXT,                           -- 其他额外配置 (JSON格式)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_api_configs_is_active
ON ai_api_configs(is_active);

-- 插入默认的DeepSeek配置
INSERT INTO ai_api_configs (
    name, provider, api_url, api_key, model,
    temperature, max_tokens, timeout,
    is_active, is_default, description
) VALUES (
    'DeepSeek (默认)',
    'deepseek',
    'https://api.deepseek.com/chat/completions',
    'sk-4196cd3ad726465581d70a9791fcbb23',
    'deepseek-chat',
    0.7,
    2000,
    30000,
    1,
    1,
    'DeepSeek AI 默认配置'
);
