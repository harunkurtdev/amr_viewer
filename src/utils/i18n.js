/**
 * 国际化工具 - 支持中文和英文
 */

// 获取版本号（构建时会替换为实际版本号）
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

export const translations = {
    'zh-CN': {
        // 顶部控制栏
        'visual': '视觉',
        'collision': '碰撞',
        'com': '质心',
        'inertia': '惯量',
        'axes': '坐标轴',
        'jointAxes': '关节轴',
        'shadow': '阴影',
        'lighting': '光照',
        'files': '文件',
        'joints': '关节',
        'structure': '结构',
        'edit': '编辑',
        'help': '帮助',
        'theme': '主题',
        'language': '语言',

        // 面板标题
        'fileList': '文件',
        'jointControl': '关节',
        'modelStructure': '结构',
        'codeEditor': '编辑',

        // 关节控制
        'radian': '弧度',
        'degree': '角度',
        'reset': '重置',
        'limits': '限位',

        // MuJoCo 仿真
        'mujocoReset': '重置',
        'mujocoSimulate': '仿真',
        'mujocoPause': '暂停',

        // 代码编辑器
        'reload': '重新加载',
        'download': '下载',
        'saved': '已保存',
        'unsaved': '未保存',
        'noFileOpen': '未打开文件',

        // 帮助对话框
        'helpTitle': `Robot Viewer v${APP_VERSION}`,
        'about': '关于',
        'aboutContent': 'Robot Viewer 是一个基于 Three.js 的网页端机器人模型 3D 查看器，提供直观的可视化界面，帮助您在浏览器中查看和分析机器人的结构、关节和物理属性，无需安装任何软件。<br><br>格式支持：URDF、Xacro、MJCF、USD（部分支持）<br>机器人类型：串联机器人结构（暂不支持并联机器人）<br><br>由 <strong>范子琦</strong> 开发。',
        'projectHome': '项目主页',
        'email': '邮箱',
        'myGithub': '我的GitHub',
        'operations': '操作指南',
        'leftDrag': '左键拖动',
        'rotateView': '旋转视角',
        'rightDrag': '右键拖动',
        'panView': '平移视角',
        'scroll': '滚轮',
        'zoom': '缩放视图',
        'clickModel': '点击模型',
        'controlJoint': '控制关节（可拖动）',
        'dragFile': '拖拽文件',
        'loadModel': '加载机器人模型',
        'contact': '联系方式',
        'support': '支持',

        // 其他
        'noFolder': '未加载文件夹',
        'noModel': '未加载模型',
        'load': '加载',
        'loadFiles': '加载文件',
        'loadFolder': '加载文件夹',
        'orClickButton': '或点击下面的按钮加载',
        'noControllableJoints': '未找到可控制关节',
        'clickToEditMin': '点击编辑下限',
        'clickToEditMax': '点击编辑上限',
        'dropHint': '拖拽机器人模型文件或文件夹到页面任意位置',
        'dropHintSub': '支持 URDF, Xacro, MJCF 格式<br>支持拖拽文件夹以加载mesh文件',
        'graphHint': '拖动: 移动 | 滚轮: 缩放 | 右键: 隐藏/显示 | Ctrl+左键: 测量',
        'copyright': '© 2025 范子琦 版权所有。',

        // 模型信息
        'type': '类型',
        'links': 'Links',
        'joints': '关节',
        'controllable': '可控',
        'rootLink': '根Link',

        // 悬浮信息
        'linkName': 'Link名称',
        'jointName': '关节',
        'mass': '质量',
        'mergedLinks': '合并的Links',

        // 文件类型
        'model': '模型',
        'mesh': '网格',
        'link': '链接',

        // 单位
        'kg': 'kg',
        'rad': 'rad',
        'deg': 'deg',
        'm': 'm',

        // 状态消息
        'loading': '正在加载',
        'unsupportedFormat': '不支持的文件格式',
        'loadFailed': '加载失败',
        'noSupportedFiles': '未找到支持的文件（URDF, Xacro, MJCF, DAE, STL, OBJ）',
        'loadSuccess': '模型加载成功',
        'cannotLoadMesh': '无法加载 mesh 文件',

        // 编辑器消息
        'unsavedChanges': '您有未保存的更改，确定要关闭吗？',
        'newFile': '新文件.xml',
        'noFileToReload': '没有可重新加载的文件',
        'saveFirst': '请先保存为文件后再加载',
        'reloadingModel': '正在重新加载模型...',
        'modelReloaded': '模型已重新加载（未保存）',
        'reloadFailed': '重新加载失败',
        'downloadFailed': '下载失败',
        'fileDownloaded': '文件已下载',
        'emptyContent': '编辑器内容为空，无法加载',
        'fileType': '文件类型',

        // Nav2 编辑器
        'nav2': 'Nav2',
        'nav2Title': 'Nav2 编辑器',
        'nav2BaseFrame': '基坐标系',
        'nav2BaseLink': '基础 link',
        'nav2OdomFrame': '里程计坐标系',
        'nav2BaseOffset': '偏移 (x, y, yaw)',
        'nav2TransformTolerance': '变换容差',
        'nav2SourceTimeout': '源超时',
        'nav2Footprint': '轮廓 (Footprint)',
        'nav2FootprintMode': '模式',
        'nav2Radius': '半径',
        'nav2Polygon': '多边形',
        'nav2Polygons': '碰撞多边形',
        'nav2AddPolygon': '+ 多边形',
        'nav2AddCircle': '+ 圆形',
        'nav2NoPolygons': '暂无多边形。',
        'nav2Selected': '已选择',
        'nav2Name': '名称',
        'nav2ActionType': '动作类型',
        'nav2SlowdownRatio': '减速比',
        'nav2LinearLimit': '线速度限制',
        'nav2AngularLimit': '角速度限制',
        'nav2TimeBeforeCollision': '碰撞前时间',
        'nav2SimTimeStep': '仿真时间步长',
        'nav2MinPoints': '最小点数',
        'nav2Visualize': '可视化',
        'nav2Enabled': '启用',
        'nav2Delete': '删除多边形',
        'nav2Points': '点',
        'nav2Edit': '在画布上编辑',
        'nav2EditOn': '编辑中 ✓',
        'nav2Draw': '绘制点',
        'nav2DrawOn': '绘制中 ✓',
        'nav2Reset': '重置',
        'nav2EditHint': '拖动白色控制点移动 · 点击蓝色中点插入顶点 · 右键删除 · 绘制模式: 点击地面添加。',
        'nav2Costmap': '代价地图',
        'nav2UseFootprint': '使用轮廓多边形',
        'nav2RobotRadius': '机器人半径',
        'nav2InflationRadius': '膨胀半径',
        'nav2CostScaling': '代价缩放因子',
        'nav2Resolution': '分辨率',
        'nav2Export': '导出',
        'nav2ExportCollision': 'collision_monitor.yaml',
        'nav2ExportCostmap': 'costmap.yaml',
        'nav2SaveProject': '保存项目 (.json)',
        'nav2LoadProject': '加载项目',
        'nav2Preview': '预览 YAML',
        'nav2Controller': '控制器 / 驱动',
        'nav2DriveType': '驱动模型',
        'nav2ControllerPlugin': '控制器',
        'nav2DwbCarWarn': 'DWB 不适合阿克曼/类车机器人 — 建议使用 RPP 或 MPPI。',
        'nav2MaxVelX': '最大线速度 (m/s)',
        'nav2MaxVelTheta': '最大角速度 (rad/s)',
        'nav2MaxAccel': '最大加速度 (m/s²)',
        'nav2DesiredVel': '期望线速度',
        'nav2Lookahead': '前视距离 (m)',
        'nav2AllowReversing': '允许倒车',
        'nav2MinTurnRadius': '最小转弯半径 (m)',
        'nav2ExportController': 'controller_server.yaml',
        'nav2FootprintShared': '代价地图使用下方的轮廓多边形（与"轮廓"部分相同）。',
        'selectFileToLoad': '请在文件树中选择要加载的文件',
        'filesFound': '个文件',
        'diagEmpty': '模型没有 link。这可能是组件/宏库文件 — 请从文件树中选择主机器人文件。',
        'diagNoMeshes': '未解析到可见几何体。请加载整个功能包文件夹以便找到网格文件（STL/DAE），或检查 package:// 路径。',
        'nav2Wheelbase': '轴距 (m)',
        'nav2DriveJoints': '驱动关节',
        'nav2SteeringJoints': '转向关节',
        'nav2NoJoints': '无可动关节（请先加载模型）。',
        'nav2PathPreview': '路径预览',
        'nav2ShowPath': '显示预测路径',
        'nav2PreviewDistance': '预览距离 (m)',
        'nav2SteerAngle': '转向角',
        'nav2ReadJointAngle': '从关节读取',
        'nav2PathStraightHint': '差速/全向：路径显示为直线前进。',
        'nav2AutoFootprint': '从机器人自动生成',
        'nav2AutoFail': '无法测量几何体',
        'nav2AutoDetect': '从机器人自动检测',
        'nav2DetectGuess': '最佳猜测 — 请核对',
        'nav2Planner': '全局规划器',
        'nav2PlannerAuto': '自动（按驱动）',
        'nav2ExportBundle': '⬇ 完整 Nav2 包 (.zip)',
        'nav2ExportParams': 'nav2_params.yaml',
        'nav2ExportRos2Control': 'ros2_controllers.yaml',
        'nav2Zones': '区域（代价地图过滤器）',
        'nav2AddKeepout': '+ 禁行区',
        'nav2AddSpeed': '+ 限速区',
        'nav2NoZones': '暂无区域。Keepout/限速区位于 map 坐标系。',
        'nav2SpeedLimit': '限速 (%)',
        'nav2Project': '⤓ 地面投影轮廓',
        'nav2ProjectLayer': '投影图层',
        'nav2LayerVisual': '视觉',
        'nav2LayerCollision': '碰撞',
        'nav2FpScale': '缩放 (×)',
        'nav2FpMargin': '外扩 (m)',
        'nav2ProjectNote': '轮廓 = 机器人的向下投影，按缩放/外扩放大。',
        'nav2ProjectDetail': '细节',
        'nav2DetailOutline': '详细轮廓',
        'nav2DetailHull': '凸包',
        'nav2ExportSvg': '⬇ 俯视图 (.svg)',
        'nav2Sim': '仿真',
        'nav2SimEta': '时长',
        'nav2SimPlay': '仿真',
        'nav2SimStop': '停止',
    },
    'en-US': {
        // Top control bar
        'visual': 'Visual',
        'collision': 'Collision',
        'com': 'COM',
        'inertia': 'Inertia',
        'axes': 'Axes',
        'jointAxes': 'Joint Axes',
        'shadow': 'Shadow',
        'lighting': 'Lighting',
        'files': 'Files',
        'joints': 'Joints',
        'structure': 'Structure',
        'edit': 'Edit',
        'help': 'Help',
        'theme': 'Theme',
        'language': 'Language',

        // Panel titles
        'fileList': 'Files',
        'jointControl': 'Joints',
        'modelStructure': 'Structure',
        'codeEditor': 'Editor',

        // Joint control
        'radian': 'Radian',
        'degree': 'Degree',
        'reset': 'Reset',
        'limits': 'Limits',

        // MuJoCo simulation
        'mujocoReset': 'Reset',
        'mujocoSimulate': 'Simulate',
        'mujocoPause': 'Pause',

        // Code editor
        'reload': 'Reload',
        'download': 'Download',
        'saved': 'Saved',
        'unsaved': 'Unsaved',
        'noFileOpen': 'No File Open',

        // Help dialog
        'helpTitle': `Robot Viewer v${APP_VERSION}`,
        'about': 'About',
        'aboutContent': 'Robot Viewer is a web-based 3D viewer for robot models and scenes. Built on top of Three.js, it provides an intuitive interface for visualizing, editing, and simulating robots directly in the browser without any installation required. This tool helps you visualize and analyze robot structures, joints, and physical properties.<br><br>Format Support: URDF, Xacro, MJCF, USD (partial support)<br>Robot Types: Serial robot structures (parallel robots not currently supported)<br><br>Developed by <strong>Ziqi Fan</strong>.',
        'projectHome': 'Project Home',
        'email': 'Email',
        'myGithub': 'My GitHub',
        'operations': 'Operations',
        'leftDrag': 'Left Drag',
        'rotateView': 'Rotate View',
        'rightDrag': 'Right Drag',
        'panView': 'Pan View',
        'scroll': 'Scroll',
        'zoom': 'Zoom',
        'clickModel': 'Click Model',
        'controlJoint': 'Control Joint (Draggable)',
        'dragFile': 'Drag File',
        'loadModel': 'Load Robot Model',
        'contact': 'Contact',
        'support': 'Support',

        // Others
        'noFolder': 'No Folder Loaded',
        'noModel': 'No Model Loaded',
        'load': 'Load',
        'loadFiles': 'Load Files',
        'loadFolder': 'Load Folder',
        'orClickButton': 'or click the button below to load',
        'noControllableJoints': 'No Controllable Joints Found',
        'clickToEditMin': 'Click to edit minimum',
        'clickToEditMax': 'Click to edit maximum',
        'dropHint': 'Drag and drop robot model files or folders anywhere',
        'dropHintSub': 'Supports URDF, Xacro, MJCF formats<br>Supports folder dragging to load mesh files',
        'graphHint': 'Drag: Move | Scroll: Zoom | Right-click: Hide/Show | Ctrl+Click: Measure',
        'copyright': '© 2025 Ziqi Fan. All rights reserved.',

        // Model info
        'type': 'Type',
        'links': 'Links',
        'joints': 'Joints',
        'controllable': 'Controllable',
        'rootLink': 'Root Link',

        // Hover info
        'linkName': 'Link Name',
        'jointName': 'Joint',
        'mass': 'Mass',
        'mergedLinks': 'Merged Links',

        // File types
        'model': 'Model',
        'mesh': 'Mesh',
        'link': 'Link',

        // Units
        'kg': 'kg',
        'rad': 'rad',
        'deg': 'deg',
        'm': 'm',

        // Status messages
        'loading': 'Loading',
        'unsupportedFormat': 'Unsupported file format',
        'loadFailed': 'Load failed',
        'noSupportedFiles': 'No supported files found (URDF, Xacro, MJCF, DAE, STL, OBJ)',
        'loadSuccess': 'Model loaded successfully',
        'cannotLoadMesh': 'Cannot load mesh file',

        // Editor messages
        'unsavedChanges': 'You have unsaved changes. Are you sure you want to close?',
        'newFile': 'newfile.xml',
        'noFileToReload': 'No file to reload',
        'saveFirst': 'Please save the file first before loading',
        'reloadingModel': 'Reloading model...',
        'modelReloaded': 'Model reloaded (unsaved)',
        'reloadFailed': 'Reload failed',
        'downloadFailed': 'Download failed',
        'fileDownloaded': 'File downloaded',
        'emptyContent': 'Editor content is empty, cannot load',
        'fileType': 'File Type',

        // Nav2 editor
        'nav2': 'Nav2',
        'nav2Title': 'Nav2 Editor',
        'nav2BaseFrame': 'Base Frame',
        'nav2BaseLink': 'Base link',
        'nav2OdomFrame': 'Odom frame',
        'nav2BaseOffset': 'Offset (x, y, yaw)',
        'nav2TransformTolerance': 'Transform tolerance',
        'nav2SourceTimeout': 'Source timeout',
        'nav2Footprint': 'Footprint',
        'nav2FootprintMode': 'Mode',
        'nav2Radius': 'Radius',
        'nav2Polygon': 'Polygon',
        'nav2Polygons': 'Collision Polygons',
        'nav2AddPolygon': '+ Polygon',
        'nav2AddCircle': '+ Circle',
        'nav2NoPolygons': 'No polygons yet.',
        'nav2Selected': 'Selected',
        'nav2Name': 'Name',
        'nav2ActionType': 'Action type',
        'nav2SlowdownRatio': 'Slowdown ratio',
        'nav2LinearLimit': 'Linear limit',
        'nav2AngularLimit': 'Angular limit',
        'nav2TimeBeforeCollision': 'Time before collision',
        'nav2SimTimeStep': 'Simulation time step',
        'nav2MinPoints': 'Min points',
        'nav2Visualize': 'Visualize',
        'nav2Enabled': 'Enabled',
        'nav2Delete': 'Delete polygon',
        'nav2Points': 'Points',
        'nav2Edit': 'Edit on canvas',
        'nav2EditOn': 'Editing ✓',
        'nav2Draw': 'Draw points',
        'nav2DrawOn': 'Drawing ✓',
        'nav2Reset': 'Reset',
        'nav2EditHint': 'Drag white handles to move · click a blue midpoint to insert a vertex · right-click to delete · Draw: click ground to add.',
        'nav2Costmap': 'Costmap',
        'nav2UseFootprint': 'Use footprint polygon',
        'nav2RobotRadius': 'Robot radius',
        'nav2InflationRadius': 'Inflation radius',
        'nav2CostScaling': 'Cost scaling factor',
        'nav2Resolution': 'Resolution',
        'nav2Export': 'Export',
        'nav2ExportCollision': 'collision_monitor.yaml',
        'nav2ExportCostmap': 'costmap.yaml',
        'nav2SaveProject': 'Save project (.json)',
        'nav2LoadProject': 'Load project',
        'nav2Preview': 'Preview YAML',
        'nav2Controller': 'Controller / Drive',
        'nav2DriveType': 'Drive model',
        'nav2ControllerPlugin': 'Controller',
        'nav2DwbCarWarn': 'DWB is not ideal for car-like robots — prefer RPP or MPPI.',
        'nav2MaxVelX': 'Max linear vel (m/s)',
        'nav2MaxVelTheta': 'Max angular vel (rad/s)',
        'nav2MaxAccel': 'Max accel (m/s²)',
        'nav2DesiredVel': 'Desired linear vel',
        'nav2Lookahead': 'Lookahead dist (m)',
        'nav2AllowReversing': 'Allow reversing',
        'nav2MinTurnRadius': 'Min turning radius (m)',
        'nav2ExportController': 'controller_server.yaml',
        'nav2FootprintShared': 'Costmap uses the footprint polygon below (same as the Footprint section).',
        'selectFileToLoad': 'Pick a file from the tree to load',
        'filesFound': 'files found',
        'diagEmpty': 'Model has no links. This may be a component/macro library file — pick the main robot file from the tree.',
        'diagNoMeshes': 'No visual geometry resolved. Load the whole package folder so mesh files (STL/DAE) are found, or check package:// paths.',
        'nav2Wheelbase': 'Wheelbase (m)',
        'nav2DriveJoints': 'Drive joints',
        'nav2SteeringJoints': 'Steering joints',
        'nav2NoJoints': 'No movable joints (load a model first).',
        'nav2PathPreview': 'Path preview',
        'nav2ShowPath': 'Show predicted path',
        'nav2PreviewDistance': 'Preview distance (m)',
        'nav2SteerAngle': 'Steering angle',
        'nav2ReadJointAngle': 'Read from joint',
        'nav2PathStraightHint': 'Differential / holonomic: path shown straight ahead.',
        'nav2AutoFootprint': 'Auto from robot',
        'nav2AutoFail': 'Could not measure geometry',
        'nav2AutoDetect': 'Auto-detect from robot',
        'nav2DetectGuess': 'Best guess — please verify',
        'nav2Planner': 'Planner',
        'nav2PlannerAuto': 'Auto (by drive)',
        'nav2ExportBundle': '⬇ Full Nav2 bundle (.zip)',
        'nav2ExportParams': 'nav2_params.yaml',
        'nav2ExportRos2Control': 'ros2_controllers.yaml',
        'nav2Zones': 'Zones (Costmap Filters)',
        'nav2AddKeepout': '+ Keepout',
        'nav2AddSpeed': '+ Speed limit',
        'nav2NoZones': 'No zones. Keepout/speed zones are in the map frame.',
        'nav2SpeedLimit': 'Speed limit (%)',
        'nav2Project': '⤓ Ground projection footprint',
        'nav2ProjectLayer': 'Projection layer',
        'nav2LayerVisual': 'Visual',
        'nav2LayerCollision': 'Collision',
        'nav2FpScale': 'Scale (×)',
        'nav2FpMargin': 'Margin (m)',
        'nav2ProjectNote': 'Footprint = downward projection of the robot, expanded by scale/margin.',
        'nav2ProjectDetail': 'Detail',
        'nav2DetailOutline': 'Detailed outline',
        'nav2DetailHull': 'Convex hull',
        'nav2ExportSvg': '⬇ Top view (.svg)',
        'nav2Sim': 'Simulation',
        'nav2SimEta': 'Duration',
        'nav2SimPlay': 'Simulate',
        'nav2SimStop': 'Stop',
    },
    'tr-TR': {
        // Üst kontrol çubuğu
        'visual': 'Görsel',
        'collision': 'Çarpışma',
        'com': 'Kütle Merkezi',
        'inertia': 'Atalet',
        'axes': 'Eksenler',
        'jointAxes': 'Eklem Eksenleri',
        'shadow': 'Gölge',
        'lighting': 'Aydınlatma',
        'files': 'Dosyalar',
        'joints': 'Eklemler',
        'structure': 'Yapı',
        'edit': 'Düzenle',
        'help': 'Yardım',
        'theme': 'Tema',
        'language': 'Dil',

        // Panel başlıkları
        'fileList': 'Dosyalar',
        'jointControl': 'Eklemler',
        'modelStructure': 'Yapı',
        'codeEditor': 'Düzenleyici',

        // Eklem kontrolü
        'radian': 'Radyan',
        'degree': 'Derece',
        'reset': 'Sıfırla',
        'limits': 'Limitler',

        // MuJoCo simülasyon
        'mujocoReset': 'Sıfırla',
        'mujocoSimulate': 'Simüle Et',
        'mujocoPause': 'Duraklat',

        // Kod düzenleyici
        'reload': 'Yeniden Yükle',
        'download': 'İndir',
        'saved': 'Kaydedildi',
        'unsaved': 'Kaydedilmedi',
        'noFileOpen': 'Dosya Açık Değil',

        // Yardım iletişim kutusu
        'helpTitle': `Nav2 Editor v${APP_VERSION}`,
        'about': 'Hakkında',
        'aboutContent': 'Nav2 Editor, robotlarınız için web tabanlı bir Nav2 yapılandırma editörüdür. Three.js tabanlı Robot Viewer üzerine kurulmuştur; URDF/Xacro/SDF modellerini tarayıcıda içe aktarıp Collision Monitor poligonları, footprint ve costmap parametrelerini görsel olarak düzenleyip Nav2 YAML olarak dışa aktarmanızı sağlar.<br><br>Format desteği: URDF, Xacro, SDF, MJCF, USD (kısmi)<br><br>Robot Viewer temeli: <strong>Ziqi Fan</strong>.',
        'projectHome': 'Proje Sayfası',
        'email': 'E-posta',
        'myGithub': 'GitHub',
        'operations': 'Kontroller',
        'leftDrag': 'Sol Tık Sürükle',
        'rotateView': 'Görünümü Döndür',
        'rightDrag': 'Sağ Tık Sürükle',
        'panView': 'Görünümü Kaydır',
        'scroll': 'Tekerlek',
        'zoom': 'Yakınlaştır',
        'clickModel': 'Modele Tıkla',
        'controlJoint': 'Eklemi Kontrol Et (Sürüklenebilir)',
        'dragFile': 'Dosya Sürükle',
        'loadModel': 'Robot Modeli Yükle',
        'contact': 'İletişim',
        'support': 'Destek',

        // Diğer
        'noFolder': 'Klasör Yüklenmedi',
        'noModel': 'Model Yüklenmedi',
        'load': 'Yükle',
        'loadFiles': 'Dosya Yükle',
        'loadFolder': 'Klasör Yükle',
        'orClickButton': 'veya yüklemek için aşağıdaki düğmeye tıklayın',
        'noControllableJoints': 'Kontrol Edilebilir Eklem Bulunamadı',
        'clickToEditMin': 'Alt limiti düzenlemek için tıklayın',
        'clickToEditMax': 'Üst limiti düzenlemek için tıklayın',
        'dropHint': 'Robot modeli dosyalarını veya klasörlerini sayfanın herhangi bir yerine sürükleyin',
        'dropHintSub': 'URDF, Xacro, SDF, MJCF formatları desteklenir<br>Mesh dosyaları için klasör sürükleyebilirsiniz',
        'graphHint': 'Sürükle: Taşı | Tekerlek: Yakınlaştır | Sağ tık: Gizle/Göster | Ctrl+Tık: Ölç',
        'copyright': '© 2025 Nav2 Editor.',

        // Model bilgisi
        'type': 'Tür',
        'links': 'Linkler',
        'controllable': 'Kontrol edilebilir',
        'rootLink': 'Kök Link',

        // Üzerine gelince bilgi
        'linkName': 'Link Adı',
        'jointName': 'Eklem',
        'mass': 'Kütle',
        'mergedLinks': 'Birleştirilmiş Linkler',

        // Dosya türleri
        'model': 'Model',
        'mesh': 'Mesh',
        'link': 'Link',

        // Birimler
        'kg': 'kg',
        'rad': 'rad',
        'deg': 'deg',
        'm': 'm',

        // Durum mesajları
        'loading': 'Yükleniyor',
        'unsupportedFormat': 'Desteklenmeyen dosya formatı',
        'loadFailed': 'Yükleme başarısız',
        'noSupportedFiles': 'Desteklenen dosya bulunamadı (URDF, Xacro, SDF, MJCF, DAE, STL, OBJ)',
        'loadSuccess': 'Model başarıyla yüklendi',
        'cannotLoadMesh': 'Mesh dosyası yüklenemedi',

        // Düzenleyici mesajları
        'unsavedChanges': 'Kaydedilmemiş değişiklikleriniz var. Kapatmak istediğinize emin misiniz?',
        'newFile': 'yenidosya.xml',
        'noFileToReload': 'Yeniden yüklenecek dosya yok',
        'saveFirst': 'Yüklemeden önce lütfen dosyayı kaydedin',
        'reloadingModel': 'Model yeniden yükleniyor...',
        'modelReloaded': 'Model yeniden yüklendi (kaydedilmedi)',
        'reloadFailed': 'Yeniden yükleme başarısız',
        'downloadFailed': 'İndirme başarısız',
        'fileDownloaded': 'Dosya indirildi',
        'emptyContent': 'Düzenleyici içeriği boş, yüklenemiyor',
        'fileType': 'Dosya Türü',

        // Nav2 editör
        'nav2': 'Nav2',
        'nav2Title': 'Nav2 Editör',
        'nav2BaseFrame': 'Taban Çerçevesi',
        'nav2BaseLink': 'Taban link',
        'nav2OdomFrame': 'Odom çerçevesi',
        'nav2BaseOffset': 'Ofset (x, y, yaw)',
        'nav2TransformTolerance': 'Dönüşüm toleransı',
        'nav2SourceTimeout': 'Kaynak zaman aşımı',
        'nav2Footprint': 'Footprint (Ayak izi)',
        'nav2FootprintMode': 'Mod',
        'nav2Radius': 'Yarıçap',
        'nav2Polygon': 'Poligon',
        'nav2Polygons': 'Çarpışma Poligonları',
        'nav2AddPolygon': '+ Poligon',
        'nav2AddCircle': '+ Daire',
        'nav2NoPolygons': 'Henüz poligon yok.',
        'nav2Selected': 'Seçili',
        'nav2Name': 'Ad',
        'nav2ActionType': 'Eylem türü',
        'nav2SlowdownRatio': 'Yavaşlama oranı',
        'nav2LinearLimit': 'Doğrusal limit',
        'nav2AngularLimit': 'Açısal limit',
        'nav2TimeBeforeCollision': 'Çarpışmaya kalan süre',
        'nav2SimTimeStep': 'Simülasyon zaman adımı',
        'nav2MinPoints': 'Min nokta',
        'nav2Visualize': 'Görselleştir',
        'nav2Enabled': 'Etkin',
        'nav2Delete': 'Poligonu sil',
        'nav2Points': 'Noktalar',
        'nav2Edit': 'Sahnede düzenle',
        'nav2EditOn': 'Düzenleniyor ✓',
        'nav2Draw': 'Nokta çiz',
        'nav2DrawOn': 'Çiziliyor ✓',
        'nav2Reset': 'Sıfırla',
        'nav2EditHint': 'Beyaz tutamaçları sürükle · araya nokta için mavi orta noktaya tıkla · silmek için sağ tıkla · Çizim: zemine tıkla.',
        'nav2Costmap': 'Costmap',
        'nav2UseFootprint': 'Footprint poligonu kullan',
        'nav2RobotRadius': 'Robot yarıçapı',
        'nav2InflationRadius': 'Şişirme yarıçapı',
        'nav2CostScaling': 'Maliyet ölçek faktörü',
        'nav2Resolution': 'Çözünürlük',
        'nav2Export': 'Dışa Aktar',
        'nav2ExportCollision': 'collision_monitor.yaml',
        'nav2ExportCostmap': 'costmap.yaml',
        'nav2SaveProject': 'Projeyi kaydet (.json)',
        'nav2LoadProject': 'Proje yükle',
        'nav2Preview': 'YAML önizle',
        'nav2Controller': 'Sürücü / Kontrolcü',
        'nav2DriveType': 'Sürüş modeli',
        'nav2ControllerPlugin': 'Kontrolcü',
        'nav2DwbCarWarn': 'DWB araç tipi (Ackermann/4WS) robotlara uygun değil — RPP veya MPPI tercih edin.',
        'nav2MaxVelX': 'Maks. doğrusal hız (m/s)',
        'nav2MaxVelTheta': 'Maks. açısal hız (rad/s)',
        'nav2MaxAccel': 'Maks. ivme (m/s²)',
        'nav2DesiredVel': 'Hedef doğrusal hız',
        'nav2Lookahead': 'İleri bakış mesafesi (m)',
        'nav2AllowReversing': 'Geri gitmeye izin ver',
        'nav2MinTurnRadius': 'Min. dönüş yarıçapı (m)',
        'nav2ExportController': 'controller_server.yaml',
        'nav2FootprintShared': 'Costmap, aşağıdaki footprint poligonunu kullanır (Footprint bölümüyle aynı).',
        'selectFileToLoad': 'Yüklemek için ağaçtan bir dosya seçin',
        'filesFound': 'dosya bulundu',
        'diagEmpty': 'Modelde hiç link yok. Bu bir bileşen/makro kütüphane dosyası olabilir — ağaçtan ana robot dosyasını seçin.',
        'diagNoMeshes': 'Görünür geometri çözülemedi. Mesh dosyalarının (STL/DAE) bulunabilmesi için paket klasörünün tamamını yükleyin veya package:// yollarını kontrol edin.',
        'nav2Wheelbase': 'Dingil mesafesi (m)',
        'nav2DriveJoints': 'Tahrik eklemleri',
        'nav2SteeringJoints': 'Direksiyon eklemleri',
        'nav2NoJoints': 'Hareketli eklem yok (önce model yükleyin).',
        'nav2PathPreview': 'Yol önizleme',
        'nav2ShowPath': 'Tahmini yolu göster',
        'nav2PreviewDistance': 'Önizleme mesafesi (m)',
        'nav2SteerAngle': 'Direksiyon açısı',
        'nav2ReadJointAngle': 'Eklemden oku',
        'nav2PathStraightHint': 'Diferansiyel / holonomik: yol düz ileri gösterilir.',
        'nav2AutoFootprint': 'Robottan otomatik',
        'nav2AutoFail': 'Geometri ölçülemedi',
        'nav2AutoDetect': 'Robottan otomatik algıla',
        'nav2DetectGuess': 'En iyi tahmin — lütfen doğrulayın',
        'nav2Planner': 'Planlayıcı',
        'nav2PlannerAuto': 'Otomatik (sürüşe göre)',
        'nav2ExportBundle': '⬇ Tam Nav2 paketi (.zip)',
        'nav2ExportParams': 'nav2_params.yaml',
        'nav2ExportRos2Control': 'ros2_controllers.yaml',
        'nav2Zones': 'Bölgeler (Costmap Filtreleri)',
        'nav2AddKeepout': '+ Yasak bölge',
        'nav2AddSpeed': '+ Hız limiti',
        'nav2NoZones': 'Bölge yok. Keepout/hız bölgeleri map çerçevesindedir.',
        'nav2SpeedLimit': 'Hız limiti (%)',
        'nav2Project': '⤓ Yere iz düşüm footprint',
        'nav2ProjectLayer': 'İz düşüm katmanı',
        'nav2LayerVisual': 'Görsel',
        'nav2LayerCollision': 'Çarpışma',
        'nav2FpScale': 'Ölçek (×)',
        'nav2FpMargin': 'Pay (m)',
        'nav2ProjectNote': 'Footprint = robotun yere dik iz düşümü, ölçek/pay ile genişletilir.',
        'nav2ProjectDetail': 'Detay',
        'nav2DetailOutline': 'Detaylı dış hat',
        'nav2DetailHull': 'Dışbükey zarf',
        'nav2ExportSvg': '⬇ Üstten görünüm (.svg)',
        'nav2Sim': 'Simülasyon',
        'nav2SimEta': 'Süre',
        'nav2SimPlay': 'Simüle et',
        'nav2SimStop': 'Durdur',
    }
};

