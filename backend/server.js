const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 初始化数据（已重写为仅在首次运行时创建，后续重启不会清空数据）
// db.seed(); // 已禁用，数据持久化在文件中

// AI 模型配置
let aiModelConfig = {
  provider: 'codingplan', // 'openclaw', 'codingplan', 'ollama'
  model: 'qwen3-max-2026-01-23',
  apiKey: process.env.QWEN_API_KEY || 'sk-sp-8da761414a5545e8b2763ca4b6f17fd9'
};

// ===== 上下文存储（用于泛化）=====
let conversationContext = {
  lastTeachers: [],      // 上次提到的教师
  lastClass: null,       // 上次提到的班级
  lastCourse: null,      // 上次提到的课程
  lastIntent: null,      // 上次的意图
  lastParams: {},        // 上次的参数
  timestamp: null
};

// 更新上下文
function updateContext(intent, params) {
  if (params.teachers) conversationContext.lastTeachers = params.teachers;
  if (params.teacherName) conversationContext.lastTeachers = [params.teacherName];
  if (params.className) conversationContext.lastClass = params.className;
  if (params.courseName || params.courseId) conversationContext.lastCourse = params.courseName || params.courseId;
  conversationContext.lastIntent = intent;
  conversationContext.lastParams = params;
  conversationContext.timestamp = Date.now();
}

// 从上下文补全参数
function autoCompleteFromContext(params, intent) {
  const completed = { ...params };
  
  // 如果缺少教师，从上下文补全
  if (!completed.teachers && !completed.teacherName && conversationContext.lastTeachers.length > 0) {
    if (intent === 'swap' && conversationContext.lastTeachers.length >= 2) {
      completed.teachers = conversationContext.lastTeachers;
    } else if (conversationContext.lastTeachers.length === 1) {
      completed.teacherName = conversationContext.lastTeachers[0];
    }
  }
  
  // 如果缺少班级，从上下文补全
  if (!completed.className && conversationContext.lastClass) {
    completed.className = conversationContext.lastClass;
  }
  
  return completed;
}

