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
import socketserver
import urllib.parse
from datetime import datetime
from pathlib import Path

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

SUBJECT_FOLDER_MAP = {
    'english': 'English',
    'hindi': 'Hindi',
    'kannada': 'Kannada',
    'maths': 'Maths',
    'science': 'Science',
    'sst': 'SST'
}

ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
ALLOWED_WORKSHEET_EXTENSIONS = {'.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.webp'}
ALLOWED_PORTION_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.doc', '.docx'}


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

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

        if path == '/api/portions':
            self.handle_get_portions()
            return

        super().do_GET()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path

        if path == '/api/plan':
            data = self.read_json_body()
            if data is None:
                return
            self.handle_save_plan(data)
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

        self.send_error(404, 'Not Found')

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
        return SUBJECT_FOLDER_MAP.get(subject.lower())

    def get_subject_data_dir(self, subject):
        folder_name = self.get_subject_folder(subject)
        if not folder_name:
            return None
        return os.path.join(DIRECTORY, 'data', folder_name)

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
        return os.path.join(DIRECTORY, 'data', 'portions')

    def get_portions_order_path(self):
        return os.path.join(self.get_global_portions_dir(), 'order.json')

    def get_portion_order_path(self, subject):
        portion_dir = self.get_portion_dir(subject)
        if not portion_dir:
            return None
        return os.path.join(portion_dir, 'order.json')

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
        for name in final_names:
            url = '/data/{}/portion/{}'.format(
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
                            'file': f'data/{folder_name}/worksheets/{filename}',
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
            url = '/data/portions/{}'.format(urllib.parse.quote(name))
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
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print(f"Serving files from: {DIRECTORY}")
        httpd.serve_forever()


if __name__ == "__main__":
    run_server()

