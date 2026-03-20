const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database');

function ensureDir() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }
}

function read(file) {
  ensureDir();
  const filepath = path.join(DB_PATH, `${file}.json`);
  if (!fs.existsSync(filepath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function write(file, data) {
  ensureDir();
  const filepath = path.join(DB_PATH, `${file}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// 初始化种子数据
function seed() {
  // 课程数据 - 25门
  const courses = [
    { id: 'CS101', name: '数据结构与算法', category: '计算机', credits: 3, hours: 48, maxStudents: 60, tags: ['核心', '必修'], description: '介绍常见数据结构与算法设计方法' },
    { id: 'CS102', name: '计算机组成原理', category: '计算机', credits: 3, hours: 48, maxStudents: 50, tags: ['核心', '必修'], description: '计算机硬件组成与工作原理' },
    { id: 'CS103', name: '操作系统', category: '计算机', credits: 3, hours: 48, maxStudents: 55, tags: ['核心', '必修'], description: '操作系统原理与实践' },
    { id: 'CS104', name: '计算机网络', category: '计算机', credits: 3, hours: 40, maxStudents: 60, tags: ['核心', '必修'], description: '网络协议与体系结构' },
    { id: 'CS105', name: '数据库系统', category: '计算机', credits: 3, hours: 44, maxStudents: 50, tags: ['核心', '必修'], description: '关系数据库理论与实践' },
    { id: 'CS106', name: '软件工程', category: '计算机', credits: 2, hours: 32, maxStudents: 45, tags: ['核心', '必修'], description: '软件开发方法学' },
    { id: 'CS201', name: '人工智能导论', category: '计算机', credits: 3, hours: 40, maxStudents: 40, tags: ['选修', '前沿'], description: 'AI基础理论与应用' },
    { id: 'CS202', name: '机器学习', category: '计算机', credits: 3, hours: 44, maxStudents: 35, tags: ['选修', '前沿'], description: '机器学习算法与应用' },
    { id: 'CS203', name: 'Web开发技术', category: '计算机', credits: 2, hours: 32, maxStudents: 50, tags: ['选修', '实践'], description: '现代Web前端开发' },
    { id: 'CS204', name: '移动应用开发', category: '计算机', credits: 2, hours: 32, maxStudents: 40, tags: ['选修', '实践'], description: 'iOS与Android开发' },
    { id: 'MATH101', name: '高等数学A(Ⅰ)', category: '数学', credits: 4, hours: 64, maxStudents: 80, tags: ['核心', '必修'], description: '微积分与极限理论' },
    { id: 'MATH102', name: '高等数学A(Ⅱ)', category: '数学', credits: 4, hours: 64, maxStudents: 75, tags: ['核心', '必修'], description: '多元函数微积分' },
    { id: 'MATH201', name: '线性代数', category: '数学', credits: 3, hours: 48, maxStudents: 70, tags: ['核心', '必修'], description: '矩阵与向量空间' },
    { id: 'MATH202', name: '概率论与数理统计', category: '数学', credits: 3, hours: 48, maxStudents: 60, tags: ['核心', '必修'], description: '概率论基础与统计分析' },
    { id: 'PHY101', name: '大学物理A(Ⅰ)', category: '物理', credits: 4, hours: 56, maxStudents: 70, tags: ['核心', '必修'], description: '力学与热学' },
    { id: 'PHY102', name: '大学物理A(Ⅱ)', category: '物理', credits: 4, hours: 56, maxStudents: 65, tags: ['核心', '必修'], description: '电磁学与光学' },
    { id: 'PHY201', name: '物理实验Ⅰ', category: '物理', credits: 1, hours: 16, maxStudents: 30, tags: ['核心', '必修'], description: '基础物理实验' },
    { id: 'ENG101', name: '大学英语(一)', category: '英语', credits: 3, hours: 48, maxStudents: 40, tags: ['核心', '必修'], description: '大学英语综合教程1' },
    { id: 'ENG102', name: '大学英语(二)', category: '英语', credits: 3, hours: 48, maxStudents: 40, tags: ['核心', '必修'], description: '大学英语综合教程2' },
    { id: 'ENG201', name: '学术英语写作', category: '英语', credits: 2, hours: 32, maxStudents: 35, tags: ['选修'], description: '学术论文写作技巧' },
    { id: 'POL101', name: '思想道德与法治', category: '政治', credits: 3, hours: 48, maxStudents: 100, tags: ['核心', '必修'], description: '思想政治理论' },
    { id: 'POL102', name: '中国近现代史纲要', category: '政治', credits: 3, hours: 40, maxStudents: 90, tags: ['核心', '必修'], description: '中国近现代历史' },
    { id: 'HIST101', name: '大学语文', category: '文科', credits: 2, hours: 32, maxStudents: 50, tags: ['通识', '必修'], description: '经典文学作品导读' },
    { id: 'ECON101', name: '微观经济学', category: '文科', credits: 3, hours: 48, maxStudents: 60, tags: ['选修'], description: '消费者与生产者行为' },
    { id: 'PE101', name: '体育(一)', category: '体育', credits: 1, hours: 32, maxStudents: 30, tags: ['核心', '必修'], description: '体育基础课程' }
  ];

  // 教师数据 - 15人
  const teachers = [
    { id: 'T001', name: '张伟', gender: '男', subject: '计算机', email: 'zhangwei@school.edu', phone: '13800138001', maxHours: 16, office: '教学楼A301', availableTimes: ['周一1-4', '周二1-4', '周三1-4', '周四1-4', '周五1-4'] },
    { id: 'T002', name: '李娜', gender: '女', subject: '计算机', email: 'lina@school.edu', phone: '13800138002', maxHours: 14, office: '教学楼A302', availableTimes: ['周一3-5', '周二1-4', '周三3-5', '周四1-4', '周五1-3'] },
    { id: 'T003', name: '王强', gender: '男', subject: '数学', email: 'wangqiang@school.edu', phone: '13800138003', maxHours: 18, office: '教学楼B201', availableTimes: ['周一1-5', '周二1-5', '周三1-5', '周四1-5', '周五1-3'] },
    { id: 'T004', name: '刘芳', gender: '女', subject: '数学', email: 'liufang@school.edu', phone: '13800138004', maxHours: 16, office: '教学楼B202', availableTimes: ['周一2-4', '周二2-4', '周三2-4', '周四2-4', '周五2-4'] },
    { id: 'T005', name: '陈明', gender: '男', subject: '物理', email: 'chenming@school.edu', phone: '13800138005', maxHours: 16, office: '实验楼C101', availableTimes: ['周一1-3', '周二1-4', '周三1-3', '周四1-4', '周五1-2'] },
    { id: 'T006', name: '赵雪', gender: '女', subject: '物理', email: 'zhaoxue@school.edu', phone: '13800138006', maxHours: 14, office: '实验楼C102', availableTimes: ['周一4-5', '周二3-5', '周三4-5', '周四3-5', '周五3-4'] },
    { id: 'T007', name: '周杰', gender: '男', subject: '英语', email: 'zhoujie@school.edu', phone: '13800138007', maxHours: 12, office: '外语楼501', availableTimes: ['周一1-3', '周二1-3', '周三1-3', '周四1-3', '周五1-3'] },
    { id: 'T008', name: '吴霞', gender: '女', subject: '英语', email: 'wuxia@school.edu', phone: '13800138008', maxHours: 12, office: '外语楼502', availableTimes: ['周一4-6', '周二4-6', '周三4-6', '周四4-6', '周五4-6'] },
    { id: 'T009', name: '郑勇', gender: '男', subject: '政治', email: 'zhengyong@school.edu', phone: '13800138009', maxHours: 14, office: '行政楼301', availableTimes: ['周一1-4', '周二1-4', '周三1-4', '周四1-4', '周五1-4'] },
    { id: 'T010', name: '孙丽', gender: '女', subject: '政治', email: 'sunli@school.edu', phone: '13800138010', maxHours: 12, office: '行政楼302', availableTimes: ['周一5-7', '周二5-7', '周三5-7', '周四5-7', '周五5-7'] },
    { id: 'T011', name: '黄磊', gender: '男', subject: '历史', email: 'huanglei@school.edu', phone: '13800138011', maxHours: 12, office: '文科院101', availableTimes: ['周一2-4', '周二2-4', '周三2-4', '周四2-4', '周五2-4'] },
    { id: 'T012', name: '林静', gender: '女', subject: '经济', email: 'linjing@school.edu', phone: '13800138012', maxHours: 14, office: '经管楼201', availableTimes: ['周一1-3', '周二1-3', '周三1-3', '周四1-3', '周五1-3'] },
    { id: 'T013', name: '杨涛', gender: '男', subject: '体育', email: 'yangtao@school.edu', phone: '13800138013', maxHours: 16, office: '体育馆103', availableTimes: ['周一3-5', '周二3-5', '周三3-5', '周四3-5', '周五3-5'] },
    { id: 'T014', name: '马超', gender: '男', subject: '计算机', email: 'machao@school.edu', phone: '13800138014', maxHours: 14, office: '教学楼A305', availableTimes: ['周一5-7', '周二5-7', '周三5-7', '周四5-7', '周五5-7'] },
    { id: 'T015', name: '朱敏', gender: '女', subject: '计算机', email: 'zhumin@school.edu', phone: '13800138015', maxHours: 12, office: '教学楼A306', availableTimes: ['周一1-2', '周二1-2', '周三1-2', '周四1-2', '周五1-2'] }
  ];

  // 教室数据 - 20间
  const classrooms = [
    { id: 'R001', name: 'A101', capacity: 60, building: '教学楼A', equipment: ['投影仪', '电脑', '音响', '空调'], type: '多媒体教室' },
    { id: 'R002', name: 'A102', capacity: 50, building: '教学楼A', equipment: ['投影仪', '电脑', '空调'], type: '多媒体教室' },
    { id: 'R003', name: 'A103', capacity: 45, building: '教学楼A', equipment: ['投影仪', '音响', '空调'], type: '普通教室' },
    { id: 'R004', name: 'A201', capacity: 80, building: '教学楼A', equipment: ['投影仪', '电脑', '音响', '空调', '麦克风'], type: '大型多媒体教室' },
    { id: 'R005', name: 'A202', capacity: 70, building: '教学楼A', equipment: ['投影仪', '电脑', '音响', '空调'], type: '多媒体教室' },
    { id: 'R006', name: 'B101', capacity: 60, building: '教学楼B', equipment: ['投影仪', '电脑', '音响', '空调'], type: '多媒体教室' },
    { id: 'R007', name: 'B102', capacity: 55, building: '教学楼B', equipment: ['投影仪', '空调'], type: '普通教室' },
    { id: 'R008', name: 'B103', capacity: 40, building: '教学楼B', equipment: ['投影仪', '电脑', '空调'], type: '多媒体教室' },
    { id: 'R009', name: 'B201', capacity: 100, building: '教学楼B', equipment: ['投影仪', '电脑', '音响', '空调', '麦克风', '录播'], type: '大型报告厅' },
    { id: 'R010', name: 'B202', capacity: 65, building: '教学楼B', equipment: ['投影仪', '电脑', '音响', '空调'], type: '多媒体教室' },
    { id: 'R011', name: 'C101', capacity: 30, building: '实验楼C', equipment: ['实验台', '电脑', '空调'], type: '计算机实验室' },
    { id: 'R012', name: 'C102', capacity: 30, building: '实验楼C', equipment: ['实验台', '电脑', '空调'], type: '计算机实验室' },
    { id: 'R013', name: 'C103', capacity: 25, building: '实验楼C', equipment: ['实验台', '仪器', '空调'], type: '物理实验室' },
    { id: 'R014', name: 'C104', capacity: 25, building: '实验楼C', equipment: ['实验台', '仪器', '空调'], type: '化学实验室' },
    { id: 'R015', name: 'D101', capacity: 35, building: '外语楼D', equipment: ['投影仪', '电脑', '音响', '空调', '语音设备'], type: '语音教室' },
    { id: 'R016', name: 'D102', capacity: 30, building: '外语楼D', equipment: ['投影仪', '电脑', '音响', '空调', '语音设备'], type: '语音教室' },
    { id: 'R017', name: 'E101', capacity: 50, building: '文科院E', equipment: ['投影仪', '空调'], type: '普通教室' },
    { id: 'R018', name: 'E102', capacity: 45, building: '文科院E', equipment: ['投影仪', '空调'], type: '普通教室' },
    { id: 'R019', name: 'GYM1', capacity: 50, building: '体育馆', equipment: ['空调', '、更衣室'], type: '室内体育场' },
    { id: 'R020', name: 'GYM2', capacity: 30, building: '体育馆', equipment: ['空调', '、更衣室'], type: '室内体育场' }
  ];

  // 学生数据 - 120人，4个班级，正常的2-3字名字
  const students = [];
  const classNames = ['计科22-1班', '计科22-2班', '软工22-1班', '数学22-1班'];
  
  const maleNames = ['张伟', '王强', '李磊', '刘浩', '陈鹏', '杨飞', '赵龙', '黄超', '周勇', '吴波', '徐辉', '孙鑫', '马宇', '朱涛', '胡明', '林华', '何刚', '罗平', '宋亮', '韩军', '唐凯', '冯健', '许晨', '蒋浩然', '苏子涵', '丁博文', '卢宇航', '魏梓豪', '姜家乐', '钱瑞哲'];
  const femaleNames = ['李娜', '王芳', '张丽', '刘敏', '陈静', '杨霞', '赵燕', '黄玲', '周娟', '吴红', '徐梅', '孙兰', '马雪', '朱颖', '胡倩', '林欣', '何雨', '罗晴', '宋雅', '韩琴', '唐秀英', '冯佳怡', '许思雨', '蒋诗涵', '苏欣悦', '丁梦琪', '卢雅婷', '魏娜', '姜丽', '钱静'];

  // 班级1: 计科22-1班 (30人)
  for (let i = 0; i < 30; i++) {
    const isMale = i % 2 === 0;
    const name = isMale ? maleNames[i] : femaleNames[i];
    students.push({
      id: `S${String(i + 1).padStart(3, '0')}`,
      name: name,
      gender: isMale ? '男' : '女',
      grade: '大二',
      major: '计算机科学与技术',
      class: '计科22-1班',
      classId: 'C001',
      phone: `138${String(10000000 + i).slice(-8)}`,
      email: `student${i + 1}@student.edu`
    });
  }

  // 班级2: 计科22-2班 (30人)
  for (let i = 0; i < 30; i++) {
    const isMale = i % 2 === 0;
    const name = isMale ? maleNames[(i + 10) % 30] : femaleNames[(i + 10) % 30];
    students.push({
      id: `S${String(i + 31).padStart(3, '0')}`,
      name: name,
      gender: isMale ? '男' : '女',
      grade: '大二',
      major: '计算机科学与技术',
      class: '计科22-2班',
      classId: 'C002',
      phone: `138${String(10000000 + i + 30).slice(-8)}`,
      email: `student${i + 31}@student.edu`
    });
  }

  // 班级3: 软工22-1班 (30人)
  for (let i = 0; i < 30; i++) {
    const isMale = i % 2 === 0;
    const name = isMale ? maleNames[(i + 20) % 30] : femaleNames[(i + 20) % 30];
    students.push({
      id: `S${String(i + 61).padStart(3, '0')}`,
      name: name,
      gender: isMale ? '男' : '女',
      grade: '大二',
      major: '软件工程',
      class: '软工22-1班',
      classId: 'C003',
      phone: `138${String(10000000 + i + 60).slice(-8)}`,
      email: `student${i + 61}@student.edu`
    });
  }

  // 班级4: 数学22-1班 (30人)
  for (let i = 0; i < 30; i++) {
    const isMale = i % 2 === 0;
    const name = isMale ? maleNames[(i + 5) % 30] : femaleNames[(i + 5) % 30];
    students.push({
      id: `S${String(i + 91).padStart(3, '0')}`,
      name: name,
      gender: isMale ? '男' : '女',
      grade: '大二',
      major: '数学与应用数学',
      class: '数学22-1班',
      classId: 'C004',
      phone: `138${String(10000000 + i + 90).slice(-8)}`,
      email: `student${i + 91}@student.edu`
    });
  }

  // 班级数据 - 4个班
  const classes = [
    { id: 'C001', name: '计科22-1班', major: '计算机科学与技术', grade: '大二', studentCount: 30 },
    { id: 'C002', name: '计科22-2班', major: '计算机科学与技术', grade: '大二', studentCount: 30 },
    { id: 'C003', name: '软工22-1班', major: '软件工程', grade: '大二', studentCount: 30 },
    { id: 'C004', name: '数学22-1班', major: '数学与应用数学', grade: '大二', studentCount: 30 }
  ];

  // 课表数据 - 初始为空，等待排课
  const schedules = [];

  // 保存数据
  write('courses', courses);
  write('teachers', teachers);
  write('students', students);
  write('classrooms', classrooms);
  write('classes', classes);
  write('schedules', schedules);

  console.log('✅ 种子数据已初始化');
  console.log(`   - 课程: ${courses.length} 门`);
  console.log(`   - 教师: ${teachers.length} 人`);
  console.log(`   - 学生: ${students.length} 人`);
  console.log(`   - 教室: ${classrooms.length} 间`);
  console.log(`   - 班级: ${classes.length} 个`);
  console.log(`   - 课表: ${schedules.length} 条`);
}

module.exports = {
  read,
  write,
  seed
};