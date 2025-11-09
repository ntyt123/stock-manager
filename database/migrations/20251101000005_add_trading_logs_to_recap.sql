-- Migration: Add trading_logs_data to daily_recap
-- Created at: 2025-11-01
--
-- 为每日复盘表添加交易日志数据字段

ALTER TABLE daily_recap ADD COLUMN trading_logs_data TEXT;