// 工具函数
const generateId = (prefix) => `${prefix}${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

// 获取多样化的课程（确保不同类别）
function getDiverseCourses(courses, count) {
  const categories = {};
  courses.forEach(c => {
    if (!categories[c.category]) categories[c.category] = [];
    categories[c.category].push(c);
  });
  
  const selected = [];
  const categoryNames = Object.keys(categories);
  
  // 优先从每个类别中选择一门课程
  while (selected.length < count && categoryNames.length > 0) {
    for (const cat of categoryNames) {
      if (selected.length >= count) break;
      const catCourses = categories[cat].filter(c => !selected.includes(c));
      if (catCourses.length > 0) {
        selected.push(catCourses[Math.floor(Math.random() * catCourses.length)]);
      }
    }
  }
  
  // 如果还不够，随机补充
  while (selected.length < count) {
    const remaining = courses.filter(c => !selected.includes(c));
    if (remaining.length === 0) break;
    selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }
  
  return selected;
}

// ============ 统计接口 ============
app.get('/api/stats', (req, res) => {
  const courses = db.read('courses');
  const teachers = db.read('teachers');
  const students = db.read('students');
  const classrooms = db.read('classrooms');
  const classes = db.read('classes');
  const schedules = db.read('schedules');

  res.json({
    courses: courses.length,
    teachers: teachers.length,
    students: students.length,
    classrooms: classrooms.length,
    classes: classes.length,
    schedules: schedules.length
  });
});

// ============ 班级 CRUD ============
app.get('/api/classes', (req, res) => {
  const classes = db.read('classes');
  res.json(classes);
});

app.get('/api/classes/:id', (req, res) => {
  const classes = db.read('classes');
  const cls = classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: '班级不存在' });
  res.json(cls);
});

// ============ 课程 CRUD ============
app.get('/api/courses', (req, res) => {
  const courses = db.read('courses');
  res.json(courses);
});

app.get('/api/courses/:id', (req, res) => {
  const courses = db.read('courses');
  const course = courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: '课程不存在' });
  res.json(course);
});

app.post('/api/courses', (req, res) => {
  const courses = db.read('courses');
  const newCourse = {
    id: req.body.id || generateId('CS'),
    ...req.body
  };
  courses.push(newCourse);
  db.write('courses', courses);
  res.json(newCourse);
});

app.put('/api/courses/:id', (req, res) => {
  const courses = db.read('courses');
  const index = courses.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '课程不存在' });
  courses[index] = { ...courses[index], ...req.body };
  db.write('courses', courses);
  res.json(courses[index]);
});

app.delete('/api/courses/:id', (req, res) => {
  const courses = db.read('courses');
  const filtered = courses.filter(c => c.id !== req.params.id);
  if (filtered.length === courses.length) {
    return res.status(404).json({ error: '课程不存在' });
  }
  db.write('courses', filtered);
  res.json({ success: true });
});

// ============ 教师 CRUD ============
app.get('/api/teachers', (req, res) => {
  const teachers = db.read('teachers');
  res.json(teachers);
});

app.get('/api/teachers/:id', (req, res) => {
  const teachers = db.read('teachers');
  const teacher = teachers.find(t => t.id === req.params.id);
  if (!teacher) return res.status(404).json({ error: '教师不存在' });
  res.json(teacher);
});

app.post('/api/teachers', (req, res) => {
  const teachers = db.read('teachers');
  const newTeacher = {
    id: req.body.id || generateId('T'),
    ...req.body
  };
  teachers.push(newTeacher);
  db.write('teachers', teachers);
  res.json(newTeacher);
});

app.put('/api/teachers/:id', (req, res) => {
  const teachers = db.read('teachers');
  const index = teachers.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '教师不存在' });
  teachers[index] = { ...teachers[index], ...req.body };
  db.write('teachers', teachers);
  res.json(teachers[index]);
});

app.delete('/api/teachers/:id', (req, res) => {
  const teachers = db.read('teachers');
  const filtered = teachers.filter(t => t.id !== req.params.id);
  if (filtered.length === teachers.length) {
    return res.status(404).json({ error: '教师不存在' });
  }
  db.write('teachers', filtered);
  res.json({ success: true });
});

// ============ 学生 CRUD ============
app.get('/api/students', (req, res) => {
  let students = db.read('students');
  const { class: classFilter } = req.query;
  if (classFilter) {
    students = students.filter(s => s.class === classFilter);
  }
  res.json(students);
});

app.get('/api/students/classes', (req, res) => {
  const students = db.read('students');
  const classes = [...new Set(students.map(s => s.class))];
  res.json(classes);
});

app.get('/api/students/:id', (req, res) => {
  const students = db.read('students');
  const student = students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: '学生不存在' });
  res.json(student);
});

app.post('/api/students', (req, res) => {
  const students = db.read('students');
  const newStudent = {
    id: req.body.id || generateId('S'),
    ...req.body
  };
  students.push(newStudent);
  db.write('students', students);
  res.json(newStudent);
});

app.put('/api/students/:id', (req, res) => {
  const students = db.read('students');
  const index = students.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '学生不存在' });
  students[index] = { ...students[index], ...req.body };
  db.write('students', students);
  res.json(students[index]);
});

app.delete('/api/students/:id', (req, res) => {
  const students = db.read('students');
  const filtered = students.filter(s => s.id !== req.params.id);
  if (filtered.length === students.length) {
    return res.status(404).json({ error: '学生不存在' });
  }
  db.write('students', filtered);
  res.json({ success: true });
});

// ============ 教室 CRUD ============
app.get('/api/classrooms', (req, res) => {
  const classrooms = db.read('classrooms');
  res.json(classrooms);
});

app.get('/api/classrooms/:id', (req, res) => {
  const classrooms = db.read('classrooms');
  const classroom = classrooms.find(r => r.id === req.params.id);
  if (!classroom) return res.status(404).json({ error: '教室不存在' });
  res.json(classroom);
});

app.post('/api/classrooms', (req, res) => {
  const classrooms = db.read('classrooms');
  const newClassroom = {
    id: req.body.id || generateId('R'),
    ...req.body
  };
  classrooms.push(newClassroom);
  db.write('classrooms', classrooms);
  res.json(newClassroom);
});

app.put('/api/classrooms/:id', (req, res) => {
  const classrooms = db.read('classrooms');
  const index = classrooms.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '教室不存在' });
  classrooms[index] = { ...classrooms[index], ...req.body };
  db.write('classrooms', classrooms);
  res.json(classrooms[index]);
});

app.delete('/api/classrooms/:id', (req, res) => {
  const classrooms = db.read('classrooms');
  const filtered = classrooms.filter(r => r.id !== req.params.id);
  if (filtered.length === classrooms.length) {
    return res.status(404).json({ error: '教室不存在' });
  }
  db.write('classrooms', filtered);
  res.json({ success: true });
});

// ============ 课表 CRUD ============
app.get('/api/schedules', (req, res) => {
  let schedules = db.read('schedules');
  const courses = db.read('courses');
  const teachers = db.read('teachers');
  const classrooms = db.read('classrooms');
  const classes = db.read('classes');

  // 支持按教师名筛选
  if (req.query.teacherName) {
    console.log('teacherName param:', req.query.teacherName);
    const teacher = teachers.find(t => t.name === req.query.teacherName);
    console.log('teacher found:', teacher?.name || 'none');
    if (teacher) {
      schedules = schedules.filter(s => s.teacherId === teacher.id);
    }
  }

  // 关联数据
  const schedulesWithDetails = schedules.map(s => {
    const course = courses.find(c => c.id === s.courseId);
    const teacher = teachers.find(t => t.id === s.teacherId);
    const classroom = classrooms.find(r => r.id === s.classroomId);
    const cls = classes.find(c => c.id === s.classId);
    return {
      ...s,
      courseName: course?.name || '未知',
      courseCategory: course?.category || '未知',
      teacherName: teacher?.name || '未知',
      teacherSubject: teacher?.subject || '未知',
      classroomName: classroom?.name || '未知',
      building: classroom?.building || '未知',
      capacity: classroom?.capacity || 0,
      className: cls?.name || '未知'
    };
  });

  res.json(schedulesWithDetails);
});

app.post('/api/schedules', (req, res) => {
  const schedules = db.read('schedules');

  // 检查冲突
  const conflict = schedules.find(s =>
    s.dayOfWeek === req.body.dayOfWeek &&
    s.classroomId === req.body.classroomId &&
    !(s.endSection < req.body.startSection || s.startSection > req.body.endSection)
  );

  if (conflict) {
    return res.status(400).json({ error: '该教室该时段已被占用' });
  }

  const teacherConflict = schedules.find(s =>
    s.dayOfWeek === req.body.dayOfWeek &&
    s.teacherId === req.body.teacherId &&
    !(s.endSection < req.body.startSection || s.startSection > req.body.endSection)
  );

  if (teacherConflict) {
    return res.status(400).json({ error: '该教师该时段已有课程' });
  }

  // 检查班级冲突
  const classConflict = schedules.find(s =>
    s.dayOfWeek === req.body.dayOfWeek &&
    s.classId === req.body.classId &&
    !(s.endSection < req.body.startSection || s.startSection > req.body.endSection)
  );

  if (classConflict) {
    return res.status(400).json({ error: '该班级该时段已有课程' });
  }

  const newSchedule = {
    id: generateId('SCH'),
    ...req.body,
    classId: req.body.classId || 'C001'  // 默认班级
  };
  schedules.push(newSchedule);
  db.write('schedules', schedules);
  res.json(newSchedule);
});

app.put('/api/schedules/:id', (req, res) => {
  const schedules = db.read('schedules');
  const index = schedules.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '课表不存在' });

  // 检查冲突 (排除自己)
  const conflict = schedules.find(s =>
    s.id !== req.params.id &&
    s.dayOfWeek === req.body.dayOfWeek &&
    s.classroomId === req.body.classroomId &&
    !(s.endSection < req.body.startSection || s.startSection > req.body.endSection)
  );

  if (conflict) {
    return res.status(400).json({ error: '该教室该时段已被占用' });
  }

  schedules[index] = { ...schedules[index], ...req.body };
  db.write('schedules', schedules);
  res.json(schedules[index]);
});

app.delete('/api/schedules/:id', (req, res) => {
  const schedules = db.read('schedules');
  const filtered = schedules.filter(s => s.id !== req.params.id);
  if (filtered.length === schedules.length) {
    return res.status(404).json({ error: '课表不存在' });
  }
  db.write('schedules', filtered);
  res.json({ success: true });
});

// 清空所有课表
app.delete('/api/schedules', (req, res) => {
  db.write('schedules', []);
  res.json({ success: true, message: '所有排课已清空' });
});

// ============ 智能排课 ============
app.post('/api/schedules/auto', (req, res) => {
  const { teacherIds, weekType, specificWeeks } = req.body || {};
  const courses = db.read('courses');
  const teachers = db.read('teachers');
  const classrooms = db.read('classrooms');
  const classes = db.read('classes');
  const schedules = db.read('schedules');

  const results = [];
  const conflicts = [];

  // 随机打乱
  const shuffledTeachers = [...teachers].sort(() => Math.random() - 0.5);
  const shuffledCourses = [...courses].sort(() => Math.random() - 0.5);
  const shuffledRooms = [...classrooms].sort(() => Math.random() - 0.5);
  const shuffledDays = [1,2,3,4,5].sort(() => Math.random() - 0.5);

  // 选择老师
  const selectedTeachers = teacherIds && teacherIds.length > 0
    ? teachers.filter(t => teacherIds.includes(t.id))
    : shuffledTeachers;

  // 周次设置：支持单双周、全周或具体周次
  let weeksSingle, weeksDouble;
  let isSpecificWeek = false;
  if (specificWeeks) {
    // 使用指定的具体周次 - 只排这一周
    weeksSingle = String(specificWeeks);
    weeksDouble = String(specificWeeks);
    isSpecificWeek = true;
  } else if (weekType === 'all') {
    // 全周
    weeksSingle = '1-16';
    weeksDouble = '1-16';
  } else {
    // 默认：单双周交替
    const singleWeek = Math.random() > 0.5;
    weeksSingle = singleWeek ? '1,3,5,7,9,11,13,15' : '2,4,6,8,10,12,14,16';
    weeksDouble = singleWeek ? '2,4,6,8,10,12,14,16' : '1,3,5,7,9,11,13,15';
  }

  // 班级每天目标：单周>=4节，双周>=2节
  const classDayTarget = {};
  classes.forEach(c => {
    classDayTarget[c.id] = {};
    for (let d = 1; d <= 5; d++) {
      // 随机分配：1-2天是单周满课(4节)，其他天双周有课(2节)
      classDayTarget[c.id][d] = {
        single: 4, // 单周目标4节
        double: 2  // 双周目标2节
      };
    }
  });

  // 每个老师分配到所有5天，每天最多4节
  const teacherDayPlan = {};
  selectedTeachers.forEach((t, idx) => {
    teacherDayPlan[t.id] = [1,2,3,4,5].map(d => ({ day: d, maxSections: 4 }));
  });

  // 每个老师只安排自己学科的课程
  const teacherCourses = {};
  selectedTeachers.forEach(t => {
    const subjectCourses = shuffledCourses.filter(c => c.category === t.subject);
    teacherCourses[t.id] = subjectCourses.length > 0 ? subjectCourses.slice(0, 4) : shuffledCourses.slice(0, 4);
  });

  const validSections = [[1,2], [3,4], [5,6], [7,8]];

  // 为每个老师安排课程
  for (const teacher of selectedTeachers) {
    const coursesForTeacher = teacherCourses[teacher.id] || shuffledCourses.slice(0, 3);
    const dayPlan = teacherDayPlan[teacher.id];

    for (const course of coursesForTeacher) {
      // 检查是否已有排课
      if (schedules.some(s => s.courseId === course.id && s.teacherId === teacher.id)) continue;

      const suitableRooms = shuffledRooms.filter(r => r.capacity >= course.maxStudents);
      if (suitableRooms.length === 0) continue;

      // 为每个班级安排 - 尝试单周和双周
      for (const cls of classes) {
        let scheduledSingle = false;
        let scheduledDouble = false;
        
        // 先尝试排单周课程（目标：每天>=4节）
        for (const plan of dayPlan) {
          const day = plan.day;
          
          // 老师今天已达上限
          const teacherDaySections = schedules
            .filter(s => s.teacherId === teacher.id && s.dayOfWeek === day)
            .reduce((sum, s) => sum + (s.endSection - s.startSection + 1), 0);
          if (teacherDaySections >= 4) continue;

          // 单周：班级今天需要>=4节
          const classDaySectionsSingle = schedules
            .filter(s => s.classId === cls.id && s.dayOfWeek === day && s.weeks.includes('1'))
            .reduce((sum, s) => sum + (s.endSection - s.startSection + 1), 0);
          if (classDaySectionsSingle >= 4) continue; // 已达目标，跳过
          if (classDaySectionsSingle >= 8) continue; // 最多8节

          const shuffledSections = [...validSections].sort(() => Math.random() - 0.5);

          for (const room of suitableRooms) {
            for (const [startSection, endSection] of shuffledSections) {
              // 检查冲突
              const teacherConflict = schedules.some(s =>
                s.dayOfWeek === day && s.teacherId === teacher.id &&
                !(s.endSection < startSection || s.startSection > endSection)
              );
              if (teacherConflict) continue;

              const classConflict = schedules.some(s =>
                s.dayOfWeek === day && s.classId === cls.id &&
                !(s.endSection < startSection || s.startSection > endSection)
              );
              if (classConflict) continue;

              const roomConflict = schedules.some(s =>
                s.dayOfWeek === day && s.classroomId === room.id &&
                !(s.endSection < startSection || s.startSection > endSection)
              );
              if (roomConflict) continue;

              if (room.capacity < cls.studentCount) continue;

              const newSchedule = {
                id: generateId('SCH'),
                courseId: course.id,
                courseName: course.name,
                courseCategory: course.category,
                teacherId: teacher.id,
                teacherName: teacher.name,
                teacherSubject: teacher.subject,
                classroomId: room.id,
                classroomName: room.name,
                building: room.building,
                capacity: room.capacity,
                classId: cls.id,
                className: cls.name,
                dayOfWeek: day,
                startSection: startSection,
                endSection: endSection,
                weeks: weeksSingle
              };
              schedules.push(newSchedule);
              results.push(newSchedule);
              scheduledSingle = true;
              break;
            }
            if (scheduledSingle) break;
          }
          if (scheduledSingle) break;
        }

        // 再尝试排双周课程（目标：每天>=2节）
        // 如果指定了具体周次，跳过双周排课（只排一次）
        if (!isSpecificWeek) {
          for (const plan of dayPlan) {
            const day = plan.day;
            
            // 老师今天已达上限
            const teacherDaySections = schedules
              .filter(s => s.teacherId === teacher.id && s.dayOfWeek === day)
              .reduce((sum, s) => sum + (s.endSection - s.startSection + 1), 0);
            if (teacherDaySections >= 4) continue;

            // 双周：班级今天需要>=2节
            const classDaySectionsDouble = schedules
              .filter(s => s.classId === cls.id && s.dayOfWeek === day && s.weeks.includes('2'))
              .reduce((sum, s) => sum + (s.endSection - s.startSection + 1), 0);
            if (classDaySectionsDouble >= 2) continue; // 已达目标
            if (classDaySectionsDouble >= 8) continue;

            const shuffledSections = [...validSections].sort(() => Math.random() - 0.5);

            for (const room of suitableRooms) {
              for (const [startSection, endSection] of shuffledSections) {
                // 检查冲突
                const teacherConflict = schedules.some(s =>
                  s.dayOfWeek === day && s.teacherId === teacher.id &&
                  !(s.endSection < startSection || s.startSection > endSection)
                );
                if (teacherConflict) continue;

                const classConflict = schedules.some(s =>
                  s.dayOfWeek === day && s.classId === cls.id &&
                  !(s.endSection < startSection || s.startSection > endSection)
                );
                if (classConflict) continue;

                const roomConflict = schedules.some(s =>
                  s.dayOfWeek === day && s.classroomId === room.id &&
                  !(s.endSection < startSection || s.startSection > endSection)
                );
                if (roomConflict) continue;

                if (room.capacity < cls.studentCount) continue;

                const newSchedule = {
                  id: generateId('SCH'),
                  courseId: course.id,
                  courseName: course.name,
                  courseCategory: course.category,
                  teacherId: teacher.id,
                  teacherName: teacher.name,
                  teacherSubject: teacher.subject,
                  classroomId: room.id,
                  classroomName: room.name,
                  building: room.building,
                  capacity: room.capacity,
                  classId: cls.id,
                  className: cls.name,
                  dayOfWeek: day,
                  startSection: startSection,
                  endSection: endSection,
                  weeks: weeksDouble
                };
                schedules.push(newSchedule);
                results.push(newSchedule);
                scheduledDouble = true;
                break;
              }
              if (scheduledDouble) break;
            }
            if (scheduledDouble) break;
          }
        }
      }
    }
  }

  db.write('schedules', schedules);
  res.json({ added: results.length, schedules: results, conflicts });
});

// ============ AI 对话接口 ============
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '请提供消息内容' });
  }

  // ===== 第一层：意图识别（快速检索层）=====
  const recognizedIntent = await recognizeIntentByQwen(message);
  console.log(`[意图识别] 用户输入: "${message}" → 意图: ${recognizedIntent}`);
  
  // 获取当前数据作为上下文
  const schedules = db.read('schedules');
  const teachers = db.read('teachers');
  const courses = db.read('courses');
  const classrooms = db.read('classrooms');
  const classes = db.read('classes');

  // ===== 第二层：根据意图构建精简提示词 =====
  // 意图识别成功后，让 AI 只需返回关键参数
  let intentHint = '';
  let requiredParams = [];
  
  switch (recognizedIntent) {
    case 'query': intentHint = '查询'; requiredParams = ['className/teacherName/classroomName/queryType']; break;
    case 'delete': intentHint = '删除'; requiredParams = ['className/teacherName', 'dayOfWeek']; break;
    case 'swap': intentHint = '互换'; requiredParams = ['teachers: [教师1, 教师2]', '可选: className, week']; break;
    case 'move': intentHint = '移动'; requiredParams = ['className/teacherName', 'sourceDay', 'targetDay']; break;
    case 'replace': intentHint = '替换'; requiredParams = ['teacherName', 'newCoursePool']; break;
    case 'auto': intentHint = '排课'; requiredParams = ['className', '可选: courseRequirements']; break;
    case 'check': intentHint = '冲突检查'; requiredParams = []; break;
    default: intentHint = '其他'; break;
  }
  
  // 构建精简的系统提示词
  const systemPrompt = `你是 FineCourse 智能排课助手。
  
