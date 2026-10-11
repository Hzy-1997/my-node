/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-24 10:12:23
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-11-10 14:47:42
 */

const { Op } = require('sequelize');
const { Sequelize, DataTypes } = require('sequelize');
const util = require("../../../utils/util");

// 首先引入所有模型
const { Dept, DeptParent, User } = require("../../../models/Summary")


// 创建部门列表
exports.deptOperate = async (req, res) => {
    let { id, action, deptName, leaderId, parentIds, childIds } = req.body;


    if (!action) return res.json(util.fail("无效的操作,缺少必要参数"))

    if (action == "create") {
        let nameRepeat = await Dept.findOne({ where: { deptName } })
        if (nameRepeat) return res.json(util.fail("创建失败,当前部门已经存在"))

        // 如果提供了负责人ID，检查用户是否存在
        if (leaderId) {
            const { User } = require("../../../models/Summary");
            const user = await User.findByPk(leaderId);
            if (!user) {
                return res.json(util.fail('指定的部门负责人不存在'));
            }
        }

        let deptState = await Dept.create({ deptName, leaderId })
        if (!deptState) return res.json(util.fail("创建失败,联系后端服务人员"))
        // 处理父部门关系，支持单个ID或ID数组
        if (parentIds) {
            // 如果是单个ID，转换为数组格式
            const parentIdsArray = Array.isArray(parentIds) ? parentIds : [parentIds];

            // 只取第一个父部门ID（确保一个部门只有一个父部门）
            if (parentIdsArray.length > 0) {
                const parentId = parentIdsArray[0];
                await deptState.addParents(parentId);
            }
        }
        // 如果有子部门
        if (childIds && childIds.length > 0) {
            for (const childId of childIds) {
                await deptState.addChildren(childId);
            }
        }
        return res.json(util.success("创建成功"));
    } else if (action == "update") {
        if (!id) return res.json(util.fail("更新失败,缺少必要参数"))

        // 检查部门名称是否重复（排除当前部门自己）
        if (deptName) {
            let nameRepeat = await Dept.findOne({
                where: {
                    deptName: deptName,
                    id: { [Op.ne]: id } // 排除当前部门
                }
            })
            if (nameRepeat) return res.json(util.fail("更新失败,当前部门名称已经存在"))
        }

        // 如果提供了负责人ID，检查用户是否存在
        if (leaderId) {
            const { User } = require("../../../models/Summary");
            const user = await User.findByPk(leaderId);
            if (!user) {
                return res.json(util.fail('指定的部门负责人不存在'));
            }
        }

        let updateState = await Dept.update(
            { deptName, leaderId },
            { where: { id } }
        );
        if (!updateState) return res.json(util.fail("更新失败"));

        // 处理父部门关系更新
        if (parentIds) {
            const dept = await Dept.findByPk(id);
            if (dept) {
                // 先删除现有的所有父部门关系
                const existingParents = await dept.getParents();
                if (existingParents && existingParents.length > 0) {
                    await dept.removeParents(existingParents);
                }

                // 如果有新的父部门，添加新的父部门关系
                // 处理单个ID或ID数组格式
                const parentIdsArray = Array.isArray(parentIds) ? parentIds : [parentIds];
                if (parentIdsArray.length > 0) {
                    // 只取最后一个ID作为新的父部门（一个部门只有一个父部门）
                    const newParentId = parentIdsArray[parentIdsArray.length - 1];
                    await dept.addParents(newParentId);
                }
            }
        }

        return res.json(util.success("更新成功"));
    } else if (action == "delete") {
        if (!id) return res.json(util.fail("删除失败,缺少必要参数"))

        // 实现级联删除：先获取所有子部门ID
        const getAllChildDeptIds = async (parentId) => {
            const childDeptIds = [];

            // 获取直接子部门
            const dept = await Dept.findByPk(parentId, {
                include: [{
                    model: Dept,
                    as: 'Children',
                    through: { attributes: [] }
                }]
            });

            // 递归获取所有层级子部门ID
            if (dept && dept.Children && dept.Children.length > 0) {
                for (const child of dept.Children) {
                    childDeptIds.push(child.id);
                    // 递归获取孙子部门
                    const grandChildIds = await getAllChildDeptIds(child.id);
                    childDeptIds.push(...grandChildIds);
                }
            }

            return childDeptIds;
        };

        // 获取当前部门的所有子部门ID
        const childDeptIds = await getAllChildDeptIds(id);

        // 构建要删除的部门ID数组（包括当前部门和所有子部门）
        const deptIdsToDelete = [id, ...childDeptIds];

        // 执行批量删除
        const deleteState = await Dept.destroy({
            where: {
                id: deptIdsToDelete
            }
        });

        if (!deleteState) return res.json(util.fail("删除失败"))

        // 同时删除部门-父部门关联表中的相关记录
        await DeptParent.destroy({
            where: {
                [Op.or]: [
                    { parentId: deptIdsToDelete },
                    { childId: deptIdsToDelete }
                ]
            }
        });

        return res.json(util.success(`成功删除 ${deleteState} 个部门（包含子部门）`));
    } else {
        return res.json(util.fail("无效的操作,缺少必要参数"));
    }
};

