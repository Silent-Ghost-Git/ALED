"""
ALED - Custom Server
======================================
This server provides API endpoints for:
- Listing worksheets dynamically from folders
- Saving plans to files
- Managing portion screenshots (upload/list/reorder)
- Serving static files
"""

import base64
import binascii
import http.server
import json
import os
import re
import socketserver
import urllib.parse
from datetime import datetime
from pathlib import Path

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def get_data_dir():
    return os.path.join(DIRECTORY, 'data')

def get_data_file():
    return os.path.join(DIRECTORY, 'aled_data.json')

def load_data():
    try:
        with open(get_data_file(), 'r') as f:
            return json.load(f)
    except:
        return {'currentExam': None, 'subjects': [], 'order': [], 'currentSubject': None, 'examOrder': []}

def save_data(data):
    try:
        with open(get_data_file(), 'w') as f:
            json.dump(data, f)
    except:
        pass

def load_saved_exam():
    data = load_data()
    return data.get('currentExam')

def save_current_exam(exam_name):
    data = load_data()
    data['currentExam'] = exam_name
    save_data(data)

def get_exam_folder():
    saved = load_saved_exam()
    data_dir = get_data_dir()
    if saved and os.path.isdir(os.path.join(data_dir, saved)):
        return saved
    if not os.path.isdir(data_dir):
        return None
    for entry in sorted(os.listdir(data_dir)):
        entry_path = os.path.join(data_dir, entry)
        if os.path.isdir(entry_path):
            try:
                has_subfolders = any(os.path.isdir(os.path.join(entry_path, sub)) for sub in os.listdir(entry_path) if os.path.isdir(os.path.join(entry_path, sub)))
                if has_subfolders:
                    return entry
            except OSError:
                continue
    return None

EXAM_FOLDER = get_exam_folder()

def get_subject_base_dir():
    if EXAM_FOLDER:
        return os.path.join(get_data_dir(), EXAM_FOLDER)
    return get_data_dir()