## 可用数据
教师: ${teachers.map(t => t.name).join(', ')}
班级: ${classes.map(c => c.name).join(', ')}
教室: ${classrooms.map(r => r.name).join(', ')}

## 当前识别意图
用户意图: "${intentHint}"（已识别，你只需返回参数）

## 返回格式
返回 JSON:
{
  "intent": "${recognizedIntent || 'unknown'}",
  "params": { 关键参数 },
  "reply": "简短回复"
}

## 需要提取的参数
${requiredParams.join(', ') || '无'}

## 规则
1. 根据"${intentHint}"意图，提取关键参数
2. "所有教室" / "教室" / "房间" / "room" / "classroom" → {"queryType": "classrooms"}
3. "所有教师" / "教师" / "老师" / "teacher" → {"queryType": "teachers"}
4. "所有班级" / "班级" / "class" → {"queryType": "classes"}
5. 互换两位老师 → {"teachers": ["教师1", "教师2"]}
6. 互换某班某天的两节课 → {"className": "班级名", "dayOfWeek": 数字}
7. 如果用户说"第X周"，必须返回 {"week": X}
8. 英文同义词：look/show/get/list = 查看，teacher = 教师，room = 教室
9. 缺少参数时 params 可以留空，后端会自动补全
`;

  // 构建详细的系统提示词（备用）
  const teachersList = teachers.map(t => `${t.name}(${t.subject}, ID:${t.id})`).join(', ');
  const coursesList = courses.map(c => `${c.name}(ID:${c.id})`).join(', ');
  const classroomsList = classrooms.map(r => `${r.name}(${r.building}, 容量${r.capacity})`).join(', ');
  const classesList = classes.map(c => `${c.name}(${c.major}, ${c.grade}, ID:${c.id})`).join(', ');
  
  const fallbackSystemPrompt = `你是 FineCourse 智能排课助手，帮助用户管理课程表。请理解用户的自然语言指令，并转换为结构化操作。

## 可用数据
教师: ${teachers.map(t => t.name).join(', ')}
课程: ${courses.map(c => c.name).join(', ')}
班级: ${classes.map(c => c.name).join(', ')}
当前排课: ${schedules.length}条

## API 支持
- GET /api/schedules?teacherName=教师名 → 查询某位教师的所有课程（返回包含 scheduleId、courseId、courseCategory 的列表）
- GET /api/courses → 查询所有课程（返回每门课程的 id、category、name）
- POST /api/ai/execute → 执行操作（用 intent 和 params 调用）

## 支持的意图
- query: 查询信息（课表、教师、课程、教室等）
- replace: 更换课程/教师（保持时间不变）
- move: 移动课程（改变时间或地点）
- delete: 删除/取消课程
- swap: 互换两位老师的课程（完整互换：时间、教室、班级等）
- auto: 自动排课
- check: 检查冲突

## 互换课程参数说明
- 互换两位老师的所有课程: {"intent": "swap", "params": {"teachers": ["教师名1", "教师名2"]}}
- 互换某班两位老师的课: {"intent": "swap", "params": {"teachers": ["教师名1", "教师名2"], "className": "班级名"}}
- 互换某周两位老师的课: {"intent": "swap", "params": {"teachers": ["教师名1", "教师名2"], "week": 周次}}
- 互换某班某周两位老师的课: {"intent": "swap", "params": {"teachers": ["教师名1", "教师名2"], "className": "班级名", "week": 周次}}

## 返回格式
{
  "intent": "query|replace|move|delete|auto|check",
  "params": {相关参数},
  "reply": "给用户的回复",
  "needsConfirm": false
}

## 规则
1. 根据用户指令灵活判断意图，不要死板匹配关键词
2. 如果用户说"取消"、"去掉"、"删除" → delete
3. 如果用户说"换"、"改成"、"改为" → replace
4. 如果用户说"调到"、"移到" → move
5. 如果用户说"查询"、"查看" → query
6. 所有操作直接执行（needsConfirm: false）

## 输出格式（强制要求）
- 必须返回纯 JSON 对象
- 根键必须是 "intent"，值必须是意图名称（如 query|replace|move|delete|auto|check）
- 必须包含 "params" 字段（对象）
- 示例：{"intent":"replace","params":{"isBatch":true,"teacherName":"教师名","newCoursePool":["CS101"]}}

## 重要：参数返回规则
- auto: 如果用户指定了班级，返回 {"className": "班级名"}；如果指定了课程数量和类型，返回 {"courseRequirements": [{"category": "课程类别", "count": 数量}]}
- delete: 如果是"清空所有"，返回 {"clearAll": true}；如果是具体课程，返回 {"className": "班级名", "dayOfWeek": 星期几, "startSection": 开始节次, "endSection": 结束节次}
- replace: 批量替换教师所有课程 → {"isBatch": true, "teacherName": "教师名", "newCoursePool": ["课程ID1", "课程ID2", ...]}；单个课程替换 → {"scheduleId": "课程安排ID", "newCourseId": "新课程ID"} 或 {"scheduleId": "课程安排ID", "newTeacherId": "新教师ID"}
- move: 返回 {"teacherName": "教师名", "targetDay": 目标星期}
- query: 返回 {"className": "班级名"} 或 {"teacherName": "教师名"}；如果要查询教师课程，添加 "queryType": "teacherCourses"

## 计算机类课程 ID（用于替换）
- CS101, CS102, CS103, CS104, CS105, CS106, CS201, CS202, CS203, CS204

## 数学类课程 ID（用于替换）
- MATH101, MATH102, MATH201, MATH202

## 物理类课程 ID（用于替换）
- PHY101, PHY102, PHY201

## 英语类课程 ID（用于替换）
- ENG101, ENG102, ENG201

## 政治类课程 ID（用于替换）
- POL101, POL102

## 查询参数说明
- 查询班级课表: {"className": "班级名"}
- 查询教师课表: {"teacherName": "教师名"}
- 查询教室使用: {"classroomName": "教室名"}
- 查询所有教室: {"queryType": "classrooms"}
- 查询所有教师: {"queryType": "teachers"}
- 查询所有班级: {"queryType": "classes"}

## 示例
用户: "清空所有课程"
→ {"intent": "delete", "params": {"clearAll": true}, "reply": "将清空所有已排课程", "needsConfirm": false}

用户: "把计科22-1班星期一第1、2节课取消"
→ {"intent": "delete", "params": {"className": "计科22-1班", "dayOfWeek": 1, "startSection": 1, "endSection": 2}, "reply": "将取消计科22-1班星期一第1-2节的课程", "needsConfirm": false}

用户: "把张老师周五的课取消"
→ {"intent": "delete", "params": {"teacherName": "张老师", "dayOfWeek": 5}, "reply": "将取消张老师周五的所有课程", "needsConfirm": false}

用户: "把郑勇老师的课全部替换为计算机课"
→ {"intent": "replace", "params": {"isBatch": true, "teacherName": "郑勇", "newCoursePool": ["CS101", "CS102"]}, "reply": "正在将郑勇老师的所有课程替换为计算机课程...", "needsConfirm": false}

用户: "看看计科22-1班有什么课"
→ {"intent": "query", "params": {"className": "计科22-1班"}, "reply": "正在查询...", "needsConfirm": false}

用户: "查询张伟老师的课表"
→ {"intent": "query", "params": {"teacherName": "张伟"}, "reply": "正在查询...", "needsConfirm": false}

用户: "查询所有教室"
→ {"intent": "query", "params": {"queryType": "classrooms"}, "reply": "正在查询所有教室...", "needsConfirm": false}

用户: "查询所有教师"
→ {"intent": "query", "params": {"queryType": "teachers"}, "reply": "正在查询所有教师...", "needsConfirm": false}

用户: "互换陈明和郑勇的课程"
→ {"intent": "swap", "params": {"teachers": ["陈明", "郑勇"]}, "reply": "正在互换陈明和郑勇的课程...", "needsConfirm": false}

用户: "互换计科22-1班陈明和郑勇的课"
→ {"intent": "swap", "params": {"teachers": ["陈明", "郑勇"], "className": "计科22-1班"}, "reply": "正在互换陈明和郑勇在计科22-1班的课程...", "needsConfirm": false}

用户: "互换第一周陈明和郑勇的课"
→ {"intent": "swap", "params": {"teachers": ["陈明", "郑勇"], "week": 1}, "reply": "正在互换陈明和郑勇第一周的课程...", "needsConfirm": false}

用户: "互换计科22-1班第一周陈明和郑勇的课"
→ {"intent": "swap", "params": {"teachers": ["陈明", "郑勇"], "className": "计科22-1班", "week": 1}, "reply": "正在互换陈明和郑勇在计科22-1班第一周的课程...", "needsConfirm": false}