// 查询列表
exports.deptList = async (req, res) => {
    try {

        // 递归获取部门及子部门和父部门信息（带层级内排序）
        const getDeptWithChildren = async (deptId) => {
            // // 先确保User模型已经正确关联
            // if (!Dept.associations.leader) {
            //     console.warn('Warning: Dept.leader association not found, trying to associate again');
            //     Dept.belongsTo(User, {
            //         foreignKey: 'leaderId',
            //         as: 'leader',
            //         onDelete: 'SET NULL'
            //     });
            // }

            const dept = await Dept.findByPk(deptId, {
                include: [
                    {
                        model: User,
                        as: 'leader',
                        attributes: ['id', 'username', 'account', 'email', 'phone'],
                        required: false // 即使没有负责人也返回部门信息
                    },
                    {
                        model: Dept,
                        as: 'Children',
                        through: { attributes: [] },
                        include: [
                            {
                                model: User,
                                as: 'leader',
                                attributes: ['id', 'username', 'account', 'email', 'phone'],
                                required: false
                            }
                        ]
                    },
                    {
                        model: Dept,
                        as: 'Parents',
                        through: { attributes: [] },
                        attributes: ['id', 'deptName']
                    }
                ]
            });

            // 如果leader为null但有leaderId，尝试直接查询用户信息
            // if (!dept.leader && dept.leaderId) {
            //     try {
            //         const leaderInfo = await User.findByPk(dept.leaderId, {
            //             attributes: ['id', 'username', 'account', 'email', 'phone']
            //         });
            //         dept.leader = leaderInfo;
            //     } catch (error) {
            //         console.error('Failed to fetch leader info:', error);
            //     }
            // }

            if (dept.Children && dept.Children.length > 0) {
                for (let i = 0; i < dept.Children.length; i++) {
                    // 对子部门递归获取信息
                    dept.Children[i] = await getDeptWithChildren(dept.Children[i].id);
                }
            }
            return dept;
        };

        // 查询顶级部门，也包含父部门和负责人信息
        const topDepts = await Dept.findAll({
            where: { id: { [Op.notIn]: Sequelize.literal('(SELECT childId FROM dept_parents)') } },
            include: [
                {
                    model: User,
                    as: 'leader',
                    attributes: ['id', 'username', 'account', 'email', 'phone'],
                    required: false // 即使没有负责人也返回部门信息
                },
                {
                    model: Dept,
                    as: 'Parents',
                    through: { attributes: [] },
                    attributes: ['id', 'deptName']
                }
            ],

        });

        // 确保每个顶级部门的leader信息正确
        for (let i = 0; i < topDepts.length; i++) {
            const dept = topDepts[i];
            // 如果leader为null但有leaderId，尝试直接查询用户信息
            if (!dept.leader && dept.leaderId) {
                try {
                    const leaderInfo = await User.findByPk(dept.leaderId, {
                        attributes: ['id', 'username', 'account', 'email', 'phone']
                    });
                    dept.leader = leaderInfo;
                } catch (error) {
                    console.error('Failed to fetch leader info for top dept:', error);
                }
            }
        }

        // 递归获取所有层级子部门
        const rows = [];
        for (const dept of topDepts) {
            const deptWithChildren = await getDeptWithChildren(dept.id);
            rows.push(deptWithChildren);
        }

        // 计算总顶级部门数量
        const total = topDepts.length;
        // 返回数据和分页信息
        return res.json(util.success("查询成功", rows));
    } catch (error) {
        return res.json(util.fail("获取列表失败", error.message));
    }
};
