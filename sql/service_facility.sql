-- 通用服务设施管理模块（卫生间/吸烟区/未来任意类型）
-- 项目无 sync/migration 机制，手动执行本脚本

-- 1. 点位表
CREATE TABLE service_facility (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL COMMENT '标题',
  shortDesc VARCHAR(500) DEFAULT NULL COMMENT '简短描述',
  address VARCHAR(300) NOT NULL COMMENT '地址',
  location VARCHAR(100) NOT NULL COMMENT '经纬度位置',
  status INT DEFAULT 1 COMMENT '状态(1正常 2停用)',
  sortOrder INT DEFAULT 0 COMMENT '排序权重',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='服务设施点位';

-- 2. 管理后台菜单（挂在"服务管理"id=167 目录下；管理员直接可见全部启用菜单，无需绑角色）
INSERT INTO menus (menuName, menuLevel, path, icon, component, description, status, sort, parentId, type, createdAt, updatedAt)
VALUES ('服务设施', 2, 'serviceFacility', '', 'serviceSuggestions/serviceFacility', '卫生间/吸烟区等设施点位配置', 1, 1, 167, 2, NOW(), NOW());