用户: "帮我给计科22-1班第一周排课，要求4节数学课，4节计算机课，2节英语课"
→ {"intent": "auto", "params": {"className": "计科22-1班", "courseRequirements": [{"category": "数学", "count": 4}, {"category": "计算机", "count": 4}, {"category": "英语", "count": 2}]}, "reply": "正在为计科22-1班排课...", "needsConfirm": false}
`;

  try {
    let aiResult;
    
    // 根据配置的模型选择调用方式
    switch (aiModelConfig.provider) {
      case 'ollama':
        try {
          aiResult = await callOllamaAPI(systemPrompt, message, aiModelConfig.model);
          console.log('使用本地 Ollama 模型:', aiModelConfig.model);
        } catch (ollamaError) {
          console.log('Ollama 不可用，回退到 CodingPlan:', ollamaError.message);
          aiResult = await callQwenAPI(systemPrompt, message, aiModelConfig.apiKey, aiModelConfig.model);
        }
        break;
        
      case 'openclaw':
        // OpenClaw 模式 - 返回特殊标记让前端处理
        aiResult = {
          intent: 'openclaw',
          params: { message },
          reply: '已切换到 OpenClaw 模式。请直接在 OpenClaw 会话中提问。',
          needsConfirm: false,
          openclawMode: true
        };
        res.json(aiResult);
        return;

      case 'codingplan':
      default:
        //codingplan 模式总使用系统提示词
        console.log('使用阿里云 Coding Plan API:', aiModelConfig.model);
        aiResult = await callQwenAPI(systemPrompt, message, aiModelConfig.apiKey, aiModelConfig.model);
        break;
    }
    
    // ===== 第三层：参数自动补全 =====
    if (aiResult && aiResult.params) {
      aiResult.params = autoCompleteFromContext(aiResult.params, aiResult.intent);
    }
    
    // 更新上下文
    if (aiResult && aiResult.intent) {
      updateContext(aiResult.intent, aiResult.params || {});
    }
    
    // 自动排课直接执行，不需要确认
    if (aiResult.intent === 'auto' && aiResult.needsConfirm) {
      aiResult.needsConfirm = false;
      aiResult.reply = aiResult.reply + '\n\n🤖 正在自动排课，请稍候...';
      // 立即执行自动排课
      setTimeout(async () => {
        try {
          await executeAutoSchedule(aiResult.params || {});
          console.log('自动排课已执行');
        } catch (e) {
          console.error('自动排课失败:', e);
        }
      }, 100);
    }
    
    res.json(aiResult);

  } catch (error) {
    console.error('AI 调用失败:', error);
    // 返回模拟响应作为 fallback
    const mockResponse = simulateAIResponse(message, { teachers, courses, schedules });
    res.json(mockResponse);
  }
});

// 模拟 AI 响应（演示模式）
function simulateAIResponse(message, context) {
  const msg = message.toLowerCase();
  
  // 简单规则匹配
  if (msg.includes('调到') || msg.includes('移到') || msg.includes('改到')) {
    return {
      intent: 'move',
      params: { rawMessage: message },
      reply: '我理解你想调整课程安排："' + message + '"\n\n⚠️ 演示模式：请配置 QWEN_API_KEY 或 OPENAI_API_KEY 以启用完整 AI 功能。',
      needsConfirm: true,
      demo: true
    };
  }
  
  if (msg.includes('查询') || msg.includes('查看') || msg.includes('有多少')) {
    // 返回真实课程数量 + 班级/教师统计
    const courseCount = context.courses.length;
    const teacherCount = context.teachers.length;
    const scheduleCount = context.schedules.length;
    
    return {
      intent: 'query',
      params: {},
      reply: '当前系统状态：\n• 教师：' + teacherCount + '人\n• 课程：' + courseCount + '门\n• 已排课：' + scheduleCount + '条',
      needsConfirm: false,
      demo: true,
      courseCount,
      teacherCount
    };
  }

  return {
    intent: 'unknown',
    params: {},
    reply: '当前系统状态：\n• 教师：' + context.teachers.length + '人\n• 课程：' + context.courses.length + '门\n• 已排课：' + context.schedules.length + '条\n\n💡 试试：\n• "把张老师的课调到周五"\n• "互换李娜和王强老师的课程"\n• "检查当前课程冲突"', 
    needsConfirm: false,
    demo: true
  };
}

// 调用阿里云 Coding Plan API (使用 OpenAI 兼容模式)
async function callQwenAPI(systemPrompt, userMessage, apiKey, modelName = 'kimi-k2.5') {
  // 使用阿里云 Coding Plan OpenAI 兼容模式
  const response = await fetch('https://coding.dashscope.aliyuncs.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('API 调用失败: ' + response.status + ' - ' + errorText);
  }

  const data = await response.json();
  const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
  
  if (!content) {
    throw new Error('API 返回空内容');
  }
  
  try {
    let jsonStr = content;
    const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    return {
      intent: 'unknown',
      reply: content,
      needsConfirm: false,
      parseError: true
    };
  }
}

// 调用本地 Ollama API
async function callOllamaAPI(systemPrompt, userMessage, modelName) {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName || 'qwen3:4b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 2000
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Ollama API 调用失败: ' + response.status + ' - ' + errorText);
  }

  const data = await response.json();
  const content = data.message?.content;
  
  if (!content) {
    throw new Error('Ollama 返回空内容');
  }
  
  try {
    let jsonStr = content;
    const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    return {
      intent: 'unknown',
      reply: content,
      needsConfirm: false,
      parseError: true
    };
  }
}

// 调用 OpenClaw AI 能力
async function callOpenClawAI(systemPrompt, userMessage) {
  // 构建提示词，让 OpenClaw 理解排课系统的上下文
  const prompt = `${systemPrompt}\n\n用户请求: ${userMessage}\n\n请以 JSON 格式返回:\n{\n  "intent": "意图类型(query/move/check/auto/unknown)",\n  "params": {相关参数},\n  "reply": "给用户的回复",\n  "needsConfirm": false\n}`;
  
  // 这里我们使用一个简单的方法：直接返回意图让前端处理
  // 实际应用中可以通过 WebSocket 或 HTTP 调用 OpenClaw
  return {
    intent: 'openclaw_forward',
    params: { message: userMessage },
    reply: '已将您的请求转发给 AI 助手处理...',
    needsConfirm: false,
    forwardToOpenClaw: true
  };
}

// 调用 OpenAI API
async function callOpenAIAPI(systemPrompt, userMessage, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
  
  try {
    return JSON.parse(content);
  } catch {
    return {
      intent: 'unknown',
      reply: content || '处理失败',
      needsConfirm: false
    };
  }
}

// ============ AI 执行确认接口 ============
app.post('/api/ai/execute', async (req, res) => {
  let { intent, params } = req.body;
  
  try {
    let result;
    
    // ===== 参数预处理 =====
    // 将中文星期转换为数字
    const dayMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7, '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 7 };
    if (params.targetDay && typeof params.targetDay === 'string') {
      params.targetDay = dayMap[params.targetDay] || parseInt(params.targetDay) || params.targetDay;
    }
    if (params.sourceDay && typeof params.sourceDay === 'string') {
      params.sourceDay = dayMap[params.sourceDay] || parseInt(params.sourceDay) || params.sourceDay;
    }
    if (params.dayOfWeek && typeof params.dayOfWeek === 'string') {
      params.dayOfWeek = dayMap[params.dayOfWeek] || parseInt(params.dayOfWeek) || params.dayOfWeek;
    }
    
    // ===== 参数自动推断 =====
    // 如果是 move 意图且缺少 sourceDay，自动查询教师/班级哪天有课
    if (intent === 'move' && params.targetDay && !params.sourceDay) {
      const teachers = db.read('teachers');
      const classes = db.read('classes');
      const schedules = db.read('schedules');
      
      if (params.teacherName) {
        const teacher = teachers.find(t => t.name === params.teacherName);
        if (teacher) {
          const teacherSchedules = schedules.filter(s => s.teacherId === teacher.id);
          if (teacherSchedules.length > 0) {
            params.sourceDay = teacherSchedules[0].dayOfWeek;
            console.log(`[自动推断] ${params.teacherName} 的课程在周${params.sourceDay}，将移到周${params.targetDay}`);
          }
        }
      } else if (params.className) {
        const cls = classes.find(c => c.name === params.className);
        if (cls) {
          const classSchedules = schedules.filter(s => s.classId === cls.id);
          if (classSchedules.length > 0) {
            params.sourceDay = classSchedules[0].dayOfWeek;
            console.log(`[自动推断] ${params.className} 的课程在周${params.sourceDay}，将移到周${params.targetDay}`);
          }
        }
      }
    }
    
    // 处理 swap 意图：互换两个老师的课程
    if (intent === 'swap' && params.teachers && params.teachers.length === 2) {
      result = await executeSwapTeachers(params.teachers, { className: params.className, week: params.week });
      res.json(result);
      return;
    }
    
    // ===== 复杂指令拆解 =====
    // 处理"把周X有课的老师调到周Y"这类复杂指令
    if (intent === 'move' && params.moveAllTeachersFromDay && params.targetDay) {
      const sourceDay = params.moveAllTeachersFromDay;
      const targetDay = params.targetDay;
      
      // 查询该天有课的所有教师
      const daySchedules = db.read('schedules').filter(s => s.dayOfWeek === sourceDay);
      const teacherIds = [...new Set(daySchedules.map(s => s.teacherId))];
      const teachers = db.read('teachers');
      
      const results = [];
      for (const teacherId of teacherIds) {
        const teacher = teachers.find(t => t.id === teacherId);
        if (teacher) {
          const moveResult = await executeMoveCourse({
            teacherName: teacher.name,
            sourceDay,
            targetDay
          });
          results.push({ teacher: teacher.name, ...moveResult });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      res.json({
        success: successCount > 0,
        message: `已将周${sourceDay}的 ${teacherIds.length} 位老师的课程移到周${targetDay}，成功 ${successCount} 个`,
        results
      });
      return;
    }
    
    // 处理 replace 意图：如果teacherName + newTeacherName，是互换老师
    else if (intent === 'replace' && params.isBatch && params.teacherName && params.newTeacherName && !params.scheduleIds) {
      result = await executeSwapTeachers([params.teacherName, params.newTeacherName], { className: params.className, week: params.week });
      res.json(result);
      return;
    }
    else if (intent === 'replace' && params.isBatch && params.teacherName && !params.scheduleIds) {
      const schedules = await fetch(`http://localhost:3001/api/schedules?teacherName=${encodeURIComponent(params.teacherName)}`)
        .then(r => r.json())
        .catch(() => []);
      params.scheduleIds = schedules.map(s => s.id);
      console.log(`自动查询到 ${params.teacherName} 的 ${params.scheduleIds.length} 门课程`);
    }
    
    switch (intent) {
      case 'query':
        result = await executeQueryInfo(params);
        break;
      case 'move':
        result = await executeMoveCourse(params);
        break;
      case 'swap':
        // 如果提供了 teachers 数组，使用新的互换逻辑
        if (params.teachers && params.teachers.length === 2) {
          result = await executeSwapTeachers(params.teachers, { className: params.className, week: params.week });
        } else if (params.className && (params.dayOfWeek || params.day)) {
          // 班级某天的两节课互换
          result = await executeSwapInClass({
            className: params.className,
            dayOfWeek: params.dayOfWeek || params.day,
            week: params.week
          });
        } else {
          result = await executeSwapCourse(params);
        }
        break;
      case 'replace':
        result = await executeReplaceCourse(params);
        break;
      case 'auto':
        result = await executeAutoSchedule(params);
        break;
      case 'delete':
        result = await executeDeleteSchedule(params);
        break;
      case 'check':
        result = await executeCheckConflicts(params);
        break;
      default:
        result = { success: false, error: '未知的操作类型' };
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 查询信息
async function executeQueryInfo(params) {
  let { className, teacherName, classroomName, queryType } = params;
  
  const schedules = db.read('schedules');
  const teachers = db.read('teachers');
  const courses = db.read('courses');
  const classes = db.read('classes');
  const classrooms = db.read('classrooms');
  
  // ===== 泛化处理：智能识别查询意图 =====
  // 如果 className 包含"教室"、"所有教室"等关键词，自动转为查询教室
  if (className && (className.includes('教室') || className.includes('所有教室'))) {
    queryType = 'classrooms';
    className = undefined;
  }
  // 如果 className 包含"教师"、"老师"、"所有教师"等关键词
  if (className && (className.includes('教师') || className.includes('老师') || className.includes('所有教师'))) {
    queryType = 'teachers';
    className = undefined;
  }
  // 如果 className 包含"班级"、"所有班级"等关键词
  if (className && (className.includes('班级') || className.includes('所有班级'))) {
    queryType = 'classes';
    className = undefined;
  }
  // 如果 teacherName 包含"教室"关键词
  if (teacherName && teacherName.includes('教室')) {
    queryType = 'classrooms';
    teacherName = undefined;
  }
  // 如果 teacherName 包含"所有教师"
  if (teacherName && teacherName.includes('所有')) {
    queryType = 'teachers';
    teacherName = undefined;
  }
  // 如果 classroomName 包含"所有教室"
  if (classroomName && classroomName.includes('所有')) {
    queryType = 'classrooms';
    classroomName = undefined;
  }
  
  // 通过 ID 构建名称映射
  const courseMap = {};
  courses.forEach(c => courseMap[c.id] = { name: c.name, category: c.category });
  
  const teacherMap = {};
  teachers.forEach(t => teacherMap[t.id] = { name: t.name, subject: t.subject });
  
  const classMap = {};
  classes.forEach(c => classMap[c.id] = { name: c.name, major: c.major });
  
  const classroomMap = {};
  classrooms.forEach(r => classroomMap[r.id] = { name: r.name, building: r.building, capacity: r.capacity });
  
  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  
  // 格式化课程时间
  function formatSchedule(s) {
    const day = dayNames[s.dayOfWeek] || `周${s.dayOfWeek}`;
    const section = `第${s.startSection}-${s.endSection}节`;
    const course = courseMap[s.courseId]?.name || s.courseId;
    const teacher = teacherMap[s.teacherId]?.name || '';
    const room = classroomMap[s.classroomId]?.name || '';
    const cls = classMap[s.classId]?.name || '';
    return { day, section, course, teacher, room, cls };
  }
  
  // 查询所有教室
  if (queryType === 'classrooms' || classroomName === '所有') {
    let message = `🏫 教室列表（共${classrooms.length}间）：\n`;
    classrooms.forEach(r => {
      message += `  ${r.name} | ${r.building} | 容量${r.capacity}人 | ${r.type || '普通教室'}\n`;
    });
    return { success: true, message, classroomCount: classrooms.length };
  }
  
  // 查询所有教师
  if (queryType === 'teachers' || teacherName === '所有') {
    let message = `👨‍🏫 教师列表（共${teachers.length}人）：\n`;
    teachers.forEach(t => {
      message += `  ${t.name} | ${t.subject} | ${t.office || ''}\n`;
    });
    return { success: true, message, teacherCount: teachers.length };
  }
  
  // 查询所有班级
  if (queryType === 'classes' || className === '所有') {
    let message = `📚 班级列表（共${classes.length}个）：\n`;
    classes.forEach(c => {
      message += `  ${c.name} | ${c.major} | ${c.grade} | ${c.studentCount}人\n`;
    });
    return { success: true, message, classCount: classes.length };
  }
  
  // 查询班级课表
  if (className) {
    const cls = classes.find(c => c.name === className);
    if (!cls) {
      return { success: false, error: `找不到班级: ${className}` };
    }
    
    const clsSchedules = schedules.filter(s => s.classId === cls.id);
    if (clsSchedules.length === 0) {
      return { success: true, message: `${className} 暂无课程安排` };
    }
    
    // 按星期分组
    const byDay = {};
    clsSchedules.forEach(s => {
      const day = dayNames[s.dayOfWeek];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(formatSchedule(s));
    });
    
    let message = `📚 ${className} 课程表：\n`;
    for (let d = 1; d <= 5; d++) {
      const day = dayNames[d];
      if (byDay[day]) {
        message += `\n【${day}】\n`;
        byDay[day].sort((a, b) => a.section.localeCompare(b.section)).forEach(item => {
          message += `  ${item.section} ${item.course} (${item.teacher})\n`;
        });
      }
    }
    
    return { success: true, message, scheduleCount: clsSchedules.length };
  }
  
  // 查询教师课程
  if (teacherName) {
    const teacher = teachers.find(t => t.name === teacherName);
    if (!teacher) {
      return { success: false, error: `找不到教师: ${teacherName}` };
    }
    
    const teacherSchedules = schedules.filter(s => s.teacherId === teacher.id);
    if (teacherSchedules.length === 0) {
      return { success: true, message: `${teacherName} 老师暂无课程安排` };
    }
    
    // 按星期分组
    const byDay = {};
    teacherSchedules.forEach(s => {
      const day = dayNames[s.dayOfWeek];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(formatSchedule(s));
    });
    
    let message = `👨‍🏫 ${teacherName} 老师课程表：\n`;
    for (let d = 1; d <= 5; d++) {
      const day = dayNames[d];
      if (byDay[day]) {
        message += `\n【${day}】\n`;
        byDay[day].sort((a, b) => a.section.localeCompare(b.section)).forEach(item => {
          message += `  ${item.section} ${item.course} (${item.cls} @ ${item.room})\n`;
        });
      }
    }
    
    return { success: true, message, scheduleCount: teacherSchedules.length };
  }
  
  // 查询教室使用情况
  if (classroomName) {
    const room = classrooms.find(r => r.name === classroomName);
    if (!room) {
      return { success: false, error: `找不到教室: ${classroomName}` };
    }
    
    const roomSchedules = schedules.filter(s => s.classroomId === room.id);
    if (roomSchedules.length === 0) {
      return { success: true, message: `${classroomName} 暂无课程占用` };
    }
    
    // 按星期分组
    const byDay = {};
    roomSchedules.forEach(s => {
      const day = dayNames[s.dayOfWeek];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(formatSchedule(s));
    });
    
    let message = `🏫 ${classroomName} 教室使用情况：\n`;
    for (let d = 1; d <= 5; d++) {
      const day = dayNames[d];
      if (byDay[day]) {
        message += `\n【${day}】\n`;
        byDay[day].sort((a, b) => a.section.localeCompare(b.section)).forEach(item => {
          message += `  ${item.section} ${item.course} (${item.teacher} / ${item.cls})\n`;
        });
      }
    }
    
    return { success: true, message, scheduleCount: roomSchedules.length };
  }
  
  // 默认返回所有课程
  return {
    success: true,
    message: `当前课程列表（共${courses.length}门）：\n${courses.map(c => `${c.id} | ${c.name} | ${c.category} | ${c.credits}学分`).join('\n')}`,
    courseCount: courses.length
  };
}

// 执行移动课程
async function executeMoveCourse(params) {
  const { scheduleId, targetDay, targetStartSection, targetClassroomId, targetWeeks, className, sourceDay, teacherName } = params;
  
  const schedules = db.read('schedules');
  const classes = db.read('classes');
  const teachers = db.read('teachers');
  
  // 如果指定 className 和 sourceDay，先找到对应课程
  let coursesToMove = [];
  if (className && sourceDay !== undefined) {
    const cls = classes.find(c => c.name === className);
    if (!cls) {
      return { success: false, error: `找不到班级: ${className}` };
    }
    coursesToMove = schedules.filter(s => s.classId === cls.id && s.dayOfWeek === sourceDay);
    if (coursesToMove.length === 0) {
      return { success: false, error: `找不到 ${className} 在星期${sourceDay} 的课程安排` };
    }
  } else if (teacherName && sourceDay !== undefined) {
    // 支持教师名 + 源星期
    const teacher = teachers.find(t => t.name === teacherName);
    if (!teacher) {
      return { success: false, error: `找不到教师: ${teacherName}` };
    }
    coursesToMove = schedules.filter(s => s.teacherId === teacher.id && s.dayOfWeek === sourceDay);
    if (coursesToMove.length === 0) {
      return { success: false, error: `找不到 ${teacherName} 在星期${sourceDay} 的课程安排` };
    }
  } else if (scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      return { success: false, error: '找不到指定的课程安排' };
    }
    coursesToMove = [schedule];
  } else {
    return { success: false, error: '请提供 scheduleId、className + sourceDay、teacherName + sourceDay 或其他有效参数' };
  }
  
  const validSections = [[1,2], [3,4], [5,6], [7,8]];
  const results = [];
  
  for (const schedule of coursesToMove) {
    let movedSchedule = { ...schedule };
    
    // 更新目标星期
    if (targetDay !== undefined) movedSchedule.dayOfWeek = targetDay;
    if (targetClassroomId) movedSchedule.classroomId = targetClassroomId;
    if (targetWeeks) movedSchedule.weeks = targetWeeks;
    
    // 如果指定了目标节次，直接设置；否则自动寻找空闲时间段
    if (targetStartSection !== undefined) {
      const duration = schedule.endSection - schedule.startSection;
      movedSchedule.startSection = targetStartSection;
      movedSchedule.endSection = targetStartSection + duration;
    } else {
      // 自动寻找目标星期的空闲时间段
      const duration = movedSchedule.endSection - movedSchedule.startSection;
      const availableSections = validSections.filter(([start, end]) => {
        // 检查该时间段是否有冲突
        const newSchedule = { ...movedSchedule, startSection: start, endSection: end };
        const conflicts = checkScheduleConflicts(newSchedule, schedules.filter(s => s.id !== schedule.id));
        return conflicts.length === 0;
      });
      
      if (availableSections.length > 0) {
        // 找到第一个可用的，优先选靠前的节次
        movedSchedule.startSection = availableSections[0][0];
        movedSchedule.endSection = availableSections[0][1];
      } else {
        results.push({
          scheduleId: schedule.id,
          success: false,
          error: `星期${targetDay}没有空闲的 ${duration} 节时间段`
        });
        continue;
      }
    }
    
    // 再次检查冲突
    const conflicts = checkScheduleConflicts(movedSchedule, schedules.filter(s => s.id !== schedule.id));
    
    if (conflicts.length > 0) {
      results.push({
        scheduleId: schedule.id,
        success: false,
        error: '移动后存在冲突',
        conflicts
      });
    } else {
      // 更新原 schedule 对象
      schedule.dayOfWeek = movedSchedule.dayOfWeek;
      schedule.startSection = movedSchedule.startSection;
      schedule.endSection = movedSchedule.endSection;
      schedule.classroomId = movedSchedule.classroomId;
      schedule.weeks = movedSchedule.weeks;
      
      results.push({
        scheduleId: schedule.id,
        success: true,
        message: '课程已自动调整到星期' + schedule.dayOfWeek + '第' + schedule.startSection + '-' + schedule.endSection + '节',
        schedule
      });
    }
  }
  
  db.write('schedules', schedules);
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  return {
    success: successCount > 0,
    message: `移动完成：成功 ${successCount} 门，失败 ${failCount} 门`,
    results,
    successCount,
    failCount
  };
}

