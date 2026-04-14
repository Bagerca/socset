import os
import shutil

# Имя папки, куда всё соберем
DEST_DIR = "all_files_to_upload"
# Исключения
EXCLUDE_DIRS = {'.git', '__pycache__', 'node_modules', 'venv', '.venv', 'dist', 'build'}

if not os.path.exists(DEST_DIR):
    os.makedirs(DEST_DIR)

for root, dirs, files in os.walk('.'):
    # Пропускаем ненужные папки
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and d != DEST_DIR]
    
    for file in files:
        full_path = os.path.join(root, file)
        # Создаем новое имя файла, заменяя слэши на подчеркивания
        # Это сохранит понимание структуры для нейронки
        relative_path = os.path.relpath(full_path, '.')
        new_name = relative_path.replace(os.sep, '_')
        
        shutil.copy2(full_path, os.path.join(DEST_DIR, new_name))

print(f"Готово! Все файлы лежат в папке: {DEST_DIR}")