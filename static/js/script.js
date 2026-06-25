const DB = {
    users: [],
    subjects: [],
    groups: [],
    teachers: [],
    classrooms: [
        "101", "102", "103", "104", "105", "106", "107", "110", "111", "112", "113", "114", "115", "116", "117", "118", "119", "120",
        "121", "122", "123", "124", "125", "201", "202", "205", "206", "207", "208", "210", "212",
        "301", "302", "303", "305", "306", "307", "308", "309",
        "401", "402", "403",
        "Спортзал"
    ],
    homeworks: [],
    journalData: {},
    activeTemplates: {},
    archiveWeeks: {}
};

const timeSlots = ["08:00 – 09:30", "09:40 – 11:10", "11:30 – 13:00", "13:10 – 14:40", "14:50 – 16:20", "16:30 – 18:00", "18:10 – 19:40"];
const daysNames = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const PERIOD_NAMES = {
    'study': 'Обучение по дисциплинам и МДК',
    'practice-u': 'Учебная практика',
    'practice-p': 'Производственная практика',
    'practice-d': 'Преддипломная практика',
    'exam': 'Промежуточная аттестация',
    'diploma-prep': 'Подготовка ВКР',
    'diploma-defense': 'Защита ВКР',
    'vacation': 'Каникулы'
};

function getWeekDates(startDateStr, weeksCount) {
    let dates = [];
    let current = new Date(startDateStr);
    for (let i = 0; i < weeksCount; i++) {
        let weekStart = new Date(current);
        let weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 5);
        dates.push({
            weekNum: (i % 2) + 1,
            start: weekStart.toISOString().split('T')[0],
            end: weekEnd.toISOString().split('T')[0],
            days: Array.from({length: 6}, (_, j) => {
                let d = new Date(weekStart);
                d.setDate(d.getDate() + j);
                return { day: daysNames[j], date: d.toISOString().split('T')[0] };
            })
        });
        current.setDate(current.getDate() + 7);
    }
    return dates;
}