// 执行班级内课程互换（某天的两门课互换时间）
async function executeSwapInClass(params) {
  const className = params.className || params.class;
  let day = params.dayOfWeek || params.day;
  const week = params.week;
  
  // 处理中文星期
  const dayMap = { '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 7, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 };
  if (typeof day === 'string') {
    day = dayMap[day] || parseInt(day);
  }
  
  let schedules = db.read('schedules');
  const classes = db.read('classes');
  
  // 查找班级
  const cls = classes.find(c => c.name === className);
  if (!cls) {
    return { success: false, error: `找不到班级: ${className}` };
  }
  
  // 查找该班级该天的所有课程
  let daySchedules = schedules.filter(s => s.classId === cls.id && s.dayOfWeek === day);
  
  // 如果指定了周次，只互换该周的课程
  if (week !== undefined) {
    const weekNum = parseInt(week);
    
    // 找出包含该周次的课程，并从中"切分"出该周次
    const newSchedules = [];
    const schedulesToSwap = [];
    
    for (const s of daySchedules) {
      const weeks = parseWeeks(s.weeks);
      if (weeks.includes(weekNum)) {
        if (weeks.length === 1) {
          // 该课程只有指定周次，直接加入互换列表
          schedulesToSwap.push(s);
        } else {
          // 该课程有多个周次，需要切分
          // 1. 从原课程中移除该周次
          const otherWeeks = weeks.filter(w => w !== weekNum);
          s.weeks = otherWeeks.join(',');
          
          // 2. 创建新的课程记录，只包含指定周次
          const newSchedule = { ...s, id: 'SCH' + Date.now() + Math.random().toString(36).substr(2, 5) };
          newSchedule.weeks = String(weekNum);
          schedulesToSwap.push(newSchedule);
          newSchedules.push(newSchedule);
        }
      }
    }
    
    // 将新创建的课程加入 schedules
    schedules = [...schedules, ...newSchedules];
    daySchedules = schedulesToSwap;
  }
  
  if (daySchedules.length < 2) {
    const weekMsg = week !== undefined ? `第${week}周` : '';
    return { success: false, error: `该班级在${weekMsg}周${day}只有 ${daySchedules.length} 门课程，无法互换` };
  }
  
  // 取前两门课程互换
  const s1 = daySchedules[0];
  const s2 = daySchedules[1];
  
  // 互换时间、教室
  const temp = {
    startSection: s1.startSection,
    endSection: s1.endSection,
    classroomId: s1.classroomId
  };
  
  s1.startSection = s2.startSection;
  s1.endSection = s2.endSection;
  s1.classroomId = s2.classroomId;
  
  s2.startSection = temp.startSection;
  s2.endSection = temp.endSection;
  s2.classroomId = temp.classroomId;
  
  db.write('schedules', schedules);
  
  const teachers = db.read('teachers');
  const courses = db.read('courses');
  const t1 = teachers.find(t => t.id === s1.teacherId);
  const t2 = teachers.find(t => t.id === s2.teacherId);
  const c1 = courses.find(c => c.id === s1.courseId);
  const c2 = courses.find(c => c.id === s2.courseId);
  
  const weekMsg = week !== undefined ? `第${week}周` : '';
  
  return {
    success: true,
    message: `已互换 ${className} ${weekMsg}周${day} 的两门课程：\n• ${t1?.name || s1.teacherId} 的 ${c1?.name || s1.courseId} → 第${s1.startSection}-${s1.endSection}节\n• ${t2?.name || s2.teacherId} 的 ${c2?.name || s2.courseId} → 第${s2.startSection}-${s2.endSection}节`
  };
}

// 互换两个老师的课程（支持班级/周次筛选）
// 互换内容：时间（星期、节次）、教室、周次
// 保持不变：教师、课程、班级
async function executeSwapTeachers(teacherNames, params = {}) {
  const { className, week } = params;
  
  const schedules = db.read('schedules');
  const teachers = db.read('teachers');
  const classes = db.read('classes');
  
  const teacher1 = teachers.find(t => t.name === teacherNames[0]);
  const teacher2 = teachers.find(t => t.name === teacherNames[1]);
  
  if (!teacher1 || !teacher2) {
    return { success: false, error: `找不到指定的老师: ${teacherNames.join(' 和 ')} ` };
  }
  
  // 筛选课程
  let teacher1Courses = schedules.filter(s => s.teacherId === teacher1.id);
  let teacher2Courses = schedules.filter(s => s.teacherId === teacher2.id);
  
  // 如果指定了班级，只互换该班级的课程
  if (className) {
    const cls = classes.find(c => c.name === className);
    if (!cls) {
      return { success: false, error: `找不到班级: ${className}` };
    }
    teacher1Courses = teacher1Courses.filter(s => s.classId === cls.id);
    teacher2Courses = teacher2Courses.filter(s => s.classId === cls.id);
  }
  
  // 如果指定了周次，只互换该周的课程
  if (week) {
    const weekNum = parseInt(week);
    teacher1Courses = teacher1Courses.filter(s => {
      const weeks = parseWeeks(s.weeks);
      return weeks.includes(weekNum);
    });
    teacher2Courses = teacher2Courses.filter(s => {
      const weeks = parseWeeks(s.weeks);
      return weeks.includes(weekNum);
    });
  }
  
  if (teacher1Courses.length === 0 && teacher2Courses.length === 0) {
    return { success: true, message: '两位老师在该条件下都没有课程，无需互换' };
  }
  
  if (teacher1Courses.length === 0) {
    return { success: false, error: `${teacher1.name} 在该条件下没有课程` };
  }
  
  if (teacher2Courses.length === 0) {
    return { success: false, error: `${teacher2.name} 在该条件下没有课程` };
  }
  
  // 互换课程记录：只互换时间、教室，保持教师、课程、班级不变
  const minLen = Math.min(teacher1Courses.length, teacher2Courses.length);
  
  for (let i = 0; i < minLen; i++) {
    const c1 = teacher1Courses[i];
    const c2 = teacher2Courses[i];
    
    // 交换 classroomId（教室互换）
    const tempRoomId = c1.classroomId;
    c1.classroomId = c2.classroomId;
    c2.classroomId = tempRoomId;
    
    // 交换 dayOfWeek（星期互换）
    const tempDay = c1.dayOfWeek;
    c1.dayOfWeek = c2.dayOfWeek;
    c2.dayOfWeek = tempDay;
    
    // 交换 startSection, endSection（节次互换）
    const tempStart = c1.startSection;
    const tempEnd = c1.endSection;
    c1.startSection = c2.startSection;
    c1.endSection = c2.endSection;
    c2.startSection = tempStart;
    c2.endSection = tempEnd;
    
    // 交换 weeks（周次互换）
    const tempWeeks = c1.weeks;
    c1.weeks = c2.weeks;
    c2.weeks = tempWeeks;
    
    // 注意：teacherId、courseId、classId 都不变
    // 教师保持不变，课程保持不变，班级保持不变
  }
  
  // 检查冲突
  const conflicts = [];
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const s1 = schedules[i];
      const s2 = schedules[j];
      
      if (s1.dayOfWeek !== s2.dayOfWeek) continue;
      const overlap = !(s1.endSection < s2.startSection || s1.startSection > s2.endSection);
      if (!overlap) continue;
      
      const weeks1 = parseWeeks(s1.weeks);
      const weeks2 = parseWeeks(s2.weeks);
      if (!weeks1.some(w => weeks2.includes(w))) continue;
      
      if (s1.classroomId === s2.classroomId) {
        conflicts.push({ type: '教室冲突', description: `${s1.classroomId} 在 周${s1.dayOfWeek}第${s1.startSection}-${s1.endSection}节 冲突` });
      }
      if (s1.classId === s2.classId) {
        conflicts.push({ type: '班级冲突', description: `班级在 周${s1.dayOfWeek}第${s1.startSection}-${s1.endSection}节 冲突` });
      }
      if (s1.teacherId === s2.teacherId) {
        conflicts.push({ type: '教师冲突', description: `教师在 周${s1.dayOfWeek}第${s1.startSection}-${s1.endSection}节 冲突` });
      }
    }
  }
  
  if (conflicts.length > 0) {
    // 有冲突，回滚
    return { success: false, error: '互换后存在冲突，请检查', conflicts };
  }
  
  db.write('schedules', schedules);
  
  let message = `课程互换完成！\n`;
  if (className) message += `班级: ${className}\n`;
  if (week) message += `周次: 第${week}周\n`;
  message += `• ${teacher1.name} 的 ${minLen} 门课 ↔ ${teacher2.name} 的 ${minLen} 门课\n`;
  message += `（时间、地点互换，教师和课程不变）`;
  
  return { success: true, message };
}