class I18n {
    constructor() {
        // 检测浏览器语言
        const browserLang = this.detectBrowserLanguage();
        // 从localStorage读取语言设置，如果没有则使用浏览器语言
        this.currentLang = localStorage.getItem('language') || browserLang;
    }

    /**
     * 检测浏览器语言
     */
    detectBrowserLanguage() {
        const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
        // Turkish browsers default to Turkish
        if (lang.startsWith('tr')) {
            return 'tr-TR';
        }
        // Chinese browsers (zh, zh-CN, zh-TW, ...) default to Chinese
        if (lang.startsWith('zh')) {
            return 'zh-CN';
        }
        // Otherwise default to English
        return 'en-US';
    }

    /**
     * 获取翻译文本
     */
    t(key) {
        const lang = translations[this.currentLang] || translations['zh-CN'];
        return lang[key] || key;
    }

    /**
     * 切换语言
     */
    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('language', lang);
            this.updatePageLanguage();
        }
    }

    /**
     * 获取当前语言
     */
    getCurrentLanguage() {
        return this.currentLang;
    }

    /**
     * 更新页面上所有带有data-i18n属性的元素
     */
    updatePageLanguage() {
        // 更新所有带有data-i18n属性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const text = this.t(key);

            // 如果是input或textarea，更新placeholder
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = text;
            } else {
                // 如果包含HTML标签（如<br>），使用innerHTML
                if (text.includes('<br>') || text.includes('<strong>')) {
                    element.innerHTML = text;
                } else {
                    element.textContent = text;
                }
            }
        });

        // 更新HTML lang属性
        document.documentElement.lang = this.currentLang;
    }

    /**
     * 初始化页面语言
     */
    init() {
        this.updatePageLanguage();
    }
}

// 创建全局实例
export const i18n = new I18n();


