from flask import Flask, jsonify, request, send_from_directory
import pyodbc
from datetime import datetime, date, timedelta

app = Flask(__name__, static_folder='static', static_url_path='/')

def get_db_connection():
    conn_str = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=.;"
        "DATABASE=ЭлектронныйДневник;"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)

@app.route('/')
def home():
    return send_from_directory('static', 'index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT ID_пользователя, ФИО, Роль, ID_группы, ID_родителя, Логин, Пароль FROM Пользователи WHERE Логин = ? AND Пароль = ?",
            (data['login'], data['password'])
        )
        user = cursor.fetchone()
        conn.close()
        if user:
            return jsonify({
                'success': True,
                'user': {
                    'id': user.ID_пользователя,
                    'name': user.ФИО,
                    'role': user.Роль,
                    'group_id': user.ID_группы,
                    'parent_id': user.ID_родителя
                }
            })
        return jsonify({'success': False, 'message': 'Неверный логин или пароль'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ID_пользователя, ФИО, Роль, ID_группы, ID_родителя, Логин, Пароль FROM Пользователи")
        rows = cursor.fetchall()
        conn.close()
        users = [{
            'id': r.ID_пользователя, 'name': r.ФИО, 'role': r.Роль,
            'group_id': r.ID_группы, 'parent_id': r.ID_родителя,
            'login': r.Логин, 'password': r.Пароль
        } for r in rows]
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if not data.get('login') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Логин и пароль обязательны'}), 400
        login = data['login'].lower().strip()
        password = data['password'].strip()
        cursor.execute("SELECT COUNT(*) FROM Пользователи WHERE Логин = ?", login)
        if cursor.fetchone()[0] > 0:
            return jsonify({'success': False, 'message': 'Логин уже существует'}), 400
        cursor.execute(
            "INSERT INTO Пользователи (ФИО, Логин, Пароль, Роль, ID_группы, ID_родителя) VALUES (?, ?, ?, ?, ?, ?)",
            (data['name'], login, password, data['role'], data.get('group_id'), data.get('parent_id'))
        )
        conn.commit()
        new_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
        conn.close()
        return jsonify({'success': True, 'user_id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if data.get('login'):
            login = data['login'].lower().strip()
            cursor.execute("SELECT COUNT(*) FROM Пользователи WHERE Логин = ? AND ID_пользователя != ?", login, user_id)
            if cursor.fetchone()[0] > 0:
                return jsonify({'success': False, 'message': 'Логин уже используется другим пользователем'}), 400
            password = data.get('password', '')
            cursor.execute(
                "UPDATE Пользователи SET ФИО = ?, Логин = ?, Пароль = ?, Роль = ?, ID_группы = ?, ID_родителя = ? WHERE ID_пользователя = ?",
                (data['name'], login, password, data['role'], data.get('group_id'), data.get('parent_id'), user_id)
            )
        else:
            cursor.execute(
                "UPDATE Пользователи SET ФИО = ?, Роль = ?, ID_группы = ?, ID_родителя = ? WHERE ID_пользователя = ?",
                (data['name'], data['role'], data.get('group_id'), data.get('parent_id'), user_id)
            )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ПреподавательПредмет WHERE ID_преподавателя = ?", user_id)
        cursor.execute("DELETE FROM ПреподавательГруппа WHERE ID_преподавателя = ?", user_id)
        cursor.execute("UPDATE Пользователи SET ID_родителя = NULL WHERE ID_родителя = ?", user_id)
        cursor.execute("DELETE FROM Оценки WHERE ID_студента = ?", user_id)
        cursor.execute("DELETE FROM Пользователи WHERE ID_пользователя = ?", user_id)
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/groups', methods=['GET'])
def get_groups():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ID_группы, Название FROM Группы")
        rows = cursor.fetchall()
        conn.close()
        return jsonify([{'id': r.ID_группы, 'name': r.Название} for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/groups', methods=['POST'])
def create_group():
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM Группы WHERE Название = ?", data['name'])
        if cursor.fetchone()[0] > 0:
            return jsonify({'success': False, 'message': 'Группа уже существует'}), 400
        cursor.execute("INSERT INTO Группы (Название) VALUES (?)", data['name'])
        conn.commit()
        new_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
        conn.close()
        return jsonify({'success': True, 'group_id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id):
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Группы SET Название = ? WHERE ID_группы = ?", (data['name'], group_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Группы WHERE ID_группы = ?", group_id)
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ID_предмета, Название FROM Предметы")
        rows = cursor.fetchall()
        conn.close()
        return jsonify([{'id': r.ID_предмета, 'name': r.Название} for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/subjects', methods=['POST'])
def create_subject():
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM Предметы WHERE Название = ?", data['name'])
        if cursor.fetchone()[0] > 0:
            return jsonify({'success': False, 'message': 'Предмет уже существует'}), 400
        cursor.execute("INSERT INTO Предметы (Название) VALUES (?)", data['name'])
        conn.commit()
        new_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
        conn.close()
        return jsonify({'success': True, 'subject_id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/subjects/<int:subject_id>', methods=['PUT'])
def update_subject(subject_id):
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Предметы SET Название = ? WHERE ID_предмета = ?", (data['name'], subject_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/subjects/<int:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ПреподавательПредмет WHERE ID_предмета = ?", subject_id)
        cursor.execute("DELETE FROM Предметы WHERE ID_предмета = ?", subject_id)
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/teachers', methods=['GET'])
def get_teachers():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ID_пользователя, ФИО FROM Пользователи WHERE Роль = 'teacher'")
        rows = cursor.fetchall()
        conn.close()
        return jsonify([{'id': r.ID_пользователя, 'name': r.ФИО} for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/teacher/<int:teacher_id>/subjects', methods=['GET'])
def get_teacher_subjects(teacher_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.ID_предмета, p.Название 
            FROM Предметы p
            JOIN ПреподавательПредмет pp ON p.ID_предмета = pp.ID_предмета
            WHERE pp.ID_преподавателя = ?
        """, (teacher_id,))
        rows = cursor.fetchall()
        conn.close()
        subjects = [{'id': r.ID_предмета, 'name': r.Название} for r in rows]
        return jsonify(subjects)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/teacher/<int:teacher_id>/groups', methods=['GET'])
def get_teacher_groups(teacher_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT g.ID_группы, g.Название 
            FROM Группы g
            JOIN ПреподавательГруппа pg ON g.ID_группы = pg.ID_группы
            WHERE pg.ID_преподавателя = ?
        """, (teacher_id,))
        rows = cursor.fetchall()
        conn.close()
        groups = [{'id': r.ID_группы, 'name': r.Название} for r in rows]
        return jsonify(groups)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/teacher/<int:teacher_id>/subjects', methods=['POST'])
def set_teacher_subjects(teacher_id):
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ПреподавательПредмет WHERE ID_преподавателя = ?", teacher_id)
        for subject_id in data.get('subject_ids', []):
            cursor.execute("INSERT INTO ПреподавательПредмет (ID_преподавателя, ID_предмета) VALUES (?, ?)", (teacher_id, subject_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/teacher/<int:teacher_id>/groups', methods=['POST'])
def set_teacher_groups(teacher_id):
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ПреподавательГруппа WHERE ID_преподавателя = ?", teacher_id)
        for group_id in data.get('group_ids', []):
            cursor.execute("INSERT INTO ПреподавательГруппа (ID_преподавателя, ID_группы) VALUES (?, ?)", (teacher_id, group_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/teacher/subjects', methods=['GET'])
def get_teachers_by_subject():
    subject_id = request.args.get('subject_id')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if subject_id:
            cursor.execute("""
                SELECT DISTINCT u.ID_пользователя, u.ФИО 
                FROM Пользователи u
                JOIN ПреподавательПредмет pp ON u.ID_пользователя = pp.ID_преподавателя
                WHERE u.Роль = 'teacher' AND pp.ID_предмета = ?
            """, (subject_id,))
        else:
            cursor.execute("SELECT ID_пользователя, ФИО FROM Пользователи WHERE Роль = 'teacher'")
        rows = cursor.fetchall()
        conn.close()
        return jsonify([{'id': r.ID_пользователя, 'name': r.ФИО} for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/academic-periods/<int:group_id>', methods=['GET'])
def get_academic_periods(group_id):
    """Получить все периоды для группы"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ID_периода, НомерСеместра, ТипПериода, ДатаНачала, ДатаОкончания
            FROM УчебныеПериоды
            WHERE ID_группы = ?
            ORDER BY ДатаНачала
        """, (group_id,))
        rows = cursor.fetchall()
        conn.close()
        
        periods = []
        for row in rows:
            periods.append({
                'id': row.ID_периода,
                'semester': row.НомерСеместра,
                'type': row.ТипПериода,
                'start': row.ДатаНачала.isoformat(),
                'end': row.ДатаОкончания.isoformat()
            })
        return jsonify(periods)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/academic-periods/all', methods=['GET'])
def get_all_academic_periods():
    """Получить все периоды для всех групп (для админ-панели)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT up.ID_периода, up.ID_группы, g.Название AS ГруппаНазвание, 
                   up.НомерСеместра, up.ТипПериода, up.ДатаНачала, up.ДатаОкончания
            FROM УчебныеПериоды up
            JOIN Группы g ON up.ID_группы = g.ID_группы
            ORDER BY up.ID_группы, up.ДатаНачала
        """)
        rows = cursor.fetchall()
        conn.close()
        
        periods = []
        for row in rows:
            periods.append({
                'id': row.ID_периода,
                'group_id': row.ID_группы,
                'group_name': row.ГруппаНазвание,
                'semester': row.НомерСеместра,
                'type': row.ТипПериода,
                'start': row.ДатаНачала.isoformat(),
                'end': row.ДатаОкончания.isoformat()
            })
        return jsonify(periods)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/academic-periods', methods=['POST'])
def create_academic_period():
    """Создать новый учебный период"""
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Проверка на пересечение дат
        cursor.execute("""
            SELECT COUNT(*) FROM УчебныеПериоды
            WHERE ID_группы = ?
            AND (
                (ДатаНачала <= ? AND ДатаОкончания >= ?) OR
                (ДатаНачала <= ? AND ДатаОкончания >= ?) OR
                (ДатаНачала >= ? AND ДатаОкончания <= ?)
            )
        """, (
            data['group_id'],
            data['start'], data['start'],
            data['end'], data['end'],
            data['start'], data['end']
        ))
        
        if cursor.fetchone()[0] > 0:
            conn.close()
            return jsonify({'success': False, 'message': 'Период пересекается с существующим!'}), 400
        
        cursor.execute("""
            INSERT INTO УчебныеПериоды (ID_группы, НомерСеместра, ТипПериода, ДатаНачала, ДатаОкончания)
            VALUES (?, ?, ?, ?, ?)
        """, (data['group_id'], data['semester'], data['type'], data['start'], data['end']))
        
        conn.commit()
        new_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
        conn.close()
        
        return jsonify({'success': True, 'period_id': new_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/academic-periods/<int:period_id>', methods=['DELETE'])
def delete_academic_period(period_id):
    """Удалить учебный период"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM УчебныеПериоды WHERE ID_периода = ?", period_id)
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/<int:group_id>', methods=['GET'])
def get_schedule(group_id):
    week_type = request.args.get('week_type')
    date_param = request.args.get('date')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        target_year = None
        if date_param:
            try:
                target_year = datetime.strptime(date_param, '%Y-%m-%d').year
            except ValueError:
                pass
        
        query = """
            SELECT r.ID_расписания, r.ДеньНедели, r.Время, p.Название AS Предмет,
                   r.ТипПары, r.Аудитория, u.ФИО AS Преподаватель,
                   r.ID_предмета, r.ID_преподавателя, r.ТипНедели, r.Год
            FROM Расписание r
            JOIN Предметы p ON r.ID_предмета = p.ID_предмета
            JOIN Пользователи u ON r.ID_преподавателя = u.ID_пользователя
            WHERE r.ID_группы = ?
              AND r.ТипНедели = ?
        """
        params = [group_id, int(week_type) if week_type else 1]
        
        if target_year:
            query += " AND (r.Год = ? OR r.Год IS NULL)"
            params.append(target_year)
        
        query += """ ORDER BY CASE r.ДеньНедели WHEN 'ПН' THEN 1 WHEN 'ВТ' THEN 2 WHEN 'СР' THEN 3
                     WHEN 'ЧТ' THEN 4 WHEN 'ПТ' THEN 5 WHEN 'СБ' THEN 6 END, r.Время """
                     
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        schedule = []
        for row in rows:
            schedule.append({
                'id': row.ID_расписания, 'day': row.ДеньНедели, 'time': row.Время,
                'subject': row.Предмет, 'type': row.ТипПары, 'classroom': row.Аудитория,
                'teacher': row.Преподаватель, 'subject_id': row.ID_предмета,
                'teacher_id': row.ID_преподавателя, 'week_type': row.ТипНедели
            })
        return jsonify(schedule)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/schedule/update', methods=['POST'])
def update_schedule():
    """Обновление расписания с учётом UNIQUE KEY (MERGE логика)"""
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        week_type = data.get('week_type', 1)
        group_id = data['group_id']
        current_year = date.today().year

        cursor.execute("""
            DELETE FROM Расписание 
            WHERE ID_группы = ? AND ТипНедели = ? AND (Год = ? OR Год IS NULL)
        """, (group_id, week_type, current_year))

        for pair in data['pairs']:
            
            cursor.execute("""
                SELECT COUNT(*) FROM Расписание
                WHERE ID_группы = ? AND ДеньНедели = ? AND Время = ? AND ТипНедели = ? AND (Год = ? OR Год IS NULL)
            """, (group_id, pair['day'], pair['time'], week_type, current_year))

            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    INSERT INTO Расписание (ID_группы, ДеньНедели, Время, ID_предмета, ТипПары, Аудитория, ID_преподавателя, ТипНедели, Год)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (group_id, pair['day'], pair['time'], pair['subject_id'],
                      pair['type'], pair['classroom'], pair['teacher_id'], week_type, current_year))

        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        print(f"Ошибка обновления расписания: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/check-period', methods=['GET'])
def check_current_period():
    """Проверить текущий период для группы и даты"""
    group_id = request.args.get('group_id')
    check_date = request.args.get('date')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ТипПериода FROM УчебныеПериоды
            WHERE ID_группы = ?
            AND ДатаНачала <= ?
            AND ДатаОкончания >= ?
        """, (group_id, check_date, check_date))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return jsonify({'has_period': True, 'type': result.ТипПериода})
        return jsonify({'has_period': False, 'type': None})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/schedule/check-next', methods=['GET'])
def check_next_schedule():
    """Проверить наличие периода для навигации"""
    group_id = request.args.get('group_id')
    target_date = request.args.get('target_date')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*)
            FROM УчебныеПериоды
            WHERE ID_группы = ?
            AND ДатаНачала <= ?
            AND ДатаОкончания >= ?
        """, (group_id, target_date, target_date))
        
        count = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({'has_period': count > 0})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/schedule/lessons-by-date', methods=['GET'])
def get_lessons_by_date():
    group_id = request.args.get('group_id')
    subject_id = request.args.get('subject_id')
    date_str = request.args.get('date')
    
    if not all([group_id, subject_id, date_str]):
        return jsonify({'error': 'Необходимы параметры group_id, subject_id, date'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        days_map = {0: 'ПН', 1: 'ВТ', 2: 'СР', 3: 'ЧТ', 4: 'ПТ', 5: 'СБ', 6: 'ВС'}
        day_of_week = days_map[date_obj.weekday()]
        week_num = ((date_obj.isocalendar()[1] - 1) % 2) + 1
        target_year = date_obj.year
        
        cursor.execute("""
            SELECT Время FROM Расписание
            WHERE ID_группы = ?
            AND ID_предмета = ?
            AND ДеньНедели = ?
            AND ТипНедели = ?
            AND (Год = ? OR Год IS NULL)
            ORDER BY Время
        """, (group_id, subject_id, day_of_week, week_num, target_year))
        
        rows = cursor.fetchall()
        conn.close()
        
        times = [row.Время for row in rows]
        return jsonify({'times': times, 'day': day_of_week, 'week': week_num})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/grades/<int:student_id>', methods=['GET'])
def get_grades(student_id):
    date_from = request.args.get('from')
    date_to = request.args.get('to')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "SELECT ID_оценки, ID_предмета, Дата, Оценка FROM Оценки WHERE ID_студента = ?"
        params = [student_id]
        if date_from and date_to:
            query += " AND Дата BETWEEN ? AND ?"
            params.extend([date_from, date_to])
        query += " ORDER BY Дата"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        grades = [{'id': r.ID_оценки, 'subject_id': r.ID_предмета, 'date': r.Дата.isoformat() if r.Дата else None, 'grade': r.Оценка} for r in rows]
        return jsonify(grades)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/grades', methods=['POST'])
def save_grade():
    data = request.json
    try:
        grade = data.get('grade', '').strip().upper()
        valid_grades = ['2', '3', '4', '5', 'Н']
        if grade and grade not in valid_grades:
            return jsonify({'success': False, 'message': 'Допустимые значения: 2, 3, 4, 5, Н'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT ID_оценки FROM Оценки WHERE ID_студента = ? AND ID_предмета = ? AND Дата = ?",
            (data['student_id'], data['subject_id'], data['date'])
        )
        existing = cursor.fetchone()
        if existing:
            cursor.execute("UPDATE Оценки SET Оценка = ? WHERE ID_оценки = ?", (grade, existing.ID_оценки))
        else:
            cursor.execute(
                "INSERT INTO Оценки (ID_студента, ID_предмета, Дата, Оценка) VALUES (?, ?, ?, ?)",
                (data['student_id'], data['subject_id'], data['date'], grade)
            )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/homework/<int:group_id>', methods=['GET'])
def get_homework(group_id):
    date_from = request.args.get('from')
    date_to = request.args.get('to')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT h.ID_задания, h.ID_предмета, p.Название AS Предмет, h.СрокСдачи, h.Текст, h.ВремяПары
            FROM ДомашниеЗадания h
            JOIN Предметы p ON h.ID_предмета = p.ID_предмета
            WHERE h.ID_группы = ?
        """
        params = [group_id]
        if date_from and date_to:
            query += " AND h.СрокСдачи BETWEEN ? AND ?"
            params.extend([date_from, date_to])
        query += " ORDER BY h.СрокСдачи, h.ВремяПары"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        homeworks = [{
            'id': r.ID_задания, 'subject_id': r.ID_предмета, 'subject': r.Предмет,
            'due_date': r.СрокСдачи.isoformat() if r.СрокСдачи else None,
            'text': r.Текст, 'time': r.ВремяПары
        } for r in rows]
        return jsonify(homeworks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/homework', methods=['POST'])
def save_homework():
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if data.get('due_date') and data.get('time'):
            date_obj = datetime.strptime(data['due_date'], '%Y-%m-%d')
            days_map = {0: 'ПН', 1: 'ВТ', 2: 'СР', 3: 'ЧТ', 4: 'ПТ', 5: 'СБ', 6: 'ВС'}
            day_of_week = days_map[date_obj.weekday()]
            week_num = ((date_obj.isocalendar()[1] - 1) % 2) + 1
            target_year = date_obj.year
            
            cursor.execute("""
                SELECT COUNT(*) FROM Расписание
                WHERE ID_группы = ? AND ID_предмета = ? 
                AND ДеньНедели = ? AND Время = ? AND ТипНедели = ?
                AND (Год = ? OR Год IS NULL)
            """, (data['group_id'], data['subject_id'], day_of_week, data['time'], week_num, target_year))
            
            if cursor.fetchone()[0] == 0:
                return jsonify({'success': False, 'message': 'На выбранную дату и время нет пары по этому предмету'}), 400
        
        if data.get('id'):
           
            if data.get('time'):
                cursor.execute(
                    "UPDATE ДомашниеЗадания SET ID_предмета = ?, СрокСдачи = ?, ВремяПары = ?, Текст = ? WHERE ID_задания = ?",
                    (data['subject_id'], data['due_date'], data['time'], data['text'], data['id'])
                )
            else:
                cursor.execute(
                    "UPDATE ДомашниеЗадания SET ID_предмета = ?, СрокСдачи = ?, ВремяПары = NULL, Текст = ? WHERE ID_задания = ?",
                    (data['subject_id'], data['due_date'], data['text'], data['id'])
                )
        else:
            
            if data.get('time'):
                cursor.execute(
                    "INSERT INTO ДомашниеЗадания (ID_предмета, ID_группы, СрокСдачи, ВремяПары, Текст) VALUES (?, ?, ?, ?, ?)",
                    (data['subject_id'], data['group_id'], data['due_date'], data['time'], data['text'])
                )
            else:
                cursor.execute(
                    "INSERT INTO ДомашниеЗадания (ID_предмета, ID_группы, СрокСдачи, ВремяПары, Текст) VALUES (?, ?, ?, NULL, ?)",
                    (data['subject_id'], data['group_id'], data['due_date'], data['text'])
                )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        print(f"Ошибка сохранения ДЗ: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/homework/<int:homework_id>', methods=['DELETE'])
def delete_homework(homework_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ДомашниеЗадания WHERE ID_задания = ?", homework_id)
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    print("Сервер запущен: http://127.0.0.1:5000")
    app.run(debug=True)