// 执行交换课程
async function executeSwapCourse(params) {
  const { scheduleId1, scheduleId2 } = params;
  
  const schedules = db.read('schedules');
  const idx1 = schedules.findIndex(s => s.id === scheduleId1);
  const idx2 = schedules.findIndex(s => s.id === scheduleId2);
  
  if (idx1 === -1 || idx2 === -1) {
    return { success: false, error: '找不到指定的课程' };
  }
  
  // 交换时间信息
  const s1 = schedules[idx1];
  const s2 = schedules[idx2];
  
  const temp = {
    dayOfWeek: s1.dayOfWeek,
    startSection: s1.startSection,
    endSection: s1.endSection,
    classroomId: s1.classroomId
  };
  
  s1.dayOfWeek = s2.dayOfWeek;
  s1.startSection = s2.startSection;
  s1.endSection = s2.endSection;
  s1.classroomId = s2.classroomId;
  
  s2.dayOfWeek = temp.dayOfWeek;
  s2.startSection = temp.startSection;
  s2.endSection = temp.endSection;
  s2.classroomId = temp.classroomId;
  
  db.write('schedules', schedules);
  
  return {
    success: true,
    message: '课程已交换',
    schedules: [s1, s2]
  };
}

// 执行更换课程（支持单条和批量替换）
async function executeReplaceCourse(params) {
  const { scheduleId, scheduleIds, newCourseId, newTeacherId, newClassId, 
          teacherName, newTeacherPool, newCoursePool, isBatch } = params;
  
  const schedules = db.read('schedules');
  const courses = db.read('courses');
  const teachers = db.read('teachers');
  const classes = db.read('classes');
  
  // 批量替换模式
  if (isBatch && scheduleIds && scheduleIds.length > 0) {
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    // 获取指定的课程和教师（如果有）
    const specifiedCourse = newCourseId ? courses.find(c => c.id === newCourseId) : null;
    const specifiedTeacher = newTeacherId ? teachers.find(t => t.id === newTeacherId) : null;
    
    for (const sid of scheduleIds) {
      const schedule = schedules.find(s => s.id === sid);
      if (!schedule) {
        failCount++;
        continue;
      }
      
      let targetCourse = specifiedCourse;
      let targetTeacher = specifiedTeacher;
      
      // 如果没有指定课程/教师，从pool中随机选择
      if (!targetCourse && newCoursePool && newCoursePool.length > 0) {
        // 先尝试从 pool 中找到匹配的课程
        const randomCourseId = newCoursePool[Math.floor(Math.random() * newCoursePool.length)];
        targetCourse = courses.find(c => c.id === randomCourseId);
        // 如果没匹配上，尝试按课程类别匹配（比如数学课）
        if (!targetCourse) {
          // 尝试从数据库中找到同类别课程
          const allCourses = courses.filter(c => 
            ['数学', '物理', '计算机', '英语', '政治', '历史', '体育', '文科'].includes(c.category)
          );
          if (allCourses.length > 0) {
            targetCourse = allCourses[Math.floor(Math.random() * allCourses.length)];
          }
        }
      }
      
      if (!targetTeacher && newTeacherPool && newTeacherPool.length > 0) {
        const randomTeacherId = newTeacherPool[Math.floor(Math.random() * newTeacherPool.length)];
        targetTeacher = teachers.find(t => t.id === randomTeacherId);
      }
      
      // 如果指定了课程但没有指定教师，自动匹配合适的教师
      if (targetCourse && !targetTeacher) {
        const availableTeachers = teachers.filter(t => t.subject === targetCourse.category);
        if (availableTeachers.length > 0) {
          const scheduleTime = {
            dayOfWeek: schedule.dayOfWeek,
            startSection: schedule.startSection,
            endSection: schedule.endSection,
            weeks: schedule.weeks
          };
          
          const teacherConflicts = availableTeachers.map(t => {
            const teacherSchedules = schedules.filter(s => s.teacherId === t.id && s.id !== sid);
            const hasConflict = teacherSchedules.some(s => 
              s.dayOfWeek === scheduleTime.dayOfWeek &&
              !(s.endSection < scheduleTime.startSection || s.startSection > scheduleTime.endSection)
            );
            return { teacher: t, hasConflict };
          });
          
          const availableTeacher = teacherConflicts.find(t => !t.hasConflict);
          if (availableTeacher) {
            targetTeacher = availableTeacher.teacher;
          } else {
            targetTeacher = availableTeachers[Math.floor(Math.random() * availableTeachers.length)];
          }
        }
      }
      
      if (!targetCourse || !targetTeacher) {
        failCount++;
        continue;
      }
      
      // 保存旧信息
      const oldCourseId = schedule.courseId;
      const oldTeacherId = schedule.teacherId;
      
      // 更新
      schedule.courseId = targetCourse.id;
      schedule.teacherId = targetTeacher.id;
      
      // 检查冲突
      const conflict = checkScheduleConflicts(schedule, schedules.filter(s => s.id !== sid));
      if (conflict.length > 0) {
        // 回滚
        schedule.courseId = oldCourseId;
        schedule.teacherId = oldTeacherId;
        failCount++;
      } else {
        successCount++;
        results.push({
          scheduleId: sid,
          courseName: targetCourse.name,
          teacherName: targetTeacher.name
        });
      }
    }
    
    db.write('schedules', schedules);
    
    let message = `批量更换完成：成功 ${successCount} 门，失败 ${failCount} 门`;
    if (failCount > 0) {
      message += `\n\n失败原因：\n• 目标时间段教师冲突（该教师同一时间已有其他课程）\n• 教室冲突（该教室同一时间已被占用）\n• 班级冲突（该班级同一时间已有其他课程）\n\n建议：尝试更换其他时间段，或手动调整冲突课程后再试。`;
    }
    
    return {
      success: successCount > 0,
      message,
      results,
      failCount,
      successCount
    };
  }
  
  // 单条替换模式
  const schedule = schedules.find(s => s.id === scheduleId);
  
  if (!schedule) {
    return { success: false, error: '找不到指定的课程安排' };
  }
  
  // 获取新课程信息
  const newCourse = newCourseId ? courses.find(c => c.id === newCourseId) : null;
  let newTeacher = newTeacherId ? teachers.find(t => t.id === newTeacherId) : null;
  const newClass = newClassId ? classes.find(c => c.id === newClassId) : null;
  
  // 如果更换了课程但没有指定教师，自动匹配合适的教师
  if (newCourse && !newTeacher) {
    const availableTeachers = teachers.filter(t => t.subject === newCourse.category);
    if (availableTeachers.length > 0) {
      const scheduleTime = {
        dayOfWeek: schedule.dayOfWeek,
        startSection: schedule.startSection,
        endSection: schedule.endSection,
        weeks: schedule.weeks
      };
      
      const teacherConflicts = availableTeachers.map(t => {
        const teacherSchedules = schedules.filter(s => s.teacherId === t.id && s.id !== scheduleId);
        const hasConflict = teacherSchedules.some(s => 
          s.dayOfWeek === scheduleTime.dayOfWeek &&
          !(s.endSection < scheduleTime.startSection || s.startSection > scheduleTime.endSection)
        );
        return { teacher: t, hasConflict };
      });
      
      const availableTeacher = teacherConflicts.find(t => !t.hasConflict);
      if (availableTeacher) {
        newTeacher = availableTeacher.teacher;
      } else {
        newTeacher = availableTeachers[Math.floor(Math.random() * availableTeachers.length)];
      }
    }
  }
  
  // 保存旧信息
  const oldCourseId = schedule.courseId;
  const oldTeacherId = schedule.teacherId;
  const oldClassId = schedule.classId;
  
  // 更新字段
  if (newCourse) schedule.courseId = newCourseId;
  if (newTeacher) schedule.teacherId = newTeacher.id;
  if (newClass) schedule.classId = newClass.id;
  
  // 检查冲突
  const conflicts = checkScheduleConflicts(schedule, schedules.filter(s => s.id !== scheduleId));
  
  if (conflicts.length > 0) {
    schedule.courseId = oldCourseId;
    schedule.teacherId = oldTeacherId;
    schedule.classId = oldClassId;
    
    return {
      success: false,
      error: '更换后存在冲突',
      conflicts
    };
  }
  
  db.write('schedules', schedules);
  
  const changes = [];
  if (newCourse) changes.push(`课程: ${newCourse.name}`);
  if (newTeacher) changes.push(`教师: ${newTeacher.name}`);
  if (newClass) changes.push(`班级: ${newClass.name}`);
  
  return {
    success: true,
    message: '课程已更换' + (changes.length > 0 ? ' - ' + changes.join(', ') : ''),
    schedule,
    changes
  };
}