def get_subject_url_path():
    if EXAM_FOLDER:
        return f'data/{urllib.parse.quote(EXAM_FOLDER)}'
    return 'data'

ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
ALLOWED_ICON_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'}
ALLOWED_WORKSHEET_EXTENSIONS = {'.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.webp'}
ALLOWED_PORTION_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.doc', '.docx'}
ALLOWED_ALL_EXTENSIONS = ALLOWED_PORTION_EXTENSIONS | {'.md', '.txt', '.svg'}


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        if path == '/api/subjects':
            self.handle_get_subjects()
            return

        if path == '/api/subjects-data':
            self.handle_get_subjects_data()
            return

        if path == '/api/state':
            self.handle_get_state()
            return

        if path == '/api/worksheets':
            subject = query.get('subject', [''])[0]
            self.handle_worksheets(subject)
            return

        if path == '/api/plan':
            subject = query.get('subject', [''])[0]
            self.handle_get_plan(subject)
            return

        if path == '/api/portion-images':
            subject = query.get('subject', [''])[0]
            self.handle_get_portion_images(subject)
            return

        if path == '/api/todos':
            subject = query.get('subject', [''])[0]
            self.handle_get_todos(subject)
            return

        if path == '/api/portions':
            self.handle_get_portions()
            return
        
        if path == '/api/learning-materials':
            subject = query.get('subject', [''])[0]
            self.handle_learning_materials(subject)
            return
        
        if path == '/api/exams':
            self.handle_get_exams()
            return
        
        if path == '/api/exam/current':
            self.handle_get_current_exam()
            return
        
        super().do_GET()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path

        if path == '/api/subjects':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_create_subject(data)
            return

        if path == '/api/subjects-data':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_save_subjects_data(data)
            return

        if path == '/api/state':
            self.handle_get_state()
            return

        if path == '/api/state/save':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_save_state(data)
            return

        if path == '/api/subject-icon/upload':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_upload_subject_icon(data)
            return

        if path == '/api/plan':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_save_plan(data)
            return

        if path == '/api/todos':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_save_todos(data)
            return

        if path == '/api/portion-images':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_upload_portion_image(data)
            return

        if path == '/api/portion-images/reorder':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_reorder_portion_images(data)
            return

        if path == '/api/portion-images/delete':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_delete_portion_image(data)
            return

        if path == '/api/worksheets/upload':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_upload_worksheet(data)
            return

        if path == '/api/worksheets/delete':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_delete_worksheet(data)
            return

        if path == '/api/portions/upload':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_upload_portion(data)
            return

        if path == '/api/portions/reorder':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_reorder_portions(data)
            return

        if path == '/api/portions/delete':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_delete_portion(data)
            return
        
        if path == '/api/learning-materials/upload':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_upload_learning_material(data)
            return
        
        if path == '/api/learning-materials/delete':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_delete_learning_material(data)
            return
        
        if path == '/api/exams':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_create_exam(data)
            return

        if path == '/api/exams/reorder':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_reorder_exams(data)
            return
        
        if path == '/api/exam/rename':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_rename_exam(data)
            return
        
        if path == '/api/exam/set-current':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_set_current_exam(data)
            return
        
        self.send_error(404, 'Not Found')

    def do_DELETE(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path

        if path == '/api/subjects':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_delete_subject(data)
            return

        if path == '/api/exam':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_delete_exam(data)
            return

        self.send_error(404, 'Not Found')

    def handle_create_subject(self, data):
        subject = data.get('subject')
        if not subject:
            self.send_json({'error': 'Subject name required'}, 400)
            return

        subject_dir = self.get_subject_data_dir(subject)
        if not subject_dir:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        try:
            os.makedirs(subject_dir, exist_ok=True)
            portion_dir = self.get_portion_dir(subject)
            worksheets_dir = self.get_worksheets_dir(subject)
            lm_dir = self.get_learning_materials_dir(subject)
            if portion_dir:
                os.makedirs(portion_dir, exist_ok=True)
            if worksheets_dir:
                os.makedirs(worksheets_dir, exist_ok=True)
            if lm_dir:
                os.makedirs(lm_dir, exist_ok=True)
            plan_path = self.get_plan_path(subject)
            if plan_path:
                os.makedirs(os.path.dirname(plan_path), exist_ok=True)

            self.send_json({'success': True, 'folder': os.path.basename(subject_dir)})
        except Exception as e:
            self.send_json({'error': f'Failed to create subject folder: {str(e)}'}, 500)

    def handle_delete_subject(self, data):
        subject = data.get('subject')
        subject_name = data.get('subjectName')
        if not subject and not subject_name:
            self.send_json({'error': 'Subject name required'}, 400)
            return

        candidates = []
        if isinstance(subject, str) and subject.strip():
            candidates.append(subject.strip())
        if isinstance(subject_name, str) and subject_name.strip() and subject_name.strip() not in candidates:
            candidates.append(subject_name.strip())

        deleted_any = False
        import shutil
        for candidate in candidates:
            subject_dir = self.get_subject_data_dir(candidate)
            if not subject_dir or not os.path.exists(subject_dir):
                continue
            try:
                shutil.rmtree(subject_dir)
                deleted_any = True
            except Exception as e:
                self.send_json({'error': f'Failed to delete folder: {str(e)}'}, 500)
                return

        if deleted_any:
            self.send_json({'success': True, 'message': 'Deleted subject folder'})
        else:
            self.send_json({'success': True, 'message': 'Folder already deleted or does not exist'})

    def read_exams_config(self):
        default_config = {'order': [], 'currentExam': None}
        data = load_data()

        order = data.get('examOrder')
        if not isinstance(order, list):
            order = []

        normalized_order = []
        seen = set()
        for exam_name in order:
            if not isinstance(exam_name, str):
                continue
            if exam_name in seen:
                continue
            normalized_order.append(exam_name)
            seen.add(exam_name)

        current_exam = data.get('currentExam')
        if current_exam is not None and not isinstance(current_exam, str):
            current_exam = None

        if normalized_order:
            return {'order': normalized_order, 'currentExam': current_exam}

        legacy_config_path = os.path.join(get_data_dir(), 'exams.json')
        if not os.path.isfile(legacy_config_path):
            return {'order': normalized_order, 'currentExam': current_exam}

        try:
            with open(legacy_config_path, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
        except (json.JSONDecodeError, OSError):
            return {'order': normalized_order, 'currentExam': current_exam}

        if not isinstance(loaded, dict):
            return {'order': normalized_order, 'currentExam': current_exam}

        legacy_order = loaded.get('order')
        if not isinstance(legacy_order, list):
            legacy_exams = loaded.get('exams', [])
            legacy_order = legacy_exams if isinstance(legacy_exams, list) else []

        migrated_order = []
        seen = set()
        for exam_name in legacy_order:
            if not isinstance(exam_name, str):
                continue
            if exam_name in seen:
                continue
            migrated_order.append(exam_name)
            seen.add(exam_name)

        if migrated_order:
            self.write_exams_config({
                'order': migrated_order,
                'currentExam': current_exam if current_exam is not None else loaded.get('currentExam')
            })
            return {
                'order': migrated_order,
                'currentExam': current_exam if current_exam is not None else loaded.get('currentExam')
            }

        return default_config

    def write_exams_config(self, config):
        order = config.get('order', [])
        normalized_order = []
        seen = set()
        if isinstance(order, list):
            for exam_name in order:
                if not isinstance(exam_name, str):
                    continue
                if exam_name in seen:
                    continue
                normalized_order.append(exam_name)
                seen.add(exam_name)

        current_exam = config.get('currentExam')
        if current_exam is not None and not isinstance(current_exam, str):
            current_exam = None

        data = load_data()
        data['examOrder'] = normalized_order
        if current_exam is not None:
            data['currentExam'] = current_exam
        save_data(data)

    def get_all_exams(self):
        data_dir = get_data_dir()
        if not os.path.isdir(data_dir):
            return []
        exams = []
        for entry in sorted(os.listdir(data_dir), key=str.lower):
            entry_path = os.path.join(data_dir, entry)
            if os.path.isdir(entry_path):
                has_subfolders = any(os.path.isdir(os.path.join(entry_path, sub)) for sub in os.listdir(entry_path) if os.path.isdir(os.path.join(entry_path, sub)))
                if has_subfolders:
                    exams.append(entry)
        return exams

    def get_ordered_exams(self):
        all_exams = self.get_all_exams()
        config = self.read_exams_config()
        saved_order = config.get('order', [])

        ordered = []
        seen = set()
        available = set(all_exams)
        for exam_name in saved_order:
            if exam_name not in available or exam_name in seen:
                continue
            ordered.append(exam_name)
            seen.add(exam_name)

        for exam_name in all_exams:
            if exam_name not in seen:
                ordered.append(exam_name)
                seen.add(exam_name)

        current_exam = config.get('currentExam')
        if current_exam is not None and current_exam not in available:
            current_exam = None

        if ordered != saved_order or current_exam != config.get('currentExam'):
            config['order'] = ordered
            config['currentExam'] = current_exam
            self.write_exams_config(config)

        return ordered

    def handle_get_exams(self):
        all_exams = self.get_ordered_exams()
        exams_data = []
        for exam in all_exams:
            subjects = []
            exam_path = os.path.join(get_data_dir(), exam)
            if os.path.isdir(exam_path):
                for sub in os.listdir(exam_path):
                    sub_path = os.path.join(exam_path, sub)
                    if os.path.isdir(sub_path) and sub not in ['portions', 'quotes.js']:
                        subjects.append(sub)
            exams_data.append({'name': exam, 'subjects': subjects})
        self.send_json({'exams': exams_data, 'currentExam': EXAM_FOLDER})

    def handle_get_current_exam(self):
        self.send_json({'currentExam': EXAM_FOLDER})

    def handle_get_subjects(self):
        subjects = []
        exam_path = get_subject_base_dir()
        base_url_path = get_subject_url_path()
        if os.path.isdir(exam_path):
            for sub in os.listdir(exam_path):
                sub_path = os.path.join(exam_path, sub)
                if os.path.isdir(sub_path) and sub not in ['portions', 'quotes.js']:
                    icon_url = None
                    for ext in ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']:
                        potential_icon = os.path.join(sub_path, f'icon{ext}')
                        if os.path.isfile(potential_icon):
                            icon_url = f'/{base_url_path}/{urllib.parse.quote(sub)}/icon{ext}'
                            break
                    subjects.append({'id': sub, 'name': sub, 'icon': icon_url})
        self.send_json(subjects)

    def handle_get_subjects_data(self):
        data = load_data()
        self.send_json({'subjects': data.get('subjects', []), 'order': data.get('order', [])})

    def handle_save_subjects_data(self, incoming):
        data = load_data()
        data['subjects'] = incoming.get('subjects', [])
        data['order'] = incoming.get('order', [])
        save_data(data)
        self.send_json({'success': True})

    def handle_get_state(self):
        data = load_data()
        self.send_json({'currentSubject': data.get('currentSubject')})

    def handle_save_state(self, incoming):
        data = load_data()
        data['currentSubject'] = incoming.get('currentSubject')
        save_data(data)
        self.send_json({'success': True})

    TEMPLATE_SUBJECTS = {
        'cbse10': ['English', 'Maths', 'Science', 'Hindi', 'Kannada', 'SST'],
        'cbse11': ['Physics', 'Chemistry', 'Maths', 'Biology', 'ComputerScience'],
        'sat': ['Math', 'English'],
        'custom': []
    }

    def handle_create_exam(self, data):
        exam_name = data.get('name', '').strip()
        template = data.get('template', 'custom')
        if not exam_name:
            self.send_json({'error': 'Exam name required'}, 400)
            return
        
        import re
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', exam_name)
        exam_folder = sanitized
        
        exam_path = os.path.join(get_data_dir(), exam_folder)
        if os.path.exists(exam_path):
            self.send_json({'error': 'Exam already exists'}, 400)
            return
        
        try:
            os.makedirs(exam_path, exist_ok=True)
            
            subjects = self.TEMPLATE_SUBJECTS.get(template, [])
            for subject in subjects:
                subject_path = os.path.join(exam_path, subject)
                os.makedirs(os.path.join(subject_path, 'portion'), exist_ok=True)
                os.makedirs(os.path.join(subject_path, 'plan'), exist_ok=True)
                os.makedirs(os.path.join(subject_path, 'worksheets'), exist_ok=True)
                os.makedirs(os.path.join(subject_path, 'learning_materials'), exist_ok=True)
            
            global EXAM_FOLDER
            EXAM_FOLDER = exam_folder
            save_current_exam(exam_folder)

            config = self.read_exams_config()
            order = [name for name in config.get('order', []) if name != exam_folder]
            order.append(exam_folder)
            config['order'] = order
            config['currentExam'] = exam_folder
            self.write_exams_config(config)
            
            self.send_json({'success': True, 'exam': exam_folder, 'subjects': subjects})
        except Exception as e:
            self.send_json({'error': f'Failed to create exam: {str(e)}'}, 500)

    def handle_rename_exam(self, data):
        old_name = data.get('oldName', '').strip()
        new_name = data.get('newName', '').strip()
        if not old_name or not new_name:
            self.send_json({'error': 'Old and new name required'}, 400)
            return
        
        import re
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', new_name)
        new_folder = sanitized
        
        old_path = os.path.join(get_data_dir(), old_name)
        new_path = os.path.join(get_data_dir(), new_folder)
        
        if not os.path.exists(old_path):
            self.send_json({'error': 'Exam not found'}, 404)
            return
        if os.path.exists(new_path):
            self.send_json({'error': 'Exam name already exists'}, 400)
            return
        
        try:
            os.rename(old_path, new_path)
            
            global EXAM_FOLDER
            if EXAM_FOLDER == old_name:
                EXAM_FOLDER = new_folder
                save_current_exam(new_folder)

            config = self.read_exams_config()
            updated_order = []
            for exam_name in config.get('order', []):
                updated_order.append(new_folder if exam_name == old_name else exam_name)
            if new_folder not in updated_order:
                updated_order.append(new_folder)
            config['order'] = updated_order

            if config.get('currentExam') == old_name:
                config['currentExam'] = new_folder

            self.write_exams_config(config)
            
            self.send_json({'success': True, 'newName': new_folder})
        except Exception as e:
            self.send_json({'error': f'Failed to rename exam: {str(e)}'}, 500)

    def handle_set_current_exam(self, data):
        exam_name = data.get('exam', '').strip()
        if not exam_name:
            self.send_json({'error': 'Exam name required'}, 400)
            return
        
        exam_path = os.path.join(get_data_dir(), exam_name)
        if not os.path.exists(exam_path):
            self.send_json({'error': 'Exam not found'}, 404)
            return
        
        global EXAM_FOLDER
        EXAM_FOLDER = exam_name
        save_current_exam(exam_name)

        config = self.read_exams_config()
        order = [name for name in config.get('order', []) if name != exam_name]
        order.append(exam_name)
        config['order'] = order
        config['currentExam'] = exam_name
        self.write_exams_config(config)
        
        self.send_json({'success': True, 'currentExam': exam_name})

    def handle_reorder_exams(self, data):
        order = data.get('order', [])
        if not isinstance(order, list):
            self.send_json({'error': 'order must be a list'}, 400)
            return

        all_exams = self.get_all_exams()
        available = set(all_exams)
        normalized = []
        seen = set()
        for item in order:
            if not isinstance(item, str):
                continue
            if item not in available or item in seen:
                continue
            normalized.append(item)
            seen.add(item)

        for exam_name in all_exams:
            if exam_name not in seen:
                normalized.append(exam_name)

        config = self.read_exams_config()
        config['order'] = normalized
        self.write_exams_config(config)

        self.send_json({'success': True, 'order': normalized})

    def handle_delete_exam(self, data):
        exam_name = data.get('exam', '').strip()
        if not exam_name:
            self.send_json({'error': 'Exam name required'}, 400)
            return
        
        exam_path = os.path.join(get_data_dir(), exam_name)
        if not os.path.exists(exam_path):
            self.send_json({'error': 'Exam not found'}, 404)
            return
        
        try:
            import shutil
            shutil.rmtree(exam_path)

            config = self.read_exams_config()
            order = [name for name in config.get('order', []) if name != exam_name]

            remaining_exams = self.get_all_exams()
            available = set(remaining_exams)
            order = [name for name in order if name in available]
            for name in remaining_exams:
                if name not in order:
                    order.append(name)

            global EXAM_FOLDER
            if EXAM_FOLDER == exam_name:
                EXAM_FOLDER = order[0] if order else None
            elif EXAM_FOLDER not in available:
                EXAM_FOLDER = order[0] if order else None

            save_current_exam(EXAM_FOLDER)
            config['order'] = order
            config['currentExam'] = EXAM_FOLDER
            self.write_exams_config(config)
            
            self.send_json({'success': True})
        except Exception as e:
            self.send_json({'error': f'Failed to delete exam: {str(e)}'}, 500)

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json({'error': 'Invalid JSON'}, 400)
            return None

    def get_subject_folder(self, subject):
        if not isinstance(subject, str):
            return None
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', subject)
        return sanitized.title().replace(' ', '')

    def get_subject_data_dir(self, subject):
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            return None
        return os.path.join(get_subject_base_dir(), folder_name)

    def get_portion_dir(self, subject):
        data_dir = self.get_subject_data_dir(subject)
        if not data_dir:
            return None
        return os.path.join(data_dir, 'portion')

    def get_worksheets_dir(self, subject):
        data_dir = self.get_subject_data_dir(subject)
        if not data_dir:
            return None
        return os.path.join(data_dir, 'worksheets')

    def get_plan_path(self, subject):
        data_dir = self.get_subject_data_dir(subject)
        if not data_dir:
            return None
        return os.path.join(data_dir, 'plan', 'plan.txt')

    def get_global_portions_dir(self):
        return os.path.join(get_subject_base_dir(), 'portions')

    def get_portions_order_path(self):
        return os.path.join(self.get_global_portions_dir(), 'order.json')

    def get_portion_order_path(self, subject):
        portion_dir = self.get_portion_dir(subject)
        if not portion_dir:
            return None
        return os.path.join(portion_dir, 'order.json')

    def infer_icon_extension(self, filename, mime_type):
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_ICON_EXTENSIONS:
            return ext

        mime_map = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'image/svg+xml': '.svg'
        }
        return mime_map.get(str(mime_type).lower(), '.png')

    def sanitize_filename(self, name):
        base = Path(name or '').name.strip()
        if not base:
            return ''
        safe = ''.join(ch for ch in base if ch.isalnum() or ch in ('-', '_', '.', ' ')).strip()
        return safe.replace(' ', '_')

    def infer_extension(self, filename, mime_type):
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_IMAGE_EXTENSIONS:
            return ext

        mime_map = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/webp': '.webp',
            'image/gif': '.gif'
        }
        return mime_map.get(str(mime_type).lower(), '.png')

    def unique_filename(self, directory, preferred_name, allowed_exts=None):
        preferred = self.sanitize_filename(preferred_name)
        if not preferred:
            preferred = f"file_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"

        stem = Path(preferred).stem
        ext = Path(preferred).suffix.lower()
        if allowed_exts is None:
            allowed_exts = ALLOWED_IMAGE_EXTENSIONS
        if ext not in allowed_exts:
            ext = '.bin'

        candidate = f'{stem}{ext}'
        index = 1
        while os.path.exists(os.path.join(directory, candidate)):
            candidate = f'{stem}_{index}{ext}'
            index += 1
        return candidate

    def read_order(self, subject):
        order_path = self.get_portion_order_path(subject)
        if not order_path or not os.path.isfile(order_path):
            return []

        try:
            with open(order_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
            if isinstance(data, list):
                return [str(item) for item in data]
        except (json.JSONDecodeError, OSError):
            pass
        return []

    def write_order(self, subject, order):
        order_path = self.get_portion_order_path(subject)
        if not order_path:
            return

        os.makedirs(os.path.dirname(order_path), exist_ok=True)
        with open(order_path, 'w', encoding='utf-8') as file:
            json.dump(order, file, ensure_ascii=False, indent=2)

    def list_portion_images(self, subject):
        folder_name = self.get_subject_folder(subject)
        portion_dir = self.get_portion_dir(subject)
        if not folder_name or not portion_dir:
            return []

        if not os.path.isdir(portion_dir):
            return []

        files = []
        for filename in os.listdir(portion_dir):
            path = os.path.join(portion_dir, filename)
            ext = Path(filename).suffix.lower()
            if os.path.isfile(path) and ext in ALLOWED_IMAGE_EXTENSIONS:
                files.append(filename)

        order = self.read_order(subject)
        existing = set(files)
        ordered = [name for name in order if name in existing]
        remaining = sorted([name for name in files if name not in set(ordered)], key=str.lower)
        final_names = ordered + remaining

        if final_names != order:
            self.write_order(subject, final_names)

        result = []
        base_path = get_subject_url_path()
        for name in final_names:
            url = '/{}/{}/portion/{}'.format(
                base_path,
                urllib.parse.quote(folder_name),
                urllib.parse.quote(name)
            )
            result.append({'name': name, 'url': url})
        return result

    def handle_worksheets(self, subject):
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        folder_path = self.get_worksheets_dir(subject)

        files = []
        if folder_path and os.path.isdir(folder_path):
            for filename in os.listdir(folder_path):
                filepath = os.path.join(folder_path, filename)
                if os.path.isfile(filepath):
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in ALLOWED_WORKSHEET_EXTENSIONS:
                        files.append({
                            'name': filename,
                            'file': '{}/{}/worksheets/{}'.format(get_subject_url_path(), folder_name, filename),
                            'type': ext[1:]
                        })

        files.sort(key=lambda item: item['name'].lower())
        self.send_json(files)

    def handle_get_plan(self, subject):
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        plan_path = self.get_plan_path(subject)

        if plan_path and os.path.isfile(plan_path):
            with open(plan_path, 'r', encoding='utf-8') as file:
                content = file.read()
            self.send_json({'content': content})
        else:
            self.send_json({'content': ''})

    def handle_save_plan(self, data):
        subject = data.get('subject', '')
        content = data.get('content', '')

        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        plan_path = self.get_plan_path(subject)
        if not plan_path:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        os.makedirs(os.path.dirname(plan_path), exist_ok=True)

        with open(plan_path, 'w', encoding='utf-8') as file:
            file.write(content)

        self.send_json({'success': True, 'message': 'Plan saved!'})

    def get_todos_path(self, subject):
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            return None
        data_dir = Path(get_subject_base_dir()) / folder_name
        todos_path = data_dir / 'todos.json'
        return str(todos_path)

    def handle_get_todos(self, subject):
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        todos_path = self.get_todos_path(subject)

        if todos_path and os.path.isfile(todos_path):
            try:
                with open(todos_path, 'r', encoding='utf-8') as file:
                    todos = json.load(file)
                self.send_json({'todos': todos})
            except:
                self.send_json({'todos': []})
        else:
            self.send_json({'todos': []})

    def handle_save_todos(self, data):
        subject = data.get('subject', '')
        todos = data.get('todos', [])

        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        todos_path = self.get_todos_path(subject)
        if not todos_path:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        todos_dir = os.path.dirname(todos_path)
        if todos_dir and todos_dir.strip():
            os.makedirs(todos_dir, exist_ok=True)

        with open(todos_path, 'w', encoding='utf-8') as file:
            json.dump(todos, file, indent=2)

        self.send_json({'success': True, 'message': 'Todos saved!'})

    def handle_get_portion_images(self, subject):
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        self.send_json(self.list_portion_images(subject))

    def handle_upload_portion_image(self, data):
        subject = data.get('subject', '')
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        image_base64 = data.get('image_base64', '')
        if not isinstance(image_base64, str) or not image_base64.strip():
            self.send_json({'error': 'image_base64 is required'}, 400)
            return

        raw = image_base64.strip()
        if ',' in raw and raw.lower().startswith('data:'):
            raw = raw.split(',', 1)[1]

        try:
            image_bytes = base64.b64decode(raw, validate=True)
        except (ValueError, binascii.Error):
            self.send_json({'error': 'Invalid base64 image data'}, 400)
            return

        if len(image_bytes) > 12 * 1024 * 1024:
            self.send_json({'error': 'Image too large (max 12MB)'}, 400)
            return

        portion_dir = self.get_portion_dir(subject)
        if not portion_dir:
            return
        os.makedirs(portion_dir, exist_ok=True)

        original_name = data.get('filename', '')
        mime_type = data.get('mime_type', '')
        ext = self.infer_extension(original_name, mime_type)

        preferred_stem = Path(self.sanitize_filename(original_name)).stem
        preferred_name = f'{preferred_stem or "portion"}{ext}'
        final_name = self.unique_filename(portion_dir, preferred_name, ALLOWED_IMAGE_EXTENSIONS)
        final_path = os.path.join(portion_dir, final_name)

        with open(final_path, 'wb') as file:
            file.write(image_bytes)

        current_order = self.read_order(subject)
        if final_name not in current_order:
            current_order.append(final_name)
        self.write_order(subject, current_order)

        self.send_json({'success': True, 'name': final_name})

    def handle_upload_subject_icon(self, data):
        subject = data.get('subject', '')
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        icon_base64 = data.get('icon_base64', '')
        if not isinstance(icon_base64, str) or not icon_base64.strip():
            self.send_json({'error': 'icon_base64 is required'}, 400)
            return

        raw = icon_base64.strip()
        mime_type = data.get('mime_type', '')
        if raw.lower().startswith('data:') and ',' in raw:
            header, raw_data = raw.split(',', 1)
            raw = raw_data
            if ';' in header:
                mime_type = header[5:].split(';', 1)[0]
            else:
                mime_type = header[5:]

        try:
            icon_bytes = base64.b64decode(raw, validate=True)
        except (ValueError, binascii.Error):
            self.send_json({'error': 'Invalid base64 icon data'}, 400)
            return

        if len(icon_bytes) > 2 * 1024 * 1024:
            self.send_json({'error': 'Icon too large (max 2MB)'}, 400)
            return

        subject_dir = self.get_subject_data_dir(subject)
        if not subject_dir:
            self.send_json({'error': 'Invalid subject'}, 400)
            return
        os.makedirs(subject_dir, exist_ok=True)

        original_name = data.get('filename', '')
        ext = self.infer_icon_extension(original_name, mime_type)
        if ext not in ALLOWED_ICON_EXTENSIONS:
            self.send_json({'error': 'Unsupported icon format'}, 400)
            return

        # Keep one icon per subject by replacing old icon.* files.
        for existing in os.listdir(subject_dir):
            if existing.startswith('icon') and Path(existing).suffix.lower() in ALLOWED_ICON_EXTENSIONS:
                existing_path = os.path.join(subject_dir, existing)
                if os.path.isfile(existing_path):
                    try:
                        os.remove(existing_path)
                    except OSError:
                        pass

        final_name = f'icon{ext}'
        final_path = os.path.join(subject_dir, final_name)
        with open(final_path, 'wb') as file:
            file.write(icon_bytes)

        url = '/{}/{}/{}'.format(get_subject_url_path(), urllib.parse.quote(folder_name), urllib.parse.quote(final_name))
        self.send_json({'success': True, 'name': final_name, 'url': url})

    def handle_reorder_portion_images(self, data):
        subject = data.get('subject', '')
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        order = data.get('order', [])
        if not isinstance(order, list):
            self.send_json({'error': 'order must be a list'}, 400)
            return

        existing = [item['name'] for item in self.list_portion_images(subject)]
        existing_set = set(existing)

        normalized = []
        for item in order:
            name = self.sanitize_filename(str(item))
            if name in existing_set and name not in normalized:
                normalized.append(name)

        for name in existing:
            if name not in normalized:
                normalized.append(name)

        self.write_order(subject, normalized)
        self.send_json({'success': True})

    def handle_delete_portion_image(self, data):
        subject = data.get('subject', '')
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        filename = self.sanitize_filename(data.get('filename', ''))
        if not filename:
            self.send_json({'error': 'filename is required'}, 400)
            return

        portion_dir = self.get_portion_dir(subject)
        if not portion_dir:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        file_path = os.path.join(portion_dir, filename)
        if not os.path.isfile(file_path):
            self.send_json({'error': 'File not found'}, 404)
            return

        try:
            os.remove(file_path)
            current_order = [name for name in self.read_order(subject) if name != filename]
            self.write_order(subject, current_order)
            self.send_json({'success': True})
        except OSError as e:
            self.send_json({'error': f'Delete failed: {str(e)}'}, 500)

    def handle_upload_worksheet(self, data):
        subject = data.get('subject', '')
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        file_base64 = data.get('file_base64', '')
        if not isinstance(file_base64, str) or not file_base64.strip():
            self.send_json({'error': 'file_base64 is required'}, 400)
            return

        raw = file_base64.strip()
        if ',' in raw and raw.lower().startswith('data:'):
            raw = raw.split(',', 1)[1]

        try:
            file_bytes = base64.b64decode(raw, validate=True)
        except (ValueError, binascii.Error):
            self.send_json({'error': 'Invalid base64 data'}, 400)
            return

        if len(file_bytes) > 25 * 1024 * 1024:
            self.send_json({'error': 'File too large (max 25MB)'}, 400)
            return

        worksheets_dir = self.get_worksheets_dir(subject)
        if not worksheets_dir:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        os.makedirs(worksheets_dir, exist_ok=True)

        original_name = data.get('filename', '')
        ext = Path(original_name).suffix.lower()
        if ext not in ALLOWED_WORKSHEET_EXTENSIONS:
            ext = '.pdf'

        preferred_stem = Path(self.sanitize_filename(original_name)).stem
        preferred_name = f'{preferred_stem or "worksheet"}{ext}'

        final_name = self.unique_filename(worksheets_dir, preferred_name, ALLOWED_WORKSHEET_EXTENSIONS)
        final_path = os.path.join(worksheets_dir, final_name)

        with open(final_path, 'wb') as file:
            file.write(file_bytes)

        self.send_json({'success': True, 'name': final_name})

    def handle_delete_worksheet(self, data):
        subject = data.get('subject', '')
        filename = data.get('filename', '')

        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        if not filename:
            self.send_json({'error': 'filename is required'}, 400)
            return

        worksheets_dir = self.get_worksheets_dir(subject)
        if not worksheets_dir:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        file_path = os.path.join(worksheets_dir, filename)
        if os.path.isfile(file_path):
            try:
                os.remove(file_path)
                self.send_json({'success': True})
            except OSError as e:
                self.send_json({'error': f'Delete failed: {str(e)}'}, 500)
        else:
            self.send_json({'error': 'File not found'}, 404)

    def handle_get_portions(self):
        portions_dir = self.get_global_portions_dir()
        if not os.path.isdir(portions_dir):
            self.send_json([])
            return

        order = self.read_portions_order()
        
        files = []
        for filename in os.listdir(portions_dir):
            filepath = os.path.join(portions_dir, filename)
            if os.path.isfile(filepath):
                ext = os.path.splitext(filename)[1].lower()
                if ext in ALLOWED_PORTION_EXTENSIONS:
                    files.append(filename)

        existing = set(files)
        ordered = [name for name in order if name in existing]
        remaining = sorted([name for name in files if name not in set(ordered)], key=str.lower)
        final_names = ordered + remaining

        if final_names != order:
            self.write_portions_order(final_names)

        result = []
        for name in final_names:
            url = '/{}/portions/{}'.format(get_subject_url_path(), urllib.parse.quote(name))
            ext = os.path.splitext(name)[1][1:]
            result.append({'name': name, 'url': url, 'type': ext})
        
        self.send_json(result)

    def handle_upload_portion(self, data):
        file_base64 = data.get('file_base64', '')
        if not isinstance(file_base64, str) or not file_base64.strip():
            self.send_json({'error': 'file_base64 is required'}, 400)
            return

        raw = file_base64.strip()
        if ',' in raw and raw.lower().startswith('data:'):
            raw = raw.split(',', 1)[1]

        try:
            file_bytes = base64.b64decode(raw, validate=True)
        except (ValueError, binascii.Error):
            self.send_json({'error': 'Invalid base64 data'}, 400)
            return

        if len(file_bytes) > 25 * 1024 * 1024:
            self.send_json({'error': 'File too large (max 25MB)'}, 400)
            return

        portions_dir = self.get_global_portions_dir()
        os.makedirs(portions_dir, exist_ok=True)

        original_name = data.get('filename', '')
        ext = Path(original_name).suffix.lower()
        if ext not in ALLOWED_PORTION_EXTENSIONS:
            ext = '.pdf'

        preferred_stem = Path(self.sanitize_filename(original_name)).stem
        preferred_name = f'{preferred_stem or "portion"}{ext}'

        final_name = self.unique_filename(portions_dir, preferred_name, ALLOWED_PORTION_EXTENSIONS)
        final_path = os.path.join(portions_dir, final_name)

        with open(final_path, 'wb') as file:
            file.write(file_bytes)

        current_order = self.read_portions_order()
        if final_name not in current_order:
            current_order.append(final_name)
        self.write_portions_order(current_order)

        self.send_json({'success': True, 'name': final_name})

    def handle_reorder_portions(self, data):
        order = data.get('order', [])
        if not isinstance(order, list):
            self.send_json({'error': 'order must be a list'}, 400)
            return

        portions_dir = self.get_global_portions_dir()
        if not os.path.isdir(portions_dir):
            self.send_json({'success': True})
            return

        files = []
        for filename in os.listdir(portions_dir):
            filepath = os.path.join(portions_dir, filename)
            if os.path.isfile(filepath):
                ext = os.path.splitext(filename)[1].lower()
                if ext in ALLOWED_PORTION_EXTENSIONS:
                    files.append(filename)

        existing = set(files)
        normalized = []
        for item in order:
            name = self.sanitize_filename(str(item))
            if name in existing and name not in normalized:
                normalized.append(name)

        for name in files:
            if name not in normalized:
                normalized.append(name)

        self.write_portions_order(normalized)
        self.send_json({'success': True})

    def handle_delete_portion(self, data):
        filename = data.get('filename', '')
        if not filename:
            self.send_json({'error': 'filename is required'}, 400)
            return

        portions_dir = self.get_global_portions_dir()
        file_path = os.path.join(portions_dir, filename)
        
        if os.path.isfile(file_path):
            try:
                os.remove(file_path)
                current_order = self.read_portions_order()
                if filename in current_order:
                    current_order.remove(filename)
                self.write_portions_order(current_order)
                self.send_json({'success': True})
            except OSError as e:
                self.send_json({'error': f'Delete failed: {str(e)}'}, 500)
        else:
            self.send_json({'error': 'File not found'}, 404)

    def read_portions_order(self):
        order_path = self.get_portions_order_path()
        if not order_path or not os.path.isfile(order_path):
            return []

        try:
            with open(order_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
            if isinstance(data, list):
                return [str(item) for item in data]
        except (json.JSONDecodeError, OSError):
            pass
        return []

    def write_portions_order(self, order):
        order_path = self.get_portions_order_path()
        if not order_path:
            return

        os.makedirs(os.path.dirname(order_path), exist_ok=True)
        with open(order_path, 'w', encoding='utf-8') as file:
            json.dump(order, file, ensure_ascii=False, indent=2)

    def get_learning_materials_dir(self, subject):
        data_dir = self.get_subject_data_dir(subject)
        if not data_dir:
            return None
        return os.path.join(data_dir, 'learning_materials')

    def handle_learning_materials(self, subject):
        folder_path = self.get_learning_materials_dir(subject)
        if not folder_path:
            self.send_json([])
            return

        if not os.path.isdir(folder_path):
            self.send_json([])
            return

        materials = []
        for filename in os.listdir(folder_path):
            path = os.path.join(folder_path, filename)
            if os.path.isfile(path):
                folder_name = self.get_subject_folder(subject)
                name = filename
                url = '{}/{}/learning_materials/{}'.format(get_subject_url_path(), folder_name, filename)
                file_type = self.get_mime_type(filename)
                is_link = False
                
                # Check if it's a link file (JSON)
                if filename.endswith('.json'):
                    try:
                        with open(path, 'r', encoding='utf-8') as f:
                            link_data = json.load(f)
                            if link_data.get('isLink'):
                                url = link_data.get('url', '')
                                name = filename[:-5]  # Remove .json extension
                                file_type = 'Link'
                                is_link = True
                    except:
                        pass
                
                materials.append({
                    'name': name,
                    'url': url,
                    'type': file_type,
                    'isLink': is_link
                })

        self.send_json(materials)

    def handle_upload_learning_material(self, data):
        subject = data.get('subject')
        filename = data.get('filename')
        url = data.get('url')
        is_link = data.get('isLink', False)
        mime_type = data.get('mime_type', '')
        file_base64 = data.get('file_base64')

        if not subject or not filename:
            self.send_json({'error': 'Missing required fields'}, 400)
            return

        materials_dir = self.get_learning_materials_dir(subject)
        if not materials_dir:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        os.makedirs(materials_dir, exist_ok=True)

        if is_link and url:
            # Save link as a JSON file
            link_data = {'url': url, 'isLink': True}
            import json
            final_name = f"{filename}.json"
            final_path = os.path.join(materials_dir, final_name)
            with open(final_path, 'w', encoding='utf-8') as f:
                json.dump(link_data, f)
            self.send_json({'success': True, 'name': filename, 'url': url, 'isLink': True})
            return

        if not file_base64:
            self.send_json({'error': 'Missing file data'}, 400)
            return

        import base64
        file_data = base64.b64decode(file_base64)

        ext = os.path.splitext(filename)[1].lower()
        final_name = self.unique_filename(materials_dir, filename, ALLOWED_ALL_EXTENSIONS)
        final_path = os.path.join(materials_dir, final_name)

        with open(final_path, 'wb') as file:
            file.write(file_data)

        self.send_json({'success': True, 'name': final_name, 'url': '{}/{}/learning_materials/{}'.format(get_subject_url_path(), self.get_subject_folder(subject), final_name)})

    def handle_delete_learning_material(self, data):
        subject = data.get('subject')
        filename = data.get('filename')

        if not subject or not filename:
            self.send_json({'error': 'Missing required fields'}, 400)
            return

        materials_dir = self.get_learning_materials_dir(subject)
        if not materials_dir:
            self.send_json({'error': 'Invalid subject'}, 400)
            return

        # Try direct file first
        file_path = os.path.join(materials_dir, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)
            self.send_json({'success': True})
            return
        
        # Try .json extension for links
        json_path = os.path.join(materials_dir, filename + '.json')
        if os.path.isfile(json_path):
            os.remove(json_path)
            self.send_json({'success': True})
            return
        
        self.send_json({'error': 'File not found'}, 404)

    def get_mime_type(self, filename):
        ext = os.path.splitext(filename)[1].lower()
        type_map = {
            '.mp4': 'MP4', '.webm': 'WEBM', '.mov': 'MOV',
            '.mp3': 'MP3', '.wav': 'WAV',
            '.pdf': 'PDF',
            '.png': 'PNG', '.jpg': 'JPG', '.jpeg': 'JPEG', '.gif': 'GIF',
            '.md': 'MD', '.txt': 'TXT'
        }
        return type_map.get(ext, ext[1:].upper() if ext else 'FILE')

    def send_json(self, data, status=200):
        response = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(response)


def run_server():
    os.chdir(DIRECTORY)
    print(f"About to start server on port {PORT}")
    try:
        with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
            print(f"Server running at http://localhost:{PORT}")
            print(f"Serving files from: {DIRECTORY}")
            try:
                httpd.serve_forever()
            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"Error in serve_forever: {e}")
                raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error starting server: {e}")
        raise


if __name__ == "__main__":
    run_server()