const app = {
    currentUser: null,
    selectedStudentId: null,
    currentWeek: 1,
    currentWeekIndex: 0,
    currentWeekData: null,
    systemDate: new Date(),
    displayDate: new Date(),
    currentSchedGroupId: "",
    tempSchedTemplate: null,
    isSchedEditing: false,
    studentWeekOffset: 0,
    parentWeekOffset: 0,
    isAcademicProcessActive: false,
    currentPeriodType: 'study',
    academicPeriods: [],
    relevantWeeks: [],

    async init() {
        document.getElementById('view-login').classList.remove('hidden');
        await this.updateCurrentWeek();
        await this.loadSubjects();
        await this.loadGroups();
        await this.loadTeachers();
        this.populateSchedGroupSelect();
    },

    async loadSubjects() {
        try {
            const res = await fetch('/api/subjects');
            DB.subjects = await res.json();
        } catch (e) { console.error(e); }
    },
    async loadGroups() {
        try {
            const res = await fetch('/api/groups');
            DB.groups = await res.json();
            this.populateSchedGroupSelect();
        } catch (e) { console.error(e); }
    },
    async loadTeachers() {
        try {
            const res = await fetch('/api/teachers');
            DB.teachers = await res.json();
        } catch (e) { console.error(e); }
    },

    populateSchedGroupSelect() {
        const sel = document.getElementById('sched-group-filter');
        if (sel) sel.innerHTML = '<option value="">Выберите группу</option>' + DB.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    },

    async updateCurrentWeek() {
        const now = this.systemDate;
        this.displayDate = new Date(now);
        const day = this.displayDate.getDay();
        const diff = this.displayDate.getDate() - day + (day === 0 ? -6 : 1);
        this.displayDate.setDate(diff);

        const groupId = this.currentUser?.group_id;
        if (!groupId) {
            this.isAcademicProcessActive = true;
            this.currentPeriodType = 'study';
            this.generateWeekData(this.displayDate);
            return;
        }

        try {
            const res = await fetch(`/api/academic-periods/${groupId}`);
            const periods = await res.json();
            this.academicPeriods = periods;

            const currentPeriod = periods.find(p =>
                new Date(p.start) <= now && new Date(p.end) >= now
            );

            if (currentPeriod) {
                this.currentPeriodType = currentPeriod.type;
                this.isAcademicProcessActive = (currentPeriod.type === 'study');
            } else {
                this.currentPeriodType = 'vacation';
                this.isAcademicProcessActive = false;
            }
            this.generateWeekData(this.displayDate);
        } catch (e) {
            console.error(e);
            this.isAcademicProcessActive = true;
            this.currentPeriodType = 'study';
            this.generateWeekData(this.displayDate);
        }
    },

        generateWeekData(date) {
        const start = new Date(date);

        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        
        const end = new Date(start);
        end.setDate(end.getDate() + 5);

        let baseDate = new Date(start.getFullYear(), 8, 1); // 1 Сентября
        if (start < baseDate) {
            baseDate = new Date(start.getFullYear() - 1, 8, 1);
        }

        const oneWeek = 7 * 24 * 60 * 60 * 1000;
  
        const weekDiff = Math.round((start - baseDate) / oneWeek);
       
        const weekNum = (weekDiff % 2 === 0) ? 1 : 2;

        this.currentWeekData = {
            weekNum: weekNum,
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
            days: Array.from({length: 6}, (_, j) => {
                let d = new Date(start);
                d.setDate(d.getDate() + j);
                return { day: daysNames[j], date: d.toISOString().split('T')[0] };
            })
        };
    },

    async navigateWeek(direction) {
        const newDate = new Date(this.displayDate);
        newDate.setDate(newDate.getDate() + (direction * 7));
        const checkDate = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());

        const groupId = this.currentUser?.group_id;
        if (groupId) {
            if (this.academicPeriods.length > 0) {
                const minDate = new Date(Math.min(...this.academicPeriods.map(p => new Date(p.start))));
                const maxDate = new Date(Math.max(...this.academicPeriods.map(p => new Date(p.end))));
                if (checkDate < minDate || checkDate > maxDate) {
                    this.showToast('Навигация ограничена учебным периодом');
                    return;
                }
            }

            const res = await fetch(`/api/schedule/check-next?group_id=${groupId}&target_date=${checkDate.toISOString().split('T')[0]}`);
            const data = await res.json();
            if (!data.has_period) {
                this.showToast('Дальнейшая навигация недоступна');
                return;
            }
        }

        this.displayDate = newDate;
        this.generateWeekData(this.displayDate);

        if (groupId && this.academicPeriods.length > 0) {
            const period = this.academicPeriods.find(p =>
                new Date(p.start) <= checkDate && new Date(p.end) >= checkDate
            );
            if (period) {
                this.currentPeriodType = period.type;
                this.isAcademicProcessActive = (period.type === 'study');
            } else {
                this.currentPeriodType = 'vacation';
                this.isAcademicProcessActive = false;
            }
        }
        this.renderStudentSchedule();
    },

    resetToCurrentWeek() {
        this.updateCurrentWeek().then(() => this.renderStudentSchedule());
    },

    async login() {
        const l = document.getElementById('login-user').value.toLowerCase().trim();
        const p = document.getElementById('login-pass').value.trim();
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: l, password: p })
            });
            const data = await response.json();
            if (data.success) {
                this.currentUser = data.user;
                document.getElementById('view-login').classList.add('hidden');
                await this.loadUsersFromServer();
                await this.updateCurrentWeek();
                this.switchRole(data.user.role);
                this.showToast(`Добро пожаловать, ${data.user.name.split(' ')[1]}!`);
            } else {
                this.showToast(data.message || 'Неверный логин или пароль');
            }
        } catch (error) {
            this.showToast('Ошибка соединения с сервером');
        }
    },

    async loadUsersFromServer() {
        try {
            const response = await fetch('/api/users');
            DB.users = await response.json();
        } catch (error) {
            console.error(error);
        }
    },

    switchRole(role) {
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.getElementById('app-header').classList.remove('hidden');
        const user = this.currentUser;
        document.getElementById('user-name-display').innerText = user.name;
        document.getElementById('user-role-display').innerText =
            user.role === 'student' ? 'Студент' :
            user.role === 'parent' ? 'Родитель' :
            user.role === 'teacher' ? 'Преподаватель' : 'Администратор';
        document.getElementById(`view-${role}`).classList.remove('hidden');

        if (role === 'student') {
            this.studentWeekOffset = 0;
            this.backToStudentDashboard();
            this.renderStudentSchedule();
        }
        if (role === 'parent') {
            this.parentWeekOffset = 0;
            this.backToParentDashboard();
            this.initParentView(user.id);
        }
        if (role === 'teacher') {
            this.populateTeacherSelects();
            this.renderTeacherJournal();
            this.updateHwModalContext();
        }
        if (role === 'admin') {
            this.renderAdminPanel();
        }
    },

    logout() {
        this.currentUser = null;
        document.getElementById('app-header').classList.add('hidden');
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-login').classList.remove('hidden');
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
    },

    showToast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    },
    calcAvg(grades) {
        const valid = grades.filter(g => g && g !== "Н" && !isNaN(g));
        if (valid.length === 0) return "-";
        return (valid.reduce((a, b) => a + Number(b), 0) / valid.length).toFixed(1);
    },
    gradeBadge(g) {
        if (!g) return '';
        return `<span class="grade-badge g-${g}">${g}</span>`;
    },
    toggleHwText(hwId) {
        const textEl = document.getElementById(`hw-full-${hwId}`);
        const btn = document.getElementById(`btn-hw-${hwId}`);
        if (textEl && btn) {
            textEl.classList.toggle('expanded');
            btn.innerText = textEl.classList.contains('expanded') ? 'Свернуть' : 'Раскрыть';
        }
    },

    getPeriodForDate(dateStr) {
        const d = new Date(dateStr);
        return this.academicPeriods.find(p =>
            new Date(p.start) <= d && new Date(p.end) >= d
        );
    },

    async renderStudentSchedule(weekData = null) {
        const container = document.getElementById('student-schedule-container');
        const displayWeekData = weekData || this.currentWeekData;

        if (displayWeekData) {
            document.getElementById('student-week-label').innerHTML =
                `Неделя: ${displayWeekData.start.split('-').reverse().join('.')} – ${displayWeekData.end.split('-').reverse().join('.')} (${displayWeekData.weekNum})`;
        }

        if (!displayWeekData) {
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);"><h3>📅 На этой неделе нет занятий</h3></div>`;
            return;
        }

        const period = this.getPeriodForDate(displayWeekData.start);

        if (!period || period.type !== 'study') {
            const statusText = period ? PERIOD_NAMES[period.type] : '📅 Период не определён';
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);"><h3>${statusText}</h3><p style="margin-top:1rem;">${displayWeekData.start.split('-').reverse().join('.')} – ${displayWeekData.end.split('-').reverse().join('.')}</p></div>`;
            return;
        }

        try {
            const weekType = displayWeekData.weekNum;
            const groupId = this.currentUser.group_id;

            const [scheduleRes, gradesRes, hwRes] = await Promise.all([
                fetch(`/api/schedule/${groupId}?week_type=${weekType}`),
                fetch(`/api/grades/${this.currentUser.id}?from=${displayWeekData.start}&to=${displayWeekData.end}`),
                fetch(`/api/homework/${groupId}?from=${displayWeekData.start}&to=${displayWeekData.end}`)
            ]);

            const schedule = await scheduleRes.json();

            const uniqueSchedule = [];
            const seenSlots = new Set();
            schedule.forEach(pair => {
                const slotKey = `${groupId}_${pair.day}_${pair.time}_${pair.subject_id}_${weekType}`;
                if (!seenSlots.has(slotKey)) {
                    seenSlots.add(slotKey);
                    uniqueSchedule.push(pair);
                }
            });

            if (uniqueSchedule.length === 0) {
                 container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);">
                    <h3>📝 Расписание ещё не заполнено</h3>
                    <p style="margin-top:1rem;">Обратитесь к администратору.</p>
                 </div>`;
                 return;
            }

            const grades = await gradesRes.json();
            const homeworks = await hwRes.json();

            const scheduleByDay = {};
            uniqueSchedule.forEach(pair => {
                if (!scheduleByDay[pair.day]) scheduleByDay[pair.day] = [];
                scheduleByDay[pair.day].push(pair);
            });

            const gradesByDateSubject = {};
            grades.forEach(g => {
                gradesByDateSubject[`${g.date}_${g.subject_id}`] = g.grade;
            });

            const hwByDate = {};
            homeworks.forEach(hw => {
                if (!hwByDate[hw.due_date]) hwByDate[hw.due_date] = [];
                hwByDate[hw.due_date].push(hw);
            });

            const renderedDays = displayWeekData.days.map((dayObj) => {
                const dayPairs = scheduleByDay[dayObj.day] || [];
                const dayHomeworks = hwByDate[dayObj.date] || [];
                if (dayPairs.length === 0 && dayHomeworks.length === 0) return '';

                return `<div class="day-block">
                    <div class="day-header"><span>${dayObj.day}</span> <span>${dayObj.date.split('-').reverse().join('.')}</span></div>
                    ${dayPairs.map(pair => {
                        const grade = gradesByDateSubject[`${dayObj.date}_${pair.subject_id}`];
                        const hasHw = dayHomeworks.some(hw => hw.subject_id === pair.subject_id);
                        return `<div class="lesson-row">
                            <div class="lesson-time">${pair.time}</div>
                            <div class="lesson-info">
                                <div class="lesson-title">${pair.subject} <span style="font-weight:400; color:var(--text-muted); font-size:0.85rem;">(${pair.type})</span></div>
                                <div class="hw-text">Аудитория: ${pair.classroom} | Преподаватель: ${pair.teacher}${hasHw ? ' | <span style="color:var(--warning)">📝 ДЗ</span>' : ''}</div>
                            </div>
                            ${grade ? this.gradeBadge(grade) : '<div style="width:32px"></div>'}
                        </div>`;
                    }).join('')}
                    ${dayHomeworks.length > 0 ? `<div style="padding: 12px 16px; background: #eff6ff; border-top: 1px solid var(--border);">
                        <div style="font-weight: 600; margin-bottom: 8px; font-size: 0.9rem;">📚 Домашние задания:</div>
                        ${dayHomeworks.map(hw => `<div style="font-size: 0.85rem; margin-bottom: 4px;"><b>${hw.subject}:</b> ${hw.text.length > 100 ? hw.text.substring(0, 100) + '...' : hw.text}</div>`).join('')}
                    </div>` : ''}
                </div>`;
            }).filter(Boolean);

            if (renderedDays.length === 0) {
                 container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);">
                    <h3>Пар нет</h3>
                    <p style="margin-top:1rem;">В этот день занятий не запланировано.</p>
                 </div>`;
            } else {
                container.innerHTML = renderedDays.join('');
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color:var(--danger); text-align:center; padding:2rem;">Ошибка загрузки данных</p>';
        }
    },

        async renderStudentGradesTable() {
        const start = document.getElementById('student-grade-start').value;
        const end = document.getElementById('student-grade-end').value;
        const tbody = document.getElementById('student-grades-table');

        try {
       
            const weekType = this.currentWeekData ? this.currentWeekData.weekNum : 1;
            
            const scheduleResponse = await fetch(`/api/schedule/${this.currentUser.group_id}?week_type=${weekType}`);
            const schedule = await scheduleResponse.json();
            
            const scheduleSubjectIds = [...new Set(schedule.map(s => s.subject_id))];
            
            const scheduleSubjects = DB.subjects.filter(sub => scheduleSubjectIds.includes(sub.id));

            const response = await fetch(`/api/grades/${this.currentUser.id}?from=${start}&to=${end}`);
            const grades = await response.json();

            const gradesBySubject = {};
  
            scheduleSubjects.forEach(sub => gradesBySubject[sub.id] = []);
            
            grades.forEach(g => {
                if (gradesBySubject[g.subject_id] !== undefined) {
                    gradesBySubject[g.subject_id].push(g.grade);
                }
            });

            let html = `<thead><tr><th>Предмет</th><th>Оценки за период</th><th>Средний балл</th></tr></thead><tbody>`;
            
            if (scheduleSubjects.length === 0) {
                html += `<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);">Нет предметов в расписании на текущую неделю (${weekType})</td></tr>`;
            } else {
                scheduleSubjects.forEach(sub => {
                    const subjectGrades = gradesBySubject[sub.id] || [];
                    const avg = this.calcAvg(subjectGrades);
                    html += `<tr><td>${sub.name}</td><td>${subjectGrades.map(g => this.gradeBadge(g)).join('') || '<span style="color:#ccc">-</span>'}</td><td><b>${avg}</b></td></tr>`;
                });
            }
            
            html += `</tbody>`;
            tbody.innerHTML = html;
        } catch (error) {
            console.error('Ошибка:', error);
            tbody.innerHTML = '<tr><td colspan="3" style="color:var(--danger)">Ошибка загрузки оценок</td></tr>';
        }
    },

    async renderStudentHwList() {
        const start = document.getElementById('student-hw-start').value;
        const end = document.getElementById('student-hw-end').value;
        try {
            const response = await fetch(`/api/homework/${this.currentUser.group_id}?from=${start}&to=${end}`);
            const homeworks = await response.json();
            const grouped = {};
            homeworks.forEach(hw => {
                if (!grouped[hw.due_date]) grouped[hw.due_date] = [];
                grouped[hw.due_date].push(hw);
            });
            const container = document.getElementById('student-hw-list');
            const sortedDates = Object.keys(grouped).sort();

            if (sortedDates.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); padding: 2rem; text-align: center;">Нет заданий за выбранный период.</p>';
                return;
            }

            container.innerHTML = sortedDates.map(date =>
                `<div class="hw-date-header">${date.split('-').reverse().join('.')}</div>` +
                grouped[date].map(hw => {
                    const needsToggle = hw.text.length > 80;
                    return `<div class="card" style="padding: 1rem; margin-bottom: 1rem;">
                        <div class="flex-between"><b>${hw.subject}</b>${hw.time ? `<span style="font-size:0.8rem; color:var(--text-muted);">(${hw.time})</span>` : ''}</div>
                        <div style="margin-top:0.5rem;">
                            <div class="hw-text" id="hw-full-${hw.id}">${hw.text}</div>
                            ${needsToggle ? `<button class="toggle-btn" id="btn-hw-${hw.id}" onclick="app.toggleHwText(${hw.id})">Раскрыть</button>` : ''}
                        </div>
                    </div>`;
                }).join('')
            ).join('');
        } catch (error) {
            document.getElementById('student-hw-list').innerHTML = '<p style="color:var(--danger)">Ошибка загрузки ДЗ</p>';
        }
    },

    initParentView(parentId) {
        const parent = DB.users.find(u => u.id === parentId);
        const select = document.getElementById('parent-student-select');
        select.innerHTML = '<option value="">-- Выберите студента --</option>';
        if (parent) {
            const children = DB.users.filter(u => u.parent_id === parentId && u.role === 'student');
            children.forEach(child => {
                const opt = document.createElement('option');
                opt.value = child.id;
                const group = DB.groups.find(g => g.id === child.group_id);
                opt.innerText = `${child.name} (${group ? group.name : '-'})`;
                select.appendChild(opt);
            });
        }
        document.getElementById('parent-content-area').classList.add('hidden');
        document.getElementById('parent-journal-btn').disabled = true;
        this.parentWeekOffset = 0;
    },

    async navigateParentWeek(direction) {
        const newDate = new Date(this.displayDate);
        newDate.setDate(newDate.getDate() + (direction * 7));
        const checkDate = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());

        const studentId = document.getElementById('parent-student-select').value;
        if (!studentId) return;

        const student = DB.users.find(u => u.id == studentId);
        const groupId = student?.group_id;

        if (groupId) {
            try {
                const periodsRes = await fetch(`/api/academic-periods/${groupId}`);
                const periods = await periodsRes.json();

                if (periods.length > 0) {
                    const minDate = new Date(Math.min(...periods.map(p => new Date(p.start))));
                    const maxDate = new Date(Math.max(...periods.map(p => new Date(p.end))));
                    if (checkDate < minDate || checkDate > maxDate) {
                        this.showToast('Навигация ограничена учебным периодом');
                        return;
                    }
                }

                const checkRes = await fetch(`/api/schedule/check-next?group_id=${groupId}&target_date=${checkDate.toISOString().split('T')[0]}`);
                const data = await checkRes.json();
                if (!data.has_period) {
                    this.showToast('Дальнейшая навигация недоступна');
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        }

        this.displayDate = newDate;
        this.generateWeekData(this.displayDate);

        if (studentId) this.renderParentData(studentId, this.currentWeekData);
    },

    resetParentToCurrentWeek() {
        this.parentWeekOffset = 0;
        this.updateCurrentWeek().then(() => {
            const studentId = document.getElementById('parent-student-select').value;
            if (studentId) this.renderParentData(studentId, this.currentWeekData);
        });
    },

    async renderParentData(studentId, weekData = null) {
        const container = document.getElementById('parent-content-area');
        const btn = document.getElementById('parent-journal-btn');
        if (!studentId) {
            container.classList.add('hidden');
            btn.disabled = true;
            return;
        }

        this.selectedStudentId = studentId;
        const student = DB.users.find(u => u.id == studentId);
        btn.disabled = false;
        container.classList.remove('hidden');

        const displayWeekData = weekData || this.currentWeekData;
        if (!displayWeekData) {
            container.innerHTML = '<p style="padding:2rem; text-align:center; color:var(--text-muted);">Учебный период завершен.</p>';
            return;
        }

        document.getElementById('parent-week-label').innerHTML =
            `Неделя: ${displayWeekData.start.split('-').reverse().join('.')} – ${displayWeekData.end.split('-').reverse().join('.')} (${displayWeekData.weekNum})`;

        const period = this.getPeriodForDate(displayWeekData.start);
        if (!period || period.type !== 'study') {
            const periodName = period ? PERIOD_NAMES[period.type] : 'Период не определён';
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);"><h3>${periodName}</h3><p style="margin-top:1rem;">${displayWeekData.start.split('-').reverse().join('.')} – ${displayWeekData.end.split('-').reverse().join('.')}</p></div>`;
            return;
        }

        try {
            const weekType = displayWeekData.weekNum;

            const [scheduleRes, gradesRes] = await Promise.all([
                fetch(`/api/schedule/${student.group_id}?week_type=${weekType}`),
                fetch(`/api/grades/${student.id}?from=${displayWeekData.start}&to=${displayWeekData.end}`)
            ]);

            const schedule = await scheduleRes.json();

            const uniqueSchedule = [];
            const seenSlots = new Set();
            schedule.forEach(pair => {
                const slotKey = `${student.group_id}_${pair.day}_${pair.time}_${pair.subject_id}_${weekType}`;
                if (!seenSlots.has(slotKey)) {
                    seenSlots.add(slotKey);
                    uniqueSchedule.push(pair);
                }
            });

            if (uniqueSchedule.length === 0) {
                 container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);">
                    <h3>Расписание не сформировано</h3>
                 </div>`;
                 return;
            }

            const grades = await gradesRes.json();

            const scheduleByDay = {};
            uniqueSchedule.forEach(pair => {
                if (!scheduleByDay[pair.day]) scheduleByDay[pair.day] = [];
                scheduleByDay[pair.day].push(pair);
            });

            const gradesMap = {};
            grades.forEach(g => {
                gradesMap[`${g.date}_${g.subject_id}`] = g.grade;
            });

            container.innerHTML = `
                <div class="subtitle" style="margin-bottom:1rem;">Успеваемость: ${student.name} (${displayWeekData.start.split('-').reverse().join('.')} – ${displayWeekData.end.split('-').reverse().join('.')} (${displayWeekData.weekNum}))</div>
                ${displayWeekData.days.map((dayObj) => {
                    const dayPairs = scheduleByDay[dayObj.day] || [];
                    if (dayPairs.length === 0) return '';
                    return `
                        <div class="day-block">
                            <div class="day-header"><span>${dayObj.day}</span> <span>${dayObj.date.split('-').reverse().join('.')}</span></div>
                            ${dayPairs.map(pair => {
                                const gradeKey = `${dayObj.date}_${pair.subject_id}`;
                                const grade = gradesMap[gradeKey];
                                return `
                                    <div class="lesson-row" style="align-items:center; justify-content: space-between;">
                                        <div class="lesson-info"><div class="lesson-title">${pair.subject}</div></div>
                                        ${grade ? this.gradeBadge(grade) : '<div style="width:32px; text-align:center; color:#ccc;">-</div>'}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).filter(Boolean).join('') || '<p style="padding:2rem; text-align:center; color:var(--text-muted);">На этой неделе нет занятий.</p>'}
            `;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color:var(--danger)">Ошибка загрузки данных</p>';
        }
    },

    async renderParentJournalTable() {
        const student = DB.users.find(u => u.id == this.selectedStudentId);
        const start = document.getElementById('parent-grade-start').value;
        const end = document.getElementById('parent-grade-end').value;
        const tbody = document.getElementById('parent-journal-table');

        try {
            const weekType = this.getWeekTypeByDate(new Date());
            const scheduleResponse = await fetch(`/api/schedule/${student.group_id}?week_type=${weekType}`);
            const schedule = await scheduleResponse.json();
            const scheduleSubjectIds = [...new Set(schedule.map(s => s.subject_id))];
            const scheduleSubjects = DB.subjects.filter(sub => scheduleSubjectIds.includes(sub.id));

            const response = await fetch(`/api/grades/${student.id}?from=${start}&to=${end}`);
            const grades = await response.json();

            const gradesBySubject = {};
            scheduleSubjects.forEach(sub => gradesBySubject[sub.id] = []);
            grades.forEach(g => {
                if (gradesBySubject[g.subject_id] !== undefined) gradesBySubject[g.subject_id].push(g.grade);
            });

            let html = `<thead><tr><th>Предмет</th><th>Оценки</th><th>Средний балл</th></tr></thead><tbody>`;
            scheduleSubjects.forEach(sub => {
                const subjectGrades = gradesBySubject[sub.id] || [];
                const avg = this.calcAvg(subjectGrades);
                html += `<tr><td>${sub.name}</td><td>${subjectGrades.map(g => this.gradeBadge(g)).join('') || '<span style="color:#ccc">-</span>'}</td><td><b>${avg}</b></td></tr>`;
            });
            html += `</tbody>`;
            tbody.innerHTML = html;
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="3" style="color:var(--danger)">Ошибка</td></tr>';
        }
    },

    async populateTeacherSelects() {
        const subjectSel = document.getElementById('teacher-subject-select');
        const groupSel = document.getElementById('teacher-group-select');
        const weekSel = document.getElementById('teacher-week-select');

        if (this.currentUser && this.currentUser.role === 'teacher') {
            try {
                const [subjectsRes, groupsRes] = await Promise.all([
                    fetch(`/api/teacher/${this.currentUser.id}/subjects`),
                    fetch(`/api/teacher/${this.currentUser.id}/groups`)
                ]);

                const subjects = await subjectsRes.json();
                const groups = await groupsRes.json();

                if (subjectSel) subjectSel.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                if (groupSel) groupSel.innerHTML = groups.map(g => `<option value="${g.id}">Группа ${g.name}</option>`).join('');

                let relevantWeeks = [];
                if (groups.length > 0) {
                    const firstGroupId = groups[0].id;
                    const periodsRes = await fetch(`/api/academic-periods/${firstGroupId}`);
                    const periods = await periodsRes.json();

                    if (periods.length > 0) {
                        const minDate = new Date(Math.min(...periods.map(p => new Date(p.start))));
                        const maxDate = new Date(Math.max(...periods.map(p => new Date(p.end))));
                        const weeksCount = Math.ceil((maxDate - minDate) / (7 * 24 * 60 * 60 * 1000)) + 1;
                        this.relevantWeeks = getWeekDates(minDate.toISOString().split('T')[0], weeksCount);
                    }
                }

                if (this.relevantWeeks.length === 0) {
                    const now = new Date();
                    const startDate = new Date(now.getFullYear() - 1, 8, 1);
                    this.relevantWeeks = getWeekDates(startDate.toISOString().split('T')[0], 104);
                }

                if (weekSel) {
                    weekSel.innerHTML = this.relevantWeeks.map((w, i) =>
                        `<option value="${i}">${w.start.split('-').reverse().join('.')} – ${w.end.split('-').reverse().join('.')} (${w.weekNum})</option>`
                    ).join('');

                    const now = new Date();
                    const currentIndex = this.relevantWeeks.findIndex(w =>
                        now >= new Date(w.start) && now <= new Date(w.end)
                    );
                    if (currentIndex !== -1) weekSel.selectedIndex = currentIndex;
                }

            } catch (error) {
                console.error('Ошибка загрузки данных преподавателя:', error);
            }
        } else {
            if (subjectSel) subjectSel.innerHTML = DB.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            if (groupSel) groupSel.innerHTML = DB.groups.map(g => `<option value="${g.id}">Группа ${g.name}</option>`).join('');
            if (weekSel) {
                const now = new Date();
                const startDate = new Date(now.getFullYear() - 1, 8, 1);
                const relevantWeeks = getWeekDates(startDate.toISOString().split('T')[0], 104);
                weekSel.innerHTML = relevantWeeks.map((w, i) =>
                    `<option value="${i}" ${i === this.currentWeekIndex ? 'selected' : ''}>${w.start.split('-').reverse().join('.')} – ${w.end.split('-').reverse().join('.')} (${w.weekNum})</option>`
                ).join('');
            }
        }
    },

    updateHwModalContext() {
        const subjectSel = document.getElementById('teacher-subject-select');
        const groupSel = document.getElementById('teacher-group-select');
        if (subjectSel && groupSel && subjectSel.options.length > 0 && groupSel.options.length > 0) {
            const subject = DB.subjects.find(s => s.id == subjectSel.value);
            const group = DB.groups.find(g => g.id == groupSel.value);
            document.getElementById('hw-modal-subject').innerText = subject ? subject.name : '';
            document.getElementById('hw-modal-group').innerText = group ? group.name : '';
        }
    },

    async renderTeacherJournal() {
        const subjectId = document.getElementById('teacher-subject-select').value;
        const groupId = document.getElementById('teacher-group-select').value;
        const table = document.getElementById('teacher-journal-table');

        if (!subjectId || !groupId) {
            table.innerHTML = '<tr><td colspan="100" style="text-align:center; color:var(--text-muted);">Выберите предмет и группу</td></tr>';
            return;
        }

        const weekIndex = parseInt(document.getElementById('teacher-week-select').value);
        const weekData = this.relevantWeeks[weekIndex];

        if (!weekData) {
            table.innerHTML = '<tr><td colspan="100" style="text-align:center; color:var(--danger);">Выберите неделю</td></tr>';
            return;
        }

        try {
            const periodsRes = await fetch(`/api/academic-periods/${groupId}`);
            const periods = await periodsRes.json();
            const weekStartDate = new Date(weekData.start);
            const currentPeriod = periods.find(p =>
                new Date(p.start) <= weekStartDate && new Date(p.end) >= weekStartDate
            );

            if (!currentPeriod || currentPeriod.type !== 'study') {
                const periodName = currentPeriod ? PERIOD_NAMES[currentPeriod.type] : 'Период не определён';
                table.innerHTML = `<tr><td colspan="100" style="text-align:center; padding: 3rem; color: var(--text-muted);"><h3>🚫 Выставление оценок недоступно</h3><p style="margin-top:1rem;">Текущий период: <b>${periodName}</b></p><p style="font-size: 0.9rem;">Оценки можно выставлять только в период "Обучение по дисциплинам и МДК"</p></td></tr>`;
                return;
            }
        } catch (e) {
            console.error('Ошибка проверки периода:', e);
            table.innerHTML = '<tr><td colspan="100" style="text-align:center; color:var(--danger);">Ошибка проверки периода</td></tr>';
            return;
        }

        const studentsInGroup = DB.users.filter(u => u.role === 'student' && u.group_id == groupId);
        if (studentsInGroup.length === 0) {
            table.innerHTML = '<tr><td colspan="100" style="text-align:center; color:var(--text-muted);">В группе нет студентов</td></tr>';
            return;
        }

        table.innerHTML = '<tr><td colspan="100" style="text-align:center">Загрузка расписания и оценок...</td></tr>';

        try {
            const weekType = weekData.weekNum;

            const scheduleRes = await fetch(`/api/schedule/${groupId}?week_type=${weekType}`);
            const schedule = await scheduleRes.json();

            const uniqueSchedule = [];
            const seenSlots = new Set();
            schedule.forEach(pair => {
                const slotKey = `${groupId}_${pair.day}_${pair.time}_${pair.subject_id}_${weekType}`;
                if (!seenSlots.has(slotKey)) {
                    seenSlots.add(slotKey);
                    uniqueSchedule.push(pair);
                }
            });

            const subjectSchedule = uniqueSchedule.filter(s => s.subject_id == subjectId);

            const allDays = daysNames.map(day => {
                const pairs = subjectSchedule.filter(s => s.day === day);
                return { day, pairs };
            });

            const gradesData = {};
            for (const student of studentsInGroup) {
                const res = await fetch(`/api/grades/${student.id}`);
                const grades = await res.json();
                gradesData[student.id] = grades.filter(g => g.subject_id == subjectId);
            }

            let html = `<thead><tr><th>Ф.И.О. студента</th>`;

            allDays.forEach(({ day, pairs }) => {
                if (pairs.length === 0) {
                    html += `<th>${day} <span style="color:#999;font-size:0.8rem">—</span></th>`;
                } else {
                    pairs.forEach((lesson, idx) => {
                        const dayDate = weekData.days.find(d => d.day === day);
                        const dateStr = dayDate ? dayDate.date.slice(5) : day;
                        const timeLabel = pairs.length > 1 ? `<br><small>${lesson.time.split('–')[0].trim()}</small>` : '';
                        html += `<th>${day} ${dateStr}${timeLabel}</th>`;
                    });
                }
            });

            html += `</tr></thead><tbody>`;

            studentsInGroup.forEach(student => {
                html += `<tr><td>${student.name}</td>`;

                allDays.forEach(({ day, pairs }) => {
                    if (pairs.length === 0) {
                        html += `<td style="background:#f8fafc; color:#94a3b8; text-align:center; font-size:0.85rem;">пар нет</td>`;
                        return;
                    }

                    pairs.forEach(lesson => {
                        const dayDate = weekData.days.find(d => d.day === day);
                        const dateStr = dayDate ? dayDate.date : null;

                        if (dateStr) {
                            const gradeObj = gradesData[student.id].find(g => g.date === dateStr);
                            const val = gradeObj ? gradeObj.grade : "";
                            const timeLabel = lesson.time.split('–')[0].trim();
                            html += `
                                <td>
                                    <div style="font-size:0.7rem;color:#666;margin-bottom:2px;">${timeLabel}</div>
                                    <input type="text" value="${val}" maxlength="2"
                                           onchange="app.updateGrade(${student.id}, ${subjectId}, '${dateStr}', '${timeLabel}', this.value)"
                                           style="width: 100%; padding: 8px; border: 2px solid var(--primary); border-radius: 4px; text-align: center; font-size: 1rem;">
                                </td>
                            `;
                        } else {
                            html += `<td style="background:#f8fafc; color:#94a3b8; text-align:center;">пары нет</td>`;
                        }
                    });
                });

                html += `</tr>`;
            });

            html += `</tbody>`;
            table.innerHTML = html;
        } catch (error) {
            console.error('Ошибка:', error);
            table.innerHTML = '<tr><td colspan="100" style="text-align:center; color:var(--danger);">Ошибка загрузки данных</td></tr>';
        }
    },

    async updateGrade(studentId, subjectId, date, timeLabel, val) {
        try {
            const response = await fetch('/api/grades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: studentId,
                    subject_id: subjectId,
                    date: date,
                    grade: val.trim().toUpperCase()
                })
            });
            const data = await response.json();
            if (!data.success) this.showToast('Ошибка: ' + (data.message || 'Неизвестная ошибка'));
        } catch (error) {
            this.showToast('Ошибка сети при сохранении оценки');
        }
    },

    openHwModal() {
        this.updateHwModalContext();
        document.getElementById('hw-modal').classList.add('active');
        document.getElementById('hw-date').value = '';
        document.getElementById('hw-time-select').value = '';
        document.getElementById('hw-time-select').style.display = 'none';
        document.getElementById('hw-no-lessons').style.display = 'none';
        document.getElementById('hw-text').value = '';
        document.getElementById('hw-date').onchange = () => this.checkLessonsForDate();
        this.renderHwList();
    },

    async checkLessonsForDate() {
        const date = document.getElementById('hw-date').value;
        const subjectSel = document.getElementById('teacher-subject-select');
        const groupSel = document.getElementById('teacher-group-select');
        const timeSelect = document.getElementById('hw-time-select');
        const noLessonsDiv = document.getElementById('hw-no-lessons');

        if (!date || !subjectSel.value || !groupSel.value) {
            timeSelect.style.display = 'none';
            noLessonsDiv.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/api/schedule/lessons-by-date?group_id=${groupSel.value}&subject_id=${subjectSel.value}&date=${date}`);
            const data = await response.json();

            if (data.times && data.times.length > 0) {
                timeSelect.innerHTML = '<option value="">Выберите время пары</option>' +
                    data.times.map(t => `<option value="${t}">${t}</option>`).join('');
                timeSelect.style.display = 'block';
                noLessonsDiv.style.display = 'none';
            } else {
                timeSelect.style.display = 'none';
                noLessonsDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Ошибка проверки расписания:', error);
            timeSelect.style.display = 'none';
            noLessonsDiv.style.display = 'block';
        }
    },

    closeHwModal() {
        document.getElementById('hw-modal').classList.remove('active');
    },

    async renderHwList() {
        const container = document.getElementById('hw-list-container');
        container.innerHTML = '<p>Загрузка...</p>';
        try {
            const groupSel = document.getElementById('teacher-group-select');
            const groupId = groupSel.value;
            if (!groupId) {
                container.innerHTML = '<p>Выберите группу</p>';
                return;
            }
            const response = await fetch(`/api/homework/${groupId}`);
            const homeworks = await response.json();
            container.innerHTML = homeworks.slice(0,10).map(hw => {
                const needsToggle = hw.text.length > 80;
                const dateStr = hw.due_date ? hw.due_date.split('-').reverse().join('.') : '';
                const timeStr = hw.time ? ` (${hw.time})` : '';
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid var(--border); border-radius:6px; margin-bottom:8px;">
                    <div style="word-wrap: break-word; overflow-wrap: break-word; max-width: 70%;">
                        <div style="font-weight:500; font-size:0.9rem; word-break: break-word;">${hw.subject}${timeStr} - ${dateStr}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
                            <span id="hw-full-${hw.id}" class="${needsToggle ? 'hw-text' : ''}">${hw.text}</span>
                            ${needsToggle ? `<button class="toggle-btn" id="btn-hw-${hw.id}" onclick="app.toggleHwText(${hw.id})">Раскрыть</button>` : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-shrink: 0;">
                        <button class="btn-icon" onclick="app.openEditHwModal(${hw.id})">✏️</button>
                        <button class="btn-icon danger" onclick="app.deleteHw(${hw.id})">❌</button>
                    </div>
                </div>`;
            }).join('');
        } catch (error) {
            container.innerHTML = '<p style="color:var(--danger)">Ошибка</p>';
        }
    },

    async openEditHwModal(id) {
        try {
            const groupSel = document.getElementById('teacher-group-select');
            const groupId = groupSel.value;
            if (!groupId) return;

            const response = await fetch(`/api/homework/${groupId}`);
            const homeworks = await response.json();
            const hw = homeworks.find(h => h.id === id);
            if (!hw) return;

            document.getElementById('edit-hw-id').value = id;
            document.getElementById('edit-hw-text').value = hw.text;
            document.getElementById('edit-hw-date').value = hw.due_date;

            const timeSelect = document.getElementById('edit-hw-time');
            timeSelect.innerHTML = '<option value="">Без привязки к паре</option>';

            const lessonsRes = await fetch(`/api/schedule/lessons-by-date?group_id=${groupId}&subject_id=${hw.subject_id}&date=${hw.due_date}`);
            const lessonsData = await lessonsRes.json();

            if (lessonsData.times && lessonsData.times.length > 0) {
                lessonsData.times.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.innerText = t;
                    if (hw.time === t) opt.selected = true;
                    timeSelect.appendChild(opt);
                });
                timeSelect.style.display = 'block';
            } else {
                timeSelect.style.display = 'none';
            }

            document.getElementById('edit-hw-modal').classList.add('active');
        } catch (error) {
            console.error('Ошибка:', error);
            this.showToast('Ошибка загрузки задания');
        }
    },

    closeEditHwModal() {
        document.getElementById('edit-hw-modal').classList.remove('active');
    },

    async saveEditedHw() {
        const id = parseInt(document.getElementById('edit-hw-id').value);
        const text = document.getElementById('edit-hw-text').value;
        const date = document.getElementById('edit-hw-date').value;
        const timeSelect = document.getElementById('edit-hw-time');
        const time = timeSelect.style.display !== 'none' ? timeSelect.value : null;
        const subjectSel = document.getElementById('teacher-subject-select');
        const groupSel = document.getElementById('teacher-group-select');

        if (!text || !date) return this.showToast('Заполните все поля!');

        const subjectId = parseInt(subjectSel.value);
        const groupId = parseInt(groupSel.value);
        if (!subjectId || !groupId) return this.showToast('Выберите предмет и группу');

        try {
            const periodsRes = await fetch(`/api/academic-periods/${groupId}`);
            const periods = await periodsRes.json();
            const isStudyDay = periods.some(p =>
                p.type === 'study' && new Date(p.start) <= new Date(date) && new Date(p.end) >= new Date(date)
            );
            if (!isStudyDay) return this.showToast('Нельзя добавить ДЗ на неучебный период!');

            const body = { id: id, subject_id: subjectId, group_id: groupId, due_date: date, text: text };
            if (time) body.time = time;

            const response = await fetch('/api/homework', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (data.success) {
                this.closeEditHwModal();
                this.renderHwList();
                this.showToast('Задание обновлено');
            } else {
                this.showToast(data.message || 'Ошибка обновления');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showToast('Ошибка сохранения');
        }
    },

    async addHomework() {
        const text = document.getElementById('hw-text').value;
        const date = document.getElementById('hw-date').value;
        const timeSelect = document.getElementById('hw-time-select');
        const time = timeSelect.style.display !== 'none' ? timeSelect.value : null;
        const subjectSel = document.getElementById('teacher-subject-select');
        const groupSel = document.getElementById('teacher-group-select');

        if (!text || !date) return this.showToast('Заполните все поля!');
        if (timeSelect.style.display !== 'none' && !time) return this.showToast('Выберите время пары!');

        const subjectId = subjectSel.value;
        const groupId = groupSel.value;
        if (!subjectId || !groupId) return this.showToast('Выберите предмет и группу');

        try {
            const periodsRes = await fetch(`/api/academic-periods/${groupId}`);
            const periods = await periodsRes.json();
            const isStudyDay = periods.some(p =>
                p.type === 'study' && new Date(p.start) <= new Date(date) && new Date(p.end) >= new Date(date)
            );
            if (!isStudyDay) return this.showToast('Нельзя добавить ДЗ на неучебный период!');
        } catch (e) { console.error(e); }

        try {
            const body = { subject_id: parseInt(subjectId), group_id: parseInt(groupId), due_date: date, text: text };
            if (time) body.time = time;

            const response = await fetch('/api/homework', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (data.success) {
                document.getElementById('hw-text').value = '';
                document.getElementById('hw-date').value = '';
                timeSelect.value = '';
                this.renderHwList();
                this.showToast('Задание добавлено');
            } else {
                this.showToast(data.message || 'Ошибка сохранения');
            }
        } catch (error) {
            this.showToast('Ошибка сохранения');
        }
    },

    async deleteHw(id) {
        if (!confirm('Удалить задание?')) return;
        try {
            const response = await fetch(`/api/homework/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) this.renderHwList();
        } catch (error) {
            this.showToast('Ошибка удаления');
        }
    },

    async renderAdminPanel() {
        const teacherConnections = {};
        for (const user of DB.users) {
            if (user.role === 'teacher') {
                try {
                    const [subjRes, grpRes] = await Promise.all([
                        fetch(`/api/teacher/${user.id}/subjects`),
                        fetch(`/api/teacher/${user.id}/groups`)
                    ]);
                    const subjects = await subjRes.json();
                    const groups = await grpRes.json();
                    teacherConnections[user.id] = {
                        subjects: subjects.map(s => s.name).join(', ') || 'Нет',
                        groups: groups.map(g => g.name).join(', ') || 'Нет'
                    };
                } catch (e) {
                    teacherConnections[user.id] = { subjects: 'Ошибка', groups: 'Ошибка' };
                }
            }
        }
        document.getElementById('admin-users-tbody').innerHTML = DB.users.map(u => {
            let connections = '-';
            const group = DB.groups.find(g => g.id === u.group_id);
            const groupName = group ? group.name : '-';

            if (u.role === 'student') {
                const parent = DB.users.find(p => p.role === 'parent' && p.id === u.parent_id);
                connections = parent ? `Родитель: ${parent.name}` : '-';
            } else if (u.role === 'parent') {
                const children = DB.users.filter(c => c.parent_id === u.id).map(c => c.name).join(', ');
                connections = children ? `Дети: ${children}` : '-';
            } else if (u.role === 'teacher') {
                const conn = teacherConnections[u.id] || { subjects: 'Загрузка...', groups: 'Загрузка...' };
                connections = `Предметы: ${conn.subjects}<br>Группы: ${conn.groups}`;
            }

            return `<tr data-user-id="${u.id}">
                <td>${u.name}</td>
                <td><span class="role-badge">${u.role}</span></td>
                <td>${u.role === 'student' ? groupName : '-'}</td>
                <td>${u.login || '—'}</td>
                <td>${u.password || '—'}</td>
                <td style="font-size:0.85rem;">${connections}</td>
                <td style="display:flex; gap:8px;">
                    <button class="btn-icon" onclick="app.openUserModal(${u.id})">✏️</button>
                    <button class="btn-icon danger" onclick="app.deleteUser(${u.id})">❌</button>
                </td>
            </tr>`;
        }).join('');

        this.populatePeriodGroupSelect();
        await this.loadAllPeriods();

        document.getElementById('admin-subjects-list').innerHTML = DB.subjects.map(s =>
            `<li style="padding:8px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
                ${s.name}
                <button class="btn-icon" onclick="app.openSubjectModal(${s.id}, '${s.name}')">✏️</button>
                <button class="btn-icon danger" onclick="app.deleteSubject(${s.id})">❌</button>
            </li>`
        ).join('');

        document.getElementById('admin-groups-list').innerHTML = DB.groups.map(g =>
            `<li style="padding:8px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
                ${g.name}
                <button class="btn-icon" onclick="app.openGroupModal(${g.id}, '${g.name}')">✏️</button>
                <button class="btn-icon danger" onclick="app.deleteGroup(${g.id})">❌</button>
            </li>`
        ).join('');
    },

    populatePeriodGroupSelect() {
        const sel = document.getElementById('period-group-select');
        if (sel) sel.innerHTML = '<option value="">Выберите группу</option>' + DB.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    },

    async loadAllPeriods() {
        try {
            const res = await fetch('/api/academic-periods/all');
            const periods = await res.json();
            this.renderPeriodsTable(periods);
        } catch (e) {
            console.error('Ошибка загрузки периодов:', e);
        }
    },

    renderPeriodsTable(periods) {
        const tbody = document.getElementById('admin-periods-tbody');
        if (!tbody) return;

        const typeLabels = {
            'study': 'Обучение по дисциплинам',
            'practice-u': 'Учебная практика',
            'practice-p': 'Производственная практика',
            'practice-d': 'Преддипломная практика',
            'exam': 'Промежуточная аттестация',
            'diploma-prep': 'Подготовка ВКР',
            'diploma-defense': 'Защита ВКР',
            'vacation': 'Каникулы'
        };

        if (periods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color:var(--gray)">Нет запланированных периодов</td></tr>';
            return;
        }

        tbody.innerHTML = periods.map(p => {
            let editBtn = '';
            if (p.type === 'study') {
                editBtn = `<button class="btn-edit-period" onclick="app.openSchedEditorByPeriod('${p.group_id}', '${p.start}')">✏️ Редактировать</button>`;
            }
            return `<tr>
                <td>${p.group_name}</td>
                <td><span class="badge badge-${p.type}">${typeLabels[p.type] || p.type}</span></td>
                <td>${p.start.split('-').reverse().join('.')} – ${p.end.split('-').reverse().join('.')}</td>
                <td style="text-align: right;">
                    ${editBtn}
                    <button class="btn-delete-period" onclick="app.deleteAcademicPeriod(${p.id})">Удалить</button>
                </td>
            </tr>`;
        }).join('');
    },

    async addAcademicPeriod() {
        const groupId = document.getElementById('period-group-select').value;
        const type = document.getElementById('period-type-select').value;
        const start = document.getElementById('period-start-date').value;
        const end = document.getElementById('period-end-date').value;

        if (!groupId) return this.showToast('Выберите группу!');
        if (!start || !end) return this.showToast('Укажите даты!');
        if (new Date(start) > new Date(end)) return this.showToast('Дата начала не может быть позже даты окончания!');

        const semester = new Date(start).getMonth() >= 8 ? 1 : 2;

        try {
            const response = await fetch('/api/academic-periods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: parseInt(groupId),
                    semester: semester,
                    type: type,
                    start: start,
                    end: end
                })
            });
            const data = await response.json();
            if (data.success) {
                this.showToast('Период добавлен!');
                document.getElementById('period-start-date').value = '';
                document.getElementById('period-end-date').value = '';
                await this.loadAllPeriods();
            } else {
                this.showToast(data.message || 'Ошибка добавления периода');
            }
        } catch (error) {
            this.showToast('Ошибка соединения с сервером');
        }
    },

    async deleteAcademicPeriod(periodId) {
        if (!confirm('Удалить этот период?')) return;
        try {
            const response = await fetch(`/api/academic-periods/${periodId}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                this.showToast('Период удалён');
                await this.loadAllPeriods();
            } else {
                this.showToast(data.message || 'Ошибка удаления');
            }
        } catch (error) {
            this.showToast('Ошибка соединения с сервером');
        }
    },

    async openSchedEditorByPeriod(groupId, startDate) {
        document.getElementById('modal-sched-group-id').value = groupId;

        const d = new Date(startDate);
        const onejan = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
        const initialWeekType = (weekNum % 2 === 0) ? 2 : 1;

        const weekSelector = document.getElementById('modal-week-selector');
        weekSelector.value = initialWeekType;

        await this.loadScheduleForModal(groupId, initialWeekType);

        document.getElementById('schedule-editor-modal').classList.add('active');
    },

    async changeModalWeek(weekType) {
        const groupId = document.getElementById('modal-sched-group-id').value;
        if (!groupId) return;
        await this.loadScheduleForModal(groupId, parseInt(weekType));
    },

    async loadScheduleForModal(groupId, weekType) {
        document.getElementById('modal-sched-week-type').value = weekType;
        document.getElementById('modal-week-selector').value = weekType;

        try {
            const response = await fetch(`/api/schedule/${groupId}?week_type=${weekType}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const schedule = await response.json();

            this.tempSchedTemplate = { days: daysNames.map(day => ({ day: day, pairs: [] })) };
            schedule.forEach(pair => {
                const dayIdx = daysNames.indexOf(pair.day);
                if (dayIdx !== -1) {
                    this.tempSchedTemplate.days[dayIdx].pairs.push({
                        time: pair.time,
                        subject_id: pair.subject_id,
                        subject: pair.subject,
                        type: pair.type,
                        classroom: pair.classroom,
                        teacher_id: pair.teacher_id,
                        teacher: pair.teacher
                    });
                }
            });

            const group = DB.groups.find(g => g.id == groupId);
            const groupName = group ? group.name : `Группа ID:${groupId}`;
            document.getElementById('sched-modal-title').innerText = `Расписание: ${groupName}`;
            document.getElementById('sched-modal-subtitle').innerText = `Редактирование недели ${weekType}`;

            await this.renderModalSchedGrid();
        } catch (error) {
            console.error('Ошибка загрузки расписания:', error);
            this.showToast('Ошибка загрузки расписания');
        }
    },

    async renderModalSchedGrid() {
        const container = document.getElementById('modal-sched-container');
        if (!container) return;

        let html = '<div class="schedule-grid">';
        this.tempSchedTemplate.days.forEach((day, dayIdx) => {
            html += `<div class="day-column"><div class="day-header-sched">${day.day}</div>`;
            timeSlots.forEach((time, timeIdx) => {
                const pair = day.pairs.find(p => p.time === time) || {};
                html += `<div class="time-slot">
                    <div class="time-label">${time}</div>
                    <select class="edit-select" onchange="app.updateSchedTempData(${dayIdx}, ${timeIdx}, 'subject_id', this.value)">
                        <option value="">— Предмет —</option>
                        ${DB.subjects.map(s => `<option value="${s.id}" ${pair.subject_id===s.id?'selected':''}>${s.name}</option>`).join('')}
                    </select>
                    <select class="edit-select" onchange="app.updateSchedTempData(${dayIdx}, ${timeIdx}, 'type', this.value)">
                        <option value="">— Тип —</option>
                        <option value="л." ${pair.type==='л.'?'selected':''}>л.</option>
                        <option value="пр." ${pair.type==='пр.'?'selected':''}>пр.</option>
                    </select>
                    <select class="edit-select" onchange="app.updateSchedTempData(${dayIdx}, ${timeIdx}, 'classroom', this.value)">
                        <option value="">— Ауд. —</option>
                        ${DB.classrooms.map(c => `<option value="${c}" ${pair.classroom===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                    <select class="edit-select" onchange="app.updateSchedTempData(${dayIdx}, ${timeIdx}, 'teacher_id', this.value)" data-subject-id="${pair.subject_id || ''}">
                        <option value="">— Преподаватель —</option>
                    </select>
                </div>`;
            });
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;

        const teacherSelects = container.querySelectorAll('select[onchange*="teacher_id"]');
        for (const select of teacherSelects) {
            const subjectId = select.getAttribute('data-subject-id');
            if (subjectId) this.loadAndPopulateTeachers(select, subjectId);
        }
    },

    async loadAndPopulateTeachers(selectElement, subjectId) {
        selectElement.setAttribute('data-subject-id', subjectId);
        selectElement.value = '';

        if (!subjectId) {
            selectElement.innerHTML = '<option value="">— Преподаватель —</option>';
            return;
        }

        try {
            const res = await fetch(`/api/teacher/subjects?subject_id=${subjectId}`);
            const teachers = await res.json();

            if (Array.isArray(teachers) && teachers.length > 0) {
                const optionsHtml = '<option value="">— Преподаватель —</option>' +
                    teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
                selectElement.innerHTML = optionsHtml;

                const timeLabel = selectElement.closest('.time-slot').querySelector('.time-label').textContent;
                const dayColumn = selectElement.closest('.day-column');
                const dayHeader = dayColumn.querySelector('.day-header-sched').textContent;
                const dayIndex = daysNames.indexOf(dayHeader);

                if (dayIndex !== -1) {
                    const dayData = this.tempSchedTemplate.days[dayIndex];
                    if (dayData) {
                        const pair = dayData.pairs.find(p => p.time === timeLabel);
                        if (pair && pair.teacher_id) {
                            selectElement.value = pair.teacher_id;
                        }
                    }
                }
            } else {
                selectElement.innerHTML = '<option value="">Нет преподавателей</option>';
            }
        } catch (e) {
            console.error('Ошибка загрузки преподавателей:', e);
            selectElement.innerHTML = '<option value="">Ошибка загрузки</option>';
        }
    },

    updateSchedTempData(dayIdx, timeIdx, field, value) {
        const day = this.tempSchedTemplate.days[dayIdx];
        const time = timeSlots[timeIdx];
        let pair = day.pairs.find(p => p.time === time);
        if (!pair) {
            pair = { time, subject_id: null, subject: "", type: "", classroom: "", teacher_id: null, teacher: "" };
            day.pairs.push(pair);
        }
        pair[field] = value;

        if (field === 'subject_id') {
            const subj = DB.subjects.find(s => s.id == value);
            pair.subject = subj ? subj.name : "";

            const container = document.getElementById('modal-sched-container');
            const dayColumns = container.querySelectorAll('.day-column');
            if (dayColumns[dayIdx]) {
                const timeSlots_in_column = dayColumns[dayIdx].querySelectorAll('.time-slot');
                if (timeSlots_in_column[timeIdx]) {
                    const teacherSelect = timeSlots_in_column[timeIdx].querySelector('select[onchange*="teacher_id"]');
                    if (teacherSelect) {
                        this.loadAndPopulateTeachers(teacherSelect, value);
                        pair.teacher_id = null;
                        pair.teacher = "";
                    }
                }
            }
        }

        if (field === 'teacher_id') {
            const teach = DB.teachers.find(t => t.id == value);
            pair.teacher = teach ? teach.name : "";
        }
    },

    async saveSchedFromModal() {
        const groupId = parseInt(document.getElementById('modal-sched-group-id').value);
        const weekType = parseInt(document.getElementById('modal-sched-week-type').value);

        const pairs = [];
        this.tempSchedTemplate.days.forEach(day => {
            day.pairs.forEach(pair => {
                if (pair.subject_id && pair.teacher_id) {
                    pairs.push({
                        day: day.day,
                        time: pair.time,
                        subject_id: pair.subject_id,
                        type: pair.type,
                        classroom: pair.classroom,
                        teacher_id: pair.teacher_id
                    });
                }
            });
        });

        try {
            const response = await fetch('/api/schedule/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: groupId,
                    week_type: weekType,
                    pairs: pairs
                })
            });
            const data = await response.json();
            if (data.success) {
                this.showToast('Расписание сохранено!');
                this.closeSchedModal();
            } else {
                this.showToast(data.message || 'Ошибка сохранения');
            }
        } catch (error) {
            this.showToast('Ошибка сохранения');
        }
    },

    closeSchedModal() {
        document.getElementById('schedule-editor-modal').classList.remove('active');
        this.tempSchedTemplate = null;
    },

    getWeekTypeByDate(date) {
        const onejan = new Date(date.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
        return (weekNum % 2 === 0) ? 2 : 1;
    },

    showStudentGrades() {
        document.getElementById('student-dashboard').classList.add('hidden');
        document.getElementById('student-grades-view').classList.remove('hidden');
        this.renderStudentGradesTable();
    },

    showStudentHomework() {
        document.getElementById('student-dashboard').classList.add('hidden');
        document.getElementById('student-hw-view').classList.remove('hidden');
        this.renderStudentHwList();
    },

    backToStudentDashboard() {
        document.getElementById('student-grades-view').classList.add('hidden');
        document.getElementById('student-hw-view').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
    },

    showParentFullJournal() {
        if (!this.selectedStudentId) return;
        document.getElementById('parent-dashboard').classList.add('hidden');
        document.getElementById('parent-full-journal-view').classList.remove('hidden');
        this.renderParentJournalTable();
    },

    backToParentDashboard() {
        document.getElementById('parent-full-journal-view').classList.add('hidden');
        document.getElementById('parent-dashboard').classList.remove('hidden');
    },

    onSchedGroupChange() {
        this.currentSchedGroupId = document.getElementById('sched-group-filter').value;
        document.getElementById('btn-open-sched').disabled = !this.currentSchedGroupId;
    },

    openSchedEditor() {
        if (!this.currentSchedGroupId) return;
        const groupId = parseInt(this.currentSchedGroupId);
        const weekType = parseInt(document.getElementById('sched-week-type').value);
        document.getElementById('modal-sched-group-id').value = groupId;
        document.getElementById('modal-sched-week-type').value = weekType;

        try {
            this.tempSchedTemplate = { days: daysNames.map(day => ({ day: day, pairs: [] })) };
            document.getElementById('schedule-editor-modal').classList.add('active');
            this.renderModalSchedGrid();
        } catch (error) {
            console.error(error);
            this.showToast('Ошибка загрузки расписания');
        }
    },

    cancelSchedEdit() {
        this.closeSchedModal();
    },

    async openUserModal(userId = null) {
        const title = document.getElementById('user-modal-title');
        if (userId) {
            const user = DB.users.find(u => u.id === userId);
            title.innerText = "Редактирование пользователя";
            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('edit-user-name').value = user.name;
            document.getElementById('edit-user-role').value = user.role;
            document.getElementById('edit-user-login').value = user.login || '';
            document.getElementById('edit-user-password').value = user.password || '';

            const gSelect = document.getElementById('edit-user-group');
            gSelect.innerHTML = DB.groups.map(g =>
                `<option value="${g.id}" ${g.id === user.group_id ? 'selected' : ''}>${g.name}</option>`
            ).join('');

            const childrenSelect = document.getElementById('edit-user-children');
            const students = DB.users.filter(u => u.role === 'student');
            childrenSelect.innerHTML = students.map(s =>
                `<option value="${s.id}" ${user.parent_id === s.id ? 'selected' : ''}>${s.name}</option>`
            ).join('');

            const subjectsSelect = document.getElementById('edit-user-subjects');
            const groupsSelect = document.getElementById('edit-user-groups');

            if (subjectsSelect && user.role === 'teacher') {
                subjectsSelect.innerHTML = DB.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                try {
                    const res = await fetch(`/api/teacher/${userId}/subjects`);
                    const selectedSubjects = await res.json();
                    const selectedIds = selectedSubjects.map(s => s.id);
                    Array.from(subjectsSelect.options).forEach(opt => {
                        opt.selected = selectedIds.includes(parseInt(opt.value));
                    });
                } catch (e) { console.error(e); }
            }

            if (groupsSelect && user.role === 'teacher') {
                groupsSelect.innerHTML = DB.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
                try {
                    const res = await fetch(`/api/teacher/${userId}/groups`);
                    const selectedGroups = await res.json();
                    const selectedIds = selectedGroups.map(g => g.id);
                    Array.from(groupsSelect.options).forEach(opt => {
                        opt.selected = selectedIds.includes(parseInt(opt.value));
                    });
                } catch (e) { console.error(e); }
            }
        } else {
            title.innerText = "Добавить пользователя";
            document.getElementById('edit-user-id').value = "";
            document.getElementById('edit-user-name').value = "";
            document.getElementById('edit-user-role').value = "student";
            document.getElementById('edit-user-login').value = "";
            document.getElementById('edit-user-password').value = "";

            const gSelect = document.getElementById('edit-user-group');
            gSelect.innerHTML = DB.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

            const childrenSelect = document.getElementById('edit-user-children');
            const students = DB.users.filter(u => u.role === 'student');
            childrenSelect.innerHTML = students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

            const subjectsSelect = document.getElementById('edit-user-subjects');
            if (subjectsSelect) {
                subjectsSelect.innerHTML = DB.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            }

            const groupsSelect = document.getElementById('edit-user-groups');
            if (groupsSelect) {
                groupsSelect.innerHTML = DB.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            }
        }
        this.toggleUserFormFields();
        document.getElementById('user-modal').classList.add('active');
    },

    closeUserModal() {
        document.getElementById('user-modal').classList.remove('active');
    },

    toggleUserFormFields() {
        const role = document.getElementById('edit-user-role').value;
        document.getElementById('group-field').style.display = role === 'student' ? 'block' : 'none';
        document.getElementById('children-field').style.display = role === 'parent' ? 'block' : 'none';
        document.getElementById('teacher-subjects-field').style.display = role === 'teacher' ? 'block' : 'none';
        document.getElementById('teacher-groups-field').style.display = role === 'teacher' ? 'block' : 'none';
    },

    async saveUser() {
        const idInput = document.getElementById('edit-user-id').value.trim();
        let userId = null;
        if (idInput) {
            userId = parseInt(idInput);
            if (isNaN(userId)) {
                this.showToast('ID пользователя должен быть числом');
                return;
            }
        }

        const name = document.getElementById('edit-user-name').value;
        const role = document.getElementById('edit-user-role').value;
        const login = document.getElementById('edit-user-login').value.trim().toLowerCase();
        const password = document.getElementById('edit-user-password').value.trim();
        const groupId = document.getElementById('edit-user-group').value;

        if (!name) return this.showToast('Введите ФИО!');
        if (!login) return this.showToast('Введите логин!');
        if (!password) return this.showToast('Введите пароль!');

        const payload = {
            name: name,
            role: role,
            login: login,
            password: password,
            group_id: role === 'student' ? (groupId ? parseInt(groupId) : null) : null,
            parent_id: null
        };

        try {
            let response;
            let data;

            if (userId) {
                response = await fetch(`/api/users/${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                data = await response.json();

                if (data.success) {
                    if (role === 'teacher') {
                        const subjectsSelect = document.getElementById('edit-user-subjects');
                        const groupsSelect = document.getElementById('edit-user-groups');
                        const selectedSubjectIds = Array.from(subjectsSelect.selectedOptions).map(opt => parseInt(opt.value));
                        const selectedGroupIds = Array.from(groupsSelect.selectedOptions).map(opt => parseInt(opt.value));

                        const subjRes = await fetch(`/api/teacher/${userId}/subjects`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ subject_ids: selectedSubjectIds })
                        });
                        const subjData = await subjRes.json();

                        const grpRes = await fetch(`/api/teacher/${userId}/groups`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ group_ids: selectedGroupIds })
                        });
                        const grpData = await grpRes.json();

                        if (!subjData.success || !grpData.success) {
                            this.showToast('Ошибка сохранения связей преподавателя');
                            return;
                        }
                    }

                    if (role === 'parent') {
                        const childrenSelect = document.getElementById('edit-user-children');
                        const selectedStudentIds = Array.from(childrenSelect.selectedOptions).map(opt => parseInt(opt.value));
                        const allStudents = DB.users.filter(u => u.role === 'student' && u.parent_id == userId);

                        for (const student of allStudents) {
                            if (!selectedStudentIds.includes(student.id)) {
                                await fetch(`/api/users/${student.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        name: student.name,
                                        role: 'student',
                                        group_id: student.group_id,
                                        parent_id: null,
                                        login: student.login,
                                        password: student.password
                                    })
                                });
                            }
                        }

                        for (const studentId of selectedStudentIds) {
                            const student = DB.users.find(u => u.id === studentId);
                            if (student) {
                                await fetch(`/api/users/${studentId}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        name: student.name,
                                        role: 'student',
                                        group_id: student.group_id,
                                        parent_id: userId,
                                        login: student.login,
                                        password: student.password
                                    })
                                });
                            }
                        }
                    }

                    await this.loadUsersFromServer();
                    this.renderAdminPanel();
                    this.closeUserModal();
                    this.showToast('Пользователь обновлен');
                } else {
                    this.showToast(data.message || 'Ошибка');
                }
            } else {
                response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                data = await response.json();

                if (data.success) {
                    const newUserId = data.user_id;

                    if (role === 'teacher') {
                        const subjectsSelect = document.getElementById('edit-user-subjects');
                        const groupsSelect = document.getElementById('edit-user-groups');
                        const selectedSubjectIds = Array.from(subjectsSelect.selectedOptions).map(opt => parseInt(opt.value));
                        const selectedGroupIds = Array.from(groupsSelect.selectedOptions).map(opt => parseInt(opt.value));

                        const subjRes = await fetch(`/api/teacher/${newUserId}/subjects`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ subject_ids: selectedSubjectIds })
                        });
                        const subjData = await subjRes.json();

                        const grpRes = await fetch(`/api/teacher/${newUserId}/groups`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ group_ids: selectedGroupIds })
                        });
                        const grpData = await grpRes.json();

                        if (!subjData.success || !grpData.success) {
                            this.showToast('Ошибка сохранения связей нового преподавателя');
                            return;
                        }
                    }

                    if (role === 'parent') {
                        const childrenSelect = document.getElementById('edit-user-children');
                        const selectedStudentIds = Array.from(childrenSelect.selectedOptions).map(opt => parseInt(opt.value));

                        for (const studentId of selectedStudentIds) {
                            const student = DB.users.find(u => u.id === studentId);
                            if (student) {
                                await fetch(`/api/users/${studentId}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        name: student.name,
                                        role: 'student',
                                        group_id: student.group_id,
                                        parent_id: newUserId,
                                        login: student.login,
                                        password: student.password
                                    })
                                });
                            }
                        }
                    }

                    await this.loadUsersFromServer();
                    this.renderAdminPanel();
                    this.closeUserModal();
                    this.showToast('Пользователь добавлен');
                } else {
                    this.showToast(data.message || 'Ошибка');
                }
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showToast('Ошибка сохранения');
        }
    },

    async deleteUser(id) {
        if (!confirm('Удалить пользователя?')) return;
        try {
            const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                await this.loadUsersFromServer();
                this.renderAdminPanel();
                this.showToast('Пользователь удален');
            } else {
                this.showToast(data.message || 'Ошибка удаления');
            }
        } catch (error) {
            this.showToast('Ошибка удаления');
        }
    },

    openSubjectModal(subjectId = null, subjectName = null) {
        const title = document.getElementById('subject-modal-title');
        if (subjectId) {
            title.innerText = "Редактировать предмет";
            document.getElementById('edit-subject-id').value = subjectId;
            document.getElementById('edit-subject-name').value = subjectName;
        } else {
            title.innerText = "Добавить предмет";
            document.getElementById('edit-subject-id').value = "";
            document.getElementById('edit-subject-name').value = "";
        }
        document.getElementById('subject-modal').classList.add('active');
    },

    closeSubjectModal() {
        document.getElementById('subject-modal').classList.remove('active');
    },

    async saveSubject() {
        const id = document.getElementById('edit-subject-id').value;
        const newName = document.getElementById('edit-subject-name').value.trim();
        if (!newName) return this.showToast('Введите название предмета!');

        try {
            let response;
            if (id) {
                response = await fetch(`/api/subjects/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });
            } else {
                response = await fetch('/api/subjects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });
            }
            const data = await response.json();
            if (data.success) {
                await this.loadSubjects();
                this.closeSubjectModal();
                this.renderAdminPanel();
                this.showToast('Предмет сохранен');
            } else {
                this.showToast(data.message || 'Ошибка');
            }
        } catch (error) {
            this.showToast('Ошибка сохранения');
        }
    },

    async deleteSubject(id) {
        if (!confirm('Удалить предмет?')) return;
        try {
            const response = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                await this.loadSubjects();
                this.renderAdminPanel();
                this.showToast('Предмет удален');
            }
        } catch (error) {
            this.showToast('Ошибка удаления');
        }
    },

    openGroupModal(groupId = null, groupName = null) {
        const title = document.getElementById('group-modal-title');
        if (groupId) {
            title.innerText = "Редактировать группу";
            document.getElementById('edit-group-id').value = groupId;
            document.getElementById('edit-group-name').value = groupName;
        } else {
            title.innerText = "Добавить группу";
            document.getElementById('edit-group-id').value = "";
            document.getElementById('edit-group-name').value = "";
        }
        document.getElementById('group-modal').classList.add('active');
    },

    closeGroupModal() {
        document.getElementById('group-modal').classList.remove('active');
    },

    async saveGroup() {
        const id = document.getElementById('edit-group-id').value;
        const name = document.getElementById('edit-group-name').value.trim();
        if (!name) return this.showToast('Введите название группы!');

        try {
            let response;
            if (id) {
                response = await fetch(`/api/groups/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name })
                });
            } else {
                response = await fetch('/api/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name })
                });
            }
            const data = await response.json();
            if (data.success) {
                await this.loadGroups();
                this.closeGroupModal();
                this.renderAdminPanel();
                this.populateSchedGroupSelect();
                this.populateTeacherSelects();
                this.showToast('Группа сохранена');
            } else {
                this.showToast(data.message || 'Ошибка');
            }
        } catch (error) {
            this.showToast('Ошибка сохранения');
        }
    },

    async deleteGroup(id) {
        if (!confirm('Удалить группу?')) return;
        try {
            const response = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                await this.loadGroups();
                this.renderAdminPanel();
                this.populateSchedGroupSelect();
                this.populateTeacherSelects();
                this.showToast('Группа удалена');
            }
        } catch (error) {
            this.showToast('Ошибка удаления');
        }
    }
};

app.init();