// 执行删除课程安排
async function executeDeleteSchedule(params) {
  const { scheduleId, clearAll, teacherName, className, dayOfWeek, startSection, endSection } = params;
  
  let schedules = db.read('schedules');
  const initialCount = schedules.length;
  const classes = db.read('classes');
  
  // 清空所有课程
  if (clearAll) {
    db.write('schedules', []);
    return {
      success: true,
      message: `已清空所有 ${initialCount} 门课程安排`
    };
  }
  
  // 根据条件筛选要删除的课程
  let toDelete = schedules;
  
  if (scheduleId) {
    // 删除指定ID的课程
    toDelete = schedules.filter(s => s.id === scheduleId);
  } else {
    // 根据条件筛选
    if (teacherName) {
      toDelete = toDelete.filter(s => s.teacherName === teacherName);
    }
    // 处理 className → classId 映射
    if (className) {
      const cls = classes.find(c => c.name === className);
      if (cls) {
        toDelete = toDelete.filter(s => s.classId === cls.id);
      } else {
        return { success: false, error: `找不到班级: ${className}` };
      }
    } else if (className === undefined) {
      // 未指定班级，跳过班级筛选
    }
    
    if (dayOfWeek) {
      toDelete = toDelete.filter(s => s.dayOfWeek === dayOfWeek);
    }
    if (startSection !== undefined && endSection !== undefined) {
      toDelete = toDelete.filter(s => s.startSection === startSection && s.endSection === endSection);
    } else if (startSection !== undefined) {
      toDelete = toDelete.filter(s => s.startSection === startSection);
    }
  }
  
  if (toDelete.length === 0) {
    return { success: false, error: '找不到符合条件的课程安排' };
  }
  
  // 删除筛选出的课程
  const deleteIds = toDelete.map(s => s.id);
  schedules = schedules.filter(s => !deleteIds.includes(s.id));
  
  db.write('schedules', schedules);
  
  return {
    success: true,
    message: `已删除 ${toDelete.length} 门课程安排`
  };
}

// 执行冲突检查
async function executeCheckConflicts(params) {
  const schedules = db.read('schedules');
  const conflicts = [];
  
  // 检查所有课程之间的冲突
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const s1 = schedules[i];
      const s2 = schedules[j];
      
      // 检查时间重叠
      if (s1.dayOfWeek !== s2.dayOfWeek) continue;
      
      const overlap = !(s1.endSection < s2.startSection || s1.startSection > s2.endSection);
      if (!overlap) continue;
      
      // 检查周次重叠
      const weeks1 = parseWeeks(s1.weeks);
      const weeks2 = parseWeeks(s2.weeks);
      const weeksOverlap = weeks1.some(w => weeks2.includes(w));
      if (!weeksOverlap) continue;
      
      // 检查冲突类型
      if (s1.classId === s2.classId) {
        conflicts.push({
          type: '班级冲突',
          description: `${s1.className} 在 周${s1.dayOfWeek}第${s1.startSection}-${s1.endSection}节 同时有 ${s1.courseName} 和 ${s2.courseName}`
        });
      }
      
      if (s1.teacherId === s2.teacherId) {
        conflicts.push({
          type: '教师冲突',
          description: `${s1.teacherName} 在 周${s1.dayOfWeek}第${s1.startSection}-${s1.endSection}节 同时有 ${s1.courseName} 和 ${s2.courseName}`
        });
      }
      
      if (s1.classroomId === s2.classroomId) {
        conflicts.push({
          type: '教室冲突',
          description: `${s1.classroomName} 在 周${s1.dayOfWeek}第${s1.startSection}-${s1.endSection}节 同时被 ${s1.courseName} 和 ${s2.courseName} 占用`
        });
      }
    }
  }
  
  if (conflicts.length === 0) {
    return {
      success: true,
      message: '✅ 未发现冲突，当前课表安排合理！',
      conflicts: []
    };
  }
  
  return {
    success: true,
    message: `⚠️ 发现 ${conflicts.length} 处冲突，请尽快处理：`,
    conflicts
  };
}

// 执行智能排课（优化版）
async function executeAutoSchedule(params) {
  const { courseIds, teacherConstraint, classroomConstraint, className, week, courseRequirements } = params;
  
  const courses = db.read('courses');
  const teachers = db.read('teachers');
  const classrooms = db.read('classrooms');
  const classes = db.read('classes');
  let schedules = [];
  
  const results = [];
  const conflicts = [];
  
  // 教师每天课程数统计
  const teacherDayCount = {};
  teachers.forEach(t => {
    teacherDayCount[t.id] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  });
  
  // 根据参数筛选班级
  let targetClasses = classes;
  if (className) {
    targetClasses = classes.filter(c => c.name === className);
    if (targetClasses.length === 0) {
      return { success: false, error: `找不到班级: ${className}` };
    }
  }
  
  // 为每个班级分别排课
  for (const cls of targetClasses) {
    // 获取该班级的课程
    let classCourses = [];
    
    if (courseRequirements && courseRequirements.length > 0) {
      // 根据课程要求选择课程
      for (const req of courseRequirements) {
        // 支持 category 或 course 字段（兼容 AI 返回的不同格式）
        const categoryName = req.category || req.course;
        const catCourses = courses.filter(c => c.category === categoryName || c.name.includes(categoryName));
        // 随机选择指定数量的课程
        const selected = catCourses.sort(() => Math.random() - 0.5).slice(0, req.count);
        classCourses.push(...selected);
      }
    } else if (courseIds) {
      classCourses = courses.filter(c => courseIds.includes(c.id));
    } else {
      classCourses = getDiverseCourses(courses, 6); // 每个班级安排6门不同类别的课程
    }
    
    // 每天已安排的课程类别（确保每天课程多样性）
    const dayCategories = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    const daySections = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let fullDayCount = 0;
    
    // 单双周课程计数
    let singleWeekCount = 0;
    let doubleWeekCount = 0;
    
    // 先确保每天有至少2个时间段（4节课）
    const minSectionsPerDay = 2;
    
    // 为每门课程安排时间
    for (const course of classCourses) {
      // 找到能教这门课的老师
      const availableTeachers = teachers.filter(t => t.subject === course.category);
      if (availableTeachers.length === 0) continue;
      
      // 尝试安排课程
      let scheduled = false;
      
      // 优先选择课程数较少的天，确保每天至少有4节课
      const daysWithCount = [1, 2, 3, 4, 5].map(day => ({ day, count: daySections[day] }));
      daysWithCount.sort((a, b) => a.count - b.count);
      const sortedDays = daysWithCount.map(d => d.day);
      
      for (const day of sortedDays) {
        if (scheduled) break;
        
        // 检查是否已经有满课日（8节），且当前天也会满课
        if (fullDayCount >= 1 && daySections[day] >= 4) continue;
        
        // 每天最多4个时间段（8节课）
        if (daySections[day] >= 4) continue;
        
        // 如果其他天还没有达到最少课程数，优先安排那些天
        const otherDaysMin = Math.min(...[1,2,3,4,5].filter(d => d !== day).map(d => daySections[d]));
        if (daySections[day] >= minSectionsPerDay && otherDaysMin < minSectionsPerDay) continue;
        
        // 检查当天是否已经有相同类别的课程（确保课程多样性）
        if (dayCategories[day].includes(course.category)) continue;
        
        // 可用的节次
        const validSections = [[1,2], [3,4], [5,6], [7,8]];
        
        for (const section of validSections.sort(() => Math.random() - 0.5)) {
          if (scheduled) break;
          
          // 如果指定了具体周数，只排该周；否则单双周平衡分配
          let weeks;
          if (week && typeof week === 'number') {
            // 单周或双周
            if (week % 2 === 1) {
              weeks = String(week);
            } else {
              weeks = String(week);
            }
          } else {
            // 单双周平衡分配
            if (singleWeekCount <= doubleWeekCount) {
              weeks = '1,3,5,7,9,11,13,15';
            } else {
              weeks = '2,4,6,8,10,12,14,16';
            }
          }
          
          // 选择教师（优先选择当天课程数少于4节的教师）
          const suitableTeachers = availableTeachers.filter(t => teacherDayCount[t.id][day] < 4);
          if (suitableTeachers.length === 0) continue;
          
          const teacher = suitableTeachers[Math.floor(Math.random() * suitableTeachers.length)];
          
          // 随机选择教室
          const suitableRooms = classrooms.filter(r => r.capacity >= 30);
          const room = suitableRooms[Math.floor(Math.random() * suitableRooms.length)];
          
          const newSchedule = {
            id: 'SCH' + String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000),
            courseId: course.id,
            teacherId: teacher.id,
            classroomId: room.id,
            classId: cls.id,
            dayOfWeek: day,
            startSection: section[0],
            endSection: section[1],
            weeks: weeks,
            weekType: weeks === '1,3,5,7,9,11,13,15' ? 'single' : (weeks === '2,4,6,8,10,12,14,16' ? 'double' : 'single')
          };
          
          // 检查冲突
          const conflict = checkScheduleConflicts(newSchedule, schedules);
          if (conflict.length === 0) {
            schedules.push(newSchedule);
            results.push(newSchedule);
            daySections[day] += 1;
            dayCategories[day].push(course.category);
            teacherDayCount[teacher.id][day] += 1;
            
            // 更新满课天数
            if (daySections[day] >= 4) {
              fullDayCount += 1;
            }
            
            // 更新单双周计数
            if (weeks === '1,3,5,7,9,11,13,15') {
              singleWeekCount += 1;
            } else {
              doubleWeekCount += 1;
            }
            
            scheduled = true;
          } else {
            conflicts.push({ schedule: newSchedule, conflicts: conflict });
          }
        }
      }
      
      if (!scheduled) {
        console.log(`无法为 ${cls.name} 安排课程: ${course.name}`);
      }
    }
  }
  
  // 保存排课结果
  db.write('schedules', schedules);
  
  return {
    success: true,
    message: `自动排课完成！成功安排 ${results.length} 门课程，冲突 ${conflicts.length} 次`,
    schedules: results,
    scheduledCount: results.length,
    conflictCount: conflicts.length
  };
}

