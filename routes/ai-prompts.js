// ==================== AI提示词管理路由 ====================
// 提供AI提示词模板的CRUD操作接口

const express = require('express');
const { aiPromptTemplateModel } = require('../database');

module.exports = function(authenticateToken) {
    const router = express.Router();

    // ==================== 获取所有提示词模板 ====================
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const templates = await aiPromptTemplateModel.findAll();

            // 解析 variables JSON字符串
            const parsedTemplates = templates.map(template => ({
                ...template,
                variables: template.variables ? JSON.parse(template.variables) : []
            }));

            res.json({
                success: true,
                data: parsedTemplates
            });
        } catch (error) {
            console.error('❌ 获取提示词模板列表失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取提示词模板列表失败',
                message: error.message
            });
        }
    });

    // ==================== 根据ID获取提示词模板 ====================
    router.get('/:id', authenticateToken, async (req, res) => {
        try {
            const templateId = parseInt(req.params.id);
            const template = await aiPromptTemplateModel.findById(templateId);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: '提示词模板不存在'
                });
            }

            // 解析 variables JSON字符串
            const parsedTemplate = {
                ...template,
                variables: template.variables ? JSON.parse(template.variables) : []
            };

            res.json({
                success: true,
                data: parsedTemplate
            });
        } catch (error) {
            console.error('❌ 获取提示词模板详情失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取提示词模板详情失败',
                message: error.message
            });
        }
    });

    // ==================== 根据场景类型获取提示词模板 ====================
    router.get('/type/:sceneType', authenticateToken, async (req, res) => {
        try {
            const sceneType = req.params.sceneType;
            const template = await aiPromptTemplateModel.findBySceneType(sceneType);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: '提示词模板不存在'
                });
            }

            // 解析 variables JSON字符串
            const parsedTemplate = {
                ...template,
                variables: template.variables ? JSON.parse(template.variables) : []
            };

            res.json({
                success: true,
                data: parsedTemplate
            });
        } catch (error) {
            console.error('❌ 获取提示词模板失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取提示词模板失败',
                message: error.message
            });
        }
    });

    // ==================== 更新提示词模板 ====================
    router.put('/:id', authenticateToken, async (req, res) => {
        try {
            const templateId = parseInt(req.params.id);
            const { system_prompt, user_prompt_template, variables, description } = req.body;

            // 验证必填字段
            if (!system_prompt || !user_prompt_template) {
                return res.status(400).json({
                    success: false,
                    error: '系统提示词和用户提示词模板为必填项'
                });
            }

            // 检查模板是否存在
            const existingTemplate = await aiPromptTemplateModel.findById(templateId);
            if (!existingTemplate) {
                return res.status(404).json({
                    success: false,
                    error: '提示词模板不存在'
                });
            }

            // 更新模板
            const result = await aiPromptTemplateModel.update(templateId, {
                systemPrompt: system_prompt,
                userPromptTemplate: user_prompt_template,
                variables: variables || [],
                description: description || ''
            });

            if (result.changes === 0) {
                return res.status(500).json({
                    success: false,
                    error: '更新提示词模板失败'
                });
            }

            // 返回更新后的模板
            const updatedTemplate = await aiPromptTemplateModel.findById(templateId);
            const parsedTemplate = {
                ...updatedTemplate,
                variables: updatedTemplate.variables ? JSON.parse(updatedTemplate.variables) : []
            };

            console.log(`✅ 提示词模板 ID:${templateId} 更新成功`);

            res.json({
                success: true,
                message: '提示词模板更新成功',
                data: parsedTemplate
            });
        } catch (error) {
            console.error('❌ 更新提示词模板失败:', error.message);
            res.status(500).json({
                success: false,
                error: '更新提示词模板失败',
                message: error.message
            });
        }
    });

    // ==================== 创建新的提示词模板 ====================
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const {
                scene_type,
                scene_name,
                category,
                system_prompt,
                user_prompt_template,
                variables,
                description
            } = req.body;

            // 验证必填字段
            if (!scene_type || !scene_name || !category || !system_prompt || !user_prompt_template) {
                return res.status(400).json({
                    success: false,
                    error: '场景类型、场景名称、分类、系统提示词和用户提示词模板为必填项'
                });
            }

            // 检查场景类型是否已存在
            const existingTemplate = await aiPromptTemplateModel.findBySceneType(scene_type);
            if (existingTemplate) {
                return res.status(400).json({
                    success: false,
                    error: '该场景类型的提示词模板已存在'
                });
            }

            // 创建新模板
            const newTemplate = await aiPromptTemplateModel.create({
                sceneType: scene_type,
                sceneName: scene_name,
                category: category,
                systemPrompt: system_prompt,
                userPromptTemplate: user_prompt_template,
                variables: variables || [],
                description: description || ''
            });

            const parsedTemplate = {
                ...newTemplate,
                variables: newTemplate.variables ? JSON.parse(newTemplate.variables) : []
            };

            console.log(`✅ 新提示词模板创建成功 ID:${newTemplate.id}`);

            res.json({
                success: true,
                message: '提示词模板创建成功',
                data: parsedTemplate
            });
        } catch (error) {
            console.error('❌ 创建提示词模板失败:', error.message);
            res.status(500).json({
                success: false,
                error: '创建提示词模板失败',
                message: error.message
            });
        }
    });

    // ==================== 删除提示词模板 ====================
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            const templateId = parseInt(req.params.id);

            // 检查模板是否存在
            const template = await aiPromptTemplateModel.findById(templateId);
            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: '提示词模板不存在'
                });
            }

            // 删除模板
            const result = await aiPromptTemplateModel.delete(templateId);

            if (result.changes === 0) {
                return res.status(500).json({
                    success: false,
                    error: '删除提示词模板失败'
                });
            }

            console.log(`✅ 提示词模板 ID:${templateId} 删除成功`);

            res.json({
                success: true,
                message: '提示词模板删除成功'
            });
        } catch (error) {
            console.error('❌ 删除提示词模板失败:', error.message);
            res.status(500).json({
                success: false,
                error: '删除提示词模板失败',
                message: error.message
            });
        }
    });

    // ==================== 重置提示词模板为默认值 ====================
    router.post('/:id/reset', authenticateToken, async (req, res) => {
        try {
            const templateId = parseInt(req.params.id);

            // 检查模板是否存在
            const template = await aiPromptTemplateModel.findById(templateId);
            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: '提示词模板不存在'
                });
            }

            // 重置为默认值
            const result = await aiPromptTemplateModel.resetToDefault(template.scene_type);

            if (result.changes === 0) {
                return res.status(500).json({
                    success: false,
                    error: '重置提示词模板失败'
                });
            }

            // 返回重置后的模板
            const resetTemplate = await aiPromptTemplateModel.findById(templateId);
            const parsedTemplate = {
                ...resetTemplate,
                variables: resetTemplate.variables ? JSON.parse(resetTemplate.variables) : []
            };

            console.log(`✅ 提示词模板 ID:${templateId} 已重置为默认值`);

            res.json({
                success: true,
                message: '提示词模板已重置为默认值',
                data: parsedTemplate
            });
        } catch (error) {
            console.error('❌ 重置提示词模板失败:', error.message);
            res.status(500).json({
                success: false,
                error: '重置提示词模板失败',
                message: error.message
            });
        }
    });

    // ==================== 启用/禁用提示词模板 ====================
    router.put('/:id/toggle', authenticateToken, async (req, res) => {
        try {
            const templateId = parseInt(req.params.id);
            const { is_active } = req.body;

            if (is_active === undefined) {
                return res.status(400).json({
                    success: false,
                    error: '请提供is_active参数'
                });
            }

            // 检查模板是否存在
            const template = await aiPromptTemplateModel.findById(templateId);
            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: '提示词模板不存在'
                });
            }

            // 切换状态
            const result = await aiPromptTemplateModel.toggleActive(templateId, is_active);

            if (result.changes === 0) {
                return res.status(500).json({
                    success: false,
                    error: '切换提示词模板状态失败'
                });
            }

            console.log(`✅ 提示词模板 ID:${templateId} 状态已切换为 ${is_active ? '启用' : '禁用'}`);

            res.json({
                success: true,
                message: `提示词模板已${is_active ? '启用' : '禁用'}`,
                data: {
                    id: templateId,
                    is_active: is_active
                }
            });
        } catch (error) {
            console.error('❌ 切换提示词模板状态失败:', error.message);
            res.status(500).json({
                success: false,
                error: '切换提示词模板状态失败',
                message: error.message
            });
        }
    });

    return router;
};