// 检查排课冲突
function checkScheduleConflicts(schedule, otherSchedules) {
  const conflicts = [];
  
  for (const other of otherSchedules) {
    // 检查时间重叠
    if (schedule.dayOfWeek !== other.dayOfWeek) continue;
    
    const overlap = !(schedule.endSection < other.startSection || 
                      schedule.startSection > other.endSection);
    
    if (!overlap) continue;
    
    // 检查周次重叠
    const weeks1 = parseWeeks(schedule.weeks);
    const weeks2 = parseWeeks(other.weeks);
    const weeksOverlap = weeks1.some(w => weeks2.includes(w));
    
    if (!weeksOverlap) continue;
    
    // 冲突类型
    if (schedule.teacherId === other.teacherId) {
      conflicts.push({
        type: 'teacher',
        message: '教师冲突: 与 ' + other.courseName + ' 时间重叠',
        with: other
      });
    }
    
    if (schedule.classroomId === other.classroomId) {
      conflicts.push({
        type: 'classroom',
        message: '教室冲突: 与 ' + other.courseName + ' 争夺 ' + other.classroomName,
        with: other
      });
    }
    
    if (schedule.classId === other.classId) {
      conflicts.push({
        type: 'class',
        message: '班级冲突: ' + other.className + ' 同一时间有两节课',
        with: other
      });
    }
  }
  
  return conflicts;
}

// 解析周次字符串 "1-16" 或 "1,3,5" 为数组
function parseWeeks(weeksStr) {
  if (!weeksStr) return [];
  
  const weeks = [];
  const parts = weeksStr.split(',');
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) weeks.push(i);
    } else {
      weeks.push(Number(part));
    }
  }
  
  return weeks;
}

// ============ AI 模型配置接口 ============
app.get('/api/ai/model', (req, res) => {
  res.json({
    provider: aiModelConfig.provider,
    model: aiModelConfig.model,
    availableProviders: [
      { id: 'codingplan', name: 'CodingPlan Qwen3', models: ['qwen3-max-2026-01-23', 'kimi-k2.5'] },
      { id: 'ollama', name: '本地 Ollama', models: ['qwen3:4b', 'llama3'] },
      { id: 'openclaw', name: 'OpenClaw', models: ['kimi-k2.5'] }
    ]
  });
});

app.post('/api/ai/model', (req, res) => {
  const { provider, model } = req.body;
  if (!provider || !model) {
    return res.status(400).json({ error: '请提供 provider 和 model' });
  }
  
  const validProviders = ['codingplan', 'ollama', 'openclaw'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: '无效的 provider' });
  }
  
  aiModelConfig.provider = provider;
  aiModelConfig.model = model;
  
  console.log(`AI 模型已切换: ${provider} / ${model}`);
  res.json({ success: true, provider, model });
});

// ============ 意图识别（方案 C：外部意图识别调用） ============
/**
 * 使用 qwen3-coder-next 快速识别用户意图
 * @param {string} input - 用户输入
 * @returns {string} - 识别出的意图
 */
async function recognizeIntentByQwen(input) {
  try {
    const apiKey = aiModelConfig.apiKey;
    // 使用 CodingPlan 端点（与主模型相同）
    const response = await fetch('https://coding.dashscope.aliyuncs.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3-coder-next',
        messages: [
          {
            role: 'system',
            content: '你是意图识别助手。根据用户指令返回意图：\n- 查询课表（查看、查询、看看、显示、look、show、get等）\n- 互换课程（互换、交换、swap）\n- 删除课程（删除、取消、清空、delete、remove）\n- 调整排课（移动、调到、改到、move）\n- 自动排课（排课、安排课程、schedule）\n- 检查冲突（冲突、检查、check）\n- 其他\n注意："房间"、"教室"、"room"也是查询课表。只返回意图名称，不要解释。'
          },
          {
            role: 'user',
            content: `用户指令：${input}`
          }
        ],
        temperature: 0.0,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      console.log('意图识别 API 调用失败，回退到关键词匹配');
      // 简单关键词匹配
      const inputLower = input.toLowerCase();
      if (inputLower.includes('互换') || inputLower.includes('交换')) return 'swap';
      if (inputLower.includes('查询') || inputLower.includes('查看') || inputLower.includes('看看') || inputLower.includes('查')) return 'query';
      if (inputLower.includes('删除') || inputLower.includes('取消')) return 'delete';
      if (inputLower.includes('移动') || inputLower.includes('调到')) return 'move';
      if (inputLower.includes('排课')) return 'auto';
      if (inputLower.includes('冲突') || inputLower.includes('检查')) return 'check';
      if (inputLower.includes('教室') || inputLower.includes('教师') || inputLower.includes('班级')) return 'query';
      return 'other';
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('[意图识别原始结果]', content);
    
    // 映射中文意图到英文 intent
    const intentMap = {
      '查询课表': 'query',
      '查询': 'query',
      '查看': 'query',
      '调整排课': 'move',
      '移动': 'move',
      '调到': 'move',
      '互换课程': 'swap',
      '互换': 'swap',
      '交换': 'swap',
      '替换课程': 'replace',
      '替换': 'replace',
      '删除课程': 'delete',
      '取消': 'delete',
      '删除': 'delete',
      '清空': 'delete',
      '自动排课': 'auto',
      '排课': 'auto',
      '检查冲突': 'check',
      '检查': 'check',
      '冲突': 'check',
      '其他': 'other'
    };
    
    for (const [keyword, intent] of Object.entries(intentMap)) {
      if (content.includes(keyword)) {
        return intent;
      }
    }
    
    // 二次校验：如果模型返回"其他"，检查输入中是否包含关键词
    const inputLower = input.toLowerCase();
    // 中文关键词
    if (inputLower.includes('互换') || inputLower.includes('交换')) return 'swap';
    if (inputLower.includes('查询') || inputLower.includes('查看') || inputLower.includes('看看') || inputLower.includes('查')) return 'query';
    if (inputLower.includes('删除') || inputLower.includes('取消')) return 'delete';
    if (inputLower.includes('移动') || inputLower.includes('调到')) return 'move';
    if (inputLower.includes('排课')) return 'auto';
    if (inputLower.includes('冲突') || inputLower.includes('检查')) return 'check';
    if (inputLower.includes('教室') || inputLower.includes('教师') || inputLower.includes('班级') || inputLower.includes('房间')) return 'query';
    // 英文关键词
    if (inputLower.includes('look') || inputLower.includes('show') || inputLower.includes('get') || inputLower.includes('list')) return 'query';
    if (inputLower.includes('swap') || inputLower.includes('exchange')) return 'swap';
    if (inputLower.includes('delete') || inputLower.includes('remove') || inputLower.includes('clear')) return 'delete';
    if (inputLower.includes('move')) return 'move';
    if (inputLower.includes('schedule') || inputLower.includes('arrange')) return 'auto';
    if (inputLower.includes('check') || inputLower.includes('conflict')) return 'check';
    if (inputLower.includes('room') || inputLower.includes('classroom') || inputLower.includes('teacher')) return 'query';
    
    console.log('意图识别结果未匹配:', content);
    return 'other';
  } catch (error) {
    console.log('意图识别异常，回退到关键词匹配:', error.message);
    // 异常时的关键词匹配
    const inputLower = input.toLowerCase();
    if (inputLower.includes('互换') || inputLower.includes('交换') || inputLower.includes('swap')) return 'swap';
    if (inputLower.includes('查询') || inputLower.includes('查看') || inputLower.includes('看看') || inputLower.includes('查') || inputLower.includes('look') || inputLower.includes('show') || inputLower.includes('get')) return 'query';
    if (inputLower.includes('删除') || inputLower.includes('取消') || inputLower.includes('delete') || inputLower.includes('remove')) return 'delete';
    if (inputLower.includes('移动') || inputLower.includes('调到') || inputLower.includes('move')) return 'move';
    if (inputLower.includes('排课') || inputLower.includes('schedule')) return 'auto';
    if (inputLower.includes('冲突') || inputLower.includes('检查') || inputLower.includes('check')) return 'check';
    if (inputLower.includes('教室') || inputLower.includes('教师') || inputLower.includes('班级') || inputLower.includes('房间') || inputLower.includes('room') || inputLower.includes('teacher') || inputLower.includes('老师')) return 'query';
    return 'other';
  }
}

// =
app.listen(PORT, () => {
  console.log('✅ 后端服务已启动: http://localhost:' + PORT);
  console.log('🤖 AI 对话接口: http://localhost:' + PORT + '/api/ai/chat');
  console.log('   当前模型: ' + aiModelConfig.provider + ' / ' + aiModelConfig.model);
});